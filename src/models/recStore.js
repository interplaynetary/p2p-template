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
            _manualFulfillment: null
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
        
        // Start syncing
        this.sync();

        // Start save queue processing
        this.saveInterval = setInterval(() => {
            if (this.saveQueue.size > 0) {
                this.processSaveQueue();
            }
        }, 100); // Process queue every 100ms
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
            console.log(`Store sync complete with ${nodeCount} nodes loaded (${childCount} children)`);
            
            return nodeCount;
        } finally {
            this._syncing = false;
        }
    }

    async loadNodes(parentNode = null) {
        return new Promise((resolve) => {
            console.log('Loading nodes from Gun...');

            const node = parentNode ? parentNode : this.root;
                
            // If no parent node specified, use root
            const nodeId = parentNode ? parentNode.id : GunX.user.is.pub;
            
            this.nodesRef.get(nodeId).once((nodeData) => {
                // For root node only
                if (!parentNode) {
                    if (!nodeData || !nodeData.name) {
                        console.warn('No root node found');
                        if (this._loadCompleteCallback) this._loadCompleteCallback();
                        resolve();
                        return;
                    }
                    // Use the App instance as root node
                    this.nodes.set(nodeId, this.root);
                    /*
                    // Update root node properties from Gun data
                    this.root.points = nodeData.points || 0;
                    if (nodeData._manualFulfillment !== undefined) {
                        this.root._manualFulfillment = nodeData._manualFulfillment;
                    }
                        */
                }

                // Track loaded nodes to prevent duplicates
                const loadedNodes = new Set([nodeId]);
                let loadingComplete = false;

                // Load children IDs with rate limiting
                this.nodesRef.get(nodeId).get('childrenIds').once((childrenIds) => {
                    if (!childrenIds || typeof childrenIds !== 'object' || loadingComplete) {
                        if (this._loadCompleteCallback) this._loadCompleteCallback();
                        resolve();
                        return;
                    }

                    const childIds = Object.keys(childrenIds)
                        .filter(id => id !== '_' && !loadedNodes.has(id));
                    
                    if (childIds.length === 0) {
                        loadingComplete = true;
                        if (this._loadCompleteCallback) this._loadCompleteCallback();
                        resolve();
                        return;
                    }

                    console.log(`Found ${childIds.length} children to load`);
                    
                    const batchSize = 3;
                    let currentBatch = 0;
                    let loadedCount = 0;
                    
                    const loadBatch = () => {
                        if (loadingComplete) return;

                        const start = currentBatch * batchSize;
                        const end = start + batchSize;
                        const batch = childIds.slice(start, end);
                        
                        if (batch.length === 0) {
                            console.log('Finished loading all children');
                            loadingComplete = true;
                            if (this._loadCompleteCallback) this._loadCompleteCallback();
                            resolve();
                            return;
                        }
                        
                        console.log(`Loading batch ${currentBatch + 1}, nodes ${start + 1}-${end}`);
                        
                        let batchPromises = batch.map(childId => {
                            return new Promise(resolveChild => {
                                if (loadedNodes.has(childId)) {
                                    resolveChild();
                                    return;
                                }
                                
                                loadedNodes.add(childId);
                                
                                this.nodesRef.get(childId).once((childData) => {
                                    if (!childData || !childData.name) {
                                        console.warn('Invalid child node:', childId);
                                        loadedNodes.delete(childId);
                                        resolveChild();
                                        return;
                                    }
                                    
                                    if (!this.nodes.has(childId)) {
                                        console.log('Loading child node:', childId, childData);
                                        
                                        // Find parent node

                                        if (!node) {
                                            console.warn(`Parent node ${node} not found for child ${childId}`);
                                            resolveChild();
                                            return;
                                        }

                                        try {
                                            // Add child using parent's addChild method
                                            const childNode = node.addChild(
                                                childData.name,
                                                childData.points || 0,
                                                [], // types will be added later
                                                childId,
                                                childData.childrenIds,
                                                childData._manualFulfillment
                                            );
                                            
                                            console.log('Loaded child node:', childNode);

                                            // Recursively load this child's children
                                            this.loadNodes(childNode);
                                            
                                            loadedCount++;
                                        } catch (error) {
                                            console.error(`Error adding child ${childId}:`, error);
                                            loadedNodes.delete(childId);
                                        }
                                    }
                                    resolveChild();
                                });
            });
        });
                        
                        Promise.all(batchPromises).then(() => {
                            currentBatch++;
                            if (!loadingComplete) {
                                setTimeout(loadBatch, 100);
                            }
                        });
                    };
                    
                    loadBatch();
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
}