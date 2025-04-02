import { Reactive, Computed, ReactiveEntity } from '../Reactive';
import { App } from '../../App';
import { gun } from '../Gun';
import { TreeNode } from '../ReactTreeNode';

// I wonder if we could reorganize this Make it much simpler such that a role is an independent thing that can point to another role as its counterpart. And that can be a one way direction and then it can also be bi directional potentially, if both point at each other. And that each or any role could actually also point to another node as its type in the sense of its association. So rather than creating an association with a fixed number of things, nodes would point towards the thing that they are trying to categorize themselves as. 
// Please create this simpler implementation in roles.ts 
// Don't bother with any of the reactivity stuff just now. Like, let's just focus on getting this data structure, the interfaces and types set out in a very elegant and simply way. 

// Types for our domain entities
export interface SocialNodeData {
  id: string;
  name: string;
  parent?: string;
  types: string[];
  isContributor: boolean;
}

export interface AssociationData {
  id: string;
  name: string;
  compositions: string[];
}

export interface RoleStatus {
  type: 'user-role' | 'provider-role';
  association: Association;
  totalShares: number;
  holder: SocialNode;
  desires: boolean;
  playing: boolean;
  associationPlaying: boolean;
}

export interface UserRoleStatus extends RoleStatus {
  type: 'user-role';
  correspondingProviderRole: ProviderRole;
}

export interface ProviderRoleStatus extends RoleStatus {
  type: 'provider-role';
  correspondingUserRole: UserRole;
}

export interface AssociationInstance {
  userRole: UserRole;
  providerRole: ProviderRole;
}

/**
 * Base role implementation with shared functionality
 */
abstract class Role {
  private _holder: Reactive<SocialNode>;
  private _desires = new Reactive<boolean>(false);
  private _playing = new Reactive<boolean>(false);
  
  constructor(
    protected association: Association,
    initialHolder: SocialNode,
    private type: 'user-role' | 'provider-role',
    protected correspondingRole?: Role
  ) {
    this._holder = new Reactive<SocialNode>(initialHolder);
  }
  
  get holder(): SocialNode {
    return this._holder.value;
  }
  
  set holder(newHolder: SocialNode) {
    this._holder.value = newHolder;
    
    // Reset state when holder changes
    this._desires.value = false;
    this._playing.value = false;
  }
  
  get desires(): boolean {
    return this._desires.value;
  }
  
  get playing(): boolean {
    return this._playing.value;
  }
  
  get associationPlaying(): boolean {
    if (!this.correspondingRole) return false;
    return this.playing && this.correspondingRole.playing;
  }
  
  /**
   * Transfer this role to a new holder with fluent API
   */
  transfer(expressor: SocialNode, newHolder: SocialNode): Role {
    if (expressor !== this.holder) {
      throw new Error("Unauthorized: only current holder can transfer");
    }
    
    this.holder = newHolder;
    return this;
  }
  
  /**
   * Toggle desiring state with fluent API
   */
  toggleDesiring(expressor: SocialNode): Role {
    if (expressor !== this.holder) {
      throw new Error("Unauthorized: only current holder can toggle desire");
    }
    
    this._desires.value = !this._desires.value;
    
    // If turning off desire, stop playing
    if (!this._desires.value) {
      this._playing.value = false;
    }
    
    return this;
  }
  
  /**
   * Set desire state directly with fluent API
   */
  setDesire(expressor: SocialNode, desireState: boolean): Role {
    if (expressor !== this.holder) {
      throw new Error("Unauthorized: only current holder can set desire");
    }
    
    // Only update if different to avoid unnecessary notifications
    if (this._desires.value !== desireState) {
      this._desires.value = desireState;
      
      // If turning off desire, stop playing
      if (!this._desires.value) {
        this._playing.value = false;
      }
    }
    
    return this;
  }
  
  /**
   * Toggle playing state with fluent API
   */
  togglePlaying(expressor: SocialNode): Role {
    if (expressor !== this.holder) {
      throw new Error("Unauthorized: only current holder can toggle playing");
    }
    
    if (!this._desires.value) {
      throw new Error("Cannot play without desire");
    }
    
    this._playing.value = !this._playing.value;
    return this;
  }
  
