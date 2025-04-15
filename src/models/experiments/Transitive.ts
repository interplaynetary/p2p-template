/**
 * Calculates the transitive share between two nodes in the network
 * @param {Object} sourceNode - The node requesting access (You)
 * @param {Object} targetNode - The node whose capacity is being accessed (Them)
 * @param {Number} maxDepth - Maximum recursion depth (default 5)
 * @param {Number} currentDepth - Current recursion depth
 * @param {Set} visitedNodes - Set of already visited nodes to prevent cycles
 * @returns {Number} - The calculated transitive share (0-1)
 */
export function calculateTransitiveShare(sourceNode, targetNode, maxDepth = 5, currentDepth = 0, visitedNodes = new Set()) {
    // Prevent infinite loops by tracking visited nodes
    if (visitedNodes.has(sourceNode.id)) {
      return 0;
    }
    
    // Base case: max recursion depth reached
    if (currentDepth >= maxDepth) {
      return 0;
    }
    
    // Mark this node as visited for this path
    const newVisitedNodes = new Set(visitedNodes);
    newVisitedNodes.add(sourceNode.id);
    
    // Calculate direct share from sourceNode to targetNode
    let directShare = 0;
    if (sourceNode.recognizes(targetNode)) {
      directShare = getMutualRecognition(sourceNode, targetNode) / 
                    getTotalMutualRecognition(targetNode);
    }
    
    // Base case: direct connection or first level
    if (currentDepth === 0 && sourceNode === targetNode) {
      return 1; // You have 100% access to your own capacity
    }
    
    // Calculate indirect shares through intermediate nodes
    let indirectShare = 0;
    
    // For each node that sourceNode recognizes
    for (const intermediateNode of sourceNode.getRecognizedNodes()) {
      // Skip if it's the target (already counted in directShare)
      if (intermediateNode === targetNode) {
        continue;
      }
      
      // Calculate direct share to the intermediate node
      const shareToIntermediate = getMutualRecognition(sourceNode, intermediateNode) / 
                                 getTotalMutualRecognition(intermediateNode);
      
      // Recursively calculate the intermediate node's share to the target
      const intermediateToTarget = calculateTransitiveShare(
        intermediateNode, 
        targetNode, 
        maxDepth, 
        currentDepth + 1, 
        newVisitedNodes
      );
      
      // Add this path's contribution (multiplicative)
      indirectShare += shareToIntermediate * intermediateToTarget;
    }
    
    // Total transitive share is direct share plus indirect share
    return directShare + indirectShare;
  }
  
  /**
   * Helper: Get mutual recognition between two nodes
   */
  function getMutualRecognition(nodeA, nodeB) {
    const aRecognizesB = nodeA.getRecognitionOf(nodeB) || 0;
    const bRecognizesA = nodeB.getRecognitionOf(nodeA) || 0;
    return Math.min(aRecognizesB, bRecognizesA);
  }
  
  /**
   * Helper: Get total mutual recognition for a node
   */
  function getTotalMutualRecognition(node) {
    let total = 0;
    for (const otherNode of node.getRecognizedNodes()) {
      total += getMutualRecognition(node, otherNode);
    }
    return total;
  }

  /*
// Example usage
const transitiveAccess = calculateTransitiveShare(youNode, themNode);
console.log(`You have ${transitiveAccess * 100}% access to their capacity`);

// If they declare 20 units available:
const availableUnits = 20;
const yourEntitlement = transitiveAccess * availableUnits;
console.log(`You can draw down up to ${yourEntitlement} units`);
  */