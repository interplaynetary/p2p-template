import {Oxel, Recognition, Contributor} from './types'
import { GunSubscription } from "../old/GunSubscription";
import { type Proportion, DistributionMap, asProportion } from "../../utils/proportions"

// Stream-focused extension of Oxel class
export class OxelStream extends Oxel {
    constructor(path: string[]) {
        super(path);
    }
    
    nameStream(): GunSubscription<string> {
        return this.get('name').stream().map(value => value as string);
    }
    
    /**
     * Create a Svelte-compatible store from any stream method
     * @param streamMethodName Name of the stream method to use
     * @param initialValue Optional initial value before data arrives
     * @returns A store that can be used with Svelte's $ syntax
     */
    streamToStore<T>(streamMethodName: string, initialValue?: T) {
        if (typeof this[streamMethodName] !== 'function') {
            throw new Error(`Stream method ${streamMethodName} not found`);
        }
        
        // Invoke the stream method and convert to store
        const stream = this[streamMethodName]();
        if (!stream || typeof stream.toStore !== 'function') {
            throw new Error(`${streamMethodName} did not return a valid GunSubscription`);
        }
        
        // If there's an initial value, start with it
        if (initialValue !== undefined) {
            return stream.startWith(initialValue).toStore();
        }
        
        return stream.toStore();
    }
    
    /**
     * Create a Svelte-compatible store for the name property
     * @param initialValue Optional initial value for the name
     * @returns A store that updates with the node's name
     */
    nameStore(initialValue: string = '') {
        return this.nameStream().startWith(initialValue).toStore();
    }
}


// Stream-focused extension of Recognition class
export class RecognitionStream extends OxelStream {
    constructor(path: string[]) {
        super(path);
    }
    
    getParent(): Recognition | null {
        const parentNode = this.get('parent');
        return parentNode ? new Recognition([...this.path, 'parent']) : null;
    }
    
    contributorsStream(): GunSubscription<Set<Contributor>> {
        // Create a set to hold contributors
        let contributors = new Set<Contributor>();
        
        // Return a mapped subscription that emits the updated set each time
        return this.get('contributors').stream().map((data: any) => {
            if (!data) return new Set(contributors);
            
            // Process the data
            Object.keys(data).forEach(key => {
                if (key !== '_') { // Skip Gun metadata
                    const contributorPath = [...this.path, 'contributors', key];
                    contributors.add(new Contributor(contributorPath));
                }
            });
            
            // Return a copy of the current set
            return new Set(contributors);
        });
    }
    
    childrenStream(): GunSubscription<Set<Recognition>> {
        let children = new Set<Recognition>();
        
        // Return a mapped subscription that emits the updated set each time
        return this.get('children').stream().map((data: any) => {
            if (!data) return new Set(children);
            
            // Process the data
            Object.keys(data).forEach(key => {
                if (key !== '_') { // Skip Gun metadata
                    const childPath = [...this.path, 'children', key];
                    children.add(new Recognition(childPath));
                }
            });
            
            // Return a copy of the current set
            return new Set(children);
        });
    }
    
    pointsStream(): GunSubscription<number> {
        return this.get('points').stream().map(value => Number(value) || 0);
    }
    
    manualFulfillmentStream(): GunSubscription<number> {
        return this.get('manualFulfillment').stream().map(value => Number(value) || 0);
    }
    
    totalChildPointsStream(): GunSubscription<number> {
        // Get the set of children as a stream
        return this.childrenStream()
            .switchMap((children: Set<Recognition>) => {
                // If no children, return a stream of 0
                if (children.size === 0) {
                    return GunSubscription.of(0);
                }
                
                // Create an array of point streams from each child
                const pointStreams = Array.from(children).map(child => 
                    child.asStream().pointsStream()
                );
                
                // Start with the first stream
                let combinedStream = pointStreams[0];
                
                // For each additional stream, combine it with the running total
                for (let i = 1; i < pointStreams.length; i++) {
                    combinedStream = combinedStream.combine(
                        pointStreams[i], 
                        (total, points) => total + points
                    );
                }
                
                return combinedStream;
            });
    }
    
