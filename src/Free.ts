import _ from 'lodash'

// Making the update logic less laggy
// Types as relations (values: any etc.)

// To Gun?

// From Gun
export interface GunNode {
    id: string;
    name: string;
    points: number;
    manualFulfillment: number;
    // Since we are modelling how Gun does, we arent storing the relations directly (since Gun seperates objects and relations)
    // parent: GunNode | null;
    // children: GunNode[];
    // types: GunNode[];
}

export type GunNodeInit = Omit<GunNode, "id"> & {id?: string} // because we dont know ID yet in all cases (addChild)

// we are assembling updates with our on listeners from Gun!
export type Update = {
  id: string;
  type: 'node';
  data: GunNode;
  structural: boolean; // for internal updates vs external updates (gun)
} | {
  type: 'relation';
  key: string;
  value: any;
  // structural: boolean;
}

export interface InterfaceStore {
  setPoints(nodeId: string, points: number): void;
  // inputs TBD
  addChild(parentId: string, init: GunNodeInit): Promise<TreeNode>;
  removeChild(parentId: string, childId: string): Promise<void>;
  addType(nodeId: string, typeId: string): Promise<void>; 
  removeType(nodeId: string, typeId: string): Promise<void>;
}

// soulID -> node
class Store implements InterfaceStore {
    #loading = false;
    #treeRevision = 0
    #rootRevision = 0
    #rootCache: TreeNode | null = null
    cache = new Map<string, GunNode>();
    rootId: string | null;
    protected relations = new Map<string, string[]>(); // parent -> children
    constructor(rootId: string | null = null) {
      this.rootId = rootId
    }
    get root() {
      console.log('root', this.#rootRevision, 'tree', this.#treeRevision)
      if(this.#rootRevision === this.#treeRevision) {
        return this.#rootCache
      }
      this.#rootCache = this.tree(this.rootId)
      this.#rootRevision = this.#treeRevision
      return this.#rootCache
    }
    update(update: Update) {
      if(update.type === 'node') {
        const oldData = this.cache.get(update.id)
        if(!_.isEqual(oldData, update.data)) {
          this.cache.set(update.id, update.data)
          if(update.structural === false) {
            this.#treeRevision++
          }
        }
      } else if(update.type === 'relation') {
        const oldData = this.relations.get(update.key)
        if(!_.isEqual(oldData, update.value)) {
          this.relations.set(update.key, update.value)
          this.#treeRevision++
        }
      }
    }

    protected lookUpRelation<T>(key: string): T {
      return this.relations.get(key) as T
    }

    
  // optimization: parrellel recursive descent operation through tree.
    tree(id = this.rootId, parent: () => TreeNode | null = () => null, nodeCache: Map<string, TreeNode> = new Map()): TreeNode | null {
        // construct the tree of Nodes from the store, resolve the IDs to pass in Nodes to the Node constructor.
        // start from the root, and then recursively build the tree.
        const node = this.cache.get(id)
        if (!node) {
           this.#loading = true
            return null
        }
        const childrenIds = this.lookUpRelation<string[]>(`${id}_children`) || []
        const children = childrenIds.map(childId => this.cache.get(childId))
        const typeIds = this.lookUpRelation<string[]>(`${id}_types`) || []

        const loadedChildren = children.filter(child => child !== null)
        const loading = loadedChildren.length !== childrenIds.length

        if(loading) {
          this.#loading = true
        }

        const treeChildren : TreeNode[] = []

        let treeNode : TreeNode

        for (const child of loadedChildren) {
            const childTree = this.tree(child.id, () => treeNode, nodeCache)
            if (childTree) {
                treeChildren.push(childTree)
            }
        }

        // This type function should find from more than just the nodeCache. (for typeIds)
        const typesFn = () => typeIds.map(typeId => nodeCache.get(typeId)).filter(type => type !== null)

        treeNode = new TreeNode(typesFn, this, node, treeChildren, parent)
        nodeCache.set(id, treeNode)

        // if tree is partial then lets set the flag on the store, and return resolved.
        console.log('Store treeNode', treeNode)
        return treeNode
    }

    setPoints(nodeId: string, points: number) {
      this.update({id: nodeId, type: 'node', data: {...this.cache.get(nodeId), points}, structural: true})
    }

    async addChild(parentId: string = this.rootId, init: GunNodeInit) {
      //this.update({id: node.id, type: 'relation', key: 'children', value: [child.id], local: true})
      throw new Error("Not implemented")
      return null as unknown as TreeNode
    }

    async removeChild(parentId: string = this.rootId, childId: string) {
      this.update({type: 'relation', key: `${parentId}_children`, value: [childId]})
    }

    async addType(nodeId: string = this.rootId, typeId: string) {
      // 
    }

    async removeType(nodeId: string = this.rootId, typeId: string) { }
}

export class GunStore extends Store {
  private constructor(rootNodeId: string) {
    super(rootNodeId)
  }
  static async create(rootNode: GunNode) {
    const store = new GunStore(rootNode.id)
    await store.addChild(null, rootNode)
    return store
  }
  async initialize() {
    // important to not initialize the same node twice.
    // maybe unregister when we get null?
    /*
    user.get(nodeId).map().on((data: any) => {
      console.log('GunStore data', data)
      this.initialize(data.id) // get SOUL
      // from root to leafs, traversing, .map() all children, and .on() to add listeners and sending the data to the store.
    })
    */
   }
  async update(update: Update) {
    super.update(update)
    if(update.type === 'node' && update.structural) {
      await this.updateLocal(update)
    }
  }
  async updateLocal(update: Update) {
    //sendToGun(update)
  }
  async addChild(parentId: string = this.rootId, init: GunNodeInit) {
    // PSEUDO IMPLEMENTATION OF WHAT GUN WILL EVENTUALLY DO SO WE CAN TEST LOCALLY
    const randomID = init.id ?? crypto.randomUUID()
    const child = {...init, id: randomID}
    const oldChildren = this.lookUpRelation<string[]>(`${parentId}_children`) || []
    const updatedChildren = [...oldChildren, child.id]
    await this.update({type: 'relation', key: `${parentId}_children`, value: updatedChildren})
    await this.update({type: 'node', data: child, id: child.id, structural: false})
    
    // set child parent (bidirectional)
    this.update({type: 'relation', key: `${child.id}_parent`, value: parentId})
    
    //gun.put(init) // extract the ID
    // this.update({type: 'node', data: child, id: child.id, local: false}) // update the ID with the id from the GUN ID
    // sendToGun(update) // propogate to network
    const t = this.tree(parentId)
    return t?.children.get(randomID)!
  }
}

// to do: seperate the methods from treeNode that are root specific into their own functions (that accept a tree as input) and keep typeIndex at a global level! (the store level.)

export class TreeNode {
    id: string;
    name: string;
    children: Map<string, TreeNode>;
    childrenIds: string[];
    _parent: () => TreeNode | null;
    get parent() : TreeNode | null {
      return this._parent()
    }
    manualFulfillment: number;
    points: number;
    typeIndex: Map<TreeNode, Set<TreeNode>>;
    get types() : Set<TreeNode> {
      return new Set(this._types())
    }
    get isContributor() : boolean {
      return !this.parent || Array.from(this.types).some(type => type.isContributor)
    }
    constructor(private _types : () => TreeNode[], private store: InterfaceStore, node: GunNode, children: TreeNode[], parent: () => TreeNode | null = () => null) {
      this.id = node.id;
      this.name = node.name;
      this.childrenIds = children.map(child => child.id);
      this.children = new Map(children.map(child => [child.id, child]));
      this.points = node.points;
      this._parent = parent;
      this.manualFulfillment = node.manualFulfillment;
            
      // Map of type -> Set of instances
      this.typeIndex = parent ? this.root.typeIndex : new Map();
      
      // Then add types after store is ready
      if (this.types.size > 0) {
        // Use Promise.all to handle async type additions
        Array.from(this.types).map(type => {
            const root = this.root;
            if (!root.typeIndex.has(type)) {
                root.typeIndex.set(type, new Set());
            }
            root.typeIndex.get(type).add(this);
            this.types.add(type);
            return this;
        })
      }
    }

