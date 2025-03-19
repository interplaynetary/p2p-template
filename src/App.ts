import * as GunX from './models/Gun';
import { TreeNode } from './models/TreeNode';
import { createTreemap } from './visualizations/TreeMap';
import { createPieChart } from './visualizations/PieChart';
import { initializeExampleData } from './example';
import { readFromGunPath, writeToGunPath } from './models/FuncGun';

/*
Simulating throttle in network can be used to discover race conditions!
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
*/

export class App {
    initializing: boolean = true
    _updateNeeded: boolean = true
    _pieUpdateNeeded: boolean = true
    updateInterval: any = null
    saveInterval: any = null
    treemap!: ReturnType<typeof createTreemap>
    window!: Window
    rootNode: TreeNode | null = null
    rootId: string = ''
    name: string = ''
    peerTrees: Map<string, TreeNode> = new Map();
    
    constructor() {
        console.log('[App] Constructor started');
        if (!GunX.user.is) {
            console.error('[App] User not logged in!');
            throw new Error('Must be logged in before initializing App');
        }
        this.rootId = GunX.user.is.pub as string
        this.name = GunX.user.is.alias as string
        console.log('[App] User information:', { rootId: this.rootId, name: this.name });

        (window as any).app = this;
        console.log('[App] App instance attached to window.app');
    }

    get root() {
        return this.rootNode;
    }