    shareOfRootStream(): GunSubscription<number> {
        const parent = this.getParent();
        
        // If this is the root, always return 1
        if (parent === null) {
            return GunSubscription.of(1);
        }
        
        // For non-root nodes, we need to combine:
        // 1. This node's points
        // 2. Parent's total child points 
        // 3. Parent's share of root
        
        // Get the current node's points
        const pointsStream = this.pointsStream();
        
        // Get the parent's total child points
        const parentTotalChildPointsStream = parent.asStream().totalChildPointsStream();
        
        // Get the parent's share of root
        const parentShareOfRootStream = parent.asStream().shareOfRootStream();
        
        // Combine parent total child points with this node's points to get share of parent
        const shareOfParentStream = pointsStream.combine(
            parentTotalChildPointsStream,
            (points, totalChildPoints) => totalChildPoints === 0 ? 0 : points / totalChildPoints
        );
        
        // Combine share of parent with parent's share of root to get this node's share of root
        return shareOfParentStream.combine(
            parentShareOfRootStream,
            (shareOfParent, parentShareOfRoot) => shareOfParent * parentShareOfRoot
        );
    }
    
    shareOfParentStream(): GunSubscription<number> {
        const parent = this.getParent();
        
        // If this is the root, always return 1
        if (parent === null) {
            return GunSubscription.of(1);
        }
        
        // Get the current node's points
        const pointsStream = this.pointsStream();
        
        // Get the parent's total child points
        const parentTotalChildPointsStream = parent.asStream().totalChildPointsStream();
        
        // Combine parent total child points with this node's points to get share of parent
        return pointsStream.combine(
            parentTotalChildPointsStream,
            (points, totalChildPoints) => totalChildPoints === 0 ? 0 : points / totalChildPoints
        );
    }
    
    isContributorStream(): GunSubscription<boolean> {
        // A node is a contributor if it has no parent (is root)
        // This will only change if the parent relationship changes
        return new GunSubscription(this.path.concat(['parent']))
            .map(parentData => parentData === null || parentData === undefined);
    }
    
    isContributionStream(): GunSubscription<boolean> {
        // A node is a contribution if it has both a parent and contributors
        const parentStream = new GunSubscription(this.path.concat(['parent']));
        const contributorsStream = this.contributorsStream();
        
        return parentStream.combine(
            contributorsStream,
            (parent, contributors) => Boolean(parent && contributors.size > 0)
        );
    }
    
    hasDirectContributionChildStream(): GunSubscription<boolean> {
        // Get the stream of children
        return this.childrenStream().switchMap((children: Set<Recognition>) => {
            if (children.size === 0) {
                return GunSubscription.of(false);
            }
            
            // Create a stream for each child's isContribution status
            const childStreams = Array.from(children).map(child => 
                child.asStream().isContributionStream()
            );
            
            // Start with false and combine with OR operation
            let resultStream = GunSubscription.of(false);
            
            // For each child stream, combine with OR logic
            for (const childStream of childStreams) {
                resultStream = resultStream.combine(
                    childStream,
                    (current, isContribution) => current || isContribution
                );
            }
            
            return resultStream;
        });
    }
    
    hasNonContributionChildStream(): GunSubscription<boolean> {
        // Get the stream of children
        return this.childrenStream().switchMap((children: Set<Recognition>) => {
            if (children.size === 0) {
                return GunSubscription.of(false);
            }
            
            // Create a stream for each child's isContribution status
            const childStreams = Array.from(children).map(child => 
                child.asStream().isContributionStream().map(isContribution => !isContribution)
            );
            
            // Start with false and combine with OR operation
            let resultStream = GunSubscription.of(false);
            
            // For each child stream, combine with OR logic
            for (const childStream of childStreams) {
                resultStream = resultStream.combine(
                    childStream,
                    (current, isNotContribution) => current || isNotContribution
                );
            }
            
            return resultStream;
        });
    }
    
