import { 
  // Core Gun operations - re-export these directly
  node,
  getNode,
  subscribe as gunSubscribe,
  addChild,
  addType, 
  removeChild,
  removeType,
  findNodes, 
  getChildren,
  
  // Cache access
  soulToNodeRef,
  nameToSoul,
  nodeCache,
  
  // Cache invalidation registration
  registerCacheClearer,
  
  // Helper functions
  getSoul
} from './graph';

// Import the soul type
import type { GunSoul, NodeName } from './graph';

// Create memoization caches for expensive calculations
const rootCache = new Map<GunSoul, GunSoul>();
const weightCache = new Map<GunSoul, number>();
const fulfilledCache = new Map<GunSoul, number>();
const typeInstancesCache = new Map<GunSoul, Map<GunSoul, Set<GunSoul>>>();

// Helper to clear caches when data changes
function clearCalculationCaches() {
  rootCache.clear();
  weightCache.clear();
  fulfilledCache.clear();
  typeInstancesCache.clear();
  console.log('[calculations] Cleared calculation caches');
}

// Register our cache clearing function with graph.ts
registerCacheClearer(clearCalculationCaches);

/**
 * Subscribe to a node with enhanced properties
 * This uses recGun's subscribe internally but enriches the returned data
 */
function subscribe(identifier: GunSoul | NodeName, callback?: (node: any) => void) {
  // Resolve the identifier to a soul if it's a name
  let nodeSoul: GunSoul | undefined;
  
  if (typeof identifier === 'string' && identifier.includes('~')) {
    nodeSoul = identifier as GunSoul;
  } else {
    nodeSoul = nameToSoul.get(identifier as NodeName);
  }

  if (!nodeSoul) {
    console.log(`[calculations] Subscribing to node by name: ${identifier}`);
  } else {
    console.log(`[calculations] Subscribing to node by soul: ${nodeSoul}`);
  }
  
  if (callback) {
    return gunSubscribe(identifier, (node) => {
      if (!node) return;
      
      // Get the soul from the node
      let soul: GunSoul;
      if (node.soul) {
        soul = node.soul;
      } else {
        // If no soul on the node, get it from the nodeRef
        const nodeRef = getNode(identifier);
        const nodeSoul = getSoul(nodeRef);
        if (!nodeSoul) {
          console.error(`[calculations] Cannot get soul for node: ${identifier}`);
          return;
        }
        soul = nodeSoul;
      }
      
      // Clear caches when data changes
      clearCalculationCaches();
      
      // Add calculated properties to the node data before passing to callback
      const enrichedNode = getNodeWithCalculatedProps(soul);
      callback(enrichedNode);
    });
  } else {
    // Pass an empty callback to satisfy the function signature
    return gunSubscribe(identifier, () => {});
  }
}

/**
 * Get a node with all calculated properties
 * This is the key function that enriches node data with all calculated values
 */
function getNodeWithCalculatedProps(nodeSoul: GunSoul) {
  const node = nodeCache.get(nodeSoul);
  if (!node) return null;
  
  const rootSoul = getRoot(nodeSoul);
  
  return {
    ...node,
    id: nodeSoul, // Ensure ID is available
    soul: nodeSoul, // Make sure soul is accessible
    root: rootSoul,
    isContributor: isContributor(nodeSoul),
    isContribution: isContribution(nodeSoul),
    totalChildPoints: getTotalChildPoints(nodeSoul),
    weight: getWeight(nodeSoul),
    shareOfParent: getShareOfParent(nodeSoul),
    hasDirectContributionChild: hasDirectContributionChild(nodeSoul),
    hasNonContributionChild: hasNonContributionChild(nodeSoul),
    contributionChildrenWeight: getContributionChildrenWeight(nodeSoul),
    fulfilled: getFulfilled(nodeSoul),
    desire: getDesire(nodeSoul),
    fulfillmentWeight: getFulfillmentWeight(nodeSoul),
    typeInstances: getTypeInstances(nodeSoul, rootSoul),
    // D3 compatibility properties
    value: node.points,
    hasChildren: node.children ? node.children.size > 0 : false,
    childrenArray: node.children 
      ? Array.from(node.children.keys())
          .map(childSoul => getNodeWithCalculatedProps(childSoul as GunSoul))
          .filter(Boolean)
      : []
  };
}

// Calculation functions
function getRoot(nodeSoul: GunSoul): GunSoul {
  // Check cache first
  if (rootCache.has(nodeSoul)) {
    return rootCache.get(nodeSoul)!;
  }
  
  const node = nodeCache.get(nodeSoul);
  if (!node) return nodeSoul;
  
  const result = node.parent ? getRoot(node.parent) : nodeSoul;
  
  // Cache the result
  rootCache.set(nodeSoul, result);
  return result;
}