    // setPoints 1) mutate self, produce update towards store.
    setPoints(points: number) {
      this.points = points;
      this.store.setPoints(this.id, points);
      return this;
    }

    addChild(name: string, points: number = 0) {
      return this.store.addChild(this.id, {name, points, manualFulfillment: null})
    }

    removeChild(childId: string) {
      this.store.removeChild(this.id, childId)
      return this;
    }
  
    addType(typeId: string) {
      this.store.addType(this.id, typeId)
      return this;
    }

    removeType(typeId: string) {
      this.store.removeType(this.id, typeId)
      return this;
    }

    get root(): TreeNode {
      return this.parent ? this.parent.root : this;
    }
  
    get totalChildPoints() {
      return Array.from(this.children.values()).reduce((sum, child) => sum + child.points, 0) || 0;
    }
  
    get weight() {
      if (!this.parent) return 1;
      return this.parent.totalChildPoints === 0
        ? 0
        : (this.points / this.parent.totalChildPoints) * this.parent.weight;
    }
  
    // shareOfParent() -> how many points this node has, as fraction of totalChildPoints.
    // used to distribute contribution/fulfillment upward or across siblings.
    get shareOfParent() {
        if (!this.parent) return 1;
        return this.parent.totalChildPoints === 0
          ? 0
          : this.points / this.parent.totalChildPoints;
      };
  
