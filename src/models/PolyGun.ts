import { gun } from './Gun'
import { GunNode } from './GunNode'
import { GunSubscription, SubscriptionHandler, SubscriptionCleanup } from './GunSubscription'
import { 
  Node, Role, RoleImpl, RoleState, MutualState, RelationFacet, 
  Relation, StateChangeType, StateChangeEvent, TypeChangeEvent
} from './Poly'

/**
 * Multi-Relation Roles Model
 * 
 * In this enhanced model, a Role is an independent entity that can:
 * 1. Form multiple relations with other Roles
 * 2. Point to a Node as its type/association
 * 3. Be held by a Node
 * 4. Have individual facets for each relation
 * 5. Toggle desire and playing on a per-relation basis
 */

/**
 * Svelte-compatible store interface
 */
export interface Readable<T> {
  subscribe: (run: (value: T) => void) => SubscriptionCleanup;
}

/**
 * GunRole represents a persistent Role that syncs with Gun database
 * Uses the reactive subscription pattern from GunSubscription
 */
export class GunRole implements Role {
  // Role properties from interface
  id: string;
  name: string;
  holder: Node;
  associationType?: Node;
  relations: Map<string, Role> = new Map();
  facets: Map<string, RelationFacet> = new Map();
  disconnectedDueToTypeChange: Set<string> = new Set();
  stateHistory: StateChangeEvent[] = [];

  // Gun integration properties
  private _gunNode: GunNode;
  private subscription: GunSubscription;
  private relationSubscriptions: Map<string, GunSubscription> = new Map();
  private facetSubscriptions: Map<string, GunSubscription> = new Map();
  private historySubscription: GunSubscription;
  
  // Svelte store subscriptions
  private roleStateStore: GunSubscription;
  private stateChangeListeners: Set<(role: GunRole) => void> = new Set();

  /**
   * Create a new GunRole
   * @param id Role ID (if not provided, Gun will generate one)
   * @param name Role name
   * @param holder Node that holds this role
   * @param associationType Optional type association
   */
  constructor(
    id: string,
    name: string,
    holder: Node,
    associationType?: Node
  ) {
    this.id = id;
    this.name = name;
    this.holder = holder;
    this.associationType = associationType;

    // Initialize Gun node for this role
    this._gunNode = new GunNode(['roles', id]);
    
    // Initialize with base data
    this.syncToGun();
    
    // Set up subscriptions
    this.setupSubscriptions();
  }

  /**
   * Get the Gun node for this role
   */
  get gunNode(): GunNode {
    return this._gunNode;
  }

  /**
   * Sync current state to Gun
   */
  private syncToGun(): void {
    this._gunNode.put({
      id: this.id,
      name: this.name,
      holder: this.holder,
      associationType: this.associationType
    });
  }

  /**
   * Create a Svelte-compatible store that tracks role state
   */
  toStore(): Readable<GunRole> {
    return {
      subscribe: (run: (value: GunRole) => void) => {
        // Add the listener
        this.stateChangeListeners.add(run);
        
        // Run it immediately
        run(this);
        
        // Return cleanup function
        return () => {
          this.stateChangeListeners.delete(run);
        };
      }
    };
  }

  /**
   * Create a Svelte-compatible store for a specific relation
   */
  relationStore(relationId: string): Readable<{
    relation: Role | undefined;
    facet: RelationFacet | undefined;
    disconnected: boolean;
    mutualState: MutualState;
  }> {
    return {
      subscribe: (run: (value: any) => void) => {
        // Create a listener function
        const listener = () => {
          const relation = this.relations.get(relationId);
          const facet = this.facets.get(relationId);
          const disconnected = this.isDisconnectedDueToTypeChange(relationId);
          const mutualState = relation ? this.getMutualStateWith(relation) : MutualState.NONE;
          
          run({
            relation,
            facet,
            disconnected,
            mutualState
          });
        };
        
        // Add the listener
        this.stateChangeListeners.add(listener);
        
        // Run it immediately
        listener();
        
        // Return cleanup function
        return () => {
          this.stateChangeListeners.delete(listener);
        };
      }
    };
  }

