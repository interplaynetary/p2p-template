import _ from 'lodash'
import { GunNode } from './Store'

// Import our FuncGun utilities
import { writeToGunPath, readFromGunPath } from '../FuncGun'

// Define GunSubscription type if not available
type GunSubscription = {
  gunNodeRef: any;
  data: any;
};

// TODO:
// Making the update logic less laggy
// Types as relations (values: any etc.) any node can be a type!

// isContributor = GUN User (instead of just parentless node)

// Retroactive recognition:
// type -> contributor relation! (so you can change the mapping between a type, and the contributor it represents.)
// - this is particularly helpful for recognizing contributions from users that arent even registered as actual users yet! And then retroactively binding the type to the contributor/user

// How can we make better abstractions in our TreeMap.ts?

// to do: seperate the methods from treeNode that are root specific into their own functions (that accept a tree as input) and keep typeIndex at a global level! (the store level.)

// REPRESENTING TYPES:

// our store should have :: 

// Static TreeNode factory functions to replace store dependency
export async function createTreeNodeFromPath(path: string[], parentProvider: () => TreeNode | null = () => null): Promise<TreeNode | null> {
  const nodeData = await new Promise<any>(resolve => {
    const nodeRef = readFromGunPath(path);
    nodeRef.gunNodeRef.once((data, key) => {
      if (!data) {
        resolve(null);
        return;
      }
      const id = data._?.['#'] || key;
      resolve({...data, id});
    });
  });
  
  if (!nodeData) {
    return null;
  }
  
  // Create the TreeNode first, before loading children
  
  // Use a dummy types function initially that NEVER accesses treeNode
  const safeTypesFunc = () => [];
  
  // Create the TreeNode with the data we have
  const treeNode = new TreeNode(
    safeTypesFunc,  // Start with safe types function that won't cause circular references
    nodeData,        // Node data
    [],              // Start with empty children array
    parentProvider   // Parent provider function
  );
  
  // Now load children and types asynchronously
  
  // Get children IDs
  const childrenPath = [...path, 'children'];
  const childrenData = await new Promise<string[]>(resolve => {
    const childrenRef = readFromGunPath(childrenPath);
    childrenRef.gunNodeRef.once((data, key) => {
      if (!data || typeof data !== 'object') {
        resolve([]);
        return;
      }
      // Convert Gun's set-like object to array of IDs
      const childIds = Object.keys(data).filter(k => k !== '_');
      resolve(childIds);
    });
  });
  
  // Get types IDs
  const typesPath = [...path, 'types'];
  const typesData = await new Promise<string[]>(resolve => {
    const typesRef = readFromGunPath(typesPath);
    typesRef.gunNodeRef.once((data, key) => {
      if (!data || typeof data !== 'object') {
        resolve([]);
        return;
      }
      // Convert Gun's set-like object to array of IDs
      const typeIds = Object.keys(data).filter(k => k !== '_');
      resolve(typeIds);
    });
  });
  
  // Load children nodes after TreeNode is created
  let loadedChildren = 0;
  
  if (childrenData.length > 0) {
    // Create a stable parent reference provider
    const parentRef = () => treeNode;
    
    const childrenPromises = childrenData.map(childId => 
      createTreeNodeFromPath(['nodes', childId], parentRef)
        .then(node => {
          loadedChildren++;
          if (node) {
            // Add child to parent's children map
            treeNode.children.set(childId, node);
            treeNode.childrenIds.push(childId);
          }
          return node;
        })
    );
    
    // Wait for all children to load
    await Promise.all(childrenPromises);
  }
  
  // Set up types loader
  if (typesData.length > 0) {
    // We'll load types asynchronously to avoid circular references
    treeNode._typesLoader = async () => {
      const typesPromises = typesData.map(typeId => 
        createTreeNodeFromPath(['nodes', typeId])
      );
      const types = (await Promise.all(typesPromises)).filter((node): node is TreeNode => node !== null);
      return types;
    };
    
    // Don't immediately call the loader to avoid circular references
    // Instead, schedule it for the next tick
    setTimeout(() => {
      treeNode._typesLoader!().then(types => {
        treeNode._cachedTypes = types;
        
        // Update typeIndex after types are loaded
        if (types.length > 0) {
          const root = treeNode.root;
          types.forEach(type => {
            if (!root.typeIndex.has(type)) {
              root.typeIndex.set(type, new Set());
            }
            root.typeIndex.get(type)?.add(treeNode);
          });
        }
      });
    }, 0);
  }
  
  return treeNode;
}

