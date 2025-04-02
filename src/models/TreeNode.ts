import { App } from '../App';
import { GunNode } from './GunNode';
import { GunSubscription, SubscriptionCleanup, SubscriptionHandler } from './GunSubscription';
import { gun } from './Gun';


// We added normalization to ensure that the shares of recognition sum to 1
// now we need to ensure that the other has not tampered with their _sharesOfOthersRecognition
// Because it is on this basis that we calculate mutual-recognition

// Or is it actually ok? Since we would only be lying to ourselves?
// And this lie is itself normalized within ourselves in the mutuality distribution?

// Define the core data structure of a TreeNode
export interface TreeNodeData {
  id: string;
  name: string;
  points: number;
  manualFulfillment: number | null;
  parent?: string;
}

// calculateSharesOfGeneralFulfillment is called on time-interval

/**
 * Reactive TreeNode implementation following Gun.js best practices
 * Embraces the reactive nature of Gun by treating all data as streams
 */
export class TreeNode extends GunNode<TreeNodeData> {
  // Local state derived from Gun data
  private _id: string;
  private _name: string = '';
  private _points: number = 0;
  private _parent: TreeNode | null = null;
  private _manualFulfillment: number | null = null;
  private _children: Map<string, TreeNode> = new Map();
  private _types: Set<string> = new Set();
  private _recognitionSubscriptions: Map<string, () => void> = new Map();
  private _sharesOfOthersRecognition: {[key: string]: number} = {};
  
  // Subscriptions for cleanup
  private _parentSubscription: SubscriptionCleanup | null = null;
  private _childrenSubscription: SubscriptionCleanup | null = null;
  private _typesSubscription: SubscriptionCleanup | null = null;
  
  // Reference to App
  private _app: App;
  
  // Static registry for nodes to avoid duplicates
  private static _registry: Map<string, TreeNode> = new Map();
  
  // Add at class level
  private _sharesCalculationScheduled: boolean = false;
  private _lastSharesCalculation: number = 0;
  private _cachedShares: {[key: string]: number} | null = null;
  
  /**
   * Create a new TreeNode or get an existing one from registry
   * @param id Node ID
   * @param app App instance
   * @returns TreeNode instance
   */
  public static getNode(id: string, app: App): TreeNode {
    // Check if node already exists in registry
    if (TreeNode._registry.has(id)) {
      return TreeNode._registry.get(id)!;
    }
    
    // Create a new node
    const node = new TreeNode(id, app);
    TreeNode._registry.set(id, node);
    return node;
  }

  
  /**
   * Create a new node with the given name and options
   * @param name Node name
   * @param options Creation options
   * @param app App instance
   * @returns The new node
   */
  public static async create(
    name: string,
    options: {
      parent?: TreeNode,
      points?: number,
      manualFulfillment?: number,
      typeIds?: string[],
      id?: string
    } = {},
    app: App
  ): Promise<TreeNode> {
    // Generate an ID if not provided
    const id = options.id || Math.random().toString(36).substring(2, 15);
    
    // Create node data
    const nodeData: any = {
      name,
      points: options.points || 0,
      manualFulfillment: options.manualFulfillment || null
    };
    
    // Add parent reference if provided
    if (options.parent) {
      nodeData.parent = options.parent.id;
    }
    
    // Create the node in Gun
    const nodeRef = gun.get('nodes').get(id);
    await new Promise<void>((resolve) => {
      nodeRef.put(nodeData, () => resolve());
    });
    
    // Add types if provided
    if (options.typeIds && options.typeIds.length > 0) {
      const typesRef = nodeRef.get('types');
      for (const typeId of options.typeIds) {
        await new Promise<void>((resolve) => {
          typesRef.get(typeId).put({ value: true }, () => resolve());
        });
      }
    }
    
    // Add as child to parent
    if (options.parent) {
      // Get the children node using the parent's path
      const childrenNode = options.parent.get('children');
      await childrenNode.get(id).put({ value: true } as any);
    }
    
    // Get the node from registry
    return TreeNode.getNode(id, app);
  }
  