    // New method to properly initialize app
    async initialize() {
        console.log('[App] Starting initialization');

        try {
            // Check if user has a root node ID stored
            console.log('[App] Checking for stored root node ID in user data');
            const userRootData = await Promise.race([
                new Promise<any>(resolve => {
                    const userRootRef = readFromGunPath(['user', this.rootId, 'root']);
                    userRootRef.gunNodeRef.once((data, key) => {
                        console.log('[App] User root data:', data);
                        resolve(data);
                    });
                }),
                // Add a 3-second timeout
                new Promise<null>(resolve => setTimeout(() => {
                    console.log('[App] Timeout waiting for user root data, assuming none exists');
                    resolve(null);
                }, 3000))
            ]);
            
            if (userRootData && typeof userRootData === 'string') {
                console.log('[App] Found stored root node ID:', userRootData);
                this.rootId = userRootData;
            } else {
                console.log('[App] No stored root node ID found, using user ID:', this.rootId);
            }

            // Try to load existing root node first
            console.log('[App] Attempting to load existing root node from path:', ['nodes', this.rootId]);
            this.rootNode = await Promise.race([
                TreeNode.fromId(this.rootId),
                // Add a 5-second timeout
                new Promise<null>(resolve => setTimeout(() => {
                    console.log('[App] Timeout waiting for root node, will create a new one');
                    resolve(null);
                }, 5000))
            ]);

            // If root node doesn't exist, create it
            if (!this.rootNode) {
                console.log('[App] Root node not found, creating new root node with name:', this.name);
                this.rootNode = new TreeNode(this.name, this.rootId, null);
                console.log('[App] New root node created with ID:', this.rootNode.id);
                
                // Explicitly save the name to ensure it's stored properly
                console.log('[App] Explicitly saving name to Gun for root node');
                writeToGunPath(['nodes', this.rootId], { 
                    name: this.name,
                    points: 0,
                    manualFulfillment: null
                });
                
                // The new root node needs to be linked to the user's ID
                console.log('[App] Linking new root node to user');
                writeToGunPath(['user', this.rootId, 'root'], this.rootNode.id);
                console.log('[App] Root node linked to user');
            } else {
                console.log('[App] Existing root node loaded successfully:', {
                    id: this.rootNode.id,
                    name: this.rootNode.name,
                    childrenCount: this.rootNode.children.size
                });
                
                // Update the name if it's incorrect (e.g., showing as "Unnamed")
                if (this.rootNode.name === 'Unnamed' && this.name) {
                    console.log(`[App] Fixing missing name: updating from "${this.rootNode.name}" to "${this.name}"`);
                    this.rootNode.name = this.name;
                    writeToGunPath(['nodes', this.rootId], { name: this.name });
                }
            }

            console.log('[App] Root node setup complete, initializing UI');
            const container = document.getElementById('treemap-container');
            
            if (!container) {
                console.error('[App] Treemap container element not found in DOM');
                throw new Error('Treemap container element not found');
            }
            
            const width = container.clientWidth;
            const height = container.clientHeight;
            console.log('[App] Container dimensions:', { width, height });
            
            console.log('[App] Root node ready:', this.rootNode.name, 'ID:', this.rootNode.id);
            
            // Wait for children to load from Gun subscriptions
            console.log('[App] Waiting for children to load from Gun...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check children path directly in Gun to verify data exists
            console.log('[App] Checking for children in Gun...');
            const childrenCheck = await Promise.race([
                new Promise<boolean>(resolve => {
                    const childrenRef = readFromGunPath(['nodes', this.rootId, 'children']);
                    childrenRef.gunNodeRef.once((data) => {
                        console.log('[App] Children data in Gun:', data);
                        // Check if data exists and has properties other than '_'
                        const hasChildren = data && typeof data === 'object' && 
                                         Object.keys(data).filter(k => k !== '_').length > 0;
                        resolve(hasChildren);
                    });
                }),
                // Add a 3-second timeout
                new Promise<boolean>(resolve => setTimeout(() => {
                    console.log('[App] Timeout checking for children, assuming none exist');
                    resolve(false);
                }, 3000))
            ]);
            
            console.log('[App] Children check result:', { childrenCheck, localChildrenCount: this.rootNode.children.size });
            
            // Initialize example data if needed
            if (!childrenCheck && this.rootNode.children.size === 0) {
                console.log('[App] No children found, initializing example data');
                await initializeExampleData(this.rootNode);
                console.log('[App] Example data initialization complete');
            } else {
                console.log('[App] Root node already has children, skipping example data');
            }
            
            // Add a delay to ensure all data is loaded before visualization
            console.log('[App] Waiting for data to stabilize before creating visualization');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('[App] Creating treemap visualization');
            // Create visualization with the loaded root
            this.treemap = createTreemap(this.rootNode, width, height);
            if (!this.treemap?.element) {
                console.error('[App] Treemap element creation failed');
                throw new Error('Treemap element is null'); 
            }
            console.log('[App] Treemap created successfully');
            container.appendChild(this.treemap.element);
            console.log('[App] Treemap added to container');

            // Set up a reactive update system that will respond to changes
            console.log('[App] Setting up reactive update system');
            this.updateInterval = setInterval(() => {
                if (this._updateNeeded) {
                    console.log('[App] Update needed, refreshing treemap');
                    this.updateTreeMap();
                    this._updateNeeded = false;
                }
                if (this._pieUpdateNeeded) {
                    console.log('[App] Pie chart update needed, refreshing');
                    this.updatePieChart();
                    this._pieUpdateNeeded = false;
                }
            }, 1000);
            console.log('[App] Update interval set up');

            this.initializing = false;
            console.log('[App] Initialization completed successfully');
        } catch (error) {
            console.error('[App] Initialization failed with error:', error);
            throw error;
        }
    }

    get updateNeeded() {
        return this._updateNeeded;
    }

    set updateNeeded(value) {
        this._updateNeeded = value;
    }

    get pieUpdateNeeded() {
        return this._pieUpdateNeeded;
    }

    set pieUpdateNeeded(value) {
        this._pieUpdateNeeded = value;
    }

    get currentView() {
        console.log('currentView getter called, treemap exists:', !!this.treemap);
        if (!this.treemap) {
            console.warn('Treemap not initialized');
            return this;
        }
        const view = this.treemap.getCurrentView() || this;
        console.log('currentView returning:', view);
        return view;
    }

    get currentViewData() {
        return (this.currentView as any).data;
    }

    handleResize() {
        console.log('Resize handler triggered');
        const container = document.getElementById('treemap-container');
        if (!container) {
            console.warn('Treemap container not found');
            return;
        }
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.treemap.update(width, height);
    }

    async updateVisualizations() {
        console.log('App.updateVisualizations called');
        if (!this.treemap) {
            console.log('Treemap not initialized yet');
            return;
        }
        
        try {
            console.log('Starting visualization update');
            
            if (this.updateNeeded) {
                try {
                    this.updateTreeMap();
                } finally {
                    this.updateNeeded = false;
                }
            }
            if (this.pieUpdateNeeded) {
                this.updatePieChart();
                this.pieUpdateNeeded = false;
            }
            
        } finally {
            console.log('Visualization update completed');
        }
    }

    updateTreeMap() {
        console.log('updateTreeMap called');
        const container = document.getElementById('treemap-container');
        if (container && this.treemap && this.rootNode) {
            this.treemap.destroy();
            container.innerHTML = '';
            this.treemap = createTreemap(this.rootNode, container.clientWidth, container.clientHeight);
            if (this.treemap.element) {
                container.appendChild(this.treemap.element);
            }
        }
    }

    updatePieChart() {
        console.log('updatePieChart started');
        const pieContainer = document.getElementById('pie-container');
        if (!pieContainer || !this.rootNode) {
            console.error('Pie container element not found or root node not available');
            return;
        }
        
        if (this.treemap) {
            this.treemap.destroy();
        }

        pieContainer.innerHTML = '';
        
        const newPieChart = createPieChart(this.rootNode);
        if (!newPieChart) {
            console.error('Failed to create pie chart');
            return;
        }

        pieContainer.appendChild(newPieChart);
    }

    // Add a method to connect to another user's tree
    async connectToPeer(peerPublicKey: string): Promise<boolean> {
        console.log(`[App] Connecting to peer: ${peerPublicKey}`);
        
        // Skip if already connected
        if (this.peerTrees.has(peerPublicKey)) {
            console.log(`[App] Already connected to peer: ${peerPublicKey}`);
            return true;
        }
        
        try {
            // Load the peer's root node
            const peerRootNode = await Promise.race([
                TreeNode.fromId(peerPublicKey),
                new Promise<null>(resolve => setTimeout(() => {
                    console.log(`[App] Timeout waiting for peer ${peerPublicKey}`);
                    resolve(null);
                }, 5000))
            ]);
            
            if (!peerRootNode) {
                console.log(`[App] Failed to load peer tree: ${peerPublicKey}`);
                return false;
            }
            
            // Store the peer's tree
            this.peerTrees.set(peerPublicKey, peerRootNode);
            console.log(`[App] Successfully connected to peer: ${peerRootNode.name}`);
            console.log(`[App] Peer trees:`, this.peerTrees);
            // Update UI to reflect new connection
            this.updateNeeded = true;
            
            return true;
        } catch (error) {
            console.error(`[App] Error connecting to peer: ${error}`);
            return false;
        }
    }
    
    // Add a method to disconnect from a peer
    disconnectPeer(peerPublicKey: string): boolean {
        const peerTree = this.peerTrees.get(peerPublicKey);
        if (peerTree) {
            this.cleanupTreeSubscriptions(peerTree);
            this.peerTrees.delete(peerPublicKey);
            this.updateNeeded = true;
            return true;
        }
        return false;
    }

    // Cleanup
    destroy() {
        // Clean up subscriptions in our tree
        this.cleanupTreeSubscriptions(this.rootNode);
        
        // Add cleanup for peer trees
        for (const [_, peerTree] of this.peerTrees) {
            this.cleanupTreeSubscriptions(peerTree);
        }
        
        clearInterval(this.updateInterval);
        clearInterval(this.saveInterval);
    }
    
    // Recursively cleanup subscriptions throughout the tree
    cleanupTreeSubscriptions(node: TreeNode | null) {
        if (!node) return;
        
        // Unsubscribe this node
        node.unsubscribe();
        
        // Unsubscribe all children
        for (const child of Array.from(node.children.values())) {
            this.cleanupTreeSubscriptions(child);
        }
    }
}