import { App } from '../App';
import { writeToGunPath, readFromGunPath } from './FuncGun';

// how does our random Id generation work? Is it used? Why not use gun's?

// we get duplicate types! on our nodes! (lets use Sets!)
// But why do we get this in the first place?

// gun-space vs user-space

export class TreeNode {
    id: string;
    name: string;
    private _parent: TreeNode | null;
    points: number = 0;
    children: Map<string, TreeNode> = new Map();
    manualFulfillment: number | null = null;
    types: TreeNode[] = [];
    typeIndex: Map<TreeNode, Set<TreeNode>>;
    peerAlias: string | null;
    app: App;
    
    // Gun subscription references
    private nodeSubscription: any;
    private childrenSubscription: any;
    private typesSubscription: any;
    
    constructor(name: string, id?: string, parent: TreeNode | null = null, types: TreeNode[] = [], manualFulfillment: number = 0, peerAlias: string | null = null) {
      this.name = name;
      this.id = id || Math.random().toString(36).substring(2, 15);
      this.peerAlias = peerAlias; // Do we need this? Can we use a user-id as a peerAlias / gun objectId?
      this._parent = parent;
      this.manualFulfillment = manualFulfillment || null;
      this.app = (window as any).app;
      
      // Map of type -> Set of instances (shared at root level)
      this.typeIndex = parent ? parent.root.typeIndex : new Map();
  
      if (types.length > 0) {
        this.types = [...types];
        types.forEach(type => {
          this.addType(type);
        });
      }
      
      // If this is a new node, persist it to Gun
      if (!id) {
        this.saveToGun();
      }
      
      // Set up subscriptions
      this.setupSubscriptions();
    }

    get root(): TreeNode {
      return this._parent ? this._parent.root : this;
    }
    
    get parent(): TreeNode | null {
      return this._parent;
    }

    // Helper method to get all types in the system
    get rootTypes(): TreeNode[] {
      return Array.from(this.root.typeIndex.keys());
    }

    get isContributor() : boolean {
      return !this.parent
      // will be changed with Gun logic!
    }
    
    get isContribution(): boolean {
      // A node is a contribution if it has any types that are contributors
      if (this.types.length === 0) return false;
      return this.types.some(type => type.isContributor);
    }

    // Get path for Gun operations
    get nodePath(): string[] {
      return ['nodes', this.id];
    }
    
    get childrenPath(): string[] {
      return ['nodes', this.id, 'children'];
    }
    
    get typesPath(): string[] {
      return ['nodes', this.id, 'types'];
    }

    // Save this node to Gun
    saveToGun() {
      console.log(`[TreeNode] Saving node ${this.name} (ID: ${this.id}) to Gun`);
      
      const data = {
        name: this.name,
        points: this.points,
        manualFulfillment: this.manualFulfillment,
      };
      
      console.log(`[TreeNode] Node data being saved:`, data);
      writeToGunPath(this.nodePath, data);
      console.log(`[TreeNode] Saved node data:`, data);
      
      // Save parent reference if it exists
      if (this._parent) {
        console.log(`[TreeNode] Saving parent reference: ${this._parent.id}`);
        writeToGunPath([...this.nodePath, 'parent'], this._parent.id);
      }
      
      // Save children references
      if (this.children.size > 0) {
        console.log(`[TreeNode] Saving ${this.children.size} children references`);
        Array.from(this.children.values()).forEach(child => {
          writeToGunPath([...this.childrenPath, child.id], true, true);
        });
      }
      
      // Save type references
      if (this.types.length > 0) {
        console.log(`[TreeNode] Saving ${this.types.length} type references`);
        this.types.forEach(type => {
          writeToGunPath([...this.typesPath, type.id], true, true);
        });
      }
      
      console.log(`[TreeNode] Save to Gun complete for node ${this.id}`);
    }
    
