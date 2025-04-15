import * as d3 from 'd3';
import { getUserName } from '../utils/userUtils';
import { getColorForUserId } from '../utils/colorUtils';
import { TreeNode } from '../models/TreeNode';

// Define a custom event for depth changes
export const DEPTH_CHANGE_EVENT = 'social-depth-change';

export function createSocialChart(data: TreeNode, depth: number = 6) {
    console.log('createSocialChart starting with depth:', depth);
    
    // Get the container dimensions
    const container = document.getElementById('social-chart-container');
    if (!container) {
        console.error('Social chart container not found in DOM');
        throw new Error('Could not find social-chart-container element');
    }
    
    console.log('Found social-chart container:', container);
    
    // Always clear the container first to avoid duplicate elements
    container.innerHTML = '';
    console.log('Cleared container contents');
    
    // Create a chart container for the pie chart first
    console.log('Creating chart container');
    const chartContainer = document.createElement('div');
    chartContainer.className = 'social-chart';
    container.appendChild(chartContainer);

    try {
        // Get socialDistribution from root node with the specified depth
        console.log('Getting social distribution for node:', data.id);
        
        // Get container dimensions
        const width = chartContainer.clientWidth || 220;
        const height = chartContainer.clientHeight || 220;
        const radius = Math.min(width, height) / 2.2;
        
        console.log('Chart dimensions:', { width, height, radius });
        
        // Get the distribution using the getSocialDistribution method
        console.log('Calling getSocialDistribution with depth:', depth);
        const socialDistribution = data.getSocialDistribution(depth);
        
        if (!socialDistribution) {
            console.error('getSocialDistribution returned null or undefined');
            chartContainer.innerHTML = '<div style="padding: 20px; text-align: center;">No distribution data available</div>';
            return container;
        }
        
        console.log(`Got social distribution, entries: ${socialDistribution.size}`);
        
        const distributionEntries = Array.from(socialDistribution.entries());
        console.log(`Social distribution keys:`, distributionEntries.map(e => e[0]));
        console.log(`Social distribution values:`, distributionEntries.map(e => e[1]));

        // Create an array of [nodeId, value] pairs for the pie chart
        const pieData: [string, number][] = distributionEntries;
        console.log('Pie chart data entries:', pieData);
        
        // If there's no data, create a placeholder
        if (pieData.length === 0) {
            console.log('No distribution data, creating placeholder');
            chartContainer.innerHTML = `
                <svg width="${width}" height="${height}" viewBox="-${width/2} -${height/2} ${width} ${height}">
                    <circle r="${radius * 0.8}" fill="#f0f0f0" stroke="#e0e0e0" stroke-width="2"></circle>
                    <circle r="${radius * 0.4}" fill="white"></circle>
                    <g text-anchor="middle" dominant-baseline="middle">
                        <text dy="-${radius * 0.12/1.6}" font-size="${radius * 0.12}" font-weight="bold">Social</text>
                        <text dy="${radius * 0.12/1.6}" font-size="${radius * 0.12}" font-weight="bold">Distribution</text>
                    </g>
                    <text y="${radius * 0.6}" text-anchor="middle" font-size="12px" fill="#999">No distribution data available</text>
                </svg>
            `;
            
            // Create the depth control slider below the chart
            console.log('Creating depth control with currentDepth:', depth);
            createDepthControl(container, depth);
            
            return container;
        }
        
        // Create pie layout
        console.log('Creating pie layout');
        const pie = d3.pie<[string, number]>()
            .value(d => d[1])
            .sort(null);

        // Calculate arcs
        const arcs = pie(pieData);
        console.log(`Created ${arcs.length} arcs`);

        // Create arc generator
        const arc = d3.arc()
            .innerRadius(radius * 0.4)
            .outerRadius(radius * 0.8);

        // Create SVG paths and labels as arrays of strings
        const pathElements = arcs.map(d => {
            return `<path 
                fill="${getColorForUserId(d.data[0])}" 
                d="${arc(d as any)}">
                <title>${getUserName(d.data[0])}: ${(d.data[1] * 100).toFixed(1)}%</title>
            </path>`;
        }).join('');
        
        const labelElements = arcs.map(d => {
                const [x, y] = arc.centroid(d as any);
                const nodeName = getUserName(d.data[0]);
            return nodeName.length < 10 ? 
                `<text 
                    transform="translate(${x}, ${y})" 
                    dy="0.35em" 
                    text-anchor="middle" 
                    fill="white" 
                    style="font-size: 10px; text-shadow: 0px 0px 2px rgba(0,0,0,0.8);"
                >${nodeName}</text>` : '';
        }).join('');
        
        // Create SVG element with the calculated elements
        const svgHtml = `
            <svg width="${width}" height="${height}" viewBox="-${width/2} -${height/2} ${width} ${height}">
                <g class="slices">${pathElements}</g>
                <g class="labels">${labelElements}</g>
                <g text-anchor="middle" dominant-baseline="middle">
                    <text dy="-${radius * 0.12/1.6}" font-size="${radius * 0.12}" font-weight="bold">Social</text>
                    <text dy="${radius * 0.12/1.6}" font-size="${radius * 0.12}" font-weight="bold">Distribution</text>
                    <text dy="${radius * 0.12 * 2}" font-size="${radius * 0.12 * 0.7}" fill="#666">Depth: ${depth}</text>
                </g>
            </svg>
        `;
        
        // Add the SVG directly to the chart container
        chartContainer.innerHTML = svgHtml;
        console.log('Added SVG to chart container');
        
        // Create the depth control slider below the chart
        console.log('Creating depth control with currentDepth:', depth);
        createDepthControl(container, depth);
        
        console.log('Social chart creation completed successfully');
        return container;
        
    } catch (error) {
        console.error('Error creating social chart:', error);
        chartContainer.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #d44;">
                Error creating social chart: ${error instanceof Error ? error.message : String(error)}
                <br><small>See console for details</small>
            </div>
        `;
        
        // Still create the depth control even if there's an error
        createDepthControl(container, depth);
        
        return container;
    }
}

/**
 * Create a depth control slider for adjusting traversal depth
 */
function createDepthControl(container: HTMLElement, currentDepth: number): HTMLElement {
    console.log('Creating depth control with depth:', currentDepth);
    const depthControl = document.createElement('div');
    depthControl.className = 'depth-control-container';
    
    const label = document.createElement('label');
    label.textContent = 'Network Depth:';
    label.htmlFor = 'depth-slider';
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'depth-slider';
    slider.min = '1';
    slider.max = '6';
    slider.step = '1';
    slider.value = currentDepth.toString();
    
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'depth-value';
    valueDisplay.textContent = currentDepth.toString();
    
    slider.addEventListener('input', (e) => {
        const newDepth = parseInt((e.target as HTMLInputElement).value);
        valueDisplay.textContent = newDepth.toString();
    });
    
    slider.addEventListener('change', (e) => {
        const newDepth = parseInt((e.target as HTMLInputElement).value);
        console.log('Slider changed to depth:', newDepth);
        const event = new CustomEvent(DEPTH_CHANGE_EVENT, { 
            detail: { depth: newDepth },
            bubbles: true
        });
        container.dispatchEvent(event);
    });
    
    depthControl.appendChild(label);
    depthControl.appendChild(slider);
    depthControl.appendChild(valueDisplay);
    container.appendChild(depthControl);
    
    console.log('Depth control created and appended to container');
    return depthControl;
}

// Helper function to create placeholder pie chart when no data is available
function createPlaceholderPieChart(width: number, height: number, radius: number) {
    console.log('Creating placeholder pie chart with dimensions:', { width, height, radius });
    // Create SVG
    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [-width/2, -height/2, width, height])
        .style("font", "12px sans-serif");
    
    // Add gray empty circle
    svg.append("circle")
        .attr("r", radius * 0.8)
        .attr("fill", "#f0f0f0")
        .attr("stroke", "#e0e0e0")
        .attr("stroke-width", 2);
    
    // Add donut hole
    svg.append("circle")
        .attr("r", radius * 0.4)
        .attr("fill", "white");
    
    // Add center text
    const centerGroup = svg.append("g")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle");

    // Calculate text size based on inner radius
    const fontSize = radius * 0.12;
    
    centerGroup.append("text")
        .attr("dy", -fontSize/1.6)
        .attr("font-size", fontSize)
        .attr("font-weight", "bold")
        .text("Social");

    centerGroup.append("text")
        .attr("dy", fontSize/1.6)
        .attr("font-size", fontSize)
        .attr("font-weight", "bold")
        .text("Distribution");
    
    // Add message about no data
    svg.append("text")
        .attr("y", radius * 0.6)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("fill", "#999")
        .text("No distribution data available");
    
    const svgNode = svg.node();
    console.log('Placeholder pie chart created');
    return svgNode!;
}


// lets create extended for:
// Lets modify socialChart to have an input field above the name where one can change the Amount (real number) of , and a unit-name (which should be passed into the createCapacityChart.