    get hasDirectContributorChild() {
        return Array.from(this.children.values()).some(
          child => child.isContributor
        );
    };
      
    get hasNonContributorChild() {
        return Array.from(this.children.values()).some(
          child => !child.isContributor
        );
    };
  
    get contributorChildrenWeight () {
        const contributorPoints = Array.from(this.children.values())
          .filter(child => child.isContributor)
          .reduce((sum, child) => sum + child.points, 0);
  
        return contributorPoints / this.totalChildPoints;
    };
  
    get contributorChildrenFulfillment() {
        const contributorChildren = Array.from(this.children.values()).filter(
          child => child.isContributor
        );
  
        return contributorChildren.reduce(
          (sum, child) => sum + child.fulfilled * child.shareOfParent,
          0
        );
      };
  
    get nonContributorChildrenFulfillment () {
        const nonContributorChildren = Array.from(this.children.values()).filter(
          child => !child.isContributor
        );
  
        return nonContributorChildren.reduce(
          (sum, child) => sum + child.fulfilled * child.shareOfParent,
          0
        );
      };
  
      
    // The core method: fulfilled():
    // 1. Leaf nodes with isContributor == true → full 1.0 fulfillment
    // 2. Leaf nodes with isContributor == false → 0
    // 3. If manualFulfillment is set and node has both contributor and non-contributor children:
    //    merges the manual fulfillment for contributor children with the calculated fulfillment for non-contributor children using a weighted approach.
    // 4. Otherwise falls back to summing child fulfillments * shareOfParent().
  
    get fulfilled() {
      // For leaf nodes (no children)
      if (this.children.size === 0) {
        return this.isContributor ? 1 : 0;
      }

      // If fulfillment was manually set and node has contributor children
      if (
        this.manualFulfillment !== null &&
        this.hasDirectContributorChild
      ) {
        // If we only have contributor children, return manual fulfillment
        if (!this.hasNonContributorChild) {
          return this.manualFulfillment;
        }

        // For hybrid case: combine manual fulfillment for contributor children
        // with calculated fulfillment for non-contributor children
        const contributorChildrenWeight =
          this.contributorChildrenWeight;
        const nonContributorFulfillment =
          this.nonContributorChildrenFulfillment;

        return (
          this.manualFulfillment * contributorChildrenWeight +
          nonContributorFulfillment * (1 - contributorChildrenWeight)
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


    
    // THIS SHOULD NOT BE HERE! WE WANT NON-MUTABLE

    setFulfillment(value: number) {
        if (!this.hasDirectContributorChild) {
          throw new Error(
            'Can only manually set fulfillment for parents of contributors'
          );
        }
        if (value < 0 || value > 1) {
          throw new Error('Fulfillment must be between 0 and 1');
        }
        this.manualFulfillment = value;
        return this;
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