  /**
   * Notify all state change listeners
   */
  private notifyStateChange(): void {
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(this);
      } catch (err) {
        console.error('Error in role state change listener:', err);
      }
    });
  }

  /**
   * Set up all subscriptions to Gun data
   */
  private setupSubscriptions(): void {
    // Subscribe to basic properties
    this.subscription = this._gunNode.stream();
    this.subscription.on((data) => {
      let stateChanged = false;
      
      if (data.name && data.name !== this.name) {
        this.name = data.name;
        stateChanged = true;
      }
      
      if (data.holder && data.holder.id !== this.holder.id) {
        this.holder = data.holder;
        stateChanged = true;
      }
      
      if (data.associationType && 
          (!this.associationType || data.associationType.id !== this.associationType.id)) {
        this.associationType = data.associationType;
        stateChanged = true;
      }
      
      if (stateChanged) {
        this.notifyStateChange();
      }
    });
    
    // Subscribe to relations
    const relationsNode = this._gunNode.get('relations');
    const relationsSubscription = relationsNode.stream();
    relationsSubscription.on((data) => {
      if (!data) return;
      
      let stateChanged = false;
      
      // Process relations
      Object.keys(data).forEach(relationId => {
        if (relationId === '_') return; // Skip Gun metadata
        
        if (!this.relationSubscriptions.has(relationId)) {
          // Set up subscription for this relation
          const relationNode = relationsNode.get(relationId);
          const relationSub = relationNode.stream();
          
          relationSub.on((relationData) => {
            if (!relationData) return;
            
            // If we don't have this relation yet, we need to create it
            if (!this.relations.has(relationId)) {
              // Get the role from the factory or create a new one
              const relationRole = GunRoleFactory.getRole(relationId);
              if (relationRole) {
                this.relations.set(relationId, relationRole);
                stateChanged = true;
                this.notifyStateChange();
              }
            }
          });
          
          this.relationSubscriptions.set(relationId, relationSub);
        }
      });
    });
    
    // Subscribe to facets
    const facetsNode = this._gunNode.get('facets');
    const facetsSubscription = facetsNode.stream();
    facetsSubscription.on((data) => {
      if (!data) return;
      
      let stateChanged = false;
      
      // Process facets
      Object.keys(data).forEach(facetId => {
        if (facetId === '_') return; // Skip Gun metadata
        
        if (!this.facetSubscriptions.has(facetId)) {
          // Set up subscription for this facet
          const facetNode = facetsNode.get(facetId);
          const facetSub = facetNode.stream();
          
          facetSub.on((facetData) => {
            if (!facetData) return;
            
            // Update the facet in our map
            const oldFacet = this.facets.get(facetId);
            const newFacet = {
              desired: facetData.desired || false,
              playing: facetData.playing || false
            };
            
            // Check if the facet changed
            if (!oldFacet || 
                oldFacet.desired !== newFacet.desired || 
                oldFacet.playing !== newFacet.playing) {
              this.facets.set(facetId, newFacet);
              stateChanged = true;
              this.notifyStateChange();
            }
          });
          
          this.facetSubscriptions.set(facetId, facetSub);
        }
      });
    });
    
    // Subscribe to state history
    const historyNode = this._gunNode.get('stateHistory');
    this.historySubscription = historyNode.stream();
    
    this.historySubscription.on((data) => {
      if (!data) return;
      
      let stateChanged = false;
      
      // Process new history events
      Object.keys(data).forEach(eventId => {
        if (eventId === '_') return; // Skip Gun metadata
        
        const eventNode = historyNode.get(eventId);
        eventNode.once().then(eventData => {
          if (!eventData) return;
          
          // Add to our state history if it's not already there
          const exists = this.stateHistory.some(e => 
            e.timestamp === eventData.timestamp && 
            e.roleId === eventData.roleId &&
            e.type === eventData.type
          );
          
          if (!exists) {
            this.stateHistory.push(eventData);
            // Sort by timestamp to maintain order
            this.stateHistory.sort((a, b) => a.timestamp - b.timestamp);
            stateChanged = true;
            this.notifyStateChange();
          }
        });
      });
    });
    
    // Subscribe to disconnected roles
    const disconnectedNode = this._gunNode.get('disconnectedDueToTypeChange');
    const disconnectedSub = disconnectedNode.stream();
    
    disconnectedSub.on((data) => {
      if (!data) return;
      
      let stateChanged = false;
      
      // Process disconnected roles
      Object.keys(data).forEach(roleId => {
        if (roleId === '_') return; // Skip Gun metadata
        
        const wasDisconnected = this.disconnectedDueToTypeChange.has(roleId);
        
        if (data[roleId] && data[roleId].value === true && !wasDisconnected) {
          this.disconnectedDueToTypeChange.add(roleId);
          stateChanged = true;
        } else if ((!data[roleId] || data[roleId].value !== true) && wasDisconnected) {
          this.disconnectedDueToTypeChange.delete(roleId);
          stateChanged = true;
        }
      });
      
      if (stateChanged) {
        this.notifyStateChange();
      }
    });
    
    // Create a role state store for Svelte compatibility
    this.roleStateStore = this._gunNode.stream();
  }

  /**
   * Record a state change in history
   */
  recordStateChange(change: StateChangeEvent): void {
    // Add to local state history
    this.stateHistory.push(change);
    
    // Generate an ID for the event based on timestamp and type
    const eventId = `${change.timestamp}-${change.type}`;
    
    // Save to Gun
    this._gunNode.get('stateHistory').get(eventId).put(change);
    
    // Notify listeners
    this.notifyStateChange();
  }

  /**
   * Clean up all subscriptions
   */
  cleanup(): void {
    // Unsub from all subscriptions
    if (this.subscription) {
      // @ts-ignore - TypeScript thinks this is null but it's a method
      this.subscription.unsubscribe && this.subscription.unsubscribe();
      this.subscription = null;
    }
    
    this.relationSubscriptions.forEach(sub => {
      // @ts-ignore - TypeScript thinks this is null but it's a method
      sub.unsubscribe && sub.unsubscribe();
    });
    this.relationSubscriptions.clear();
    
    this.facetSubscriptions.forEach(sub => {
      // @ts-ignore - TypeScript thinks this is null but it's a method
      sub.unsubscribe && sub.unsubscribe();
    });
    this.facetSubscriptions.clear();
    
    if (this.historySubscription) {
      // @ts-ignore - TypeScript thinks this is null but it's a method
      this.historySubscription.unsubscribe && this.historySubscription.unsubscribe();
      this.historySubscription = null;
    }
    
    if (this.roleStateStore) {
      // @ts-ignore - TypeScript thinks this is null but it's a method
      this.roleStateStore.unsubscribe && this.roleStateStore.unsubscribe();
      this.roleStateStore = null;
    }
    
    // Clear listeners
    this.stateChangeListeners.clear();
  }

  // Role interface implementation methods
  
  /**
   * Get state history
   */
  getStateHistory(): StateChangeEvent[] {
    return [...this.stateHistory];
  }

  /**
   * Get state history of a specific type
   */
  getStateHistoryByType(type: StateChangeType): StateChangeEvent[] {
    return this.stateHistory.filter(event => event.type === type);
  }

  /**
   * Get state changes related to a specific role
   */
  getRelationStateHistory(roleId: string): StateChangeEvent[] {
    return this.stateHistory.filter(event => {
      if ('targetRoleId' in event) {
        return (event as any).targetRoleId === roleId;
      }
      return false;
    });
  }

  /**
   * Get the last state change
   */
  getLastStateChange(): StateChangeEvent | undefined {
    if (this.stateHistory.length === 0) return undefined;
    return this.stateHistory[this.stateHistory.length - 1];
  }

  /**
   * Get all type change events
   */
  getTypeChangeHistory(): TypeChangeEvent[] {
    return this.stateHistory.filter(event => 
      event.type === StateChangeType.TYPE_CHANGE
    ) as TypeChangeEvent[];
  }

  /**
   * Get the last type change event
   */
  getLastTypeChange(): TypeChangeEvent | undefined {
    const typeChanges = this.getTypeChangeHistory();
    if (typeChanges.length === 0) return undefined;
    return typeChanges[typeChanges.length - 1];
  }

  /**
   * Transfer this role to a new holder
   */
  transfer(newHolder: Node): Role {
    const previousHolder = this.holder;
    this.holder = newHolder;
    
    // Record the holder change
    this.recordStateChange({
      type: StateChangeType.HOLDER_CHANGE,
      roleId: this.id,
      timestamp: Date.now(),
      previousHolder,
      newHolder
    } as any);
    
    // Reset all facets when holder changes
    this.relations.forEach((_, relationId) => {
      const currentFacet = this.facets.get(relationId);
      if (currentFacet) {
        // Record desire state reset if it was true
        if (currentFacet.desired) {
          this.recordStateChange({
            type: StateChangeType.DESIRE_CHANGE,
            roleId: this.id,
            timestamp: Date.now(),
            targetRoleId: relationId,
            previousState: true,
            newState: false
          } as any);
        }
        
        // Record playing state reset if it was true
        if (currentFacet.playing) {
          this.recordStateChange({
            type: StateChangeType.PLAYING_CHANGE,
            roleId: this.id,
            timestamp: Date.now(),
            targetRoleId: relationId,
            previousState: true,
            newState: false
          } as any);
        }
      }
      
      const newFacet = { desired: false, playing: false };
      this.facets.set(relationId, newFacet);
      
      // Update in Gun
      this._gunNode.get('facets').get(relationId).put(newFacet);
    });
    
    // Update the holder in Gun
    this._gunNode.get('holder').put(newHolder);
    
    return this;
  }

  /**
   * Set the association type for this role
   */
  setAssociationType(node: Node): Role {
    // If the type is actually changing
    if (this.associationType?.id !== node.id) {
      // Create the type change event
      const typeChangeEvent = {
        type: StateChangeType.TYPE_CHANGE,
        roleId: this.id,
        timestamp: Date.now(),
        previousType: this.associationType,
        newType: node
      } as TypeChangeEvent;
      
      // Record the type change
      this.recordStateChange(typeChangeEvent);

      // Notify all related roles that we've changed type
      this.relations.forEach((role, roleId) => {
        if (role instanceof GunRole) {
          // For GunRoles, use their native recordStateChange
          role.disconnectedDueToTypeChange.add(this.id);
          role.facets.delete(this.id);
          role.recordStateChange(typeChangeEvent);
          
          // Update in Gun - use an object instead of a boolean
          role.gunNode.get('disconnectedDueToTypeChange').get(this.id).put({ value: true });
          role.gunNode.get('facets').get(this.id).put(null);
        } else {
          // For non-GunRoles, use the standard approach
          role.disconnectedDueToTypeChange.add(this.id);
          role.facets.delete(this.id);
          role.recordStateChange(typeChangeEvent);
        }
      });
      
      this.associationType = node;
      
      // Update in Gun
      this._gunNode.get('associationType').put(node);
    }
    
    return this;
  }

  /**
   * Add a relation role, creating a bidirectional relationship
   */
  addRelation(role: Role): Role {
    // Don't add ourselves as a relation
    if (role.id === this.id) {
      return this;
    }
    
    // Only add if it doesn't already exist
    if (!this.relations.has(role.id)) {
      // Add the relation to our map
      this.relations.set(role.id, role);
      
      // Record the relation added event
      const event = {
        type: StateChangeType.RELATION_ADDED,
        roleId: this.id,
        timestamp: Date.now(),
        targetRoleId: role.id
      } as any;
      this.recordStateChange(event);
      
      // Save to Gun
      this._gunNode.get('relations').get(role.id).put({ id: role.id });
      
      // Only initialize facet if we're not disconnected due to type change
      if (!this.isDisconnectedDueToTypeChange(role.id)) {
        const facet = { desired: false, playing: false };
        this.facets.set(role.id, facet);
        
        // Save to Gun
        this._gunNode.get('facets').get(role.id).put(facet);
      }
      
      // Create bidirectional link
      if (!role.relations.has(this.id)) {
        role.addRelation(this);
      }
    }
    
    return this;
  }

  /**
   * Remove a relation relationship by relation ID
   */
  removeRelation(relationId: string): Role {
    // Get the relation before removing it
    const relation = this.relations.get(relationId);
    
    if (relation) {
      // Record the relation removed event
      const event = {
        type: StateChangeType.RELATION_REMOVED,
        roleId: this.id,
        timestamp: Date.now(),
        targetRoleId: relationId
      } as any;
      this.recordStateChange(event);
      
      // Remove from our relations and facets
      this.relations.delete(relationId);
      this.facets.delete(relationId);
      
      // Remove from Gun
      this._gunNode.get('relations').get(relationId).put(null);
      this._gunNode.get('facets').get(relationId).put(null);
      
      // Remove the reverse link if it exists
      if (relation.relations.has(this.id)) {
        relation.removeRelation(this.id);
      }
    }
    
    return this;
  }

  /**
   * Toggle desire for a specific relation
   */
  toggleDesire(actor: Node, relationId: string): Role {
    // Authorization check
    if (actor.id !== this.holder.id) {
      throw new Error("Only the holder can toggle desire for a relation");
    }
    
    // Check if this relation exists
    if (!this.relations.has(relationId)) {
      throw new Error(`Relation with ID ${relationId} not found`);
    }
    
    // Cannot toggle desire if disconnected due to type change
    if (this.isDisconnectedDueToTypeChange(relationId)) {
      throw new Error("Must acknowledge type change before modifying relationship");
    }
    
    // Get the current facet
    const facet = this.facets.get(relationId);
    if (!facet) {
      throw new Error(`Facet for relation ${relationId} not found`);
    }
    
    // If currently playing, we can't turn off desire
    if (facet.playing && facet.desired) {
      throw new Error("Cannot turn off desire while playing with this relation");
    }
    
    // Record the previous state
    const previousState = facet.desired;
    
    // Toggle the desire state
    facet.desired = !facet.desired;
    
    // Record the desire change
    const event = {
      type: StateChangeType.DESIRE_CHANGE,
      roleId: this.id,
      timestamp: Date.now(),
      actorId: actor.id,
      targetRoleId: relationId,
      previousState,
      newState: facet.desired
    } as any;
    this.recordStateChange(event);
    
    // Update in Gun - use an object with value property
    this._gunNode.get('facets').get(relationId).get('desired').put({ value: facet.desired });
    
    return this;
  }

  /**
   * Toggle playing with a specific relation
   */
  togglePlaying(actor: Node, relationId: string): Role {
    // Authorization check
    if (actor.id !== this.holder.id) {
      throw new Error("Only the holder can toggle playing for a relation");
    }
    
    // Check if this relation exists
    if (!this.relations.has(relationId)) {
      throw new Error(`Relation with ID ${relationId} not found`);
    }
    
    // Get the current facet
    const facet = this.facets.get(relationId);
    if (!facet) {
      throw new Error(`Facet for relation ${relationId} not found`);
    }
    
    // Cannot toggle playing if disconnected due to type change
    if (this.isDisconnectedDueToTypeChange(relationId)) {
      throw new Error("Must acknowledge type change before modifying relationship");
    }
    
    // Must desire this relation before playing
    if (!facet.desired) {
      throw new Error("Must desire this relation before playing");
    }
    
    // For play activation, we need mutual desire with this specific relation
    const relation = this.relations.get(relationId)!;
    if (!facet.playing && !this.isMutuallyDesiredWith(relation)) {
      throw new Error("Cannot play without mutual desire with this relation");
    }
    
    // Record the previous state
    const previousState = facet.playing;
    
    // Toggle the playing state
    facet.playing = !facet.playing;
    
    // Record the playing change
    const event = {
      type: StateChangeType.PLAYING_CHANGE,
      roleId: this.id,
      timestamp: Date.now(),
      actorId: actor.id,
      targetRoleId: relationId,
      previousState,
      newState: facet.playing
    } as any;
    this.recordStateChange(event);
    
    // Update in Gun - use an object with value property
    this._gunNode.get('facets').get(relationId).get('playing').put({ value: facet.playing });
    
    return this;
  }

  /**
   * Check if a role is disconnected due to type change
   */
  isDisconnectedDueToTypeChange(roleId: string): boolean {
    return this.disconnectedDueToTypeChange.has(roleId);
  }

  /**
   * Acknowledge a role's type change and potentially reconnect
   */
  acknowledgeTypeChange(roleId: string): Role {
    const relation = this.relations.get(roleId);
    if (!relation) {
      throw new Error(`Cannot acknowledge type change for unknown role ${roleId}`);
    }

    // Get the last type change for this role
    const lastChange = relation.getLastTypeChange();
    if (!lastChange) {
      throw new Error(`No type change history found for role ${roleId}`);
    }

    this.disconnectedDueToTypeChange.delete(roleId);
    
    // Update in Gun
    this._gunNode.get('disconnectedDueToTypeChange').get(roleId).put(null);
    
    if (this.relations.has(roleId)) {
      const facet = { desired: false, playing: false };
      this.facets.set(roleId, facet);
      
      // Update in Gun
      this._gunNode.get('facets').get(roleId).put(facet);
    }
    
    return this;
  }

  // The rest of the Role interface methods - reusing standard implementations

  isDesiring(roleId: string): boolean {
    if (this.isDisconnectedDueToTypeChange(roleId)) {
      return false;
    }
    const facet = this.facets.get(roleId);
    return facet ? facet.desired : false;
  }

  isPlaying(roleId: string): boolean {
    if (this.isDisconnectedDueToTypeChange(roleId)) {
      return false;
    }
    const facet = this.facets.get(roleId);
    return facet ? facet.playing : false;
  }

  hasAnyDesiredRelations(): boolean {
    for (const facet of this.facets.values()) {
      if (facet.desired) return true;
    }
    return false;
  }

  hasAnyPlayingRelations(): boolean {
    for (const facet of this.facets.values()) {
      if (facet.playing) return true;
    }
    return false;
  }

  getDesiredRelations(): Role[] {
    const desired: Role[] = [];
    this.facets.forEach((facet, relationId) => {
      if (facet.desired && this.relations.has(relationId)) {
        desired.push(this.relations.get(relationId)!);
      }
    });
    return desired;
  }

  getPlayingRelations(): Role[] {
    const playing: Role[] = [];
    this.facets.forEach((facet, relationId) => {
      if (facet.playing && this.relations.has(relationId)) {
        playing.push(this.relations.get(relationId)!);
      }
    });
    return playing;
  }

  isMutuallyConnectedWith(role: Role): boolean {
    return this.relations.has(role.id) && role.relations.has(this.id);
  }

  isMutuallyDesiredWith(role: Role): boolean {
    return this.isMutuallyConnectedWith(role) && 
           this.isDesiring(role.id) && 
           role.isDesiring(this.id);
  }

  isMutuallyPlayingWith(role: Role): boolean {
    return this.isMutuallyConnectedWith(role) && 
           this.isPlaying(role.id) && 
           role.isPlaying(this.id);
  }

  getMutualStateWith(role: Role): MutualState {
    if (!this.isMutuallyConnectedWith(role)) {
      return MutualState.NONE;
    }
    
    if (this.isMutuallyPlayingWith(role)) {
      return MutualState.PLAYING;
    }
    
    if (this.isMutuallyDesiredWith(role)) {
      return MutualState.DESIRED;
    }
    
    return MutualState.CONNECTED;
  }

  getRelations(): Relation[] {
    const relations: Relation[] = [];
    
    this.relations.forEach((role, relationId) => {
      const facet = this.facets.get(relationId) || { desired: false, playing: false };
      relations.push({
        role,
        facet,
        mutualState: this.getMutualStateWith(role)
      });
    });
    
    return relations;
  }

  getRelationsInState(state: MutualState): Role[] {
    return this.getRelations()
      .filter(rel => rel.mutualState === state)
      .map(rel => rel.role);
  }
}

