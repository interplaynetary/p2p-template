# Contributing to Free Association

## Introduction

Welcome! This document serves as your guide to understanding and contributing to the Free Association project - a technical implementation of a revolutionary social-economic model based on mutual recognition and contribution.

### Why Contribute?

The Free Association project is not just another web application - it's a proof-of-concept for a fundamentally new way to organize human collaboration. By contributing, you are:

1. **Building Alternative Economic Systems** - Helping create tools that demonstrate how truly free social coordination can work without centralized control or markets

2. **Working on Cutting-Edge Visualization** - Creating intuitive interfaces for social-economic concepts through interactive tree structures and data visualization

3. **Implementing Recursive Mathematics** - Bringing to life mathematical concepts of mutual recognition, contribution networks, and proportional distribution

4. **Joining a Mission-Driven Project** - Contributing to a project that aims to create a world where the free development of each is the condition for the free development of all

### How This Document Helps

This guide breaks down the core components of the application's architecture in progressive detail:

- **High-level overview** - Understand the tree data structure that forms the foundation
- **Data flow explanations** - Learn how information moves between components
- **Visualization details** - Dive into the D3-based visualizations that make concepts tangible

Whether you're a developer interested in the technical challenges or someone passionate about alternative economic systems, understanding this document will equip you to make meaningful contributions to the project.

Let's build tools for a more collaborative future together!

