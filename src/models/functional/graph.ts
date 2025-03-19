import { gun } from '../Gun';

// Type definitions for Gun souls and node references
type GunSoul = string;  // The Gun soul identifier (_["#"])
type NodeName = string; // For display and backward compatibility

// Forward declaration of the clearCalculationCaches function from calculations.ts
// We'll use this to clear caches when data changes in the graph
let clearCalculationCaches: () => void;

// Function to register the cache clearing function from calculations.ts
function registerCacheClearer(clearer: () => void) {
    clearCalculationCaches = clearer;
    console.log('[graph] Cache clearer registered');
}

// Helper function to invalidate caches when nodes change
function invalidateCaches() {
    if (clearCalculationCaches) {
        clearCalculationCaches();
    }
}

// Maps to track nodes by both soul and name (for transition period)
const soulToNodeRef = new Map<GunSoul, any>();  // Primary storage by soul
const nameToSoul = new Map<NodeName, GunSoul>(); // For backward compatibility

// Cache of loaded nodes by soul
const nodeCache = new Map<GunSoul, any>();

// Helper to get a node's soul from a Gun reference
function getSoul(nodeRef: any): GunSoul | null {
    if (!nodeRef || !nodeRef._ || !nodeRef._['#']) return null;
    return nodeRef._['#'];
}

// Helper to register a node in our maps
function registerNode(nodeRef: any, name: NodeName): GunSoul | null {
    const soul = getSoul(nodeRef);
    if (!soul) return null;
    
    soulToNodeRef.set(soul, nodeRef);
    nameToSoul.set(name, soul);
    return soul;
}

// Create or update a node
function node(name: NodeName, types: (GunSoul | NodeName)[] = [], children: (GunSoul | NodeName)[] = [], 
              parent: GunSoul | NodeName | null = null, points: number = 0, 
              manualFulfillment: number | null = null) {
              
    // First, resolve the parent soul if it's a name
    let parentSoul: GunSoul | null = null;
    if (parent) {
        // If parent appears to be a soul already, use it directly
        if (typeof parent === 'string' && parent.includes('~')) {
            parentSoul = parent as GunSoul;
        } else {
            // Otherwise look it up by name
            parentSoul = nameToSoul.get(parent as NodeName) || null;
        }
    }
    
    // Create the node data
    const nodeData = {
        name: name,
        parent: parentSoul,
        points: points,
        manualFulfillment: manualFulfillment,
    };

    // Create or update the node in Gun
    const nodeRef = gun.get('nodes').get(name).put(nodeData);
    
    // Register the node in our maps
    const nodeSoul = registerNode(nodeRef, name);
    
    // Set up children relationships
    for (const child of children) {
        // Get the child reference
        let childSoul: GunSoul | null = null;
        let childRef;
        
        // If the child looks like a soul, use it directly
        if (typeof child === 'string' && child.includes('~')) {
            childSoul = child as GunSoul;
            childRef = soulToNodeRef.get(childSoul) || gun.get(childSoul);
        } else {
            // Otherwise look it up by name
            childSoul = nameToSoul.get(child as NodeName);
            if (childSoul) {
                childRef = soulToNodeRef.get(childSoul);
            } else {
                // If we don't have it yet, create a reference by name
                childRef = gun.get('nodes').get(child as NodeName);
                childSoul = getSoul(childRef);
                if (childSoul) {
                    soulToNodeRef.set(childSoul, childRef);
                    nameToSoul.set(child as NodeName, childSoul);
                }
            }
        }
        
        if (childRef) {
            nodeRef.get('children').set(childRef);
        }
    }
    
    // Set up type relationships
    for (const type of types) {
        // Get the type reference
        let typeSoul: GunSoul | null = null;
        let typeRef;
        
        // If the type looks like a soul, use it directly
        if (typeof type === 'string' && type.includes('~')) {
            typeSoul = type as GunSoul;
            typeRef = soulToNodeRef.get(typeSoul) || gun.get(typeSoul);
        } else {
            // Otherwise look it up by name
            typeSoul = nameToSoul.get(type as NodeName);
            if (typeSoul) {
                typeRef = soulToNodeRef.get(typeSoul);
            } else {
                // If we don't have it yet, create a reference by name
                typeRef = gun.get('nodes').get(type as NodeName);
                typeSoul = getSoul(typeRef);
                if (typeSoul) {
                    soulToNodeRef.set(typeSoul, typeRef);
                    nameToSoul.set(type as NodeName, typeSoul);
                }
            }
        }
        
        if (typeRef) {
            nodeRef.get('types').set(typeRef);
        }
    }

    // Invalidate caches since we've modified the graph
    invalidateCaches();
    
    return nodeRef;
}

