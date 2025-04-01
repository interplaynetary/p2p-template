import { gun } from '../models/Gun';

// Global users Map for caching user data - simplified to just map user ID to name
export const usersMap = new Map<string, string>();

// Function to get user name from cache or Gun
export function getUserName(userId: string): string {
    if (usersMap.has(userId)) {
        return usersMap.get(userId)!;
    }
    
    // If not in cache, try to get from Gun
    gun.get('users').get(userId).once((userData) => {
        if (userData && userData.node && userData.node['#']) {
            const nodePath = userData.node['#'];
            gun.get(nodePath).once((nodeData) => {
                const userName = nodeData?.name || userData.name;
                usersMap.set(userId, userName);
            });
        } else {
            const userName = userData?.name;
            usersMap.set(userId, userName);
        }
    });
    
    return userId; // Return ID as fallback
}