    contributionChildrenWeightStream(): GunSubscription<number> {
        return this.childrenStream().switchMap((children: Set<Recognition>) => {
            if (children.size === 0) {
                return GunSubscription.of(0);
            }
            
            // Create combined streams to track contribution points and total points
            let contributionPointsStream = GunSubscription.of(0);
            let totalPointsStream = GunSubscription.of(0);
            
            // Process each child
            for (const child of children) {
                const childStream = child.asStream();
                const pointsStream = childStream.pointsStream();
                const isContributionStream = childStream.isContributionStream();
                
                // Update total points - add this child's points to running total
                totalPointsStream = totalPointsStream.combine(
                    pointsStream,
                    (total, points) => total + points
                );
                
                // For contribution points, only add if this is a contribution
                const childContributionPoints = pointsStream.combine(
                    isContributionStream,
                    (points, isContribution) => isContribution ? points : 0
                );
                
                contributionPointsStream = contributionPointsStream.combine(
                    childContributionPoints,
                    (total, points) => total + points
                );
            }
            
            // Calculate the ratio
            return contributionPointsStream.combine(
                totalPointsStream,
                (contributionPoints, totalPoints) => 
                    totalPoints === 0 ? 0 : contributionPoints / totalPoints
            );
        });
    }
    
    contributionChildrenFulfillmentStream(): GunSubscription<number> {
        return this.childrenStream().switchMap((children: Set<Recognition>) => {
            if (children.size === 0) {
                return GunSubscription.of(0);
            }
            
            // Start with zero fulfillment
            let fulfillmentSumStream = GunSubscription.of(0);
            
            // For each child
            for (const child of children) {
                // Get the streams we need
                const childStream = child.asStream();
                const isContributionStream = childStream.isContributionStream();
                const fulfilledStream = childStream.fulfilledStream();
                const shareOfParentStream = childStream.shareOfParentStream();
                
                // Combine fulfilled and shareOfParent to get this child's contribution
                const childContribution = fulfilledStream.combine(
                    shareOfParentStream,
                    (fulfilled, shareOfParent) => fulfilled * shareOfParent
                );
                
                // Only add to sum if this is a contribution
                const weightedContribution = childContribution.combine(
                    isContributionStream,
                    (contribution, isContribution) => isContribution ? contribution : 0
                );
                
                // Add to running total
                fulfillmentSumStream = fulfillmentSumStream.combine(
                    weightedContribution,
                    (sum, contribution) => sum + contribution
                );
            }
            
            return fulfillmentSumStream;
        });
    }
    
    nonContributionChildrenFulfillmentStream(): GunSubscription<number> {
        return this.childrenStream().switchMap((children: Set<Recognition>) => {
            if (children.size === 0) {
                return GunSubscription.of(0);
            }
            
            // Start with zero fulfillment
            let fulfillmentSumStream = GunSubscription.of(0);
            
            // For each child
            for (const child of children) {
                // Get the streams we need
                const childStream = child.asStream();
                const isContributionStream = childStream.isContributionStream();
                const fulfilledStream = childStream.fulfilledStream();
                const shareOfParentStream = childStream.shareOfParentStream();
                
                // Combine fulfilled and shareOfParent to get this child's contribution
                const childContribution = fulfilledStream.combine(
                    shareOfParentStream,
                    (fulfilled, shareOfParent) => fulfilled * shareOfParent
                );
                
                // Only add to sum if this is NOT a contribution (note the ! operator)
                const weightedContribution = childContribution.combine(
                    isContributionStream,
                    (contribution, isContribution) => !isContribution ? contribution : 0
                );
                
                // Add to running total
                fulfillmentSumStream = fulfillmentSumStream.combine(
                    weightedContribution,
                    (sum, contribution) => sum + contribution
                );
            }
            
            return fulfillmentSumStream;
        });
    }
    
