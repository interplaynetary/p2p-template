import { gun } from '../models/old/Gun';
import { GunSubscription } from '../models/old/GunSubscription';
import { Recognition, RecognitionStream, Contributor, ContributorStream, DatabaseAccess } from '../models/experiments/types';

// Initialize the singleton database access
const db = DatabaseAccess.getInstance();

/**
 * Create a Svelte-compatible store for a Gun node at the specified path
 * @param path Path segments to the node
 * @returns A Svelte-compatible store
 */
export function createNodeStore(...path: string[]) {
    return db.getRecognitionStream(...path).toStore();
}

/**
 * Create a Svelte-compatible store for a specific property of a node
 * @param property Property name to watch
 * @param path Path segments to the node
 * @returns A Svelte-compatible store
 */
export function createPropertyStore<T>(property: string, ...path: string[]) {
    return db.createStore<T>(property, ...path);
}

/**
 * Create a store for a recognition node's fulfillment value
 * @param path Path segments to the node
 * @returns A Svelte-compatible store that emits fulfillment values
 */
export function createFulfillmentStore(...path: string[]) {
    return db.getRecognitionStream(...path).fulfilledStore();
}

/**
 * Create a store for a recognition node's desire value
 * @param path Path segments to the node
 * @returns A Svelte-compatible store that emits desire values
 */
export function createDesireStore(...path: string[]) {
    return db.getRecognitionStream(...path).desireStore();
}

/**
 * Create a store for a recognition node's points
 * @param path Path segments to the node
 * @returns A Svelte-compatible store that emits point values
 */
export function createPointsStore(...path: string[]) {
    return db.getRecognitionStream(...path).pointsStore();
}

/**
 * Create a store for a recognition node's children
 * @param path Path segments to the node
 * @returns A Svelte-compatible store that emits the set of children
 */
export function createChildrenStore(...path: string[]) {
    return db.getRecognitionStream(...path).childrenStore();
}

/**
 * Create a store that emits a list of child nodes suitable for iterating in Svelte
 * @param path Path segments to the parent node
 * @returns A Svelte-compatible store that emits an array of [id, node] pairs
 */
export function createChildrenListStore(...path: string[]) {
    return db.getRecognitionStream(...path).childrenStream()
        .map(children => Array.from(children).map(async child => {
            // Use getId() to get the node ID asynchronously
            const id = await child.getId() || 'unknown';
            return [id, child];
        }))
        .toStore();
}

/**
 * Create a store for a contributor's recognition of a specific instance
 * @param contributorPath Path to the contributor
 * @param instancePath Path to the instance being recognized
 * @returns A Svelte-compatible store
 */
export function createRecognitionStore(contributorPath: string[], instancePath: string[]) {
    const contributor = db.getContributorStream(...contributorPath);
    const instance = db.getRecognition(...instancePath);
    return contributor.recognitionOfStore(instance);
}

/**
 * Create a combined store that derives a value from multiple properties
 * @param combineFn Function to combine the values
 * @param properties Object mapping property names to their paths
 * @returns A Svelte-compatible store
 */
export function createCombinedStore<T>(
    combineFn: (...values: any[]) => T,
    properties: Record<string, { property: string, path: string[] }>
) {
    // Get property names and their path details
    const propertyDetails = Object.entries(properties);
    
    if (propertyDetails.length === 0) {
        return GunSubscription.of(combineFn()).toStore();
    }
    
    // Get the first property's stream
    const [firstKey, { property: firstProp, path: firstPath }] = propertyDetails[0];
    const firstStream = db.getRecognitionStream(...firstPath)[`${firstProp}Stream`]();
    
    if (propertyDetails.length === 1) {
        return firstStream.map(value => combineFn(value)).toStore();
    }
    
    // Combine all streams
    let result = propertyDetails.slice(1).reduce((acc, [key, { property, path }]) => {
        const nextStream = db.getRecognitionStream(...path)[`${property}Stream`]();
        return acc.combine(nextStream, (accValue, nextValue) => {
            if (Array.isArray(accValue)) {
                return [...accValue, nextValue];
            } else {
                return [accValue, nextValue];
            }
        });
    }, firstStream);
    
    // Apply final combination function
    return result.map(values => {
        const argsArray = Array.isArray(values) ? values : [values];
        return combineFn(...argsArray);
    }).toStore();
}

/**
 * Extend Gun chain to work directly with Svelte subscriptions
 * This adds a .subscribe() method to Gun chains for direct use with Svelte's $ syntax
 */
