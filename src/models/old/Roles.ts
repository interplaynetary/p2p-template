import { gun } from './Gun'
import { GunNode } from './GunNode'
import { GunSubscription } from './GunSubscription'

/**
 * Simplified Roles Model
 * 
 * In this model, a Role is an independent entity that can:
 * 1. Point to another Role as its counterpart (one-way or bidirectional)
 * 2. Point to a Node as its type/association
 * 3. Be held by a Node
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
 * Role interface representing a relationship between nodes
 */
export interface Role {
  id: string;
  name: string;
  holder: Node;
  state: RoleState;
  
  // The node that this role categorizes itself as (its "type")
  associationType?: Node;
  
  // Optional counterpart role (can be one-way relationship)
  counterpart?: Role;
  
  // Getters for state
  readonly desired: boolean;
  readonly playing: boolean;
  readonly mutuallyConnected: boolean;
  readonly mutuallyDesired: boolean;
  readonly mutuallyPlaying: boolean;
  readonly mutualState: MutualState;
  
  // Methods
  setState(state: RoleState): Role;
  transfer(newHolder: Node): Role;
  setCounterpart(role: Role): Role;
  removeCounterpart(): Role;
  setAssociationType(node: Node): Role;
  
  // Toggle state methods
  toggleDesire(actor: Node): Role;
  togglePlaying(actor: Node): Role;
}

/**
 * Implementation of the Role interface
 */
export class RoleImpl implements Role {
  id: string;
  name: string;
  holder: Node;
  state: RoleState = RoleState.INACTIVE;
  associationType?: Node;
  counterpart?: Role;

  constructor(
    id: string,
    name: string,
    holder: Node,
    associationType?: Node,
    counterpart?: Role
  ) {
    this.id = id;
    this.name = name;
    this.holder = holder;
    this.associationType = associationType;
    this.counterpart = counterpart;
    
    // If counterpart is provided, link this role back to the counterpart
    if (counterpart && !counterpart.counterpart) {
      counterpart.counterpart = this;
    }
  }

  /**
   * Set the role's state
   */
  setState(state: RoleState): Role {
    this.state = state;
    return this;
  }

  /**
   * Transfer this role to a new holder
   */
  transfer(newHolder: Node): Role {
    this.holder = newHolder;
    
    // Reset state when holder changes
    this.state = RoleState.INACTIVE;
    
    return this;
  }

  /**
   * Set the counterpart role, creating a bidirectional relationship
   */
  setCounterpart(role: Role): Role {
    this.counterpart = role;
    
    // Create bidirectional link
    if (role && role.counterpart !== this) {
      role.counterpart = this;
    }
    
    return this;
  }

  /**
   * Remove the counterpart relationship
   */
  removeCounterpart(): Role {
    if (this.counterpart) {
      // Save reference before nullifying
      const otherRole = this.counterpart;
      
      // Remove our link first
      this.counterpart = undefined;
      
      // Remove the reverse link
      if (otherRole.counterpart === this) {
        otherRole.counterpart = undefined;
      }
    }
    
    return this;
  }

  /**
   * Set the association type for this role
   */
  setAssociationType(node: Node): Role {
    this.associationType = node;
    return this;
  }

  /**
   * Check if this role is desired
   */
  get desired(): boolean {
    return this.state === RoleState.DESIRED || this.state === RoleState.PLAYING;
  }

  /**
   * Check if this role is playing
   */
  get playing(): boolean {
    return this.state === RoleState.PLAYING;
  }

  /**
   * Check if this role has a mutual connection (bidirectional relationship)
   */
  get mutuallyConnected(): boolean {
    return !!this.counterpart && this.counterpart.counterpart === this;
  }

  /**
   * Check if this role is in a mutual desired relationship with its counterpart
   */
  get mutuallyDesired(): boolean {
    return this.mutuallyConnected && 
           this.desired && 
           this.counterpart!.desired;
  }

  /**
   * Check if this role is in a mutual active relationship with its counterpart
   */
  get mutuallyPlaying(): boolean {
    return this.mutuallyConnected && 
           this.playing && 
           this.counterpart!.playing;
  }