  /**
   * Private constructor - use static methods to get instances
   * @param id Node ID
   * @param app App instance 
   */
  private constructor(id: string, app: App) {
    super(['nodes', id]);
    this._id = id;
    this._app = app;
    
    // Set up data subscriptions
    this.setupSubscriptions();
  }

    // Helper property
    private get isRoot(): boolean {
      return !this._parent;
    }
  
  
  /**
   * Set up all reactive subscriptions to Gun data
   */
  private setupSubscriptions(): void {
    // console.log(`[TreeNode ${this._id}] Setting up subscriptions`);
    
    // Subscribe to node data changes
    this.on((data) => {
      // console.log(`[TreeNode ${this._id}] Received data update:`, data);
      let updated = false;
      
      // Track if we need to recalculate shares
      let needsSharesRecalculation = false;
      
      if (data.name !== undefined && data.name !== this._name) {
        this._name = data.name || '';
        updated = true;
      }
      
      if (data.points !== undefined && data.points !== this._points) {
        this._points = data.points || 0;
        updated = true;
        needsSharesRecalculation = true;  // Points affect weights
      }
      
      if (data.manualFulfillment !== undefined && data.manualFulfillment !== this._manualFulfillment) {
        this._manualFulfillment = data.manualFulfillment;
        updated = true;
        needsSharesRecalculation = true;  // Fulfillment affects recognition
      }
      
      if (data.parent !== undefined) {
        if ((data.parent && (!this._parent || this._parent.id !== data.parent)) ||
            (!data.parent && this._parent)) {
          this.updateParent(data.parent || null);
          updated = true;
          needsSharesRecalculation = true;  // Parent affects weights
        }
      }
      
      // Schedule shares recalculation if needed
      if (needsSharesRecalculation && this.isRoot) {
        this.scheduleSharesCalculation();
      }
      
      if (updated) {
        this._app.updateNeeded = true;
        this._app.pieUpdateNeeded = true;
      }
    });
    
    // Subscribe to children
    this.subscribeToChildren();
    
    // Subscribe to types
    this.subscribeToTypes();
    
    // Only set up recognition subscriptions if we're the root node
    if (!this._parent) {
      this.setupRecognitionSubscriptions();

      // Re-setup recognition when types change anywhere in the tree
      this.get('types').on(() => {
        if (this.isRoot) {
          this.scheduleSharesCalculation();
        }
      });

      // Re-setup recognition when children change anywhere in the tree
      this.get('children').on(() => {
        if (this.isRoot) {
          this.scheduleSharesCalculation();
        }
      });
    }
  }

  private scheduleSharesCalculation() {
    if (this._sharesCalculationScheduled) return;
    this._sharesCalculationScheduled = true;
    
    // Use setTimeout instead of requestAnimationFrame since this is Node-compatible
    setTimeout(() => {
      this.calculateSharesOfGeneralFulfillment();
      this._sharesCalculationScheduled = false;
    }, 1000);  // Debounce for 1 second
  }
  
  /**
   * Update parent reference
   * @param parentId Parent node ID or null
   */
  private async updateParent(parentId: string | null): Promise<void> {
    // Clean up previous parent subscription
    if (this._parentSubscription) {
      this._parentSubscription();
      this._parentSubscription = null;
    }
    
    // Clear existing parent
    if (this._parent) {
      this._parent._children.delete(this._id);
      this._parent = null;
    }
    
    // Load new parent if provided
    if (parentId) {
      const parent = TreeNode.getNode(parentId, this._app);
      this._parent = parent;
      
      // Add this node to parent's children
      parent._children.set(this._id, this);
    }
  }
  
