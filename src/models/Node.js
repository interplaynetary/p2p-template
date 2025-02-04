export class Node {
    constructor(name, parent = null, types = []) {
        this.name = name;
        this.parent = parent;
        this.points = 0;
        this.children = new Map();  // Node -> Map(contributor -> points)
        this.totalChildPoints = 0;
        this.isContributor = this.parent ? false : true;

        this.types = types;
        // Map of type -> Set of instances
        this.typeIndex = parent ? parent.getRoot().typeIndex : new Map();
        
        // Add initial types if provided
        if (types.length > 0) {
            types.forEach(type => {
                this.addType(type);
                // If any type is a contributor, this instance can't have children
                if (type.isContributor) {
                    this.isContributor = true;
                }
            });
        }
    }

    // Add this node as an instance of the given type
    addType(type) {
        //console.log(`\nAdding type ${type.name} to ${this.name}`);
        
        const root = this.getRoot();
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
        const root = this.getRoot();
        root.typeIndex.get(type).delete(this);
    }

    addChild(name, points = 0, types = []) {
        if (this.parent && this.isContributor) {
          throw new Error(
            `Node ${this.name} is an instance of a contributor and cannot have children.`
          );
        }
    
        const child = new Node(name, this, types);
    
        this.children.set(name, child);
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
            this.getRoot().typeIndex.forEach(instances => {
                instances.delete(child);
            });
            // Remove from children
            this.children.delete(name);
        }
        return this;
    }

    getRoot() {
        return this.parent ? this.parent.getRoot() : this;
    }

    // Helper method to get all types in the system
    getTypes() {
        return Array.from(this.getRoot().typeIndex.keys());
    }

    // Helper method to get all instances of a given type
    getInstances(type) {
        return this.getRoot().typeIndex.get(type) || new Set();
    }

    setPoints(points) {
        const diff = points - this.points;
        if (this.parent) {
            this.parent.totalChildPoints += diff;
        }
        this.points = points;
        return this;
    }

    getWeight() {
        if (!this.parent) return 1;
        return this.parent.totalChildPoints === 0 ? 0 :
            (this.points / this.parent.totalChildPoints) * this.parent.getWeight();
    }

    // Calculate how much this node recognizes a given type/node
    shareOfGeneralContribution(node) {
        // Use indexed lookup instead of tree traversal
        const instances = this.getRoot().typeIndex.get(node) || new Set();
        return Array.from(instances).reduce((sum, instance) => {
            // Count only contributor types
            const contributorTypesCount = instance.types.filter(type => type.isContributor).length;
            // Divide the instance's weight by its number of contributor types
            const weightShare = contributorTypesCount > 0 ? 
                instance.getWeight() / contributorTypesCount : 
                instance.getWeight();
            return sum + weightShare;
        }, 0);
    }

    mutualShareOfGeneralContribution(node) {
        // console.log(`\nDEBUG: Calculating mutual recognition between ${this.name} and ${node.name}`);
        // console.log(`- ${this.name} types:`, this.getTypes().map(t => t.name));
        // console.log(`- ${node.name} instances:`, Array.from(this.getInstances(node)).map(i => i.name));
        
        // Calculate recognition in both directions
        const otherShareInMe = this.shareOfGeneralContribution(node);
        // console.log(`- ${this.name}'s recognition of ${node.name}: ${otherShareInMe}`);
        
        const myShareInOther = node.shareOfGeneralContribution(this);
        // console.log(`- ${node.name}'s recognition of ${this.name}: ${myShareInOther}`);
        
        // Mutual recognition is the minimum of both directions
        const mutual = Math.min(otherShareInMe, myShareInOther);
        // console.log(`- Mutual recognition: ${mutual}`);
        
        return mutual;
    }

    // Calculate final mutualGeneralContribution of mutualShareOfGeneralContribution
    mutualGeneralContribution() {
        // Get all types that have instances in the system
        const types = Array.from(this.getRoot().typeIndex.keys())
            .filter(type => this.getInstances(type).size > 0);
        
        // Calculate mutual recognition for each type
        const mutualContributions = types.map(type => ({
            contributor: type,
            value: this.mutualShareOfGeneralContribution(type)
        })).filter(({ value }) => value > 0);  // Only keep positive recognitions

        // Calculate total for normalization
        const total = mutualContributions.reduce((sum, { value }) => sum + value, 0);
        
        // Create normalized mutualGeneralContribution
        // console.log('\nCalculating mutualGeneralContribution:');
        const mutualGeneralContribution = new Map(
            mutualContributions.map(({ contributor, value }) => [
                contributor,
                total === 0 ? 0 : value / total
            ])
        );

        // Log final results
        // console.log('\nFinal mutualGeneralContribution:');
        mutualGeneralContribution.forEach((share, contributor) => {
            // console.log(`${contributor.name}: ${(share * 100).toFixed(1)}%`);
        });
        // console.log( 'General mutual Contribution will serve as the bridge between Abstract and Concrete Time distribution and allow us to calculate Concrete Mutual Recognition of Mutual Relation.' );
        return mutualGeneralContribution;
    }
    shareOfMutualGeneralContribution(node){
        // share of communal production/contribution/total-social-product!
        // share in the part of the total product destined for individual consumption (means of subsistence)
        return this.mutualGeneralContribution().get(node);
    }
}
