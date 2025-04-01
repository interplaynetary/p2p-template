import { App } from '../../App';
import { readFromGunPath } from '../FuncGun';
import { gun } from '../Gun';

// Are our nodes saving to the gun-space or the user-space
// Late: From public to user-spaces (so that overwriting is not possible)

// Create a tree for all those we recognize and subscribe to their changes so that we can calculate mutual-recognition

// So we know we need to mantain in our own cache, the trees of:
// - All nodes we recognize
// THAT IS IT.

// couldnt we pass children into the TreeNode constructor? As well as the addChild constructor?
// We need to reevaluate what the typesMap is even for!

export class TreeNode {
    id: string;
    private _name: string = '';
    private _points: number = 0;
    private gunRef: any;
    private _parent: TreeNode | null;
    children: Map<string, TreeNode> = new Map();
    private _manualFulfillment: number | null = null;
    
    // Store types in a Map with ID as key to prevent duplicates
    private _typesMap: Map<string, TreeNode> = new Map();
    
    // NEW: Use ID-based typeIndex instead of TreeNode-based
    // Previously: typeIndex: Map<TreeNode, Set<TreeNode>>;
    typeIndex: Map<string, Set<string>>;
    
    app: App;
    
    // Gun subscription references
    private nodeSubscription: any;
    private childrenSubscription: any;
    private typesSubscription: any;
    
    // Static reference cache to avoid duplicating Gun references
    private static gunRefCache: Map<string, any> = new Map();
    // Static node cache to avoid duplicating TreeNode instances
    private static nodeCache: Map<string, TreeNode> = new Map();
    // Track nodes being loaded to prevent circular dependencies
    private static loadingNodes: Set<string> = new Set<string>();
    
    // Helper to get a Gun reference and cache it
    static getGunRef(id: string): any {
        if (!this.gunRefCache.has(id)) {
            console.log(`[TreeNode] Adding ${id} Gun reference to gunRefCache`);
            this.gunRefCache.set(id, gun.get('nodes').get(id));
        }
        return this.gunRefCache.get(id);
    }
    
    constructor(
      name: string,
      options: {
        id?: string,
        parent?: TreeNode | null,
        typeIds?: string[],
        manualFulfillment?: number,
        points?: number
      } = {}
    ) {
      const {
        id,
        parent = null,
        typeIds = [],
        manualFulfillment = 1,
        points = 1
      } = options;

      // Generate ID first
      const nodeId = id || Math.random().toString(36).substring(2, 15);
      
      // If node already exists in cache, we shouldn't be creating a new one
      // This should be handled by the factory method
      if (TreeNode.nodeCache.has(nodeId) && id) {
        console.error(`[TreeNode] Attempted to create duplicate node with ID ${nodeId}`);
      }
      
      this._name = name;
      this.id = nodeId;
      this._parent = parent;
      this._manualFulfillment = manualFulfillment || null;
      this._points = points;
      this.app = (window as any).app;
      this.gunRef = TreeNode.getGunRef(this.id);
      
      // Add to node cache
      TreeNode.nodeCache.set(this.id, this);
      
      // Initialize typeIndex (ID-based)
      this.typeIndex = parent ? parent.root.typeIndex : new Map<string, Set<string>>();
      
      // If this is a new node with manual fulfillment, update in Gun
      if (!options.id && this._manualFulfillment !== null) {
        console.log(`[TreeNode] Setting initial manual fulfillment for ${this.name} to ${this._manualFulfillment}`);
        this.gunRef.get('manualFulfillment').put(this._manualFulfillment);
      }
      
      // If this is a new node with points, update in Gun
      if (!options.id && this._points > 0) {
        console.log(`[TreeNode] Setting initial points for ${this.name} to ${this._points}`);
        this.gunRef.get('points').put(this._points);
      }
      
      // If this is a new node, persist it to Gun
      if (!options.id) {
        this.saveToGun();
      }
      
      // Set up subscriptions
      this.setupSubscriptions();
      
      // Add type IDs after setup - this is safe because we're handling new types from subscriptions too
      if (typeIds.length > 0) {
        typeIds.forEach(typeId => {
          this.addType(typeId);
        });
      }
      
      // Periodically clean up the cache (once every ~100 node creations)
      if (Math.random() < 0.01) {
        TreeNode.cleanupCache();
      }
    }