  /**
   * Subscribe to children collection
   */
  private subscribeToChildren(): void {
    // console.log(`[TreeNode ${this._id}] Setting up children subscription`);
    
    // Clean up existing subscription
    if (this._childrenSubscription) {
      this._childrenSubscription();
      this._childrenSubscription = null;
    }
    
    // Set up new subscription using path abstraction
    const childrenNode = this.get('children');
    
    // console.log(`[TreeNode ${this._id}] Starting children each() subscription`);
    
    // Track processed children to avoid duplicates
    const processedChildren = new Set<string>();
    
    // Create a more robust subscription using a stream pattern
    const stream = new ReadableStream({
      start: (controller) => {
        this._childrenSubscription = childrenNode.each((childData) => {
          const childId = childData._key;
          
          // Skip Gun metadata and already processed children
          if (childId === '_' || processedChildren.has(childId)) return;
          
          // console.log(`[TreeNode ${this._id}] Child data received:`, childId, childData);
          
          // If data is falsy, it means child was removed
          if (!childData || childData.value === null) {
            // console.log(`[TreeNode ${this._id}] Removing child:`, childId);
            // Remove from local collection
            if (this._children.has(childId)) {
              this._children.delete(childId);
              this._app.updateNeeded = true;
              this._app.pieUpdateNeeded = true;
            }
            processedChildren.delete(childId);
            return;
          }
          
          // Skip if we already have this child
          if (this._children.has(childId)) {
            // console.log(`[TreeNode ${this._id}] Child already in local collection:`, childId);
            processedChildren.add(childId);
            return;
          }
          
          // Load the child node
          // console.log(`[TreeNode ${this._id}] Creating child node:`, childId);
          const childNode = TreeNode.getNode(childId, this._app);
          this._children.set(childId, childNode);
          
          // Ensure parent reference is correct
          childNode.parent = this;
          
          // Mark as processed
          processedChildren.add(childId);
          
          // Request UI updates
          // console.log(`[TreeNode ${this._id}] Child added, requesting UI update`);
          this._app.updateNeeded = true;
          this._app.pieUpdateNeeded = true;
          
          // Emit to stream
          controller.enqueue(childNode);
        });
      },
      cancel: () => {
        // Clean up subscription when stream is cancelled
        if (this._childrenSubscription) {
          this._childrenSubscription();
          this._childrenSubscription = null;
        }
      }
    });
    
    // Store the stream reader for cleanup
    const reader = stream.getReader();
    
    // Process the stream
    const processStream = async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          // Process child node if needed
        }
      } catch (err) {
        console.error(`Error processing children stream for node ${this._id}:`, err);
      }
    };
    
    processStream();
  }
  
  /**
   * Subscribe to types collection
   */
  private subscribeToTypes(): void {
    // Clean up existing subscription
    if (this._typesSubscription) {
      this._typesSubscription();
      this._typesSubscription = null;
    }
    
    // Set up new subscription using path abstraction
    const typesNode = this.get('types');
    
    // Track processed types to avoid duplicates
    const processedTypes = new Set<string>();
    
    // Create a stream for types
    const stream = new ReadableStream({
      start: (controller) => {
        this._typesSubscription = typesNode.each((typeData) => {
          const typeId = typeData._key;
          
          // Skip Gun metadata and already processed types
          if (typeId === '_' || processedTypes.has(typeId)) return;
          
          // If data is falsy, it means type was removed
          if (!typeData) {
            // Remove from local collection
            if (this._types.has(typeId)) {
              this._types.delete(typeId);
              
              // Update type index
              const root = this.root;
              root.removeFromTypeIndex(typeId, this._id);
              
              this._app.updateNeeded = true;
              this._app.pieUpdateNeeded = true;
            }
            processedTypes.delete(typeId);
            return;
          }
          
          // Skip if we already have this type
          if (this._types.has(typeId)) {
            processedTypes.add(typeId);
            return;
          }
          
          // Add to local collection
          this._types.add(typeId);
          processedTypes.add(typeId);
          
          // Update type index
          const root = this.root;
          root.addToTypeIndex(typeId, this._id);
          
          // Request UI updates
          this._app.updateNeeded = true;
          this._app.pieUpdateNeeded = true;
          
          // Emit to stream
          controller.enqueue(typeId);
        });
      },
      cancel: () => {
        // Clean up subscription when stream is cancelled
        if (this._typesSubscription) {
          this._typesSubscription();
          this._typesSubscription = null;
        }
      }
    });
    
    // Store the stream reader for cleanup
    const reader = stream.getReader();
    
    // Process the stream
    const processStream = async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          // Process type if needed
          this.setupRecognitionSubscriptions();
        }
      } catch (err) {
        console.error(`Error processing types stream for node ${this._id}:`, err);
      }
    };
    
    processStream();
  }
  
  /**
   * Set up subscriptions to recognition data from other nodes
   * Only called on root node
   */
  private setupRecognitionSubscriptions(): void {
    if (this._parent) {
      console.warn('setupRecognitionSubscriptions called on non-root node');
      return;
    }

    // Get all types that appear in our tree
    const relevantTypes = new Set<string>();
    
    // Helper to collect types from a node and its children
    const collectTypes = (node: TreeNode) => {
      // Add this node's types
      node.types.forEach(typeId => relevantTypes.add(typeId));
      // Recurse through children
      node.children.forEach(child => collectTypes(child));
    };
    
    // Start from our root (this node)
    collectTypes(this);

    // Clean up existing subscriptions
    this._recognitionSubscriptions.forEach(cleanup => cleanup());
    this._recognitionSubscriptions.clear();
    this._sharesOfOthersRecognition = {};

    // Subscribe to sharesOfGeneralFulfillment for each type
    relevantTypes.forEach(typeId => {
      // Get the node reference for this type
      const typeNode = gun.get('nodes').get(typeId);
      
      // Subscribe to its shares and store the cleanup function
      const subscription = typeNode.get('sharesOfGeneralFulfillment').on((shares) => {
        if (!shares) return;

        // Extract valid numeric shares
        const validShares = Object.entries(shares)
          .filter(([_, value]) => typeof value === 'number')
          .map(([key, value]) => [key, value as number] as const);
        
        // Calculate sum for normalization
        const sum = validShares.reduce((acc, [_, val]) => acc + val, 0);
        
        // If we have valid shares, normalize and store our share if present
        if (sum > 0) {
          // Find our normalized share
          const ourShare = validShares.find(([key, _]) => key === this._id);
          if (ourShare) {
            this._sharesOfOthersRecognition[typeId] = ourShare[1] / sum;
              
              // Request UI updates
              this._app.updateNeeded = true;
              this._app.pieUpdateNeeded = true;
            }
          }
        });
        
      // Store cleanup function that will properly unsubscribe
      this._recognitionSubscriptions.set(typeId, () => {
        subscription.off();
      });
    });
  }
  
  // PROPERTIES
  
  /**
   * Get node ID
   */
  get id(): string {
    return this._id;
  }
  
  /**
   * Get node name
   */
  get name(): string {
    return this._name;
  }
  
  /**
   * Set node name
   */
  set name(value: string) {
    if (value !== this._name) {
      // Update in Gun first - local update will happen through the subscription
      this.put({ name: value });
      // Don't set this._name directly - let the subscription do it
    }
  }
  
  /**
   * Get parent node
   */
  get parent(): TreeNode | null {
    return this._parent;
  }
  
  /**
   * Set parent node
   */
  set parent(value: TreeNode | null) {
    if (value !== this._parent) {
      // Get old and new roots before making any changes
      const oldRoot = this.root;
      
      // Update Gun data with new parent reference - local update will happen through subscription
      this.put({ parent: value ? value.id : null });
      
      // Note: updateParent and updateTypeIndices will be triggered by the subscription
    }
  }
  
  /**
   * Get root node
   */
  get root(): TreeNode {
    return this._parent ? this._parent.root : this;
  }
  
  /**
   * Get node points
   */
  get points(): number {
    return this._points;
  }
  
  /**
   * Set node points
   */
  set points(value: number) {
    if (value !== this._points) {
      // Update in Gun first - local update will happen through the subscription
      this.put({ points: value });
      // Don't set this._points directly - let the subscription do it
      
      // The pie chart update will be handled in the subscription handler
    }
  }
  
  /**
   * Get manual fulfillment
   */
  get manualFulfillment(): number | null {
    return this._manualFulfillment;
  }
  
  /**
   * Set manual fulfillment
   */
  set manualFulfillment(value: number | null) {
    if (value !== this._manualFulfillment) {
      // Update in Gun first - local update will happen through the subscription
      this.put({ manualFulfillment: value });
      // Don't set this._manualFulfillment directly - let the subscription do it
      
      // The pie chart update will be handled in the subscription handler
    }
  }
  
  /**
   * Get all children
   */
  get children(): Map<string, TreeNode> {
    return new Map(this._children);
  }
  
  /**
   * Get all types
   */
  get types(): Set<string> {
    return new Set(this._types);
  }
  
  /**
   * Get shares of recognition from other nodes
   */
  get sharesOfOthersRecognition(): {[key: string]: number} {
    return { ...this._sharesOfOthersRecognition };
  }
  
  // TYPE METHODS
  
  /**
   * Add a type to this node
   * @param typeId Type ID to add
   * @returns This node for chaining
   */
  public addType(typeId: string): TreeNode {
    // Skip if already has type
    if (this._types.has(typeId)) return this;
    
    // Skip invalid type IDs
    if (!typeId || typeId === '#' || typeof typeId !== 'string') {
      console.warn(`[TreeNode] Ignoring invalid type ID: ${typeId}`);
      return this;
    }
    
    // Add to Gun using path abstraction
    const typesNode = this.get('types');
    typesNode.get(typeId).put({ value: true } as any);
    
    // Let the subscription handle the local update
    return this;
  }
  
  /**
   * Remove a type from this node
   * @param typeId Type ID to remove
   * @returns This node for chaining
   */
  public removeType(typeId: string): TreeNode {
    // Skip if doesn't have type
    if (!this._types.has(typeId)) return this;
    
    // Remove from Gun using path abstraction
    const typesNode = this.get('types');
    typesNode.get(typeId).put(null);
    
    // Remove locally (subscription will handle the rest)
    this._types.delete(typeId);
    
    // Update type index
    this.root.removeFromTypeIndex(typeId, this._id);
    
    // Request UI updates
    this._app.updateNeeded = true;
    this._app.pieUpdateNeeded = true;
    
    return this;
  }
  
  // CHILD METHODS
  
  /**
   * Add a child node
   * @param name Child name
   * @param points Points value
   * @param typeIds Optional array of type IDs
   * @param manualFulfillment Optional manual fulfillment value
   * @param id Optional child ID (generated if not provided)
   * @returns Promise that resolves with the new child node
   */
  public async addChild(
    name: string,
    points: number = 0,
    typeIds: string[] = [],
    manualFulfillment: number = null,
    id?: string
  ): Promise<TreeNode> {
    // Check if this node can have children
    if (this._parent && this.isContribution) {
      throw new Error(`Node ${this._name} is a contribution and cannot have children`);
    }
    
    console.log(`[TreeNode] Adding child "${name}" with points ${points} to ${this._name}`);
    
    // Create the child node
    const child = await TreeNode.create(name, {
      parent: this,
      points: points,
      manualFulfillment: manualFulfillment,
      typeIds: typeIds,
      id: id
    }, this._app);
    
    // Request UI updates
    this._app.updateNeeded = true;
    this._app.pieUpdateNeeded = true;
    
    return child;
  }
  
  /**
   * Remove a child node
   * @param childId ID of child to remove
   * @returns This node for chaining
   */
  public removeChild(childId: string): TreeNode {
    const child = this._children.get(childId);
    if (child) {
      // Remove from Gun using path abstraction
      const childrenNode = this.get('children');
      childrenNode.get(childId).put(null);
      
      // Subscription will handle the rest
    }
    
    return this;
  }
  
  // CALCULATED PROPERTIES
  
  /**
   * Check if this node is a contributor (root node)
   */
  get isContributor(): boolean {
    return !this._parent;
  }
  
  /**
   * Check if this node is a contribution (has a parent and types)
   */
  get isContribution(): boolean {
    return Boolean(this._parent && this._types.size > 0);
  }
  
  /**
   * Get total points of all children
   */
  get totalChildPoints(): number {
    return Array.from(this._children.values())
      .reduce((sum, child) => sum + child.points, 0) || 0;
  }
  
  /**
   * Get this node's weight relative to siblings and ancestors
   */
  get weight(): number {
    if (!this._parent) return 1;
    return this._parent.totalChildPoints === 0
      ? 0
      : (this._points / this._parent.totalChildPoints) * this._parent.weight;
  }
  
  /**
   * Get this node's share of its parent's points
   */
  get shareOfParent(): number {
    if (!this._parent) return 1;
    return this._parent.totalChildPoints === 0
      ? 0
      : this._points / this._parent.totalChildPoints;
  }
  
  /**
   * Check if this node has any direct contribution children
   */
  get hasDirectContributionChild(): boolean {
    return Array.from(this._children.values()).some(child => child.isContribution);
  }
  
  /**
   * Check if this node has any non-contribution children
   */
  get hasNonContributionChild(): boolean {
    return Array.from(this._children.values()).some(child => !child.isContribution);
  }
  
  /**
   * Get the weight of contribution children relative to all children
   */
  get contributionChildrenWeight(): number {
    const contributionPoints = Array.from(this._children.values())
      .filter(child => child.isContribution)
      .reduce((sum, child) => sum + child.points, 0);
    
    return contributionPoints / this.totalChildPoints;
  }
  
  /**
   * Get the contribution children's fulfillment
   */
  get contributionChildrenFulfillment(): number {
    const contributionChildren = Array.from(this._children.values())
      .filter(child => child.isContribution);
    
    return contributionChildren.reduce(
      (sum, child) => sum + child.fulfilled * child.shareOfParent,
      0
    );
  }
  
  /**
   * Get the non-contribution children's fulfillment
   */
  get nonContributionChildrenFulfillment(): number {
    const nonContributionChildren = Array.from(this._children.values())
      .filter(child => !child.isContribution);
    
    return nonContributionChildren.reduce(
      (sum, child) => sum + child.fulfilled * child.shareOfParent,
      0
    );
  }
  
  /**
   * Get this node's fulfillment value
   */
  get fulfilled(): number {
    // For leaf nodes
    if (this._children.size === 0) {
      return this.isContribution ? 1 : 0;
    }
    
    // If fulfillment was manually set and node has contributor children
    if (this._manualFulfillment !== null && this.hasDirectContributionChild) {
      // If we only have contributor children
      if (!this.hasNonContributionChild) {
        return this._manualFulfillment;
      }
      
      // For hybrid case: combine manual fulfillment for contributor children
      // with calculated fulfillment for non-contributor children
      const contributionChildrenWeight = this.contributionChildrenWeight;
      const nonContributionFulfillment = this.nonContributionChildrenFulfillment;
      
      return (
        this._manualFulfillment * contributionChildrenWeight +
        nonContributionFulfillment * (1 - contributionChildrenWeight)
      );
    }
    
    // Default case: calculate from all children
    return Array.from(this._children.values()).reduce(
      (sum, child) => sum + child.fulfilled * child.shareOfParent,
      0
    );
  }
  
  /**
   * Get this node's desire value (inverse of fulfillment)
   */
  get desire(): number {
    return 1 - this.fulfilled;
  }
  
  /**
   * Get this node's fulfillment weight
   */
  get fulfillmentWeight(): number {
    return this.fulfilled * this.weight;
  }
  
  // TYPE INDEX METHODS
  
  private _typeIndex: Map<string, Set<string>> = new Map();
  
  /**
   * Update type indices when node changes parents
   * @param oldRoot Old root node
   * @param newRoot New root node
   */
  private updateTypeIndices(oldRoot: TreeNode, newRoot: TreeNode): void {
    // Helper to process a node and its descendants
    const processNode = (node: TreeNode) => {
      // Move each type from old to new root
      node._types.forEach(typeId => {
        // Remove from old root
        oldRoot.removeFromTypeIndex(typeId, node.id);
        
        // Add to new root
        newRoot.addToTypeIndex(typeId, node.id);
      });
      
      // Process children recursively
      node._children.forEach(child => processNode(child));
    };
    
    // Start with this node
    processNode(this);
  }
  
  /**
   * Add a node to the type index
   * @param typeId Type ID
   * @param nodeId Node ID
   */
  public addToTypeIndex(typeId: string, nodeId: string): void {
    if (!this._typeIndex.has(typeId)) {
      this._typeIndex.set(typeId, new Set<string>());
    }
    this._typeIndex.get(typeId)?.add(nodeId);
  }
  
  /**
   * Remove a node from the type index
   * @param typeId Type ID
   * @param nodeId Node ID
   */
  public removeFromTypeIndex(typeId: string, nodeId: string): void {
    if (this._typeIndex.has(typeId)) {
      this._typeIndex.get(typeId)?.delete(nodeId);
    }
  }
  
  /**
   * Get all instances of a given type
   * @param typeId Type ID
   * @returns Set of node IDs that are instances of the type
   */
  public getInstances(typeId: string): Set<string> {
    return this.root._typeIndex.get(typeId) || new Set();
  }
  
  /**
   * Get all types in the system
   */
  get rootTypes(): string[] {
    return Array.from(this.root._typeIndex.keys());
  }
  
  // RECOGNITION METHODS
  
  /**
   * Calculate recognition of a specific instance
   */
  private recognitionOf(instance: TreeNode): number {
    const fulfillmentWeight = instance.fulfilled * instance.weight;
    const contributorCount = instance._types.size;
    return contributorCount > 0
      ? fulfillmentWeight / contributorCount
      : fulfillmentWeight;
  }

  /**
   * Calculate total recognition for a type
   */
  public shareOfGeneralFulfillment(typeId: string): number {
    return Array.from(this.getInstances(typeId))
      .map(id => TreeNode._registry.get(id))
      .filter((instance): instance is TreeNode => instance !== undefined)
      .reduce((sum, instance) => sum + this.recognitionOf(instance), 0);
  }

  /**
   * Calculate and normalize shares for all types
   */
  private calculateShares(): {[key: string]: number} {
    // Get all shares with their values
    const shares = Array.from(this.root._typeIndex.keys())
      .map(typeId => ({
        typeId,
        value: this.shareOfGeneralFulfillment(typeId)
      }));
    
    // Calculate total for normalization
    const total = shares.reduce((sum, { value }) => sum + value, 0);
    
    // Convert to normalized object
    return shares.reduce((obj, { typeId, value }) => ({
      ...obj,
      [typeId]: total > 0 ? value / total : 0
    }), {});
  }
  
  /**
   * Calculate and persist this node's shares of general fulfillment
   * Uses caching to avoid unnecessary calculations
   */
  public calculateSharesOfGeneralFulfillment(): {[key: string]: number} {
    const now = Date.now();
    
    // Use cached value if recent enough
    if (this._cachedShares && now - this._lastSharesCalculation < 5000) {
      return this._cachedShares;
    }

    // Calculate new shares
    const shares = this.calculateShares();
    
    // Cache the results
    this._cachedShares = shares;
    this._lastSharesCalculation = now;
    
    // Persist to Gun
    this.get('sharesOfGeneralFulfillment').put(shares);
    
    return shares;
  }
  
  /**
   * Calculate mutual fulfillment with a type
   */
  public mutualFulfillment(typeId: string): number {
    const recognitionFromHere = this.shareOfGeneralFulfillment(typeId);
    const recognitionFromThere = this.root._sharesOfOthersRecognition[typeId] || 0;
    return Math.min(recognitionFromHere, recognitionFromThere);
  }
  
  /**
   * Get the distribution of mutual fulfillment across types
   */
  get mutualFulfillmentDistribution(): Map<string, number> {
    const types = this.rootTypes.filter(typeId => 
      this.getInstances(typeId).size > 0
    );
    
    const rawDistribution = types
      .map(typeId => ({
        typeId,
        value: this.mutualFulfillment(typeId)
      }))
      .filter(entry => entry.value > 0);
    
    const total = rawDistribution.reduce((sum, entry) => sum + entry.value, 0);
    
    return new Map(
      rawDistribution.map(entry => [
        entry.typeId,
        total > 0 ? entry.value / total : 0
      ])
    );
  }
  
  // CLEANUP
  
  /**
   * Clean up all subscriptions
   */
  public unsubscribe(): void {
    if (this._parentSubscription) {
      this._parentSubscription();
      this._parentSubscription = null;
    }
    
    if (this._childrenSubscription) {
      this._childrenSubscription();
      this._childrenSubscription = null;
    }
    
    if (this._typesSubscription) {
      this._typesSubscription();
      this._typesSubscription = null;
    }
    
    // Only clean up recognition subscriptions if we're the root
    if (!this._parent) {
    this._recognitionSubscriptions.forEach(cleanup => cleanup());
    this._recognitionSubscriptions.clear();
      this._sharesOfOthersRecognition = {};
    }
    
    // Remove from registry
    TreeNode._registry.delete(this._id);
  }
  
  /**
   * Static method to clean up registry
   */
  public static cleanup(): void {
    // Unsubscribe all nodes
    TreeNode._registry.forEach(node => node.unsubscribe());
    TreeNode._registry.clear();
  }

  /**
   * Create a Svelte-compatible store for this node's data
   * @returns A store that reactively updates with the node's data
   */
  public toStore() {
    const store = super.toStore();
    return store;
  }

  /**
   * Create a store for a specific property of this node
   * @param property The property to access
   * @param initialValue Optional initial value
   * @returns A store that updates with only that property
   */
  public createPropertyStore<K extends keyof TreeNodeData>(
    property: K,
    initialValue?: TreeNodeData[K]
  ) {
    // Use the initial value from the node if available
    const initial = initialValue !== undefined ? initialValue : 
                    (property in this ? this[property as string] : undefined);
    
    // Create a subscription for the property
    const nodeSub = new GunSubscription<TreeNodeData>(this.getPath());
    
    // Map the subscription to only emit the property
    const propSub = nodeSub.map(data => {
      if (!data) return initial as any;
      return data[property];
    });
    
    return propSub.toStore();
  }

  /**
   * Get a derived store for calculated properties
   * @param name The name of the calculated property
   * @returns A store that updates when the calculation changes
   */
  public getDerivedStore(name: 'fulfilled' | 'desire' | 'weight' | 'shareOfParent') {
    // Create initial subscription to node data to drive updates
    const nodeSub = new GunSubscription<TreeNodeData>(this.getPath());
    
    // Configure the store with proper initial value
    const initialValue = this[name];
    
    return {
      subscribe: (run: SubscriptionHandler<any>) => {
        // Keep track of the last value to avoid duplicate emissions
        let lastValue = initialValue;
        run(lastValue);
        
        // Subscribe to node data changes
        const cleanup = nodeSub.on(() => {
          // When data changes, recalculate the derived value
          const newValue = this[name];
          
          // Only notify if the value changed
          if (newValue !== lastValue) {
            lastValue = newValue;
            run(newValue);
          }
        });
        
        return cleanup;
      }
    };
  }

  /**
   * Get children as a stream
   * @returns A subscription that emits the children collection
   */
  public childrenStream() {
    const childrenNode = this.get('children');
    const subscription = childrenNode.each((childData) => {
      const childId = childData._key;
      if (childId === '_') return;
      
      // Return the actual node if it exists in registry
      return TreeNode._registry.get(childId);
    });
    return subscription;
  }

  /**
   * Get types as a stream
   * @returns A subscription that emits the types collection
   */
  public typesStream() {
    const typesNode = this.get('types');
    return typesNode.each((typeData) => {
      return typeData._key;
    });
  }

  /**
   * Get a store of all children
   * @returns A store that emits the children map
   */
  public childrenStore() {
    // Track the current children map
    const currentChildren = new Map(this._children);
    
    // Create a direct subscription to the children collection
    const childrenNode = this.get('children');
    
    return {
      subscribe: (run: SubscriptionHandler<Map<string, TreeNode>>) => {
        // Immediately emit current value
        run(new Map(currentChildren));
        
        // Set up the subscription directly
        const cleanup = childrenNode.each((childData) => {
          if (!childData) return;
          
          const childId = childData._key;
          if (!childId || childId === '_') return;
          
          // Get the node from registry
          const node = TreeNode._registry.get(childId);
          if (node) {
            // Update the map
            currentChildren.set(childId, node);
            
            // Notify subscriber with a new map
            run(new Map(currentChildren));
          }
        });
        
        return cleanup;
      }
    };
  }
} 