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

// Basic Node interface representing an entity in the system
export interface Node {
  id: string;
  name: string;
}

/**
 * Role State enum representing the current state of a role
 */
export enum RoleState {
  INACTIVE = 'inactive',
  DESIRED = 'desired',
  PLAYING = 'playing'
}

/**
 * Mutual State enum for tracking relationship states between counterpart roles
 */
export enum MutualState {
  NONE = 'none',             // No mutual reference
  CONNECTED = 'connected',   // Mutual reference established
  DESIRED = 'desired',       // Both roles desire the relationship
  PLAYING = 'playing'        // Both roles are actively playing
}

/**
 * Facet of a specific relation between roles
 */
export interface RelationFacet {
  desired: boolean;
  playing: boolean;
}

/**
 * Complete relation containing a role, its facet, and the mutual state
 */
export interface Relation {
  role: Role;
  facet: RelationFacet;
  mutualState: MutualState;
}

/**
 * StateChangeType enum defining the types of state changes that can occur
 */
export enum StateChangeType {
  TYPE_CHANGE = 'type_change',
  DESIRE_CHANGE = 'desire_change',
  PLAYING_CHANGE = 'playing_change',
  RELATION_ADDED = 'relation_added',
  RELATION_REMOVED = 'relation_removed',
  HOLDER_CHANGE = 'holder_change'
}

/**
 * Base interface for all state change events
 */
export interface StateChangeEvent {
  type: StateChangeType;
  roleId: string;
  timestamp: number;
  actorId?: string; // The ID of the node that caused this change (if applicable)
}

/**
 * Type change event extending the base state change
 */
export interface TypeChangeEvent extends StateChangeEvent {
  type: StateChangeType.TYPE_CHANGE;
  previousType?: Node;
  newType?: Node;
}

/**
 * Relation state change event
 */
export interface RelationStateChangeEvent extends StateChangeEvent {
  type: StateChangeType.DESIRE_CHANGE | StateChangeType.PLAYING_CHANGE;
  targetRoleId: string; // The role whose state is being changed with
  previousState: boolean;
  newState: boolean;
}

/**
 * Relation added/removed event
 */
export interface RelationChangeEvent extends StateChangeEvent {
  type: StateChangeType.RELATION_ADDED | StateChangeType.RELATION_REMOVED;
  targetRoleId: string;
}

/**
 * Holder change event
 */
export interface HolderChangeEvent extends StateChangeEvent {
  type: StateChangeType.HOLDER_CHANGE;
  previousHolder: Node;
  newHolder: Node;
}

/**
 * Type guard for TypeChangeEvent
 */
export function isTypeChangeEvent(event: StateChangeEvent): event is TypeChangeEvent {
  return event.type === StateChangeType.TYPE_CHANGE;
}

/**
 * Type guard for RelationStateChangeEvent
 */
export function isRelationStateChangeEvent(event: StateChangeEvent): event is RelationStateChangeEvent {
  return event.type === StateChangeType.DESIRE_CHANGE || event.type === StateChangeType.PLAYING_CHANGE;
}

/**
 * Type guard for RelationChangeEvent
 */
export function isRelationChangeEvent(event: StateChangeEvent): event is RelationChangeEvent {
  return event.type === StateChangeType.RELATION_ADDED || event.type === StateChangeType.RELATION_REMOVED;
}

/**
 * Type guard for HolderChangeEvent
 */
export function isHolderChangeEvent(event: StateChangeEvent): event is HolderChangeEvent {
  return event.type === StateChangeType.HOLDER_CHANGE;
}

/**
 * Role interface representing a relationship between nodes
 */
export interface Role {
  id: string;
  name: string;
  holder: Node;
  
  // The node that this role categorizes itself as (its "type")
  associationType?: Node;
  
  // Map of related role IDs to their roles
  relations: Map<string, Role>;
  
  // Map of facets for each relation
  facets: Map<string, RelationFacet>;

  // Set of roles that have disconnected from us due to their type changes
  disconnectedDueToTypeChange: Set<string>;
  
  // History of all state changes
  stateHistory: StateChangeEvent[];
  
