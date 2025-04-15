import { gun, user } from './gun/gunSetup';
import { TreeNode } from './models/TreeNode';
import { createTreemap } from './components/TreeMap';
import { createPieChart } from './components/PieChart';
import { updateUserProfile, getUserName } from './utils/userUtils';
import { initializeExampleData } from './example';
import * as d3 from 'd3';
import { GunSubscription } from './gun/GunSubscription';
import { InventoryManager } from './models/InventoryManager';

// could we simply store

export class Coordinator {
    name: string = ''
    rootId: string = ''
    rootNode: TreeNode | null = null
    initializing: boolean = true
    treemap!: ReturnType<typeof createTreemap>
    _updateNeeded: boolean = true
    _pieUpdateNeeded: boolean = true
    _socialUpdateNeeded: boolean = true
    isGrowingActive: boolean = false;
    updateInterval: any = null
    saveInterval: any = null
    window!: Window
    gunRef: any = null
    resizeObserver: ResizeObserver | null = null
    private _resizeThrottleTimeout: any = null
    private _lastResizeTime: number = 0
    private _resizeCooldown: number = 100; // ms
    inventoryManager: InventoryManager | null = null
    
    // Social distribution depth setting
    private _socialDistributionDepth: number = 5;
    
    constructor() {
        console.log('[Coordinator] Constructor started');
        
        // More robust authentication check
        if (!user.is || !user.is.pub || !user.is.alias) {
            console.error('[Coordinator] User not properly authenticated!', user.is);
            throw new Error('Must be properly authenticated before initializing Coordinator');
        }
        
        this.name = user.is.alias as string || 'Unknown User';
        console.log('[Coordinator] User name:', this.name);
        this.rootId = user.is.pub as string;
        
        // Ensure we have valid data
        if (!this.rootId) {
            console.error('[Coordinator] Missing user public key!');
            throw new Error('User public key is missing or invalid');
        }
        
        this.gunRef = gun.get('nodes').get(this.rootId);
        console.log('[Coordinator] User information:', { name: this.name, rootId: this.rootId });
        // I dont understand how this.aname could possiblly equal user.is.pub?
        // [Coordinator] User information: {name: 'j8w6BjrMckSUa8P-TSkWk7yo5ZwQCUzq8BwHdtwRL28.7KOKIjirdBtFgAUyzRdvjgDe2_EppIzhYGqpPxqyfhU', rootId: 'j8w6BjrMckSUa8P-TSkWk7yo5ZwQCUzq8BwHdtwRL28.7KOKIjirdBtFgAUyzRdvjgDe2_EppIzhYGqpPxqyfhU'}        

        (window as any).coordinator = this;
        console.log('[Coordinator] Coordinator instance attached to window.coordinator');
    }

    get root() {
        return this.rootNode;
    }

    // New method to properly initialize coordinator
    async initialize() {
        console.log('[Coordinator] Starting initialization');

        try {
            // Phase 1: Critical path - load root node
            console.log('[Coordinator] Phase 1: Loading root node');
            await this._initPhase1_LoadRootNode();
            
            // Phase 2: Set up UI container and initial structure
            console.log('[Coordinator] Phase 2: Setting up UI container');
            await this._initPhase2_SetupUIContainer();
            
            // Phase 3: Set up data subscriptions and visualization
            console.log('[Coordinator] Phase 3: Setting up visualization');
            await this._initPhase3_SetupVisualization();
            
            this.initializing = false;
            console.log('[Coordinator] Initialization completed successfully');
        } catch (error) {
            console.error('[Coordinator] Initialization failed with error:', error);
            throw error;
        }
    }

