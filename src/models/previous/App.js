import * as GunX from '../Gun.js';
import { Node } from './Node.js';
import { Store } from './Store.js';
import { createTreemap } from '../../visualizations/RecursiveTreeMap.js';
import { createPieChart } from '../../visualizations/PieChart.js';
import { initializeExampleData } from '../../example.js';

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
        
        // Make app instance available globally
        window.app = this;
    }

    // New method to properly initialize app
    async initialize() {
        this.initalizing = true
        console.log('Starting app initialization...');
        
        // Initialize visualization
        this.updateNeeded = true;
        this.pieUpdateNeeded = true;
        this.init();

        // Wait for store to fully sync and load existing data
        const nodesLoaded = await this.store.sync();
        console.log('Store sync complete, loaded', nodesLoaded, 'nodes');
        console.log('App initialized with', this.children.size, 'children');
        
        // Now that sync is complete, check if we need example data
        if (this.children.size === 0) {
            console.log('No existing data found, initializing example data...');
            await initializeExampleData(this);
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
    }

    init() {
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
        console.log('Current app children:', Array.from(this.children.entries()));
        console.log('Current mutual fulfillment distribution:', this.mutualFulfillmentDistribution);
        
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