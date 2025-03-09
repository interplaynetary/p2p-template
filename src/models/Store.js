import * as GunX from './Gun.js';
import { Node } from './Node.js';

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
        this.root = root
        this.saveQueue = new Set();
        this.nodesRef = GunX.user.get('nodes');
        this.typesRef = GunX.user.get('types');

        this.nodes = new Map();
        this.nodes.set(root.id, root);
        
        this.pendingRelations = [];

        // Start syncing
        this.sync();

        // Start save queue processing
        this.saveInterval = setInterval(() => {
            if (this.saveQueue.size > 0) {
                this.processSaveQueue();
            }
        }, 100);
    }
    async sync() {
        // Prevent multiple syncs
        console.log('Starting store sync...');
        this._syncing = true;
        
        try {
            // Initial load
            await this.loadAll();
        } finally {
            this._syncing = false;
        }
    }

    // Persistence transformations
    toGun(node) {        
        const data = {
            id: node.id,
            name: node.name,
            parentId: node.parentId(),
            points: Number(node.points) || 0,
            isContributor: Boolean(node.isContributor),
            manualFulfillment: node.manualFulfillment === null ? 
                null : 
                Number(node.manualFulfillment),
            childrenIds: {},
            typeIds: {}
        };

        // Convert children to Gun format
        node.children.forEach(child => {
            if (child && child.id) {
                data.childrenIds[child.id] = true;
            }
        });

        // Convert types to Gun format
        node.types.forEach(type => {
            if (type && type.id) {
                data.typeIds[type.id] = true;
            }
        });

        // console.log('Converted data:', data); // Add logging
        return data;
    }

    fromGun(data) {
        const node = new Node(data.name, null, [], data.id, {}, data.manualFulfillment);
        node.points = data.points || 0;
        node.isContributor = data.isContributor || false;
        
        // Store ALL relationships for later resolution
        this.pendingRelations.push({
            node,
            parentId: data.parentId,
            typeIds: this.nodesRef.get(data.id).get('typeIds').once((typeIds) => {
                // Gun has already resolved the references internally at this point
                if(typeIds instanceof Object) {
                    const result = Object.keys(typeIds).filter(id => id !== '_');
                    console.log(data.name, 'typeIds:', result);
                    return result;
                } else {
                    return [];
                }
            }),
            childrenIds: this.nodesRef.get(data.id).get('childrenIds').once((childrenIds) => {
                // Gun has already resolved the references internally at this point
                if(childrenIds instanceof Object) {
                    const result = Object.keys(childrenIds).filter(id => id !== '_');
                    console.log(data.name, 'childrenIds:', result);
                    return result;
                } else {
                    return []
                }
            })
        });
        
        return node;
      }

      async loadNode(nodeId) {
        return new Promise(async (resolve) => {
            this.nodesRef.get(nodeId).once((nodeData) => {
                const loadedNode = this.fromGun(nodeData);
                this.nodes.set(nodeId, loadedNode);
                resolve(loadedNode);
            });
        });
    }

    async processPendingRelations() {
        console.log(`Processing ${this.pendingRelations.length} pending relations`);
        // we need to resolve the gun references for the childrenIds & typeIds
        for (const relation of this.pendingRelations) {
            const { node, parentId, typeIds, childrenIds } = relation;
            const parent = this.nodes.get(parentId);
            node.parent = parent;
            const children = childrenIds.map(id => this.nodes.get(id));
            if (children.length > 0) {
                for (const child of children) {
                    if (child) {
                        node.addNodeChild(child); 
                    }
                }
            }
            const types = typeIds.map(id => this.nodes.get(id));
            if (types.length > 0) {
                for (const type of types) {
                    if (type) {
                        node.addType(type);
                    }
                }
            }
            this.pendingRelations.shift();
        }
        this.pendingRelations = [];
    }


    async loadAll() {
        // Create a promise that resolves when all nodes are loaded
        return new Promise((resolveAll) => {            
            // Use Gun's map function to iterate over all nodes
            this.nodesRef.map().once((nodeData) => {
                if (!nodeData) return; // Skip if already loaded or null
                // Load the node into our local cache
                const loadedNode = this.fromGun(nodeData);
                this.nodes.set(nodeData.id, loadedNode);
                
                console.log(`Loaded node ${nodeData.id}: ${nodeData.name}`);
            });
            
            // We need to wait a bit after map().once() to ensure all callbacks have fired
            // Gun doesn't provide a built-in way to know when map is complete
            setTimeout(async () => {
                await this.processPendingRelations();
                resolveAll();
            }, 800); // Wait 800ms to ensure all nodes and types have loaded
        });
    }

    async processSaveQueue() {
        console.log('Processing save queue, size:', this.saveQueue.size);
        
        try {
            const nodesToSave = Array.from(this.saveQueue);
            this.saveQueue.clear();

            // Add more detailed logging
            console.log('About to save nodes:', nodesToSave.map(n => ({
                id: n.id,
                name: n.name,
                data: this.toGun(n)
            })));

            await Promise.all(nodesToSave.map(async (node) => {
                const data = this.toGun(node);
                // console.log('Saving node from queue:', node.name);
                
                return new Promise((resolve, reject) => {
                    // Use .put with a callback to ensure data is saved
                    this.nodesRef.get(node.id).put(data, ack => {
                        if (ack.err) {
                            console.error('Failed to save node:', node.name, ack.err);
                            reject(new Error(ack.err));
                        } else {
                            console.log('Successfully saved node:', node.name, 'with data:', data);
                            resolve();
                        }
                    });
                });
            }));
        } catch (error) {
            console.error('Error processing save queue:', error);
            // Re-add failed nodes
            nodesToSave.forEach(node => this.saveQueue.add(node));
        }
    }


    async removeNode(node) {
        // Remove from Gun
        await new Promise((resolve, reject) => {
            this.nodesRef.get(node.id).put(null, ack => {
                if (ack.err) reject(new Error(ack.err));
                resolve();
            });
        });
        
        // Remove from local cache
        this.nodes.delete(node.id);
    }

    destroy() {
        clearInterval(this.saveInterval);
    }
}