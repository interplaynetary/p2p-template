import _ from 'lodash'
import { GunNode, InterfaceStore } from './Store'

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
    points: number = 0;
    typeIndex: Map<TreeNode, Set<TreeNode>>;
    get types() : Set<TreeNode> {
      return new Set(this._types())
    }
    get isContributor() : boolean {
      return !this.parent
      // will be changed with Gun logic!
    }
    get isContribution() : boolean {
      // If any of the types are contributors, then this node is a contribution.
      return Array.from(this.types).some(type => type.isContributor)
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
      this.typeIndex = parent() ? this.root.typeIndex : new Map();
      
      // Then add types after store is ready
      if (this.types.size > 0) {
        // Use Promise.all to handle async type additions
        Array.from(this.types).map(type => {
            const root = this.root;
            if (!root.typeIndex.has(type)) {
                root.typeIndex.set(type, new Set());
            }
            root.typeIndex.get(type)?.add(this);
            this.types.add(type);
            return this;
        })
      }
    }

    // setPoints: mutate self, produce update towards store.
    setPoints(points: number) {
      this.points = points;
      this.store.setPoints(this.id, points);
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
      this.manualFulfillment = value;
      this.store.setFulfillment(this.id, value);
      return this;
    };

    addChild(name: string, points: number = 0, manualFulfillment?: number) {
      return this.store.addChild(this.id, {name, points, manualFulfillment: manualFulfillment || 0})
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
  
    get weight(): number {
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