function isContributor(nodeSoul: GunSoul): boolean {
  const node = nodeCache.get(nodeSoul);
  return node ? !node.parent : false;
}

function isContribution(nodeSoul: GunSoul): boolean {
  const node = nodeCache.get(nodeSoul);
  if (!node || !node.types || node.types.size === 0) return false;
  
  return Array.from(node.types).some(typeSoul => isContributor(typeSoul as GunSoul));
}

function getTotalChildPoints(nodeSoul: GunSoul): number {
  const node = nodeCache.get(nodeSoul);
  if (!node || !node.children) return 0;
  
  let sum = 0;
  for (const [childSoul, _] of node.children) {
    const child = nodeCache.get(childSoul);
    if (child && typeof child.points === 'number') sum += child.points;
  }
  
  return sum;
}

function getWeight(nodeSoul: GunSoul): number {
  // Check cache first
  if (weightCache.has(nodeSoul)) {
    return weightCache.get(nodeSoul)!;
  }
  
  const node = nodeCache.get(nodeSoul);
  if (!node) return 0;
  if (!node.parent) return 1;
  
  const totalChildPoints = getTotalChildPoints(node.parent);
  if (totalChildPoints === 0) return 0;
  
  const parentWeight = getWeight(node.parent);
  const result = (node.points / totalChildPoints) * parentWeight;
  
  // Cache the result
  weightCache.set(nodeSoul, result);
  return result;
}

function getShareOfParent(nodeSoul: GunSoul): number {
  const node = nodeCache.get(nodeSoul);
  if (!node || !node.parent) return 1;
  
  const totalChildPoints = getTotalChildPoints(node.parent);
  if (totalChildPoints === 0) return 0;
  
  return node.points / totalChildPoints;
}

function hasDirectContributionChild(nodeSoul: GunSoul): boolean {
  const node = nodeCache.get(nodeSoul);
  if (!node || !node.children) return false;
  
  for (const [childSoul, _] of node.children) {
    if (isContribution(childSoul)) return true;
  }
  
  return false;
}

function hasNonContributionChild(nodeSoul: GunSoul): boolean {
  const node = nodeCache.get(nodeSoul);
  if (!node || !node.children) return false;
  
  for (const [childSoul, _] of node.children) {
    if (!isContribution(childSoul)) return true;
  }
  
  return false;
}

function getContributionChildrenWeight(nodeSoul: GunSoul): number {
  const node = nodeCache.get(nodeSoul);
  if (!node || !node.children) return 0;
  
  let contributionPoints = 0;
  for (const [childSoul, _] of node.children) {
    const child = nodeCache.get(childSoul);
    if (child && isContribution(childSoul)) {
      contributionPoints += child.points;
    }
  }
  
  const totalPoints = getTotalChildPoints(nodeSoul);
  return totalPoints === 0 ? 0 : contributionPoints / totalPoints;
}

function getContributionChildrenFulfillment(nodeSoul: GunSoul): number {
  const node = nodeCache.get(nodeSoul);
  if (!node || !node.children) return 0;
  
  let fulfillment = 0;
  for (const [childSoul, _] of node.children) {
    if (isContribution(childSoul)) {
      fulfillment += getFulfilled(childSoul) * getShareOfParent(childSoul);
    }
  }
  
  return fulfillment;
}

function getNonContributionChildrenFulfillment(nodeSoul: GunSoul): number {
  const node = nodeCache.get(nodeSoul);
  if (!node || !node.children) return 0;
  
  let fulfillment = 0;
  for (const [childSoul, _] of node.children) {
    if (!isContribution(childSoul)) {
      fulfillment += getFulfilled(childSoul) * getShareOfParent(childSoul);
    }
  }
  
  return fulfillment;
}

