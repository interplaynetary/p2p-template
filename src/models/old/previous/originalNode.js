// subtype tres (planet, city, berlin, kreuzberg)

export class Node {
    constructor(name, parent = null, types = [], id = null, childrenIds = {}, manualFulfillment = null) {
      this.name = name;
      this.id = id || crypto.randomUUID();
      this.parent = parent;
      this.parentId = () => parent ? parent.id : null;
      this.points = 0;
      this.children = new Map();
      this.childrenIds = childrenIds;
      this.isContributor = !this.parent;
      this._manualFulfillment = manualFulfillment;
      
      // Initialize types as a Set
      this.types = new Set(types);
      
      // Map of type -> Set of instances
      this.typeIndex = parent ? this.root.typeIndex : new Map();
      
      // Initialize update flag
      if (!parent) {
        this.updateNeeded = false;
      }
      
      // Then add types after store is ready
      if (types.length > 0) {
        // Use Promise.all to handle async type additions
        Promise.all(types.map(type => this.addType(type)))
          .catch(err => console.error('Error adding types:', err));
      }
    }
  
    // Persistence transformations
    toGun() {
      // console.log('Converting node to Gun format:', this.name); // Add logging
      
      const data = {
          id: this.id,
          name: this.name,
          parentId: this.parentId(),
          points: Number(this.points) || 0,
          isContributor: Boolean(this.isContributor),
          _manualFulfillment: this._manualFulfillment === null ? 
              null : 
              Number(this._manualFulfillment),
          childrenIds: {},
          typeIds: {}
      };
  
      // Convert children to Gun format
      this.children.forEach(child => {
          if (child && child.id) {
              data.childrenIds[child.id] = true;
          }
      });
  
      // Convert types to Gun format
      this.types.forEach(type => {
          if (type && type.id) {
              data.typeIds[type.id] = true;
          }
      });
  
      // console.log('Converted data:', data); // Add logging
      return data;
    }
  
    static fromGun(data, store) {
      const node = new Node(data.name, null, [], data.id, data.childrenIds, data._manualFulfillment);
      node.points = data.points || 0;
      node.isContributor = data.isContributor || false;
      node._manualFulfillment = data._manualFulfillment?.value ?? null;
      
      // Store ALL relationships for later resolution
      store.pendingRelations.push({
          node,
          parentId: data.parentId,
          typeIds: Object.keys(data.typeIds || {}),
          childrenIds: Object.keys(data.childrenIds || {})  // Include children!
      });
      return node;
    }
  
    save() {
      if (this.root.store /*&& !this.root.initalizing*/) {
        this.root.store.saveQueue.add(this);
      }
    }
  
    delete() {
      if (this.root.store && !this.root.initalizing) {
        this.root.store.removeNode(this);
      }
    }
  
    get root() {
      return this.parent ? this.parent.root : this;
    }
  
    // Helper method to get all types in the system
    get rootTypes() {
      return Array.from(this.root.typeIndex.keys());
    }
  
    // Add this node as an instance of the given type
    addType(type) {
      const root = this.root;
      if (!root.typeIndex.has(type)) {
        root.typeIndex.set(type, new Set());
      }
      root.typeIndex.get(type).add(this);
      this.types.add(type);
      
      if (type.isContributor) {
        this.isContributor = true;
      }
      this.save();
      this.root.initalizing ? this.root.updateNeeded = true : null
      return this;
    }
  
    removeType(type) {
      // Remove from node's types Set
      this.types.delete(type);
      
      const root = this.root;
      if (root.typeIndex.has(type)) {
        root.typeIndex.get(type).delete(this);
      }
  
      // Recheck contributor status
      if (!this.parent) {
        this.isContributor = true;
      } else {
        this.isContributor = Array.from(this.types).some(t => t.isContributor);
      }    
      this.save();
      this.root.updateNeeded = true;
      return this;
    }
  
    addChild(name, points = 0, types = [], id, childrenIds = {},manualFulfillment = null) {
      if (this.parent && this.isContributor) {
        throw new Error(
          `Node ${this.name} is an instance of a contributor and cannot have children.`
        );
      }
  
      const child = new Node(name, this, types, id, childrenIds, manualFulfillment);
  
      this.children.set(name, child);
      if (points > 0) {
        child.setPoints(points);
      }
      this.save();
      this.root.updateNeeded = true;
      return child;
    }
  
    removeChild(name) {
      const child = this.children.get(name);
      if (child) {
        // Update points
        if (child.points > 0) {
          this.totalChildPoints -= child.points;
        }
        // Remove from type index
        this.root.typeIndex.forEach(instances => {
          instances.delete(child);
        });
        // Remove from children
        this.children.delete(name);
      }
      this.save();
      this.root.updateNeeded = true;
      return this;
    }
  
    setPoints(points) {
      // console.log('Setting points for', this.name, points);
      this.points = points;
      this.save();
      this.root.pieUpdateNeeded = true;
      return this;
    }
  
  
    get totalChildPoints() {
      return this.children.values().reduce((sum, child) => sum + child.points, 0) || 0;
    }
  
    // Helper method to get all instances of a given type
    getInstances(type) {
      return this.root.typeIndex.get(type) || new Set();
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
    // 3. If _manualFulfillment is set and node has both contributor and non-contributor children:
    //    merges the manual fulfillment for contributor children with the calculated fulfillment for non-contributor children using a weighted approach.
    // 4. Otherwise falls back to summing child fulfillments * shareOfParent().
  
      get fulfilled() {
        // For leaf nodes (no children)
        if (this.children.size === 0) {
          return this.isContributor ? 1 : 0;
        }
  
        // If fulfillment was manually set and node has contributor children
        if (
          this._manualFulfillment !== null &&
          this.hasDirectContributorChild
        ) {
          // If we only have contributor children, return manual fulfillment
          if (!this.hasNonContributorChild) {
            return this._manualFulfillment;
          }
  
          // For hybrid case: combine manual fulfillment for contributor children
          // with calculated fulfillment for non-contributor children
          const contributorChildrenWeight =
            this.contributorChildrenWeight;
          const nonContributorFulfillment =
            this.nonContributorChildrenFulfillment;
  
          return (
            this._manualFulfillment * contributorChildrenWeight +
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
  
    setFulfillment(value) {
        if (!this.hasDirectContributorChild) {
          throw new Error(
            'Can only manually set fulfillment for parents of contributors'
          );
        }
        if (value < 0 || value > 1) {
          throw new Error('Fulfillment must be between 0 and 1');
        }
        this._manualFulfillment = value;
        this.save();
        return this;
      };
  
    clearFulfillment() {
      this._manualFulfillment = null;
      this.save();
      return this;
    };
  
    get fulfillmentWeight() {
      return this.fulfilled * this.weight;
    }
  
    shareOfGeneralFulfillment(node) {
      const instances = this.root.typeIndex.get(node) || new Set();
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
  
    mutualFulfillment(node) {
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
          const result = [];
          const stack = [this];
          while (stack.length) {
              const node = stack.pop();
              result.push(node);
              stack.push(...node.childrenArray);
          }
          return result;
      }
  
      get ancestors() {
          const result = [];
          let current = this;
          while (current) {
              result.push(current);
              current = current.parent;
          }
          return result;
      }
  }