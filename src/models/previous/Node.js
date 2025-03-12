// subtype trees (planet, city, berlin, kreuzberg)

export class Node {
  constructor(name, parentId = null, typeIds = [], id = null, childrenIds = {}, manualFulfillment = null) {
    this.name = name;
    this.id = id || crypto.randomUUID();
    this._parent = null; // The actual parent reference
    this.parentId = parentId; // Store the parentId directly
    this.points = 0;
    
    // Change from Map to direct storage of object references (for now)
    // We'll use the addNodeChild and related methods to maintain both
    // our internal model and the Gun-compatible structure
    this.children = new Map();
    
    // Gun-style direct childrenIds object with {[id]: true} structure
    this.childrenIds = childrenIds || {};
    
    this.isContributor = !this.parentId; // If no parentId, it's a root node
    this.manualFulfillment = manualFulfillment;
    
    // Change typeIds from Set to object with {[id]: true} structure
    this.typeIds = {};
    if (Array.isArray(typeIds)) {
      typeIds.forEach(id => this.typeIds[id] = true);
    } else if (typeof typeIds === 'object') {
      this.typeIds = {...typeIds}; // Copy the object
    }
    
    // Map of typeId -> Set of instance ids (for our internal model)
    // Only create a new Map if this is a root node (no parentId)
    this.typeIndex = this.parentId ? null : new Map();
    
    // Add each typeId - we'll do this after we resolve the parent reference
  }

  // Get and set parent to update parentId automatically
  get parent() {
    return this._parent;
  }

  set parent(newParent) {
    this._parent = newParent;
    this.parentId = newParent ? newParent.id : null;
    
    // Update typeIndex reference
    if (newParent) {
      this.typeIndex = this.root.typeIndex;
    }
  }

  save() {
    if (this.root.store && !this.root.initializing) {
      // console.log('saving node', this.name, 'to store', this.root.store);
      this.root.store.saveQueue.add(this);
    }
  }

  delete() {
    if (this.root.store && !this.root.initializing) {
      this.root.store.removeNode(this);
    }
  }

  get root() {
    return this.parent ? this.parent.root : this;
  }

  // Helper method to get all typeIds in the system
  get rootTypeIds() {
    return this.typeIndex ? Array.from(this.typeIndex.keys()) : [];
  }

  // Add this node as an instance of the given type
  addType(typeId) {
    // Make sure typeIndex is available
    if (!this.typeIndex) {
      if (this.parent) {
        this.typeIndex = this.root.typeIndex;
      } else {
        this.typeIndex = new Map();
      }
    }
    
    if (!this.typeIndex.has(typeId)) {
      this.typeIndex.set(typeId, new Set());
    }
    this.typeIndex.get(typeId).add(this.id);
    
    // Update the Gun-compatible structure
    this.typeIds[typeId] = true;
    
    // Check if this is a contributor type by looking it up in the store
    const type = this.root.store?.nodes.get(typeId);
    if (type?.isContributor) {
      this.isContributor = true;
    }
    
    this.save();
    this.root.initializing ? null : this.root.updateNeeded = true
    return this;
  }

  removeType(typeId) {
    // Remove from Gun-compatible structure
    delete this.typeIds[typeId];
    
    // Remove from internal typeIndex
    if (this.typeIndex.has(typeId)) {
      this.typeIndex.get(typeId).delete(this.id);
    }

    // Recheck contributor status
    if (!this.parent) {
      this.isContributor = true;
    } else {
      // Look up each type in store to check contributor status
      this.isContributor = Object.keys(this.typeIds).some(tid => {
        const type = this.root.store?.nodes.get(tid);
        return type?.isContributor;
      });
    }    
    this.save();
    this.root.initializing ? null : this.root.updateNeeded = true
    return this;
  }

  addChild(name, points = 0, typeIds = [], id, childrenIds = {}, manualFulfillment = null) {
    if (this.parentId && this.isContributor) {
      throw new Error(
        `Node ${this.name} is an instance of a contributor and cannot have children.`
      );
    }

    // Create child with this node's ID as parentId
    const child = new Node(name, this.id, typeIds, id, childrenIds, manualFulfillment);
    
    // Resolve references to set up the parent-child relationship
    child._parent = this;
    
    // Initialize typeIndex if the child will need it
    if (Object.keys(child.typeIds).length > 0) {
      child.typeIndex = this.root.typeIndex;
      Object.keys(child.typeIds).forEach(typeId => child.addType(typeId));
    }

    // Add to internal children Map
    this.children.set(child.id, child);
    
    // Add to Gun-compatible childrenIds structure
    this.childrenIds[child.id] = true;
    
    if (points > 0) {
      child.setPoints(points);
    }
    this.save();
    this.root.initializing ? null : this.root.updateNeeded = true
    return child;
  }