  // Methods for history tracking
  getStateHistory(): StateChangeEvent[];
  getStateHistoryByType(type: StateChangeType): StateChangeEvent[];
  getRelationStateHistory(roleId: string): StateChangeEvent[];
  getLastStateChange(): StateChangeEvent | undefined;
  
  // Old type change methods mapped to state history
  getTypeChangeHistory(): TypeChangeEvent[];
  getLastTypeChange(): TypeChangeEvent | undefined;
  
  // Internal method for recording state changes
  recordStateChange(change: StateChangeEvent): void;
  
  // Methods
  transfer(newHolder: Node): Role;
  addRelation(role: Role): Role;
  removeRelation(roleId: string): Role;
  setAssociationType(node: Node): Role;
  
  // New methods for handling type change disconnections
  isDisconnectedDueToTypeChange(roleId: string): boolean;
  acknowledgeTypeChange(roleId: string): Role;
  
  // Per-relation state management
  isDesiring(roleId: string): boolean;
  isPlaying(roleId: string): boolean;
  toggleDesire(actor: Node, roleId: string): Role;
  togglePlaying(actor: Node, roleId: string): Role;
  
  // Multi-relation methods
  isMutuallyConnectedWith(role: Role): boolean;
  isMutuallyDesiredWith(role: Role): boolean;
  isMutuallyPlayingWith(role: Role): boolean;
  getMutualStateWith(role: Role): MutualState;
  getRelations(): Relation[];
  getRelationsInState(state: MutualState): Role[];
  
  // Aggregated states (across all relations)
  hasAnyDesiredRelations(): boolean;
  hasAnyPlayingRelations(): boolean;
  getDesiredRelations(): Role[];
  getPlayingRelations(): Role[];
}

/**
 * Implementation of the Role interface
 */
export class RoleImpl implements Role {
  id: string;
  name: string;
  holder: Node;
  associationType?: Node;
  relations: Map<string, Role> = new Map();
  facets: Map<string, RelationFacet> = new Map();
  disconnectedDueToTypeChange: Set<string> = new Set();
  stateHistory: StateChangeEvent[] = [];

  constructor(
    id: string,
    name: string,
    holder: Node,
    associationType?: Node,
    initialRelations: Role[] = []
  ) {
    this.id = id;
    this.name = name;
    this.holder = holder;
    this.associationType = associationType;
    
    // Add initial relations if provided
    initialRelations.forEach(role => {
      this.addRelation(role);
    });
  }

  /**
   * Get full state history
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
    return this.stateHistory.filter(event => 
      (isRelationStateChangeEvent(event) || isRelationChangeEvent(event)) && 
      event.targetRoleId === roleId
    );
  }

  /**
   * Get the last state change regardless of type
   */
  getLastStateChange(): StateChangeEvent | undefined {
    return this.stateHistory[this.stateHistory.length - 1];
  }

  /**
   * Get all type change events
   */
  getTypeChangeHistory(): TypeChangeEvent[] {
    return this.stateHistory
      .filter(isTypeChangeEvent)
      .map(event => event as TypeChangeEvent);
  }

  /**
   * Get the last type change event
   */
  getLastTypeChange(): TypeChangeEvent | undefined {
    const typeChanges = this.getTypeChangeHistory();
    return typeChanges[typeChanges.length - 1];
  }