export function extendGunForSvelte() {
    // Add subscribe method to Gun.chain
    (gun.constructor as any).chain.subscribe = function(publish) {
        const gun = this;
        const at = gun._;
        const isMap = !!at && !!at.back && !!at.back.each;
        
        if (isMap) {
            const store = new Map();
            publish(Array.from(store));
            
            gun.on((data, key, as) => {
                const nodeKey = key || ((data || {})._||{})['#'] || as.via.soul;
                
                if (data === null) {
                    store.delete(nodeKey);
                } else {
                    store.set(nodeKey, data);
                }
                
                publish(Array.from(store));
            });
        } else {
            gun.on(data => publish(data));
        }
        
        return () => gun.off();
    };
}

// Helper functions for common operations

/**
 * Update a property value on a node
 * @param value Value to set
 * @param property Property name
 * @param path Path to the node
 */
export function updateProperty(value: any, property: string, ...path: string[]) {
    db.getRecognition(...path).get(property).put(value);
}

/**
 * Create a new recognition node
 * @param name Node name
 * @param points Points value
 * @param parentPath Path to parent (optional)
 * @returns Promise resolving to the path of the new node
 */
export async function createRecognition(
    name: string,
    points: number = 0,
    parentPath?: string[]
): Promise<string[]> {
    // Generate a random ID
    const id = Math.random().toString(36).substring(2, 15);
    const path = ['nodes', id];
    
    // Create the node
    const node = db.getRecognition(...path);
    await node.put({
        name,
        points,
        parent: parentPath ? db.getRecognition(...parentPath).getChain() : null
    });
    
    // If there's a parent, add this node as a child
    if (parentPath) {
        const parent = db.getRecognition(...parentPath);
        await parent.get('children').get(id).put({ value: true });
    }
    
    return path;
}

/**
 * Get a store that reflects whether a given node is a contribution
 * @param path Path to the node
 * @returns A Svelte-compatible store that emits a boolean
 */
export function isContributionStore(...path: string[]) {
    return db.getRecognitionStream(...path).isContributionStream().toStore();
}

/**
 * Create a derived store that watches multiple input stores and computes a derived value
 * This implements the "watch values" principle from the guide
 * @param inputs Object of input stores
 * @param deriveFn Function to compute the derived value
 * @returns A Svelte-compatible store
 */
export function createDerivedStore<T>(
    inputs: Record<string, { subscribe: Function }>,
    deriveFn: (values: Record<string, any>) => T
) {
    // Extract all the input stores
    const inputStores = Object.entries(inputs);
    
    // Create a store that subscribes to all inputs
    return {
        subscribe: (run: (value: T) => void) => {
            let values: Record<string, any> = {};
            let initialized = false;
            let unsubscribers: Function[] = [];
            
            // Subscribe to each input store
            unsubscribers = inputStores.map(([key, store]) => {
                return store.subscribe((value: any) => {
                    // Store the current value
                    values[key] = value;
                    
                    // If we have values from all inputs, run the derive function
                    if (Object.keys(values).length === inputStores.length) {
                        initialized = true;
                        run(deriveFn(values));
                    }
                });
            });
            
            // Return unsubscribe function
            return () => {
                unsubscribers.forEach(unsub => unsub());
            };
        }
    };
}

/**
 * Create a store for a recognition node's share of parent
 * @param path Path segments to the node
 * @returns A Svelte-compatible store that emits share values
 */
export function createShareOfParentStore(...path: string[]) {
    return db.getRecognitionStream(...path).shareOfParentStream().toStore();
}

/**
 * Create a store for a recognition node's share of root
 * @param path Path segments to the node
 * @returns A Svelte-compatible store that emits share values
 */
export function createShareOfRootStore(...path: string[]) {
    return db.getRecognitionStream(...path).shareOfRootStream().toStore();
}

/**
 * Create a function store for adding a child to a recognition node
 * @param path Path segments to the parent node
 * @returns A store that provides a function to add a child
 */
export function createAddChildStore(...path: string[]) {
    return db.getRecognitionStream(...path).addChildStore();
}

/**
 * Create a function store for removing a child from a recognition node
 * @param path Path segments to the parent node
 * @returns A store that provides a function to remove a child
 */
export function createRemoveChildStore(...path: string[]) {
    return db.getRecognitionStream(...path).removeChildStore();
}

/**
 * Create a function store for adding a contributor to a recognition node
 * @param path Path segments to the node
 * @returns A store that provides a function to add a contributor
 */
export function createAddContributorStore(...path: string[]) {
    return db.getRecognitionStream(...path).addContributorStore();
}

/**
 * Create a function store for removing a contributor from a recognition node
 * @param path Path segments to the node
 * @returns A store that provides a function to remove a contributor
 */
export function createRemoveContributorStore(...path: string[]) {
    return db.getRecognitionStream(...path).removeContributorStore();
}

