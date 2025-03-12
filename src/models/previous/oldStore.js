import * as GunX from '../Gun';
import { Node } from './Node';

/*
TARGET STRUCTURE:

childId and typeId are always a NodeId. Which means that they are always a key in the nodes map.

gun.user() -> {
    nodes: {
        [user.is.pub]: {  // Root node using Gun user's public key
            id: user.is.pub,
            name: username,
            parentId: null,
            childrenIds: {
                [childId]: true
            },
            typeIds: {
                [typeId]: true
            },
            points: 0,
            isContributor: true,
            manualFulfillment: null,
        },
        [nodeId]: { ... },  // Other nodes
    },
    types: {
        [typeId]: {
            [instanceId]: true
        }
    }
}
*/

// Process
// 1. Load each node
// 2. use addNodeChild to add children to each node
// 3. use addType to add the nodes corresponding types to each node

export class Store {
    constructor(root) {
        this.root = root;
        this.saveQueue = new Set();
        this.nodesRef = GunX.user.get('nodes');
        
        // Main storage for nodes - Map of ID -> Node object
        this.nodes = new Map();
        this.nodes.set(root.id, root);
        
        // Process save queue periodically
        this.saveInterval = setInterval(() => {
            if (this.saveQueue.size > 0) {
                this.processSaveQueue();
            }
        }, 100);
        
        console.log('🏗️ Store initialized with root node:', root.id);
    }
    
    // Main method to start syncing with Gun
    async sync() {
        console.log('🔄 Starting store sync...');
        
        try {
            // First load - get all nodes from Gun
            const nodeCount = await this.loadAll();
            console.log(`✅ Initial sync complete, loaded ${nodeCount} nodes`);
            
            // Then set up subscriptions for future changes
            this.subscribeToChanges();
            
            return nodeCount;
        } catch (error) {
            console.error('❌ Error during sync:', error);
            return 0;
        }
    }
    
    // Subscribe to node changes in Gun
    subscribeToChanges() {
        // Keep track of nodes we've recently seen to avoid processing
        // the same node multiple times in quick succession
        const recentChanges = new Map(); 
        
        this.nodesRef.map().on((data, id) => {
            // Skip if we've processed this node+data combo recently
            const nodeSignature = id + JSON.stringify(data);
            const now = Date.now();
            
            if (recentChanges.has(id)) {
                const lastChange = recentChanges.get(id);
                if (now - lastChange.time < 1000 && lastChange.signature === nodeSignature) {
                    return; // Skip if same change processed within the last second
                }
            }
            
            // Record this change
            recentChanges.set(id, {
                time: now,
                signature: nodeSignature
            });
            
            // Clean up old entries from recentChanges map
            if (recentChanges.size > 100) {
                const keysToDelete = [];
                for (const [key, value] of recentChanges.entries()) {
                    if (now - value.time > 5000) { // Remove entries older than 5 seconds
                        keysToDelete.push(key);
                    }
                }
                keysToDelete.forEach(key => recentChanges.delete(key));
            }
            
            console.log(`📢 Change detected in node: ${id}`);
            
            // Skip Gun metadata
            if (id === '_' || id === '#' || id.startsWith('_')) return;
            
            // Load or update the node
            const existingNode = this.nodes.get(id);
            if (existingNode) {
                this.updateNodeFromGun(existingNode, data);
                this.resolveReferences(existingNode);
            } else {
                this.loadNode(id);
            }
        });
        
        console.log(`🔔 Setting up subscriptions to node changes`);
    }
    
    // Update an existing node with new data from Gun
    updateNodeFromGun(node, data) {
        if (!data) return;
        
        // Filter out Gun metadata properties
        for (let key in data) {
            // Skip Gun metadata
            if (key === '_' || key === '#' || key.startsWith('_')) continue;
            
            if (key === 'childrenIds') {
                // Process childrenIds separately
                const cleanChildrenIds = {};
                
                // Only keep real childIds (not Gun metadata)
                for (let childId in data.childrenIds) {
                    // Skip metadata keys
                    if (childId === '_' || childId === '#' || childId.startsWith('_') || 
                        // Also skip Gun.js soul references (which start with ~)
                        typeof data.childrenIds[childId] === 'string' && data.childrenIds[childId].startsWith('~')) {
                        continue;
                    }
                    cleanChildrenIds[childId] = data.childrenIds[childId];
                }
                
                node.childrenIds = cleanChildrenIds;
            } else if (key !== 'children') { // Don't directly set the children Map
                node[key] = data[key];
            }
        }
        
        console.log(`✅ Updated node: ${node.name} (${node.id})`);
    }
    
    // Convert Node to Gun format for saving
    toGun(node) {        
        return {
            id: node.id,
            name: node.name,
            parentId: node.parentId,
            childrenIds: node.childrenIds,
            typeIds: node.typeIds,
            points: Number(node.points) || 0,
            isContributor: Boolean(node.isContributor),
            manualFulfillment: node.manualFulfillment === null ? 
                null : Number(node.manualFulfillment)
        };
    }
    
