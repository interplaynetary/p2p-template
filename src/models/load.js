
async load(parentNode = null) {
    return new Promise((resolve) => {
        console.log('Loading nodes from Gun...');
        
        // If no parent node specified, use root
        const nodeId = parentNode ? parentNode.id : GunX.user.is.pub;
        console.log('Loading node:', nodeId);
        
        this.nodesRef.get(nodeId).once((nodeData) => {
            console.log('Node data:', nodeData);
            
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
                // Update root node properties from Gun data
                this.root.points = nodeData.points || 0;
                if (nodeData._manualFulfillment !== undefined) {
                    this.root._manualFulfillment = nodeData._manualFulfillment;
                }
            } else {
                if (!nodeData) {
                    console.warn(`No data found for node ${nodeId}`);
                    resolve();
                    return;
                }
                
                // Create child node directly with parent
                const node = new Node(
                    nodeData.name,
                    parentNode,
                    [], // types will be added later
                    nodeId,
                    nodeData.childrenIds || {},
                    nodeData._manualFulfillment
                );
                node.points = nodeData.points || 0;
                node.isContributor = nodeData.isContributor || false;
                
                // Add to parent's children and store cache
                parentNode.addChild(node.name, node.points, [], node.id, node.childrenIds, node._manualFulfillment);
                this.nodes.set(nodeId, node);
            }

            // Load children if any exist
            this.nodesRef.get(nodeId).get('childrenIds').once((childrenIds) => {
                if (childrenIds && typeof childrenIds === 'object') {
                    const childIds = Object.keys(childrenIds)
                        .filter(id => id !== '_');
                    
                    // Load each child
                    for (const childId of childIds) {
                        this.load(node);
                    }
                }
            });

            // Handle types if needed
            this.nodesRef.get(nodeId).get('typeIds').once((typeIds) => {
                if (typeIds && typeof typeIds === 'object') {
                    const typeIdArray = Object.keys(typeIds)
                        .filter(id => id !== '_');
                    
                    for (const typeId of typeIdArray) {
                        this.typesRef.get(typeId).once(typeData => {
                            if (typeData) node.addType(typeData);
                        });
                    }
                }
            });

            resolve();
        });
    });
}