/**
 * Factory class for GunRoles that syncs with Gun database
 */
export class GunRoleFactory {
  private static roles: Map<string, GunRole> = new Map();
  private static rolesNode: GunNode = new GunNode(['roles']);
  private static isInitialized: boolean = false;

  /**
   * Initialize the factory and start listening for roles
   */
  static initialize(): void {
    if (this.isInitialized) return;
    
    // Create a new subscription for each key instead of storing the map subscription itself
    const subscription = this.rolesNode.stream();
    const eachSubscription = subscription.each();
    
    // Set up a handler for when new roles are found
    const handler = (data: any) => {
      if (!data || !data._key) return;
      
      const roleId = data._key;
      
      // If we already have this role, skip
      if (this.roles.has(roleId)) return;
      
      // Get the full role data
      this.rolesNode.get(roleId).once().then(roleData => {
        if (!roleData || !roleData.id || !roleData.name || !roleData.holder) return;
        
        // Create the role instance
        const role = new GunRole(
          roleData.id,
          roleData.name,
          roleData.holder,
          roleData.associationType
        );
        
        // Add to our cache
        this.roles.set(roleData.id, role);
      });
    };
    
    // Subscribe to all roles with the handler
    eachSubscription.on(handler);
    
    this.isInitialized = true;
    console.log('GunRoleFactory initialized');
  }