// Create a root node directly from Gun
export async function createRootTreeNode(name: string, points: number = 0): Promise<TreeNode> {
  // Create a new node in Gun
  const nodeRef = writeToGunPath(['nodes'], {
    name,
    points,
    manualFulfillment: 0
  }, true);
  
  // Wait for Soul ID
  const nodeId = await new Promise<string>(resolve => {
    nodeRef.once((data, key) => {
      const id = data._?.['#'] || key;
      resolve(id);
    });
  });
  
  // Create and return a TreeNode from the new node
  const node = await createTreeNodeFromPath(['nodes', nodeId]);
  if (!node) {
    throw new Error('Failed to create root node');
  }
  
  return node;
}

export class TreeNode {
    id: string;
    name: string;
    nodeSubscription: GunSubscription;
    childrenSubscription: GunSubscription;
    typesSubscription: GunSubscription;
    children: Map<string, TreeNode> = new Map();
    childrenIds: string[] = [];
    _parent: () => TreeNode | null;
    _cachedTypes: TreeNode[] | null = null;
    _typesLoader: (() => Promise<TreeNode[]>) | null = null;
    
    get parent() : TreeNode | null {
      return this._parent()
    }
    
    // Get root node (either this node or the topmost parent)
    get root() : TreeNode {
      const parent = this.parent;
      return parent ? parent.root : this;
    }
    
    manualFulfillment: number = 0;
    points: number = 0;
    typeIndex: Map<TreeNode, Set<TreeNode>>;

    // Paths for Gun operations
    get nodePath() {
      return ['nodes', this.id];
    }

    get childrenPath() {
      return ['nodes', this.id, 'children'];
    }

    get typesPath() {
      return ['nodes', this.id, 'types'];
    }

    get types() : Set<TreeNode> {
      // During initialization, always return empty set
      // This prevents any circular references during construction
      if (!this._typesInitialized) {
        // Mark that we've reached initialization stage for types
        // We'll set this to true after a short delay
        setTimeout(() => {
          this._typesInitialized = true;
        }, 0);
        return new Set();
      }
      
      return new Set(this.getTypes());
    }
    
    // Add a property to track whether types have been initialized
    private _typesInitialized: boolean = false;
    
    // Method to get types, used by the getter
    private getTypes(): TreeNode[] {
      // If we have cached types, return them
      if (this._cachedTypes) {
        return this._cachedTypes;
      }
      
      // If we have a typesLoader, start loading asynchronously 
      if (this._typesLoader) {
        // Just trigger the loading but don't wait for it
        setTimeout(() => {
          this._typesLoader!().then(types => {
            this._cachedTypes = types;
            
            // Update typeIndex after types are loaded
            if (types.length > 0) {
              const root = this.root;
              types.forEach(type => {
                if (!root.typeIndex.has(type)) {
                  root.typeIndex.set(type, new Set());
                }
                root.typeIndex.get(type)?.add(this);
              });
            }
          });
        }, 0);
        
        // Return empty array while loading
        return [];
      }
      
      try {
        // If no loader but _types function exists, use that
        return this._types();
      } catch (error) {
        return [];
      }
    }
    
    get isContributor() : boolean {
      return !this.parent
      // will be changed with Gun logic!
    }
    
    get isContribution() : boolean {
      // If any of the types are contributors, then this node is a contribution.
      return Array.from(this.types).some(type => type.isContributor)
    }
    
