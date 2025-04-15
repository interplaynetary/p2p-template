import { TreeNode } from './TreeNode';
import { GunSubscription } from '../gun/GunSubscription';
import { SubscriptionCleanup } from '../gun/gunSetup';

/**
 * Interface for a cache entry storing calculation results with timestamps
 */
export interface CacheEntry<T> {
  timestamp: number;
  value: T;
}

/**
 * A class to handle social distribution calculations and related operations
 * This extracts the social distribution logic from TreeNode to make it more modular
 */
export class SocialDistribution {
  private _calculationCache: Map<string, CacheEntry<any>> = new Map();
  private _socialDistributionSubscriptions: Map<string, SubscriptionCleanup> = new Map();
  private _socialDistributionUpdateTimeout: any = null;
  private _lastSocialDistributionUpdate: number = 0;
  private _socialDistributionUpdateCooldown: number = 3000; // 3 second cooldown
  
  /**
   * Create a new SocialDistribution instance
   * @param rootNode The TreeNode to calculate distributions for
   */
  constructor(private rootNode: TreeNode) {}

  /**
   * Get social distribution with optional custom depth
   * @param depth Maximum traversal depth (default: 5)
   * @returns Map of node IDs to their normalized social share values
   */
  public getSocialDistribution(depth: number = 5): Map<string, number> {
    // Create a cache key for this calculation
    const cacheKey = `socialDist_${this.rootNode.id}_${depth}`;
    
    // Check if we have a recent cached value
    const cached = this._calculationCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && now - cached.timestamp < 3000) {
      // Use cached value if less than 3 seconds old
      return cached.value;
    }
    
    // Calculate new social distribution with the specified depth
    const resultDistribution = this.calculateSocialDistribution(depth);
    
    // Cache the result
    this._calculationCache.set(cacheKey, {
      timestamp: now,
      value: resultDistribution
    });
    
    // Set up subscriptions if root node
    if (this.rootNode.isRoot && this._socialDistributionSubscriptions.size === 0) {
      this.setupSocialDistributionSubscriptions();
    }
    
