import { Node } from './Node.js';

export 
class D3Node extends Node {
    constructor(name, parent = null, types = []) {
        super(name, parent, types);
    }

    // Override addChild to create D3Nodes instead of regular Nodes
    addChild(name, points = 0, types = []) {
        const child = new D3Node(name, this, types);
        this.children.set(name, child);
        
        if (types.length > 0) {
            types.forEach(type => child.addType(type));
        }   
        
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