    /**
     * Add a child node to this node in a reactive way
     * @param name Name of the child node
     * @param points Points value for the child
     * @param contributors Optional array of contributors to add
     * @param manualFulfillment Optional manual fulfillment value
     * @returns A stream that emits the created child node
     */
    addChildStream(
        name: string, 
        points: number = 0,
        contributors: Contributor[] = [],
        manualFulfillment?: number
    ): GunSubscription<Recognition> {
        // Use GunSubscription.of to create a static stream that will emit one value
        const stream = new GunSubscription<Recognition>([]);
        
        // Set up a handler to perform the async operation
        const recognition = new Recognition(this.path);
        recognition.addChild(name, points, contributors, manualFulfillment)
            .then(child => {
                // Handle the result by creating a handler to emit the value
                const handler = stream.on.bind(stream);
                handler(child);
            })
            .catch(error => {
                console.error('Error adding child:', error);
            });
        
        return stream;
    }
    
    /**
     * Remove a child node from this node in a reactive way
     * @param child The child node to remove or its ID
     * @returns A stream that emits true when complete
     */
    removeChildStream(child: Recognition | string): GunSubscription<boolean> {
        // Create a static stream that will emit one value
        const stream = new GunSubscription<boolean>([]);
        
        // Perform the async operation
        const recognition = new Recognition(this.path);
        recognition.removeChild(child)
            .then(() => {
                // Emit success
                const handler = stream.on.bind(stream);
                handler(true);
            })
            .catch(error => {
                console.error('Error removing child:', error);
                // Emit failure
                const handler = stream.on.bind(stream);
                handler(false);
            });
        
        return stream;
    }
    
    /**
     * Add a contributor to this node in a reactive way
     * @param contributor The contributor to add
     * @returns A stream that emits true when complete
     */
    addContributorStream(contributor: Contributor): GunSubscription<boolean> {
        // Create a static stream that will emit one value
        const stream = new GunSubscription<boolean>([]);
        
        // Perform the async operation
        const recognition = new Recognition(this.path);
        recognition.addContributor(contributor)
            .then(() => {
                // Emit success
                const handler = stream.on.bind(stream);
                handler(true);
            })
            .catch(error => {
                console.error('Error adding contributor:', error);
                // Emit failure
                const handler = stream.on.bind(stream);
                handler(false);
            });
        
        return stream;
    }
    
    /**
     * Remove a contributor from this node in a reactive way
     * @param contributor The contributor to remove or its ID
     * @returns A stream that emits true when complete
     */
    removeContributorStream(contributor: Contributor | string): GunSubscription<boolean> {
        // Create a static stream that will emit one value
        const stream = new GunSubscription<boolean>([]);
        
        // Perform the async operation
        const recognition = new Recognition(this.path);
        recognition.removeContributor(contributor)
            .then(() => {
                // Emit success
                const handler = stream.on.bind(stream);
                handler(true);
            })
            .catch(error => {
                console.error('Error removing contributor:', error);
                // Emit failure
                const handler = stream.on.bind(stream);
                handler(false);
            });
        
        return stream;
    }
    
    fulfilledStream(): GunSubscription<number> {
        // If this is a contribution, return a static stream with value 1.0
        const isContributionProp = this.get('isContribution');
        const isContributionStream = new GunSubscription(this.path.concat(['isContribution']));
        
        // Handle the leaf node and contribution node cases
        return isContributionStream.switchMap(isContribution => {
            if (isContribution) {
                return GunSubscription.of(1.0);
            }
            
            // For nodes with children
            const childrenStream = this.childrenStream();
            
            // If no children, return 0.0 for leaf non-contribution nodes
            return childrenStream.switchMap(children => {
                if (!children || Object.keys(children).length === 0) {
                    return GunSubscription.of(0.0);
                }
                
                // Check for manual fulfillment and if node has contribution children
                const manualFulfillmentStream = new GunSubscription(this.path.concat(['manualFulfillment']));
                
                return manualFulfillmentStream.switchMap(manualFulfillmentValue => {
                    // If no manual fulfillment, calculate from all children
                    if (manualFulfillmentValue === null || manualFulfillmentValue === undefined) {
                        // Create streams of child fulfillment and shareOfParent for each child
                        const childStreams = Object.keys(children)
                            .filter(key => key !== '_')
                            .map(childKey => {
                                const childPath = [...this.path, 'children', childKey];
                                const child = new Recognition(childPath);
                                const childStream = child.asStream();
                                const fulfilledStream = childStream.fulfilledStream();
                                const shareStream = childStream.shareOfParentStream();
                                
                                // Combine the two streams to get fulfilled * shareOfParent
                                return fulfilledStream.combine(shareStream, 
                                    (fulfilled: number, share: number) => (fulfilled * share));
                            });
                        
                        // If no children streams, return 0
                        if (childStreams.length === 0) {
                            return GunSubscription.of(0.0);
                        }
                        
                        // Combine all child fulfillment contributions
                        // Start with 0 and add each child's contribution
                        let resultStream = GunSubscription.of(0);
                        
                        // Merge all individual child contribution streams
                        for (const childStream of childStreams) {
                            resultStream = resultStream.combine(childStream, 
                                (sum: number, childContribution: number) => sum + childContribution);
                        }
                        
                        return resultStream;
                    }
                    
                    // For manual fulfillment, just return that value
                    return GunSubscription.of(Number(manualFulfillmentValue) || 0);
                });
            });
        });
    }
    
