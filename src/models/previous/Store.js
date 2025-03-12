import { Node } from './Node';
import * as GunX from '../Gun';

/*
Data can be in graphs that link across different spaces. So don't assume data is only in one space! For instance, user data can point to public data which can be edited by anyone, just not the link itself. Likewise, public data could link to frozen or user data, but anyone could edit the link itself. One very powerful combination is frozen links to user data, nobody can edit the link but the data itself can be updated by the owner.

gun.get('#users').map().get('country').on(data => console.log(data))
Pretend that #users is a frozen list where each item links to a user profile. Rather than a user saving {name: "Alice", country: "USA"} to their profile, they could instead link to the public wiki about their country. Now our query will get the the country data of each user, like {name: "United States of America", code: "USA", population: 300,000,000} as it is updated in realtime.
*/

// lets use Souls instead of our own Node ids.

//   gun = Gun(['http://localhost:8765/gun', 'https://gun-manhattan.herokuapp.com/gun']);
//   copy = gun.get('test').get('paste');
//   paste.oninput = () => { copy.put(paste.value) };
//   copy.on((data) => { paste.value = data });

/*
How? 
First we setup a small amount of HTML to make a full size text area for users to type into. Then we load GUN and connect to our local relay or some other peers. All peers, even your browser, help other peers find data and each other. This keeps things decentralized.

Next we ask gun to get some data. This could be anything, like "Mark's age", or the paste record on the test table. We can keep chaining these queries together to traverse any graph of data.

copy is a chain reference to the data, it is not the value of the data yet.

Before we can read any data, we first must write to it on the reference. So we add an oninput callback listener to the HTML paste id. This fires with events any time the user inputs or changes a value. Now all we have to do is call put to save data on that chain reference. GUN will now synchronize it to other peers online.

Finally, we want to listen to realtime updates on the chain reference. Just like how we added a listener to the HTML, we can also add a listener to GUN. It gets called with data which is the raw actual value we want, and we then update the paste textarea with that value.

Whenever we refresh the page, .on( will also get and merge the latest cached data.

Note: If no data is found on the key ('alice', etc.) when we .get it, gun will implicitly create and update it upon a .put. This is useful and convenient for most but not all apps.

*/

// ideally our node.id is our node's Souls id?

const store = function(id) {
    return gunX.user.get(id)
}

function saveNode(id, name, parentId, childrenIds = [], typeIds = [], isContributor = false, manualFulfillment = 0) {
    setName(id, name)
    setParent(id, parentId)
    setChildren(id, childrenIds)
    setTypes(id, typeIds)
    setIsContributor(id, isContributor)
    setManualFulfillment(id, manualFulfillment)
}

function setName(nodeId, name) {
    store(nodeId).put({
        name: name
    })
}

function setPoints(nodeId, points) {
    store(nodeId).put({
        points: points
    })
}

function addType(toId, typeId) {
    const type = store(typeId)
    const types = store(toId).get('types')
    types.set(type)
}

function addTypes(toId, typeIds) {
    typeIds.forEach(typeId => {
        addType(toId, typeId)
    })
}

function addChild(toId, childId) {
    const child = store(childId)
    const children = store(toId).get('children')
    children.set(child)
}

function addChildren(toId, childrenIds) {
    childrenIds.forEach(childId => {
        addChild(toId, childId)
    })
}

function setParent(forId, parentId) {
    const parent = store(parentId)
    store(forId).put({
        parent: parent
    })
}

function setIsContributor(nodeId, isContributor = true) {
    store(nodeId).put({
        isContributor: isContributor
    })
}

function setManualFulfillment(nodeId, manualFulfillment = 0) {
    store(nodeId).put({
        manualFulfillment: manualFulfillment
    })
}

/*
It is now easy to iterate through our list of people.

people.map().once(function(person){
  console.log("The person is", person);
});

Note: If .map is given no callback, it simply iterates over each item in the list "as is" - thus acting like a for each loop in javascript. Also, everything is continuously evaluating in GUN, including .map, so it will get called when new items are added as well as when an item is updated. It does not iterate through the whole list again every time, just the changes. This is great for realtime applications.
*/

function getTypes(nodeId) {
    const types = store(nodeId).get('types')
    const allTypes = []
    types.map().once(function(type){
        allTypes.push(type)
    });
    return allTypes
}

function getChildren(nodeId) {
    const children = store(nodeId).get('children')
    const allChildren = []
    children.map().once(function(child){
        allChildren.push(child)
    });
    return allChildren
}

