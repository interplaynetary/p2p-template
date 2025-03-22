import * as GunX from '../Gun';
import { GunStore, TreeNode } from './Free';
import { createTreemap } from '../../components/TreeMap';
import { createPieChart } from '../../components/PieChart';
import { initializeExampleData } from '../../example';

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class App {
    initializing: boolean
    _updateNeeded: boolean
    _pieUpdateNeeded: boolean
    updateInterval: any = null
    saveInterval: any = null
    treemap: ReturnType<typeof createTreemap>
    window: Window
    store: GunStore
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
        this.store = await GunStore.create({id: this.rootId, name: this.name, points: 0, manualFulfillment: 0})

        console.log('App init started');
        const container = document.getElementById('treemap-container');
        //console.log('Container found:', !!container);
        if (!container) {
            throw new Error('Treemap container element not found');
        }
        
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        //console.log('Creating treemap with dimensions:', width, height);
        //console.log('Pre-treemap children count:', Object.keys(this.childrenIds).length);
        //console.log('Pre-treemap children:', this.childrenArray);
        
        // Store treemap reference on the instance

        //console.log('Treemap created:', !!this.treemap);
        

        // this.updatePieChart(); // temporarily disabled


        // Wait for store to fully sync and load existing data
        await this.store.initialize()
            .then(async (loaded) => {
                console.log('Store initialization complete');
                // console.log('App children:', this.childrenArray);
                await initializeExampleData(this.root);
                // await sleep(200)
                this.treemap = createTreemap(this.root, width, height);
                container.appendChild(this.treemap.element);

                let rootIdentity = this.root

                // Start update cycle
                this.updateInterval = setInterval(() => {
                    const newRootIdentity = this.root
                    if (newRootIdentity && newRootIdentity !== rootIdentity) {
                        console.log('Root identity changed, refreshing visualizations');
                        rootIdentity = newRootIdentity
                        this.updateTreeMap()
                        // this.updatePieChart(); Temporarily disabled
                    }
                }, 1000);

                this.initializing = false;
                return loaded;
            }) 
            
        console.log('App init completed');
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
}