    desireStream(): GunSubscription<number> {
        return this.fulfilledStream().map(fulfilled => 1 - fulfilled);
    }
    
    // Store methods for common properties
    
    /**
     * Create a store for this node's points
     * @param initialValue Initial points value (defaults to 0)
     * @returns Svelte-compatible store
     */
    pointsStore(initialValue: number = 0) {
        return this.pointsStream().startWith(initialValue).toStore();
    }
    
    /**
     * Create a store for this node's share of parent
     * @param initialValue Initial share value (defaults to 0)
     * @returns Svelte-compatible store
     */
    shareOfParentStore(initialValue: number = 0) {
        return this.shareOfParentStream().startWith(initialValue).toStore();
    }
    
    /**
     * Create a store for this node's share of root
     * @param initialValue Initial share value (defaults to 0)
     * @returns Svelte-compatible store
     */
    shareOfRootStore(initialValue: number = 0) {
        return this.shareOfRootStream().startWith(initialValue).toStore();
    }
    
    /**
     * Create a store for this node's children
     * @param initialValue Initial empty Set
     * @returns Svelte-compatible store
     */
    childrenStore(initialValue: Set<Recognition> = new Set()) {
        return this.childrenStream().startWith(initialValue).toStore();
    }
    
    /**
     * Create a store for this node's fulfillment value
     * @param initialValue Initial fulfillment value (defaults to 0)
     * @returns Svelte-compatible store
     */
    fulfilledStore(initialValue: number = 0) {
        return this.fulfilledStream().startWith(initialValue).toStore();
    }
    
    /**
     * Create a store for this node's desire value
     * @param initialValue Initial desire value (defaults to 1)
     * @returns Svelte-compatible store
     */
    desireStore(initialValue: number = 1) {
        return this.desireStream().startWith(initialValue).toStore();
    }
    
    /**
     * Create a store for adding a child to this node
     * @returns A function that returns a Promise resolving to the created child
     */
    addChildStore() {
        return {
            subscribe: (run: (fn: (name: string, points?: number, contributors?: Contributor[], manualFulfillment?: number) => Promise<Recognition>) => void) => {
                const addChildFn = async (
                    name: string,
                    points: number = 0,
                    contributors: Contributor[] = [],
                    manualFulfillment?: number
                ): Promise<Recognition> => {
                    const recognition = new Recognition(this.path);
                    return recognition.addChild(name, points, contributors, manualFulfillment);
                };
                
                run(addChildFn);
                
                // Return unsubscribe function (no-op since this is a function reference)
                return () => {};
            }
        };
    }
    
