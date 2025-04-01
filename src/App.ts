import { gun, user } from './models/Gun';
import { TreeNode } from './models/TreeNodeReactive';
import { createTreemap } from './components/TreeMap';
import { createPieChart } from './components/PieChart';
import { updateUserProfile } from './utils/userUtils';
import { initializeExampleData } from './example';
import $ from 'jquery';
import * as d3 from 'd3';

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
    resizeObserver: ResizeObserver | null = null;

    
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
            console.log('[App] Attempting to load existing root node with ID:', this.rootId);
            
            // Get the node using the static getNode method
            const existingNode = TreeNode.getNode(this.rootId, this);
            
            // Try to wait for data to load
            this.rootNode = await Promise.race([
                new Promise<TreeNode>(resolve => {
                    // Subscribe to check if the node exists
                    existingNode.once()
                        .then(data => {
                            if (data && (data.name || data.id)) {
                                console.log('[App] Found existing node data:', data);
                                resolve(existingNode);
                            } else {
                                console.log('[App] Node exists but has insufficient data:', data);
                                resolve(null as any);
                            }
                        })
                        .catch(err => {
                            console.log('[App] Error checking node data:', err);
                            resolve(null as any);
                        });
                }),
                // Add a 5-second timeout
                new Promise<null>(resolve => setTimeout(() => {
                    console.log('[App] Timeout waiting for root node, will create a new one');
                    resolve(null);
                }, 5000))
            ]);

            // If root node doesn't exist, create it
            if (!this.rootNode) {
                console.log('[App] Root node not found, creating new root node with name:', this.name);
                
                // Create a new node with our ID
                this.rootNode = TreeNode.getNode(this.rootId, this);
                
                // Set up its data
                const nodeData = {
                    id: this.rootId,
                    name: this.name,
                    points: 0,
                    manualFulfillment: null
                };
                
                // Save the data to Gun
                this.rootNode.put(nodeData);
                
                console.log('[App] New root node created with ID:', this.rootNode.id);
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

            // Create a reference to this node in the users path and update our profile
            console.log('[App] Creating user reference in users path:', this.rootId);
            // Using simpler updateUserProfile function
            updateUserProfile(this.rootId, this.name);
            
            // Also store the node reference separately
            gun.get('users').get(this.rootId).get('node').put(this.gunRef);
            
            // Setup a ping every minute to keep our lastSeen timestamp fresh
            this.saveInterval = setInterval(() => {
                updateUserProfile(this.rootId, this.name);
            }, 60000);

            console.log('[App] Root node setup complete, initializing UI');
            const container = document.getElementById('treemap-container');
            
            if (!container) {
                console.error('[App] Treemap container element not found in DOM');
                throw new Error('Treemap container element not found');
            }
            
            const width = container.clientWidth;
            const height = container.clientHeight;
            console.log('[App] Container dimensions:', { width, height });
            
            // Set up resize observer for the container
            this.setupResizeHandling(container);
            
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
            
            // Initialize example data if needed - wrap the root node in compatibility layer if needed
            if (!childrenCheck && this.rootNode.children.size === 0) {
                console.log('[App] No children found, initializing example data');
                // Adapt the TreeNode to the interface expected by initializeExampleData if needed
                const compatibleNode = this.createCompatibleNode(this.rootNode);
                await initializeExampleData(compatibleNode);
                console.log('[App] Example data initialization complete');
            } else {
                console.log('[App] Root node already has children, skipping example data');
            }
            
            // Add a delay to ensure all data is loaded before visualization
            console.log('[App] Waiting for data to stabilize before creating visualization');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('[App] Creating treemap visualization');
            // Create visualization with the loaded root - adapt if needed
            const compatibleNode = this.createCompatibleNode(this.rootNode);
            this.treemap = createTreemap(compatibleNode, width, height);
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
                    // Use an async IIFE to handle the async updatePieChart
                    (async () => {
                        await this.updatePieChart();
                        this._pieUpdateNeeded = false;
                    })().catch(err => {
                        console.error('[App] Error updating pie chart:', err);
                        this._pieUpdateNeeded = false; // Reset the flag even on error
                    });
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

    // Helper method to create a compatibility wrapper for components expecting old TreeNode interface
    private createCompatibleNode(node: TreeNode | null): any {
        if (!node) return null;
        
        // Return a proxy that adapts our new TreeNode to the interface expected by components
        return new Proxy(node, {
            get: (target, prop, receiver) => {
                // Special handling for specific properties that might have different names or behavior
                if (prop === 'childrenArray') {
                    // Convert children Map to array for old components
                    return Array.from(target.children.values());
                }
                
                if (prop === 'gunRef') {
                    // Provide a compatible gunRef for old components
                    return target.getChain();
                }
                
                if (prop === 'app') {
                    // Return the app instance
                    return this;
                }
                
                if (prop === 'hasChildren') {
                    // Check if node has children
                    return target.children.size > 0;
                }
                
                if (prop === 'typeIndex') {
                    // Create a compatible type index
                    const typeIndex: Record<string, boolean> = {};
                    target.types.forEach(typeId => {
                        typeIndex[typeId] = true;
                    });
                    return typeIndex;
                }
                
                // Get the property from the target
                const value = Reflect.get(target, prop, receiver);
                
                // Automatically wrap returned TreeNode instances in compatibility wrapper
                if (value instanceof TreeNode && prop !== 'parent') {
                    return this.createCompatibleNode(value);
                }
                
                // Handle functions that might expect different parameters
                if (typeof value === 'function') {
                    return (...args: any[]) => {
                        // Call the method on the target
                        const result = value.apply(target, args);
                        
                        // Wrap returned TreeNode in compatibility wrapper
                        if (result instanceof TreeNode) {
                            return this.createCompatibleNode(result);
                        }
                        
                        // Wrap returned Promise that resolves to TreeNode
                        if (result instanceof Promise) {
                            return result.then(res => {
                                if (res instanceof TreeNode) {
                                    return this.createCompatibleNode(res);
                                }
                                return res;
                            });
                        }
                        
                        return result;
                    };
                }
                
                return value;
            }
        });
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
                await this.updatePieChart();
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
            const compatibleNode = this.createCompatibleNode(this.rootNode);
            this.treemap = createTreemap(compatibleNode, container.clientWidth, container.clientHeight);
            if (this.treemap.element) {
                container.appendChild(this.treemap.element);
            }
        }
    }

    async updatePieChart() {
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
        
        try {
            const compatibleNode = this.createCompatibleNode(this.rootNode);
            const newPieChart = await createPieChart(compatibleNode);
            if (!newPieChart) {
                console.error('Failed to create pie chart');
                return;
            }

            pieContainer.appendChild(newPieChart);
        } catch (error) {
            console.error('Error creating pie chart:', error);
            // Add a simple message to the container
            pieContainer.innerHTML = '<div style="text-align:center;padding:20px;">Error loading pie chart</div>';
        }
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
            
            // Update header bar elements
            this.updateHeaderElements(width);
        }
    }

    // New method to update header elements positions
    private updateHeaderElements(width: number) {
        try {
            // Get the container height
            const container = document.getElementById('treemap-container');
            const height = container ? container.clientHeight : 0;
            
            // Select the SVG and update the viewBox
            const svg = d3.select('#treemap-container svg');
            if (!svg.empty()) {
                svg.attr("viewBox", [0.5, -50.5, width, height + 50]);
            }
            
            // Update the header rect width
            const headerRect = d3.select('#treemap-container rect[id^="leaf-"]');
            if (!headerRect.empty()) {
                headerRect.attr("width", width);
            }
            
            // Update the header text position
            const headerText = d3.select('#treemap-container text[font-weight="bold"]');
            if (!headerText.empty()) {
                headerText.attr("transform", `translate(${width / 2},25)`);
            }
            
            // Update the peer button position
            const peerButton = d3.select('#treemap-container .peer-button');
            if (!peerButton.empty()) {
                peerButton.attr("transform", `translate(${width - 60}, 25)`);
            }
            
            // Update the add button position
            const addButton = d3.select('#treemap-container .add-button');
            if (!addButton.empty()) {
                addButton.attr("transform", `translate(${width - 20}, 25)`);
            }
            
            // Update type tags container position if needed
            const typeTagsContainer = d3.select('#treemap-container .type-tags-container');
            if (!typeTagsContainer.empty()) {
                typeTagsContainer.attr("transform", `translate(${width / 2}, 49.4)`);
            }
            
            console.log('[App] Header elements positions updated');
        } catch (error) {
            console.error('[App] Error updating header elements:', error);
        }
    }

    
    // New method to set up resize handling
    private setupResizeHandling(container: HTMLElement) {
        console.log('[App] Setting up resize handling');
        
        // Clean up any existing observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        
        // Create a new ResizeObserver
        this.resizeObserver = new ResizeObserver((entries) => {
            // Use requestAnimationFrame to throttle resize events
            window.requestAnimationFrame(() => {
                if (!entries.length) return;
                
                console.log('[App] Container resize detected');
                this.handleResize();
            });
        });
        
        // Start observing the container
        this.resizeObserver.observe(container);
        
        // Also listen for window resize events as a fallback
        window.addEventListener('resize', () => this.handleResize());
        
        console.log('[App] Resize handling setup complete');
    }

    
    // Recursively cleanup subscriptions throughout the tree
    cleanupTreeSubscriptions(node: TreeNode | null) {
        if (!node) return;
        
        // Unsubscribe this node
        node.unsubscribe();
    }

    // Cleanup
    destroy() {
        // Clean up subscriptions in our tree
        this.cleanupTreeSubscriptions(this.rootNode);
        
        // Add cleanup for peer trees
        for (const [_, peerTree] of this.peerTrees) {
            this.cleanupTreeSubscriptions(peerTree);
        }
        
        // Clean up intervals
        clearInterval(this.updateInterval);
        clearInterval(this.saveInterval);
        
        // Clean up resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        
        // Remove window resize event listener
        window.removeEventListener('resize', () => this.handleResize());
        
        // Clean up treemap if it exists
        if (this.treemap && typeof this.treemap.destroy === 'function') {
            this.treemap.destroy();
        }
    }
}