    get name(): string {
      return this._name;
    }
    
    set name(name: string) {
      console.log(`[TreeNode] Setting name for node ${this.id} to ${name}`);
      this._name = name;
      
      // Update in Gun using direct approach
      this.gunRef.get('name').put(name);
      
      this.app.updateNeeded = true;
    }

    get root(): TreeNode {
      return this._parent ? this._parent.root : this;
    }
    
    get parent(): TreeNode | null {
      return this._parent;
    }

    set parent(parent: TreeNode | null) {
      const oldRoot = this.root;
      const oldParent = this._parent;
      
      // First remove this node from previous parent's children map
      if (oldParent && oldParent.children.has(this.id)) {
        oldParent.children.delete(this.id);
      }
      
      this._parent = parent;
      
      // Then add to new parent's children map if applicable
      if (parent) {
        // Store the parent ID directly in Gun
        this.gunRef.get('parent').put(parent.id);
        
        // Update in-memory reference
        parent.children.set(this.id, this);
        
        // If the root has changed, update type indices
        const newRoot = this.root;
        if (oldRoot !== newRoot) {
          this.updateTypeIndicesForTree(oldRoot, newRoot);
        }
      } else {
        // If parent is null, remove the reference in Gun
        this.gunRef.get('parent').put(null);
      }
    }   

    // Helper method to update type indices when a node changes parents
    private updateTypeIndicesForTree(oldRoot: TreeNode, newRoot: TreeNode): void {
      // First, collect all the type relationships for this subtree
      const typeRelationships: Array<{nodeId: string, typeId: string}> = [];
      
      // Helper to collect types for a node and its descendants
      const collectTypes = (node: TreeNode) => {
        // Collect this node's types
        node._typesMap.forEach((_, typeId) => {
          typeRelationships.push({ nodeId: node.id, typeId });
          
          // Remove from old root's index
          if (oldRoot.typeIndex.has(typeId)) {
            oldRoot.typeIndex.get(typeId)?.delete(node.id);
          }
        });
        
        // Process all children recursively
        node.children.forEach(child => collectTypes(child));
      };
      
      // Start collection with this node
      collectTypes(this);
      
      // Now add all collected relationships to the new root's index
      typeRelationships.forEach(({ nodeId, typeId }) => {
        if (!newRoot.typeIndex.has(typeId)) {
          newRoot.typeIndex.set(typeId, new Set<string>());
        }
        newRoot.typeIndex.get(typeId)?.add(nodeId);
      });
    }

    // Helper method to get all types in the system
    get rootTypes(): string[] {
      return Array.from(this.root.typeIndex.keys());
    }

    get isContributor(): boolean {
      // isContributor should only be true if it is the root of a user
      return !this._parent;
    }
    
    get isContribution(): boolean {
      // isContribution should only be true if the node has a parent and has a type that's a contributor
      if (!this._parent || this._typesMap.size === 0) return false;
      
      // Check if any of the types are contributors (root nodes) by checking their isContributor property
      // This avoids circular references by relying on the simple parent check in isContributor
      return Array.from(this._typesMap.values()).some(type => type.isContributor);
    }
  
    async addChild(name: string, points: number = 0, typeIds: string[] = [], manualFulfillment: number = 0, id: string = Math.random().toString(36).substring(2, 15)): Promise<TreeNode> {
      if (this._parent && this.isContribution) {
        throw new Error(
          `Node ${this.name} is an instance of a contributor/contribution and cannot have children.`
        );
      }
  
      // Create child data WITHOUT the types array
      const childData = {
        id: id,
        name: name,
        points: points,
        manualFulfillment: manualFulfillment || null
        // Remove types from here
      };
      
      console.log(`[TreeNode] Creating child node "${name}"`);
      
      // Create node directly in Gun's 'nodes' collection with specified ID
      gun.get('nodes').get(id).put(childData);
      
      // Then add types correctly, one by one
      if (typeIds.length > 0) {
        typeIds.forEach(typeId => {
          gun.get('nodes').get(id).get('types').get(typeId).put(true);
        });
      }
      
      // Add reference to parent's children collection
      console.log(`[TreeNode] Adding child ${id} to parent ${this.id}`);
      
      // Store the child ID directly in the children collection
      this.gunRef.get('children').get(id).put(true);
      
      // Create the TreeNode instance using the factory method
      const child = TreeNode.create(name, {
        id,
        parent: this,
        typeIds,
        manualFulfillment,
        points
      });
      
      // Add to local children map
      this.children.set(id, child);
      
      this.app.updateNeeded = true;
      this.app.pieUpdateNeeded = true;      
      return child;
    }
  
