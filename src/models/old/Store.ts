import { TreeNode } from './TreeNode'
import { user } from '../Gun'
import _ from 'lodash'

// free-association is an imminantly sublated critique of the existing society.
// It is as if marx does the social-materialist inversion of hegels master-slave dialectic through the categories of political economy.
// Whereas free-association does the social-materialist inversion of the solution (as presented by hegel) of the master-slave dialectic!
// It's as if Marx does the social-materialist inversion of the problem, and free-association does the social-materialist inversion of the solution!

// From Gun:
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

export type GunNodeInit = Omit<GunNode, "id"> & {id?: string} // because we dont know ID yet in all cases (TreeNode.addChild) which creates a new node.

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
  structural?: boolean; // Optional for backward compatibility
}

export interface InterfaceStore {
    setPoints(nodeId: string, points: number): void;
    addChild(parentId: string, init: GunNodeInit): Promise<TreeNode>;
    removeChild(parentId: string, childId: string): Promise<void>;
    addType(nodeId: string, typeId: string): Promise<void>; 
    removeType(nodeId: string, typeId: string): Promise<void>;
    setFulfillment(nodeId: string, value: number): Promise<void>;
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
        // console.log('root', this.#rootRevision, 'tree', this.#treeRevision)
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
          if (!id) {
              return null
          }
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
              if (child) { // Add null check for child
                  const childTree = this.tree(child.id, () => treeNode, nodeCache)
                  if (childTree) {
                      treeChildren.push(childTree)
                  }
              }
          }
  
          // This type function should find from more than just the nodeCache. (for typeIds)
          const typesFn = () => typeIds.map(typeId => nodeCache.get(typeId)).filter((type): type is TreeNode => type !== null)
  
          treeNode = new TreeNode(typesFn, this, node, treeChildren, parent)
          nodeCache.set(id, treeNode)
  
          // if tree is partial then lets set the flag on the store, and return resolved.
          // console.log('Store treeNode', treeNode)
          return treeNode
      }
  
      setPoints(nodeId: string, points: number) {
        const node = this.cache.get(nodeId)
        if (!node) return
        this.update({id: nodeId, type: 'node', data: {...node, points}, structural: true})
      }
  
      async addChild(parentId: string | null = this.rootId, init: GunNodeInit) {        

        // First create the node in GUN to get a Soul
        const gunNodeRef = user.get('nodes').set({
          name: init.name,
          points: init.points,
          manualFulfillment: init.manualFulfillment
        });
        
        // Create a Promise to wait for the callback with the Soul
        const nodeWithSoul = await new Promise<{id: string, ref: any}>((resolve) => {
          gunNodeRef.once((data, key) => {
            // The Soul is available in the callback
            const nodeId = data._['#'] || key;
            resolve({id: nodeId, ref: gunNodeRef});
          });
        });
        
        // Use the GUN-generated Soul as our ID
        const child = {...init, id: nodeWithSoul.id};
        
        // Update our local store
        const oldChildren = this.lookUpRelation<string[]>(`${parentId}_children`) || [];
        const updatedChildren = [...oldChildren, child.id];
        
        // Update parent-child relationship
        await this.update({type: 'relation', key: `${parentId}_children`, value: updatedChildren, structural: true});
        
        // Update node data
        await this.update({type: 'node', data: child, id: child.id, structural: true});
        
        // Set bidirectional relationship (child -> parent)
        await this.update({type: 'relation', key: `${child.id}_parent`, value: parentId, structural: true});
        
        // Return the TreeNode representation of the child
        const t = this.tree(parentId);
        return t?.children.get(child.id)!;
      }
  
      async removeChild(parentId: string | null = this.rootId, childId: string) {
        const currentChildren = this.lookUpRelation<string[]>(`${parentId}_children`) || [];
        const updatedChildren = currentChildren.filter(c => c !== childId);
        // remove parent child
        this.update({type: 'relation', key: `${parentId}_children`, value: updatedChildren})
        // remove child parent (bidirectional)
        this.update({type: 'relation', key: `${childId}_parent`, value: null})
      }
  
      async addType(nodeId: string | null = this.rootId, typeId: string) {
        const currentTypes = this.lookUpRelation<string[]>(`${nodeId}_types`) || [];
        const updatedTypes = [...currentTypes, typeId];
        this.update({type: 'relation', key: `${nodeId}_types`, value: updatedTypes})
      }
  
      async removeType(nodeId: string | null= this.rootId, typeId: string) { 
        const currentTypes = this.lookUpRelation<string[]>(`${nodeId}_types`) || [];
        const updatedTypes = currentTypes.filter(t => t !== typeId);
        this.update({type: 'relation', key: `${nodeId}_types`, value: updatedTypes})
      }

      async setFulfillment(nodeId: string, value: number) {
        const node = this.cache.get(nodeId)
        if (!node) return
        this.update({id: nodeId, type: 'node', data: {...node, manualFulfillment: value}, structural: true})
      }
  }

