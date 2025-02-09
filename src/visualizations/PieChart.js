import * as d3 from 'd3';
import { getColorForName } from '../utils/colorUtils.js';

export function createPieChart(data) {
    // Get the container dimensions
    const container = document.getElementById('pie-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const radius = Math.min(width, height) / 2;

    const ringThickness = (radius * 0.8) - (radius * 0.4);

    // Get mutualFulfillmentDistribution from root node
    console.log('Creating pie chart for data:', data);
    const mutualFulfillmentDistribution = data.mutualFulfillmentDistribution;
    console.log('mutualFulfillmentDistribution for pie:', mutualFulfillmentDistribution);

    // Create pie layout
    const pie = d3.pie()
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
    const arcs = pie(Array.from(mutualFulfillmentDistribution.entries()));

    // Add segments using the same color scheme as the treemap
    svg.selectAll("path")
        .data(arcs)
        .join("path")
        .attr("fill", d => getColorForName(d.data[0].name))  // Use same color function
        .attr("d", arc)
        .append("title")
        .text(d => `${d.data[0].name}: ${(d.data[1] * 100).toFixed(1)}%`);

    // Add labels
    svg.selectAll("text")
        .data(arcs)
        .join("text")
        .attr("transform", d => {
            const [x, y] = arc.centroid(d);  // This gives us the center of the arc
            return `translate(${x},${y})`;
        })
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .style("font-size", `${ringThickness * 0.3}px`)  // Scale text to 30% of ring thickness
        .text(d => `${d.data[0].name}`);

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