    removeChild(childId: string): TreeNode {
      const child = this.children.get(childId);
      if (child) {        
        // Remove from type index - updated for ID-based approach
        child._typesMap.forEach((_, typeId) => {
          const root = this.root;
          if (root.typeIndex.has(typeId)) {
            root.typeIndex.get(typeId)?.delete(childId);
          }
        });
        
        // Remove from children
        this.children.delete(childId);
        
        // Remove from Gun by removing the reference
        console.log(`[TreeNode] Removing child ${childId} from node ${this.id}`);
                
        // Simply remove the child ID entry from the children collection
        this.gunRef.get('children').get(childId).put(null);
        
        if (child.nodeSubscription && child.nodeSubscription.gunNodeRef) {
          child.unsubscribe();
        }
        
        // Remove from cache only if this node has no other references
        // This is a simple approach - for a more accurate one, we'd need reference counting
        if (!Array.from(TreeNode.nodeCache.values()).some(node => 
          node.children.has(childId) || 
          (node.parent && node.parent.id === childId)
        )) {
          console.log(`[TreeNode] Removing ${childId} from cache`);
          TreeNode.nodeCache.delete(childId);
        }
      }
      
      this.app.updateNeeded = true;
      this.app.pieUpdateNeeded = true;
      return this;
    }

    // Getter to return a Set of types for backward compatibility
    get types(): Set<TreeNode> {
      return new Set(this._typesMap.values());
    }

    // Getter for types map to allow access from TreeMap
    get typesMap(): Map<string, TreeNode> {
        return this._typesMap;
    }
    
    // Add this node as an instance of the given type
    addType(typeId: string): TreeNode {
      // Skip invalid type IDs
      if (!typeId || typeId === '#' || typeof typeId !== 'string') {
        console.warn(`[TreeNode] Ignoring invalid type ID: ${typeId}`);
        return this;
      }
      
      const root = this.root;
      
      // If the type is already in our map, nothing to do
      if (this._typesMap.has(typeId)) {
        console.log(`[TreeNode] Type ${typeId} already exists for node ${this.name}`);
        return this;
      }
      
      console.log(`[TreeNode] Adding type ${typeId} to node ${this.name}`);
      
      // Store the typeId directly in the types collection in Gun
      this.gunRef.get('types').get(typeId).put(true);
      
      // Update the ID-based type index
      this.addToTypeIndex(typeId);

      // Load the type node to store in memory
      TreeNode.fromId(typeId)
        .then(typeNode => {
        if (typeNode) {
            // Add to local types map
          this._typesMap.set(typeId, typeNode);
            // Ensure UI updates happen
            this.app.updateNeeded = true;
            this.app.pieUpdateNeeded = true;
        } else {
          console.error(`[TreeNode] Failed to get type node for ${typeId}`);
        }
        })
        .catch(err => {
          console.error(`[TreeNode] Error loading type ${typeId}:`, err);
      });
      
      return this;
    }
  
    removeType(typeId: string): TreeNode {
      const root = this.root;
      
      // Remove from Gun
      console.log(`[TreeNode] Removing type ${typeId} from node ${this.name}`);
      
      // Remove the type ID entry from the types collection in Gun
      this.gunRef.get('types').get(typeId).put(null);
      
      // Update the ID-based type index
      if (root.typeIndex.has(typeId)) {
        root.typeIndex.get(typeId)?.delete(this.id);
      }
      
      // Remove from local types map
      this._typesMap.delete(typeId);
      
      // Remove from cache if no longer referenced
      if (!this.hasTypeReferences(typeId)) {
        console.log(`[TreeNode] Removing type ${typeId} from cache as it's no longer referenced`);
        TreeNode.nodeCache.delete(typeId);
      }
      
      this.app.updateNeeded = true;
      this.app.pieUpdateNeeded = true;
      return this;
    }