export class GunStore extends Store {
    // Add property declarations to fix linter errors
    private childListenerAdded: Set<string> = new Set();
    private typeListenerAdded: Set<string> = new Set();
    
    private constructor(rootNodeId: string) {
      super(rootNodeId)
    }
    static async create(rootNode: GunNode) {
      // First check if this node already exists in GUN
      let existingRootSoul: string | null = null;
      const existingSouls: string[] = [];
      
      let store: GunStore;
      
      if (existingRootSoul) {
        console.log(`Using existing root node with Soul: ${existingRootSoul}`);
        console.log(`(Found ${existingSouls.length} total nodes with name "${rootNode.name}")`);
        store = new GunStore(existingRootSoul);
      } else {
        console.log(`No existing node found with name "${rootNode.name}", creating new root node`);
        // Create a new root node in GUN
        const gunNodeRef = user.get('nodes').set({
          name: rootNode.name,
          points: rootNode.points,
          manualFulfillment: rootNode.manualFulfillment
        });
        
        // Wait for the Soul ID
        const nodeWithSoul = await new Promise<{id: string, ref: any}>(resolve => {
          gunNodeRef.once((data: any, key: string) => {
            const nodeId = data && data._ ? data._['#'] : key;
            console.log(`Created new root node with Soul: ${nodeId}`);
            resolve({id: nodeId, ref: gunNodeRef});
          });
        });
        
        store = new GunStore(nodeWithSoul.id);
      }
      
      // Initialize the store before returning
      await store.initialize();
      return store;
    }
    