/**
 * Add a child node to a recognition node
 * @param parentPath Path to the parent node
 * @param name Name of the child node
 * @param points Points value for the child (default: 0)
 * @param contributors Optional array of contributors to add
 * @param manualFulfillment Optional manual fulfillment value
 * @returns Promise resolving to the child node
 */
export async function addChild(
    parentPath: string[],
    name: string,
    points: number = 0,
    contributors: Contributor[] = [],
    manualFulfillment?: number
): Promise<Recognition> {
    const parent = db.getRecognition(...parentPath);
    return parent.addChild(name, points, contributors, manualFulfillment);
}

/**
 * Remove a child node from a recognition node
 * @param parentPath Path to the parent node
 * @param child The child node to remove or its ID
 * @returns Promise resolving when the child is removed
 */
export async function removeChild(
    parentPath: string[],
    child: Recognition | string
): Promise<Recognition> {
    const parent = db.getRecognition(...parentPath);
    return parent.removeChild(child);
}

/**
 * Add a contributor to a recognition node
 * @param nodePath Path to the node
 * @param contributor The contributor to add
 * @returns Promise resolving when the contributor is added
 */
export async function addContributor(
    nodePath: string[],
    contributor: Contributor
): Promise<Recognition> {
    const node = db.getRecognition(...nodePath);
    return node.addContributor(contributor);
}

/**
 * Remove a contributor from a recognition node
 * @param nodePath Path to the node
 * @param contributor The contributor to remove or its ID
 * @returns Promise resolving when the contributor is removed
 */
export async function removeContributor(
    nodePath: string[],
    contributor: Contributor | string
): Promise<Recognition> {
    const node = db.getRecognition(...nodePath);
    return node.removeContributor(contributor);
}

/**
 * Create a writable store that updates a property in Gun when the store value changes
 * Implements the streaming mindset where updates flow through Gun
 * @param property Property name
 * @param path Path to the node
 * @param initialValue Initial value until Gun data arrives
 * @returns A writable store that syncs with Gun
 */
export function createWritablePropertyStore<T>(property: string, path: string[], initialValue?: T) {
    const node = db.getRecognition(...path);
    const propertyRef = node.get(property);
    let currentValue: T | undefined = initialValue;
    let subscribers: Array<(value: T) => void> = [];
    
    // Set up subscription to Gun
    const cleanup = propertyRef.stream().on((value: T) => {
        currentValue = value === undefined ? initialValue : value;
        // Notify all subscribers
        subscribers.forEach(run => run(currentValue as T));
    });
    
    return {
        subscribe: (run: (value: T) => void) => {
            subscribers.push(run);
            
            // Immediately run with current value if available
            if (currentValue !== undefined) {
                run(currentValue);
            }
            
            // Return unsubscribe function
            return () => {
                subscribers = subscribers.filter(sub => sub !== run);
                // Clean up Gun subscription if no more subscribers
                if (subscribers.length === 0) {
                    cleanup();
                }
            };
        },
        set: (value: T) => {
            // Update Gun, which will then notify subscribers
            propertyRef.put(value);
        },
        update: (updater: (value: T) => T) => {
            if (currentValue !== undefined) {
                propertyRef.put(updater(currentValue));
            }
        }
    };
}

/**
 * Create a throttled store that only updates at most once per specified period
 * Helpful for expensive derived calculations
 * @param store The input store
 * @param ms Throttle period in milliseconds
 * @returns A throttled store
 */
export function throttledStore<T>(store: { subscribe: Function }, ms: number) {
    let value: T;
    let lastUpdate = 0;
    let timeout: any = null;
    let subscribers: Array<(value: T) => void> = [];
    
    return {
        subscribe: (run: (value: T) => void) => {
            subscribers.push(run);
            
            // Subscribe to the source store
            const unsubscribe = store.subscribe((newValue: T) => {
                value = newValue;
                const now = Date.now();
                
                // If we haven't updated recently, update immediately
                if (now - lastUpdate > ms) {
                    lastUpdate = now;
                    subscribers.forEach(sub => sub(value));
                } else if (!timeout) {
                    // Otherwise schedule an update
                    timeout = setTimeout(() => {
                        lastUpdate = Date.now();
                        subscribers.forEach(sub => sub(value));
                        timeout = null;
                    }, ms - (now - lastUpdate));
                }
            });
            
            // Return unsubscribe function
            return () => {
                subscribers = subscribers.filter(sub => sub !== run);
                if (subscribers.length === 0) {
                    unsubscribe();
                    if (timeout) {
                        clearTimeout(timeout);
                        timeout = null;
                    }
                }
            };
        }
    };
}

// Export the database access singleton for advanced use cases
export { db }; 