    /**
     * Create a store for removing a child from this node
     * @returns A function that returns a Promise resolving when the child is removed
     */
    removeChildStore() {
        return {
            subscribe: (run: (fn: (child: Recognition | string) => Promise<Recognition>) => void) => {
                const removeChildFn = async (child: Recognition | string): Promise<Recognition> => {
                    const recognition = new Recognition(this.path);
                    return recognition.removeChild(child);
                };
                
                run(removeChildFn);
                
                // Return unsubscribe function (no-op since this is a function reference)
                return () => {};
            }
        };
    }
    
    /**
     * Create a store for adding a contributor to this node
     * @returns A function that returns a Promise resolving when the contributor is added
     */
    addContributorStore() {
        return {
            subscribe: (run: (fn: (contributor: Contributor) => Promise<Recognition>) => void) => {
                const addContributorFn = async (contributor: Contributor): Promise<Recognition> => {
                    const recognition = new Recognition(this.path);
                    return recognition.addContributor(contributor);
                };
                
                run(addContributorFn);
                
                // Return unsubscribe function (no-op since this is a function reference)
                return () => {};
            }
        };
    }
    
    /**
     * Create a store for removing a contributor from this node
     * @returns A function that returns a Promise resolving when the contributor is removed
     */
    removeContributorStore() {
        return {
            subscribe: (run: (fn: (contributor: Contributor | string) => Promise<Recognition>) => void) => {
                const removeContributorFn = async (contributor: Contributor | string): Promise<Recognition> => {
                    const recognition = new Recognition(this.path);
                    return recognition.removeContributor(contributor);
                };
                
                run(removeContributorFn);
                
                // Return unsubscribe function (no-op since this is a function reference)
                return () => {};
            }
        };
    }
    
    /**
     * Create a combination store that emits a derived value
     * @param streamMethods Array of stream method names to combine
     * @param combineFn Function to combine the values from the streams
     * @param initialValue Initial value for the store
     * @returns Svelte-compatible store
     */
    combineStore<T, R>(
        streamMethods: string[], 
        combineFn: (...values: T[]) => R,
        initialValue?: R
    ) {
        // Get all the streams
        const streams = streamMethods.map(methodName => {
            if (typeof this[methodName] !== 'function') {
                throw new Error(`Stream method ${methodName} not found`);
            }
            return this[methodName]();
        });
        
        if (streams.length === 0) {
            throw new Error('No streams provided to combine');
        }
        
        // Start with the first stream
        let combinedStream = streams[0];
        
        // Combine with each additional stream
        for (let i = 1; i < streams.length; i++) {
            combinedStream = combinedStream.combine(
                streams[i],
                (accumulated, next) => {
                    // Accumulate values in an array to pass to combineFn
                    const values = Array.isArray(accumulated) 
                        ? [...accumulated, next]
                        : [accumulated, next];
                    
                    // If we haven't gathered all values yet, return the array
                    if (values.length < streams.length) {
                        return values;
                    }
                    
                    // Once we have all values, call the combine function
                    return combineFn(...values);
                }
            );
        }
        
        // Apply initial value if provided
        if (initialValue !== undefined) {
            combinedStream = combinedStream.startWith(initialValue);
        }
        
        return combinedStream.toStore();
    }
}

// Stream-focused extension of Contributor class
export class ContributorStream extends RecognitionStream {
    constructor(path: string[]) {
        super(path);
    }
    
    /**
     * Stream for recognition of a specific instance
     * @param instance The Recognition instance to measure recognition of
     * @returns A stream that emits recognition values
     */
    recognitionOfStream(instance: Recognition): GunSubscription<number> {
        // Get the streams we need
        const instanceStream = instance.asStream();
        const fulfilledStream = instanceStream.fulfilledStream();
        const weightStream = instanceStream.shareOfRootStream();
        const contributorsStream = instanceStream.contributorsStream();
        
        // Calculate fulfillment weight (fulfilled * weight)
        const fulfillmentWeightStream = fulfilledStream.combine(
            weightStream,
            (fulfilled, weight) => fulfilled * weight
        );
        
        // Divide by contributor count if there are contributors
        return fulfillmentWeightStream.combine(
            contributorsStream,
            (fulfillmentWeight, contributors) => {
                const contributorCount = contributors.size;
                return contributorCount > 0
                    ? fulfillmentWeight / contributorCount
                    : fulfillmentWeight;
            }
        );
    }
    