  /**
   * Record a state change in history
   */
  recordStateChange(change: StateChangeEvent): void {
    this.stateHistory.push(change);
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
    } as HolderChangeEvent);
    
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
          } as RelationStateChangeEvent);
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
          } as RelationStateChangeEvent);
        }
      }
      
      this.facets.set(relationId, { desired: false, playing: false });
    });
    
    return this;
  }

  /**
   * Set the association type for this role
   */
  setAssociationType(node: Node): Role {
    // If the type is actually changing
    if (this.associationType?.id !== node.id) {
      // Create the type change event
      const typeChangeEvent: TypeChangeEvent = {
        type: StateChangeType.TYPE_CHANGE,
        roleId: this.id,
        timestamp: Date.now(),
        previousType: this.associationType,
        newType: node
      };
      
      // Record the type change
      this.recordStateChange(typeChangeEvent);

      // Notify all related roles that we've changed type
      this.relations.forEach((role, roleId) => {
        role.disconnectedDueToTypeChange.add(this.id);
        role.facets.delete(this.id);
        
        // Also notify them of our type change
        role.recordStateChange(typeChangeEvent);
      });
      
      this.associationType = node;
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
      this.recordStateChange({
        type: StateChangeType.RELATION_ADDED,
        roleId: this.id,
        timestamp: Date.now(),
        targetRoleId: role.id
      } as RelationChangeEvent);
      
      // Only initialize facet if we're not disconnected due to type change
      if (!this.isDisconnectedDueToTypeChange(role.id)) {
        this.facets.set(role.id, { desired: false, playing: false });
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
      this.recordStateChange({
        type: StateChangeType.RELATION_REMOVED,
        roleId: this.id,
        timestamp: Date.now(),
        targetRoleId: relationId
      } as RelationChangeEvent);
      
      // Remove from our relations and facets
      this.relations.delete(relationId);
      this.facets.delete(relationId);
      
      // Remove the reverse link if it exists
      if (relation.relations.has(this.id)) {
        relation.removeRelation(this.id);
      }
    }
    
    return this;
  }

  /**
   * Toggle desire for a specific relation (can only be done by the holder)
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
    this.recordStateChange({
      type: StateChangeType.DESIRE_CHANGE,
      roleId: this.id,
      timestamp: Date.now(),
      actorId: actor.id,
      targetRoleId: relationId,
      previousState,
      newState: facet.desired
    } as RelationStateChangeEvent);
    
    // Update the facet
    this.facets.set(relationId, facet);
    
    return this;
  }

  /**
   * Toggle playing with a specific relation (can only be done by the holder)
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
    this.recordStateChange({
      type: StateChangeType.PLAYING_CHANGE,
      roleId: this.id,
      timestamp: Date.now(),
      actorId: actor.id,
      targetRoleId: relationId,
      previousState,
      newState: facet.playing
    } as RelationStateChangeEvent);
    
    // Update the facet
    this.facets.set(relationId, facet);
    
    return this;
  }

  /**
   * Check if a role is disconnected due to its type change
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
    
    if (this.relations.has(roleId)) {
      this.facets.set(roleId, { desired: false, playing: false });
    }
    
    return this;
  }

  /**
   * Check if this role is desiring a specific relation
   */
  isDesiring(roleId: string): boolean {
    // Cannot desire if disconnected due to type change
    if (this.isDisconnectedDueToTypeChange(roleId)) {
      return false;
    }
    const facet = this.facets.get(roleId);
    return facet ? facet.desired : false;
  }

  /**
   * Check if this role is playing with a specific relation
   */
  isPlaying(roleId: string): boolean {
    // Cannot play if disconnected due to type change
    if (this.isDisconnectedDueToTypeChange(roleId)) {
      return false;
    }
    const facet = this.facets.get(roleId);
    return facet ? facet.playing : false;
  }

  /**
   * Check if this role has any desired relations with any relations
   */
  hasAnyDesiredRelations(): boolean {
    for (const facet of this.facets.values()) {
      if (facet.desired) return true;
    }
    return false;
  }

  /**
   * Check if this role has any playing relations with any relations
   */
  hasAnyPlayingRelations(): boolean {
    for (const facet of this.facets.values()) {
      if (facet.playing) return true;
    }
    return false;
  }

  /**
   * Get all relations that this role desires
   */
  getDesiredRelations(): Role[] {
    const desired: Role[] = [];
    this.facets.forEach((facet, relationId) => {
      if (facet.desired && this.relations.has(relationId)) {
        desired.push(this.relations.get(relationId)!);
      }
    });
    return desired;
  }

  /**
   * Get all relations that this role is playing with
   */
  getPlayingRelations(): Role[] {
    const playing: Role[] = [];
    this.facets.forEach((facet, relationId) => {
      if (facet.playing && this.relations.has(relationId)) {
        playing.push(this.relations.get(relationId)!);
      }
    });
    return playing;
  }

  /**
   * Check if this role has a mutual connection with another role
   */
  isMutuallyConnectedWith(role: Role): boolean {
    return this.relations.has(role.id) && role.relations.has(this.id);
  }

  /**
   * Check if this role is in a mutual desired relationship with another role
   */
  isMutuallyDesiredWith(role: Role): boolean {
    return this.isMutuallyConnectedWith(role) && 
           this.isDesiring(role.id) && 
           role.isDesiring(this.id);
  }

  /**
   * Check if this role is in a mutual playing relationship with another role
   */
  isMutuallyPlayingWith(role: Role): boolean {
    return this.isMutuallyConnectedWith(role) && 
           this.isPlaying(role.id) && 
           role.isPlaying(this.id);
  }

  /**
   * Get the mutual state with another role
   */
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

  /**
   * Get all relations with their mutual states
   */
  getRelations(): Relation[] {
    const relations: Relation[] = [];
    
    this.relations.forEach((role, relationId) => {
      const facet = this.facets.get(relationId) || { desired: false, playing: false };
      relations.push({
        role,
        facet: facet,
        mutualState: this.getMutualStateWith(role)
      });
    });
    
    return relations;
  }

  /**
   * Get all relations that are in a specific mutual state with this role
   */
  getRelationsInState(state: MutualState): Role[] {
    return this.getRelations()
      .filter(rel => rel.mutualState === state)
      .map(rel => rel.role);
  }
}

