import * as GunX from '../Gun.js';
import { Node } from '../previous/Node.js';

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

        // Initial load
        await this.loadNodes();
        
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

    async loadChildrenForNode(parentNode, loadedNodes = new Set()) {
        if (!parentNode || !parentNode.id) {
            console.warn('Invalid parent node provided to loadChildrenForNode');
                        return;
                    }

        console.log(`Loading children for node: ${parentNode.name} (${parentNode.id})`);
        
        return new Promise(resolve => {
            this.nodesRef.get(parentNode.id).get('childrenIds').once((childrenIds) => {
                if (!childrenIds || typeof childrenIds !== 'object') {
                    console.log(`No children found for node: ${parentNode.name}`);
                            resolve();
                            return;
                        }

                        const childIds = Object.keys(childrenIds)
                            .filter(id => id !== '_' && !loadedNodes.has(id));
                        
                        if (childIds.length === 0) {
                    console.log(`No new children to load for node: ${parentNode.name}`);
                            resolve();
                            return;
                        }

                console.log(`Found ${childIds.length} children to load for ${parentNode.name}`);
                        
                        const batchSize = 3;
                        let currentBatch = 0;
                let pendingBatches = Math.ceil(childIds.length / batchSize);
                        
                        const loadBatch = () => {
                            const start = currentBatch * batchSize;
                    const end = Math.min(start + batchSize, childIds.length);
                            const batch = childIds.slice(start, end);
                            
                            if (batch.length === 0) {
                        console.log(`Finished loading all children for ${parentNode.name}`);
                                resolve();
                                return;
                            }
                            
                    console.log(`Loading batch ${currentBatch + 1} for ${parentNode.name}, nodes ${start + 1}-${end}`);
                            
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
                                        
                                try {
                                            console.log('Loading child node:', childId, childData);
                                            
                                                // Add child using parent's addChild method
                                                const childNode = parentNode.addChild(
                                                    childData.name,
                                                    childData.points || 0,
                                                    [], // types will be added later
                                                    childId,
                                        childData.childrenIds || {},
                                                    childData._manualFulfillment
                                                );

                                    console.log("parentNode with child added", parentNode)
                                                
                                                // Verify the child was added correctly
                                                if (!parentNode.children.has(childData.name)) {
                                                    console.warn(`Child ${childData.name} was not properly added to parent ${parentNode.name}`);
                                                }

                                    // Recursively load grandchildren if they exist
                                    if (childData.childrenIds && Object.keys(childData.childrenIds).filter(id => id !== '_').length > 0) {
                                        console.log(`Node ${childData.name} has grandchildren, loading recursively...`);
                                        this.loadChildrenForNode(childNode, loadedNodes)
                                            .then(() => resolveChild());
                                    } else {
                                        resolveChild();
                                    }
                                            } catch (error) {
                                                console.error(`Error adding child ${childId}:`, error);
                                                loadedNodes.delete(childId);
                                    resolveChild();
                                            }
                            });
                                    });
                });
                
                            Promise.all(batchPromises).then(() => {
                                currentBatch++;
                        pendingBatches--;
                        
                        if (currentBatch * batchSize < childIds.length) {
                            setTimeout(loadBatch, 100); // Rate limiting
                        } else {
                            console.log(`Completed loading all batches for ${parentNode.name}`);
                            resolve();
                                }
                            });
                        };
                        
                // Start loading the first batch
                        loadBatch();
                    });
                });
    }

    async loadNodes() {
        return new Promise((resolve) => {
            console.log('\n=== Starting node loading process ===');
            const rootId = this.root.id;
            console.log('1. Looking for root node:', rootId);
            console.log('nodesRef', this.nodesRef);
            
            this.nodesRef.get(rootId).once(async (rootData) => {
                console.log('2. Root node data received:', rootData);
                
                if (!rootData) {
                    console.warn('3. No valid root node found');
                    if (this._loadCompleteCallback) this._loadCompleteCallback();
                    // use the current App, do toGun() and save it!
                    await this.processSaveQueue();
                    resolve();
                    return;
                }
                
                console.log('3. Setting up root node...');
                
                // Use the App instance as root node
                this.nodes.set(rootId, this.root);
                
                // Update root node properties from Gun data
                this.root.points = rootData.points || 0;
                if (rootData._manualFulfillment !== undefined) {
                    this.root._manualFulfillment = rootData._manualFulfillment;
                }
                
                console.log('4. Root node setup complete:', this.root);
                
                // Track loaded nodes to prevent duplicates
                const loadedNodes = new Set([rootId]);
                
                console.log('5. Loading children IDs...');
                
                // Use the helper method to load children recursively
                await this.loadChildrenForNode(this.root, loadedNodes);
                
                console.log('6. Finished loading all nodes');
                console.log(`Total nodes loaded: ${loadedNodes.size}`);
                console.log(`Root children count: ${this.root.children.size}`);
                console.log(`Root children:`, Array.from(this.root.children.keys()));
                
                // Force update of visualizations
                this.root.updateNeeded = true;
                this.root.pieUpdateNeeded = true;
                
                // Add a small delay to ensure all relationships are established
                setTimeout(() => {
                    console.log('Triggering visualization update after all nodes loaded');
                    // Force a refresh of the visualization
                    if (typeof this.root.updateTreeMap === 'function') {
                        console.log('Calling updateTreeMap on root');
                        this.root.updateTreeMap();
                    } else {
                        console.warn('updateTreeMap not found on root');
                    }
                    
                    if (this._loadCompleteCallback) this._loadCompleteCallback();
                    resolve(loadedNodes.size);
                }, 100);
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

    getNode(id) {
        return this.nodes.get(id);
    }

    // Clean up interval on destroy
    destroy() {
        clearInterval(this.saveInterval);
    }
}