  /**
   * Clean up all subscriptions
   */
  static cleanup(): void {
    // Clean up all role subscriptions
    this.roles.forEach(role => {
      if (role instanceof GunRole) {
        role.cleanup();
      }
    });
    
    this.roles.clear();
    this.isInitialized = false;
  }

  /**
   * Create a new role
   */
  static createRole(
    name: string,
    holder: Node,
    options: {
      id?: string,
      associationType?: Node,
      relations?: Role[]
    } = {}
  ): GunRole {
    const id = options.id || crypto.randomUUID();
    
    // Check if we already have this role
    if (this.roles.has(id)) {
      return this.roles.get(id)!;
    }
    
    const role = new GunRole(
      id,
      name,
      holder,
      options.associationType
    );
    
    // Add initial relations if provided
    if (options.relations) {
      options.relations.forEach(relation => {
        role.addRelation(relation);
      });
    }
    
    // Add to our cache
    this.roles.set(id, role);
    
    return role;
  }

  /**
   * Create reciprocal roles that are relations to each other
   */
  static createReciprocalRoles(
    role1Name: string,
    role1Holder: Node,
    role2Name: string,
    role2Holder: Node,
    associationType?: Node
  ): [GunRole, GunRole] {
    // Create first role
    const role1 = this.createRole(role1Name, role1Holder, {
      associationType
    });
    
    // Create second role
    const role2 = this.createRole(role2Name, role2Holder, {
      associationType
    });
    
    // Make them relations of each other
    role1.addRelation(role2);
    
    return [role1, role2];
  }