  addNodeChild(node) {
    // Set up the parent-child relationship
    node._parent = this;
    node.parentId = this.id;
    
    // Initialize typeIndex if needed
    if (!node.typeIndex && Object.keys(node.typeIds).length > 0) {
      node.typeIndex = this.root.typeIndex;
      Object.keys(node.typeIds).forEach(typeId => node.addType(typeId));
    }
    
    // Add the child ID to our childrenIds object (primary storage)
    this.childrenIds[node.id] = true;
    
    // Also maintain our children Map for backward compatibility
    this.children.set(node.id, node);
    
    this.save();
    this.root.initializing ? null : this.root.updateNeeded = true
    return node;
  }

  removeChild(childId) {
    const childToRemove = this.root.store?.nodes.get(childId) || this.children.get(childId);
    if (childToRemove) {
      // Remove from typeIndex
      if (this.typeIndex) {
        this.typeIndex.forEach(instances => {
          instances.delete(childToRemove.id);
        });
      }
      
      // Remove from Gun-compatible childrenIds structure (primary)
      delete this.childrenIds[childToRemove.id];
      
      // Also remove from children Map for backward compatibility
      this.children.delete(childToRemove.id);
    }
    this.save();
    this.root.initializing ? null : this.root.updateNeeded = true
    return this;
  }

  setPoints(points) {
    this.points = points;
    this.save();
    this.root.initializing ? null : this.root.pieUpdateNeeded = true
    return this;
  }

  get totalChildPoints() {
    return Array.from(this.children.values()).reduce((sum, child) => sum + child.points, 0) || 0;
  }

  // Helper method to get all instances of a given type
  getInstances(typeId) {
    return this.typeIndex.get(typeId) || new Set();
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

      const totalPoints = this.totalChildPoints;
      // Return 0 if no children points to avoid division by zero
      return totalPoints > 0 ? contributorPoints / totalPoints : 0;
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
      if (Object.keys(this.childrenIds).length === 0) {
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

  /**
   * @param {number} value
   */
  set fulfilled(value) {
      if (!this.hasDirectContributorChild) {
        throw new Error(
          'Can only manually set fulfillment for parents of contributors'
        );
      }
      if (value < 0 || value > 1) {
        throw new Error('Fulfillment must be between 0 and 1');
      }
      this.manualFulfillment = value;
      this.save();
      return this;
    };

  get fulfillmentWeight() {
    return this.fulfilled * this.weight;
  }

  shareOfGeneralFulfillment(nodeId) {
    const instances = this.typeIndex.get(nodeId) || new Set();
    return Array.from(instances).reduce((sum, instanceId) => {
        const instance = this.root.store?.nodes.get(instanceId);
        if (!instance) return sum;

        // Count contributor types
        const contributorTypesCount = Object.keys(instance.typeIds)
            .filter(tid => {
                const type = this.root.store?.nodes.get(tid);
                return type?.isContributor;
            })
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
    const typeIds = Array.from(this.typeIndex.keys());

    return typeIds.map(typeId => ({
        typeId,
        value: this.shareOfGeneralFulfillment(typeId),
    })).filter(entry => entry.value > 0);
  }

  mutualFulfillment(nodeId) {
    const recognitionFromHere = this.shareOfGeneralFulfillment(nodeId);
    const recognitionFromThere = this.root.store?.nodes.get(nodeId)?.shareOfGeneralFulfillment(this.id) || 0;
    return Math.min(recognitionFromHere, recognitionFromThere);
  }

  get mutualFulfillmentDistribution() {
    const typeIds = Array.from(this.typeIndex.keys()).filter(
        typeId => (this.typeIndex.get(typeId)?.size || 0) > 0
    );

    const rawDistribution = typeIds
        .map(typeId => ({
            typeId,
            value: this.mutualFulfillment(typeId),
        }))
        .filter(entry => entry.value > 0);

    const total = rawDistribution.reduce((sum, entry) => sum + entry.value, 0);

    return new Map(
        rawDistribution.map(entry => [
            entry.typeId,
            total > 0 ? entry.value / total : 0,
        ])
    );
  }

  
  // D3 Compatibility Methods
    get value() {
        return this.points;
    }

    get childrenArray() {
        // Convert from childrenIds object to array of node objects
        return Object.keys(this.childrenIds)
          .map(id => this.root.store?.nodes.get(id))
          .filter(node => node !== undefined);
    }

    get data() {
        return this;
    }

    get hasChildren() {
        return Object.keys(this.childrenIds).length > 0;
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