  /**
   * Get the mutual state of this role relationship
   */
  get mutualState(): MutualState {
    if (!this.mutuallyConnected) {
      return MutualState.NONE;
    }
    
    if (this.mutuallyPlaying) {
      return MutualState.PLAYING;
    }
    
    if (this.mutuallyDesired) {
      return MutualState.DESIRED;
    }
    
    return MutualState.CONNECTED;
  }

  /**
   * Toggle desire for this role (can only be done by the holder)
   */
  toggleDesire(actor: Node): Role {
    if (actor.id !== this.holder.id) {
      throw new Error("Only the holder can toggle desire for a role");
    }
    
    // Toggle between desired and inactive
    if (this.desired) {
      this.state = RoleState.INACTIVE;
    } else {
      this.state = RoleState.DESIRED;
    }
    
    return this;
  }

  /**
   * Toggle playing state for this role (can only be done by the holder)
   */
  togglePlaying(actor: Node): Role {
    if (actor.id !== this.holder.id) {
      throw new Error("Only the holder can toggle playing for a role");
    }
    
    // Must be desired before it can be played
    if (!this.desired) {
      throw new Error("Role must be desired before it can be played");
    }
    
    // For activation, we need mutual desire
    if (!this.mutuallyDesired && !this.playing) {
      throw new Error("Cannot activate role without mutual desire");
    }
    
    // Toggle between playing and desired
    if (this.playing) {
      this.state = RoleState.DESIRED;
    } else {
      this.state = RoleState.PLAYING;
    }
    
    return this;
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
      counterpart?: Role
    } = {}
  ): Role {
    const id = options.id || crypto.randomUUID();
    
    const role = new RoleImpl(
      id,
      name,
      holder,
      options.associationType,
      options.counterpart
    );
    
    this.roles.set(id, role);
    return role;
  }

  /**
   * Create a pair of counterpart roles
   */
  static createRolePair(
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
    
    // Create second role with reference to first
    const role2 = this.createRole(role2Name, role2Holder, {
      associationType,
      counterpart: role1
    });
    
    // The constructor of RoleImpl should have set up the bidirectional relationship
    
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
   * Get all roles with the specified mutual state
   */
  static getRolesByMutualState(state: MutualState): Role[] {
    return this.getAllRoles().filter(role => 
      role.mutualState === state && 
      // Only include one role from each pair to avoid duplicates
      (!role.counterpart || role.id < role.counterpart.id)
    );
  }

  /**
   * Get all roles that form playing mutual relationships
   */
  static getMutualPlayingRoles(): Role[] {
    return this.getRolesByMutualState(MutualState.PLAYING);
  }

  /**
   * Get all roles that form desired mutual relationships
   */
  static getMutualDesiredRoles(): Role[] {
    return this.getRolesByMutualState(MutualState.DESIRED);
  }
}

/**
 * Helper functions for working with role relationships
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
    
    // Filter for roles with the specified mutual state
    roles
      .filter(role => role.mutualState === state)
      .forEach(role => {
        const counterpartHolder = role.counterpart!.holder;
        
        if (!relationships.has(counterpartHolder)) {
          relationships.set(counterpartHolder, []);
        }
        
        relationships.get(counterpartHolder)!.push(role);
      });
    
    return relationships;
  }

  /**
   * Find all nodes that have a playing mutual relationship with the given node
   */
  static getMutualPlayingRelationships(node: Node): Map<Node, Role[]> {
    return this.getRelationshipsByMutualState(node, MutualState.PLAYING);
  }

  /**
   * Find all nodes that have a desired mutual relationship with the given node
   */
  static getMutualDesiredRelationships(node: Node): Map<Node, Role[]> {
    return this.getRelationshipsByMutualState(node, MutualState.DESIRED);
  }

  /**
   * Find all nodes that have a connected relationship with the given node
   */
  static getMutualConnectedRelationships(node: Node): Map<Node, Role[]> {
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
}
