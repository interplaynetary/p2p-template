import { GunNode } from '../gun/GunNode';
import { GunSubscription } from '../gun/GunSubscription';
import { SubscriptionCleanup } from '../gun/gunSetup';
import { TreeNode } from './TreeNode';

// ensure that we properly use GunSubscription and SubscriptionCleanup (reference TreeNode.ts)

/**
 * Represents an inventory entry with quantity and unit information
 */
export interface InventoryEntry {
  capacityId: string;   // The capacity ID this inventory entry is for
  quantity: number;     // How much capacity is available 
  unit: string;         // The unit of measurement (e.g., "apples", "hours", "housing units")
  lastUpdated: number;  // Timestamp of last update
  depth: number;        // The social-depth of access (1-5)
}

/**
 * Main inventory data structure stored in Gun
 */
export interface InventoryData {
  ownerId: string;                        // ID of the node that owns this inventory
  entries: Record<string, InventoryEntry>; // Map of capacity IDs to inventory entries
}

/**
 * Manages inventory of capacities that a node can provide
 * Bridges the gap between proportional access rights and concrete resource allocation
 */
export class Inventory extends GunNode<InventoryData> {
  private _ownerId: string;
  private _entries: Map<string, InventoryEntry> = new Map();
  private _entriesSubscription: SubscriptionCleanup | null = null;
  private _ownerNode: TreeNode | null = null;
  private _isInitialized: boolean = false;
  private _initializationPromise: Promise<void> | null = null;
  
  private static _registry: Map<string, Inventory> = new Map();
  
  /**
   * Get an inventory instance for a node
   * @param ownerId The ID of the node that owns this inventory
   * @param ownerNode Optional TreeNode reference
   * @returns Inventory instance
   */
  public static getInventory(ownerId: string, ownerNode?: TreeNode): Inventory {
    // Check if inventory already exists in registry
    if (Inventory._registry.has(ownerId)) {
      return Inventory._registry.get(ownerId)!;
    }
    
    // Create a new inventory
    const inventory = new Inventory(ownerId, ownerNode);
    Inventory._registry.set(ownerId, inventory);
    return inventory;
  }
  
  private constructor(ownerId: string, ownerNode?: TreeNode) {
    super(['inventories', ownerId]);
    this._ownerId = ownerId;
    this._ownerNode = ownerNode || null;
    
    // Initialize data and set up subscriptions
    this._initializationPromise = this.initialize();
  }
  
  /**
   * Initialize the inventory data and set up subscriptions
   * @returns Promise that resolves when initialization is complete
   */
  private async initialize(): Promise<void> {
    try {
      // Check if data exists using a timeout-safe pattern
      const dataPromise = this.once();
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Inventory data fetch timed out')), 5000);
      });
      
      // Race the data fetch against the timeout
      const data = await Promise.race([dataPromise, timeoutPromise])
        .catch(err => {
          console.warn(`Initializing inventory with empty data due to: ${err.message}`);
          return null;
        });
      
