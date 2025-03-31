import * as d3 from 'd3';
import { getColorForName } from '../utils/colorUtils';
import { TreeNode } from '../models/TreeNode';

export function createPieChart(data: TreeNode) {
    // Get the container dimensions
    const container = document.getElementById('pie-container');
    if (!container) {
        throw new Error('Could not find pie-container element');
    }
    const width = container.clientWidth;
    const height = container.clientHeight;
    const radius = Math.min(width, height) / 2;

    const ringThickness = (radius * 0.8) - (radius * 0.4);

    // Get mutualFulfillmentDistribution from root node
    console.log('Creating pie chart for data:', data);
    const mutualFulfillmentDistribution = data.mutualFulfillmentDistribution;
    console.log('mutualFulfillmentDistribution for pie:', mutualFulfillmentDistribution);

    // Create an array of [nodeId, value] pairs for the pie chart
    const pieData: [string, number][] = Array.from(mutualFulfillmentDistribution.entries());
    
    // Create a map of node IDs to TreeNode objects for later reference
    const nodeMap = new Map<string, TreeNode>();
    
    // Load node objects for each ID
    pieData.forEach(async ([nodeId]) => {
        const node = await TreeNode.fromId(nodeId);
        if (node) {
            nodeMap.set(nodeId, node);
        }
    });

    // Create pie layout
    const pie = d3.pie<[string, number]>()
        .value(d => d[1])  // Use the mutualFulfillmentDistribution value
        .sort(null);  // Maintain original order

    // Create arc generator
    const arc = d3.arc()
        .innerRadius(radius * 0.4)  // Create a donut chart
        .outerRadius(radius * 0.8);

    // Create SVG
    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [-width/2, -height/2, width, height])
        .style("font", "12px sans-serif");
        
    // Create pie segments from mutualFulfillmentDistribution
    const arcs = pie(pieData);

    // Add segments using the same color scheme as the treemap
    svg.selectAll("path")
        .data(arcs)
        .join("path")
        .attr("fill", d => {
            // Try to get the node object from the map, or use a default color
            const node = nodeMap.get(d.data[0]);
            return node ? getColorForName(node.name) : getColorForName(d.data[0]);
        })
        .attr("d", d => arc(d as any))  // Type assertion to fix type error
        .append("title") 
        .text(d => {
            const node = nodeMap.get(d.data[0]);
            const name = node ? node.name : d.data[0];
            return `${name}: ${(d.data[1] * 100).toFixed(1)}%`;
        });

    // Add labels with node names
    svg.selectAll("text")
        .data(arcs)
        .join("text")
        .attr("transform", d => {
            const [x, y] = arc.centroid(d as any);
            return `translate(${x}, ${y})`;
        })
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .style("font-size", "10px")
        .style("pointer-events", "none")
        .style("text-shadow", "0px 0px 2px rgba(0,0,0,0.8)")
        .text(d => {
            const node = nodeMap.get(d.data[0]);
            if (node && node.name.length < 10) {
                return node.name;
            }
            // Don't show text for long names or if node isn't loaded
            return "";
        });

    // Add center text
    const centerGroup = svg.append("g")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle");

    // Calculate text size based on inner radius
    const fontSize = radius * 0.12;  // 20% of radius
    
    /*
    On the other hand, it also serves as a measure of the portion of the common labour borne by each individual, 
    and of his share in the part of the total product destined for individual consumption. 
    The social relations of the individual producers, 
    with regard both to their labour and to its products, 
    are in this case perfectly simple and intelligible, 
    and that with regard not only to production but also to distribution.
    */

    // Communal Shares? Mutual Shares?

    // Can we add a distribute-surplus? button here?

    centerGroup.append("text")
        .attr("dy", -fontSize/1.6)  // Center it
        .attr("font-size", fontSize)
        .attr("font-weight", "bold")
        .text("Mutual");

    centerGroup.append("text")
        .attr("dy", fontSize/1.6)  // Move down by one full font size
        .attr("font-size", fontSize)
        .attr("font-weight", "bold")
        .text("Fulfillment");

    return svg.node();
}
