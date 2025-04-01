import { App } from '../App';
import { GunNode } from './GunNode';
import { GunSubscription, SubscriptionCleanup, SubscriptionHandler } from './GunSubscription';

// Define the core data structure of a TreeNode
export interface TreeNodeData {
  id: string;
  name: string;
  points: number;
  manualFulfillment: number | null;
  parent?: string;
}

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
  
  // Subscriptions for cleanup
  private _parentSubscription: SubscriptionCleanup | null = null;
  private _childrenSubscription: SubscriptionCleanup | null = null;
  private _typesSubscription: SubscriptionCleanup | null = null;
  private _recognitionSubscriptions: Map<string, SubscriptionCleanup> = new Map();
  private _sharesOfOthersRecognition: {[key: string]: number} = {};
  
  // Reference to App
  private _app: App;
  
  // Static registry for nodes to avoid duplicates
  private static _registry: Map<string, TreeNode> = new Map();
  
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
   * Create a new TreeNode and persist it to Gun
   * @param name Node name
   * @param options Creation options
   * @param app App instance
   * @returns New TreeNode instance
   */
  public static async create(
    name: string, 
    options: {
      parent?: TreeNode,
      points?: number,
      manualFulfillment?: number,
      typeIds?: string[]
    }, 
    app: App
  ): Promise<TreeNode> {
    // Generate ID
    const id = Math.random().toString(36).substring(2, 15);
    
    // Create initial data
    const data: TreeNodeData = {
      id,
      name,
      points: options.points || 0,
      manualFulfillment: options.manualFulfillment || null,
      parent: options.parent?.id
    };
    
    // Create node in Gun using a root GunNode
    const rootNode = new GunNode(['nodes']);
    await rootNode.get(id).put(data);
    
    // Add types
    if (options.typeIds && options.typeIds.length > 0) {
      // Get the types node using the path from our new node
      const treeNode = TreeNode.getNode(id, app);
      const typesNode = treeNode.get('types');
      for (const typeId of options.typeIds) {
        await typesNode.get(typeId).put({ value: true } as any);
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
  
  /**
   * Set up all reactive subscriptions to Gun data
   */
  private setupSubscriptions(): void {
    // Subscribe to node data changes
    this.on((data) => {
      let updated = false;
      
      if (data.name !== this._name) {
        this._name = data.name || '';
        updated = true;
      }
      
      if (data.points !== this._points) {
        this._points = data.points || 0;
        updated = true;
      }
      
      if (data.manualFulfillment !== this._manualFulfillment) {
        this._manualFulfillment = data.manualFulfillment;
        updated = true;
      }
      
      // Handle parent changes
      if (data.parent !== undefined) {
        // If we have a parent ID but no parent object,
        // or parent ID changed, load the new parent
        if (
          (data.parent && (!this._parent || this._parent.id !== data.parent)) ||
          (!data.parent && this._parent)
        ) {
          this.updateParent(data.parent || null);
          updated = true;
        }
      }
      
      // Request UI updates if needed
      if (updated) {
        this._app.updateNeeded = true;
        this._app.pieUpdateNeeded = true;
      }
    });
    
    // Subscribe to children
    this.subscribeToChildren();
    
    // Subscribe to types
    this.subscribeToTypes();
    
    // Subscribe to recognition
    this.updateRecognitionSubscriptions();
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
    // Clean up existing subscription
    if (this._childrenSubscription) {
      this._childrenSubscription();
      this._childrenSubscription = null;
    }
    
    // Set up new subscription using path abstraction
    const childrenNode = this.get('children');
    
    // First, try to get initial children data all at once
    childrenNode.once().then(initialData => {
      if (initialData && typeof initialData === 'object') {
        // Process initial children data
        Object.keys(initialData).forEach(childId => {
          // Skip Gun metadata
          if (childId === '_') return;
          
          // Skip if already added
          if (this._children.has(childId)) return;
          
          // Load the child node if data exists
          if (initialData[childId]) {
            const childNode = TreeNode.getNode(childId, this._app);
            this._children.set(childId, childNode);
            
            // Ensure parent reference is correct
            childNode.parent = this;
            
            // Request UI updates
            this._app.updateNeeded = true;
            this._app.pieUpdateNeeded = true;
          }
        });
      }
    }).catch(err => {
      console.warn(`Error loading initial children for node ${this._id}:`, err);
    });
    
    // Set up ongoing reactive subscription
    this._childrenSubscription = childrenNode.each((childData) => {
      const childId = childData._key;
      
      // Skip Gun metadata
      if (childId === '_') return;
      
      // If data is falsy, it means child was removed
      if (!childData) {
        // Remove from local collection
        if (this._children.has(childId)) {
          this._children.delete(childId);
          this._app.updateNeeded = true;
          this._app.pieUpdateNeeded = true;
        }
        return;
      }
      
      // Skip if we already have this child
      if (this._children.has(childId)) return;
      
      // Load the child node
      const childNode = TreeNode.getNode(childId, this._app);
      this._children.set(childId, childNode);
      
      // Ensure parent reference is correct
      childNode.parent = this;
      
      // Request UI updates
      this._app.updateNeeded = true;
      this._app.pieUpdateNeeded = true;
    });
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
    this._typesSubscription = typesNode.each((typeData) => {
      const typeId = typeData._key;
      
      // Skip Gun metadata
      if (typeId === '_') return;
      
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
        return;
      }
      
      // Skip if we already have this type
      if (this._types.has(typeId)) return;
      
      // Add to local collection
      this._types.add(typeId);
      
      // Update type index
      const root = this.root;
      root.addToTypeIndex(typeId, this._id);
      
      // Request UI updates
      this._app.updateNeeded = true;
      this._app.pieUpdateNeeded = true;
    });
  }
  
  /**
   * Update which nodes we're subscribed to for recognition
   */
  private updateRecognitionSubscriptions(): void {
    // Find nodes that might recognize us
    const potentialRecognizers = Array.from(TreeNode._registry.values())
      .filter(node => node._types.has(this._id));
    
    // Subscribe to each node that isn't already subscribed
    potentialRecognizers.forEach(node => {
      if (!this._recognitionSubscriptions.has(node.id)) {
        this.subscribeToNodeRecognition(node.id);
      }
    });
    
    // Clean up subscriptions for nodes that no longer have us as a type
    const nodesToUnsubscribe = Array.from(this._recognitionSubscriptions.keys())
      .filter(nodeId => {
        const node = TreeNode._registry.get(nodeId);
        return !node || !node._types.has(this._id);
      });
    
    nodesToUnsubscribe.forEach(nodeId => {
      this.unsubscribeFromNodeRecognition(nodeId);
    });
  }
  
  /**
   * Subscribe to a node's recognition of us
   * @param nodeId Node ID to subscribe to
   */
  private subscribeToNodeRecognition(nodeId: string): void {
    // Create a temporary node to access the shares path
    const node = TreeNode.getNode(nodeId, this._app);
    const sharesNode = node.get('sharesOfGeneralFulfillment');
    
    const cleanup = sharesNode.on((data) => {
      if (!data) return;
      
      // Check if our ID is in the shares
      if (data[this._id] !== undefined && typeof data[this._id] === 'number') {
        // Update local recognition data
        this._sharesOfOthersRecognition[nodeId] = data[this._id];
        
        // Request UI updates
        this._app.updateNeeded = true;
        this._app.pieUpdateNeeded = true;
      }
    });
    
    // Store subscription for cleanup
    this._recognitionSubscriptions.set(nodeId, cleanup);
  }
  
  /**
   * Unsubscribe from a node's recognition
   * @param nodeId Node ID to unsubscribe from
   */
  private unsubscribeFromNodeRecognition(nodeId: string): void {
    const cleanup = this._recognitionSubscriptions.get(nodeId);
    if (cleanup) {
      cleanup();
      this._recognitionSubscriptions.delete(nodeId);
      delete this._sharesOfOthersRecognition[nodeId];
    }
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
   * @param options Child creation options
   * @returns Promise that resolves with the new child node
   */
  public async addChild(
    name: string,
    options: {
      points?: number,
      typeIds?: string[],
      manualFulfillment?: number,
      id?: string
    } = {}
  ): Promise<TreeNode> {
    // Check if this node can have children
    if (this._parent && this.isContribution) {
      throw new Error(`Node ${this._name} is a contribution and cannot have children`);
    }
    
    // Create the child node
    const child = await TreeNode.create(name, {
      parent: this,
      points: options.points || 0,
      manualFulfillment: options.manualFulfillment,
      typeIds: options.typeIds
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
   * Calculate this node's share of recognition for a type
   * @param typeId Type ID
   * @returns Share value
   */
  public shareOfGeneralFulfillment(typeId: string): number {
    const instances = this.getInstances(typeId);
    const share = Array.from(instances).reduce((sum, instanceId) => {
      const node = TreeNode._registry.get(instanceId);
      if (!node) return sum;
      
      const contributorTypesCount = node._types.size;
      const fulfillmentWeight = node.fulfilled * node.weight;
      
      const weightShare = contributorTypesCount > 0
        ? fulfillmentWeight / contributorTypesCount
        : fulfillmentWeight;
      
      return sum + weightShare;
    }, 0);
    
    return share;
  }
  
  /**
   * Calculate and persist this node's shares of general fulfillment
   * @returns Object with type IDs as keys and share values
   */
  public calculateSharesOfGeneralFulfillment(): {[key: string]: number} {
    const shares: {[key: string]: number} = {};
    
    // Calculate share for each type
    for (const typeId of this.root._typeIndex.keys()) {
      const share = this.shareOfGeneralFulfillment(typeId);
      shares[typeId] = share;
    }
    
    // Persist to Gun using path abstraction
    const sharesNode = this.get('sharesOfGeneralFulfillment');
    sharesNode.put(shares);
    
    // Subscription will handle the recognition updates 
    
    return shares;
  }
  
  /**
   * Calculate mutual fulfillment with a type
   * @param typeId Type ID
   * @returns Mutual fulfillment value
   */
  public mutualFulfillment(typeId: string): number {
    const recognitionFromHere = this.shareOfGeneralFulfillment(typeId);
    const recognitionFromThere = this._sharesOfOthersRecognition[typeId] || 0;
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
    
    // Clean up recognition subscriptions
    this._recognitionSubscriptions.forEach(cleanup => cleanup());
    this._recognitionSubscriptions.clear();
    
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

  /**
   * Get a single value from the node and resolve
   * @returns Promise that resolves with the node value
   */
  public once(): Promise<TreeNodeData> {
    // First try to use cached data if available
    if (this._name) {
      // If we already have basic data loaded, return it directly
      const cachedData: TreeNodeData = {
        id: this._id,
        name: this._name,
        points: this._points,
        manualFulfillment: this._manualFulfillment,
        parent: this._parent?.id
      };
      return Promise.resolve(cachedData);
    }
    
    // Otherwise use superclass once() method with error handling
    return super.once().catch(err => {
      console.warn(`Error in TreeNode.once() for node ${this._id}:`, err);
      // Return a minimal valid object even on error
      return {
        id: this._id,
        name: '',
        points: 0,
        manualFulfillment: null
      };
    });
  }
} 