    // Phase 1: Load the root node 
    private async _initPhase1_LoadRootNode() {
        // Try to load existing root node first - using user public key as the node ID
        console.log('[Coordinator] Attempting to load existing root node with ID:', this.rootId);
        
        // Get the node using the static getNode method
        const existingNode = TreeNode.getNode(this.rootId, this);
        
        // Try to wait for data to load
        this.rootNode = await Promise.race([
            new Promise<TreeNode>(resolve => {
                // Subscribe to check if the node exists
                existingNode.once()
                    .then(data => {
                        if (data && (data.name || data.id)) {
                            console.log('[Coordinator] Found existing node data:', data);
                            resolve(existingNode);
                        } else {
                            console.log('[Coordinator] Node exists but has insufficient data:', data);
                            resolve(null as any);
                        }
                    })
                    .catch(err => {
                        console.log('[Coordinator] Error checking node data:', err);
                        resolve(null as any);
                    });
            }),
            // Add a 5-second timeout
            new Promise<null>(resolve => setTimeout(() => {
                console.log('[Coordinator] Timeout waiting for root node, will create a new one');
                resolve(null);
            }, 5000))
        ]);

        // If root node doesn't exist, create it
        if (!this.rootNode) {
            console.log('[Coordinator] Root node not found, creating new root node with name:', this.name);
            
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
            
            console.log('[Coordinator] New root node created with ID:', this.rootNode.id);
        } else {
            console.log('[Coordinator] Existing root node loaded successfully:', {
                id: this.rootNode.id,
                name: this.rootNode.name,
                childrenCount: this.rootNode.children.size
            });
        }

        // Create a reference to this node in the users path and update our profile
        console.log('[Coordinator] Creating user reference in users path:', this.rootId);
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
        console.log('[Coordinator] Root node setup complete, initializing UI');
        const container = document.getElementById('treemap-container');
        
        if (!container) {
            console.error('[Coordinator] Treemap container element not found in DOM');
            throw new Error('Treemap container element not found');
        }
        
        const width = container.clientWidth;
        const height = container.clientHeight;
        console.log('[Coordinator] Container dimensions:', { width, height });
        
        // Set up resize observer for the container
        this.setupResizeHandling(container);
        
        console.log('[Coordinator] Root node ready:', this.rootNode.name, 'ID:', this.rootNode.id);
    }