    /**
     * Stream for shares of general fulfillment
     * @returns A stream that emits the map of contributors to their share values
     */
    sharesOfGeneralFulfillmentStream(): GunSubscription<Map<Contributor, number>> {
        // Create a map to hold shares
        let sharesMap = new Map<Contributor, number>();
        
        // Return a mapped subscription that emits the updated map each time
        return this.get('sharesOfGeneralFulfillment').stream().map((data: any) => {
            if (!data) return new Map(sharesMap);
            
            // Clear the map for fresh data
            sharesMap.clear();
            
            // Process the data
            Object.keys(data).forEach(key => {
                if (key !== '_') { // Skip Gun metadata
                    const contributorPath = [...this.path, 'sharesOfGeneralFulfillment', key];
                    const contributor = new Contributor(contributorPath);
                    sharesMap.set(contributor, Number(data[key]) || 0);
                }
            });
            
            // Return a copy of the current map
            return new Map(sharesMap);
        });
    }
    
    /**
     * Stream for the mutual recognition between this contributor and another
     * @param otherContributor The contributor to check mutual recognition with
     * @returns A stream that emits the mutual recognition value
     */
    mutualRecognitionStream(otherContributor: Contributor): GunSubscription<number> {
        // Get the shares streams for both contributors
        const mySharesStream = this.sharesOfGeneralFulfillmentStream();
        const theirSharesStream = otherContributor.asStream().sharesOfGeneralFulfillmentStream();
        
        // Combine the two streams to calculate mutual recognition
        return mySharesStream.combine(
            theirSharesStream,
            (myShares, theirShares) => {
                // This is a synchronous implementation that doesn't use async/await
                // to avoid returning a Promise<number>
                
                // Initialize shares
                let myShareInTheirs = 0;
                let theirShareInMine = 0;
                
                // Try to find matching contributors by comparing their string representations
                // This is a simpler approach that avoids async ID resolution
                const myIdString = this.path.join('/');
                const theirIdString = otherContributor instanceof Contributor ? 
                    otherContributor.asStream().path.join('/') : '';
                
                if (!myIdString || !theirIdString) {
                    return 0; // Can't compare without IDs
                }
                
                // Find this contributor in their shares
                for (const [contributor, share] of theirShares.entries()) {
                    // Use string representation for comparison
                    const contribIdString = contributor instanceof Contributor ? 
                        contributor.asStream().path.join('/') : '';
                    
                    if (contribIdString === myIdString) {
                        myShareInTheirs = share;
                        break;
                    }
                }
                
                // Find them in my shares
                for (const [contributor, share] of myShares.entries()) {
                    // Use string representation for comparison
                    const contribIdString = contributor instanceof Contributor ? 
                        contributor.asStream().path.join('/') : '';
                    
                    if (contribIdString === theirIdString) {
                        theirShareInMine = share;
                        break;
                    }
                }
                
                // Mutual recognition is the minimum of the two values
                return Math.min(myShareInTheirs, theirShareInMine);
            }
        );
    }
    
    /**
     * Stream for social distributions by depth
     * @returns A stream that emits the map of depth to distribution maps
     */
    socialDistributionsStream(): GunSubscription<Map<number, DistributionMap<Contributor>>> {
        // Create a map to hold social distributions
        let distributionsMap = new Map<number, DistributionMap<Contributor>>();
        
        // Return a mapped subscription that emits the updated map each time
        return this.get('socialDistributions').stream().map((data: any) => {
            if (!data) return new Map(distributionsMap);
            
            // Clear the map for fresh data
            distributionsMap.clear();
            
            // Process the data
            Object.keys(data).forEach(depthKey => {
                if (depthKey !== '_') { // Skip Gun metadata
                    const depth = Number(depthKey);
                    const depthData = data[depthKey];
                    
                    // Create a distribution map for this depth
                    const distMap = new DistributionMap<Contributor>();
                    
                    // Process contributors in this depth
                    Object.keys(depthData).forEach(contribKey => {
                        if (contribKey !== '_') { // Skip Gun metadata
                            const contributorPath = [...this.path, 'socialDistributions', depthKey, contribKey];
                            const contributor = new Contributor(contributorPath);
                            distMap.set(contributor, Number(depthData[contribKey]) || 0);
                        }
                    });
                    
                    // Add to the main map
                    distributionsMap.set(depth, distMap);
                }
            });
            
            // Return a copy of the current map
            return new Map(distributionsMap);
        });
    }
    
