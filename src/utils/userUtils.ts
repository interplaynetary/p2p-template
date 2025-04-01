import { gun } from '../models/Gun';

// Global users Map for lightweight caching to avoid repeated lookups
// This is just a performance optimization, not our source of truth
export const usersMap = new Map<string, string>();

// Function to get user name from Gun (reactive)
export function getUserName(userId: string): string {
    // Return from cache if available for immediate UI response
    if (usersMap.has(userId)) {
        return usersMap.get(userId)!;
    }
    
    // Set up subscription to user data
    gun.get('users').get(userId).on((userData: any) => {
        if (userData && userData.name) {
            // Store in cache for performance
            usersMap.set(userId, userData.name);
        } else if (userData && userData.node && userData.node['#']) {
            // Follow reference if user data is stored in a node
            gun.get(userData.node['#']).on((nodeData: any) => {
                if (nodeData && nodeData.name) {
                    usersMap.set(userId, nodeData.name);
                }
            });
        }
    });
    
    // Return ID as a fallback while data loads
    return userId;
}

// Update user profile in Gun
export function updateUserProfile(userId: string, name: string): void {
    if (!userId) return;
    
    // Gun will automatically merge this data
    gun.get('users').get(userId).put({
        name: name,
        lastSeen: Date.now()
    });
}

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
    
    // Pure reactive subscription to the users graph
    const subscription = gun.get('users').map().on((userData, userId) => {
        if (!userId || !userData) return;
        
        // Get the current state of all users we know about
        const users: Array<{id: string, name: string}> = [];
        
        // We can't access the complete map state directly in Gun
        // So we use the usersMap which is populated by on() callbacks
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
        
        // Also add this user if not already in map
        // This ensures we can show users immediately as they're found
        if (!usersMap.has(userId) && 
            !(rootId && userId === rootId) && 
            !excludeIds.includes(userId)) {
            // Try to extract name
            const name = userData.name || userId;
            
            // Only add if it matches filter
            if (!filterText || name.toLowerCase().includes(filterText)) {
                users.push({ id: userId, name });
                
                // Also add to map for future lookups
                if (name !== userId) {
                    usersMap.set(userId, name);
                }
            }
            
            // Set up a subscription to get the proper name
            getUserName(userId);
        }
        
        // Sort by name and deliver results
        users.sort((a, b) => a.name.localeCompare(b.name));
        callback(users);
    });
    
    // Return a function to unsubscribe
    return () => {
        gun.get('users').off();
    };
}

// updateUsersList