/*
Warning: Not included by default! You must include it yourself via require('gun/lib/unset.js') or <script src="https://cdn.jsdelivr.net/npm/gun/lib/unset.js"></script>!
*/

function removeType(fromId, typeId) {
    const type = store(typeId)
    const types = store(fromId).get('types')
    types.unset(type)
}

function removeChild(fromId, childId) {
    const child = store(childId)
    const children = store(fromId).get('children')
    children.unset(child)
}

/*
After you save some data in an unordered list, you may need to remove it.
        let gun = new Gun();
        let machines = gun.get('machines');
        let machine = gun.get('machine/tesseract');
        machine.put({faces: 24, cells: 8, edges: 32});
        // let's add machine to the list of machines;
        machines.set(machine);
        // now let's remove machine from the list of machines
        machines.unset(machine);
*/

function refreshNode(nodeId) {
    const nodeData = gunX.user.get(nodeId)
    nodeData.on((data) => {
        console.log('data', data)
    })
}

/*
Note: We can have 1-1, 1-N, N-N relationships. By default every relationship is a "directed" graph (it only goes in one direction), so if you want bi-directional relationships you must explicitly save the data as being so (like with Dave and his kid, Carl). 

If you want to have meta information about the relationship, simply create an "edge" node that both properties point to instead. Many graph databases do this by default, but because not all data structures require it, gun leaves it to you to specify.

// Perhaps we should have mutual-recognition and roles be edge relationship between nodes! That is derived?
*/




// I wonder if we should even have a live-memory version, or if we should just use Gun for everything.
// and write our functions to work over the live data.



export class Store {
    constructor(root) {
        // Store reference to the root node (App)
        this.root = root;
        
        // Queue for batching save operations
        this.saveQueue = new Set();
        
        // Loaded nodes cache indexed by ID
        this.nodes = new Map();
        
        // Reference to the Gun nodes collection
        this.nodesRef = GunX.user.get('nodes');
        
        // Set up save interval (process queue every 500ms)
        this.saveInterval = setInterval(() => this.processSaveQueue(), 500);
        
        // Add root node to our cache
        this.nodes.set(this.root.id, this.root);
        
        console.log(`🏗️ Store initialized with root node: ${this.root.id}`);
    }
    
    /**
     * Initialize the store and load data
     */
    async sync() {
        console.log(`🔄 Starting store sync...`);
        
        // Load all nodes
        await this.loadAll();
        
        // Subscribe to changes
        this.subscribeToChanges();
        
        console.log(`✅ Initial sync complete, loaded ${this.nodes.size} nodes`);
        return this.nodes.size;
    }
    
    /**
     * Subscribe to changes from Gun
     */
    subscribeToChanges() {
        // Track recent changes to prevent recursive loops
        const recentChanges = new Map();
        
        this.nodesRef.map().on((data, id) => {
            // Skip Gun metadata
            if (id === '_' || id === '#' || id.startsWith('_')) return;
            
            // Debounce rapid changes to the same node
            const now = Date.now();
            const signature = JSON.stringify(data);
            
            if (recentChanges.has(id)) {
                const lastUpdate = recentChanges.get(id);
                if (now - lastUpdate.time < 300 && lastUpdate.signature === signature) {
                    return; // Skip if same update within 300ms
                }
            }
            
            // Record this update
            recentChanges.set(id, { time: now, signature });
            
            // Clean up old entries
            if (recentChanges.size > 50) {
                const keysToDelete = [];
                for (const [key, value] of recentChanges.entries()) {
                    if (now - value.time > 3000) {
                        keysToDelete.push(key);
                    }
                }
                keysToDelete.forEach(key => recentChanges.delete(key));
            }
            
            console.log(`📢 Change detected in node: ${id}`);
            
            // Handle the update
            const existingNode = this.nodes.get(id);
            if (existingNode) {
                this.updateNodeFromGun(existingNode, data);
            } else {
                this.loadNode(id);
            }
        });
        
        console.log(`🔔 Set up subscriptions to node changes`);
    }
    
    /**
     * Update a node with data from Gun
     */
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
                    if (childId === '_' || childId === '#' || childId.startsWith('_')) continue;
                    if (typeof data.childrenIds[childId] === 'string' && 
                        data.childrenIds[childId].startsWith('~')) continue;
                    