    /**
     * Stream for a specific social distribution by depth
     * @param depth The depth level to retrieve
     * @returns A stream that emits the distribution map for the specified depth
     */
    socialDistributionStream(depth: number = 1): GunSubscription<DistributionMap<Contributor>> {
        return this.socialDistributionsStream().map(distributions => {
            return distributions.get(depth) || new DistributionMap<Contributor>();
        });
    }
    
    // Store creation methods
    
    /**
     * Create a store for recognition of a specific instance
     * @param instance The Recognition instance to measure recognition of
     * @param initialValue Initial recognition value (defaults to 0)
     * @returns Svelte-compatible store
     */
    recognitionOfStore(instance: Recognition, initialValue: number = 0) {
        return this.recognitionOfStream(instance).startWith(initialValue).toStore();
    }
    
    /**
     * Create a store for shares of general fulfillment
     * @param initialValue Initial empty Map
     * @returns Svelte-compatible store
     */
    sharesOfGeneralFulfillmentStore(initialValue: Map<Contributor, number> = new Map()) {
        return this.sharesOfGeneralFulfillmentStream().startWith(initialValue).toStore();
    }
    
    /**
     * Create a store for mutual recognition with another contributor
     * @param otherContributor The contributor to check mutual recognition with
     * @param initialValue Initial value (defaults to 0)
     * @returns Svelte-compatible store
     */
    mutualRecognitionStore(otherContributor: Contributor, initialValue: number = 0) {
        return this.mutualRecognitionStream(otherContributor).startWith(initialValue).toStore();
    }
    
    /**
     * Create a store for social distributions
     * @param initialValue Initial empty Map
     * @returns Svelte-compatible store
     */
    socialDistributionsStore(initialValue: Map<number, DistributionMap<Contributor>> = new Map()) {
        return this.socialDistributionsStream().startWith(initialValue).toStore();
    }
    
    /**
     * Create a store for a specific social distribution
     * @param depth The depth level to retrieve
     * @param initialValue Initial empty DistributionMap
     * @returns Svelte-compatible store
     */
    socialDistributionStore(depth: number = 1, initialValue: DistributionMap<Contributor> = new DistributionMap()) {
        return this.socialDistributionStream(depth).startWith(initialValue).toStore();
    }
    
    /**
     * Create a store that provides a function to update shares of general fulfillment
     * @returns A store with a function to trigger shares update
     */
    updateSharesStore() {
        return {
            subscribe: (run: (fn: () => Promise<Map<Contributor, number>>) => void) => {
                const updateSharesFn = async (): Promise<Map<Contributor, number>> => {
                    const contributor = new Contributor(this.path);
                    return contributor.updateSharesOfGeneralFulfillment();
                };
                
                run(updateSharesFn);
                
                // Return unsubscribe function (no-op since this is a function reference)
                return () => {};
            }
        };
    }
    
    /**
     * Create a store that provides a function to calculate social distribution
     * @returns A store with a function to trigger social distribution calculation
     */
    calculateSocialDistributionStore() {
        return {
            subscribe: (run: (fn: (depth?: number) => Promise<DistributionMap<Contributor>>) => void) => {
                const calculateDistFn = async (depth: number = 1): Promise<DistributionMap<Contributor>> => {
                    const contributor = new Contributor(this.path);
                    return contributor.calculateSocialDistribution(depth);
                };
                
                run(calculateDistFn);
                
                // Return unsubscribe function (no-op since this is a function reference)
                return () => {};
            }
        };
    }
}
