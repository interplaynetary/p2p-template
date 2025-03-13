import * as GunX from './models/Gun';
import { GunStore } from './models/Store';
import { TreeNode } from './models/TreeNode';
import { createTreemap } from './visualizations/TreeMap';
import { createPieChart } from './visualizations/PieChart';
import { initializeExampleData } from './example';

/*
Simulating throttle in network can be used to discover race conditions!
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
*/

export class App {
    initializing: boolean
    _updateNeeded: boolean
    _pieUpdateNeeded: boolean
    updateInterval: any = null
    saveInterval: any = null
    treemap!: ReturnType<typeof createTreemap>
    window!: Window
    store!: GunStore
    rootId: string = ''
    name: string = ''
    constructor() {
        console.log('App constructor started');
        if (!GunX.user.is) {
            throw new Error('Must be logged in before initializing App');
        }
        this.rootId = GunX.user.is.pub as string
        this.name = GunX.user.is.alias as string
        // Initialize store first
        this._updateNeeded = true
        this._pieUpdateNeeded = true;
        this.initializing = true;

        (window as any).app = this;
    }

    get root() {
        return this.store.root
    }

    // New method to properly initialize app
    async initialize() {
        console.log('Starting app initialization...');

        try {
            // Create the store with user identity as root
            this.store = await GunStore.create({
                id: this.rootId, 
                name: this.name, 
                points: 0, 
                manualFulfillment: 0
            });

            console.log('App init started');
            const container = document.getElementById('treemap-container');
            
            if (!container) {
                throw new Error('Treemap container element not found');
            }
            
            const width = container.clientWidth;
            const height = container.clientHeight;
            
            // Wait for root to be available - try multiple times if needed
            const rootNode = await this.waitForRoot(10); // Try up to 10 times
            if (!rootNode) {
                throw new Error('Root node is null after multiple attempts');
            }
            
            console.log('Root node loaded successfully:', rootNode.name, 'ID:', rootNode.id);
            
            // Initialize example data if needed
            console.log('Initializing example data...');
            await initializeExampleData(rootNode);
            
            // Add a delay to ensure all data is loaded before visualization
            console.log('Waiting for data to stabilize before creating visualization...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('Creating visualization...');
            // Create visualization with the loaded root
            this.treemap = createTreemap(rootNode, width, height);
            if (!this.treemap?.element) {
                throw new Error('Treemap element is null'); 
            }
            container.appendChild(this.treemap.element);

            let rootIdentity = rootNode;

            // Start update cycle
            this.updateInterval = setInterval(() => {
                const newRootIdentity = this.root;
                if (newRootIdentity && newRootIdentity !== rootIdentity) {
                    console.log('Root identity changed, refreshing visualizations');
                    rootIdentity = newRootIdentity;
                    this.updateTreeMap();
                }
            }, 1000);

            this.initializing = false;
            console.log('App init completed successfully');
        } catch (error) {
            console.error('App initialization failed:', error);
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
        if (container && this.treemap) {
            //console.log('Updating treemap with children:', this.childrenArray);
            this.treemap.destroy();
            container.innerHTML = '';
            this.treemap = createTreemap(this.root!, container.clientWidth, container.clientHeight);
            if (this.treemap.element) {
                container.appendChild(this.treemap.element);
            }
        }
    }

    updatePieChart() {
        console.log('updatePieChart started');
        // console.log('Current app children:', this.childrenArray);
        // console.log('Current mutual fulfillment distribution:', this.mutualFulfillmentDistribution);
        const pieContainer = document.getElementById('pie-container');
        if (!pieContainer) {
            console.error('Pie container element not found');
            return;
        }
        
        if (this.treemap) {
            this.treemap.destroy();
        }

        pieContainer.innerHTML = '';
        
        const newPieChart = createPieChart(this.root!);
        if (!newPieChart) {
            console.error('Failed to create pie chart');
            return;
        }

        pieContainer.appendChild(newPieChart);
    }

    // Cleanup
    destroy() {
        clearInterval(this.updateInterval);
        clearInterval(this.saveInterval);
    }

    /**
     * Tries to get the root node multiple times, with delays between attempts
     * @param maxAttempts Maximum number of attempts to get the root
     * @param delayMs Milliseconds to wait between attempts
     * @returns The root TreeNode or null if still not available after all attempts
     */
    async waitForRoot(maxAttempts = 5, delayMs = 300): Promise<TreeNode | null> {
        let attempts = 0;
        
        console.log(`Waiting for root node with ID: ${this.store.rootId}`);
        
        // First check if we have any nodes in cache
        if (this.store.cache.size > 0) {
            console.log(`Store cache has ${this.store.cache.size} nodes`);
            // Log all nodes in cache
            this.store.cache.forEach((node, id) => {
                console.log(`Cache node: ${node.name}, ID: ${id}`);
            });
        } else {
            console.log('Store cache is empty');
        }
        
        while (attempts < maxAttempts) {
            const root = this.store.root;
            if (root) {
                console.log(`Root node found on attempt ${attempts + 1}: ${root.name}, ID: ${root.id}`);
                return root; // Success! Root node found
            }
            
            console.log(`Root not available yet, attempt ${attempts + 1}/${maxAttempts}. Waiting...`);
            // Wait before trying again
            await new Promise(resolve => setTimeout(resolve, delayMs));
            attempts++;
        }
        
        console.error('Failed to get root node after', maxAttempts, 'attempts');
        return null; // Still not available after all attempts
    }
}