  /**
   * Set playing state directly with fluent API
   */
  setPlaying(expressor: SocialNode, playingState: boolean): Role {
    if (expressor !== this.holder) {
      throw new Error("Unauthorized: only current holder can set playing state");
    }
    
    if (!this._desires.value && playingState) {
      throw new Error("Cannot play without desire");
    }
    
    // Only update if different to avoid unnecessary notifications
    if (this._playing.value !== playingState) {
      this._playing.value = playingState;
    }
    
    return this;
  }
  
  /**
   * Subscribe to holder changes
   */
  onHolderChange(callback: (holder: SocialNode) => void): () => void {
    return this._holder.subscribe(callback);
  }
  
  /**
   * Subscribe to desire changes
   */
  onDesireChange(callback: (desires: boolean) => void): () => void {
    return this._desires.subscribe(callback);
  }
  
  /**
   * Subscribe to playing changes
   */
  onPlayingChange(callback: (playing: boolean) => void): () => void {
    return this._playing.subscribe(callback);
  }
  
  /**
   * Get a summary of this role's status
   */
  abstract getStatus(): RoleStatus;
}

/**
 * User role in an association
 */
export class UserRole extends Role {
  constructor(
    association: Association,
    holder: SocialNode,
    public providerRole: ProviderRole
  ) {
    super(association, holder, 'user-role');
    this.correspondingRole = providerRole;
  }
  
  /**
   * Override togglePlaying to handle dependence on provider role
   */
  togglePlaying(expressor: SocialNode): Role {
    if (expressor !== this.holder) {
      throw new Error("Unauthorized: only current holder can toggle playing");
    }
    
    if (!this.desires) {
      throw new Error("Cannot play without desire");
    }
    
    if (!this.providerRole.playing && !this.playing) {
      throw new Error("Cannot play without provider");
    }
    
    // Call setPlaying to toggle the state - using proper API instead of accessing private field
    return this.setPlaying(expressor, !this.playing);
  }
  
  getStatus(): UserRoleStatus {
    return {
      type: 'user-role',
      association: this.association,
      totalShares: this.association.associations.length,
      holder: this.holder,
      desires: this.desires,
      playing: this.playing,
      associationPlaying: this.associationPlaying,
      correspondingProviderRole: this.providerRole
    };
  }
}

/**
 * Provider role in an association
 */
export class ProviderRole extends Role {
  constructor(
    association: Association,
    holder: SocialNode,
    public userRole: UserRole
  ) {
    super(association, holder, 'provider-role');
    this.correspondingRole = userRole;
  }
  
  getStatus(): ProviderRoleStatus {
    return {
      type: 'provider-role',
      association: this.association,
      totalShares: this.association.associations.length,
      holder: this.holder,
      desires: this.desires,
      playing: this.playing,
      associationPlaying: this.associationPlaying,
      correspondingUserRole: this.userRole
    };
  }
}

/**
 * Association entity representing a relationship between social nodes
 */
export class Association extends ReactiveEntity<AssociationData> {
  private static _registry = new Map<string, Association>();
  
  private _associations = new Reactive<AssociationInstance[]>([]);
  private _compositions = new Reactive<string[]>([]);
  
  // Declare reactive properties
  declare public name: string;
  
  /**
   * Get an association by ID or create a new one
   */
  public static getAssociation(id: string, app: App): Association {
    let association = Association._registry.get(id);
    
    if (!association) {
      association = new Association(id, app);
      Association._registry.set(id, association);
    }
    
    return association;
  }
  
  /**
   * Create a new association
   */
  public static async create(
    name: string,
    options: {
      totalShares?: number,
      initialHolder?: SocialNode,
      compositions?: string[],
      id?: string
    },
    app: App
  ): Promise<Association> {
    const id = options.id || crypto.randomUUID();
    
    // Create data
    const data: AssociationData = {
      id,
      name,
      compositions: options.compositions || []
    };
    
    // Get or create association
    const association = Association.getAssociation(id, app);
    
    // Store in Gun
    await association.gunNode.put(data);
    
    // Set properties
    association.name = name;
    association._compositions.value = options.compositions || [];
    
    // Create initial shares
    if (options.initialHolder && options.totalShares) {
      for (let i = 0; i < options.totalShares; i++) {
        association.socialRelation(options.initialHolder, options.initialHolder);
      }
    }
    
    return association;
  }
  
  private constructor(id: string, app: App) {
    super(id, app);
    
    // Define reactive properties
    this.defineReactiveProperty('name', '', ['associations', id, 'name']);
    
    // Set up subscriptions
    this.setupSubscriptions();
  }
  