## Table of Contents
- [Overview](#contributing-to-free-association)
- [Project Structure and Tree-Based Calculations](#project-structure-and-tree-based-calculations)
  - [Tree Data Structure Overview](#tree-data-structure-overview)
  - [Core Components](#core-components)
    - [Node Class](#node-class)
    - [Tree Hierarchy](#tree-hierarchy)
  - [Key Tree Calculations](#key-tree-calculatsions)
    - [Fulfillment Calculation](#fulfillment-calculation-recursive)
    - [Weight Calculation](#weight-calculation)
    - [Share of Parent](#share-of-parent)
    - [Mutual Recognition Calculations](#mutual-recognition-calculations)
  - [Visualization Components](#visualization-components)
  - [Data Flow](#data-flow)
  - [Recursive Proportion Distribution](#recursive-proportion-distribution)
  - [Contributing to the Codebase](#contributing-to-the-codebase)
- [Data Flow Between App and TreeMap](#data-flow-between-app-and-treemap)
  - [Initialization Flow](#initialization-flow)
  - [Update Cycle](#update-cycle)
  - [Bidirectional Communication](#bidirectional-communVication)
  - [The Node Adapter Pattern](#the-node-adapter-pattern)
- [Understanding the TreeMap Visualization](#understanding-the-treemap-visualization)
  - [TreeMap Algorithm Basics](#treemap-algorithm-basics)
  - [TreeMap Creation Process](#treemap-creation-process)
  - [Custom Tiling Algorithm](#custom-tiling-algorithm)
  - [Interactive Features](#interactive-features)
  - [Rendering Process](#rendering-process)
  - [Zoom Transitions](#zoom-transitions)
  - [Responsive Design](#responsive-design)
  - [Font Sizing Logic](#font-sizing-logic)
  - [State Management](#state-management)
  - [Debugging Tips](#debugging-tips)

1. The Node class in Node.js is the fundamental structure. It represents a node in a tree with:
   - name, id, parent, points, children (Map), types (Set)
   - methods for calculating relationships between nodes
   - methods for calculating shares and fulfillment

2. The App class in App.js is the root of the application tree structure:
   - It initializes the store
   - Manages visualizations (TreeMap and PieChart)
   - Handles updates and synchronization

3. From the README, this is implementing a "Free Association" model where:
   - Nodes recognize contributions from other nodes
   - Mutual recognition = min(B's share of A's total recognition, A's share of B's total recognition)
   - Surplus distribution follows mutual recognition

Key tree-based calculations include:
- Fulfillment calculations (recursive through the tree)
- Weight calculations
- Share calculations (proportional distribution)
- Recognition relationships between nodes

# Project Structure and Tree-Based Calculations

![Tree Structure](./resources/tree.png)

## Tree Data Structure Overview

Free Association uses a tree-based data structure to represent nodes of contribution and their relationships. Understanding this tree structure is fundamental to understanding how the application works.

## Core Components

### Node Class

The `Node` class (in `src/models/Node.js`) is the fundamental building block of our tree structure:

```
Node
├── name: String
├── id: UUID
├── parent: Node reference (null for root)
├── points: Number
├── children: Map<String, Node>
├── types: Set<String>
├── isContributor: Boolean
└── _manualFulfillment: Number (nullable)
```

Each Node can:
- Have one parent (except the root node)
- Have multiple children (stored in a Map)
- Belong to multiple types (stored in a Set)
- Have points representing its contribution weight

### Tree Hierarchy

The application creates a hierarchical tree where:
- The root node (`App` instance) represents the top-level container
- Children nodes represent contributions/needs/categories
- Leaf nodes (nodes without children) can be either contributors or non-contributors
- Types provide a cross-cutting categorization across the tree

## Key Tree Calculations

### Fulfillment Calculation (Recursive)

The `fulfilled` property is calculated recursively through the tree:

1. **For leaf nodes**:
   - If a leaf is a contributor: fulfillment = 1.0
   - If a leaf is not a contributor: fulfillment = 0

2. **For branch nodes**:
   - Either uses manual fulfillment (if set and has contributor children)
   - Or calculates as the weighted sum of children's fulfillment:
     ```
     fulfilled = sum(child.fulfilled * child.shareOfParent) for all children
     ```

3. **Hybrid cases** (nodes with both contributor and non-contributor children):
   - Combines manual fulfillment for contributor children with calculated fulfillment for non-contributor children using proportional weighting

### Weight Calculation

The `weight` property represents a node's proportional importance in the entire tree:

```javascript
weight = (parent) ? 
  (this.points / parent.totalChildPoints) * parent.weight : 
  1
```

This creates a cascading distribution of weight from the root to all descendants.

### Share of Parent

The `shareOfParent` property represents what fraction of the parent's total points a node contributes:

```javascript
shareOfParent = (parent) ?
  (parent.totalChildPoints === 0) ? 0 : this.points / parent.totalChildPoints :
  1
```

### Mutual Recognition Calculations

The system also computes "mutual recognition" between nodes, which is the bidirectional validation of contributions:

1. `shareOfGeneralFulfillment(node)` - What portion of recognition one node gives to another
2. `mutualFulfillment(node)` - The minimum of bidirectional recognition between nodes
3. `mutualFulfillmentDistribution` - A distribution map of mutual recognition across all types

## Visualization Components

The tree is visualized through two main components:

1. **TreeMap** (`src/visualizations/TreeMap.js`):
   - Renders the hierarchical structure of nodes
   - Allows navigation up and down the tree
   - Shows proportional areas based on node weights

2. **PieChart** (`src/visualizations/PieChart.js`):
   - Displays the mutual fulfillment distribution
   - Shows relationships between different types

## Data Flow

1. The `App` class initializes as the root node
2. The `Store` handles persistence to the Gun database
3. Changes to nodes trigger updates to the visualizations
4. Visualizations represent the tree state and allow interaction

## Recursive Proportion Distribution

One of the key concepts in the tree is how shares and fulfillment propagate recursively:

1. A child's contribution to fulfillment is proportional to its share of the parent's total points
2. Fulfillment flows upward from leaves to the root
3. Recognition flows bidirectionally across the network

## Contributing to the Codebase

When working with this tree structure, keep in mind:

1. Changes to node properties may trigger cascading updates through the tree
2. The `updateNeeded` and `pieUpdateNeeded` flags signal when visualizations need refreshing

## Data Flow Between App and TreeMap

The interaction between the App (root node) and the TreeMap visualization is a critical part of the application. Understanding this data flow is essential for contributors:

### Initialization Flow

1. **App Creation**:
   - The `App` class extends `Node` and becomes the root of the tree structure
   - When initialized, it creates a `Store` instance to handle persistence
   - The `initialize()` method sets up update cycles and triggers initial visualization

2. **TreeMap Creation**:
   - The App calls `createTreemap(this, width, height)` passing itself as the root node
   - The TreeMap converts our Node-based tree to a D3 hierarchy using compatibility methods
   - D3's treemap layout algorithm is applied to calculate rectangular areas

```javascript
// App.js - TreeMap initialization
this.treemap = createTreemap(this, width, height);
container.appendChild(this.treemap.element);
```

### Update Cycle

1. **State Changes**:
   - Any modification to a Node (adding children, changing points, etc.) sets `updateNeeded = true`
   - The App runs an interval that checks this flag: `setInterval(() => { if (this.updateNeeded) {...} }, 60)`

2. **Visualization Refresh**:
   - When updates are needed, App calls `updateTreeMap()`
   - This recreates the TreeMap with the current state of the nodes
   - The TreeMap renders the new visualization based on the updated tree structure

```javascript
// App.js - Update cycle
updateTreeMap() {
    const container = document.getElementById('treemap-container');
    if (container && this.treemap) {
        container.innerHTML = '';
        this.treemap = createTreemap(this, container.clientWidth, container.clientHeight);
        container.appendChild(this.treemap.element);
    }
}
```

### Bidirectional Communication

1. **TreeMap to App**:
   - User interactions in TreeMap (zooming, clicking) update the current view
   - The App accesses this via `this.currentView` getter which calls `this.treemap.getCurrentView()`
   - This ensures the App always knows which part of the tree the user is viewing

2. **App to TreeMap**:
   - Modifications to the tree structure flow naturally to the TreeMap on refresh
   - The TreeMap uses D3 compatibility methods on Node to access the data:
     - `childrenArray`: gets children as an array for D3
     - `value`: maps to points for treemap area calculations
     - `data`: provides access to the original Node object

```javascript
// Node.js - D3 compatibility methods
get childrenArray() {
    return Array.from(this.children.values());
}

get value() {
    return this.points;
}
```

### The Node Adapter Pattern

The Node class acts as an adapter between our domain model and D3's expectations:

1. Node stores data in Maps and Sets for efficient operations
2. D3 expects arrays and specific property names
3. Node provides compatibility methods to bridge this gap
4. This allows our domain model to remain clean while working with D3

Understanding this flow helps when:
- Debugging visualization issues
- Adding new interactions or visualization features  
- Optimizing performance by minimizing unnecessary updates

## Understanding the TreeMap Visualization

The TreeMap is a core visualization component that represents the hierarchical node structure as nested rectangles. Understanding how it works is crucial for contributors working on the visualization aspects of the application.

### TreeMap Algorithm Basics

1. **Hierarchical Representation**:
   - The treemap divides available space into rectangles proportional to node values
   - Parent nodes contain their children as nested rectangles
   - Rectangle area corresponds to the node's points (value)

2. **D3.js Implementation**:
   - We use D3's treemap layout with a custom tile function
   - The layout converts our hierarchical data into a set of rectangles with x/y coordinates
   - Each rectangle's size is proportional to its value relative to siblings

### TreeMap Creation Process

```javascript
// Simplified view of createTreemap function
export function createTreemap(rootNode, width, height) {
    // 1. Create scales for mapping data to screen coordinates
    const x = d3.scaleLinear().rangeRound([0, width]);
    const y = d3.scaleLinear().rangeRound([0, height]);
    
    // 2. Convert Node tree to D3 hierarchy
    let hierarchy = d3.hierarchy(rootNode, d => d.childrenArray)
        .each(d => { d.value = d.data.points || 0; });
    
    // 3. Apply treemap layout
    let root = d3.treemap().tile(tile)(hierarchy);
    
    // 4. Create SVG element and render
    const svg = d3.create("svg")
        .attr("viewBox", [0.5, -50.5, width, height + 50]);
        
    // 5. Render nodes as rectangles
    let group = svg.append("g").call(render, root);
    
    // Return public interface
    return { element: svg.node(), /* other methods */ };
}
```

### Custom Tiling Algorithm

The TreeMap uses a custom tiling algorithm that directly uses node point values rather than calculating them from descendants:

```javascript
function tile(node, x0, y0, x1, y1) {
    if (!node.children) return;
    
    // Use points directly from data
    node.children.forEach(child => {
        child.value = child.data.points;
    });
    
    // Apply squarify algorithm with available space
    const tempHierarchy = d3.hierarchy(/* simplified structure */)
    d3.treemapSquarify(tempHierarchy, 0, 0, availableWidth, availableHeight);
    
    // Transfer positions back to our nodes
    node.children.forEach((child, i) => {
        child.x0 = x0 + tempNode.x0;
        child.x1 = x0 + tempNode.x1;
        // etc.
    });
}
```

This approach ensures the treemap reflects the exact point values from our Node model.

### Interactive Features

The TreeMap includes several key interactive features:

1. **Zooming Navigation**:
   - Clicking a node zooms in to show its children in the full view
   - Clicking the root rectangle zooms out to the parent
   - A home button appears when viewing type-based trees

2. **Node Growth/Shrinking**:
   - Long press on a node gradually increases its points
   - Right-click or two-finger touch decreases points
   - Points are updated in the model and the treemap adjusts in real-time

3. **Type Navigation**:
   - Type indicators appear as colored circles
   - Clicking a type circle navigates to a tree filtered by that type

### Rendering Process

The rendering process includes several steps:

1. **Create Node Elements**:
   - Generate a group (`<g>`) element for each node
   - Add rectangles sized according to the node's value
   - Add text labels positioned centrally within each rectangle
   - Scale text based on available space

2. **Position Elements**:
   - Position groups using the x/y coordinates from the treemap layout
   - Size rectangles according to the x1-x0 and y1-y0 differences
   - Apply transitions for smooth animations between states

3. **Add Interactive Elements**:
   - Attach event handlers for clicks, touch events, etc.
   - Create type indicator circles
   - Add navigation controls (home button, etc.)

### Zoom Transitions

Zooming between different levels of the hierarchy uses D3 transitions for smooth animations:

```javascript
function zoomin(d) {
    // Update domains to the target node's boundaries
    x.domain([d.x0, d.x1]);
    y.domain([d.y0, d.y1]);
    
    // Create new group with the zoomed-in view
    const group1 = group = svg.append("g").call(render, d);
    
    // Animate transition between views
    svg.transition()
        .duration(750)
        .call(t => group0.transition(t).remove()
            .call(position, d.parent))
        .call(t => group1.transition(t)
            .attrTween("opacity", () => d3.interpolate(0, 1))
            .call(position, d));
}
```

### Responsive Design

The TreeMap adjusts to container size changes through the `update` method:

```javascript
update: (newWidth, newHeight) => {
    // Update scales with new dimensions
    x.rangeRound([0, newWidth]);
    y.rangeRound([0, newHeight]);
    
    // Update SVG viewBox
    svg.attr("viewBox", [0.5, -50.5, newWidth, newHeight + 50]);
    
    // Re-render with current view
    group.remove();
    group = svg.append("g");
    group.call(render, currentView);
}
```

This ensures the visualization adapts to window resizing.

### Font Sizing Logic

Text within each rectangle is sized dynamically based on the available space:

```javascript
// Simplified example
.style("font-size", d => {
    const rectWidth = d === root ? width : x(d.x1) - x(d.x0);
    const rectHeight = d === root ? 50 : y(d.y1) - y(d.y0);
    return calculateFontSize(d, rectWidth, rectHeight, root, x, y, currentView) + "px";
})
```

The `calculateFontSize` function in `fontUtils.js` determines the optimal text size to fit within each rectangle.

### State Management

The TreeMap maintains several important state variables:

1. `currentView` - Tracks which node is currently being displayed at full view
2. `root` - The root node of the current hierarchy 
3. Growth-related states (`isGrowing`, `growthInterval`, etc.) for interactive resizing

Understanding these state variables is crucial when modifying the TreeMap's behavior.

### Debugging Tips

When working with the TreeMap, these debugging techniques are helpful:

1. Use browser dev tools and console.logging to inspect the SVG structure (ctrl+shift+i)

Understanding these aspects of the TreeMap will help contributors modify and extend the visualization functionality effectively.