// Get a node reference by name or soul
function getNode(identifier: GunSoul | NodeName) {
    // First, check if the identifier is a soul
    if (typeof identifier === 'string' && identifier.includes('~')) {
        // It's a soul, look up directly
        if (soulToNodeRef.has(identifier)) {
            return soulToNodeRef.get(identifier);
        }
        
        // If not in our registry, get from Gun directly
        const nodeRef = gun.get(identifier);
        // Register it
        soulToNodeRef.set(identifier, nodeRef);
        
        // We'll need to get its name later for the name-to-soul map
        nodeRef.once((data) => {
            if (data && data.name) {
                nameToSoul.set(data.name, identifier);
            }
        });
        
        return nodeRef;
    }
    
    // It's a name, check our name-to-soul map
    const soul = nameToSoul.get(identifier as NodeName);
    if (soul && soulToNodeRef.has(soul)) {
        return soulToNodeRef.get(soul);
    }
    
    // Otherwise get from Gun by name and register
    const nodeRef = gun.get('nodes').get(identifier as NodeName);
    const nodeSoul = getSoul(nodeRef);
    
    if (nodeSoul) {
        soulToNodeRef.set(nodeSoul, nodeRef);
        nameToSoul.set(identifier as NodeName, nodeSoul);
    }
    
    return nodeRef;
}

// Subscribe to a node's data and get a live object
function subscribe(identifier: GunSoul | NodeName, callback?: (node: any) => void) {
    const nodeRef = getNode(identifier);
    const nodeSoul = getSoul(nodeRef);
    
    if (!nodeSoul) {
        console.error(`[graph] Cannot subscribe to node without a soul: ${identifier}`);
        return null;
    }
    
    // Subscribe to basic properties
    nodeRef.on((data) => {
        if (!data) return;
        
        // Update cache
        if (!nodeCache.has(nodeSoul)) {
            nodeCache.set(nodeSoul, {
                soul: nodeSoul,
                name: data.name,
                children: new Map(),
                types: new Set(),
                ...data
            });
        } else {
            const cached = nodeCache.get(nodeSoul);
            Object.assign(cached, data);
            
            // Make sure the soul is always set
            cached.soul = nodeSoul;
        }
        
        // Invalidate calculation caches when node data changes
        invalidateCaches();
        
        if (callback) callback(nodeCache.get(nodeSoul));
    });
    
    // Subscribe to children
    nodeRef.get('children').map().on((data, childKey) => {
        if (childKey === '_' || !data) return;
        
        // Get the child reference
        const childRef = gun.get(childKey);
        const childSoul = getSoul(childRef);
        
        if (!childSoul) return;
        
        const cache = nodeCache.get(nodeSoul);
        if (cache && !cache.children.has(childSoul)) {
            // Recursively subscribe to child
            subscribe(childSoul, (childData) => {
                // Child data updated
                cache.children.set(childSoul, childData);
                
                // Invalidate calculation caches when child relationships change
                invalidateCaches();
                
                if (callback) callback(cache);
            });
        }
    });
    
    // Subscribe to types
    nodeRef.get('types').map().on((data, typeKey) => {
        if (typeKey === '_' || !data) return;
        
        // Get the type reference
        const typeRef = gun.get(typeKey);
        const typeSoul = getSoul(typeRef);
        
        if (!typeSoul) return;
        
        const cache = nodeCache.get(nodeSoul);
        if (cache) {
            cache.types.add(typeSoul);
            
            // Invalidate calculation caches when type relationships change
            invalidateCaches();
            
            if (callback) callback(cache);
        }
    });
    
    return nodeCache.get(nodeSoul);
}

// Add a child to a node
function addChild(parentIdentifier: GunSoul | NodeName, childIdentifier: GunSoul | NodeName) {
    const parentRef = getNode(parentIdentifier);
    const childRef = getNode(childIdentifier);
    
    const parentSoul = getSoul(parentRef);
    const childSoul = getSoul(childRef);
    
    if (!parentSoul || !childSoul) {
        console.error(`[graph] Cannot add child: Invalid souls - Parent: ${parentIdentifier}, Child: ${childIdentifier}`);
        return null;
    }
    
    // Set the parent on the child
    childRef.put({ parent: parentSoul });
    
    // Add child to parent's children
    const result = parentRef.get('children').set(childRef);
    
    // Invalidate caches since we've modified the graph structure
    invalidateCaches();
    
    return result;
}