// Complex fulfillment calculation
function getFulfilled(nodeSoul: GunSoul): number {
  // Check cache first
  if (fulfilledCache.has(nodeSoul)) {
    return fulfilledCache.get(nodeSoul)!;
  }
  
  const node = nodeCache.get(nodeSoul);
  if (!node) return 0;
  
  let result = 0;
  
  // For leaf nodes (no children)
  if (!node.children || node.children.size === 0) {
    result = isContribution(nodeSoul) ? 1 : 0;
  }
  // If fulfillment was manually set and node has contributor children
  else if (node.manualFulfillment !== null && hasDirectContributionChild(nodeSoul)) {
    // If we only have contributor children, return manual fulfillment
    if (!hasNonContributionChild(nodeSoul)) {
      result = node.manualFulfillment;
    } else {
      // For hybrid case: combine manual fulfillment for contributor children
      // with calculated fulfillment for non-contributor children
      const contributionWeight = getContributionChildrenWeight(nodeSoul);
      const nonContribFulfillment = getNonContributionChildrenFulfillment(nodeSoul);
      
      result = (
        node.manualFulfillment * contributionWeight +
        nonContribFulfillment * (1 - contributionWeight)
      );
    }
  }
  // Default case: calculate from all children
  else {
    let fulfilled = 0;
    for (const [childSoul, _] of node.children) {
      fulfilled += getFulfilled(childSoul) * getShareOfParent(childSoul);
    }
    result = fulfilled;
  }
  
  // Cache the result
  fulfilledCache.set(nodeSoul, result);
  return result;
}

function getDesire(nodeSoul: GunSoul): number {
  return 1 - getFulfilled(nodeSoul);
}

function getFulfillmentWeight(nodeSoul: GunSoul): number {
  return getFulfilled(nodeSoul) * getWeight(nodeSoul);
}

// Type index functions
function getInstances(typeSoul: GunSoul, rootSoul?: GunSoul): Set<GunSoul> {
  if (rootSoul) {
    const typeIndex = getTypeInstances(typeSoul, rootSoul);
    return typeIndex.get(typeSoul) || new Set<GunSoul>();
  }
  
  // If no rootSoul provided, use the original implementation
  const instances = new Set<GunSoul>();
  
  // Scan the cache for nodes that have this type
  for (const [nodeSoul, node] of nodeCache.entries()) {
    if (node.types && node.types.has(typeSoul)) {
      instances.add(nodeSoul as GunSoul);
    }
  }
  
  return instances;
}

function getShareOfGeneralFulfillment(fromNodeSoul: GunSoul, toTypeSoul: GunSoul): number {
  // Get the root of the fromNode to consider only instances in the same tree
  const rootSoul = getRoot(fromNodeSoul);
  
  // Get instances that belong to the same tree as fromNodeSoul
  const instances = getInstances(toTypeSoul, rootSoul);
  let sum = 0;
  
  for (const instanceSoul of instances) {
    const node = nodeCache.get(instanceSoul);
    if (!node || !node.types) continue;
    
    const contributorTypesCount = Array.from(node.types)
      .filter(typeSoul => isContributor(typeSoul as GunSoul))
      .length;
    
    const fulfillmentWeight = getFulfilled(instanceSoul) * getWeight(instanceSoul);
    
    const weightShare = contributorTypesCount > 0
      ? fulfillmentWeight / contributorTypesCount
      : fulfillmentWeight;
    
    sum += weightShare;
  }
  
  return sum;
}

function getMutualFulfillment(nodeSoul1: GunSoul, nodeSoul2: GunSoul): number {
  // We need to explicitly pass the root context to ensure consistency
  const rootSoul = getRoot(nodeSoul1);
  
  const recognitionFromHere = getShareOfGeneralFulfillment(nodeSoul1, nodeSoul2);
  const recognitionFromThere = getShareOfGeneralFulfillment(nodeSoul2, nodeSoul1);
  return Math.min(recognitionFromHere, recognitionFromThere);
}

function getMutualFulfillmentDistribution(nodeSoul: GunSoul): Map<GunSoul, number> {
  const rootSoul = getRoot(nodeSoul);
  
  // Get all type instances for this tree - this is now more efficient
  const typeIndex = getTypeInstances(nodeSoul, rootSoul);
  
  // Filter to types that have instances
  const typesWithInstances = Array.from(typeIndex.keys())
    .filter(typeSoul => (typeIndex.get(typeSoul)?.size || 0) > 0);
  
  // Pre-calculate mutual fulfillment values to avoid redundant calculations
  const mutualFulfillments = typesWithInstances.map(typeSoul => ({
    typeSoul,
    value: getMutualFulfillment(nodeSoul, typeSoul)
  })).filter(entry => entry.value > 0);
  
  // Calculate total
  const total = mutualFulfillments.reduce((sum, entry) => sum + entry.value, 0);
  
  // Create normalized distribution
  return new Map(
    mutualFulfillments.map(entry => [
      entry.typeSoul,
      total > 0 ? entry.value / total : 0
    ])
  );
}

// Helper function for visualization
function getNodeForVisualization(nodeSoul: GunSoul) {
  return getNodeWithCalculatedProps(nodeSoul);
}