    get points(): number {
      return this._points;
    }

    set points(points: number) {
      console.log(`[TreeNode] Setting points for ${this.name} to ${points}`);
      this._points = points;
      
      // Update in Gun using direct approach
      this.gunRef.get('points').put(points);
      
      // Only update pie chart if not in an active touch/growth interaction
      if (!(this.app as any).isGrowingActive) {
        this.app.pieUpdateNeeded = true;
      }
    }
  
    get totalChildPoints() {
      return Array.from(this.children.values()).reduce((sum, child) => sum + child.points, 0) || 0;
    }
  
    get weight(): number {
      if (!this.parent) return 1;
      return this.parent.totalChildPoints === 0
        ? 0
        : (this._points / this._parent.totalChildPoints) * this._parent.weight;
    }
  
    // shareOfParent() -> how many points this node has, as fraction of totalChildPoints.
    // used to distribute contribution/fulfillment upward or across siblings.
    get shareOfParent(): number {
        if (!this.parent) return 1;
        return this.parent.totalChildPoints === 0
          ? 0
          : this._points / this._parent.totalChildPoints;
    }
  
    get hasDirectContributionChild(): boolean {
        return Array.from(this.children.values()).some(
          child => child.isContribution
        );
    }
      
    get hasNonContributionChild(): boolean {
        return Array.from(this.children.values()).some(
          child => !child.isContribution
        );
    }
  
    get contributionChildrenWeight(): number {
        const contributionPoints = Array.from(this.children.values())
          .filter(child => child.isContribution)
          .reduce((sum, child) => sum + child.points, 0);
  
        return contributionPoints / this.totalChildPoints;
    }
  
    get contributionChildrenFulfillment(): number {
        const contributionChildren = Array.from(this.children.values()).filter(
          child => child.isContribution
        );
  
        return contributionChildren.reduce(
          (sum, child) => sum + child.fulfilled * child.shareOfParent,
          0
        );
    }
  
    get nonContributionChildrenFulfillment(): number {
      const nonContributionChildren = Array.from(this.children.values()).filter(
          child => !child.isContribution
        );

      return nonContributionChildren.reduce(
          (sum, child) => sum + child.fulfilled * child.shareOfParent,
          0
        );
    }
      
    // The core method: fulfilled():
    // 1. Leaf nodes with isContribution == true → full 1.0 fulfillment
    // 2. Leaf nodes with isContribution == false → 0
    // 3. If _manualFulfillment is set and node has both contributor and non-contributor children:
    //    merges the manual fulfillment for contributor children with the calculated fulfillment for non-contributor children using a weighted approach.
    // 4. Otherwise falls back to summing child fulfillments * shareOfParent().
    get fulfilled(): number {
      // For leaf nodes (no children)
      if (this.children.size === 0) {
        return this.isContribution ? 1 : 0;
      }

      // If fulfillment was manually set and node has contributor children
      if (
        this._manualFulfillment !== null &&
        this.hasDirectContributionChild
      ) {
        // If we only have contributor children, return manual fulfillment
        if (!this.hasNonContributionChild) {
          return this._manualFulfillment;
        }

        // For hybrid case: combine manual fulfillment for contributor children
        // with calculated fulfillment for non-contributor children
        const contributionChildrenWeight =
          this.contributionChildrenWeight;
        const nonContributionFulfillment =
          this.nonContributionChildrenFulfillment;

        return (
          this._manualFulfillment * contributionChildrenWeight +
          nonContributionFulfillment * (1 - contributionChildrenWeight)
        );
      }

      // Default case: calculate from all children
      return Array.from(this.children.values()).reduce(
        (sum, child) => sum + child.fulfilled * child.shareOfParent,
        0
      );
    }

    get desire(): number {
      return 1 - this.fulfilled;
    }

    get manualFulfillment(): number | null {
      return this._manualFulfillment;
    }
    
    set manualFulfillment(value: number | null) {
      console.log(`[TreeNode] Setting manual fulfillment for ${this.name} to ${value}`);
      this._manualFulfillment = value;
      
      // Update in Gun using direct approach
      this.gunRef.get('manualFulfillment').put(value);
      
      // Only update pie chart if not in an active touch/growth interaction
      if (!(this.app as any).isGrowingActive) { // TODO: make fulfillment specific
        this.app.pieUpdateNeeded = true;
      }
    }

