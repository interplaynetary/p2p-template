class Node {
  constructor(name, parent = null, types = []) {
    this.name = name;
    this.parent = parent;
    this.points = 0;
    this.children = new Map();
    this.totalChildPoints = 0;
    this.isContributor = this.parent ? false : true;
    this._manualFulfillment = null;

    this.types = types;
    // Map of type -> Set of instances
    this.typeIndex = parent ? parent.root.typeIndex : new Map();

    if (types.length > 0) {
      types.forEach(type => {
        this.addType(type);
        if (type.isContributor) {
          this.isContributor = true;
        }
      });
    }
    this.shareOfParent = () => {
      if (!this.parent) return 1;
      return this.parent.totalChildPoints === 0
        ? 0
        : this.points / this.parent.totalChildPoints;
    };

    this.hasDirectContributorChild = () => {
      return Array.from(this.children.keys()).some(
        child => child.isContributor
      );
    };

    this.hasNonContributorChild = () => {
      return Array.from(this.children.keys()).some(
        child => !child.isContributor
      );
    };

    this.calculateContributorChildrenWeight = () => {
      const contributorPoints = Array.from(this.children.keys())
        .filter(child => child.isContributor)
        .reduce((sum, child) => sum + child.points, 0);

      return contributorPoints / this.totalChildPoints;
    };

    this.calculateContributorChildrenFulfillment = () => {
      const contributorChildren = Array.from(this.children.keys()).filter(
        child => child.isContributor
      );

      return contributorChildren.reduce(
        (sum, child) => sum + child.fulfilled() * child.shareOfParent(),
        0
      );
    };

    this.calculateNonContributorChildrenFulfillment = () => {
      const nonContributorChildren = Array.from(this.children.keys()).filter(
        child => !child.isContributor
      );

      return nonContributorChildren.reduce(
        (sum, child) => sum + child.fulfilled() * child.shareOfParent(),
        0
      );
    };

    this.fulfilled = () => {
      // For leaf nodes (no children)
      if (this.children.size === 0) {
        return this.isContributor ? 1 : 0;
      }

      // If fulfillment was manually set and node has contributor children
      if (
        this._manualFulfillment !== null &&
        this.hasDirectContributorChild()
      ) {
        // If we only have contributor children, return manual fulfillment
        if (!this.hasNonContributorChild()) {
          return this._manualFulfillment;
        }

        // For hybrid case: combine manual fulfillment for contributor children
        // with calculated fulfillment for non-contributor children
        const contributorChildrenWeight =
          this.calculateContributorChildrenWeight();
        const nonContributorFulfillment =
          this.calculateNonContributorChildrenFulfillment();

        return (
          this._manualFulfillment * contributorChildrenWeight +
          nonContributorFulfillment * (1 - contributorChildrenWeight)
        );
      }

      // Default case: calculate from all children
      return Array.from(this.children.keys()).reduce(
        (sum, child) => sum + child.fulfilled() * child.shareOfParent(),
        0
      );
    };

    this.desire = () => 1 - this.fulfilled();

    this.setFulfillment = value => {
      if (!this.hasDirectContributorChild()) {
        throw new Error(
          'Can only manually set fulfillment for parents of contributors'
        );
      }
      if (value < 0 || value > 1) {
        throw new Error('Fulfillment must be between 0 and 1');
      }
      this._manualFulfillment = value;
      return this;
    };

    this.clearFulfillment = () => {
      this._manualFulfillment = null;
      return this;
    };
  }

  // Add this node as an instance of the given type
  addType(type) {
    //console.log(`\nAdding type ${type.name} to ${this.name}`);

    const root = this.root;
    if (!root.typeIndex.has(type)) {
      root.typeIndex.set(type, new Set());
    }
    root.typeIndex.get(type).add(this);

    // Debug verification
    // console.log(`After adding type ${type.name} to ${this.name}:`);
    // console.log(`- Instances:`, Array.from(root.typeIndex.get(type)).map(i => i.name));

    return this;
  }

  removeType(type) {
    const root = this.root;
    root.typeIndex.get(type).delete(this);
  }

  addChild(name, points = 0, types = []) {
    if (this.parent && this.isContributor) {
      throw new Error(
        `Node ${this.name} is an instance of a contributor and cannot have children.`
      );
    }

    const child = new Node(name, this);

    // Ensure types are properly added
    if (Array.isArray(types)) {
      types.forEach(type => child.addType(type));
    } else if (types) {
      // Handle single type case
      child.addType(types);
    }

    this.children.set(child, new Map());
    if (points > 0) {
      child.setPoints(points);
    }
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
    return this;
  }

  get root() {
    return this.parent ? this.parent.root : this;
  }

  // Helper method to get all types in the system
  get types() {
    return Array.from(this.root.typeIndex.keys());
  }

  // Helper method to get all instances of a given type
  getInstances(type) {
    return this.root.typeIndex.get(type) || new Set();
  }

  setPoints(points) {
    const diff = points - this.points;
    if (this.parent) {
      this.parent.totalChildPoints += diff;
    }
    this.points = points;
    return this;
  }

  get weight() {
    if (!this.parent) return 1;
    return this.parent.totalChildPoints === 0
      ? 0
      : (this.points / this.parent.totalChildPoints) * this.parent.weight;
  }

  get fulfillmentWeight() {
    return this.fulfilled() * this.weight;
  }

  shareOfGeneralFulfillment(node) {
    const instances = this.root.typeIndex.get(node) || new Set();
    return Array.from(instances).reduce((sum, instance) => {
      const contributorTypesCount = instance.types.filter(
        type => type.isContributor
      ).length;

      const fulfillmentWeight = instance.fulfilled() * instance.weight;

      const weightShare =
        contributorTypesCount > 0
          ? fulfillmentWeight / contributorTypesCount
          : fulfillmentWeight;

      return sum + weightShare;
    }, 0);
  }

  mutualFulfillment(node) {
    const recognitionFromHere = this.shareOfGeneralFulfillment(node);
    const recognitionFromThere = node.shareOfGeneralFulfillment(this);
    return Math.min(recognitionFromHere, recognitionFromThere);
  }

  get mutualFulfillmentDistribution() {
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

/*
**Implications of Desire and Fulfillment at an Organizational Level in a Free Association Framework**  
*(10-Paragraph Expert Analysis)*  

---

### **1. Organizational Legitimacy Rooted in Mutual Recognition**  
In traditional hierarchies, legitimacy flows from formal authority (e.g., titles, ownership). In free association, legitimacy emerges from **demonstrated contributions to others’ self-actualization**. Desire and fulfillment become the twin pillars of organizational coherence:  
- **Desire** reflects unmet needs, driving individuals to seek collaborators.  
- **Fulfillment** quantifies how well others’ contributions satisfy those needs.  
This flips the capitalist logic of "control via ownership" to "validation via reciprocity." Organizations no longer rely on coercive structures (e.g., wages, contracts) but on **sustained mutual recognition**—relations persist only if both parties actively desire participation and recognize each other’s contributions.  

---

### **2. Desire as a Dynamic Feedback Mechanism**  
Desire operates as a **self-correcting signal** in the system:  
- If an individual’s fulfillment is low, their desire to seek new collaborators rises.  
- If fulfillment is high, desire shifts toward maintaining or deepening existing associations.  
At scale, this creates **emergent prioritization**: contributors gravitate toward roles where their efforts yield the highest mutual recognition. Unlike market-driven "supply and demand," this prioritization is grounded in **intersubjective validation**—contributors organically align with roles that others *genuinely value*, not just roles that maximize profit.  

---

### **3. Fulfillment as a Measure of Social-Material Truth**  
Fulfillment is not abstract—it reflects **material and social utility**. For example:  
- A farmer’s fulfillment depends on how many people recognize their crops as meeting nutritional needs.  
- A teacher’s fulfillment hinges on students’ acknowledgment of their pedagogical contributions.  
When fulfillment is high, it signals that contributions are **materially effective** and **socially meaningful**. Conversely, low fulfillment exposes mismatches (e.g., redundant labor, misaligned priorities), prompting systemic recalibration. This creates a "truth-tracking" mechanism where **false contributions** (e.g., performative work) decay due to lack of recognition.  

---

### **4. Dissolution of Hierarchical Power Structures**  
Capitalist hierarchies enforce compliance through **asymmetric control** (e.g., bosses over workers). In free association, power distributes according to **networked reciprocity**:  
- Leaders exist only insofar as their contributions are widely recognized.  
- Authority is **ephemeral**, dissolving when contributions cease to fulfill others.  
This mirrors **natural systems** (e.g., ant colonies, neural networks) where coordination emerges bottom-up. The absence of fixed hierarchies eliminates "office politics" and redirects energy toward **real problem-solving**.  

---

### **5. Surplus Distribution as a Mirror of Social Trust**  
Surplus (roles one holds but does not desire) flows to those who’ve earned recognition through prior contributions. This creates a **virtuous cycle**:  
- Contributors with high fulfillment gain access to surplus resources, enabling further contributions.  
- Free riders, lacking recognition, are excluded from surplus networks.  
Unlike capitalist accumulation (hoarding resources via ownership), surplus here acts as **social capital**—a collective endorsement of one’s value to the community.  

---

### **6. Sustainability Through Decentralized Accountability**  
In capitalism, accountability is enforced externally (e.g., audits, layoffs). Free association internalizes accountability via **transitive recognition**:  
- If A recognizes B, and B recognizes C, A indirectly validates C’s contributions.  
- Breakdowns in one relationship ripple through the network, incentivizing repair.  
This creates **fault-tolerant coordination**: the system self-heals as contributors reorient toward functional associations, avoiding centralized oversight.  

---

### **7. Contradiction and Collapse of Coercive Systems**  
Capitalist and state structures rely on **asymmetric recognition** (e.g., shareholders over workers, rulers over citizens). Free association erodes these by exposing their **social-material falsehoods**:  
- A factory owner’s claim to "produce goods" collapses when workers organize directly with suppliers/consumers.  
- A state’s claim to "maintain order" weakens as communities self-coordinate disaster relief.  
These contradictions accelerate as free association demonstrates that **coercion is unnecessary** for large-scale coordination.  

---

### **8. Self-Governance Through Compositional Relations**  
Complex organizations emerge via **nesting associations**:  
- Small teams (direct mutual recognition) → Federations (transitive recognition) → Global networks.  
At each level, fulfillment and desire propagate without central planners. For example, a hospital might form through the association of doctors, nurses, and technicians, each validating contributions within their roles. This mirrors **open-source software development**, where decentralized collaboration yields robust systems.  

---

### **9. Adaptive Learning via Desire-Fulfillment Loops**  
Organizations in free association act as **learning organisms**:  
- Low fulfillment in a role triggers desire for new contributors or methods.  
- High fulfillment reinforces effective practices.  
This dynamic resembles **evolutionary algorithms**, where "fitness" (fulfillment) determines which strategies persist. Unlike capitalist R&D (driven by profit), innovation here aligns with **collectively defined needs**.  

---

### **10. Transcending Alienation Through Embodied Participation**  
Capitalism alienates labor by divorcing work from meaning (e.g., assembly-line drudgery). Free association dissolves alienation by tethering labor to **immediate social utility**:  
- A carpenter sees their chairs used by neighbors.  
- A programmer witnesses their code enabling community projects.  
Desire and fulfillment thus become **existential anchors**, transforming work from a "means to survive" into a "mode of being." This aligns with Marx’s vision of labor as "life’s prime want," where contribution and self-actualization merge.  

---


### **Conclusion: The Organizational Horizon**  
Free association redefines organizations as **fluid, living networks**—not static institutions. By grounding legitimacy in mutual recognition, desire, and fulfillment, it resolves capitalism’s core contradictions: exploitation, alienation, and ecological unsustainability. The result is a social-material order where organizations evolve organically, powered by the collective pursuit of self-actualization. As Marx envisioned, this is not utopia but **practicable humanism**—a world where "the free development of each is the condition for the free development of all."
*/