/**
 * Role factory for creating and managing roles
 */
export class RoleFactory {
  private static roles: Map<string, Role> = new Map();

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
  ): Role {
    const id = options.id || crypto.randomUUID();
    
    const role = new RoleImpl(
      id,
      name,
      holder,
      options.associationType,
      options.relations || []
    );
    
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
  ): [Role, Role] {
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
  static getRole(id: string): Role | undefined {
    return this.roles.get(id);
  }

  /**
   * Get all roles
   */
  static getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * Get all roles for a given holder
   */
  static getRolesForHolder(holder: Node): Role[] {
    return this.getAllRoles().filter(role => role.holder.id === holder.id);
  }

  /**
   * Get all roles with a specific association type
   */
  static getRolesByAssociationType(typeNode: Node): Role[] {
    return this.getAllRoles().filter(
      role => role.associationType?.id === typeNode.id
    );
  }

  /**
   * Get unique role pairs that are in a specific mutual state
   */
  static getUniqueMutualRolePairs(state: MutualState): [Role, Role][] {
    const pairs: [Role, Role][] = [];
    const processedPairs = new Set<string>();
    
    this.getAllRoles().forEach(role1 => {
      role1.getRelations().forEach(rel => {
        if (rel.mutualState === state) {
          const role2 = rel.role;
          // Create a unique identifier for this pair
          const pairKey = [role1.id, role2.id].sort().join(':');
          
          // Only process each pair once
          if (!processedPairs.has(pairKey)) {
            pairs.push([role1, role2]);
            processedPairs.add(pairKey);
          }
        }
      });
    });
    
    return pairs;
  }

  /**
   * Get all unique role pairs that form playing mutual relationships
   */
  static getMutuallyPlayingRolePairs(): [Role, Role][] {
    return this.getUniqueMutualRolePairs(MutualState.PLAYING);
  }

  /**
   * Get all unique role pairs that form desired mutual relationships
   */
  static getMutuallyDesiredRolePairs(): [Role, Role][] {
    return this.getUniqueMutualRolePairs(MutualState.DESIRED);
  }

  /**
   * Get all unique role pairs that form connected mutual relationships
   */
  static getMutuallyConnectedRolePairs(): [Role, Role][] {
    return this.getUniqueMutualRolePairs(MutualState.CONNECTED);
  }
}

/**
 * Enhanced role utils with state history capabilities
 */
export class RoleUtils {
  /**
   * Find all nodes that have a mutual role relationship with the given node
   * filtered by the specified mutual state
   */
  static getRelationshipsByMutualState(node: Node, state: MutualState): Map<Node, Role[]> {
    const relationships = new Map<Node, Role[]>();
    
    // Get all roles held by this node
    const roles = RoleFactory.getRolesForHolder(node);
    
    // Process each role's relations
    roles.forEach(role => {
      role.getRelationsInState(state).forEach(relation => {
        const relationHolder = relation.holder;
        
        if (!relationships.has(relationHolder)) {
          relationships.set(relationHolder, []);
        }
        
        if (!relationships.get(relationHolder)!.includes(role)) {
          relationships.get(relationHolder)!.push(role);
        }
      });
      });
    
    return relationships;
  }