    get fulfillmentWeight(): number {
      return this.fulfilled * this.weight;
    }

    // Helper method to get all instances of a given type
    getInstances(typeId: string): Set<string> {
      return this.root.typeIndex.get(typeId) || new Set();
    }

    shareOfGeneralFulfillment(typeId: string): number {
      const instances = this.getInstances(typeId);
      const share = Array.from(instances).reduce((sum, instance) => {
        const node = TreeNode.nodeCache.get(instance);
        if(!node) return sum;
        const contributorTypesCount = Array.from(node._typesMap.values()).filter(type => type.isContributor).length;

        const fulfillmentWeight = node.fulfilled * node.weight;

        const weightShare =
          contributorTypesCount > 0
            ? fulfillmentWeight / contributorTypesCount
            : fulfillmentWeight;

        return sum + weightShare;	
      }, 0);

      this.gunRef.get('shareOfGeneralFulfillment').get(typeId).put(share);
      console.log(`[TreeNode] Share of general fulfillment for ${this.id} to ${typeId}: ${share}`);

      return share;
    }

    mutualFulfillment(typeId: string): Promise<number> {
      // Get our recognition of them - stored in our gun node
      const recognitionFromHere = this.shareOfGeneralFulfillment(typeId);

      // Return a Promise that resolves with the mutual fulfillment value
      return new Promise<number>((resolve) => {
        // Get their recognition of us - stored in their gun node
        gun.get('nodes').get(typeId).get('shareOfGeneralFulfillment').get(this.id).once((share: number) => {
          console.log(`[TreeNode] Recognition from ${typeId} to ${this.id}: ${share}`);
          if (typeof share === 'number') {
            resolve(Math.min(recognitionFromHere, share));
          } else {
            resolve(0);
          }
        });
        
        // Add a timeout in case Gun doesn't respond
        setTimeout(() => {
          console.log(`[TreeNode] Timeout getting recognition from ${typeId}`);
          resolve(0);
        }, 2000);
      });
    }

    // Changed from a getter to a regular async method
    async getMutualFulfillmentDistribution(): Promise<Map<string, number>> {
      const types = this.rootTypes.filter(
        typeId => this.getInstances(typeId).size > 0
      );

      // Wait for all mutual fulfillment promises to resolve
      const fulfilledValues = await Promise.all(
        types.map(async (typeId) => ({
          typeId,
          value: await this.mutualFulfillment(typeId),
        }))
      );

      // Filter out zero values
      const rawDistribution = fulfilledValues.filter(entry => entry.value > 0);
      
      // Calculate total for percentage distribution
      const total = rawDistribution.reduce((sum, entry) => sum + entry.value, 0);

      // Return the distribution as a Map
      return new Map(
        rawDistribution.map(entry => [
          entry.typeId,
          total > 0 ? entry.value / total : 0,
        ])
      );
    }
    
    // GUN Methods

    // Save this node to Gun
    saveToGun() {
      console.log(`[TreeNode] Saving node ${this.name} (ID: ${this.id}) to Gun`);
      
      const data = {
        name: this._name,
        points: this._points,
        manualFulfillment: this._manualFulfillment,
      };
      
      console.log(`[TreeNode] Node data being saved:`, data);
      
      // Use Gun's direct put operation
      this.gunRef.put(data);
      
      console.log(`[TreeNode] Saved node data:`, data);
      
      // Save parent reference if it exists
      if (this._parent) {
        console.log(`[TreeNode] Saving parent reference: ${this._parent.id}`);
        
        // Store the parent ID directly
        this.gunRef.get('parent').put(this._parent.id);
      }
      
      // Save children references using Gun's set operation
      if (this.children.size > 0) {
        console.log(`[TreeNode] Saving ${this.children.size} children references`);
        
        Array.from(this.children.values()).forEach(child => {
          console.log(`[TreeNode] Saving child reference: ${child.id}`);
          
          // Store the child ID directly in the children collection
          this.gunRef.get('children').get(child.id).put(true);
        });
      }
      
      // Save type references using Gun's put operation directly with ID keys
      if (this._typesMap.size > 0) {
        console.log(`[TreeNode] Saving ${this._typesMap.size} type references`);
        
        Array.from(this._typesMap.entries()).forEach(([typeId, type]) => {
          console.log(`[TreeNode] Saving type reference: ${typeId}`);
          
          // Store the type ID directly
          this.gunRef.get('types').get(typeId).put(true);
        });
      }
      
      console.log(`[TreeNode] Save to Gun complete for node ${this.id}`);
    }
    
