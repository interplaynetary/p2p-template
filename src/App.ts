import { gun, user } from './models/Gun';
import { TreeNode } from './models/TreeNode';
import { createTreemap } from './components/TreeMap';
import { createPieChart } from './components/PieChart';
import { updateUserProfile, getUserName } from './utils/userUtils';
import { initializeExampleData } from './example';
import * as d3 from 'd3';
import { GunSubscription } from './models/GunSubscription';

// could we simply store

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
    resizeObserver: ResizeObserver | null = null
    private _resizeThrottleTimeout: any = null
    private _lastResizeTime: number = 0
    private _resizeCooldown: number = 100; // ms
    
    constructor() {
        console.log('[App] Constructor started');
        
        // More robust authentication check
        if (!user.is || !user.is.pub || !user.is.alias) {
            console.error('[App] User not properly authenticated!', user.is);
            throw new Error('Must be properly authenticated before initializing App');
        }
        
        this.name = user.is.alias as string || 'Unknown User';
        console.log('[App] User name:', this.name);
        this.rootId = user.is.pub as string;
        
        // Ensure we have valid data
        if (!this.rootId) {
            console.error('[App] Missing user public key!');
            throw new Error('User public key is missing or invalid');
        }
        
        this.gunRef = gun.get('nodes').get(this.rootId);
        console.log('[App] User information:', { name: this.name, rootId: this.rootId });
        // I dont understand how this.aname could possiblly equal user.is.pub?
        // [App] User information: {name: 'j8w6BjrMckSUa8P-TSkWk7yo5ZwQCUzq8BwHdtwRL28.7KOKIjirdBtFgAUyzRdvjgDe2_EppIzhYGqpPxqyfhU', rootId: 'j8w6BjrMckSUa8P-TSkWk7yo5ZwQCUzq8BwHdtwRL28.7KOKIjirdBtFgAUyzRdvjgDe2_EppIzhYGqpPxqyfhU'}        

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
            // Phase 1: Critical path - load root node
            console.log('[App] Phase 1: Loading root node');
            await this._initPhase1_LoadRootNode();
            
            // Phase 2: Set up UI container and initial structure
            console.log('[App] Phase 2: Setting up UI container');
            await this._initPhase2_SetupUIContainer();
            
            // Phase 3: Set up data subscriptions and visualization
            console.log('[App] Phase 3: Setting up visualization');
            await this._initPhase3_SetupVisualization();
            
            this.initializing = false;
            console.log('[App] Initialization completed successfully');
        } catch (error) {
            console.error('[App] Initialization failed with error:', error);
            throw error;
        }
    }

    // Or how after initialize:
    // App initialized after session recall: App {name: 'j8w6BjrMckSUa8P-TSkWk7yo5ZwQCUzq8BwHdtwRL28.7KOKIjirdBtFgAUyzRdvjgDe2_EppIzhYGqpPxqyfhU', rootId: 'j8w6BjrMckSUa8P-TSkWk7yo5ZwQCUzq8BwHdtwRL28.7KOKIjirdBtFgAUyzRdvjgDe2_EppIzhYGqpPxqyfhU', rootNode: TreeNode, initializing: false, treemap: {…}, …}

    // Phase 1: Load the root node 
    private async _initPhase1_LoadRootNode() {
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
    }

    // Phase 2: Set up UI container
    private async _initPhase2_SetupUIContainer() {
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
    }

    // Phase 3: Set up visualization
    private async _initPhase3_SetupVisualization() {
        // Wait for children to load from Gun subscriptions
        console.log('[App] Waiting for children to load from Gun...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check children path directly in Gun to verify data exists
        console.log('[App] Checking for children in Gun...');
        const childrenCheck = await Promise.race([
            new Promise<boolean>(resolve => {
                // Use GunSubscription instead of direct Gun query
                // This avoids the sync warning by using our optimized subscription pattern
                const childrenSub = new GunSubscription(['nodes', this.rootId, 'children']);
                
                // Use .map() with a limit to avoid processing too many children
                const mappedSub = childrenSub.map(data => {
                    // Filter out Gun metadata
                    if (!data || typeof data !== 'object') return null;
                    
                    // Check if data exists and has properties other than '_'
                    const childKeys = Object.keys(data).filter(k => k !== '_');
                    return childKeys.length > 0;
                });
                
                // Just get the value once and then unsubscribe
                let cleanup: (() => void) | null = null;
                cleanup = mappedSub.on(hasChildren => {
                    if (hasChildren === null) return; // Skip null results
                    
                    if (cleanup) cleanup(); // Unsubscribe immediately after we get a result
                    resolve(Boolean(hasChildren));
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
        
        // Get the container element
        const container = document.getElementById('treemap-container');
        if (!container) {
            console.error('[App] Treemap container element not found for visualization');
            throw new Error('Treemap container element not found');
        }
        
        this.treemap = createTreemap(compatibleNode, container.clientWidth, container.clientHeight);
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
    }

    // Helper method to create a compatibility wrapper for components expecting old TreeNode interface
    private createCompatibleNode(node: TreeNode | null): any {
        if (!node) return null;
        
        // Return a proxy that adapts our new TreeNode to the interface expected by components
        return new Proxy(node, {
            get: (target, prop, receiver) => {
                // Special handling for specific properties that might have different names or behavior
                if (prop === 'name') {
                    return target.name;
                }

                if (prop === 'childrenArray') {
                    // Convert children Map to array for old components
                    return Array.from(target.children.values());
                }
                
                if (prop === 'app') {
                    // Return a proxy for the app instance that ensures rootId and other needed properties
                    // are always accessible, even through nested property access patterns
                    return new Proxy(this, {
                        get: (appTarget, appProp) => {
                            // Ensure rootId is available
                            if (appProp === 'rootId') {
                                return this.rootId;
                            }
                            return Reflect.get(appTarget, appProp);
                        }
                    });
                }
                
                if (prop === 'types') {
                    // Get the types set from the target
                    const typesSet = target.types;
                    
                    // Pre-trigger name resolution for all type IDs to populate the cache
                    if (typesSet instanceof Set) {
                        typesSet.forEach(typeId => {
                            if (typeof typeId === 'string') {
                                // This will subscribe to name updates
                                getUserName(typeId);
                            }
                        });
                    }
                    
                    return typesSet;
                }
                
                // Special handling for (d.data as any).app.rootId pattern used in the TreeMap component
                if (prop === 'rootId' && !('rootId' in target)) {
                    // Return rootId from app if target doesn't have it directly
                    return this.rootId;
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
                
                // D3 compatibility - value is used by d3.hierarchy.sum()
                if (prop === 'value') {
                    return target.points;
                }
                
                // Add more TreeMap specific compatibility properties
                if (prop === 'isContribution' && typeof target.isContribution === 'undefined') {
                    return false; // Default value if not present on the original node
                }
                
                if (prop === 'hasDirectContributionChild' && typeof target.hasDirectContributionChild === 'undefined') {
                    // If the property doesn't exist, derive it from children
                    const children = Array.from(target.children.values());
                    return children.some(child => child.isContribution === true);
                }
                
                // Handle specific methods that might need adaptations
                if (prop === 'addType' && typeof target.addType === 'function') {
                    return (typeId: string) => {
                        const result = target.addType(typeId);
                        this._updateNeeded = true; // Mark tree for update when types change
                        return this.createCompatibleNode(result);
                    };
                }
                
                if (prop === 'removeType' && typeof target.removeType === 'function') {
                    return (typeId: string) => {
                        const result = target.removeType(typeId);
                        this._updateNeeded = true; // Mark tree for update when types change
                        return this.createCompatibleNode(result);
                    };
                }
                
                if (prop === 'addChild' && typeof target.addChild === 'function') {
                    return async (name: string, points?: number, typeIds?: string[], manualFulfillment?: number | null, id?: string) => {
                        const result = await target.addChild(name, points, typeIds, manualFulfillment, id);
                        this._updateNeeded = true; // Mark tree for update
                        return this.createCompatibleNode(result);
                    };
                }
                
                if (prop === 'removeChild' && typeof target.removeChild === 'function') {
                    return (childId: string) => {
                        const result = target.removeChild(childId);
                        this._updateNeeded = true; // Mark tree for update
                        return this.createCompatibleNode(result);
                    };
                }
                
                // Get the property from the target
                const value = Reflect.get(target, prop, receiver);
                
                // Automatically wrap returned TreeNode instances in compatibility wrapper
                if (value instanceof TreeNode && prop !== 'parent') {
                    return this.createCompatibleNode(value);
                }
                
                // Handle functions that might expect different parameters or return TreeNode
                if (typeof value === 'function') {
                    return (...args: any[]) => {
                        try {
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
                            
                            // Handle arrays of TreeNodes
                            if (Array.isArray(result)) {
                                return result.map(item => 
                                    item instanceof TreeNode ? 
                                    this.createCompatibleNode(item) : 
                                    item
                                );
                            }
                            
                            // Handle Maps or Sets containing TreeNodes
                            if (result instanceof Map) {
                                const wrappedMap = new Map();
                                result.forEach((val, key) => {
                                    wrappedMap.set(
                                        key, 
                                        val instanceof TreeNode ? 
                                        this.createCompatibleNode(val) : 
                                        val
                                    );
                                });
                                return wrappedMap;
                            }
                            
                            if (result instanceof Set) {
                                const wrappedSet = new Set();
                                result.forEach(val => {
                                    wrappedSet.add(
                                        val instanceof TreeNode ? 
                                        this.createCompatibleNode(val) : 
                                        val
                                    );
                                });
                                return wrappedSet;
                            }
                            
                            return result;
                        } catch (err) {
                            console.error(`Error in proxied method ${String(prop)}:`, err);
                            throw err;
                        }
                    };
                }
                
                // Handle specific collection types containing TreeNodes
                if (value instanceof Map) {
                    // Only wrap values if they are TreeNodes (like in the children map)
                    const wrappedMap = new Map();
                    value.forEach((val, key) => {
                        wrappedMap.set(
                            key, 
                            val instanceof TreeNode ? 
                            this.createCompatibleNode(val) : 
                            val
                        );
                    });
                    return wrappedMap;
                }
                
                if (value instanceof Set && prop === 'types') {
                    // Already handled by explicit types property handling above
                    return value;
                }
                
                if (Array.isArray(value)) {
                    // Wrap array items that are TreeNodes
                    return value.map(item => 
                        item instanceof TreeNode ? 
                        this.createCompatibleNode(item) : 
                        item
                    );
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
        
        // Clear the container
        pieContainer.innerHTML = '';
        
        try {
            console.log('Creating pie chart with root node:', 
                       { id: this.rootNode.id, 
                         name: this.rootNode.name, 
                         typesCount: this.rootNode.types.size, 
                         sharesOfOthersRecognition: this.rootNode.sharesOfOthersRecognition });
            
            // Create a compatible node wrapper
            const compatibleNode = this.createCompatibleNode(this.rootNode);
            
            // Get the mutual fulfillment distribution directly to check it
            const distribution = this.rootNode.mutualFulfillmentDistribution;
            const distributionSize = distribution ? distribution.size : 0;
            
            console.log(`Pie chart distribution has ${distributionSize} entries:`, 
                       Array.from(distribution?.entries() || []));
            
            // Create the pie chart
            const newPieChart = await createPieChart(compatibleNode);
            if (!newPieChart) {
                console.error('Failed to create pie chart - returned null');
                // Add a simple message to the container
                pieContainer.innerHTML = '<div style="text-align:center;padding:20px;">Error: Pie chart could not be created</div>';
                return;
            }

            // Add to container
            pieContainer.appendChild(newPieChart);
            console.log('Pie chart successfully added to container');
        } catch (error) {
            console.error('Error creating pie chart:', error);
            // Add a simple message to the container
            pieContainer.innerHTML = '<div style="text-align:center;padding:20px;">Error loading pie chart: ' + 
                                    (error instanceof Error ? error.message : String(error)) + '</div>';
        }
    }

    handleResize() {
        // Skip this resize if we just handled one very recently
        const now = Date.now();
        if (now - this._lastResizeTime < this._resizeCooldown) {
            // If a throttle is already scheduled, don't do anything
            if (this._resizeThrottleTimeout) return;
            
            // Schedule a single delayed resize instead of processing all of them
            this._resizeThrottleTimeout = setTimeout(() => {
                this._lastResizeTime = Date.now();
                this._resizeThrottleTimeout = null;
                this._actualHandleResize();
            }, this._resizeCooldown);
            
            return;
        }
        
        // If we got here, it's been long enough since the last resize
        this._lastResizeTime = now;
        this._actualHandleResize();
    }

    // The actual resize handler logic
    private _actualHandleResize() {
        console.log('Actual resize handler triggered');
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

    // New method to set up resize handling with throttling
    private setupResizeHandling(container: HTMLElement) {
        console.log('[App] Setting up resize handling');
        
        // Clean up any existing observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        
        // Create a new ResizeObserver with built-in throttling
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
        
        // Also listen for window resize events as a fallback, but with throttling
        window.addEventListener('resize', () => {
            // Skip handling if we're in a pending throttle already
            if (this._resizeThrottleTimeout) return;
            
            this.handleResize();
        });
        
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