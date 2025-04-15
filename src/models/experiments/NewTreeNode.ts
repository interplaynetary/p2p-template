import { Coordinator } from '../../Coordinator';
import { GunNode } from '../old/GunNode';
import { GunSubscription, SubscriptionCleanup, SubscriptionHandler } from '../old/GunSubscription';
import { gun } from '../old/Gun';

// Define the core data structure of a TreeNode
export interface TreeNodeData {
  id: string;
  name: string;
  points: number;
  manualFulfillment: number;
  parent?: string;
}

// calculateSharesOfGeneralFulfillment is called on time-interval

/**
 * Reactive TreeNode implementation following Gun.js best practices
 * Embraces the reactive nature of Gun by treating all data as streams
*/

// we need to also make the leaf nodes be able to have manual-fulfillment

// can Contribution-nodes have children?

// 

// is desire inverse of fulfillment? 

// Can we make Proportion enforce this bound
export type Proportion = number; // Values between 0 and 1 representing percentages

export type ProportionOf<PropertyInAnotherType> = number; // valid only if all Proportions observing this property, must add up to 1.

export interface Contributor {
 id: string;
 name: string;
 capacities: Set<Capacity>;
 contributions: Set<Contribution>;
 state: State;
 sharesOfOthersCapacities: Map<Capacity, Proportion>; // will be updated by others (%'s)
 derivedSharesOfOthersCapacities: Map<Capacity, Proportion>; // will be derived from others' sharesOfOthersCapacities (Real numbers from amount)
}

export interface Capacity {
  id: string;
  name: string;
  provider: Contributor;
  unit: string;
  amount: number;
  depth: number; // used to determine depth of capacity share distribution
  shareDistribution: Map<Contributor, Proportion>; // will be used to update Contributor.sharesOfOthersCapacities
}

export interface Contribution {
    id: string;
    name: string;
    capacities: Set<Capacity>;
}

export interface Recognition {
    recognizer: Contributor;
    contribution: Contribution;
    parent?: string;
    points: number;
    weight: Proportion;
    desire: Proportion; // % of weight
    fulfilled: Proportion; // % of desire
}

// functions / equations for deriving State from Recognition

export interface State {
    sharesOfGeneralFulfillment: Map<Contributor, number>; // used to determine mutual-recognitions
    mutualRecognitions: Map<Contributor, number>;
    mutualDistributions: Map<number, Map<Contributor, number>>; // normalized mutual-recognition distributions at varying depths of traversal
}



export class TreeNode extends GunNode<TreeNodeData> {
  // Local state derived from Gun data
  private _id: string;
  private _name: string = '';
  private _parent: TreeNode | null = null;

  private _points: number = 1; // default 1
  private _manualDesire: number = 1; // a percentage of the node's weight/value
  private _manualFulfillment: number = 1; // a percentage of manualDesire

  private _children: Map<string, TreeNode> = new Map();
  private _capacities: Set<string> = new Set();

  private _recognitionSubscriptions: Map<string, () => void> = new Map();
  private _sharesOfOthersRecognition: {[key: string]: number} = {};
  
  // Subscriptions for cleanup
  private _parentSubscription: SubscriptionCleanup | null = null;
  private _childrenSubscription: SubscriptionCleanup | null = null;
  private _capacitiesSubscription: SubscriptionCleanup | null = null;
  
  // Reference to Coordinator
  private _coordinator: Coordinator;
  
  // Static registry for nodes to avoid duplicates
  private static _registry: Map<string, TreeNode> = new Map();
  
  // Add at class level
  private _sharesCalculationScheduled: boolean = false;
  private _lastSharesCalculation: number = 0;
  private _cachedShares: {[key: string]: number} | null = null;
  
  // Add these at the class level, right after other private fields
  private _sharesDebouncerTimeout: any = null;
  private _sharesCalculationCooldown: number = 5000; // 5 second cooldown
  private _calculationCache: Map<string, { timestamp: number, value: any }> = new Map();
  
  // Add these at the class level, right after other static fields
  private static _startupMode: boolean = true;
  private static _pendingUpdates: Map<string, any> = new Map();
  private static _updateBatchTimeout: any = null;
  private static _startupModeTimeout: any = null;
  private static _loggingEnabled: boolean = false; // Add logging control flag
  
  // Track social distribution 
  private _socialDistributionInstance: any = null;
  
  // Helper method to log only when enabled
  private static log(message: string, ...args: any[]) {
    if (TreeNode._loggingEnabled) {
      console.log(message, ...args);
    }
  }
  
  /**
   * Create a new TreeNode or get an existing one from registry
   * @param id Node ID
   * @param coordinator Coordinator instance
   * @returns TreeNode instance
   */
  public static getNode(id: string, coordinator: Coordinator): TreeNode {
    // Check if node already exists in registry
    if (TreeNode._registry.has(id)) {
      return TreeNode._registry.get(id)!;
    }
    
    // Create a new node
    const node = new TreeNode(id, coordinator);
    TreeNode._registry.set(id, node);
    return node;
  }

  
  /**
   * Create a new node with the given name and options
   * @param name Node name
   * @param options Creation options
   * @param coordinator Coordinator instance
   * @returns The new node
   */
  public static async create(
    name: string,
    options: {
      parent?: TreeNode,
      points?: number,
      manualFulfillment?: number,
      capacityIds?: string[],
      id?: string
    } = {},
    coordinator: Coordinator
  ): Promise<TreeNode> {
    // Generate an ID if not provided
    const id = options.id || Math.random().toString(36).substring(2, 15);
    
    // Create node data
    const nodeData: any = {
      name,
      points: options.points || 0,
      manualFulfillment: options.manualFulfillment || null
    };
    
    // Add parent reference if provided
    if (options.parent) {
      nodeData.parent = options.parent.id;
    }
    
    // Create the node in Gun
    const nodeRef = gun.get('nodes').get(id);
    await new Promise<void>((resolve) => {
      nodeRef.put(nodeData, () => resolve());
    });
    
    // Add capacities if provided
    if (options.capacityIds && options.capacityIds.length > 0) {
      const capacitiesRef = nodeRef.get('capacities');
      for (const capacityId of options.capacityIds) {
        await new Promise<void>((resolve) => {
          capacitiesRef.get(capacityId).put({ value: true }, () => resolve());
        });
      }
    }
    
    // Add as child to parent
    if (options.parent) {
      // Get the children node using the parent's path
      const childrenNode = options.parent.get('children');
      await childrenNode.get(id).put({ value: true } as any);
    }
    
    // Get the node from registry
    return TreeNode.getNode(id, coordinator);
  }
  