  private setupSubscriptions(): void {
    // Subscribe to compositions
    const compositionsSub = this.gunNode.get('compositions').stream().each();
    const subscription = compositionsSub.on(data => {
      if (!data || typeof data !== 'object') return;
      
      if (data._removed) {
        // Remove composition
        const compositions = [...this._compositions.value];
        const index = compositions.indexOf(data._key);
        if (index >= 0) {
          compositions.splice(index, 1);
          this._compositions.value = compositions;
        }
        return;
      }
      
      // Add composition
      const compositions = [...this._compositions.value];
      if (!compositions.includes(data._key)) {
        compositions.push(data._key);
        this._compositions.value = compositions;
      }
    });
    
    this.addSubscription(subscription);
    
    // Subscribe to instances
    const instancesSub = this.gunNode.get('instances').stream().each();
    const instancesSubscription = instancesSub.on(async (data) => {
      if (!data || typeof data !== 'object') return;
      
      if (data._removed) {
        // Handle instance removal (more complex - would need instance IDs)
        return;
      }
      
      // Get holders
      if (data.userHolder && data.providerHolder) {
        const userHolder = await SocialNodeFactory.getNode(data.userHolder, this._app);
        const providerHolder = await SocialNodeFactory.getNode(data.providerHolder, this._app);
        
        // Check if we already have this instance
        const exists = this._associations.value.some(assoc => 
          assoc.userRole.holder.id === userHolder.id && 
          assoc.providerRole.holder.id === providerHolder.id
        );
        
        if (!exists) {
          // Create the association locally
          this.createLocalRelation(userHolder, providerHolder, data._key);
        }
      }
    });
    
    this.addSubscription(instancesSubscription);
  }
  
  /**
   * Create a local association instance without persisting to Gun
   */
  private createLocalRelation(userHolder: SocialNode, providerHolder: SocialNode, id?: string): AssociationInstance {
    // Create mutually referencing roles
    const association: AssociationInstance = {} as any;
    
    // Create the roles with circular references
    const userRole = new UserRole(this, userHolder, null as any);
    const providerRole = new ProviderRole(this, providerHolder, userRole);
    userRole.providerRole = providerRole;
    
    // Complete the association
    association.userRole = userRole;
    association.providerRole = providerRole;
    
    // Store the association
    const associations = [...this._associations.value];
    associations.push(association);
    this._associations.value = associations;
    
    // Add this association to the holders
    userHolder.addAssociation(this);
    if (providerHolder.id !== userHolder.id) {
      providerHolder.addAssociation(this);
    }
    
    // Set up role holder change subscriptions
    userRole.onHolderChange(newHolder => {
      // Update the Gun record if this instance has an ID
      if (id) {
        gun.get('associations').get(this.id).get('instances').get(id).get('userHolder').put(newHolder.id);
      }
    });
    
    providerRole.onHolderChange(newHolder => {
      // Update the Gun record if this instance has an ID
      if (id) {
        gun.get('associations').get(this.id).get('instances').get(id).get('providerHolder').put(newHolder.id);
      }
    });
    
    return association;
  }
  
  /**
   * Create a social relation between two nodes
   */
  public socialRelation(userRoleHolder: SocialNode, providerRoleHolder: SocialNode): AssociationInstance {
    // Create a unique ID for this relation
    const assocId = crypto.randomUUID();
    
    // Store in Gun first
    gun.get('associations').get(this.id).get('instances').get(assocId).put({
      userHolder: userRoleHolder.id,
      providerHolder: providerRoleHolder.id
    });
    
    // Create the local relation
    return this.createLocalRelation(userRoleHolder, providerRoleHolder, assocId);
  }
  
  /**
   * Get all association instances
   */
  get associations(): AssociationInstance[] {
    return [...this._associations.value];
  }
  
  /**
   * Get all compositions
   */
  get compositions(): string[] {
    return [...this._compositions.value];
  }
  
  /**
   * Get the status of this association
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      totalShares: this._associations.value.length,
      composes: this.compositions,
      associations: this._associations.value.map(association => ({
        userRole: association.userRole.getStatus(),
        providerRole: association.providerRole.getStatus()
      }))
    };
  }
  
  /**
   * Subscribe to changes in association instances
   */
  onAssociationsChange(callback: (associations: AssociationInstance[]) => void): () => void {
    return this._associations.subscribe(callback);
  }
}