    constructor(
      private _types : () => TreeNode[], 
      node: GunNode, 
      children: TreeNode[] = [], 
      parent: () => TreeNode | null = () => null
    ) {
      this.id = node.id;
      this.name = node.name || "";
      this.points = typeof node.points === 'number' ? node.points : 0;
      this.manualFulfillment = typeof node.manualFulfillment === 'number' ? 
        node.manualFulfillment : 0;
      
      // Store parent reference provider (deferred resolution)
      this._parent = parent;
      
      // Add child nodes if provided
      if (children.length > 0) {
        this.childrenIds = children.map(child => child.id);
        this.children = new Map(children.map(child => [child.id, child]));
      }
      
      // Initialize typeIndex with a lazy getter to avoid accessing this.root before construction
      // IMPORTANT: Don't access any property that would call this.types during initialization
      const initTypeIndex = () => {
        const parentNode = parent();
        return parentNode ? parentNode.root.typeIndex : new Map();
      };
      this.typeIndex = initTypeIndex();

      // Set up subscriptions to Gun paths - must happen after all properties are set
      this.nodeSubscription = readFromGunPath(this.nodePath);
      this.childrenSubscription = readFromGunPath(this.childrenPath);
      this.typesSubscription = readFromGunPath(this.typesPath);
      
      this.setupSubscriptions();
    }

    // Set up reactive subscriptions to Gun data
    setupSubscriptions() {
      // Subscribe to this node's data
      this.nodeSubscription = readFromGunPath(this.nodePath, true);
      
      // When node data changes, update local properties
      if (this.nodeSubscription && this.nodeSubscription.gunNodeRef) {
        this.nodeSubscription.gunNodeRef.on((data, key) => {
          if (data) {
            this.name = data.name || this.name;
            this.points = typeof data.points === 'number' ? data.points : this.points;
            this.manualFulfillment = typeof data.manualFulfillment === 'number' ? 
              data.manualFulfillment : this.manualFulfillment;
          }
        });
      }

      // Subscribe to children changes
      this.childrenSubscription = readFromGunPath(this.childrenPath, true);
      
      // Watch for new children and automatically create TreeNodes
      if (this.childrenSubscription && this.childrenSubscription.gunNodeRef) {
        this.childrenSubscription.gunNodeRef.map().on((data, key) => {
          // Skip metadata or already existing children
          if (key === '_' || this.children.has(key)) {
            return;
          }
          
          // Create a stable parent reference provider for this node
          const parentRef = () => this;
          
          // New child detected, create a TreeNode for it
          createTreeNodeFromPath(['nodes', key], parentRef).then(node => {
            if (node) {
              this.children.set(key, node);
              // Only add to childrenIds if not already there
              if (!this.childrenIds.includes(key)) {
                this.childrenIds.push(key);
              }
            }
          });
        });
      }
      
      // Subscribe to types changes
      this.typesSubscription = readFromGunPath(this.typesPath, true);
      
      // Watch for type changes
      if (this.typesSubscription && this.typesSubscription.gunNodeRef) {
        this.typesSubscription.gunNodeRef.map().on((data, key) => {
          if (key !== '_') {
            // Force a refresh of types
            this._cachedTypes = null;
            
            // If we haven't already loaded types at least once, set up the loader
            if (!this._typesLoader) {
              this._typesLoader = async () => {
                const typeIds = Object.keys(this.typesSubscription.data || {})
                  .filter(k => k !== '_');
                  
                if (typeIds.length === 0) {
                  return [];
                }
                
                const typesPromises = typeIds.map(typeId => 
                  createTreeNodeFromPath(['nodes', typeId])
                );
                
                const types = (await Promise.all(typesPromises))
                  .filter((node): node is TreeNode => node !== null);
                  
                return types;
              };
            }
            
            // Start loading types asynchronously
            this._typesLoader().then(types => {
              this._cachedTypes = types;
              
              // Update typeIndex
              const root = this.root;
              types.forEach(type => {
                if (!root.typeIndex.has(type)) {
                  root.typeIndex.set(type, new Set());
                }
                root.typeIndex.get(type)?.add(this);
              });
            });
          }
        });
      }
    }