  /**
   * Get a role by ID
   */
  static getRole(id: string): GunRole | undefined {
    // If we have it in cache, return it
    if (this.roles.has(id)) {
      return this.roles.get(id);
    }
    
    // Try to load it from Gun
    return new Promise<GunRole | undefined>((resolve) => {
      this.rolesNode.get(id).once().then(roleData => {
        if (!roleData || !roleData.id || !roleData.name || !roleData.holder) {
          resolve(undefined);
          return;
        }
        
        // Create the role instance
        const role = new GunRole(
          roleData.id,
          roleData.name,
          roleData.holder,
          roleData.associationType
        );
        
        // Add to our cache
        this.roles.set(roleData.id, role);
        
        resolve(role);
      }).catch(() => {
        resolve(undefined);
      });
    }) as any; // This is a hack to make TypeScript happy with the sync/async mismatch
  }

  /**
   * Get all roles
   */
  static getAllRoles(): GunRole[] {
    return Array.from(this.roles.values());
  }

  /**
   * Get all roles for a given holder
   */
  static getRolesForHolder(holder: Node): GunRole[] {
    return this.getAllRoles().filter(role => role.holder.id === holder.id);
  }

  /**
   * Get all roles with a specific association type
   */
  static getRolesByAssociationType(typeNode: Node): GunRole[] {
    return this.getAllRoles().filter(
      role => role.associationType?.id === typeNode.id
    );
  }