    // Phase 3: Set up visualization
    private async _initPhase3_SetupVisualization() {
        // Wait for children to load from Gun subscriptions
        console.log('[Coordinator] Waiting for children to load from Gun...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check children path directly in Gun to verify data exists
        console.log('[Coordinator] Checking for children in Gun...');
        const childrenCheck = await Promise.race([
            new Promise<boolean>(resolve => {
                // Use GunSubscription instead of direct Gun query
                // This avoids the sync warning by using our optimized subscription pattern
                const childrenSub = new GunSubscription(['nodes', this.rootId, 'children']);
                
                // Use .map() with a limit to avoid processing too many children
                const mcoordinatoredSub = childrenSub.map(data => {
                    // Filter out Gun metadata
                    if (!data || typeof data !== 'object') return null;
                    
                    // Check if data exists and has properties other than '_'
                    const childKeys = Object.keys(data).filter(k => k !== '_');
                    return childKeys.length > 0;
                });
                
                // Just get the value once and then unsubscribe
                let cleanup: (() => void) | null = null;
                cleanup = mcoordinatoredSub.on(hasChildren => {
                    if (hasChildren === null) return; // Skip null results
                    
                    if (cleanup) cleanup(); // Unsubscribe immediately after we get a result
                    resolve(Boolean(hasChildren));
                });
            }),
            // Add a 3-second timeout
            new Promise<boolean>(resolve => setTimeout(() => {
                console.log('[Coordinator] Timeout checking for children, assuming none exist');
                resolve(false);
            }, 3000))
        ]);
        
        console.log('[Coordinator] Children check result:', { childrenCheck, localChildrenCount: this.rootNode.children.size });
        
        // Initialize example data if needed - wrap the root node in compatibility layer if needed
        if (!childrenCheck && this.rootNode.children.size === 0) {
            console.log('[Coordinator] No children found, initializing example data');
            // Adapt the TreeNode to the interface expected by initializeExampleData if needed
            const compatibleNode = this.createCompatibleNode(this.rootNode);
            await initializeExampleData(compatibleNode);
            console.log('[Coordinator] Example data initialization complete');
        } else {
            console.log('[Coordinator] Root node already has children, skipping example data');
        }
        
        // Add a delay to ensure all data is loaded before visualization
        console.log('[Coordinator] Waiting for data to stabilize before creating visualization');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('[Coordinator] Creating treemap visualization');
        // Create visualization with the loaded root - adapt if needed
        const compatibleNode = this.createCompatibleNode(this.rootNode);
        
        // Get the container element
        const container = document.getElementById('treemap-container');
        if (!container) {
            console.error('[Coordinator] Treemap container element not found for visualization');
            throw new Error('Treemap container element not found');
        }
        
        this.treemap = createTreemap(compatibleNode, container.clientWidth, container.clientHeight);
        if (!this.treemap?.element) {
            console.error('[Coordinator] Treemap element creation failed');
            throw new Error('Treemap element is null'); 
        }
        console.log('[Coordinator] Treemap created successfully');
        container.appendChild(this.treemap.element);
        console.log('[Coordinator] Treemap added to container');

        // Initialize Inventory Manager with proper error handling
        console.log('[Coordinator] Initializing Inventory Manager');
        try {
            this.inventoryManager = new InventoryManager(this.rootNode);
            
            // Wait for initialization with a timeout to prevent blocking
            const initPromise = this.inventoryManager.waitForInitialization();
            const timeoutPromise = new Promise<void>((_, reject) => {
                setTimeout(() => reject(new Error('Inventory Manager initialization timed out')), 5000);
            });
            
            // Race the initialization against a timeout
            await Promise.race([initPromise, timeoutPromise])
                .catch(err => {
                    console.warn(`[Coordinator] Inventory Manager initialization incomplete but continuing: ${err.message}`);
                    // Allow the app to continue even if inventory manager fails to initialize
                });
                
            console.log('[Coordinator] Inventory Manager initialized successfully');
        } catch (error) {
            console.error(`[Coordinator] Error initializing Inventory Manager: ${error.message}`);
            console.log('[Coordinator] Continuing without inventory management functionality');
        }
        
        // Set up a reactive update system that will respond to changes
        console.log('[Coordinator] Setting up reactive update system');
        
        // Trigger initial updates for all visualizations
        this._updateNeeded = true;
        this._pieUpdateNeeded = true;
        // Social chart has been removed, don't trigger updates
        this._socialUpdateNeeded = false;
        
        // Trigger an immediate visualization update
        this.updateVisualizations();
        
        // Add debounce variables to prevent frequent updates
        let treemapUpdateDebounceTimer: any = null;
        const DEBOUNCE_DELAY = 500; // ms
        
        this.updateInterval = setInterval(() => {
            // Skip updates during active growth operations
            if (this.isGrowingActive) {
                return;
            }
            
            if (this._updateNeeded) {
                console.log('[Coordinator] Update needed, debouncing treemap refresh');
                // Clear any existing timer to implement debouncing
                if (treemapUpdateDebounceTimer) {
                    clearTimeout(treemapUpdateDebounceTimer);
                }
                
                // Set a new timer to update after delay
                treemapUpdateDebounceTimer = setTimeout(() => {
                    console.log('[Coordinator] Executing debounced treemap update');
                    this.updateTreeMap();
                    this._updateNeeded = false;
                    treemapUpdateDebounceTimer = null;
                }, DEBOUNCE_DELAY);
            }
            
            if (this._pieUpdateNeeded) {
                console.log('[Coordinator] Pie chart update needed, refreshing');
                // Use an async IIFE to handle the async updatePieChart
                (async () => {
                    await this.updatePieChart();
                    this._pieUpdateNeeded = false;
                })().catch(err => {
                    console.error('[Coordinator] Error updating pie chart:', err);
                    this._pieUpdateNeeded = false; // Reset the flag even on error
                });
            }
            // Social chart has been removed, don't attempt to update it
            if (this._socialUpdateNeeded) {
                console.log('[Coordinator] Social chart update skipped - chart has been removed');
                this._socialUpdateNeeded = false;
            }
        }, 1000);
        console.log('[Coordinator] Update interval set up');
    }

    // Helper method to create a compatibility wrcoordinatorer for components expecting old TreeNode interface
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
                
                if (prop === 'coordinator') {
                    // Return a proxy for the coordinator instance that ensures rootId and other needed properties
                    // are always accessible, even through nested property access patterns
                    return new Proxy(this, {
                        get: (coordinatorTarget, coordinatorProp) => {
                            // Ensure rootId is available
                            if (coordinatorProp === 'rootId') {
                                return this.rootId;
                            }
                            return Reflect.get(coordinatorTarget, coordinatorProp);
                        }
                    });
                }
                
                if (prop === 'contributors') {
                    // Get the contributors set from the target
                    const contributorsSet = target.contributors;
                    
                    // Pre-trigger name resolution for all type IDs to populate the cache
                    if (contributorsSet instanceof Set) {
                        contributorsSet.forEach(contributorId => {
                            if (typeof contributorId === 'string') {
                                // This will subscribe to name updates
                                getUserName(contributorId);
                            }
                        });
                    }
                    
                    return contributorsSet;
                }
                
                // Special handling for (d.data as any).coordinator.rootId pattern used in the TreeMap component
                if (prop === 'rootId' && !('rootId' in target)) {
                    // Return rootId from coordinator if target doesn't have it directly
                    return this.rootId;
                }
                
                if (prop === 'hasChildren') {
                    // Check if node has children
                    return target.children.size > 0;
                }
                
                if (prop === 'contributorIndex') {
                    // Create a compatible type index
                    const contributorIndex: Record<string, boolean> = {};
                    target.contributors.forEach(contributorId => {
                        contributorIndex[contributorId] = true;
                    });
                    return contributorIndex;
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
                if (prop === 'addContributor' && typeof target.addContributor === 'function') {
                    return (contributorId: string) => {
                        const result = target.addContributor(contributorId);
                        this._updateNeeded = true; // Mark tree for update when contributors change
                        return this.createCompatibleNode(result);
                    };
                }
                
                if (prop === 'removeContributor' && typeof target.removeContributor === 'function') {
                    return (contributorId: string) => {
                        const result = target.removeContributor(contributorId);
                        this._updateNeeded = true; // Mark tree for update when contributors change
                        return this.createCompatibleNode(result);
                    };
                }
                
                if (prop === 'addChild' && typeof target.addChild === 'function') {
                    return async (name: string, points?: number, contributorIds?: string[], manualFulfillment?: number | null, id?: string) => {
                        const result = await target.addChild(name, points, contributorIds, manualFulfillment, id);
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
                
                // Automatically wrap returned TreeNode instances in compatibility wrcoordinatorer
                if (value instanceof TreeNode && prop !== 'parent') {
                    return this.createCompatibleNode(value);
                }
                
                // Handle functions that might expect different parameters or return TreeNode
                if (typeof value === 'function') {
                    return (...args: any[]) => {
                        try {
                            // Call the method on the target
                            const result = value.apply(target, args);
                            
                            // Wrap returned TreeNode in compatibility wrcoordinatorer
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
                                const wrcoordinatoredMap = new Map();
                                result.forEach((val, key) => {
                                    wrcoordinatoredMap.set(
                                        key, 
                                        val instanceof TreeNode ? 
                                        this.createCompatibleNode(val) : 
                                        val
                                    );
                                });
                                return wrcoordinatoredMap;
                            }
                            
                            if (result instanceof Set) {
                                const wrcoordinatoredSet = new Set();
                                result.forEach(val => {
                                    wrcoordinatoredSet.add(
                                        val instanceof TreeNode ? 
                                        this.createCompatibleNode(val) : 
                                        val
                                    );
                                });
                                return wrcoordinatoredSet;
                            }
                            
                            return result;
                        } catch (err) {
                            console.error(`Error in proxied method ${String(prop)}:`, err);
                            throw err;
                        }
                    };
                }
                
                // Handle specific collection contributors containing TreeNodes
                if (value instanceof Map) {
                    // Only wrap values if they are TreeNodes (like in the children map)
                    const wrcoordinatoredMap = new Map();
                    value.forEach((val, key) => {
                        wrcoordinatoredMap.set(
                            key, 
                            val instanceof TreeNode ? 
                            this.createCompatibleNode(val) : 
                            val
                        );
                    });
                    return wrcoordinatoredMap;
                }
                
                if (value instanceof Set && prop === 'contributors') {
                    // Already handled by explicit contributors property handling above
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

    get socialUpdateNeeded() {
        return this._socialUpdateNeeded;
    }

    set socialUpdateNeeded(value) {
        this._socialUpdateNeeded = value;
    }

    async updateVisualizations() {
        console.log('Coordinator.updateVisualizations called');
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
            // Social chart has been removed, skip update
            if (this.socialUpdateNeeded) {
                this.socialUpdateNeeded = false;
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
                         contributorsCount: this.rootNode.contributors.size, 
                         sharesOfOthersRecognition: this.rootNode.sharesOfOthersRecognition });
            
            // Create a compatible node wrcoordinatorer
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

    async updateSocialChart() {
        console.log('updateSocialChart started');
        // The social chart container has been removed, skip updating
        /*
        const socialContainer = document.getElementById('social-chart-container');
        if (!socialContainer || !this.rootNode) {
            console.error('Social chart container element not found or root node not available');
            return;
        }
        
        try {
            console.log(`Creating social chart with root node (depth: ${this._socialDistributionDepth}):`, 
                       { id: this.rootNode.id, 
                         name: this.rootNode.name, 
                         contributorsCount: this.rootNode.contributors.size });
            
            // Create a compatible node wrcoordinatorer
            const compatibleNode = this.createCompatibleNode(this.rootNode);
            
            // Remove existing event listener before recreating the chart
            socialContainer.removeEventListener(DEPTH_CHANGE_EVENT, this.handleSocialDepthChange);
            
            // Create the social chart with the current depth setting
            // The chart modifies the container directly, so we don't need to append anything
            createSocialChart(compatibleNode, this._socialDistributionDepth);
            
            // Set up depth change event listener after chart creation
            socialContainer.addEventListener(DEPTH_CHANGE_EVENT, this.handleSocialDepthChange.bind(this));
            
            console.log('Social chart successfully created');
        } catch (error) {
            console.error('Error creating social chart:', error);
            // Add a simple message to the container
            socialContainer.innerHTML = '<div style="text-align:center;padding:20px;">Error loading social chart: ' + 
                                    (error instanceof Error ? error.message : String(error)) + '</div>';
        }
        */
        this._socialUpdateNeeded = false;
    }
    
    /**
     * Handle depth change events from the social chart slider
     */
    private handleSocialDepthChange(event: Event): void {
        // The social chart container has been removed, this handler is no longer needed
        /*
        const customEvent = event as CustomEvent;
        if (customEvent.detail && typeof customEvent.detail.depth === 'number') {
            const newDepth = customEvent.detail.depth;
            console.log(`Social distribution depth changed to: ${newDepth}`);
            
            // Update the depth setting
            this._socialDistributionDepth = newDepth;
            
            // Trigger chart update
            this._socialUpdateNeeded = true;
            this.updateVisualizations();
        }
        */
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
            const contributorTagsContainer = d3.select('#treemap-container .contributor-tags-container');
            if (!contributorTagsContainer.empty()) {
                contributorTagsContainer.attr("transform", `translate(${width / 2}, 49.4)`);
            }
            
            console.log('[Coordinator] Header elements positions updated');
        } catch (error) {
            console.error('[Coordinator] Error updating header elements:', error);
        }
    }

    // New method to set up resize handling with throttling
    private setupResizeHandling(container: HTMLElement) {
        console.log('[Coordinator] Setting up resize handling');
        
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
                
                console.log('[Coordinator] Container resize detected');
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
        
        console.log('[Coordinator] Resize handling setup complete');
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