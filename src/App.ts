import { gun, user } from './models/Gun';
import { TreeNode } from './models/TreeNode';
import { createTreemap } from './components/TreeMap';
import { createPieChart } from './components/PieChart';
import { initializeExampleData } from './example';
import $ from 'jquery';

// TODO:
// We currently arent using handleResize, but we should probably use it?

// This seems unneeded:
// gun.get('users').get(this.rootId).get('name').put(this.name); // Keep name updated

export class App {
    name: string = ''
    rootId: string = ''
    rootNode: TreeNode | null = null
    initializing: boolean = true
    treemap!: ReturnType<typeof createTreemap>
    _updateNeeded: boolean = true
    _pieUpdateNeeded: boolean = true
    isGrowingActive: boolean = false;
    updateInterval: any = null
    saveInterval: any = null
    window!: Window
    gunRef: any = null
    // Map to store peer trees indexed by their public key
    peerTrees: Map<string, TreeNode> = new Map();

    
    constructor() {
        console.log('[App] Constructor started');
        
        // More robust authentication check
        if (!user.is || !user.is.pub || !user.is.alias) {
            console.error('[App] User not properly authenticated!', user.is);
            throw new Error('Must be properly authenticated before initializing App');
        }
        
        this.name = user.is.alias as string || 'Unknown User';
        this.rootId = user.is.pub as string;
        
        // Ensure we have valid data
        if (!this.rootId) {
            console.error('[App] Missing user public key!');
            throw new Error('User public key is missing or invalid');
        }
        
        this.gunRef = gun.get('nodes').get(this.rootId);
        console.log('[App] User information:', { name: this.name, rootId: this.rootId });

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
            // Try to load existing root node first - using user public key as the node ID
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
                this.rootNode = TreeNode.create(this.name, {
                    id: this.rootId,
                    parent: null
                });
                console.log('[App] New root node created with ID:', this.rootNode.id);
                
                // Ensure the name is persisted by explicitly setting it
                this.rootNode.saveToGun();
            } else {
                console.log('[App] Existing root node loaded successfully:', {
                    id: this.rootNode.id,
                    name: this.rootNode.name,
                    childrenCount: this.rootNode.children.size
                });
                
                // If the root node name is empty/Unnamed but we have a user name, update it
                if ((this.rootNode.name === '' || this.rootNode.name === 'Unnamed') && this.name) {
                    console.log('[App] Updating root node name to match user name:', this.name);
                    this.rootNode.name = this.name;
                }
            }

            // Create a reference to this node in the users path
            console.log('[App] Creating user reference in users path:', this.rootId);
            // Always ensure the user's name is saved correctly in the users path
            gun.get('users').get(this.rootId).put({
                node: this.gunRef,  // Reference to the actual node
                lastSeen: Date.now()
            });

            // Setup a regular ping to keep user data fresh
            this.saveInterval = setInterval(() => {
                const timestamp = Date.now();
                // Update lastSeen in both paths
                this.gunRef.get('lastSeen').put(timestamp);
                gun.get('users').get(this.rootId).get('lastSeen').put(timestamp);
                // Always keep name up to date in users path
            }, 60000); // Update every minute

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
                    this.gunRef.get('children').once((data) => {
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
                // Skip updates during active growth operations
                if (this.isGrowingActive) {
                    return;
                }
                
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

    handleResize() {
        console.log('Resize handler triggered');
        const container = document.getElementById('treemap-container');
        if (!container) {
            console.error('Container not found');
            return;
        }
        const width = container.clientWidth;
        const height = container.clientHeight;
        console.log('Container resized to:', { width, height });
        
        if (this.treemap) {
            this.treemap.update(width, height);
            console.log('Treemap resized');
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


    async updateVisualizations() {
        console.log('App.updateVisualizations called');
        if (!this.treemap) {
            console.log('Treemap not initialized yet');
            return;
        }
        
        // Skip updates during active growth operations
        if (this.isGrowingActive) {
            console.log('Skipping visualization updates during active growth operation');
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
        
        // Skip complete rebuild during active growth operations
        if (this.isGrowingActive) {
            console.log('Skipping treemap rebuild during active growth operation');
            return;
        }
        
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
            // Directly try to load the peer's root node using their public key
            console.log(`[App] Loading peer root node directly with ID: ${peerPublicKey}`);
            
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
    
    // Add a method to App class
    listConnectedPeers() {
        return Array.from(this.peerTrees.keys()).map(key => ({
          id: key,
          name: this.peerTrees.get(key)?.name || 'Unknown'
        }));
    }

    // Add a method to discover other users
    async discoverUsers(): Promise<{id: string, name: string, lastSeen: number}[]> {
        console.log('[App] Discovering other users');
        return new Promise((resolve) => {
            const users: {id: string, name: string, lastSeen: number}[] = [];
            const seenIds = new Set<string>();
            
            // Use on() instead of once() to get live updates
            gun.get('users').map().on(async (data, key) => {
                console.log('[App] Found user:', data);
                if (data && key !== this.rootId && !seenIds.has(key)) {
                    console.log(`[App] Found user: ${data.name} (${key})`);
                    seenIds.add(key);
                    users.push({
                        id: key,
                        name: (await TreeNode.fromId(key)).name || 'Unknown',
                        lastSeen: data.lastSeen || 0
                    });
                    
                    // Update the UI when we find new users
                    if (document.getElementById('user-list')) {
                        const userListHtml = users.map(user => {
                            const lastSeenDate = user.lastSeen ? new Date(user.lastSeen).toLocaleString() : 'Unknown';
                            return `
                                <li>
                                    <div>${user.name}</div>
                                    <div>Last seen: ${lastSeenDate}</div>
                                    <button class="connect-to-user" data-id="${user.id}">Connect</button>
                                </li>
                            `;
                        }).join('');
                        
                        $('#user-list').html(userListHtml);
                        
                        // Re-add click handlers
                        $('.connect-to-user').off('click').on('click', async function() {
                            const userId = $(this).data('id');
                            const success = await (window as any).app.connectToPeer(userId);
                            
                            if (success) {
                                alert(`Connected to ${$(this).parent().find('div').first().text()}`);
                                $('.node-popup').removeClass('active');
                            } else {
                                alert('Failed to connect to user');
                            }
                        });
                    }
                }
            });
            
            // Return initial results after a timeout
            setTimeout(() => {
                console.log(`[App] Discovered ${users.length} users so far`);
                resolve(users);
            }, 1000);
        });
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
        
        // Clean up treemap if it exists
        if (this.treemap && typeof this.treemap.destroy === 'function') {
            this.treemap.destroy();
        }
    }
}