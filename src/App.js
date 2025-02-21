import * as GunX from './models/Gun.js';
import { Node } from './models/Node.js';
import { createTreemap } from './visualizations/TreeMap.js';
import { createPieChart } from './visualizations/PieChart.js';

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
        console.log('App super() completed');
        console.log('Initial children count:', this.children.size);
        console.log('Initial children:', Array.from(this.children.entries()));

        console.log('App constructor completed');
        
        // Initialize both update flags
        this.updateNeeded = true;
        this.pieUpdateNeeded = true;
        this.init();
        
        // Start update cycle with separate checks
        this.updateInterval = setInterval(() => {
            if (this.updateNeeded) {
                console.log('Tree update needed, refreshing visualizations');
                this.updateTreeMap();
                this.updateNeeded = false;
            }
            if (this.pieUpdateNeeded) {
                console.log('Pie update needed, refreshing pie chart');
                this.updatePieChart();
                this.pieUpdateNeeded = false;
            }
        }, 60);  // Check every 60ms
        


        // Add debug command to window
        window.inspectGun = () => this.inspectGunState();
    }

    init() {
        console.log('App init started');
        const container = document.getElementById('treemap-container');
        console.log('Container found:', !!container);
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        console.log('Creating treemap with dimensions:', width, height);
        console.log('Pre-treemap children count:', this.children.size);
        console.log('Pre-treemap children:', Array.from(this.children.entries()));
        
        this.treemap = createTreemap(this, width, height);
        console.log('Treemap created:', !!this.treemap);
        console.log('Post-treemap root node:', this.treemap.getRoot());
        console.log('Post-treemap descendants:', this.treemap.getRoot().descendants().length);
        
        if (!this.treemap) {
            throw new Error('Failed to initialize treemap');
        }
        
        this.updatePieChart();
        container.appendChild(this.treemap.element);

        // Setup handlers
        window.addEventListener('resize', this.handleResize.bind(this));

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

    updateVisualizations() {
        console.log('App.updateVisualizations called');
        if (!this.treemap) {
            console.log('Treemap not initialized yet');
            return;
        }
        
        try {
            console.log('Starting visualization update');
            console.log('Children before update:', Array.from(this.children.entries()));
            
            if (this.updateNeeded) {
                this.updateTreeMap();
                this.updateNeeded = false;
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
        console.log('updateTreeMap started');
        const container = document.getElementById('treemap-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Store the current data path to restore zoom
        const path = [];
        let temp = this.currentViewData;
        console.log('Current view before update:', temp);
        console.log('Current children count:', temp.children.size);
        console.log('Current children:', Array.from(temp.children.entries()));
        
        while (temp !== this) {
            path.push(temp);
            temp = temp.parent;
        }
        
        // Clear and recreate treemap
        container.innerHTML = '';
        console.log('Pre-recreate treemap children:', Array.from(this.children.entries()));
        this.treemap = createTreemap(this, width, height);
        console.log('Post-recreate treemap root:', this.treemap.getRoot());
        console.log('Post-recreate descendants:', this.treemap.getRoot().descendants().length);
        
        container.appendChild(this.treemap.element);
        
        // Restore zoom path using data references
        path.reverse().forEach(nodeData => {
            const correspondingNode = this.treemap.getRoot().descendants()
                .find(n => n.data === nodeData);
            if (correspondingNode) {
                this.treemap.zoomin(correspondingNode);
            }
        });
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

    // New method to save entire tree
    async saveTree() {
        /*
        // Save all dirty nodes
        const dirtyNodes = this.descendants().filter(node => node.isDirty);
        if (dirtyNodes.length > 0) {
            console.log('Saving dirty nodes:', dirtyNodes.map(n => ({
                name: n.name,
                changes: n.pendingChanges
            })));
            await Promise.all(dirtyNodes.map(node => node.save()));
        }*/
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