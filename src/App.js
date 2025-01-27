import { createTreemap } from './visualizations/TreeMap.js';
import { createPieChart } from './visualizations/PieChart.js';

export class App {
    constructor(data) {
        console.log('Constructor - Initial data:', data.name);
        this.data = data;
        this.init();
    }

    // New method to get a complete snapshot of the data state
    getDataSnapshot() {
        const snapshot = (node) => {
            const result = {
                name: node.name,
                points: node.points,
                types: node.types,
            };
            
            // Include children if they exist
            if (node.childrenArray) {
                result.children = node.childrenArray.map(child => snapshot(child));
            }
            
            return result;
        };
        
        return JSON.stringify(snapshot(this.data));
    }

    init() {
        const container = document.getElementById('treemap-container');
        const pieContainer = document.getElementById('pie-container');

        const width = container.clientWidth;
        const height = container.clientHeight;

        console.log('Init - Creating treemap with data:', this.data.name);
        
        // Create treemap
        this.treemap = createTreemap(this.data, width, height);
        
        console.log('Init - Treemap created');
        
        // Store initial data state after treemap is created
        this.lastDataState = this.getDataSnapshot();
        
        // Create initial pie chart
        this.updatePieChart();

        // Append visualizations
        container.appendChild(this.treemap.element);

        // Setup window resize handler
        window.addEventListener('resize', this.handleResize.bind(this));

        // Setup periodic checks for data changes
        setInterval(() => this.checkForDataChanges(), 100);
    }

    checkForDataChanges() {
        const currentDataState = this.getDataSnapshot();
        if (currentDataState !== this.lastDataState) {
            console.log('Data change detected, updating pie chart');
            this.lastDataState = currentDataState;
            this.updatePieChart();
        }
    }

    get currentView() {
        return this.treemap.getCurrentView();
    }

    get currentViewData() {
        return this.currentView.data;
    }

    get currentData() {
        return this.treemap.getCurrentData();
    }

    handleResize() {
        console.log('Resize handler triggered');
        const container = document.getElementById('treemap-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.treemap.update(width, height);
    }

    updateVisualizations() {
        console.log('UpdateVisualizations started');
        const container = document.getElementById('treemap-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Store the current data path to restore zoom
        const path = [];
        let temp = this.currentViewData;
        console.log('Current view before update:', temp.name);
        while (temp !== this.data) {
            path.push(temp);
            temp = temp.parent;
        }
        
        // Clear and recreate treemap
        container.innerHTML = '';
        this.treemap = createTreemap(this.data, width, height);
        container.appendChild(this.treemap.element);
        
        // Restore zoom path using data references
        path.reverse().forEach(nodeData => {
            const correspondingNode = this.treemap.getRoot().descendants()
                .find(n => n.data === nodeData);
            if (correspondingNode) {
                this.treemap.zoomin(correspondingNode);
            }
        });

        // Update last data state after visualization update
        this.lastDataState = this.getDataSnapshot();
    }

    updatePieChart() {
        const pieContainer = document.getElementById('pie-container');
        const currentData = this.currentData;
        pieContainer.innerHTML = '';
        const newPieChart = createPieChart(currentData);
        pieContainer.appendChild(newPieChart);
    }
}