                    cleanChildrenIds[childId] = true;
                }
                
                node.childrenIds = cleanChildrenIds;
            } else if (key === 'typeIds') {
                // Same for typeIds
                const cleanTypeIds = {};
                for (let typeId in data.typeIds) {
                    if (typeId === '_' || typeId === '#' || typeId.startsWith('_')) continue;
                    if (typeof data.typeIds[typeId] === 'string' && 
                        data.typeIds[typeId].startsWith('~')) continue;
                    
                    cleanTypeIds[typeId] = true;
                }
                node.typeIds = cleanTypeIds;
            } else if (key !== 'children') { // Don't directly set the children Map
                node[key] = data[key];
            }
        }
        
        // Always call resolveReferences after updating a node
        this.resolveReferences(node);
        
        console.log(`✅ Updated node: ${node.name} (${node.id})`);
    }
    
    /**
     * Convert a Node to a Gun-friendly format
     */
    toGun(node) {
        // Create a clean object with only the data we want to store
        const data = {
            id: node.id,
            name: node.name,
            points: node.points,
            parentId: node.parentId,
            childrenIds: { ...node.childrenIds },
            typeIds: { ...node.typeIds },
            isContributor: node.isContributor,
            manualFulfillment: node.manualFulfillment
        };
        
        return data;
    }
    
    /**
     * Create a Node from Gun data
     */
    fromGun(data) {
        if (!data || !data.id) return null;
        
        // Clean up childrenIds
        const childrenIds = {};
        if (data.childrenIds) {
            for (let id in data.childrenIds) {
                if (id !== '_' && id !== '#' && !id.startsWith('_')) {
                    if (typeof data.childrenIds[id] !== 'string' || !data.childrenIds[id].startsWith('~')) {
                        childrenIds[id] = true;
                    }
                }
            }
        }
        
        // Clean up typeIds
        const typeIds = {};
        if (data.typeIds) {
            for (let id in data.typeIds) {
                if (id !== '_' && id !== '#' && !id.startsWith('_')) {
                    if (typeof data.typeIds[id] !== 'string' || !data.typeIds[id].startsWith('~')) {
                        typeIds[id] = true;
                    }
                }
            }
        }
        
        // Create a new Node instance
        const node = new Node(
            data.name,
            data.parentId,
            typeIds,
            data.id,
            childrenIds,
            data.manualFulfillment
        );
        
        node.points = data.points || 0;
        node.isContributor = data.isContributor || false;
        
        return node;
    }
    
    /**
     * Load a node by ID
     */
    async loadNode(nodeId) {
        // Skip invalid IDs
        if (!nodeId || nodeId === '#' || nodeId === '_' || nodeId.startsWith('_')) {
            console.warn(`⚠️ Skipping invalid node ID: ${nodeId}`);
            return null;
        }
        
        // Return from cache if already loaded
        if (this.nodes.has(nodeId)) {
            return this.nodes.get(nodeId);
        }
        
        console.log(`🔍 Loading node: ${nodeId}`);
        
        try {
            // Get the node data from Gun
            const data = await new Promise(resolve => {
                this.nodesRef.get(nodeId).once(nodeData => {
                    resolve(nodeData);
                });
            });
            
            if (!data) {
                console.warn(`⚠️ No data found for node: ${nodeId}`);
                return null;
            }
            
            // Create a Node from the data
            const node = this.fromGun(data);
            if (!node) return null;
            
            // Add to our cache
            this.nodes.set(nodeId, node);
            
            // Resolve references
            this.resolveReferences(node);
            
            console.log(`✅ Loaded node: ${node.name} (${node.id})`);
            return node;
        } catch (error) {
            console.error(`❌ Error loading node: ${nodeId}`, error);
            return null;
        }
    }
    
    /**
     * Load all nodes
     */
    async loadAll() {
        console.log(`🚀 Loading all nodes...`);
        
        // Get all node IDs from Gun
        const nodeIds = await new Promise(resolve => {
            const ids = [];
            this.nodesRef.map().once((data, id) => {
                if (id !== '_' && id !== '#' && !id.startsWith('_')) {
                    ids.push(id);
                }
            });
            
            // Give Gun time to deliver all nodes
            setTimeout(() => resolve(ids), 100);
        });
        
        // Load each node
        for (const id of nodeIds) {
            await this.loadNode(id);
        }
        
        console.log(`🔄 Resolving references between ${this.nodes.size} nodes...`);
        
        // Resolve references for all nodes
        for (const node of this.nodes.values()) {
            this.resolveReferences(node);
        }

        // The root node needs some special attention
        const rootNode = this.root;
        if (rootNode) {
            // Dump some debug info to help diagnose issues
            console.log(`Root node: ${rootNode.name} (${rootNode.id})`);
            console.log(`Root childrenIds:`, rootNode.childrenIds);
            
            // Make sure we connect all top-level nodes to the root
            for (const node of this.nodes.values()) {
                if (node.id !== rootNode.id && !node.parentId) {
                    console.log(`Adding orphaned node ${node.name} to root`);
                    node.parentId = rootNode.id;
                    node._parent = rootNode;
                    rootNode.childrenIds[node.id] = true;
                    rootNode.children.set(node.id, node);
                    this.saveQueue.add(node);
                    this.saveQueue.add(rootNode);
                }
            }
        }
        
        console.log(`✅ Completed loading ${this.nodes.size} nodes`);
    }
    
    /**
     * Process the save queue
     */
    async processSaveQueue() {
        if (this.saveQueue.size === 0) return;
        
        console.log(`💾 Processing save queue: ${this.saveQueue.size} nodes`);
        
        // Make a copy of the queue
        const nodesToSave = [...this.saveQueue];
        this.saveQueue.clear();
        
        // Save each node
        for (const node of nodesToSave) {
            try {
                // Convert to Gun format
                const data = this.toGun(node);
                
                // Save to Gun
                await new Promise((resolve, reject) => {
                    this.nodesRef.get(node.id).put(data, ack => {
                        if (ack.err) reject(new Error(ack.err));
                        else resolve();
                    });
                });
                
                console.log(`✅ Saved node: ${node.name}`);
            } catch (error) {
                console.error(`❌ Error saving node: ${node.name}`, error);
                // Add back to queue if there was an error
                this.saveQueue.add(node);
            }
        }
    }
    
    /**
     * Remove a node
     */
    async removeNode(node) {
        console.log(`🗑️ Removing node: ${node.name} (${node.id})`);
        
        try {
            // If this node has a parent, remove from parent's children
            if (node.parentId) {
                const parent = this.nodes.get(node.parentId);
                if (parent) {
                    delete parent.childrenIds[node.id];
                    parent.children.delete(node.id);
                    this.saveQueue.add(parent);
                }
            }
            
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
    
    /**
     * Resolve references between nodes
     */
    resolveReferences(node) {
        // Skip if not a valid node
        if (!node || !node.id) return;
        
        // Skip if we're already processing this node (prevent recursion)
        if (node._processingReferences) return;
        node._processingReferences = true;
        
        try {
            // Resolve parent reference if we have a parentId
            if (node.parentId && node.parentId !== '#') {
                const parent = this.nodes.get(node.parentId);
                if (parent) {
                    // Set parent reference
                    node._parent = parent;
                    
                    // Get typeIndex from root
                    if (node.root && node.root.typeIndex) {
                        node.typeIndex = node.root.typeIndex;
                    }
                    
                    // This is critical - add this node to its parent's childrenIds and children map
                    if (!parent.childrenIds[node.id]) {
                        console.log(`Adding ${node.name} to ${parent.name}'s children`);
                        parent.childrenIds[node.id] = true;
                        parent.children.set(node.id, node);
                        
                        // Mark parent for saving to persist the relationship
                        this.saveQueue.add(parent);
                    }
                }
            }
            
            // Filter childrenIds to remove Gun metadata
            const cleanChildrenIds = {};
            for (const childId in node.childrenIds) {
                // Skip Gun metadata
                if (childId === '_' || childId === '#' || childId.startsWith('_')) continue;
                if (typeof node.childrenIds[childId] === 'string' && 
                    node.childrenIds[childId].startsWith('~')) continue;
                
                cleanChildrenIds[childId] = true;
            }
            node.childrenIds = cleanChildrenIds;
            
            // Update children Map from childrenIds
            for (const childId in node.childrenIds) {
                const child = this.nodes.get(childId);
                if (child) {
                    node.children.set(childId, child);
                }
            }
        } finally {
            // Clean up processing flag
            delete node._processingReferences;
        }
    }

    /**
     * Debug function to print the node hierarchy
     */
    debugNodeHierarchy() {
        const printNode = (node, level = 0) => {
            const indent = '  '.repeat(level);
            console.log(`${indent}${node.name} (${node.id})`);
            console.log(`${indent}  childrenIds: ${Object.keys(node.childrenIds).length} - ${Object.keys(node.childrenIds).join(', ')}`);
            console.log(`${indent}  children: ${node.children.size}`);
            
            // Print children
            for (const child of node.children.values()) {
                printNode(child, level + 1);
            }
        };
        
        console.log('===== NODE HIERARCHY =====');
        printNode(this.root);
        console.log('========================');
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        // Clear save interval
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
        
        // Process any remaining saves
        this.processSaveQueue();
        
        // Clear references
        this.nodes.clear();
        this.saveQueue.clear();
        this.root = null;
        
        console.log(`🧹 Store destroyed`);
    }
}