      // Initialize with empty data if needed
      if (!data) {
        try {
          this.put({
            ownerId: this._ownerId,
            entries: {}
          } as InventoryData);
        } catch (err) {
          console.error(`Failed to initialize inventory: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      
      // Setup subscriptions after data is initialized
      this.setupSubscriptions();
      this._isInitialized = true;
    } catch (error) {
      console.error(`Error initializing inventory: ${error.message}`);
      // Set up with empty data as fallback
      this._isInitialized = true;
    }
  }
  
  /**
   * Wait for initialization to complete
   * @returns Promise that resolves when initialization is complete
   */
  public async waitForInitialization(): Promise<void> {
    if (this._isInitialized) return Promise.resolve();
    return this._initializationPromise || Promise.resolve();
  }
  
  /**
   * Set up reactive subscriptions to inventory data
   */
  private setupSubscriptions(): void {
    // Clean up existing subscription
    if (this._entriesSubscription) {
      this._entriesSubscription();
      this._entriesSubscription = null;
    }
    
    try {
      // Subscribe to entries collection using the GunSubscription pattern
      const entriesSubscription = new GunSubscription([...this.getPath(), 'entries']);
      
      this._entriesSubscription = entriesSubscription.on((entries) => {
        if (!entries) return;
        
        // Clear current entries and rebuild from data
        this._entries.clear();
        
        // Process entries
        Object.entries(entries).forEach(([capacityId, entryData]) => {
          if (capacityId === '_' || !entryData) return;
          
          // Add to local collection
          this._entries.set(capacityId, entryData as InventoryEntry);
        });
      });
    } catch (error) {
      console.error(`Error setting up inventory subscriptions: ${error.message}`);
    }
  }
  
  /**
   * Get all inventory entries
   */
  get entries(): Map<string, InventoryEntry> {
    return new Map(this._entries);
  }
  
  /**
   * Get capacity entry for a specific capacity
   * @param capacityId Capacity ID
   * @returns The inventory entry or null if not found
   */
  public getCapacityEntry(capacityId: string): InventoryEntry | null {
    return this._entries.get(capacityId) || null;
  }
  
  /**
   * Set or update capacity in inventory
   * @param capacityId Capacity ID
   * @param quantity The available quantity
   * @param unit Unit of measurement
   * @param depth Access depth (1-5)
   * @returns This inventory for chaining
   */
  public async setCapacity(capacityId: string, quantity: number, unit: string, depth: number = 3): Promise<Inventory> {
    // Wait for initialization to complete
    await this.waitForInitialization();
    
    // Validate depth (ensure it's between 1-5)
    const validDepth = Math.max(1, Math.min(5, depth));
    
    // Create the entry
    const entry: InventoryEntry = {
      capacityId,
      quantity,
      unit,
      lastUpdated: Date.now(),
      depth: validDepth
    };
    
    try {
      // Update in Gun
      this.get('entries').get(capacityId).put(entry);
      
      // Update locally immediately
      this._entries.set(capacityId, entry);
    } catch (error) {
      console.error(`Error setting capacity ${capacityId}: ${error.message}`);
    }
    
    return this;
  }
  
  /**
   * Remove capacity from inventory
   * @param capacityId Capacity ID
   * @returns This inventory for chaining
   */
  public async removeCapacity(capacityId: string): Promise<Inventory> {
    // Wait for initialization to complete
    await this.waitForInitialization();
    
    try {
      // Remove from Gun
      this.get('entries').get(capacityId).put(null);
      
      // Remove locally
      this._entries.delete(capacityId);
    } catch (error) {
      console.error(`Error removing capacity ${capacityId}: ${error.message}`);
    }
    
    return this;
  }
  
  /**
   * Calculate allocation for a specific requester based on social distribution
   * @param capacityId The capacity ID to calculate allocation for
   * @param requesterId The ID of the node requesting access
   * @returns Object containing the calculated allocation and details
   */
  public async calculateAllocation(capacityId: string, requesterId: string): Promise<{
    capacityId: string;
    available: number;
    unit: string;
    allocation: number;
    percentage: number;
    depth: number;
  } | null> {
    // Wait for initialization to complete
    await this.waitForInitialization();
    
    // Get the capacity entry
    const entry = this.getCapacityEntry(capacityId);
    if (!entry) return null;
    
    // Need to get owner node to access social distribution
    if (!this._ownerNode) {
      // Use the public static method to get the node by ID
      this._ownerNode = TreeNode.getNodeById(this._ownerId);
      
      // If we still don't have the owner, we can't calculate allocation
      if (!this._ownerNode) return null;
    }
    
    try {
      // Get social distribution from owner node with the specified depth
      // Use the entry's depth setting to determine how far to traverse
      const socialDist = this._ownerNode.getSocialDistribution(entry.depth);
      
      // Get the requester's percentage
      const percentage = socialDist.get(requesterId) || 0;
      
      // Calculate allocation
      const allocation = entry.quantity * percentage;
      
      return {
        capacityId,
        available: entry.quantity,
        unit: entry.unit,
        allocation,
        percentage,
        depth: entry.depth
      };
    } catch (error) {
      console.error(`Error calculating allocation: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Draw down a portion of available capacity
   * @param capacityId The capacity ID to draw down
   * @param amount The amount to use
   * @returns Updated capacity or null if failed
   */
  public async drawDown(capacityId: string, amount: number): Promise<number | null> {
    // Wait for initialization to complete
    await this.waitForInitialization();
    
    // Get the capacity entry
    const entry = this.getCapacityEntry(capacityId);
    if (!entry) return null;
    
    // Ensure we have enough capacity
    if (entry.quantity < amount) return null;
    
    try {
      // Update the entry
      const newQuantity = entry.quantity - amount;
      await this.setCapacity(capacityId, newQuantity, entry.unit, entry.depth);
      
      return newQuantity;
    } catch (error) {
      console.error(`Error drawing down capacity ${capacityId}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Clean up all subscriptions
   */
  public unsubscribe(): void {
    if (this._entriesSubscription) {
      this._entriesSubscription();
      this._entriesSubscription = null;
    }
    
    // Remove from registry
    Inventory._registry.delete(this._ownerId);
  }
  
  /**
   * Static method to clean up registry
   */
  public static cleanup(): void {
    // Unsubscribe all inventories
    Inventory._registry.forEach(inventory => inventory.unsubscribe());
    Inventory._registry.clear();
  }
}