    async initialize() {
      console.log('Initializing GunStore with root ID:', this.rootId);
      
      /*
      // Improved debugging: Log all nodes with their Soul IDs
      user.get('nodes').map().once((data, id) => {
        if (data && typeof data === 'object' && id && id !== '_') {
          const soul = data._?.['#'] || id;
          console.log(`Found node: ${data.name || 'unnamed'}, Soul ID: ${soul}, Data:`, data);
        }
      });
      */

      // Track the nodes we've seen to prevent duplicate processing
      const processedNodes = new Map();
      
      // Modify the listener to handle timestamps correctly
      user.get('nodes').map().on((nodeData: any, nodeId: string) => {
        // Skip if null, metadata, or not a valid node
        if (!nodeData || !nodeId || nodeId === '_' || nodeId.startsWith('_') || typeof nodeId === 'number') {
          return;
        }

        // Ensure we're using the correct Soul ID and convert to string
        const soul = String(nodeData._?.['#'] || nodeId);
        
        // Create a hash of the data to check if it has changed
        const dataString = JSON.stringify({
          name: nodeData.name,
          points: nodeData.points,
          manualFulfillment: nodeData.manualFulfillment
        });
        
        // Skip if we've already processed this exact version of the node
        if (processedNodes.get(soul) === dataString) {
          return;
        }
        
        // Update our processing tracker
        processedNodes.set(soul, dataString);
        
        console.log('GUN Node data received:', soul, nodeData);

        // Process node basic data
        if (typeof nodeData === 'object') {
          // Create a valid GunNode from the data using the Soul as ID
          const node: GunNode = {
            id: soul, // Use the Soul as the node ID
            name: nodeData.name || '',
            points: typeof nodeData.points === 'number' ? nodeData.points : 0,
            manualFulfillment: typeof nodeData.manualFulfillment === 'number' ? nodeData.manualFulfillment : 0
          };

          // Update our cache with the node data
          this.update({
            id: soul,
            type: 'node',
            data: node,
            structural: false // Use false to avoid updating GUN again (prevent circular updates)
          });

          // Process parent relationship (if exists)
          if (nodeData.parent) {
            // Extract Soul ID if parent is an object reference
            const parentSoul = typeof nodeData.parent === 'object' && nodeData.parent._
              ? nodeData.parent._['#'] 
              : nodeData.parent;
              
            this.update({
              type: 'relation',
              key: `${soul}_parent`,
              value: parentSoul,
              structural: false
            });
          }

          // Listen for children changes - BUT only once per soul
          if (!this.childListenerAdded) {
            this.childListenerAdded = new Set();
          }
          
          if (!this.childListenerAdded.has(soul)) {
            this.childListenerAdded.add(soul);
            
            user.get('nodes').get(soul).get('children').map().on((val: any, childKey: string) => {
              if (childKey && childKey !== '_' && !childKey.startsWith('_')) {
                // For children nodes, we need to get the actual Soul ID of each child
                user.get('nodes').get(childKey).once((childData: any) => {
                  if (childData) {
                    const childSoul = childData._?.['#'] || childKey;
                    console.log(`Child relationship: ${soul} -> ${childSoul}`);
                    
                    const currentChildren = this.lookUpRelation<string[]>(`${soul}_children`) || [];
                    if (!currentChildren.includes(childSoul)) {
                      this.update({
                        type: 'relation',
                        key: `${soul}_children`,
                        value: [...currentChildren, childSoul],
                        structural: false
                      });
                    }
                  }
                })
              }
            })
          }

          // Listen for types changes - BUT only once per soul
          if (!this.typeListenerAdded) {
            this.typeListenerAdded = new Set();
          }
          
          if (!this.typeListenerAdded.has(soul)) {
            this.typeListenerAdded.add(soul);
            
            user.get('nodes').get(soul).get('types').map().on((val: any, typeKey: string) => {
              if (typeKey && typeKey !== '_' && !typeKey.startsWith('_')) {
                // For type nodes, we need to get the actual Soul ID of each type
                user.get('nodes').get(typeKey).once((typeData: any) => {
                  if (typeData) {
                    const typeSoul = typeData._?.['#'] || typeKey;
                    console.log(`Type relationship: ${soul} -> ${typeSoul}`);
                    
                    const currentTypes = this.lookUpRelation<string[]>(`${soul}_types`) || [];
                    if (!currentTypes.includes(typeSoul)) {
                      this.update({
                        type: 'relation',
                        key: `${soul}_types`,
                        value: [...currentTypes, typeSoul],
                        structural: false
                      });
                    }
                  }
                });
              }
            });
          }
        }
      });
    }
    async update(update: Update) {
      super.update(update)
      if ((update.type === 'node' || update.type === 'relation') && update.structural) {
        await this.updateLocal(update)
      }
    }
    async updateLocal(update: Update) {
      if (update.type === 'node') {
        // Write node data to GUN (correct)
        user.get('nodes').get(update.id).put(update.data);
      } else if (update.type === 'relation') {
        const [nodeId, relationName] = update.key.split('_');
        
        // Don't put arrays directly
        if (Array.isArray(update.value)) {
          // Clear existing values first
          user.get('nodes').get(nodeId).get(relationName).put(null);
          
          // Then set each item individually
          if (update.value.length > 0) {
            const relationNode = user.get('nodes').get(nodeId).get(relationName);
            update.value.forEach(item => {
              relationNode.set(item);
            });
          }
        } else {
          // For non-array values, put works fine
          user.get('nodes').get(nodeId).get(relationName).put(update.value);
        }
      }
    }
  }
  