/**
 * Implement a better registry pattern using WeakMap for the SocialNodeFactory
 */
export class SocialNodeFactory {
  // Use WeakMap to allow garbage collection when SocialNodes are no longer referenced
  private static _idRegistry = new Map<string, SocialNode>();
  
  /**
   * Get or create a SocialNode instance
   */
  public static async getNode(id: string, app: App): Promise<SocialNode> {
    // First check if we have the node by ID
    let node = SocialNodeFactory._idRegistry.get(id);
    if (node) return node;
    
    try {
      // Create a new SocialNode (which extends TreeNode)
      node = await SocialNode.create('', { id }, app);
      SocialNodeFactory._idRegistry.set(id, node);
      return node;
    } catch (error) {
      console.error("Error creating SocialNode:", error);
      throw error;
    }
  }
  
  /**
   * Create a new SocialNode (wrapper around SocialNode.create)
   */
  public static async create(
    name: string,
    options: {
      parent?: SocialNode,
      types?: string[],
      points?: number,
      id?: string
    } = {},
    app: App
  ): Promise<SocialNode> {
    // Create the SocialNode through its static create method
    const node = await SocialNode.create(name, options, app);
    SocialNodeFactory._idRegistry.set(node.id, node);
    return node;
  }
  
  /**
   * Get all registered SocialNodes
   */
  public static getAllNodes(): SocialNode[] {
    return Array.from(SocialNodeFactory._idRegistry.values());
  }
  
  /**
   * Get nodes with a specific type
   */
  public static getNodesWithType(typeId: string): SocialNode[] {
    return SocialNodeFactory.getAllNodes()
      .filter(node => node.types.has(typeId));
  }
  
  /**
   * Clear registry when needed (for testing or cleanup)
   */
  public static clearRegistry(): void {
    SocialNodeFactory._idRegistry.clear();
  }
}

/**
 * Social node representing an entity in the system
 * Using composition with TreeNode for better integration
 */
export class SocialNode {
  private _treeNode: TreeNode;
  private _associations = new Reactive<Association[]>([]);
  private _holding: Computed<Set<Role>>;
  private _lazyDistributionCache = new Map<string, Map<SocialNode, number>>();
  private _lastDistributionTimestamp = 0;
  
  // Distribution cache lifetime in milliseconds (5 seconds)
  private static DISTRIBUTION_CACHE_TTL = 5000;
  
  // Add subscriptions array to track cleanups
  private _subscriptions: Array<() => void> = [];
  
  /**
   * Create a new SocialNode
   */
  public static async create(
    name: string,
    options: {
      parent?: SocialNode,
      types?: string[],
      points?: number,
      id?: string
    } = {},
    app: App
  ): Promise<SocialNode> {
    // First create a TreeNode
    const nodeId = options.id || crypto.randomUUID();
    
    // Create the TreeNode with parent reference if provided
    const parentId = options.parent ? options.parent._treeNode : undefined;
    
    const treeNode = await TreeNode.create(name, {
      id: nodeId,
      points: options.points || 0,
      parent: parentId
    }, app);
    
    // Create the SocialNode wrapper
    const node = new SocialNode(treeNode);
    
    // Add types if provided
    if (options.types && options.types.length > 0) {
      options.types.forEach(type => node.addType(type));
    }
    
    return node;
  }
  
  /**
   * Private constructor - use static create method instead
   */
  private constructor(treeNode: TreeNode) {
    this._treeNode = treeNode;
    
    // Define computed property for held roles
    this._holding = new Computed<Set<Role>>(() => {
      const holdings = new Set<Role>();
      
      this._associations.value.forEach(association => {
        association.associations.forEach(instance => {
          if (instance.userRole.holder === this) {
            holdings.add(instance.userRole);
          }
          if (instance.providerRole.holder === this) {
            holdings.add(instance.providerRole);
          }
        });
      });
      
      return holdings;
    });
    
    // Listen for changes in types
    this.addTypeChangeListener();
  }
  
  /**
   * Add listener for type changes
   */
  private addTypeChangeListener(): void {
    // We subscribe to reactive changes in points to invalidate the cache
    const pointsObserver = () => this.invalidateDistributionCache();
    const subscription = this._treeNode.getStore('points').subscribe(pointsObserver);
    
    // We'll use dispose() to clean up subscriptions when the node is disposed
    // This avoids using the protected addSubscription method
  }
  