  /**
   * Find all nodes that have a playing mutual relationship with the given node
   */
  static getMutuallyPlayingRelationships(node: Node): Map<Node, Role[]> {
    return this.getRelationshipsByMutualState(node, MutualState.PLAYING);
  }

  /**
   * Find all nodes that have a desired mutual relationship with the given node
   */
  static getMutuallyDesiredRelationships(node: Node): Map<Node, Role[]> {
    return this.getRelationshipsByMutualState(node, MutualState.DESIRED);
  }

  /**
   * Find all nodes that have a connected relationship with the given node
   */
  static getMutuallyConnectedRelationships(node: Node): Map<Node, Role[]> {
    return this.getRelationshipsByMutualState(node, MutualState.CONNECTED);
  }

  /**
   * Get nodes that categorize themselves as a specific type
   */
  static getNodesOfType(typeNode: Node): Node[] {
    const roles = RoleFactory.getRolesByAssociationType(typeNode);
    
    // Extract unique holders
    const nodes = new Set<Node>();
    roles.forEach(role => {
      nodes.add(role.holder);
    });
    
    return Array.from(nodes);
  }

  /**
   * Get all role types a node identifies as
   */
  static getNodeTypes(node: Node): Node[] {
    const roles = RoleFactory.getRolesForHolder(node);
    
    // Get all association types for these roles
    const types = new Set<Node>();
    roles.forEach(role => {
      if (role.associationType) {
        types.add(role.associationType);
      }
    });
    
    return Array.from(types);
  }

  /**
   * Get all nodes that a given node has relations with, grouped by mutual state
   */
  static getNodeRelationshipsByState(node: Node): Map<MutualState, Node[]> {
    const result = new Map<MutualState, Node[]>();
    
    // Initialize with empty arrays for each state
    Object.values(MutualState).forEach(state => {
      result.set(state as MutualState, []);
    });
    
    // Get all roles held by this node
    const roles = RoleFactory.getRolesForHolder(node);
    
    // Process each role's relations
    roles.forEach(role => {
      role.getRelations().forEach(relation => {
        const state = relation.mutualState;
        const relationHolder = relation.role.holder;
        
        // Skip if it's the same node
        if (relationHolder.id === node.id) {
          return;
        }
        
        // Add to the appropriate state array if not already there
        const nodesInState = result.get(state)!;
        if (!nodesInState.some(n => n.id === relationHolder.id)) {
          nodesInState.push(relationHolder);
        }
      });
    });
    
    return result;
  }

  /**
   * Get all roles that have changed their type and are pending acknowledgment
   */
  static getPendingTypeChanges(role: Role): Role[] {
    return Array.from(role.relations.values())
      .filter(r => role.isDisconnectedDueToTypeChange(r.id));
  }

  /**
   * Get all roles that have changed to a specific type and are pending acknowledgment
   */
  static getPendingTypeChangesByType(role: Role, type: Node): Role[] {
    return this.getPendingTypeChanges(role)
      .filter(r => r.associationType?.id === type.id);
  }

  /**
   * Get all roles that have changed from one type to another within a time window
   */
  static getTypeTransitions(
    fromType: Node,
    toType: Node,
    timeWindowMs: number = 24 * 60 * 60 * 1000 // default 24 hours
  ): Role[] {
    const now = Date.now();
    return RoleFactory.getAllRoles().filter(role => {
      const changes = role.getTypeChangeHistory();
      return changes.some(change => 
        change.previousType?.id === fromType.id &&
        change.newType?.id === toType.id &&
        (now - change.timestamp) <= timeWindowMs
      );
    });
  }

