import * as d3 from 'd3';
import { getUserName } from '../utils/userUtils';
import { getColorForUserId } from '../utils/colorUtils';
import { TreeNode } from '../models/TreeNode';
import { SocialDistribution } from '../models/SocialDistribution';

// Define a custom event for depth changes when clicking the mini chart
export const CAPACITY_DEPTH_CHANGE_EVENT = 'capacity-depth-change';

/**
 * Creates a small pie chart to display the capacity distribution at the given depth
 * @param node The TreeNode to compute distribution for
 * @param depth The depth to traverse for distribution calculation
 * @param scale Scale factor for the chart size (1 = 100% size)
 * @param container Optional existing container to update
 * @returns The container element with the chart
 */
export function createCapacityDistributionChart(
  node: TreeNode,
  depth: number = 3,
  scale: number = 1,
  container?: HTMLElement
): HTMLElement {
  // If no container provided, create a new one
  if (!container) {
    container = document.createElement('div');
    container.classList.add('capacity-distribution-chart');
    container.setAttribute('data-has-click-listener', 'false');
  }

  // Set the current depth on the container
  container.setAttribute('data-current-depth', depth.toString());

  // Update the chart display with the new depth
  updateChartDisplay(container, node, depth, scale);

  // Setup click handler only once per container
  const hasListener = container.getAttribute('data-has-click-listener') === 'true';
  if (!hasListener) {
    setupClickHandler(container, node, scale);
    container.setAttribute('data-has-click-listener', 'true');
  }

  return container;
}

/**
 * Updates the chart display without recreating the element
 */
function updateChartDisplay(
  container: HTMLElement,
  node: TreeNode,
  depth: number,
  scale: number
): void {
  // Clear existing content
  container.innerHTML = '';

  // Set dimensions based on scale
  const size = 80 * scale;
  container.style.width = `${size}px`;
  container.style.height = `${size}px`;

  // Compute the distribution
  const socialDistribution = new SocialDistribution(node);
  const distribution = socialDistribution.getSocialDistribution(depth);

  // Create tooltip (hidden by default)
  const tooltip = document.createElement('div');
  tooltip.classList.add('distribution-tooltip');
  tooltip.style.display = 'none';
  tooltip.textContent = `Depth: ${depth}`;
  container.appendChild(tooltip);

  // If no data, create a placeholder SVG
  if (!distribution || Object.keys(distribution).length === 0) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', `${size}`);
    svg.setAttribute('height', `${size}`);
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.innerHTML = `
      <circle cx="50" cy="50" r="40" fill="#f0f0f0" />
      <text x="50" y="50" text-anchor="middle" dominant-baseline="middle" font-size="12">No data</text>
      <text x="50" y="65" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="bold">${depth}</text>
    `;
    container.appendChild(svg);
    return;
  }

  // Create the SVG element
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', `${size}`);
  svg.setAttribute('height', `${size}`);
  svg.setAttribute('viewBox', '0 0 100 100');

  // Sort the keys to ensure consistent colors
  const keys = Object.keys(distribution).sort();
  const total = keys.reduce((sum, key) => sum + distribution[key], 0);

  // Generate the pie chart
  let startAngle = 0;
  const centerX = 50;
  const centerY = 50;
  const radius = 40;
  const colors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#C9CBCF', '#7AC142', '#EC932F', '#EF3E36'
  ];

  // Create the group for the pie slices
  const pieGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  pieGroup.setAttribute('class', 'slices');
  
  keys.forEach((key, index) => {
    const value = distribution[key];
    const angle = (value / total) * 360;
    const endAngle = startAngle + angle;
    
    // Convert angles to radians
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);
    
    // Calculate the points
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    
    // Determine if the arc should be drawn as a large arc
    const largeArcFlag = angle > 180 ? '1' : '0';
    
    // Create the path for the slice
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `
      M ${centerX} ${centerY}
      L ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
      Z
    `);
    path.setAttribute('fill', colors[index % colors.length]);
    path.setAttribute('stroke', 'white');
    path.setAttribute('stroke-width', '1');
    
    // Add a data attribute for the capacity name and value
    path.setAttribute('data-name', key);
    path.setAttribute('data-value', value.toString());
    path.setAttribute('data-percentage', `${Math.round((value / total) * 100)}%`);
    
    // Add mouseover event for tooltip
    path.addEventListener('mouseover', (e) => {
      const target = e.target as SVGPathElement;
      const name = target.getAttribute('data-name');
      const percentage = target.getAttribute('data-percentage');
      tooltip.textContent = `${name}: ${percentage}`;
      tooltip.style.display = 'block';
    });
    
    path.addEventListener('mouseout', () => {
      tooltip.style.display = 'none';
    });
    
    pieGroup.appendChild(path);
    
    startAngle = endAngle;
  });
  
  svg.appendChild(pieGroup);
  
  // Add a white circle in the center
  const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  centerCircle.setAttribute('cx', centerX.toString());
  centerCircle.setAttribute('cy', centerY.toString());
  centerCircle.setAttribute('r', (radius * 0.35).toString());
  centerCircle.setAttribute('fill', 'white');
  svg.appendChild(centerCircle);
  
  // Add the depth text in the center
  const depthText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  depthText.setAttribute('x', centerX.toString());
  depthText.setAttribute('y', centerY.toString());
  depthText.setAttribute('text-anchor', 'middle');
  depthText.setAttribute('dominant-baseline', 'middle');
  depthText.setAttribute('font-size', '14');
  depthText.setAttribute('font-weight', 'bold');
  depthText.textContent = depth.toString();
  svg.appendChild(depthText);
  
  container.appendChild(svg);
}

/**
 * Sets up the click handler for cycling through depths
 */
function setupClickHandler(
  container: HTMLElement,
  node: TreeNode,
  scale: number
): void {
  // This flag prevents processing multiple clicks too rapidly
  let isProcessing = false;

  container.addEventListener('click', () => {
    // Skip if already processing
    if (isProcessing) return;
    isProcessing = true;
    
    // Get current depth and calculate next depth
    const currentDepth = parseInt(container.getAttribute('data-current-depth') || '3');
    const maxDepth = 5;
    const newDepth = currentDepth >= maxDepth ? 1 : currentDepth + 1;
    
    console.log(`Changing depth from ${currentDepth} to ${newDepth}`);
    
    // Update the container's data attribute
    container.setAttribute('data-current-depth', newDepth.toString());
    
    // Update the chart display
    updateChartDisplay(container, node, newDepth, scale);
    
    // Dispatch the depth change event
    const event = new CustomEvent(CAPACITY_DEPTH_CHANGE_EVENT, {
      detail: { depth: newDepth }
    });
    container.dispatchEvent(event);
    
    // Reset processing flag after a short delay
    setTimeout(() => {
      isProcessing = false;
    }, 300);
  });
}