  /**
   * Add subscription for cleanup
   */
  addSubscription(cleanupFn: () => void): void {
    // We'll keep track of subscriptions ourselves
    // When SocialNode is disposed, we'll call these cleanup functions
    this._subscriptions.push(cleanupFn);
  }
  
  // TreeNode property delegation
  get id(): string {
    return this._treeNode.id;
  }
  
  get name(): string {
    return this._treeNode.name;
  }
  
  set name(value: string) {
    this._treeNode.name = value;
  }
  
  get points(): number {
    return this._treeNode.points;
  }
  
  set points(value: number) {
    this._treeNode.points = value;
    // Clear distribution cache when points change
    this.invalidateDistributionCache();
  }
  
  get isContributor(): boolean {
    return this._treeNode.isContributor;
  }
  
  get types(): Set<string> {
    return this._treeNode.types;
  }
  
  get mutualFulfillmentDistribution(): Map<string, number> {
    return this._treeNode.mutualFulfillmentDistribution;
  }
  
  /**
   * Add a type to this node
   */
  addType(typeId: string): SocialNode {
    this._treeNode.addType(typeId);
    return this;
  }
  
  /**
   * Remove a type from this node
   */
  removeType(typeId: string): SocialNode {
    this._treeNode.removeType(typeId);
    return this;
  }
  
  /**
   * Invalidate the distribution cache
   */
  private invalidateDistributionCache(): void {
    this._lazyDistributionCache.clear();
    this._lastDistributionTimestamp = 0;
  }
  
  /**
   * Get a stable key for the distribution cache
   */
  private getDistributionCacheKey(): string {
    // Include relevant state that would affect distribution
    return `${this.id}-${this.points}-${Array.from(this.types).join(',')}`;
  }
  
  // Social node specific functionality
  
  /**
   * Get all roles held by this node
   */
  public getHolding(): Set<Role> {
    return new Set(this._holding.value);
  }
  
  /**
   * Get roles this node desires to play
   */
  public getDesiring(): Set<Role> {
    return new Set(
      Array.from(this._holding.value).filter(role => role.desires)
    );
  }
  
  /**
   * Get roles this node is actively playing
   */
  public getPlaying(): Set<Role> {
    return new Set(
      Array.from(this._holding.value).filter(role => role.playing)
    );
  }
  
  /**
   * Toggle the desire status for a role
   */
  public toggleDesiring(role: Role): SocialNode {
    if (role.holder !== this) {
      throw new Error("Can only toggle desire for roles we hold");
    }
    
    role.toggleDesiring(this);
    return this;
  }
  
  /**
   * Toggle the play status for a role
   */
  public togglePlaying(role: Role): SocialNode {
    if (role.holder !== this) {
      throw new Error("Can only toggle playing for roles we hold");
    }
    
    role.togglePlaying(this);
    return this;
  }
  
  /**
   * Calculate contribution distribution for this node based on mutual fulfillment
   * with efficient caching
   */
  public distribution(): Map<SocialNode, number> {
    const now = Date.now();
    const cacheKey = this.getDistributionCacheKey();
    
    // Check if we have a valid cached result
    if (
      this._lazyDistributionCache.has(cacheKey) && 
      (now - this._lastDistributionTimestamp) < SocialNode.DISTRIBUTION_CACHE_TTL
    ) {
      return new Map(this._lazyDistributionCache.get(cacheKey)!);
    }
    
    // Calculate fresh distribution
    const distribution = new Map<SocialNode, number>();
    
    // Use TreeNode's mutual fulfillment distribution
    this.mutualFulfillmentDistribution.forEach((value, typeId) => {
      // Find social nodes that implement this type
      const nodesWithType = SocialNodeFactory.getNodesWithType(typeId);
      
      if (nodesWithType.length > 0) {
        // Distribute this type's value among all nodes with this type
        const sharePerNode = value / nodesWithType.length;
        
        nodesWithType.forEach(node => {
          distribution.set(node, (distribution.get(node) || 0) + sharePerNode);
        });
      }
    });
    
    // If no distribution was calculated, give all to self
    if (distribution.size === 0) {
      distribution.set(this, 1);
    }
    
    // Cache the result
    this._lazyDistributionCache.set(cacheKey, new Map(distribution));
    this._lastDistributionTimestamp = now;
    
    // Return a copy to prevent mutation of the cached version
    return new Map(distribution);
  }
  