  /**
   * Private constructor - use static methods to get instances
   * @param id Node ID
   * @param coordinator Coordinator instance 
   */
  private constructor(id: string, coordinator: Coordinator) {
    super(['nodes', id]);
    this._id = id;
    this._coordinator = coordinator;
    
    console.log(`[TreeNode] Constructor for ${id}, initial name=${this._name}`);
    
    // Start with a recent timestamp
    this._lastSharesCalculation = Date.now() - 1000;
    
    // IMPORTANT FIX: Immediately load initial data synchronously
    // This ensures the node has its name and other properties
    // before any APIs like once() are called on it
    this.getChain().once((data) => {
      console.log(`[TreeNode] Immediate data load for ${id}:`, data ? 
                  { name: data.name, points: data.points } : 'No data');
      
      if (data) {
        if (data.name !== undefined) {
          this._name = data.name || '';
          console.log(`[TreeNode] Updated name to "${this._name}" for ${id}`);
        }
        
        if (data.points !== undefined) {
          this._points = data.points || 0;
        }
        
        if (data.manualFulfillment !== undefined) {
          this._manualFulfillment = data.manualFulfillment;
        }
        
        // Don't handle parent here - it's more complex
        TreeNode.log(`[TreeNode] Initial data loaded for ${id}, name=${this._name}`);
      }
    });
    
    // Setup subscriptions with a slight delay to prevent startup floods
    setTimeout(() => {
      console.log(`[TreeNode] Setting up subscriptions for ${id}, current name="${this._name}"`);
      this.setupSubscriptions();
      
      // Set an automatic timeout to end startup mode
      if (TreeNode._startupMode && !TreeNode._startupModeTimeout) {
        TreeNode._startupModeTimeout = setTimeout(() => {
          TreeNode.log(`[TreeNode] Ending startup mode`);
          TreeNode._startupMode = false;
          TreeNode._startupModeTimeout = null;
          
          // Enable logging after startup phase
          TreeNode._loggingEnabled = true;
          
          // Process any pending updates in startup mode
          if (TreeNode._pendingUpdates.size > 0) {
            TreeNode.log(`[TreeNode] Processing ${TreeNode._pendingUpdates.size} pending updates from startup`);
            TreeNode.processBatchUpdates();
          }
        }, 3000);
      }
    }, 100);
  }

    // Helper property
    public get isRoot(): boolean {
      return !this._parent;
    }
  
  
  /**
   * Set up all reactive subscriptions to Gun data
   */
  private setupSubscriptions(): void {
    // console.log(`[TreeNode ${this._id}] Setting up subscriptions`);
    
    // Add debouncing for UI updates
    let uiUpdateDebounceTimer: any = null;
    const UI_UPDATE_DEBOUNCE = 350; // ms
    
    // Helper to debounce UI updates
    const debounceUIUpdate = () => {
      if (uiUpdateDebounceTimer) {
        clearTimeout(uiUpdateDebounceTimer);
      }
      
      uiUpdateDebounceTimer = setTimeout(() => {
        this._coordinator.updateNeeded = true;
        this._coordinator.pieUpdateNeeded = true;
        uiUpdateDebounceTimer = null;
      }, UI_UPDATE_DEBOUNCE);
    };
    
    // Subscribe to node data changes
    this.on((data) => {
      // console.log(`[TreeNode ${this._id}] Received data update:`, data);
      let updated = false;
      
      // Track if we need to recalculate shares
      let needsSharesRecalculation = false;
      
      if (data.name !== undefined && data.name !== this._name) {
        this._name = data.name || '';
        updated = true;
      }
      
      if (data.points !== undefined && data.points !== this._points) {
        this._points = data.points || 0;
        updated = true;
        needsSharesRecalculation = true;  // Points affect weights
      }
      
      if (data.manualFulfillment !== undefined && data.manualFulfillment !== this._manualFulfillment) {
        this._manualFulfillment = data.manualFulfillment;
        updated = true;
        needsSharesRecalculation = true;  // Fulfillment affects recognition
      }
      
      if (data.parent !== undefined) {
        if ((data.parent && (!this._parent || this._parent.id !== data.parent)) ||
            (!data.parent && this._parent)) {
          this.updateParent(data.parent || null);
          updated = true;
          needsSharesRecalculation = true;  // Parent affects weights
        }
      }
      
      // Schedule shares recalculation if needed
      if (needsSharesRecalculation && this.isRoot) {
        this.scheduleSharesCalculation();
      }
      
      if (updated) {
        // Debounce UI updates to prevent frequent treemap rebuilds
        debounceUIUpdate();
      }
    });
    
    // Subscribe to children
    this.subscribeToChildren();
    
    // Subscribe to capacities
    this.subscribeToCapacities();
    
    // Only set up recognition subscriptions if we're the root node
    if (!this._parent) {
      this.setupRecognitionSubscriptions();

      // Re-setup recognition when capacities change anywhere in the tree
      this.get('capacities').on(() => {
        if (this.isRoot) {
          this.scheduleSharesCalculation();
        }
      });

      // Re-setup recognition when children change anywhere in the tree
      this.get('children').on(() => {
        if (this.isRoot) {
          this.scheduleSharesCalculation();
        }
      });
    }
  }

  private scheduleSharesCalculation() {
    // Skip if already scheduled
    if (this._sharesCalculationScheduled) return;
    
    // Skip if in cooldown period
    const now = Date.now();
    if (now - this._lastSharesCalculation < this._sharesCalculationCooldown) {
      TreeNode.log(`[${this._name}] Skipping shares calculation - in cooldown period (${Math.round((now - this._lastSharesCalculation) / 1000)}s / ${this._sharesCalculationCooldown / 1000}s)`);
      return;
    }
    
    this._sharesCalculationScheduled = true;
    TreeNode.log(`[${this._name}] Scheduling shares calculation`);
    
    // Clear any existing timeout to implement true debouncing
    if (this._sharesDebouncerTimeout) {
      clearTimeout(this._sharesDebouncerTimeout);
    }
    
    // Special handling for startup mode - significantly reduce the number of calls
    if (TreeNode._startupMode) {
      // During startup, be much more aggressive with batching
      // Only process near the end of startup mode
      this._sharesDebouncerTimeout = setTimeout(() => {
        this._sharesDebouncerTimeout = null;
      this._sharesCalculationScheduled = false;
        
        // Calculate but don't update Gun immediately
        const oldShares = this._cachedShares;
        const newShares = this.calculateShares();
        
        // Cache the new values
        if (!oldShares || !this.areSharesEqual(oldShares, newShares)) {
          TreeNode.log(`[${this._name}] Shares changed during startup, queueing for later update`);
          this._cachedShares = newShares;
          this._lastSharesCalculation = Date.now();
          
          // Queue the update instead of doing it immediately
          TreeNode.scheduleBatchUpdate(
            [...this.getPath(), 'sharesOfGeneralFulfillment'], 
            newShares
          );
          
          // Still trigger UI update
          this._coordinator.pieUpdateNeeded = true;
        }
      }, 2500); // Longer timeout during startup, nearly at the end of startup mode
      return;
    }
    
    // Standard debounced calculation
    this._sharesDebouncerTimeout = setTimeout(() => {
      // Get current shares
      const oldShares = this._cachedShares;
      
      // Calculate new shares
      const newShares = this.calculateShares();
      
      // Only save if values have changed
      if (!oldShares || !this.areSharesEqual(oldShares, newShares)) {
        TreeNode.log(`[${this._name}] Shares changed, saving to Gun`);
        this._cachedShares = newShares;
        this._lastSharesCalculation = Date.now();
        
        // Use batch update instead of direct put
        TreeNode.scheduleBatchUpdate(
          [...this.getPath(), 'sharesOfGeneralFulfillment'], 
          newShares
        );
        
        // Trigger UI update only after actual changes
        this._coordinator.pieUpdateNeeded = true;
      } else {
        TreeNode.log(`[${this._name}] Shares unchanged, skipping update`);
      }
      
      this._sharesCalculationScheduled = false;
      this._sharesDebouncerTimeout = null;
    }, 1000);
  }
  