  /**
   * Get a store of all roles, reactive to changes
   */
  static getAllRolesStore(): Readable<GunRole[]> {
    return {
      subscribe: (run: (value: GunRole[]) => void) => {
        // Set up a manual subscription directly with the Gun chain
        const unsubscribe = this.rolesNode.getChain().map().on((data: any) => {
          // When data changes, run the handler with current roles
          run(Array.from(this.roles.values()));
        });
        
        // Initial call with current data
        run(Array.from(this.roles.values()));
        
        // Return unsubscribe function
        return unsubscribe;
      }
    };
  }
}

/**
 * Initialize the Gun database to start tracking roles
 */
export function initializeRoleSystem(): void {
  GunRoleFactory.initialize();
}

/**
 * Clean up all subscriptions
 */
export function cleanupRoleSystem(): void {
  GunRoleFactory.cleanup();
}

/**
 * Create a Svelte-compatible store for a specific role by ID
 */
export function getRoleStore(roleId: string): Readable<GunRole | undefined> {
  return {
    subscribe: (run: (value: GunRole | undefined) => void) => {
      // Create a GunNode for this role
      const roleNode = new GunNode(['roles', roleId]);
      
      // Set up subscription directly with the Gun chain
      const unsubscribe = roleNode.getChain().on((data: any) => {
        // Get the role and emit it
        const role = GunRoleFactory.getRole(roleId);
        run(role);
      });
      
      // Initial call with current data
      const role = GunRoleFactory.getRole(roleId);
      run(role);
      
      // Return unsubscribe function
      return unsubscribe;
    }
  };
}