  /**
   * Distribute surplus roles based on contribution with improved algorithm
   */
  public distributeSurplus(): void {
    // Get undesired holdings (surplus)
    const holdings = this.getHolding();
    const desires = this.getDesiring();
    const surplus = new Set(
      Array.from(holdings).filter(role => !desires.has(role))
    );
    
    if (surplus.size === 0) {
      console.log("No surplus roles to distribute");
      return; // Nothing to distribute
    }
    
    // Group surplus by association type AND role type
    const surplusByTypeAndRole = new Map<string, {
      association: Association,
      roleType: 'user-role' | 'provider-role',
      roles: Role[]
    }>();
    
    surplus.forEach(role => {
      const status = role.getStatus();
      const association = status.association;
      const roleType = status.type;
      const key = `${association.name}-${roleType}`;
      
      if (!surplusByTypeAndRole.has(key)) {
        surplusByTypeAndRole.set(key, {
          association,
          roleType,
          roles: []
        });
      }
      
      surplusByTypeAndRole.get(key)!.roles.push(role);
    });
    
    // Calculate distribution of contributors
    const distribution = this.distribution();
    
    // Sort contributors by share to ensure deterministic distribution
    const sortedContributors = Array.from(distribution.entries())
      .sort((a, b) => b[1] - a[1]); // Sort by share, descending
    
    // For each association-role combination, distribute its shares
    surplusByTypeAndRole.forEach(({association, roleType, roles}) => {
      // Count total shares to distribute
      const totalShares = roles.length;
      
      if (totalShares === 0) return;
      
      console.log(`Distributing ${totalShares} surplus roles of type ${roleType} for association ${association.name}`);
      
      // Track shares allocated to each contributor
      const contributorAllocations = new Map<SocialNode, number>();
      
      // First pass: Calculate ideal fractional allocations
      sortedContributors.forEach(([contributor, share]) => {
        if (share > 0) {
          // Calculate exact number of shares this contributor should receive (may be fractional)
          const idealShares = totalShares * share;
          contributorAllocations.set(contributor, idealShares);
        }
      });
      
      // Second pass: Convert to whole shares and handle remainders
      let remainingRoles = [...roles]; // Copy the roles array to track remaining roles
      
      // First allocate whole shares
      for (const [contributor, idealShares] of contributorAllocations.entries()) {
        // Integer number of shares to allocate
        const wholeSharesToAllocate = Math.floor(idealShares);
        
        if (wholeSharesToAllocate > 0 && remainingRoles.length > 0) {
          // Allocate roles to this contributor
          const rolesToAllocate = remainingRoles.slice(0, wholeSharesToAllocate);
          remainingRoles = remainingRoles.slice(wholeSharesToAllocate);
          
          // Create new relationships for these roles
          rolesToAllocate.forEach(() => {
            association.socialRelation(contributor, contributor);
          });
          
          console.log(`Allocated ${rolesToAllocate.length} roles to ${contributor.name} (whole shares)`);
        }
      }
      
      // If there are remaining roles, distribute based on fractional parts
      if (remainingRoles.length > 0) {
        // Sort contributors by fractional part of ideal shares (descending)
        const contributorsByFraction = Array.from(contributorAllocations.entries())
          .map(([contributor, idealShares]) => ({
            contributor,
            fraction: idealShares - Math.floor(idealShares)
          }))
          .sort((a, b) => b.fraction - a.fraction);
        
        // Allocate remaining roles based on fractional priority
        for (let i = 0; i < remainingRoles.length; i++) {
          const { contributor } = contributorsByFraction[i % contributorsByFraction.length];
          association.socialRelation(contributor, contributor);
          console.log(`Allocated remaining role to ${contributor.name} (fractional share)`);
        }
      }
    });
  }
  
  /**
   * Get all associations this node is involved in
   */
  get associations(): Association[] {
    return [...this._associations.value];
  }
  
  /**
   * Add an association to this node
   */
  addAssociation(association: Association): SocialNode {
    const associations = [...this._associations.value];
    if (!associations.includes(association)) {
      associations.push(association);
      this._associations.value = associations;
    }
    return this;
  }
  
  /**
   * Subscribe to changes in roles held by this node
   */
  onHoldingChange(callback: (holdings: Set<Role>) => void): () => void {
    return this._holding.subscribe(callback);
  }
}
