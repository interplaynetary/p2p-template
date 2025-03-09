import * as GunX from './Gun';
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
        this.root = root
        this.saveQueue = new Set();
        this.nodesRef = GunX.user.get('nodes');
        this.typesRef = GunX.user.get('types');

        this.nodes = new Map();
        this.nodes.set(root.id, root);
        
        this.pendingRelations = [];
        this._processingPromises = new Map(); // Track promises by node ID

        // Start syncing
        this.sync();

        // Start save queue processing
        this.saveInterval = setInterval(() => {
            if (this.saveQueue.size > 0) {
                this.processSaveQueue();
            }
        }, 100);

        console.log('🏗️ Store constructor - Initial nodes:', this.nodes.size);
        this._loadPromises = []; // Add this to track promises globally
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

    async fromGun(data) {
        console.log(`🔍 Starting to load node:`, data.id, data.name);
        
        // Create node instance
        const node = new Node(data.name, null, [], data.id, {}, data.manualFulfillment);
        node.points = data.points || 0;
        node.isContributor = data.isContributor || false;
        
        // Add to nodes map immediately
        this.nodes.set(node.id, node);
        
        try {
            // Get relations
            const [typeIds, childrenIds] = await Promise.all([
                this.getNodeRelations(data.id, 'typeIds'),
                this.getNodeRelations(data.id, 'childrenIds')
            ]);
            
            // Queue relations for processing
            if (typeIds.length > 0 || childrenIds.length > 0) {
                this.pendingRelations.push({
                    node,
                    parentId: data.parentId,
                    typeIds,
                    childrenIds
                });
            }
            
            return node;
        } catch (error) {
            console.error(`❌ Error processing node ${data.name}:`, error);
            this.nodes.delete(node.id); // Remove failed node
            throw error;
        }
    }

    // Helper method to get relations
    async getNodeRelations(nodeId, relationType) {
        return new Promise(resolve => {
            let resolved = false;
            let collectedIds = new Set();
            
            // Increase timeout significantly
            const timeout = setTimeout(() => {
                if (!resolved) {
                    const ids = Array.from(collectedIds);
                    console.log(`⏰ Timeout resolving ${relationType} for ${nodeId}, using collected set:`, ids);
                    resolved = true;
                    resolve(ids);
                }
            }, 3000); // 3 seconds timeout

            // Use get + map instead of get + get + once
            this.nodesRef.get(nodeId).get(relationType).map().once((value, key) => {
                if (!resolved && key !== '_') {
                    collectedIds.add(key);
                    console.log(`📊 Got ${relationType} for ${nodeId}:`, [key]);
                }
            });

            // Add an earlier resolution if we get data
            setTimeout(() => {
                if (!resolved && collectedIds.size > 0) {
                    const ids = Array.from(collectedIds);
                    console.log(`✨ Early resolution of ${relationType} for ${nodeId} with:`, ids);
                    clearTimeout(timeout);
                    resolved = true;
                    resolve(ids);
                }
            }, 1000); // Check after 1 second if we have any data
        });
    }

    async loadNode(nodeId) {
        return new Promise(async (resolve) => {
            this.nodesRef.get(nodeId).once(async (nodeData) => {
                const loadedNode = await this.fromGun(nodeData);
                this.nodes.set(nodeId, loadedNode);
                resolve(loadedNode);
            });
        });
    }

    async processPendingRelations() {
        const total = this.pendingRelations.length;
        console.log(`🔄 Processing ${total} pending relations`);
        
        let processed = 0;
        for (const relation of this.pendingRelations) {
            const { node, parentId, typeIds, childrenIds } = relation;
            
            console.log(`📝 Processing relation ${++processed}/${total} for ${node.name}:`, {
                parentId,
                typeIds: typeIds.length,
                childrenIds: childrenIds.length
            });

            // Process parent
            if (parentId) {
                const parent = this.nodes.get(parentId);
                if (parent) {
                    node.parent = parent;
                    console.log(`👆 Set parent for ${node.name}: ${parent.name}`);
                }
            }

            // Process children
            if (childrenIds.length > 0) {
                console.log(`👶 Processing ${childrenIds.length} children for ${node.name}`);
                for (const childId of childrenIds) {
                    const child = this.nodes.get(childId);
                    if (child) {
                        node.addNodeChild(child);
                        console.log(`✅ Added child ${child.name} to ${node.name}`);
                    }
                }
            }

            // Process types
            if (typeIds.length > 0) {
                console.log(`🏷️ Processing ${typeIds.length} types for ${node.name}`);
                for (const typeId of typeIds) {
                    const type = this.nodes.get(typeId);
                    if (type) {
                        node.addType(type);
                        console.log(`✅ Added type ${type.name} to ${node.name}`);
                    }
                }
            }
        }
        
        console.log(`✨ Finished processing all relations`);
        this.pendingRelations = [];
    }

    async loadAll() {
        return new Promise((resolveAll) => {
            const seenNodes = new Set();
            let nodeCount = 0;
            
            console.log('🚀 Starting loadAll...');
            
            // Create a promise that will resolve when all nodes are loaded
            const loadingComplete = new Promise(resolve => {
                // Use map().once() instead of map()
                this.nodesRef.map().once(async (nodeData) => {
                    if (!nodeData || !nodeData.id) {
                        console.log('⚠️ Skipping invalid node data:', nodeData);
                        return;
                    }

                    if (seenNodes.has(nodeData.id)) {
                        console.log('🔄 Already seen node:', nodeData.id);
                        return;
                    }

                    seenNodes.add(nodeData.id);
                    nodeCount++;

                    const nodePromise = this.fromGun(nodeData).catch(err => {
                        console.error('❌ Error loading node:', nodeData.id, err);
                        return null;
                    });
                    this._processingPromises.set(nodeData.id, nodePromise);
                });

                // Increase timeout for node loading
                setTimeout(() => resolve(), 5000); // Give more time for nodes to load
            });

            loadingComplete.then(async () => {
                console.log(`⏳ Processing ${this._processingPromises.size} nodes...`);
                
                try {
                    const nodes = await Promise.all(Array.from(this._processingPromises.values()));
                    const validNodes = nodes.filter(n => n !== null);
                    
                    console.log(`✅ Successfully loaded ${validNodes.length} nodes out of ${nodeCount} total`);
                    console.log(`📊 Current nodes map size: ${this.nodes.size}`);
                    
                    // Add a delay before processing relations
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    if (this.pendingRelations.length > 0) {
                        console.log(`🔄 Processing ${this.pendingRelations.length} relations...`);
                        await this.processPendingRelations();
                    }
                    
                    resolveAll(validNodes.length);
                } catch (error) {
                    console.error('❌ Error during final load:', error);
                    resolveAll(0);
                } finally {
                    this._processingPromises.clear();
                }
            });
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