    // Set up Gun subscriptions
    setupSubscriptions() {
      console.log(`[TreeNode] Setting up subscriptions for node ${this.id}`);
      
      // Subscribe to node data changes
      this.nodeSubscription = readFromGunPath(this.nodePath, true);
      if (this.nodeSubscription.gunNodeRef) {
        this.nodeSubscription.gunNodeRef.on((data) => {
          if (data) {
            console.log(`[TreeNode] Received data update for node ${this.id}:`, data);
            
            // Handle name updates properly - only update if name is defined
            if (data.name !== undefined) {
              console.log(`[TreeNode] Updating name from "${this.name}" to "${data.name}"`);
              this.name = data.name;
            }
            
            if (typeof data.points === 'number') {
              this.points = data.points;
            }
            
            if (data.manualFulfillment !== undefined) {
              this.manualFulfillment = data.manualFulfillment;
            }
          }
        });
      }
      
      // Subscribe to children changes
      console.log(`[TreeNode] Setting up children subscription for ${this.id}`);
      this.childrenSubscription = readFromGunPath(this.childrenPath, true);
      if (this.childrenSubscription.gunNodeRef) {
        this.childrenSubscription.gunNodeRef.map().on((data, key) => {
          if (key === '_') return;
          
          console.log(`[TreeNode] Detected child with key ${key} for node ${this.id}`);
          
          // Skip if we already have this child
          if (this.children.has(key)) {
            console.log(`[TreeNode] Child ${key} already loaded, skipping`);
            return;
          }
          
          // New child detected, load it
          console.log(`[TreeNode] Loading new child with ID ${key}`);
          TreeNode.fromId(key).then(child => {
            if (child) {
              console.log(`[TreeNode] Child ${key} (${child.name}) loaded successfully for ${this.id}`);
              child._parent = this;
              this.children.set(key, child);
            } else {
              console.warn(`[TreeNode] Failed to load child with ID ${key}`);
            }
          });
        });
      }
      
      // Subscribe to types changes
      console.log(`[TreeNode] Setting up types subscription for ${this.id}`);
      this.typesSubscription = readFromGunPath(this.typesPath, true);
      if (this.typesSubscription.gunNodeRef) {
        this.typesSubscription.gunNodeRef.map().on((data, key) => {
          if (key === '_') return;
          
          console.log(`[TreeNode] Detected type with key ${key} for node ${this.id}`);
          
          // Check if we already have this type
          const hasType = this.types.some(t => t.id === key);
          if (hasType) {
            console.log(`[TreeNode] Type ${key} already loaded, skipping`);
            return;
          }
          
          // New type detected, load it
          console.log(`[TreeNode] Loading new type with ID ${key}`);
          TreeNode.fromId(key).then(type => {
            if (type) {
              console.log(`[TreeNode] Type ${key} (${type.name}) loaded successfully for ${this.id}`);
              this.types.push(type);
              
              // Update type index
              const root = this.root;
              if (!root.typeIndex.has(type)) {
                root.typeIndex.set(type, new Set());
              }
              root.typeIndex.get(type)?.add(this);
            } else {
              console.warn(`[TreeNode] Failed to load type with ID ${key}`);
            }
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
    }
    
    // Static method to create a TreeNode from Gun ID
    static async fromId(id: string): Promise<TreeNode | null> {
      return Promise.race([
        new Promise<TreeNode | null>((resolve) => {
          console.log(`[TreeNode] Attempting to load node with ID: ${id}`);
          const nodeRef = readFromGunPath(['nodes', id]);
          nodeRef.gunNodeRef.once((data, key) => {
            if (!data) {
              console.log(`[TreeNode] Node ${id} not found in Gun (data is falsy)`);
              resolve(null);
              return;
            }
            
            // Verify it has actual properties beyond Gun metadata
            const hasValidData = Object.keys(data).some(k => k !== '_');
            if (!hasValidData) {
              console.log(`[TreeNode] Node ${id} exists but has no data properties`);
              resolve(null);
              return;
            }
            
            console.log(`[TreeNode.fromId] Raw data from Gun for node ${id}:`, data);
            
            // Clean up data handling - check for name explicitly 
            const name = data.name;
            console.log(`[TreeNode.fromId] Node name from Gun: "${name}" (${typeof name})`);
            
            if (name === undefined) {
              console.warn(`[TreeNode.fromId] Name is undefined for node ${id}, will use 'Unnamed'`);
            }
            
            const node = new TreeNode(
              name || 'Unnamed',
              id,
              null, // Parent will be set by caller
              [] // Types will be loaded via subscription
            );
            
            console.log(`[TreeNode.fromId] Created node with name: "${node.name}" (ID: ${node.id})`);
            
            // Set initial properties
            if (typeof data.points === 'number') {
              node.points = data.points;
            }
            if (data.manualFulfillment !== undefined) {
              node.manualFulfillment = data.manualFulfillment;
            }
            
            // Load types immediately to populate typeIndex
            const typesRef = readFromGunPath(['nodes', id, 'types']);
            typesRef.gunNodeRef.once((typesData) => {
              if (typesData && typeof typesData === 'object') {
                // Filter out Gun metadata
                const typeIds = Object.keys(typesData).filter(k => k !== '_');
                
                if (typeIds.length > 0) {
                  console.log(`[TreeNode] Node ${id} has types: ${typeIds.join(', ')}`);
                  
                  // Load each type
                  Promise.all(typeIds.map(typeId => TreeNode.fromId(typeId)))
                    .then(loadedTypes => {
                      // Filter out nulls
                      const validTypes = loadedTypes.filter(t => t !== null) as TreeNode[];
                      
                      // For each valid type, add this node as an instance
                      validTypes.forEach(type => {
                        node.types.push(type);
                        
                        // Update typeIndex at root level
                        const root = node.root;
                        if (!root.typeIndex.has(type)) {
                          root.typeIndex.set(type, new Set());
                        }
                        root.typeIndex.get(type)?.add(node);
                      });
                    });
                }
              }
            });
            
            resolve(node);
          });
        }),
        // Add a timeout to prevent hanging
        new Promise<null>(resolve => setTimeout(() => {
          console.log(`[TreeNode] Timeout loading node ${id}, assuming it doesn't exist`);
          resolve(null);
        }, 3000))
      ]);
    }
  
    // Add this node as an instance of the given type
    addType(typeOrId: TreeNode | string): TreeNode {
      const root = this.root;
      const typeId = typeof typeOrId === 'string' ? typeOrId : typeOrId.id;
      
      // First get or load the type node
      const getTypeNode = async (): Promise<TreeNode | null> => {
        if (typeof typeOrId === 'string') {
          return TreeNode.fromId(typeOrId);
        }
        return typeOrId;
      };
      
      // Add to Gun immediately
      writeToGunPath([...this.typesPath, typeId], true, true);
      
      // Asynchronously update the type index when we have the type node
      getTypeNode().then(typeNode => {
        if (typeNode) {
          // Add to local types array if not already present
          if (!this.types.some(t => t.id === typeNode.id)) {
            this.types.push(typeNode);
          }
          
          // Update type index
          if (!root.typeIndex.has(typeNode)) {
            root.typeIndex.set(typeNode, new Set());
          }
          root.typeIndex.get(typeNode)?.add(this);
        }
      });
      this.app.updateNeeded = true;
      this.app.pieUpdateNeeded = true;
      
      return this;
    }
  
    removeType(typeOrId: TreeNode | string): TreeNode {
      const root = this.root;
      const typeId = typeof typeOrId === 'string' ? typeOrId : typeOrId.id;
      
      // Remove from Gun
      writeToGunPath([...this.typesPath, typeId], null, true);
      
      // If we have a TreeNode object, update the type index right away
      if (typeof typeOrId !== 'string') {
        const typeNode = typeOrId;
        if (root.typeIndex.has(typeNode)) {
          root.typeIndex.get(typeNode)?.delete(this);
        }
      }
      
      // Remove from local types array
      this.types = this.types.filter(t => t.id !== typeId);
      
      this.app.updateNeeded = true;
      this.app.pieUpdateNeeded = true;
      return this;
    }
  
  
    async addChild(name: string, points: number = 0, manualFulfillment: number = 0, typeIds: string[] = []): Promise<TreeNode> {
      if (this._parent && this.isContribution) {
        throw new Error(
          `Node ${this.name} is an instance of a contributor and cannot have children.`
        );
      }
  
      // Create the child node in Gun first
      const childNodeRef = writeToGunPath(['nodes'], {
        name,
        points,
        manualFulfillment: null
      }, true);
      
      // Wait for Soul ID
      const childId = await new Promise<string>((resolve) => {
        childNodeRef.once((data, key) => {
          const id = data?._?.['#'] || key;
          resolve(id);
        });
      });
      
      console.log(`[TreeNode] Creating child "${name}" with ID ${childId}`);
      
      // Create the TreeNode instance
      const child = new TreeNode(name, childId, this, [], manualFulfillment);
      
      // Add to local children map
      this.children.set(childId, child);
      
      // Add child reference to parent in Gun
      writeToGunPath([...this.childrenPath, childId], true, true);
      
      // Update points
      if (points > 0) {
        child.setPoints(points);
      }
      
      // Add types by ID
      for (const typeId of typeIds) {
        await child.addType(typeId);
      }
      this.app.updateNeeded = true;
      this.app.pieUpdateNeeded = true;      
      return child;
    }
  
    removeChild(childId: string): TreeNode {
      const child = this.children.get(childId);
      if (child) {        
        // Remove from type index
        this.root.typeIndex.forEach(instances => {
          instances.delete(child);
        });
        
        // Remove from children
        this.children.delete(childId);
        
        // Remove from Gun (both directions)
        writeToGunPath([...this.childrenPath, childId], null, true);
        if (child.nodeSubscription && child.nodeSubscription.gunNodeRef) {
          child.unsubscribe();
        }
      }
      this.app.updateNeeded = true;
      this.app.pieUpdateNeeded = true;
      return this;
    }
  
    // Helper method to get all instances of a given type
    getInstances(type: TreeNode): Set<TreeNode> {
      return this.root.typeIndex.get(type) || new Set();
    }
  
    setPoints(points: number): TreeNode {
      console.log(`[TreeNode] Setting points for ${this.name} to ${points}`);
      this.points = points;
      // Update in Gun
      writeToGunPath(this.nodePath, { points });
      this.app.pieUpdateNeeded = true;
      return this;
    }

    get totalChildPoints() {
      return Array.from(this.children.values()).reduce((sum, child) => sum + child.points, 0) || 0;
    }
  
    get weight(): number {
      if (!this._parent) return 1;
      return this._parent.totalChildPoints === 0
        ? 0
        : (this.points / this._parent.totalChildPoints) * this._parent.weight;
    }

    // shareOfParent() -> how many points this node has, as fraction of totalChildPoints.
    // used to distribute contribution/fulfillment upward or across siblings.
    get shareOfParent(): number {
      if (!this._parent) return 1;
      return this._parent.totalChildPoints === 0
        ? 0
        : this.points / this._parent.totalChildPoints;
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
        this.manualFulfillment !== null &&
        this.hasDirectContributionChild
      ) {
        // If we only have contributor children, return manual fulfillment
        if (!this.hasNonContributionChild) {
          return this.manualFulfillment;
        }

        // For hybrid case: combine manual fulfillment for contributor children
        // with calculated fulfillment for non-contributor children
        const contributionChildrenWeight =
          this.contributionChildrenWeight;
        const nonContributionFulfillment =
          this.nonContributionChildrenFulfillment;

        return (
          this.manualFulfillment * contributionChildrenWeight +
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

    setFulfillment(value: number): TreeNode {
      if (!this.hasDirectContributionChild) {
        throw new Error(
          'Can only manually set fulfillment for parents of contributors'
        );
      }
      if (value < 0 || value > 1) {
        throw new Error('Fulfillment must be between 0 and 1');
      }
      this.manualFulfillment = value;
      
      // Update in Gun
      writeToGunPath(this.nodePath, { manualFulfillment: value });
      this.app.pieUpdateNeeded = true;
      return this;
    }

    clearFulfillment(): TreeNode {
      this.manualFulfillment = null;
      
      // Update in Gun
      writeToGunPath(this.nodePath, { manualFulfillment: null });
      this.app.pieUpdateNeeded = true;
      return this;
    }

    get fulfillmentWeight(): number {
      return this.fulfilled * this.weight;
    }

    shareOfGeneralFulfillment(node: TreeNode): number {
      const instances = this.getInstances(node);
      return Array.from(instances).reduce((sum, instance) => {
        const contributorTypesCount = instance.types.filter(type => type.isContributor).length;

        const fulfillmentWeight = instance.fulfilled * instance.weight;

        const weightShare =
          contributorTypesCount > 0
            ? fulfillmentWeight / contributorTypesCount
            : fulfillmentWeight;

        return sum + weightShare;
      }, 0);
    }

    mutualFulfillment(node: TreeNode): number {
      const recognitionFromHere = this.shareOfGeneralFulfillment(node);
      const recognitionFromThere = node.shareOfGeneralFulfillment(this);
      return Math.min(recognitionFromHere, recognitionFromThere);
    }

    get mutualFulfillmentDistribution(): Map<TreeNode, number> {
      const types = Array.from(this.root.typeIndex.keys()).filter(
        type => this.getInstances(type).size > 0
      );

      const rawDistribution = types
        .map(type => ({
          type,
          value: this.mutualFulfillment(type),
        }))
        .filter(entry => entry.value > 0);

      const total = rawDistribution.reduce((sum, entry) => sum + entry.value, 0);

      return new Map(
        rawDistribution.map(entry => [
          entry.type,
          total > 0 ? entry.value / total : 0,
        ])
      );
    }

    
    // D3 Compatibility Methods
    get value() {
      return this.points;
  }

  get childrenArray() {
      const result = Array.from(this.children.values());
      return result;
  }

  get data() {
      return this;
  }

  get hasChildren() {
      return this.children.size > 0;
  }
  
  get descendants() {
      const result: TreeNode[] = [];
      const stack: TreeNode[] = [this];
      while (stack.length) {
          const node = stack.pop();
          if (!node) continue;
          result.push(node);
          stack.push(...node.childrenArray);
      }
      return result;
  }

  get ancestors() {
      const result: TreeNode[] = [];
      let current: TreeNode = this;
      while (current) {
          result.push(current);
          if (!current.parent) break;
          current = current.parent;
      }
      return result;
  }
}
  