// Helper functions for traversal
function getDescendants(nodeSoul: GunSoul): GunSoul[] {
  const result: GunSoul[] = [];
  const stack: GunSoul[] = [nodeSoul];
  
  while (stack.length) {
    const currentSoul = stack.pop()!;
    result.push(currentSoul);
    
    const node = nodeCache.get(currentSoul);
    if (node && node.children) {
      stack.push(...Array.from(node.children.keys()).map(key => key as GunSoul));
    }
  }
  
  return result;
}

function getAncestors(nodeSoul: GunSoul): GunSoul[] {
  const result: GunSoul[] = [];
  let currentSoul: GunSoul | null = nodeSoul;
  
  while (currentSoul) {
    result.push(currentSoul);
    
    const node = nodeCache.get(currentSoul);
    if (!node || !node.parent) break;
    
    currentSoul = node.parent as GunSoul;
  }
  
  return result;
}

/**
 * Returns a mapping of types to their instances for a specific tree
 * This replaces the typeIndex functionality from TreeNode
 */
function getTypeInstances(nodeSoul: GunSoul, rootSoul: GunSoul = ''): Map<GunSoul, Set<GunSoul>> {
  // Ensure we have a root ID
  if (!rootSoul) {
    rootSoul = getRoot(nodeSoul);
  }
  
  // Check cache first - we cache by root ID for efficiency
  const cacheKey = rootSoul;
  if (typeInstancesCache.has(cacheKey)) {
    return typeInstancesCache.get(cacheKey)!;
  }
  
  const typeIndex = new Map<GunSoul, Set<GunSoul>>();
  const nodesInTree = new Set<GunSoul>();
  
  // First identify all nodes in this tree to avoid repeated root calculations
  for (const [id, node] of nodeCache.entries()) {
    const nodeRootSoul = getRoot(id as GunSoul);
    if (nodeRootSoul === rootSoul) {
      nodesInTree.add(id as GunSoul);
    }
  }
  
  // Then build the type index for these nodes
  for (const id of nodesInTree) {
    const node = nodeCache.get(id);
    if (!node || !node.types || node.types.size === 0) continue;
    
    for (const typeSoul of node.types) {
      if (!typeIndex.has(typeSoul as GunSoul)) {
        typeIndex.set(typeSoul as GunSoul, new Set<GunSoul>());
      }
      typeIndex.get(typeSoul as GunSoul)?.add(id);
    }
  }
  
  // Cache the result
  typeInstancesCache.set(cacheKey, typeIndex);
  return typeIndex;
}

/**
 * Process a batch of nodes efficiently by avoiding redundant calculations
 * This is useful for operations that need to process many nodes at once
 */
function processBatch<T>(nodeSouls: GunSoul[], processFn: (nodeSoul: GunSoul) => T): T[] {
  // Pre-populate caches for all nodes in the batch
  const rootSouls = new Set<GunSoul>();
  
  // First get all roots (most efficient calculation to do upfront)
  for (const nodeSoul of nodeSouls) {
    rootSouls.add(getRoot(nodeSoul));
  }
  
  // Prepare type instances for each root (for more efficient type operations)
  for (const rootSoul of rootSouls) {
    getTypeInstances('', rootSoul); // Cache the type instances for this root
  }
  
  // Now process each node with pre-warmed caches
  return nodeSouls.map(processFn);
}

// Export everything consistently
export {
  // Core Gun operations from recGun
  node, 
  getNode,
  addChild,
  addType,
  removeChild,
  removeType,
  findNodes,
  getChildren,
  
  // Enhanced versions
  subscribe,

  // Calculation functions
  getRoot,
  isContributor,
  isContribution,
  getTotalChildPoints,
  getWeight,
  getShareOfParent,
  hasDirectContributionChild,
  hasNonContributionChild,
  getContributionChildrenWeight,
  getContributionChildrenFulfillment,
  getNonContributionChildrenFulfillment,
  getFulfilled,
  getDesire,
  getFulfillmentWeight,
  
  // Type index functions
  getInstances,
  getTypeInstances,
  getShareOfGeneralFulfillment,
  getMutualFulfillment,
  getMutualFulfillmentDistribution,
  
  // Traversal helpers
  getDescendants,
  getAncestors,
  
  // D3 compatibility
  getNodeForVisualization,
  
  // Performance utilities
  processBatch,
  clearCalculationCaches,
  
  // Direct cache access (for debugging)
  soulToNodeRef,
  nameToSoul,
  nodeCache
};




