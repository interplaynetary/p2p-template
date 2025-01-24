import { createTreemap } from './visualizations/TreeMap.js';
import { createPieChart } from './visualizations/PieChart.js';

export class App {
    constructor(data) {
        this.data = data;
        this.init();
    }

    init() {
        // Initialize containers
        const container = document.getElementById('treemap-container');
        const pieContainer = document.getElementById('pie-container');

        // Get container dimensions
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Create treemap with update callback
        this.treemap = createTreemap(
            this.data, 
            width, 
            height, 
            () => {
                this.updatePieChart();
            }
        );
        
        // Create initial pie chart
        this.updatePieChart();

        // Store reference to root
        this.root = this.treemap.root;

        // Append visualizations
        container.appendChild(this.treemap.element);

        // Setup window resize handler
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    // Getter for currentView that uses the function from treemap
    get currentView() {
        // Assuming TreeMap now returns a function getCurrentView() instead of a property
        return this.treemap.getCurrentView();
    }

    // Getter for currentViewData that uses the function from treemap
    get currentViewData() {
        return this.currentView.data;
    }

    handleResize() {
        const container = document.getElementById('treemap-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.treemap.update(width, height);
        this.updatePieChart();
    }

    updateVisualizations() {
        const container = document.getElementById('treemap-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Store the current data path to restore zoom
        const path = [];
        let temp = this.currentViewData;
        console.log('Current view before update:', this.currentViewData.name);
        while (temp !== this.data) {
            path.push(temp);
            temp = temp.parent;
        }
        
        // Clear and recreate treemap
        container.innerHTML = '';
        this.treemap = createTreemap(
            this.data, 
            width, 
            height, 
            () => {
                this.updatePieChart();
            }
        );
        container.appendChild(this.treemap.element);
        
        // Restore zoom path using data references
        path.reverse().forEach(nodeData => {
            const correspondingNode = this.treemap.root.descendants()
                .find(n => n.data === nodeData);
            if (correspondingNode) {
                this.treemap.zoomin(correspondingNode);
            }
        });
        
        // Update pie chart
        this.updatePieChart();
    }

    updatePieChart() {
        const pieContainer = document.getElementById('pie-container');
        pieContainer.innerHTML = '';
        const newPieChart = createPieChart(this.data);
        pieContainer.appendChild(newPieChart);
    }
}