    // Clean up subscriptions when no longer needed
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

    // setPoints: Use path-based writing instead of direct store call
    setPoints(points: number) {
      // Update Gun data
      writeToGunPath(this.nodePath, { points });
      
      // Local update happens via subscription
      return this;
    }

    setFulfillment(value: number) {
      if (!this.hasDirectContributorChild) {
        throw new Error(
          'Can only manually set fulfillment for parents of contributions'
        );
      }
      if (value < 0 || value > 1) {
        throw new Error('Fulfillment must be between 0 and 1');
      }
      
      // Update Gun data
      writeToGunPath(this.nodePath, { manualFulfillment: value });
      
      // Local update happens via subscription
      return this;
    };

    async addChild(name: string, points: number = 0, manualFulfillment?: number) {
      // Create child node first
      const childNodeRef = writeToGunPath(['nodes'], {
        name, 
        points, 
        manualFulfillment: manualFulfillment || 0
      }, true);
      
      // Wait for Soul ID to be generated
      return new Promise<TreeNode>(resolve => {
        childNodeRef.once((data, key) => {
          const childId = data._?.['#'] || key;
          
          // Add child reference using Gun's set-like structure
          writeToGunPath([...this.childrenPath, childId], true, true);
          
          // Add parent reference to child (bidirectional)
          writeToGunPath(['nodes', childId, 'parent'], this.id);
          
          // Create TreeNode directly using our factory function
          createTreeNodeFromPath(['nodes', childId], () => this).then(node => {
            if (node) {
              // Add to local children map (for immediate access before subscription updates)
              this.children.set(childId, node);
              this.childrenIds.push(childId);
              resolve(node);
            } else {
              throw new Error('Failed to create child node');
            }
          });
        });
      });
    }

    removeChild(childId: string) {
      // Remove child reference using Gun's null to remove
      writeToGunPath([...this.childrenPath, childId], null, true);
      
      // Remove parent reference from child
      writeToGunPath(['nodes', childId, 'parent'], null);
      
      // Remove from local children map (for immediate feedback before subscription updates)
      this.children.delete(childId);
      this.childrenIds = this.childrenIds.filter(id => id !== childId);
      
      return this;
    }
  
    async addType(typeId: string) {
      // Add type reference to node using Gun's set-like object structure
      writeToGunPath([...this.typesPath, typeId], true, true);
      
      // Invalidate types cache to force reload
      this._cachedTypes = null;
      
      // Get the type node and update typeIndex
      const typeNode = await createTreeNodeFromPath(['nodes', typeId]);
      if (typeNode) {
        if (!this.root.typeIndex.has(typeNode)) {
          this.root.typeIndex.set(typeNode, new Set());
        }
        this.root.typeIndex.get(typeNode)?.add(this);
      }
      
      return this;
    }

    async removeType(typeId: string) {
      // Remove type reference using Gun's null to remove
      writeToGunPath([...this.typesPath, typeId], null, true);
      
      // Invalidate types cache to force reload
      this._cachedTypes = null;
      
      // Update typeIndex (if we can find the type node)
      const typeNode = await createTreeNodeFromPath(['nodes', typeId]);
      if (typeNode && this.root.typeIndex.has(typeNode)) {
        this.root.typeIndex.get(typeNode)?.delete(this);
      }
      
      return this;
    }

    // The rest of the TreeNode class remains largely the same
    // These methods just use the local state which is kept up-to-date via subscriptions
    
    get totalChildPoints() {
      return Array.from(this.children.values()).reduce((sum, child) => sum + child.points, 0) || 0;
    }
  
    get weight(): number {
      if (!this.parent) return 1;
      return this.parent.totalChildPoints === 0
        ? 0
        : (this.points / this.parent.totalChildPoints) * this.parent.weight;
    }
    
    get shareOfParent() {
        if (!this.parent) return 1;
        return this.parent.totalChildPoints === 0
          ? 0
          : this.points / this.parent.totalChildPoints;
      };
  
