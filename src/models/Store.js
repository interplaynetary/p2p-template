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
            _manualFulfillment: null,
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

export class Store {
    constructor(root) {
        this.root = root
        this.saveQueue = new Set();
        // Get references to our Gun paths
        this.nodesRef = GunX.user.get('nodes');
        this.typesRef = GunX.user.get('types');
        
        // Local cache for quick lookups
        this.nodes = new Map();
        this.pendingRelations = [];
        this._loadingComplete = false;
        
        // Start syncing
        this.sync();

        // Start save queue processing
        this.saveInterval = setInterval(() => {
            if (this.saveQueue.size > 0) {
                this.processSaveQueue();
            }
        }, 100); // Process queue every 100ms
    }

    get isFullyLoaded() {
        return this._loadingComplete && this.saveQueue.size === 0;
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
                data: n.toGun()
            })));

            await Promise.all(nodesToSave.map(async (node) => {
                const data = node.toGun();
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

    async sync() {
        // Prevent multiple syncs
        if (this._syncing) {
            console.log('Sync already in progress...');
            return this._currentSync;
        }

        console.log('Starting store sync...');
        this._syncing = true;
        
        try {
            // Create a promise that resolves when initial load is complete
            this._currentSync = new Promise((resolve) => {
                this._loadCompleteCallback = resolve;
            });

            // Subscribe to real-time updates only once
            if (!this._subscribed) {
        this.nodesRef.on((data, key) => {
            if (!data) return;
            
            // Update local cache
            const node = Node.fromGun(data, this);
            this.nodes.set(key, node);
            
            // Set root if this is the user's root node
            if (key === GunX.user.is.pub) {
                        this.root = node;
                    }
                });
                this._subscribed = true;
            }

            
            // Initial load
            await this.loadNodes();

            // Wait for load to complete
            console.log('Waiting for load to complete...');
            await this._currentSync;
            
            const nodeCount = this.nodes.size;
            const childCount = this.root ? this.root.children.size : 0;
            
            return nodeCount;
        } finally {
            this._syncing = false;
        }
    }

    async loadNodes(parentNode = null) {
        return new Promise((resolve) => {
            console.log('Loading nodes from Gun...');
            let pendingLoads = 0;

            const markLoadComplete = () => {
                pendingLoads--;
                if (pendingLoads === 0) {
                    console.log('All nodes finished loading');
                    
                    // Resolve types before marking loading as complete
                    // this.resolveTypes();
                    
                    this._loadingComplete = true;
                    if (this._loadCompleteCallback) this._loadCompleteCallback();
                    resolve();
                }
            };

            const node = parentNode ? parentNode : this.root;
            const nodeId = parentNode ? parentNode.id : GunX.user.is.pub;
            
            this.nodesRef.get(nodeId).once((nodeData) => {
                if (!parentNode) {
                    if (!nodeData || !nodeData.name) {
                        console.warn('No root node found');
                        this._loadingComplete = true;
                        if (this._loadCompleteCallback) this._loadCompleteCallback();
                        resolve();
                        return;
                    }
                    this.nodes.set(nodeId, this.root);
                }

                this.nodesRef.get(nodeId).get('childrenIds').once((childrenIds) => {
                    if (!childrenIds || typeof childrenIds !== 'object') {
                        markLoadComplete();
                        return;
                    }

                    const childIds = Object.keys(childrenIds)
                        .filter(id => id !== '_');
                    
                    if (childIds.length === 0) {
                        markLoadComplete();
                        return;
                    }

                    console.log(`Found ${childIds.length} children to load`);
                    pendingLoads += childIds.length;
                    
                    childIds.forEach(childId => {
                        this.nodesRef.get(childId).once((childData) => {
                            if (!childData || !childData.name) {
                                console.warn('Invalid child node:', childId);
                                markLoadComplete();
                                return;
                            }
                            
                            if (!this.nodes.has(childId)) {
                                console.log('Loading child node:', childId, childData);
                                
                                try {
                                    const childNode = node.addChild(
                                        childData.name,
                                        childData.points || 0,
                                        [], // types will be added later
                                        childId,
                                        childData.childrenIds,
                                        childData._manualFulfillment
                                    );
                                    
                                    console.log('Loaded child node:', childNode);
                                    this.loadNodes(childNode);
                                } catch (error) {
                                    console.error(`Error adding child ${childId}:`, error);
                                }
                            }
                            markLoadComplete();
                        });
                    });
                });
            });
        });
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

    // Clean up interval on destroy
    destroy() {
        clearInterval(this.saveInterval);
    }

    /*
    // New method to resolve type relationships from pendingRelations
    resolveTypes() {
        console.log('Resolving types for', this.pendingRelations.length, 'nodes');
        
        if (this.pendingRelations.length === 0) {
            console.log('No pending relations to resolve');
            return;
        }
        
        // Track nodes with missing types to aid debugging
        const missingTypes = [];
        
        // Process all pending relations to establish type relationships
        this.pendingRelations.forEach(relation => {
            const { node, typeIds } = relation;
            
            if (!typeIds || typeIds.length === 0) {
                return; // Skip if no type IDs
            }
            
            console.log(`Resolving ${typeIds.length} types for node ${node.name}`);
            
            // Process each type ID
            typeIds.forEach(typeId => {
                // Find the type node reference in our loaded nodes
                const typeNode = this.nodes.get(typeId);
                
                if (typeNode) {
                    console.log(`Adding type ${typeNode.name} to ${node.name}`);
                    // Add the type to the node
                    node.addType(typeNode);
                } else {
                    // Keep track of missing types for debugging
                    missingTypes.push({ nodeId: node.id, nodeName: node.name, typeId });
                    console.warn(`Type node with ID ${typeId} not found for ${node.name}`);
                }
            });
        });
        
        if (missingTypes.length > 0) {
            console.warn('Missing type nodes:', missingTypes);
        } else {
            console.log('All types resolved successfully');
        }
        
        // Clear pending relations after processing
        this.pendingRelations = [];
    }
    */
}