// Add a type to a node
function addType(nodeIdentifier: GunSoul | NodeName, typeIdentifier: GunSoul | NodeName) {
    const nodeRef = getNode(nodeIdentifier);
    const typeRef = getNode(typeIdentifier);
    
    const nodeSoul = getSoul(nodeRef);
    const typeSoul = getSoul(typeRef);
    
    if (!nodeSoul || !typeSoul) {
        console.error(`[graph] Cannot add type: Invalid souls - Node: ${nodeIdentifier}, Type: ${typeIdentifier}`);
        return null;
    }
    
    const result = nodeRef.get('types').set(typeRef);
    
    // Invalidate caches since we've modified type relationships
    invalidateCaches();
    
    return result;
}

// Remove a child from a node
function removeChild(parentIdentifier: GunSoul | NodeName, childIdentifier: GunSoul | NodeName) {
    const parentRef = getNode(parentIdentifier);
    const childRef = getNode(childIdentifier);
    
    const parentSoul = getSoul(parentRef);
    const childSoul = getSoul(childRef);
    
    if (!parentSoul || !childSoul) {
        console.error(`[graph] Cannot remove child: Invalid souls - Parent: ${parentIdentifier}, Child: ${childIdentifier}`);
        return null;
    }
    
    const result = parentRef.get('children').get(childSoul).put(null);
    
    // Invalidate caches since we've modified the graph structure
    invalidateCaches();
    
    return result;
}

// Remove a type from a node
function removeType(nodeIdentifier: GunSoul | NodeName, typeIdentifier: GunSoul | NodeName) {
    const nodeRef = getNode(nodeIdentifier);
    const typeRef = getNode(typeIdentifier);
    
    const nodeSoul = getSoul(nodeRef);
    const typeSoul = getSoul(typeRef);
    
    if (!nodeSoul || !typeSoul) {
        console.error(`[graph] Cannot remove type: Invalid souls - Node: ${nodeIdentifier}, Type: ${typeIdentifier}`);
        return null;
    }
    
    const result = nodeRef.get('types').get(typeSoul).put(null);
    
    // Invalidate caches since we've modified type relationships
    invalidateCaches();
    
    return result;
}

function setPoints(nodeIdentifier: GunSoul | NodeName, points: number) {
    const nodeRef = getNode(nodeIdentifier);
    
    const nodeSoul = getSoul(nodeRef);
    if (!nodeSoul) {
        console.error(`[graph] Cannot set points: Invalid soul - Node: ${nodeIdentifier}`);
        return null;
    }
    
    const result = nodeRef.put({ points: points });
    
    // Invalidate caches since point changes affect weight calculations
    invalidateCaches();
    
    return result;
}

function setFulfillment(nodeIdentifier: GunSoul | NodeName, manualFulfillment: number) {
    const nodeRef = getNode(nodeIdentifier);
    
    const nodeSoul = getSoul(nodeRef);
    if (!nodeSoul) {
        console.error(`[graph] Cannot set fulfillment: Invalid soul - Node: ${nodeIdentifier}`);
        return null;
    }
    
    const result = nodeRef.put({ manualFulfillment: manualFulfillment });
    
    // Invalidate caches since fulfillment changes affect calculations
    invalidateCaches();
    
    return result;
}


// Find nodes by property
function findNodes(property: string, value: any, callback?: (soul: GunSoul, data: any) => void) {
    gun.get('nodes').map().on((data, key) => {
        if (key === '_' || !data) return;
        if (data[property] === value) {
            const nodeRef = gun.get(key);
            const soul = getSoul(nodeRef);
            
            if (soul && callback) {
                callback(soul, data);
            }
        }
    });
}

// Get all direct children of a node
function getChildren(nodeIdentifier: GunSoul | NodeName, callback?: (souls: GunSoul[]) => void) {
    const nodeRef = getNode(nodeIdentifier);
    const children: GunSoul[] = [];
    
    nodeRef.get('children').map().once((data, childKey) => {
        if (childKey === '_' || !data) return;
        
        // Get the soul directly
        children.push(childKey);
        
        // When we've processed all children
        if (children.length === Object.keys(data).filter(k => k !== '_').length) {
            if (callback) callback(children);
        }
    });
}

// Export the functions and objects
export {
    // Core node operations
    node,
    getNode,
    subscribe,
    addChild,
    addType, 
    removeChild,
    removeType,
    setPoints,
    setFulfillment,
    
    // Helper functions
    getSoul,
    findNodes,
    getChildren,
    
    // Maps and caches
    soulToNodeRef,
    nameToSoul,
    nodeCache,
    
    // Cache management
    registerCacheClearer
};

// Export the types
export type {
    GunSoul,
    NodeName
};