import { Node } from './Node.js';

export 
class D3Node extends Node {
    constructor(name, parent = null, types = []) {
        super(name, parent, types);
    }

    addChild(name, points = 0, types = []) {
        if (this.parent && this.isContributor) {
          throw new Error(
            `Node ${this.name} is an instance of a contributor and cannot have children.`
          );
        }
    
        const child = new D3Node(name, this, types);
    
        this.children.set(name, child);
        if (points > 0) {
          child.setPoints(points);
        }
        return child;
      }

    // D3 Compatibility Methods
    get value() {
        return this.points;
    }

    get childrenArray() {
        return Array.from(this.children.values());
    }

    get data() {
        return this;
    }

    get hasChildren() {
        return this.children.size > 0;
    }
    
    descendants() {
        const result = [];
        const stack = [this];
        while (stack.length) {
            const node = stack.pop();
            result.push(node);
            stack.push(...node.childrenArray);
        }
        return result;
    }

    ancestors() {
        const result = [];
        let current = this;
        while (current) {
            result.push(current);
            current = current.parent;
        }
        return result;
    }
}