  /**
   * Get type change patterns for a role over time
   */
  static analyzeTypeChangePatterns(role: Role): Map<string, number> {
    const patterns = new Map<string, number>();
    
    const changes = role.getTypeChangeHistory();
    for (let i = 1; i < changes.length; i++) {
      const from = changes[i-1].newType?.name || 'none';
      const to = changes[i].newType?.name || 'none';
      const pattern = `${from}->${to}`;
      
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    }
    
    return patterns;
  }

  /**
   * Get all roles that frequently change between specific types
   */
  static getVolatileRoles(
    minChanges: number = 3,
    timeWindowMs: number = 7 * 24 * 60 * 60 * 1000 // default 1 week
  ): Role[] {
    const now = Date.now();
    return RoleFactory.getAllRoles().filter(role => {
      const recentChanges = role.getTypeChangeHistory()
        .filter(change => (now - change.timestamp) <= timeWindowMs);
      return recentChanges.length >= minChanges;
    });
  }

  /**
   * Get roles that might be interested in acknowledging a type change
   * based on their historical relationships with similar type transitions
   */
  static getSuggestedAcknowledgments(role: Role): Map<string, number> {
    const suggestions = new Map<string, number>();
    
    this.getPendingTypeChanges(role).forEach(changedRole => {
      const lastChange = changedRole.getLastTypeChange();
      if (!lastChange?.newType) return;
      
      // Look for similar type transitions that were previously acknowledged
      role.getTypeChangeHistory().forEach(historicChange => {
        if (historicChange.newType?.id === lastChange.newType?.id &&
            !role.isDisconnectedDueToTypeChange(historicChange.roleId)) {
          suggestions.set(changedRole.id, (suggestions.get(changedRole.id) || 0) + 1);
        }
      });
    });
    
    return suggestions;
  }

  /**
   * Get a timeline of all state changes for a role
   */
  static getStateTimeline(role: Role): StateChangeEvent[] {
    return role.getStateHistory().sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get a consolidated timeline of state changes across multiple roles
   */
  static getMultiRoleStateTimeline(roles: Role[]): StateChangeEvent[] {
    const allEvents: StateChangeEvent[] = [];
    roles.forEach(role => {
      allEvents.push(...role.getStateHistory());
    });
    return allEvents.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get all state changes involving a specific node (as actor or holder)
   */
  static getNodeInvolvedStateChanges(node: Node): StateChangeEvent[] {
    const allEvents: StateChangeEvent[] = [];
    const rolesHeld = RoleFactory.getRolesForHolder(node);
    
    // Events from roles held by this node
    rolesHeld.forEach(role => {
      allEvents.push(...role.getStateHistory());
    });
    
    // Events where this node was the actor
    RoleFactory.getAllRoles().forEach(role => {
      role.getStateHistory().forEach(event => {
        if (event.actorId === node.id) {
          allEvents.push(event);
        }
      });
    });
    
    return allEvents.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get all state changes between two roles
   */
  static getRelationshipStateChanges(role1: Role, role2: Role): StateChangeEvent[] {
    const allEvents: StateChangeEvent[] = [];
    
    // Events from role1 involving role2
    allEvents.push(...role1.getRelationStateHistory(role2.id));
    
    // Events from role2 involving role1
    allEvents.push(...role2.getRelationStateHistory(role1.id));
    
    return allEvents.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get statistical summary of state changes for a role
   */
  static getStateChangeStatistics(role: Role): {
    totalChanges: number;
    typeChanges: number;
    desireChanges: number;
    playingChanges: number;
    relationsAdded: number;
    relationsRemoved: number;
    holderChanges: number;
  } {
    const stats = {
      totalChanges: role.getStateHistory().length,
      typeChanges: role.getStateHistoryByType(StateChangeType.TYPE_CHANGE).length,
      desireChanges: role.getStateHistoryByType(StateChangeType.DESIRE_CHANGE).length,
      playingChanges: role.getStateHistoryByType(StateChangeType.PLAYING_CHANGE).length,
      relationsAdded: role.getStateHistoryByType(StateChangeType.RELATION_ADDED).length,
      relationsRemoved: role.getStateHistoryByType(StateChangeType.RELATION_REMOVED).length,
      holderChanges: role.getStateHistoryByType(StateChangeType.HOLDER_CHANGE).length
    };
    
    return stats;
  }
}