  // Helper to compare share objects
  private areSharesEqual(a: {[key: string]: number}, b: {[key: string]: number}): boolean {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => 
      keysB.includes(key) && Math.abs(a[key] - b[key]) < 0.0001
    );
  }
  
  /**
   * Update parent reference
   * @param parentId Parent node ID or null
   */
  private async updateParent(parentId: string | null): Promise<void> {
    // Clean up previous parent subscription
    if (this._parentSubscription) {
      this._parentSubscription();
      this._parentSubscription = null;
    }
    
    // Clear existing parent
    if (this._parent) {
      this._parent._children.delete(this._id);
      this._parent = null;
    }
    
    // Load new parent if provided
    if (parentId) {
      const parent = TreeNode.getNode(parentId, this._coordinator);
      this._parent = parent;
      
      // Add this node to parent's children
      parent._children.set(this._id, this);
    }
  }
  
  /**
   * Subscribe to children collection
   */
  private subscribeToChildren(): void {
    // console.log(`[TreeNode ${this._id}] Setting up children subscription`);
    
    // Clean up existing subscription
    if (this._childrenSubscription) {
      this._childrenSubscription();
      this._childrenSubscription = null;
    }
    
    // Set up new subscription using path abstraction
    const childrenNode = this.get('children');
    
    // console.log(`[TreeNode ${this._id}] Starting children each() subscription`);
    
    // Track processed children to avoid duplicates
    const processedChildren = new Set<string>();
    
    // Create a more robust subscription using a stream pattern
    const stream = new ReadableStream({
      start: (controller) => {
        this._childrenSubscription = childrenNode.each((childData) => {
          const childId = childData._key;
          
          // Skip Gun metadata and already processed children
          if (childId === '_' || processedChildren.has(childId)) return;
          
          // console.log(`[TreeNode ${this._id}] Child data received:`, childId, childData);
          
          // If data is falsy, it means child was removed
          if (!childData || childData.value === null) {
            // console.log(`[TreeNode ${this._id}] Removing child:`, childId);
            // Remove from local collection
            if (this._children.has(childId)) {
              this._children.delete(childId);
              this._coordinator.updateNeeded = true;
              this._coordinator.pieUpdateNeeded = true;
            }
            processedChildren.delete(childId);
            return;
          }
          
          // Skip if we already have this child
          if (this._children.has(childId)) {
            // console.log(`[TreeNode ${this._id}] Child already in local collection:`, childId);
            processedChildren.add(childId);
            return;
          }
          
          // Load the child node
          // console.log(`[TreeNode ${this._id}] Creating child node:`, childId);
          const childNode = TreeNode.getNode(childId, this._coordinator);
          this._children.set(childId, childNode);
          
          // Ensure parent reference is correct
          childNode.parent = this;
          
          // Mark as processed
          processedChildren.add(childId);
          
          // Request UI updates
          // console.log(`[TreeNode ${this._id}] Child added, requesting UI update`);
          this._coordinator.updateNeeded = true;
          this._coordinator.pieUpdateNeeded = true;
          
          // Emit to stream
          controller.enqueue(childNode);
        });
      },
      cancel: () => {
        // Clean up subscription when stream is cancelled
        if (this._childrenSubscription) {
          this._childrenSubscription();
          this._childrenSubscription = null;
        }
      }
    });
    
    // Store the stream reader for cleanup
    const reader = stream.getReader();
    
    // Process the stream
    const processStream = async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          // Process child node if needed
        }
      } catch (err) {
        console.error(`Error processing children stream for node ${this._id}:`, err);
      }
    };
    
    processStream();
  }
  
  /**
   * Subscribe to capacities collection
   */
  private subscribeToCapacities(): void {
    // Clean up existing subscription
    if (this._capacitiesSubscription) {
      this._capacitiesSubscription();
      this._capacitiesSubscription = null;
    }
    
    // Set up new subscription using path abstraction
    const capacitiesNode = this.get('capacities');
    
    // Track processed capacities to avoid duplicates
    const processedCapacities = new Set<string>();
    
    // Create a stream for capacities
    const stream = new ReadableStream({
      start: (controller) => {
        this._capacitiesSubscription = capacitiesNode.each((typeData) => {
          const capacityId = typeData._key;
          
          // Skip Gun metadata and already processed capacities
          if (capacityId === '_' || processedCapacities.has(capacityId)) return;
          
          // If data is falsy, it means type was removed
          if (!typeData) {
            // Remove from local collection
            if (this._capacities.has(capacityId)) {
              this._capacities.delete(capacityId);
              
              // Update type index
              const root = this.root;
              root.removeFromCapacityIndex(capacityId, this._id);
              
              this._coordinator.updateNeeded = true;
              this._coordinator.pieUpdateNeeded = true;
              
              // Schedule shares recalculation on the root node
              if (root) {
                root.scheduleSharesCalculation();
              }
            }
            processedCapacities.delete(capacityId);
            return;
          }
          
          // Skip if we already have this type
          if (this._capacities.has(capacityId)) {
            processedCapacities.add(capacityId);
            return;
          }
          
          // Add to local collection
          this._capacities.add(capacityId);
          processedCapacities.add(capacityId);
          
          // Update type index
          const root = this.root;
          root.addToCapacityIndex(capacityId, this._id);
          
          // Request UI updates
          this._coordinator.updateNeeded = true;
          this._coordinator.pieUpdateNeeded = true;
          
          // Schedule shares recalculation on the root node
          if (root) {
            root.scheduleSharesCalculation();
          }
          
          // Emit to stream
          controller.enqueue(capacityId);
        });
      },
      cancel: () => {
        // Clean up subscription when stream is cancelled
        if (this._capacitiesSubscription) {
          this._capacitiesSubscription();
          this._capacitiesSubscription = null;
        }
      }
    });
    
    // Store the stream reader for cleanup
    const reader = stream.getReader();
    
    // Process the stream
    const processStream = async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          // Process type if needed
          if (this.isRoot) {
          this.setupRecognitionSubscriptions();
          } else {
            // If not root, notify the root that capacities have changed
            this.root.setupRecognitionSubscriptions();
          }
        }
      } catch (err) {
        console.error(`Error processing capacities stream for node ${this._id}:`, err);
      }
    };
    
    processStream();
  }
  
  // Add recognition subscription debouncing
  private _recognitionSetupTimeout: any = null;
  private _lastRecognitionSetup: number = 0;
  private _recognitionSetupCooldown: number = 2000; // 2 second cooldown
  
  /**
   * Set up subscriptions to recognition data from other nodes
   * Only called on root node
   */
  private setupRecognitionSubscriptions(): void {
    if (this._parent) return;

    // Skip if already processing or in cooldown
    const now = Date.now();
    if (this._recognitionSetupTimeout || 
        (now - this._lastRecognitionSetup < this._recognitionSetupCooldown && !TreeNode._startupMode)) {
      return;
    }

    // During startup mode, be much more conservative with subscription setup
    if (TreeNode._startupMode) {
      // Defer to end of startup for all recognition setup
      this._recognitionSetupTimeout = setTimeout(() => {
        this._recognitionSetupTimeout = null;
        this._lastRecognitionSetup = Date.now();
        this._actualSetupRecognitionSubscriptions();
      }, 2400); // Do this right before startup mode ends
      return;
    }
    
    // Standard debounced setup during normal operation
    this._recognitionSetupTimeout = setTimeout(() => {
      this._recognitionSetupTimeout = null;
      this._lastRecognitionSetup = Date.now();
      this._actualSetupRecognitionSubscriptions();
    }, 300);
  }

  // Actual implementation separated for clarity
  private _actualSetupRecognitionSubscriptions(): void {
    // Get all capacities that appear in our tree
    const relevantCapacities = new Set<string>();
    
    // Helper to collect capacities from a node and its children
    const collectCapacities = (node: TreeNode) => {
      node.capacities.forEach(capacityId => relevantCapacities.add(capacityId));
      node.children.forEach(child => collectCapacities(child));
    };
    
    // Start from our root (this node)
    collectCapacities(this);

    // Skip if no capacities have changed
    const currentcapacityIds = Array.from(this._recognitionSubscriptions.keys());
    const newcapacityIds = Array.from(relevantCapacities);
    
    if (currentcapacityIds.length === newcapacityIds.length && 
        currentcapacityIds.every(id => relevantCapacities.has(id))) {
      TreeNode.log(`[${this._name}] Recognition subscriptions unchanged, skipping setup`);
      return; // No changes to subscriptions needed
    }

    TreeNode.log(`[${this._name}] Setting up recognition subscriptions for ${relevantCapacities.size} capacities:`, newcapacityIds);

    // Find capacities to remove (in current subscriptions but not in relevantCapacities)
    const capacitiesToRemove = currentcapacityIds.filter(capacityId => !relevantCapacities.has(capacityId));
    
    // Find capacities to add (in relevantCapacities but not in current subscriptions)
    const capacitiesToAdd = newcapacityIds.filter(capacityId => !this._recognitionSubscriptions.has(capacityId));
    
    // Remove subscriptions no longer needed
    capacitiesToRemove.forEach(capacityId => {
      TreeNode.log(`[${this._name}] Removing subscription to ${capacityId}`);
      const cleanup = this._recognitionSubscriptions.get(capacityId);
      if (cleanup) {
        cleanup();
        this._recognitionSubscriptions.delete(capacityId);
        delete this._sharesOfOthersRecognition[capacityId];
      }
    });
    
    // Add new subscriptions using GunSubscription's map/filter capabilities
    capacitiesToAdd.forEach(capacityId => {
      TreeNode.log(`[${this._name}] Adding subscription to ${capacityId}`);
      
      // Create a subscription with built-in filtering and mapping
      const sub = new GunSubscription<any>(['nodes', capacityId, 'sharesOfGeneralFulfillment']);
      
      // Transform the raw data stream to extract only what we need
      const transformedSub = sub.map(shares => {
        if (!shares) return null;
        
        // Extract shares without normalizing
        const validShares = Object.entries(shares)
          .filter(([key, value]) => typeof value === 'number' && key !== '_')
          .map(([key, value]) => [key, value as number] as const);
        
        // Skip further processing if no valid shares
        if (validShares.length === 0) return null;
        
        // Find our share in the data
        const ourShare = validShares.find(([key, _]) => key === this._id);
        if (!ourShare) return null;
        
        // Return a simplified object with just what we need - WITHOUT normalization
        return {
          capacityId,
          share: ourShare[1],     // Use the absolute value directly
          raw: ourShare[1]        // Keep raw value for reference
        };
      });
      
      // Subscribe only to the transformed data
      const cleanup = transformedSub.on(result => {
        if (!result) return;
        
        const oldShare = this._sharesOfOthersRecognition[capacityId] || 0;
        
        // Only update if the share changed significantly
        if (Math.abs(result.share - oldShare) > 0.0001) {
          TreeNode.log(`[${this._name}] Share changed from ${oldShare} to ${result.share}, updating UI`);
          
          // Store the new value (absolute, not normalized)
          this._sharesOfOthersRecognition[capacityId] = result.share;
              
              // Request UI updates
              this._coordinator.updateNeeded = true;
              this._coordinator.pieUpdateNeeded = true;
        } else {
          TreeNode.log(`[${this._name}] Share unchanged (${oldShare}), skipping update`);
        }
      });
      
      // Store the cleanup function
      this._recognitionSubscriptions.set(capacityId, cleanup);
    });
  }
  
  // PROPERTIES
  
  /**
   * Get node ID
   */
  get id(): string {
    return this._id;
  }
  
  /**
   * Get node name
   */
  get name(): string {
    return this._name;
  }
  
  /**
   * Set node name
   */
  set name(value: string) {
    if (value !== this._name) {
      // Update in Gun first - local update will happen through the subscription
      this.put({ name: value });
      // Don't set this._name directly - let the subscription do it
    }
  }
  
  /**
   * Get parent node
   */
  get parent(): TreeNode | null {
    return this._parent;
  }
  
  /**
   * Set parent node
   */
  set parent(value: TreeNode | null) {
    if (value !== this._parent) {
      // Get old and new roots before making any changes
      const oldRoot = this.root;
      
      // Update Gun data with new parent reference - local update will happen through subscription
      this.put({ parent: value ? value.id : null });
      
      // Note: updateParent will be triggered by the subscription
    }
  }
  
  /**
   * Get root node
   */
  get root(): TreeNode {
    return this._parent ? this._parent.root : this;
  }
  
  /**
   * Get node points
   */
  get points(): number {
    return this._points;
  }
  
  /**
   * Set node points
   */
  set points(value: number) {
    if (value !== this._points) {
      // Update in Gun first - local update will happen through the subscription
      this.put({ points: value });
      // Don't set this._points directly - let the subscription do it
      
      // The pie chart update will be handled in the subscription handler
    }
  }
  
  /**
   * Get manual fulfillment
   */
  get manualFulfillment(): number | null {
    return this._manualFulfillment;
  }
  
  /**
   * Set manual fulfillment
   */
  set manualFulfillment(value: number | null) {
    if (value !== this._manualFulfillment) {
      // Update in Gun first - local update will happen through the subscription
      this.put({ manualFulfillment: value });
      // Don't set this._manualFulfillment directly - let the subscription do it
      
      // The pie chart update will be handled in the subscription handler
    }
  }
  
  /**
   * Get all children
   */
  get children(): Map<string, TreeNode> {
    return new Map(this._children);
  }
  
  /**
   * Get all capacities
   */
  get capacities(): Set<string> {
    return new Set(this._capacities);
  }
  
  /**
   * Get shares of recognition from other nodes
   */
  get sharesOfOthersRecognition(): {[key: string]: number} {
    return { ...this._sharesOfOthersRecognition };
  }
  
  // TYPE METHODS
  
  /**
   * Add a type to this node
   * @param capacityId Capacity ID to add
   * @returns This node for chaining
   */
  public addCapacity(capacityId: string): TreeNode {
    // Skip if already has type
    if (this._capacities.has(capacityId)) return this;
    
    // Skip invalid type IDs
    if (!capacityId || capacityId === '#' || typeof capacityId !== 'string') {
      console.warn(`[TreeNode] Ignoring invalid type ID: ${capacityId}`);
      return this;
    }
    
    // If this node has children, remove them first since contributions shouldn't have children
    if (this._children.size > 0) {
      console.log(`[TreeNode ${this._id}] Node is becoming a contribution, removing ${this._children.size} children`);
      
      // Create a copy of the children keys to avoid modification during iteration
      const childIds = Array.from(this._children.keys());
      
      // Remove each child in Gun
      for (const childId of childIds) {
        // Remove from Gun database
        const childrenNode = this.get('children');
        childrenNode.get(childId).put(null);
      }
      
      // Also clear the local children collection immediately
      // This ensures the node behaves as a contribution right away
      // even before Gun sync completes
      this._children.clear();
    }
    
    // Add to Gun using path abstraction
    const capacitiesNode = this.get('capacities');
    capacitiesNode.get(capacityId).put({ value: true } as any);
    
    // Immediately add to local capacities collection
    this._capacities.add(capacityId);
    
    // Update type index in root
    const root = this.root;
    root.addToCapacityIndex(capacityId, this._id);
    
    // Request UI updates
    this._coordinator.updateNeeded = true;
    this._coordinator.pieUpdateNeeded = true;
    
    // Schedule shares calculation
    if (root) {
      root.scheduleSharesCalculation();
    }
    
    // Let the subscription handle the rest
    return this;
  }
  
  /**
   * Remove a type from this node
   * @param capacityId Capacity ID to remove
   * @returns This node for chaining
   */
  public removeCapacity(capacityId: string): TreeNode {
    // Skip if doesn't have type
    if (!this._capacities.has(capacityId)) return this;
    
    // Remove from Gun using path abstraction
    const capacitiesNode = this.get('capacities');
    capacitiesNode.get(capacityId).put(null);
    
    // Remove locally (subscription will handle the rest)
    this._capacities.delete(capacityId);
    
    // Update type index
    this.root.removeFromCapacityIndex(capacityId, this._id);
    
    // Request UI updates
    this._coordinator.updateNeeded = true;
    this._coordinator.pieUpdateNeeded = true;
    
    return this;
  }
  
  // CHILD METHODS
  
  /**
   * Add a child node
   * @param name Child name
   * @param points Points value
   * @param capacityIds Optional array of type IDs
   * @param manualFulfillment Optional manual fulfillment value
   * @param id Optional child ID (generated if not provided)
   * @returns Promise that resolves with the new child node
   */
  public async addChild(
    name: string,
    points: number = 0,
    capacityIds: string[] = [],
    manualFulfillment: number = null,
    id?: string
  ): Promise<TreeNode> {
    // Check if this node can have children
    if (this._parent && this.isContribution) {
      throw new Error(`Node ${this._name} is a contribution and cannot have children`);
    }
    
    console.log(`[TreeNode] Adding child "${name}" with points ${points} to ${this._name}`);
    
    // Create the child node
    const child = await TreeNode.create(name, {
      parent: this,
      points: points,
      manualFulfillment: manualFulfillment,
      capacityIds: capacityIds,
      id: id
    }, this._coordinator);
    
    // Request UI updates
    this._coordinator.updateNeeded = true;
    this._coordinator.pieUpdateNeeded = true;
    
    return child;
  }
  
  /**
   * Remove a child node
   * @param childId ID of child to remove
   * @returns This node for chaining
   */
  public removeChild(childId: string): TreeNode {
    const child = this._children.get(childId);
    if (child) {
      // Remove from Gun using path abstraction
      const childrenNode = this.get('children');
      childrenNode.get(childId).put(null);
      
      // Subscription will handle the rest
    }
    
    return this;
  }
  
  // CALCULATED PROPERTIES
  
  /**
   * Check if this node is a contributor (root node)
   */
  get isContributor(): boolean {
    return !this._parent;
  }
  
  /**
   * Check if this node is a contribution (has a parent and capacities)
   */
  get isContribution(): boolean {
    return Boolean(this._parent && this._capacities.size > 0);
  }
  
  /**
   * Get total points of all children
   */
  get totalChildPoints(): number {
    return Array.from(this._children.values())
      .reduce((sum, child) => sum + child.points, 0) || 0;
  }
  
  /**
   * Get this node's weight relative to siblings and ancestors
   */
  get weight(): number {
    if (!this._parent) return 1;
    return this._parent.totalChildPoints === 0
      ? 0
      : (this._points / this._parent.totalChildPoints) * this._parent.weight;
  }
  
  /**
   * Get this node's share of its parent's points
   */
  get shareOfParent(): number {
    if (!this._parent) return 1;
    return this._parent.totalChildPoints === 0
      ? 0
      : this._points / this._parent.totalChildPoints;
  }
  
  /**
   * Check if this node has any direct contribution children
   */
  get hasDirectContributionChild(): boolean {
    return Array.from(this._children.values()).some(child => child.isContribution);
  }
  
  /**
   * Check if this node has any non-contribution children
   */
  get hasNonContributionChild(): boolean {
    return Array.from(this._children.values()).some(child => !child.isContribution);
  }
  
  /**
   * Get the weight of contribution children relative to all children
   */
  get contributionChildrenWeight(): number {
    const contributionPoints = Array.from(this._children.values())
      .filter(child => child.isContribution)
      .reduce((sum, child) => sum + child.points, 0);
    
    return contributionPoints / this.totalChildPoints;
  }
  
  /**
   * Get the contribution children's fulfillment
   */
  get contributionChildrenFulfillment(): number {
    const contributionChildren = Array.from(this._children.values())
      .filter(child => child.isContribution);
    
    return contributionChildren.reduce(
      (sum, child) => sum + child.fulfilled * child.shareOfParent,
      0
    );
  }
  
  /**
   * Get the non-contribution children's fulfillment
   */
  get nonContributionChildrenFulfillment(): number {
    const nonContributionChildren = Array.from(this._children.values())
      .filter(child => !child.isContribution);
    
    return nonContributionChildren.reduce(
      (sum, child) => sum + child.fulfilled * child.shareOfParent,
      0
    );
  }
  
  /**
   * Get this node's fulfillment value
   */
  get fulfilled(): number {
    console.log(`[${this._name}] Calculating fulfillment...`);
    console.log(`  - Has children: ${this._children.size > 0}`);
    console.log(`  - Is contribution: ${this.isContribution}`);
    console.log(`  - Has manual fulfillment: ${this._manualFulfillment !== null}`);
    console.log(`  - Manual fulfillment value: ${this._manualFulfillment}`);

    // IMPORTANT: If this is a contribution, it should have fulfillment=1.0
    // regardless of children (to handle race conditions during type assignment)
    if (this.isContribution) {
      console.log(`  - Node is a contribution, fulfillment = 1.0 (regardless of children)`);
      return 1.0;
    }

    // For leaf nodes (no children)
    if (this._children.size === 0) {
      // Non-contribution leaf node has zero fulfillment
      console.log(`  - Leaf non-contribution node, fulfillment = 0.0`);
      return 0.0;
    }
    
    // If fulfillment was manually set and node has contributor children
    if (this._manualFulfillment !== null && this.hasDirectContributionChild) {
      console.log(`  - Using manual fulfillment for node with contribution children`);
      // If we only have contributor children
      if (!this.hasNonContributionChild) {
        console.log(`  - Only has contribution children, using manual value: ${this._manualFulfillment}`);
        return this._manualFulfillment;
      }
      
      // For hybrid case: combine manual fulfillment for contributor children
      // with calculated fulfillment for non-contributor children
      const contributionChildrenWeight = this.contributionChildrenWeight;
      const nonContributionFulfillment = this.nonContributionChildrenFulfillment;
      
      const result = (
        this._manualFulfillment * contributionChildrenWeight +
        nonContributionFulfillment * (1 - contributionChildrenWeight)
      );
      
      console.log(`  - Hybrid node, result = ${result}`);
      console.log(`    - Contribution weight: ${contributionChildrenWeight}`);
      console.log(`    - Non-contribution fulfillment: ${nonContributionFulfillment}`);
      
      return result;
    }
    
    // Default case: calculate from all children
    const childrenFulfillment = Array.from(this._children.values()).reduce(
      (sum, child) => sum + child.fulfilled * child.shareOfParent,
      0
    );
    
    console.log(`  - Default case, calculated from children: ${childrenFulfillment}`);
    return childrenFulfillment;
  }
  
  /**
   * Get this node's desire value (inverse of fulfillment)
   */
  get desire(): number {
    return 1 - this.fulfilled;
  }
  
  /**
   * Get this node's fulfillment weight
   */
  get fulfillmentWeight(): number {
    return this.fulfilled * this.weight;
  }
  
  // TYPE INDEX METHODS
  
  private _typeIndex: Map<string, Set<string>> = new Map();
  
  /**
   * Add a node to the type index
   * @param capacityId Capacity ID
   * @param nodeId Node ID
   */
  public addToCapacityIndex(capacityId: string, nodeId: string): void {
    if (!this._typeIndex.has(capacityId)) {
      this._typeIndex.set(capacityId, new Set<string>());
    }
    this._typeIndex.get(capacityId)?.add(nodeId);
  }
  
  /**
   * Remove a node from the type index
   * @param capacityId Capacity ID
   * @param nodeId Node ID
   */
  public removeFromCapacityIndex(capacityId: string, nodeId: string): void {
    if (this._typeIndex.has(capacityId)) {
      this._typeIndex.get(capacityId)?.delete(nodeId);
    }
  }
  
  /**
   * Get all instances of a given type
   * @param capacityId Capacity ID
   * @returns Set of node IDs that are instances of the type
   */
  public getInstances(capacityId: string): Set<string> {
    return this.root._typeIndex.get(capacityId) || new Set();
  }
  
  /**
   * Get all capacities in the system
   */
  get rootCapacities(): string[] {
    return Array.from(this.root._typeIndex.keys());
  }
  
  // RECOGNITION METHODS
  
  /**
   * Calculate recognition of a specific instance
   */
  private recognitionOf(instance: TreeNode): number {
    const fulfilled = instance.fulfilled;
    const weight = instance.weight;
    const fulfillmentWeight = fulfilled * weight;
    const contributorCount = instance._capacities.size;
    
    console.log(`[${this._name}] Recognition details for ${instance._name}:`);
    console.log(`  - Fulfilled: ${fulfilled}`);
    console.log(`  - Weight: ${weight}`);
    console.log(`  - FulfillmentWeight: ${fulfillmentWeight}`);
    console.log(`  - Contributor count: ${contributorCount}`);
    
    const result = contributorCount > 0
      ? fulfillmentWeight / contributorCount
      : fulfillmentWeight;
      
    console.log(`  - Final recognition: ${result}`);
    
    return result;
  }

  /**
   * Calculate total recognition for a type
   */
  public shareOfGeneralFulfillment(capacityId: string): number {
    // Create a cache key for this calculation
    const cacheKey = `share_${capacityId}`;
    
    // Check if we have a recent cached value
    const cached = this._calculationCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && now - cached.timestamp < 2000) {
      // Use cached value if less than 2 seconds old
      return cached.value;
    }
    
    // Get all instances of this type
    const instances = this.getInstances(capacityId);
    console.log(`[${this._name}] Calculating share for type ${capacityId}, found ${instances.size} instances`);
    
    if (instances.size === 0) {
      this._calculationCache.set(cacheKey, {
        timestamp: now,
        value: 0
      });
      return 0;
    }
    
    // Calculate sum of recognition for all instances
    const totalRecognition = Array.from(instances)
      .map(id => {
        const instance = TreeNode._registry.get(id);
        if (!instance) {
          console.warn(`[${this._name}] Instance ${id} not found in registry`);
          return 0;
        }
        
        const recognition = this.recognitionOf(instance);
        // Log less frequently to reduce noise
        if (Math.random() < 0.3) {
          console.log(`[${this._name}] Recognition of ${instance._name} (${id}): ${recognition}`);
        }
        return recognition;
      })
      .reduce((sum, val) => sum + val, 0);
    
    console.log(`[${this._name}] Total recognition for type ${capacityId}: ${totalRecognition}`);
    
    // Cache the result
    this._calculationCache.set(cacheKey, {
      timestamp: now,
      value: totalRecognition
    });
    
    return totalRecognition;
  }

  public calculateShares(): {[key: string]: number} {
    // we need to calculate the shares for all capacities, but also we need to store the weights of all nodes (even those without capacities?)
      return Array.from(this.root._typeIndex.keys())
        .reduce((obj, capacityId) => ({
          ...obj,
          [capacityId]: this.shareOfGeneralFulfillment(capacityId)
        }), {});
  }
  
  /**
   * Calculate mutual fulfillment with a type
   */
  public mutualFulfillment(capacityId: string): number {
    // Create a cache key for this calculation
    const cacheKey = `mutual_${capacityId}`;
    
    // Check if we have a recent cached value
    const cached = this._calculationCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && now - cached.timestamp < 3000) {
      // Use cached value if less than 3 seconds old
      return cached.value;
    }
    
    // Calculate fresh value
    const recognitionFromHere = this.shareOfGeneralFulfillment(capacityId);
    const recognitionFromThere = this.sharesOfOthersRecognition[capacityId] || 0;
    
    console.log(`[${this._name}] Mutual fulfillment with ${capacityId}:`);
    console.log(`  - Recognition from here: ${recognitionFromHere}`);
    console.log(`  - Recognition from there: ${recognitionFromThere}`);
    
    const result = Math.min(recognitionFromHere, recognitionFromThere);
    console.log(`  - Mutual fulfillment result: ${result}`);
    
    // Cache the result
    this._calculationCache.set(cacheKey, {
      timestamp: now,
      value: result
    });
    
    return result;
  }
  
  
  /**
   * Get the distribution of mutual fulfillment across capacities
   */
  get mutualFulfillmentDistribution(): Map<string, number> {
    // Create a cache key
    const cacheKey = `mutualDist`;
    
    // Check if we have a recent cached value
    const cached = this._calculationCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && now - cached.timestamp < 2000) {
      // Use cached value if less than 2 seconds old
      return cached.value;
    }
    
    // Get all capacities from the root's type index
    const capacities = this.rootCapacities;
    
    // Add debugging but limit frequency
    console.log(`[${this._name}] Getting mutual fulfillment distribution, found ${capacities.length} capacities:`, capacities);
    console.log(`[${this._name}] Current sharesOfOthersRecognition:`, this.sharesOfOthersRecognition);
    
    // Calculate raw distribution values
    const rawDistribution = capacities
      .map(capacityId => {
        const instanceCount = this.getInstances(capacityId).size;
        const mutualValue = this.mutualFulfillment(capacityId);
        console.log(`[${this._name}] Capacity ${capacityId} has ${instanceCount} instances, mutual value: ${mutualValue}`);
        
        return {
        capacityId,
          value: mutualValue,
          hasInstances: instanceCount > 0
        };
      })
      .filter(entry => entry.value > 0 && entry.hasInstances);
    
    console.log(`[${this._name}] Raw distribution after filtering:`, 
      rawDistribution.map(d => `${d.capacityId}: ${d.value}`));
    
    // Calculate total for normalization
    const total = rawDistribution.reduce((sum, entry) => sum + entry.value, 0);
    console.log(`[${this._name}] Total mutual fulfillment: ${total}`);
    
    // Create the normalized distribution map
    const result = new Map(
      rawDistribution.map(entry => [
        entry.capacityId,
        total > 0 ? entry.value / total : 0
      ])
    );
    
    console.log(`[${this._name}] Final distribution map has ${result.size} entries`);
    
    // Cache the result
    this._calculationCache.set(cacheKey, {
      timestamp: now,
      value: result
    });
    
    // Convert Map to object for Gun storage
    const distributionObj = Object.fromEntries(result);
    
    // Save to Gun database using the path abstraction
    this.get('mutualFulfillmentDistribution').put(distributionObj as any);
    
    
    // Schedule social distribution update if this is a root node
    if (this.isRoot) {
      // Get social distribution instance
      const socialDist = this.getSocialDistributionInstance();
      if (socialDist) {
        socialDist.scheduleSocialDistributionUpdate();
      }
    }
    
    return result;
  }
  
  /**
   * Get social distribution instance for this node
   */
  public getSocialDistributionInstance(): any {
    if (!this._socialDistributionInstance) {
      // We need to use a dynamic import here to avoid circular reference
      // Schedule creation for the next tick to ensure it's initialized
      setTimeout(() => {
        if (!this._socialDistributionInstance) {
          import('../SocialDistribution').then(({ SocialDistribution }) => {
            this._socialDistributionInstance = new SocialDistribution(this);
          });
        }
      }, 0);
    }
    return this._socialDistributionInstance;
  }
  
  /**
   * Get the distribution of social shares (direct and transitive) across all nodes
   * @param depth Maximum traversal depth (default: 5)
   * @returns Map of node IDs to their normalized social share values
   */
  public get socialDistribution(): Map<string, number> {
    return this.getSocialDistribution();
  }
  
  /**
   * Get social distribution with optional custom depth
   * @param depth Maximum traversal depth (default: 5)
   * @returns Map of node IDs to their normalized social share values
   */
  public getSocialDistribution(depth: number = 5): Map<string, number> {
    if (this._socialDistributionInstance) {
      return this._socialDistributionInstance.getSocialDistribution(depth);
    }
    
    // Create instance if not exists
    this.getSocialDistributionInstance();
    
    // Return empty map while instance is being created
    return new Map<string, number>();
  }
  
  /**
   * Clean up all subscriptions
   */
  public unsubscribe(): void {
    if (this._parentSubscription) {
      this._parentSubscription();
      this._parentSubscription = null;
    }
    
    if (this._childrenSubscription) {
      this._childrenSubscription();
      this._childrenSubscription = null;
    }
    
    if (this._capacitiesSubscription) {
      this._capacitiesSubscription();
      this._capacitiesSubscription = null;
    }
    
    // Only clean up recognition subscriptions if we're the root
    if (!this._parent) {
      this._recognitionSubscriptions.forEach(cleanup => cleanup());
      this._recognitionSubscriptions.clear();
      this._sharesOfOthersRecognition = {};
      
      // Clean up social distribution instance
      if (this._socialDistributionInstance) {
        this._socialDistributionInstance.cleanup();
        this._socialDistributionInstance = null;
      }
    }
    
    // Remove from registry
    TreeNode._registry.delete(this._id);
  }
  
  /**
   * Static method to clean up registry
   */
  public static cleanup(): void {
    // Unsubscribe all nodes
    TreeNode._registry.forEach(node => node.unsubscribe());
    TreeNode._registry.clear();
    
    // Clear any pending timeouts
    if (TreeNode._updateBatchTimeout) {
      clearTimeout(TreeNode._updateBatchTimeout);
      TreeNode._updateBatchTimeout = null;
    }
    
    if (TreeNode._startupModeTimeout) {
      clearTimeout(TreeNode._startupModeTimeout);
      TreeNode._startupModeTimeout = null;
    }
    
    // Reset startup mode
    TreeNode._startupMode = true;
    TreeNode._loggingEnabled = false;
    TreeNode._pendingUpdates.clear();
  }

  /**
   * Create a Svelte-compatible store for this node's data
   * @returns A store that reactively updates with the node's data
   */
  public toStore() {
    const store = super.toStore();
    return store;
  }

  /**
   * Create a store for a specific property of this node
   * @param property The property to access
   * @param initialValue Optional initial value
   * @returns A store that updates with only that property
   */
  public createPropertyStore<K extends keyof TreeNodeData>(
    property: K,
    initialValue?: TreeNodeData[K]
  ) {
    // Use the initial value from the node if available
    const initial = initialValue !== undefined ? initialValue : 
                    (property in this ? this[property as string] : undefined);
    
    // Create a subscription for the property
    const nodeSub = new GunSubscription<TreeNodeData>(this.getPath());
    
    // Map the subscription to only emit the property
    const propSub = nodeSub.map(data => {
      if (!data) return initial as any;
      return data[property];
    });
    
    return propSub.toStore();
  }

  /**
   * Get a derived store for calculated properties
   * @param name The name of the calculated property
   * @returns A store that updates when the calculation changes
   */
  public getDerivedStore(name: 'fulfilled' | 'desire' | 'weight' | 'shareOfParent') {
    // Create initial subscription to node data to drive updates
    const nodeSub = new GunSubscription<TreeNodeData>(this.getPath());
    
    // Configure the store with proper initial value
    const initialValue = this[name];
    
    return {
      subscribe: (run: SubscriptionHandler<any>) => {
        // Keep track of the last value to avoid duplicate emissions
        let lastValue = initialValue;
        run(lastValue);
        
        // Subscribe to node data changes
        const cleanup = nodeSub.on(() => {
          // When data changes, recalculate the derived value
          const newValue = this[name];
          
          // Only notify if the value changed
          if (newValue !== lastValue) {
            lastValue = newValue;
            run(newValue);
          }
        });
        
        return cleanup;
      }
    };
  }

  /**
   * Get children as a stream
   * @returns A subscription that emits the children collection
   */
  public childrenStream() {
    const childrenNode = this.get('children');
    const subscription = childrenNode.each((childData) => {
      const childId = childData._key;
      if (childId === '_') return;
      
      // Return the actual node if it exists in registry
      return TreeNode._registry.get(childId);
    });
    return subscription;
  }

  /**
   * Get capacities as a stream
   * @returns A subscription that emits the capacities collection
   */
  public capacitiesStream() {
    const capacitiesNode = this.get('capacities');
    return capacitiesNode.each((typeData) => {
      return typeData._key;
    });
  }

  /**
   * Get a store of all children
   * @returns A store that emits the children map
   */
  public childrenStore() {
    // Track the current children map
    const currentChildren = new Map(this._children);
    
    // Create a direct subscription to the children collection
    const childrenNode = this.get('children');
    
    return {
      subscribe: (run: SubscriptionHandler<Map<string, TreeNode>>) => {
        // Immediately emit current value
        run(new Map(currentChildren));
        
        // Set up the subscription directly
        const cleanup = childrenNode.each((childData) => {
          if (!childData) return;
          
          const childId = childData._key;
          if (!childId || childId === '_') return;
          
          // Get the node from registry
          const node = TreeNode._registry.get(childId);
          if (node) {
            // Update the map
            currentChildren.set(childId, node);
            
            // Notify subscriber with a new map
            run(new Map(currentChildren));
          }
        });
        
        return cleanup;
      }
    };
  }

  /**
   * Schedule a batch update to Gun
   * @param path Path to update
   * @param value Value to set
   */
  public static scheduleBatchUpdate(path: string[], value: any): void {
    // Create a path string for the map key
    const pathStr = path.join('/');
    
    // Add to pending updates map
    TreeNode._pendingUpdates.set(pathStr, value);
    
    // Schedule processing if not already scheduled
    if (!TreeNode._updateBatchTimeout) {
      TreeNode._updateBatchTimeout = setTimeout(() => {
        TreeNode.processBatchUpdates();
      }, 500);
    }
  }
  
  /**
   * Process all pending batch updates
   */
  public static processBatchUpdates(): void {
    // Clear the timeout
    if (TreeNode._updateBatchTimeout) {
      clearTimeout(TreeNode._updateBatchTimeout);
      TreeNode._updateBatchTimeout = null;
    }
    
    // Skip if no updates
    if (TreeNode._pendingUpdates.size === 0) return;
    
    TreeNode.log(`Processing ${TreeNode._pendingUpdates.size} batch updates`);
    
    // Process all updates
    TreeNode._pendingUpdates.forEach((value, pathStr) => {
      // Convert path string back to array
      const path = pathStr.split('/');
      
      // Apply the update to Gun
      let ref: any = gun;
      for (const segment of path) {
        ref = ref.get(segment);
      }
      
      // Put the value
      ref.put(value);
    });
    
    // Clear the pending updates
    TreeNode._pendingUpdates.clear();
  }

  public static getNodeById(id: string): TreeNode | null {
    return TreeNode._registry.get(id) || null;
  }

  /**
   * Save social distribution to Gun database
   */
  public saveSocialDistribution(distributionObj: any): void {
    this.get('socialDistribution').put(distributionObj as any);
    
    // Update UI
    this._coordinator.pieUpdateNeeded = true;
  }

  /**
   * Get path for this node in Gun
   */
  public getGunPath(): string[] {
    return this.getPath();
  }
} 