import * as GunX from './models/Gun.js';
import { Node } from './models/Node.js';
import { Store } from './models/Store.js';
import { createTreemap } from './visualizations/RecursiveTreeMap.js';
import { createPieChart } from './visualizations/PieChart.js';
import { initializeExampleData } from './example.js';

export class App extends Node {
    constructor() {
        console.log('App constructor started');
        if (!GunX.user.is) {
            throw new Error('Must be logged in before initializing App');
        }
        
        super(
            GunX.user.is.alias,
            null, 
            [], 
            GunX.user.is.pub
        );
                
        // Initialize store first
        this.store = new Store(this);
        this._updateNeeded = true
        this._pieUpdateNeeded = true
        // Make app instance available globally
        window.app = this;
    }

    // New method to properly initialize app
    async initialize() {
        this.initalizing = true
        console.log('Starting app initialization...');

        console.log('App init started');
        const container = document.getElementById('treemap-container');
        console.log('Container found:', !!container);
        
        if (container) {
            const width = container.clientWidth;
            const height = container.clientHeight;
            
            console.log('Creating treemap with dimensions:', width, height);
            console.log('Pre-treemap children count:', this.children.size);
            console.log('Pre-treemap children:', Array.from(this.children.entries()));
            
            // Store treemap reference on the instance
            this.treemap = createTreemap(this, width, height);
            console.log('Treemap created:', !!this.treemap);
            
            container.appendChild(this.treemap.element);
        }
        
        this.updatePieChart();

        console.log('App init completed');

        // Wait for store to fully sync and load existing data
        const nodesLoaded = await this.store.sync()
            .then(async (loaded) => {
                console.log('Store sync complete, loaded', loaded, 'nodes');
                
                // Now that sync is complete, check if we need example data
                if (this.children.size === 0) {
                    this.initalizing = false
                    console.log('No existing data found, initializing example data...');
                    await initializeExampleData(this);
                    this.initalizing = true
                }
                
                // Start update cycle
                this.updateInterval = setInterval(() => {
                    if (this.updateNeeded) {
                        console.log('Tree update needed, refreshing visualizations');
                        try {
                            this.updateTreeMap();
                        } finally {
                            this.updateNeeded = false;
                        }
                    }
                    if (this.pieUpdateNeeded) {
                        console.log('Pie update needed, refreshing pie chart');
                        this.updatePieChart();
                        this.pieUpdateNeeded = false;
                    }
                }, 60);

                // Wait for both loading and saving to complete
                await new Promise(resolve => {
                    const checkComplete = () => {
                        if (this.store.isFullyLoaded) {
                            console.log('All nodes loaded and saved, initialization complete');
                            resolve();
                        } else {
                            const queueSize = this.store.saveQueue.size;
                            const loadingComplete = this.store._loadingComplete;
                            console.log(`Waiting for initialization: Loading complete: ${loadingComplete}, Save queue size: ${queueSize}`);
                            setTimeout(checkComplete, 100);
                        }
                    };
                    checkComplete();
                });

                this.initalizing = false;
                return loaded;
            });
            
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
        return this.currentView.data
    }

    handleResize() {
        console.log('Resize handler triggered');
        const container = document.getElementById('treemap-container');
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
            console.log('Children before update:', Array.from(this.children.entries()));
            
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
            
            console.log('Children after update:', Array.from(this.children.entries()));
        } finally {
            console.log('Visualization update completed');
        }
    }

    updateTreeMap() {
        console.log('updateTreeMap called');
        const container = document.getElementById('treemap-container');
        if (container && this.treemap) {
            console.log('Updating treemap with children:', Array.from(this.children.entries()));
            container.innerHTML = '';
            this.treemap = createTreemap(this, container.clientWidth, container.clientHeight);
            container.appendChild(this.treemap.element);
        }
    }

    updatePieChart() {
        console.log('updatePieChart started');
        // console.log('Current app children:', Array.from(this.children.entries()));
        // console.log('Current mutual fulfillment distribution:', this.mutualFulfillmentDistribution);
        
        const pieContainer = document.getElementById('pie-container');
        pieContainer.innerHTML = '';
        const newPieChart = createPieChart(this);
        pieContainer.appendChild(newPieChart);
    }

    // Cleanup
    destroy() {
        clearInterval(this.updateInterval);
        clearInterval(this.saveInterval);
    }

    // Add debug method
    async inspectGunState() {
        console.log('=== Current Gun Database State ===');
        const nodes = await GunX.inspectDatabase();
        console.log('Total nodes:', Object.keys(nodes).length);
        return nodes;
    }
}