    // Set up Gun subscriptions
    setupSubscriptions() {
      console.log(`[TreeNode] Setting up subscriptions for node ${this.id}`);
      
      // Subscribe to node data changes
      this.nodeSubscription = readFromGunPath(['nodes', this.id], true);
      if (this.nodeSubscription.gunNodeRef) {
        this.nodeSubscription.gunNodeRef.on((data) => {
          if (data) {
            let dataChanged = false;
            
            // Handle name updates properly - update regardless of current name
            if (data.name !== undefined && data.name !== this._name) {
              console.log(`[TreeNode] Updating name from "${this._name}" to "${data.name}"`);
              this._name = data.name;
              dataChanged = true;
            }
            
            if (typeof data.points === 'number' && this._points !== data.points) {
              console.log(`[TreeNode] Updating points from ${this._points} to ${data.points}`);
              this._points = data.points;
              dataChanged = true;
            }
            
            if (data.manualFulfillment !== undefined && this._manualFulfillment !== data.manualFulfillment) {
              console.log(`[TreeNode] Updating manual fulfillment from ${this._manualFulfillment} to ${data.manualFulfillment}`);
              this._manualFulfillment = data.manualFulfillment;
              dataChanged = true;
            }
            
            // Handle parent ID changes
            if (data.parent !== undefined) {
              // If parent is a string ID and different from current parent
              if (typeof data.parent === 'string' && (!this._parent || this._parent.id !== data.parent)) {
                console.log(`[TreeNode] Parent ID changed to ${data.parent}, loading parent node`);
                TreeNode.fromId(data.parent)
                  .then(parentNode => {
                    if (parentNode) {
                      // Use the setter to ensure proper bidirectional relationship
                      this.parent = parentNode;
                      this.app.updateNeeded = true;
                      this.app.pieUpdateNeeded = true;
                    }
                  })
                  .catch(err => {
                    console.error(`[TreeNode] Error loading parent ${data.parent}:`, err);
                  });
              }
              // If parent is null, clear parent
              else if (data.parent === null && this._parent !== null) {
                console.log(`[TreeNode] Parent removed for node ${this.id}`);
                this.parent = null;
                dataChanged = true;
              }
            }
            
            // Update UI if any data changed
            if (dataChanged) {
              this.app.updateNeeded = true;
              this.app.pieUpdateNeeded = true;
            }
          }
        });
      }
      
      // Subscribe to children changes
      console.log(`[TreeNode] Setting up children subscription for ${this.id}`);
      this.childrenSubscription = readFromGunPath(['nodes', this.id, 'children'], true);
      if (this.childrenSubscription.gunNodeRef) {
        this.childrenSubscription.gunNodeRef.map().on((data, key) => {
          if (key === '_') return;
          
          const childId = key;
          
          // If the value is null/undefined or false, it means the child has been removed
          if (!data) {
            if (this.children.has(childId)) {
              const child = this.children.get(childId);
              if (child) {
                // Clean up subscription
                child.unsubscribe();
                
                // Remove from type index - update for ID-based approach
                // For each type this child has, remove its ID from the type's instances
                child._typesMap.forEach((_, typeId) => {
                  const root = this.root;
                  if (root.typeIndex.has(typeId)) {
                    root.typeIndex.get(typeId)?.delete(childId);
                  }
                });
              }
              // Remove from local children map
              this.children.delete(childId);
              console.log(`[TreeNode] Child ${childId} has been removed`);
            }
            return;
          }
          
          // Skip if we already have this child
          if (this.children.has(childId)) {
            return;
          }
          
          // New child detected, load it
          console.log(`[TreeNode] Loading new child with ID ${childId}`);
          TreeNode.fromId(childId)
            .then(child => {
            if (child) {
                console.log(`[TreeNode] Child ${childId} loaded successfully for ${this.id}`);
              child.parent = this;
              this.children.set(childId, child);
                
                // Ensure UI updates happen
                this.app.updateNeeded = true;
                this.app.pieUpdateNeeded = true;
            } else {
                console.error(`[TreeNode] Failed to load child ${childId}`);
            }
            })
            .catch(err => {
              console.error(`[TreeNode] Error loading child ${childId}:`, err);
          });
        });
      }
      
      // Subscribe to types changes
      console.log(`[TreeNode] Setting up types subscription for ${this.id}`);
      this.typesSubscription = readFromGunPath(['nodes', this.id, 'types'], true);
      if (this.typesSubscription.gunNodeRef) {
        this.typesSubscription.gunNodeRef.map().on((data, key) => {
          if (key === '_') return;
          
          const typeId = key;
          
          // If the value is null/undefined or false, it means the type has been removed
          if (!data) {
            if (this._typesMap.has(typeId)) {
              // Remove from type index
              const root = this.root;
              if (root.typeIndex.has(typeId)) {
                root.typeIndex.get(typeId)?.delete(this.id);
              }
              
              // Remove from local types map
              this._typesMap.delete(typeId);
              console.log(`[TreeNode] Type ${typeId} has been removed`);
              
              // Remove from cache if no longer referenced
              if (!this.hasTypeReferences(typeId)) {
                console.log(`[TreeNode] Removing type ${typeId} from cache as it's no longer referenced`);
                TreeNode.nodeCache.delete(typeId);
              }
              
              this.app.updateNeeded = true;
              this.app.pieUpdateNeeded = true;
            }
            return;
          }
          
          // Check if we already have this type
          if (this._typesMap.has(typeId)) {
            return;
          }
          
          // Update type index through helper method for consistency
          this.addToTypeIndex(typeId);
          
          // New type detected, load it
          console.log(`[TreeNode] Loading new type with ID ${typeId}`);
          TreeNode.fromId(typeId)
            .then(type => {
            if (type) {
              console.log(`[TreeNode] Type ${typeId} (${type.name}) loaded successfully for ${this.id}`);
              this._typesMap.set(typeId, type);
              
              // Update UI to reflect changes
              this.app.updateNeeded = true;
              this.app.pieUpdateNeeded = true;
            } else {
                console.error(`[TreeNode] Failed to load type ${typeId}`);
            }
            })
            .catch(err => {
            console.error(`[TreeNode] Error loading type ${typeId}:`, err);
          });
        });
      }
      
      console.log(`[TreeNode] All subscriptions set up for node ${this.id}`);
    }
    