    return resultDistribution;
  }
  
  /**
   * Calculate social distribution and update cache
   * @param maxDepth Maximum traversal depth (default: 5)
   * @returns Map of node IDs to their normalized social share values
   */
  public calculateSocialDistribution(maxDepth: number = 5): Map<string, number> {
    const resultDistribution = new Map<string, number>();
    const now = Date.now();
    
    // Run network traversal to build distribution
    this.traverseDistributionNetwork(resultDistribution, maxDepth);
    
    // If no results, use local calculation
    if (resultDistribution.size === 0) {
      console.log(`[${this.rootNode.name}] No p2p distribution data found, calculating locally`);
      
      // Direct connections from mutual fulfillment
      const myDistribution = this.rootNode.mutualFulfillmentDistribution;
      for (const [nodeId, proportion] of myDistribution.entries()) {
        if (proportion < 0.0001) continue;
        resultDistribution.set(nodeId, proportion);
      }
    }
    
    // Normalize
    const total = Array.from(resultDistribution.values()).reduce((sum, val) => sum + val, 0);
    if (total > 0) {
      for (const [key, value] of resultDistribution.entries()) {
        resultDistribution.set(key, value / total);
      }
    }
    
    // Cache the result
    this._calculationCache.set(`socialDist_${this.rootNode.id}_${maxDepth}`, {
      timestamp: now,
      value: resultDistribution
    });
    
    // Set up subscriptions if root node
    if (this.rootNode.isRoot && this._socialDistributionSubscriptions.size === 0) {
      this.setupSocialDistributionSubscriptions();
    }
    
    return resultDistribution;
  }
  
  /**
   * Traverse the p2p network to build the social distribution
   * Uses a BFS approach to explore mutual fulfillment distributions
   * @param result Map to accumulate social distribution
   * @param maxDepth Maximum traversal depth (default: 5)
   */
  public traverseDistributionNetwork(result: Map<string, number>, maxDepth: number = 5): void {
    // Track visited nodes to prevent cycles
    const visited = new Set<string>([this.rootNode.id]);
    
    // Queue for BFS traversal
    const queue: Array<{node: TreeNode, pathMultiplier: number}> = [];
    
    // Start with this node's mutual distribution
    const myDistribution = this.rootNode.mutualFulfillmentDistribution;
    
    // Initialize with direct connections
    for (const [nodeId, proportion] of myDistribution.entries()) {
      // Skip if proportion is effectively zero
      if (proportion < 0.0001) continue;
      
      // Add the direct contribution to result
      result.set(nodeId, proportion);
      
      // Get the node instance
      const nextNode = TreeNode.getNodeById(nodeId);
      if (!nextNode) continue;
      
      // Add to queue for further traversal
      queue.push({
        node: nextNode,
        pathMultiplier: proportion
      });
      
      // Mark as visited
      visited.add(nodeId);
    }
    
    // Use BFS to explore the network up to maxDepth levels deep
    let currentLevel = 0;
    
    while (queue.length > 0 && currentLevel < maxDepth) {
      const levelSize = queue.length;
      
      // Process all nodes at current level
      for (let i = 0; i < levelSize; i++) {
        const { node, pathMultiplier } = queue.shift()!;
        
        // Get the node's mutual distribution 
        // Either from cache or directly calculate it
        let nextDistribution: Map<string, number>;
        const cached = this._calculationCache.get(`mutualDist_${node.id}`);
        if (cached) {
          nextDistribution = cached.value;
        } else {
          nextDistribution = node.mutualFulfillmentDistribution;
          this._calculationCache.set(`mutualDist_${node.id}`, {
            timestamp: Date.now(),
            value: nextDistribution
          });
        }
        
        // Process each entry in the next distribution
        for (const [nextNodeId, nextProportion] of nextDistribution.entries()) {
          // Skip if already visited or proportion is too small
          if (visited.has(nextNodeId) || nextProportion < 0.0001) continue;
          
          // Calculate transitive value
          const transitiveValue = pathMultiplier * nextProportion;
          
          // Add to result (accumulate if already exists)
          const currentValue = result.get(nextNodeId) || 0;
          result.set(nextNodeId, currentValue + transitiveValue);
          
          // Get the next node
          const nextNextNode = TreeNode.getNodeById(nextNodeId);
          if (!nextNextNode) continue;
          
          // Add to queue for next level
          queue.push({
            node: nextNextNode,
            pathMultiplier: transitiveValue
          });
          
          // Mark as visited
          visited.add(nextNodeId);
        }
      }
      
      // Move to next level
      currentLevel++;
    }
    
    console.log(`[${this.rootNode.name}] P2P traversal found ${result.size} connections across ${currentLevel} levels`);
  }
  
  /**
   * Schedule an update to social distribution with debouncing
   */
  public scheduleSocialDistributionUpdate(): void {
    // Skip if already scheduled
    if (this._socialDistributionUpdateTimeout) return;
    
    // Skip if in cooldown period
    const now = Date.now();
    if (now - this._lastSocialDistributionUpdate < this._socialDistributionUpdateCooldown) {
      console.log(`[${this.rootNode.name}] Skipping social distribution update - in cooldown period`);
      return;
    }
    
    console.log(`[${this.rootNode.name}] Scheduling social distribution update`);
    
    // Set up debounce timeout
    this._socialDistributionUpdateTimeout = setTimeout(() => {
      this._socialDistributionUpdateTimeout = null;
      this._lastSocialDistributionUpdate = Date.now();
      
      // Update social distribution
      const distribution = this.calculateSocialDistribution();
      
      // Save to Gun database via the TreeNode
      const distributionObj = Object.fromEntries(distribution);
      this.rootNode.saveSocialDistribution(distributionObj);
      
      // Let any interested parties know we've updated
      this.onDistributionUpdated(distribution);
    }, 1000);
  }
  
  /**
   * Set up subscriptions to mutual fulfillment distributions from nodes in our network
   */
  public setupSocialDistributionSubscriptions(): void {
    // Only run on root nodes
    if (!this.rootNode.isRoot) return;
    
    // First get our own mutual distribution
    const myDistribution = this.rootNode.mutualFulfillmentDistribution;
    
    // Clean up existing subscriptions
    this._socialDistributionSubscriptions.forEach(cleanup => cleanup());
    this._socialDistributionSubscriptions.clear();
    
    // Subscribe to our own mutual distribution changes
    const selfSub = new GunSubscription<any>([
      ...this.rootNode.getGunPath(), 
      'mutualFulfillmentDistribution'
    ]);
    
    const selfCleanup = selfSub.on(() => {
      // When our own distribution changes, update social distribution
      this.scheduleSocialDistributionUpdate();
    });
    
    this._socialDistributionSubscriptions.set(this.rootNode.id, selfCleanup);
    
    // Subscribe to first-level connections' mutual distributions
    for (const [nodeId, proportion] of myDistribution.entries()) {
      // Skip if proportion is too small
      if (proportion < 0.001) continue;
      
      // Get the node
      const node = TreeNode.getNodeById(nodeId);
      if (!node) continue;
      
      // Subscribe to this node's mutual distribution
      const sub = new GunSubscription<any>([
        ...node.getGunPath(), 
        'mutualFulfillmentDistribution'
      ]);
      
      const cleanup = sub.on(() => {
        // When a connection's distribution changes, update our social distribution
        this.scheduleSocialDistributionUpdate();
      });
      
      this._socialDistributionSubscriptions.set(nodeId, cleanup);
    }
    
    console.log(`[${this.rootNode.name}] Set up ${this._socialDistributionSubscriptions.size} social distribution subscriptions`);
  }
  
  /**
   * Event callback when distribution is updated
   * Override this method to handle distribution updates
   */
  protected onDistributionUpdated(distribution: Map<string, number>): void {
    // Default implementation does nothing
    // Subclasses can override to handle updates
  }

  /**
   * Clean up all subscriptions
   */
  public cleanup(): void {
    // Clear any pending timeouts
    if (this._socialDistributionUpdateTimeout) {
      clearTimeout(this._socialDistributionUpdateTimeout);
      this._socialDistributionUpdateTimeout = null;
    }
    
    // Unsubscribe from all subscriptions
    this._socialDistributionSubscriptions.forEach(cleanup => cleanup());
    this._socialDistributionSubscriptions.clear();
    
    // Clear cache
    this._calculationCache.clear();
  }
}