    get hasDirectContributorChild() {
        return Array.from(this.children.values()).some(
          child => child.isContribution
        );
    };
      
    get hasNonContributorChild() {
        return Array.from(this.children.values()).some(
          child => !child.isContribution
        );
    };
  
    get contributionChildrenWeight () {
        const contributionPoints = Array.from(this.children.values())
          .filter(child => child.isContribution)
          .reduce((sum, child) => sum + child.points, 0);
  
        return contributionPoints / this.totalChildPoints;
    };
  
    get contributionChildrenFulfillment() {
        const contributionChildren = Array.from(this.children.values()).filter(
          child => child.isContribution
        );
  
        return contributionChildren.reduce(
          (sum, child) => sum + child.fulfilled * child.shareOfParent,
          0
        );
      };
  
    get nonContributorChildrenFulfillment(): number {
        const nonContributorChildren = Array.from(this.children.values()).filter(
          child => !child.isContribution
        );
        return nonContributorChildren.reduce(
          (sum, child) => sum + child.fulfilled * child.shareOfParent,
          0
        );
      };
  
      
    // The core method: fulfilled():
    // 1. Leaf nodes with isContribution == true → full 1.0 fulfillment
    // 2. Leaf nodes with isContribution == false → 0
    // 3. If manualFulfillment is set and node has both contribution and non-contribution children:
    //    merges the manual fulfillment for contribution children with the calculated fulfillment for non-contribution children using a weighted approach.
    // 4. Otherwise falls back to summing child fulfillments * shareOfParent().
  
    get fulfilled(): number {
      // For leaf nodes (no children)
      if (this.children.size === 0) {
        return this.isContribution ? 1 : 0;
      }

      // If fulfillment was manually set and node has contribution children
      if (
        this.manualFulfillment !== null &&
        this.hasDirectContributorChild
      ) {
        // If we only have contribution children, return manual fulfillment
        if (!this.hasNonContributorChild) {
          return this.manualFulfillment;
        }

        // For hybrid case: combine manual fulfillment for contribution children
        // with calculated fulfillment for non-contribution children
        const contributionChildrenWeight =
          this.contributionChildrenWeight;
        const nonContributorFulfillment =
          this.nonContributorChildrenFulfillment;

        return (
          this.manualFulfillment * contributionChildrenWeight +
          nonContributorFulfillment * (1 - contributionChildrenWeight)
        );
      }

      // Default case: calculate from all children
      return Array.from(this.children.values()).reduce(
        (sum, child) => sum + child.fulfilled * child.shareOfParent,
        0
      );
    };

    get desire() {
      return 1 - this.fulfilled;
    };

    get fulfillmentWeight() {
      return this.fulfilled * this.weight;
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

    // Helper method to get all instances of a given type
    getInstances(type: TreeNode) {
      return this.root.typeIndex.get(type) || new Set();
    }

    shareOfGeneralFulfillment(node: TreeNode) {
      const instances = this.getInstances(node)
      return Array.from(instances).reduce((sum, instance) => {
          // Convert types Set to Array before filtering
          const contributorTypesCount = Array.from(instance.types)
              .filter(type => type.isContributor)
              .length;
  
          const fulfillmentWeight = instance.fulfilled * instance.weight;
  
          const weightShare =
              contributorTypesCount > 0
                  ? fulfillmentWeight / contributorTypesCount
                  : fulfillmentWeight;
  
          return sum + weightShare;
      }, 0);
    }
  
    get shareOfGeneralFulfillmentDistribution() {
      const types = Array.from(this.root.typeIndex.keys())
  
      return types.map(type => ({
          type,
          value: this.shareOfGeneralFulfillment(type),
      })).filter(entry => entry.value > 0);
    }
  
    mutualFulfillment(node: TreeNode) {
      const recognitionFromHere = this.shareOfGeneralFulfillment(node);
      const recognitionFromThere = node.shareOfGeneralFulfillment(this);
      return Math.min(recognitionFromHere, recognitionFromThere);
    }
      
    get mutualFulfillmentDistribution() {
      // Convert typeIndex keys to Array
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
}