    // Clean up subscriptions
    unsubscribe() {
      if (this.nodeSubscription && this.nodeSubscription.gunNodeRef) {
        this.nodeSubscription.gunNodeRef.off();
      }
      if (this.childrenSubscription && this.childrenSubscription.gunNodeRef) {
        this.childrenSubscription.gunNodeRef.off();
      }
      if (this.typesSubscription && this.typesSubscription.gunNodeRef) {
        this.typesSubscription.gunNodeRef.off();
      }
      
      // Clean up children subscriptions too
      this.children.forEach(child => {
        child.unsubscribe();
      });
    }

    static async fromId(id: string): Promise<TreeNode | null> {
      // Skip invalid IDs
      if (!id || id === '#' || typeof id !== 'string') {
        console.warn(`[TreeNode] Invalid node ID: ${id}`);
        return null;
      }
      
      // Check cache first
      if (TreeNode.nodeCache.has(id)) {
        return TreeNode.nodeCache.get(id)!;
      }
      
      return new Promise<TreeNode | null>((resolve, reject) => {
        try {
          // If this node is already being loaded in this call chain, resolve null to break cycles
          if (TreeNode.loadingNodes.has(id)) {
            console.warn(`[TreeNode] Circular dependency detected while loading ${id}`);
                resolve(null);
                return;
              }
              
          // Mark this node as being loaded
          TreeNode.loadingNodes.add(id);
          
          gun.get('nodes').get(id).once((data) => {
            if (!data || Object.keys(data).filter(k => k !== '_').length === 0) {
              TreeNode.loadingNodes.delete(id);
                resolve(null);
                return;
              }
              
            // Extract type IDs - should be object with keys as type IDs in new paradigm
            const typeIds: string[] = [];
            if (data.types && typeof data.types === 'object') {
              Object.keys(data.types).forEach(key => {
                if (key !== '_') {
                  typeIds.push(key);
                }
              });
            }
            
            // Create the node with factory method
            const node = TreeNode.create(
              data.name || 'Unnamed', 
              {
                id,
                typeIds,
                manualFulfillment: data.manualFulfillment || 0,
                points: data.points || 0
              }
            );
            
            // If we have a parent ID, trigger loading but don't wait for it
            const parentId = typeof data.parent === 'string' ? data.parent : null;
            if (parentId) {
              TreeNode.fromId(parentId)
                .then(parent => {
                  if (parent) {
                    node.parent = parent;
                  }
                })
                .catch(err => {
                  console.error(`[TreeNode] Error loading parent ${parentId}:`, err);
                });
            }
            
            // Done loading this node
            TreeNode.loadingNodes.delete(id);
            
            // Resolve immediately with the node
            resolve(node);
          });
        } catch (err) {
          TreeNode.loadingNodes.delete(id);
          console.error(`[TreeNode] Error loading node ${id}:`, err);
          reject(err);
        }
      });
    }

