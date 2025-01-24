class SocialNode extends Node {
    constructor(name, parent = null, types = [], isContributor = true) {
        super(name, parent, types, isContributor);
        this.associations = [];
    }
    getHolding() {
        // Collect all roles where we are the holder
        const holdings = new Set();
        this.associations.forEach(association => {
            association.associations.forEach(association => {
                if (association.userRole.getHolder() === this) {
                    holdings.add(association.userRole);
                }
                if (association.providerRole.getHolder() === this) {
                    holdings.add(association.providerRole);
                }
            });
        });
        return holdings;
    }
    getDesiring() {
        // Filter holdings to only those we desire
        return new Set(
            Array.from(this.getHolding()).filter(role => 
                role.getStatus().desires
            )
        );
    }
    getPlaying() {
        // Filter holdings to only those we're playing
        return new Set(
            Array.from(this.getHolding()).filter(role => 
                role.getStatus().playing
            )
        );
    }
    toggleDesiring(role) {
        // Verify we are the holder of this role
        if (role.getHolder() !== this) {
            throw new Error("Can only toggle desire for roles we hold");
        }
    
        // Call the role's desires method to toggle the state
        return role.toggleDesiring(this);
    }
    togglePlaying(role) {
        // Verify we are the holder of this role
        if (role.getHolder() !== this) {
            throw new Error("Can only toggle playing for roles we hold");
        }
    
        // Call the role's play method to toggle the state
        return role.togglePlaying(this);
    }
    distributeSurplus() {
        // Get undesired holdings (surplus)
        const holdings = this.getHolding();
        const desires = this.getDesiring();
        const surplus = new Set(
            Array.from(holdings).filter(role => !desires.has(role))
        );
    
        // Group surplus by social association type AND role type
        const surplusByTypeAndRole = new Map();
        surplus.forEach(role => {
            const association = role.getStatus().association;
            const roleType = role.getStatus().type;
            const key = `${association.name}-${roleType}`;
            
            if (!surplusByTypeAndRole.has(key)) {
                surplusByTypeAndRole.set(key, {
                    association,
                    roleType,
                    roles: []
                });
            }
            surplusByTypeAndRole.get(key).roles.push(role);
        });
    
        // Calculate distribution of contributors
        const distribution = this.distribution();
    
        // For each association-role combination, distribute its shares according to contribution weights
        surplusByTypeAndRole.forEach(({association, roleType, roles}) => {
            const totalShares = roles.reduce((sum, role) => 
                sum + role.getStatus().shares, 0);
    
            // Distribute shares to contributors based on their weights
            distribution.forEach((share, contributor) => {
                if (share > 0) {
                    const sharesToTransfer = Math.floor(totalShares * share);
                    if (sharesToTransfer > 0) {
                        // Create new share association with appropriate role type
                        if (roleType === 'user-role') {
                            association.socialRelation(contributor, contributor);
                        } else { // provider-role-to-provide
                            association.socialRelation(contributor, contributor);
                        }
                    }
                }
            });
        });
    }
}


class Association extends Node {
constructor(name, totalShares, initialHolder, composes = []) {
    this.name = name;
    this.associations = [];
    this.compositions = composes;

    // Create initial share associations
    for (let i = 0; i < totalShares; i++) {
        this.socialRelation(initialHolder, initialHolder);
    }
}

socialRelation(userRoleHolder, providerRoleHolder) {
    // State variables for the association
    let currentUserRoleHolder = userRoleHolder;
    let currentProviderRoleHolder = providerRoleHolder;
    let playable = true;
    let userDesires = false;
    let providerDesires = false;
    let userPlaying = false;
    let providerPlaying = false;
    let associationPlaying = false;

    // Create mutually referencing roles
    const userRole = {
        getStatus: () => ({
            type: 'user-role',
            association: this,
            totalShares: this.associations.length,
            holder: currentUserRoleHolder,
            desires: userDesires,
            playing: userPlaying,
            associationPlaying: associationPlaying,
            correspondingProviderRole: providerRole
        }),

        transfer: (expressor, newHolder) => {
            if (expressor !== currentUserRoleHolder) {
                throw new Error("Unauthorized: only current holder can transfer");
            }
            
            currentUserRoleHolder = newHolder;
            userDesires = false;
            userPlaying = false;
            associationPlaying = false;
            return 'transferred';
        },

        toggleDesiring: (expressor) => {
            if (expressor !== currentUserRoleHolder) {
                throw new Error("Unauthorized: only current holder can toggle desire");
            }
            userDesires = !userDesires;  // Toggle the state
            if (!userDesires) {          // If turning off desire, stop playing
                userPlaying = false;
                associationPlaying = false;
            }
            return userDesires ? 'desires' : 'undesires';
        },

        togglePlaying: (expressor) => {
            if (!playable || expressor !== currentUserRoleHolder) {
                throw new Error("Unauthorized or not playable");
            }
            if (!userDesires) {
                return 'cannot-play-without-desire';
            }
            if (!providerPlaying && !userPlaying) {
                return 'cannot-play-without-provider';
            }
            
            userPlaying = !userPlaying;  // Toggle the state
            associationPlaying = userPlaying && providerPlaying;
            return userPlaying ? 'playing' : 'stopped-playing';
        },

        getHolder: () => currentUserRoleHolder
    };

    const providerRole = {
        getStatus: () => ({
            type: 'provider-role',
            association: this,
            totalShares: this.associations.length,
            holder: currentProviderRoleHolder,
            desires: providerDesires,
            playing: providerPlaying,
            associationPlaying: associationPlaying,
            correspondingUserRole: userRole
        }),

        transfer: (expressor, newHolder) => {
            if (expressor !== currentProviderRoleHolder) {
                throw new Error("Unauthorized: only current holder can transfer");
            }
            if (fulfilled) return 'cannot-transfer-fulfilled-provider-role';
            
            currentProviderRoleHolder = newHolder;
            providerDesires = false;
            providerPlaying = false;
            associationPlaying = false;
            return 'transferred';
        },

        toggleDesiring: (expressor) => {
            if (expressor !== currentProviderRoleHolder) {
                throw new Error("Unauthorized: only current holder can toggle desire");
            }
            providerDesires = !providerDesires;  // Toggle the state
            if (!providerDesires) {              // If turning off desire, stop playing
                providerPlaying = false;
                associationPlaying = false;
            }
            return providerDesires ? 'desires' : 'undesires';
        },

        togglePlaying: (expressor) => {
            if (!playable || expressor !== currentProviderRoleHolder) {
                throw new Error("Unauthorized or not playable");
            }
            if (!providerDesires) {
                return 'cannot-play-without-desire';
            }
            
            providerPlaying = !providerPlaying;  // Toggle the state
            associationPlaying = userPlaying && providerPlaying;
            return providerPlaying ? 'playing' : 'stopped-playing';
        },

        getHolder: () => currentProviderRoleHolder
    };

    // Store the association
    const association = { userRole, providerRole };
    this.associations.push(association);
    return association;
}

getStatus() {
    return {
        name: this.name,
        totalShares: this.associations.length,
        composes: this.compositions,
        associations: this.associations.map(association => ({
            userRole: association.userRole.getStatus(),
            providerRole: association.providerRole.getStatus()
        }))
    };
}
}