    // Create a Node from Gun data
    fromGun(data) {
        // Create node with parentId
        const node = new Node(
            data.name, 
            data.parentId,
            data.typeIds || {}, 
            data.id,
            data.childrenIds || {},
            data.manualFulfillment
        );
        
        // Set basic properties
        node.points = Number(data.points) || 0;
        node.isContributor = Boolean(data.isContributor);
        
        // Add to nodes map
        this.nodes.set(node.id, node);
        
        // Return the new node
        return node;
    }
    
    // Load a node by ID
    async loadNode(nodeId) {
        return new Promise(resolve => {
            this.nodesRef.get(nodeId).once(data => {
                if (!data || !data.id) {
                    console.log(`⚠️ No data found for node: ${nodeId}`);
                    resolve(null);
                    return;
                }
                
                console.log(`🔍 Loading node: ${data.id} (${data.name})`);
                
                try {
                    const node = this.fromGun(data);
                    this.resolveReferences(node);
                    resolve(node);
                } catch (error) {
                    console.error(`❌ Error loading node ${nodeId}:`, error);
                    resolve(null);
                }
            });
        });
    }
    
    // Load all nodes from Gun
    async loadAll() {
        return new Promise(resolve => {
            const loadedIds = new Set();
            let completed = false;
            let timeout;
            
            // First, mark this as a loading process
            console.log('🚀 Loading all nodes...');
            
            // When a node is seen, try to load it
            this.nodesRef.map().once(async (data, id) => {
                if (!data || !data.id || id === '_' || completed) return;
                
                // Skip if already loaded
                if (loadedIds.has(data.id)) return;
                loadedIds.add(data.id);
                
                // Load the node
                try {
                    const node = this.fromGun(data);
                    console.log(`✅ Loaded node: ${node.name} (${node.id})`);
                } catch (error) {
                    console.error(`❌ Error loading node ${data.id}:`, error);
                }
            });
            
            // Set timeout to resolve after nodes have time to load
            timeout = setTimeout(() => {
                if (completed) return;
                completed = true;
                
                // Resolve references between nodes
                console.log(`🔄 Resolving references between ${this.nodes.size} nodes...`);
                Array.from(this.nodes.values()).forEach(node => this.resolveReferences(node));
                
                console.log(`✅ Completed loading ${this.nodes.size} nodes`);
                resolve(this.nodes.size);
            }, 2000); // Allow 2 seconds for initial load
        });
    }
    
    // Save queued nodes to Gun
    async processSaveQueue() {
        const queueSize = this.saveQueue.size;
        if (queueSize === 0) return;
        
        console.log(`💾 Processing save queue: ${queueSize} nodes`);
        const nodesToSave = Array.from(this.saveQueue);
        this.saveQueue.clear();
        
        try {
            await Promise.all(nodesToSave.map(node => {
                const data = this.toGun(node);
                
                return new Promise((resolve, reject) => {
                    this.nodesRef.get(node.id).put(data, ack => {
                        if (ack.err) {
                            console.error(`❌ Failed to save node: ${node.name}`, ack.err);
                            reject(ack.err);
                        } else {
                            console.log(`✅ Saved node: ${node.name}`);
                            resolve();
                        }
                    });
                });
            }));
        } catch (error) {
            console.error('❌ Error processing save queue:', error);
            // Re-add failed nodes to try again
            nodesToSave.forEach(node => this.saveQueue.add(node));
        }
    }
    
    // Remove a node from Gun and local storage
    async removeNode(node) {
        console.log(`🗑️ Removing node: ${node.name} (${node.id})`);
        
        try {
            // Remove from Gun
            await new Promise((resolve, reject) => {
                this.nodesRef.get(node.id).put(null, ack => {
                    if (ack.err) reject(new Error(ack.err));
                    else resolve();
                });
            });
            
            // Remove from local cache
            this.nodes.delete(node.id);
            console.log(`✅ Node removed: ${node.name}`);
        } catch (error) {
            console.error(`❌ Error removing node: ${node.name}`, error);
        }
    }

    // This method resolves the parent reference using the store
    resolveReferences(node) {
        // Skip nodes that have already been processed in this cycle
        if (node._processingReferences) return;
        node._processingReferences = true;
        
        try {
            // Resolve parent reference if we have a parentId
            if (node.parentId && node.parentId !== '#') {
                const parent = this.nodes.get(node.parentId);
                if (parent) {
                    node._parent = parent;
                    
                    // Now get the root's typeIndex
                    if (node.root && node.root.typeIndex) {
                        node.typeIndex = node.root.typeIndex;
                    }
                    
                    // Add this node to parent's children - this needs to be careful to avoid circular calls
                    if (parent.childrenIds && !parent.childrenIds[node.id]) {
                        parent.childrenIds[node.id] = true;
                        parent.children.set(node.id, node);
                    }
                }
            }
            
            // Now that we have resolved references, add the typeIds
            if (node.typeIndex && node.typeIds) {
                // Filter out Gun metadata
                const cleanTypeIds = {};
                for (let typeId in node.typeIds) {
                    if (typeId !== '_' && typeId !== '#' && !typeId.startsWith('_')) {
                        cleanTypeIds[typeId] = node.typeIds[typeId];
                    }
                }
                node.typeIds = cleanTypeIds;
            }
        } finally {
            // Always clean up the processing flag
            delete node._processingReferences;
        }
    }
    
    // Clean up resources
    destroy() {
        clearInterval(this.saveInterval);
        console.log('🧹 Store resources cleaned up');
    }
}