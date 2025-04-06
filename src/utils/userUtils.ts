import { gun } from '../models/Gun';
import { GunSubscription } from '../models/GunSubscription';
import { user } from '../models/Gun';

// Global users Map for lightweight caching to avoid repeated lookups
// This is just a performance optimization, not our source of truth
export const usersMap = new Map<string, string>();

// Map to track active subscriptions by userId
const userSubscriptions = new Map<string, () => void>();

// Map to track callbacks for user name resolutions
const userNameCallbacks = new Map<string, Set<(userId: string, name: string) => void>>();

/**
 * Register a callback that will be called when a user name is resolved
 * @param userId The user ID to watch
 * @param callback Function to call when name is resolved
 * @returns Cleanup function to remove callback
 */
export function onUserNameResolved(
    userId: string, 
    callback: (userId: string, name: string) => void
): () => void {
    if (!userNameCallbacks.has(userId)) {
        userNameCallbacks.set(userId, new Set());
    }
    
    const callbacks = userNameCallbacks.get(userId)!;
    callbacks.add(callback);
    
    // If we already have the name, call the callback immediately
    if (usersMap.has(userId)) {
        const name = usersMap.get(userId)!;
        callback(userId, name);
    }
    
    // Return cleanup function
    return () => {
        const callbacks = userNameCallbacks.get(userId);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                userNameCallbacks.delete(userId);
            }
        }
    };
}

// Function to get user name from Gun (reactive)
export function getUserName(userId: string): string {
    // Return from cache if available for immediate UI response
    if (usersMap.has(userId)) {
        return usersMap.get(userId)!;
    }
    
    // Only set up subscription if not already subscribed
    if (!userSubscriptions.has(userId)) {
        console.log(`Setting up subscription for user ${userId}`); 
        
        // Set up subscription to user data
        const cleanupFn = gun.get('users').get(userId).on((userData: any) => {
            if (userData && userData.name) {
                console.log(`Received name for ${userId}: ${userData.name}`);
                // Store in cache for performance
                updateUserName(userId, userData.name);
            } else if (userData && userData.node && userData.node['#']) {
                console.log(`Following node reference for ${userId}`);
                // Follow reference if user data is stored in a node
                gun.get(userData.node['#']).on((nodeData: any) => {
                    if (nodeData && nodeData.name) {
                        console.log(`Resolved name from node for ${userId}: ${nodeData.name}`);
                        updateUserName(userId, nodeData.name);
                    }
                });
            }
        });
        
        // Store cleanup function
        userSubscriptions.set(userId, () => {
            if (cleanupFn && typeof cleanupFn.off === 'function') {
                cleanupFn.off();
            }
        });
        
        // For logged-in user, check if this is our own ID and we have a better name from login
        if (user.is && user.is.pub === userId) {
            // Try to get the actual username from localStorage or elsewhere
            const storedAlias = localStorage.getItem('gundb-username');
            if (storedAlias) {
                console.log(`Setting current user name from stored alias: ${storedAlias}`);
                updateUserName(userId, storedAlias);
            }
        }
    }
    
    // Return ID as a fallback while data loads
    return userId;
}

/**
 * Helper to update user name and trigger all appropriate callbacks
 */
function updateUserName(userId: string, name: string): void {
    // Skip if no change or if name is empty or just whitespace
    if (usersMap.get(userId) === name || !name.trim()) return;
    
    console.log(`Updating user name: ${userId} => ${name}`);
    
    // Update the map
    usersMap.set(userId, name);
    
    // Notify listeners
    const callbacks = userNameCallbacks.get(userId);
    if (callbacks) {
        callbacks.forEach(callback => {
            try {
                callback(userId, name);
            } catch (err) {
                console.error('Error in user name resolution callback:', err);
            }
        });
    }
}

// Clean up a user name subscription
export function clearUserNameSubscription(userId: string): void {
    const cleanup = userSubscriptions.get(userId);
    if (cleanup) {
        cleanup();
        userSubscriptions.delete(userId);
    }
    
    // Also clean up any callbacks
    userNameCallbacks.delete(userId);
}

// Update user profile in Gun
export function updateUserProfile(userId: string, name: string): void {
    if (!userId) return;
    
    // Store name in cache immediately for responsive UI
    updateUserName(userId, name);
    
    // If this is our username, store it in localStorage for persistence across sessions
    if (user.is && user.is.pub === userId) {
        localStorage.setItem('gundb-username', name);
    }
    
    // Gun will automatically merge this data
    gun.get('users').get(userId).put({
        name: name,
        lastSeen: Date.now()
    });
}

// Event to notify listeners when userMap changes
const userMapChangeListeners = new Set<() => void>();

// Add a listener for userMap changes
export function onUserMapChange(listener: () => void): () => void {
    userMapChangeListeners.add(listener);
    return () => userMapChangeListeners.delete(listener);
}

// Notify listeners of userMap changes
function notifyUserMapChange() {
    userMapChangeListeners.forEach(listener => listener());
}

// Observer for userMap changes
const originalSet = usersMap.set;
usersMap.set = function(key, value) {
    const result = originalSet.call(this, key, value);
    notifyUserMapChange();
    return result;
};

// Load users from Gun database with pure reactive subscription
export function loadUsers(
    callback: (users: Array<{id: string, name: string}>) => void,
    options?: {
      filterText?: string,
      excludeIds?: string[],
      rootId?: string // To exclude the current user/root
    }
): () => void {
    const filterText = options?.filterText?.toLowerCase() || '';
    const excludeIds = options?.excludeIds || [];
    const rootId = options?.rootId;
    
    // Make ourselves discoverable if we're loading
    if (rootId) {
        gun.get('users').get(rootId).get('lastSeen').put(Date.now());
    }
    
    // Create a subscription to track discovered users
    const userSub = new GunSubscription(['users']);
    const discoveredUsers = new Set<string>();
    
    // Function to update the user list with current state
    const updateUserList = () => {
        const users: Array<{id: string, name: string}> = [];
        
        // Process all entries in the usersMap
        for (const [id, name] of usersMap.entries()) {
            // Skip excluded users
            if ((rootId && id === rootId) || excludeIds.includes(id)) {
                continue;
            }
            
            // Apply text filter if needed
            if (filterText && !name.toLowerCase().includes(filterText)) {
                continue;
            }
            
            users.push({ id, name });
        }
        
        // Process any discovered users not yet in the map
        for (const userId of discoveredUsers) {
            if (usersMap.has(userId)) continue; // Skip if already in map
            
            // Skip excluded users
            if ((rootId && userId === rootId) || excludeIds.includes(userId)) {
                continue;
            }
            
            // Only add if it matches filter
            if (!filterText || userId.toLowerCase().includes(filterText)) {
                users.push({ id: userId, name: userId });
            }
        }
        
        // Sort by name and deliver results
        users.sort((a, b) => a.name.localeCompare(b.name));
        callback(users);
    };
    
    // Subscribe to userMap changes
    const mapChangeCleanup = onUserMapChange(updateUserList);
    
    // Pure reactive subscription to the users graph
    const subscriptionCleanup = userSub.each().on((userData: any) => {
        if (!userData || !userData._key) return;
        
        const userId = userData._key;
        discoveredUsers.add(userId);
        
        // Set up subscription to get the proper name if not already tracked
        if (!usersMap.has(userId)) {
            getUserName(userId);
        }
        
        // Update the list with the new information
        updateUserList();
    });
    
    // Return a function to unsubscribe from everything
    return () => {
        subscriptionCleanup();
        mapChangeCleanup();
        userSub.unsubscribe();
    };
}

// updateUsersList