    // Add to type index
    addToTypeIndex(typeId: string): void {
      // Get the current root to ensure we're using the most up-to-date reference
      const root = this.root;
      if (!root.typeIndex.has(typeId)) {
        root.typeIndex.set(typeId, new Set<string>());
      }
      root.typeIndex.get(typeId)?.add(this.id);
    }

    // Public factory method to create or get TreeNode instances
    static create(
      name: string,
      options: {
        id?: string,
        parent?: TreeNode | null,
        typeIds?: string[],
        manualFulfillment?: number,
        points?: number
      } = {}
    ): TreeNode {
      const nodeId = options.id || Math.random().toString(36).substring(2, 15);
      
      // If this node already exists in the cache, update parent if needed and return
      if (TreeNode.nodeCache.has(nodeId)) {
        const cachedNode = TreeNode.nodeCache.get(nodeId)!;
        
        // If a parent is specified and different from current, update it
        if (options.parent !== undefined && cachedNode.parent !== options.parent) {
          cachedNode.parent = options.parent;
        }
        
        return cachedNode;
      }
      
      // Create a new instance
      return new TreeNode(name, options);
    }

    // Helper to check if a type has references in the system
    private hasTypeReferences(typeId: string): boolean {
      // First check if any node has this as a type in their _typesMap
      const hasDirectReference = Array.from(TreeNode.nodeCache.values()).some(node => 
        node._typesMap.has(typeId)
      );
      
      if (hasDirectReference) return true;
      
      // Then check if this type ID exists in any root's typeIndex with non-empty instances
      return Array.from(TreeNode.nodeCache.values())
        .filter(node => node.isContributor) // Only check root nodes
        .some(root => {
          const instances = root.typeIndex.get(typeId);
          return instances && instances.size > 0;
        });
    }

    // Static method to clean up the cache by removing orphaned nodes
    private static cleanupCache(): void {
      // Get all node IDs that are referenced as children or types
      const referencedIds = new Set<string>();
      
      // Helper to collect all referenced node IDs
      const collectReferencedIds = () => {
        TreeNode.nodeCache.forEach(node => {
          // Add children references
          node.children.forEach((_, childId) => {
            referencedIds.add(childId);
          });
          
          // Add type references
          node._typesMap.forEach((_, typeId) => {
            referencedIds.add(typeId);
          });
          
          // Add parent reference if exists
          if (node.parent) {
            referencedIds.add(node.parent.id);
          }
        });
      };
      
      // Collect all referenced IDs
      collectReferencedIds();
      
      // Remove nodes that aren't referenced and aren't root nodes
      const orphanedIds: string[] = [];
      TreeNode.nodeCache.forEach((node, id) => {
        if (!referencedIds.has(id) && node.parent !== null) {
          orphanedIds.push(id);
        }
      });
      
      // Remove the orphaned nodes from the cache
      orphanedIds.forEach(id => {
        console.log(`[TreeNode] Cleaning up orphaned node ${id} from cache`);
        TreeNode.nodeCache.delete(id);
      });
    }
}
  