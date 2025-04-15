import { GunNode } from "../old/GunNode"
import { type Proportion, DistributionMap, asProportion } from "../../utils/proportions"
import { OxelStream, RecognitionStream, ContributorStream} from "./streams";

export class Oxel extends GunNode<any> {
    // Organizational Element
    constructor(path: string[]) {
        super(path);
    }
    
    // Gets a stream-focused version of this Oxel
    asStream(): OxelStream {
        return new OxelStream(this.path);
    }
    
    async getId(): Promise<string | undefined> {
        return this.getSoul();
    }
    
    async getName(): Promise<string> {
        return this.once().then(data => data?.name as string);
    }
    
    /**
     * Create a Svelte-compatible store for this node
     * @returns A store that can be used with Svelte's $ syntax
     */
    toStore() {
        return this.stream().toStore();
    }
    
    /**
     * Create a Svelte-compatible store for a specific property
     * @param property The property name to create a store for
     * @param initialValue Optional initial value before data arrives
     * @returns A store that can be used with Svelte's $ syntax
     */
    propertyStore<T>(property: string, initialValue?: T) {
        return this.get(property).stream().map(value => 
            value === undefined ? initialValue : value
        ).toStore();
    }
}

export class Recognition extends Oxel {
    constructor(path: string[]) {
        super(path);
    }
    
    // Gets a stream-focused version of this Recognition
    asStream(): RecognitionStream {
        return new RecognitionStream(this.path);
    }
    
    getRecognizer(): Contributor {
        return new Contributor([...this.path, 'recognizer']);
    }
    
    async getContributors(): Promise<Set<Contributor>> {
        const contributors = new Set<Contributor>();
        
        // Get data from Gun using once instead of each/on
        const data = await this.get('contributors').once();
        
        if (data) {
            // Process the data to create Contributors
            Object.keys(data).forEach(key => {
                if (key !== '_') { // Skip Gun metadata
                    const contributorPath = [...this.path, 'contributors', key];
                    contributors.add(new Contributor(contributorPath));
                }
            });
        }
        
        return contributors;
    }
    
    /**
     * Add a contributor to this node
     * @param contributor The contributor to add
     * @returns This node for chaining
     */
    async addContributor(contributor: Contributor): Promise<Recognition> {
        const contributorId = await contributor.getId();
        
        if (!contributorId) {
            throw new Error('Contributor ID is required');
        }
        
        // Add the contributor to this node's contributors list
        await this.get('contributors').get(contributorId).put({ value: true });
        
        return this;
    }
    
    /**
     * Remove a contributor from this node
     * @param contributor The contributor to remove or its ID
     * @returns This node for chaining
     */
    async removeContributor(contributor: Contributor | string): Promise<Recognition> {
        const contributorId = typeof contributor === 'string' 
            ? contributor 
            : await contributor.getId();
        
        if (!contributorId) {
            throw new Error('Contributor ID is required');
        }
        
        // Remove the contributor from this node's contributors
        await this.get('contributors').get(contributorId).put(null);
        
        return this;
    }
    
    getParent(): Recognition | null {
        const parentNode = this.get('parent');
        return parentNode ? new Recognition([...this.path, 'parent']) : null;
    }
    
    setParent(parent: Recognition | null): void {
        this.put({ parent: parent ? parent.getChain() : null });
    }
    
    async isContributor(): Promise<boolean> {
        const parent = this.getParent();
        return parent === null;
    }
    
    async isContribution(): Promise<boolean> {
        const parent = this.getParent();
        const contributors = await this.getContributors();
        return Boolean(parent && contributors.size > 0);
    }
    
    async getChildren(): Promise<Set<Recognition>> {
        const children = new Set<Recognition>();
        
        // Get data from Gun using once instead of each/on
        const data = await this.get('children').once();
        
        if (data) {
            // Process the data to create Recognition nodes
            Object.keys(data).forEach(key => {
                if (key !== '_') { // Skip Gun metadata
                    const childPath = [...this.path, 'children', key];
                    children.add(new Recognition(childPath));
                }
            });
        }
        
        return children;
    }
    
    /**
     * Add a child node to this node
     * @param name Name of the child node
     * @param points Points value for the child (default: 0)
     * @param contributors Optional array of contributors to add
     * @param manualFulfillment Optional manual fulfillment value
     * @returns The newly created child node
     */
    async addChild(
        name: string,
        points: number = 0,
        contributors: Contributor[] = [],
        manualFulfillment?: number
    ): Promise<Recognition> {
        // Generate a unique ID for the child node
        const childId = Math.random().toString(36).substring(2, 15);
        
        // Create the child node path
        const childPath = [...this.path, 'children', childId];
        const child = new Recognition(childPath);
        
        // Set up the basic properties
        await child.put({
            name,
            points,
            parent: this.getChain(),
            manualFulfillment
        });
        
        // Add this node as the child's parent
        await child.setParent(this);
        
        // Add the contributors if provided
        for (const contributor of contributors) {
            await child.addContributor(contributor);
        }
        
        // Add the child to this node's children
        await this.get('children').get(childId).put({ value: true });
        
        return child;
    }
    
    /**
     * Remove a child node from this node
     * @param child The child node to remove or its ID
     * @returns This node for chaining
     */
    async removeChild(child: Recognition | string): Promise<Recognition> {
        const childId = typeof child === 'string' 
            ? child 
            : await child.getId();
        
        if (!childId) {
            throw new Error('Child ID is required');
        }
        
        const childPath = childId.split('/').pop();
        if (!childPath) {
            throw new Error('Invalid child ID format');
        }
        
        // Remove the child from this node's children
        await this.get('children').get(childPath).put(null);
        
        return this;
    }
    
    async getPoints(): Promise<number> {
        return this.once().then(data => Number(data?.points) || 0);
    }
    
    async getManualFulfillment(): Promise<number> {
        return this.once().then(data => Number(data?.manualFulfillment) || 0);
    }
    
    async getTotalChildPoints(): Promise<number> {
        const children = await this.getChildren();
        let sum = 0;
        
        for (const child of children) {
            sum += await child.getPoints();
        }
        
        return sum;
    }
    
    async getShareOfRoot(): Promise<number> {
        const parent = this.getParent();
        if (!parent) return 1; // Is root
        
        const parentTotalChildPoints = await parent.getTotalChildPoints();
        const points = await this.getPoints();
        const parentShareOfRoot = await parent.getShareOfRoot();
        
        return parentTotalChildPoints === 0
            ? 0
            : (points / parentTotalChildPoints) * parentShareOfRoot;
    }
    
    async getShareOfParent(): Promise<number> {
        const parent = this.getParent();
        if (!parent) return 1; // Is root
        
        const parentTotalChildPoints = await parent.getTotalChildPoints();
        const points = await this.getPoints();
        
        return parentTotalChildPoints === 0
            ? 0
            : points / parentTotalChildPoints;
    }
    
    async hasDirectContributionChild(): Promise<boolean> {
        const children = await this.getChildren();
        for (const child of children) {
            if (await child.isContribution()) {
                return true;
            }
        }
        return false;
    }
    
    async hasNonContributionChild(): Promise<boolean> {
        const children = await this.getChildren();
        for (const child of children) {
            if (!(await child.isContribution())) {
                return true;
            }
        }
        return false;
    }
    
    async getContributionChildrenWeight(): Promise<number> {
        const children = await this.getChildren();
        let contributionPoints = 0;
        let totalPoints = 0;
        
        for (const child of children) {
            const points = await child.getPoints();
            totalPoints += points;
            
            if (await child.isContribution()) {
                contributionPoints += points;
            }
        }
        
        return totalPoints === 0 ? 0 : contributionPoints / totalPoints;
    }
    
    async getContributionChildrenFulfillment(): Promise<number> {
        const children = await this.getChildren();
        let fulfillmentSum = 0;
        
        for (const child of children) {
            if (await child.isContribution()) {
                const fulfilled = await child.getFulfilled();
                const shareOfParent = await child.getShareOfParent();
                fulfillmentSum += fulfilled * shareOfParent;
            }
        }
        
        return fulfillmentSum;
    }
    
    async getNonContributionChildrenFulfillment(): Promise<number> {
        const children = await this.getChildren();
        let fulfillmentSum = 0;
        
        for (const child of children) {
            if (!(await child.isContribution())) {
                const fulfilled = await child.getFulfilled();
                const shareOfParent = await child.getShareOfParent();
                fulfillmentSum += fulfilled * shareOfParent;
            }
        }
        
        return fulfillmentSum;
    }
    
    async getFulfilled(): Promise<number> {
        // Check if this is a contribution
        if (await this.isContribution()) {
          console.log(`  - Node is a contribution, fulfillment = 1.0 (regardless of children)`);
          return 1.0;
        }
    
        // For leaf nodes (no children)
        const children = await this.getChildren();
        if (children.size === 0) {
          console.log(`  - Leaf non-contribution node, fulfillment = 0.0`);
          return 0.0;
        }
        
        // If fulfillment was manually set and node has contributor children
        const manualFulfillment = await this.getManualFulfillment();
        const hasDirectContributionChild = await this.hasDirectContributionChild();
        
        if (manualFulfillment !== null && hasDirectContributionChild) {
          console.log(`  - Using manual fulfillment for node with contribution children`);
            
          // If we only have contributor children
            const hasNonContributionChild = await this.hasNonContributionChild();
            if (!hasNonContributionChild) {
                console.log(`  - Only has contribution children, using manual value: ${manualFulfillment}`);
                return manualFulfillment;
          }
          
          // For hybrid case: combine manual fulfillment for contributor children
          // with calculated fulfillment for non-contributor children
            const contributionChildrenWeight = await this.getContributionChildrenWeight();
            const nonContributionFulfillment = await this.getNonContributionChildrenFulfillment();
          
          const result = (
                manualFulfillment * contributionChildrenWeight +
            nonContributionFulfillment * (1 - contributionChildrenWeight)
          );
          
          console.log(`  - Hybrid node, result = ${result}`);
          console.log(`    - Contribution weight: ${contributionChildrenWeight}`);
          console.log(`    - Non-contribution fulfillment: ${nonContributionFulfillment}`);
          
          return result;
        }
        
        // Default case: calculate from all children
        let childrenFulfillment = 0;
        for (const child of children) {
            const fulfilled = await child.getFulfilled();
            const shareOfParent = await child.getShareOfParent();
            childrenFulfillment += fulfilled * shareOfParent;
        }
        
        console.log(`  - Default case, calculated from children: ${childrenFulfillment}`);
        return childrenFulfillment;
      }
      
    async getDesire(): Promise<number> {
        const fulfilled = await this.getFulfilled();
        return 1 - fulfilled;
    }
}

export class Contributor extends Recognition {
    constructor(path: string[]) {
        super(path);
    }
    
    // Override the asStream method to return ContributorStream
    override asStream(): ContributorStream {
        return new ContributorStream(this.path);
    }
    
    getCapacities(): GunNode<any> {
        return this.get('capacities');
    }
    
    getContributorIndex(): GunNode<any> {
        return this.get('contributorIndex');
    }
    
    /**
     * Calculate the recognition this contributor gives to a specific instance
     * Adapted from TreeNode's recognitionOf method
     * @param instance The Recognition instance to calculate recognition for
     * @returns A number representing the recognition value
     */
    async recognitionOf(instance: Recognition): Promise<number> {
        const fulfilled = await instance.getFulfilled();
        const weight = await instance.getShareOfRoot();
        const fulfillmentWeight = fulfilled * weight;
        const contributors = await instance.getContributors();
        const contributorCount = contributors.size;
        
        return contributorCount > 0
          ? fulfillmentWeight / contributorCount
          : fulfillmentWeight;
    }
    
    /**
     * Calculate this contributor's share of the general fulfillment 
     * for a specific instance type (another contributor)
     * @param otherContributor The contributor to calculate shares for
     * @returns The share value
     */
    async calculateShareOfGeneralFulfillment(otherContributor: Contributor): Promise<number> {
        // Equivalent to TreeNode.shareOfGeneralFulfillment(typeId)
        const contributorId = await otherContributor.getId();
        if (!contributorId) {
            return 0;
        }
        
        // Get all nodes that have this contributor
        const instances = await this.getInstancesWithContributor(otherContributor);
        
        if (instances.size === 0) {
            return 0;
        }
        
        // Calculate total fulfillment weight for all instances
        let totalFulfillmentWeight = 0;
        
        for (const instance of instances) {
            const recognition = await this.recognitionOf(instance);
            totalFulfillmentWeight += recognition;
        }
        
        // Get current shares
        const shares = await this.getSharesOfGeneralFulfillment();
        const currentShare = shares.get(otherContributor) || 0;
        
        // Normalize to prevent oscillation - smooth change over time
        // (similar to TreeNode implementation)
        const smoothingFactor = 0.3; // 30% new value, 70% old value
        return currentShare * (1 - smoothingFactor) + totalFulfillmentWeight * smoothingFactor;
    }
    
    /**
     * Find all Recognition instances that have a specific contributor
     * @param contributor The contributor to search for
     * @returns Set of Recognition instances
     */
    async getInstancesWithContributor(contributor: Contributor): Promise<Set<Recognition>> {
        // This would ideally use an index, but for now we'll implement a basic version
        const result = new Set<Recognition>();
        
        // Get the root node
        const root = this; // For contributors, this is typically a root node
        
        // Recursive function to search for instances with the contributor
        const searchNode = async (node: Recognition) => {
            // Check if this node has the contributor
            const nodeContributors = await node.getContributors();
            for (const nodeContributor of nodeContributors) {
                if (await nodeContributor.getId() === await contributor.getId()) {
                    result.add(node);
                    break;
                }
            }
            
            // Check children
            const children = await node.getChildren();
            for (const child of children) {
                await searchNode(child);
            }
        };
        
        // Start the search from the root
        await searchNode(root);
        
        return result;
    }
    
    /**
     * Get all shares of general fulfillment this contributor has calculated
     * @returns Map of contributors to their share values
     */
    async getSharesOfGeneralFulfillment(): Promise<Map<Contributor, number>> {
        const sharesMap = new Map<Contributor, number>();
        
        // Fetch the shares data from Gun and convert to a Map
        const data = await this.get('sharesOfGeneralFulfillment').once();
        
        if (data) {
            // Convert Gun data to a Map
            Object.keys(data).forEach(key => {
                if (key !== '_') { // Skip Gun metadata
                    const contributorPath = [...this.path, 'sharesOfGeneralFulfillment', key];
                    const contributor = new Contributor(contributorPath);
                    sharesMap.set(contributor, Number(data[key]) || 0);
                }
            });
        }
        
        return sharesMap;
    }
    
    /**
     * Set shares of general fulfillment for this contributor
     * @param sharesOfGeneralFulfillment Map of contributors to their share values
     */
    async setSharesOfGeneralFulfillment(sharesOfGeneralFulfillment: Map<Contributor, number>): Promise<void> {
        // Convert the Map to an object for Gun storage
        const sharesObj: Record<string, number> = {};
        
        // Process each entry in the map
        for (const [contributor, share] of sharesOfGeneralFulfillment.entries()) {
            const contributorId = await contributor.getId();
            if (contributorId) {
                // Extract just the ID part from the path
                const contributorKey = contributorId.split('/').pop();
                if (contributorKey) {
                    sharesObj[contributorKey] = share;
                }
            }
        }
        
        // Save to Gun
        this.put({ sharesOfGeneralFulfillment: sharesObj });
    }
    
    /**
     * Update shares of general fulfillment for all known contributors
     * Similar to TreeNode's calculateShares method
     * @returns The updated shares map
     */
    async updateSharesOfGeneralFulfillment(): Promise<Map<Contributor, number>> {
        // Get the current shares
        const currentShares = await this.getSharesOfGeneralFulfillment();
        const updatedShares = new Map<Contributor, number>();
        
        // Get all known contributors
        const contributorIndex = await this.getContributorIndex().once();
        
        if (contributorIndex) {
            // Process each contributor
            for (const key in contributorIndex) {
                if (key !== '_') { // Skip Gun metadata
                    const contributorPath = [...this.path, 'contributorIndex', key];
                    const contributor = new Contributor(contributorPath);
                    
                    // Calculate the share for this contributor
                    const share = await this.calculateShareOfGeneralFulfillment(contributor);
                    updatedShares.set(contributor, share);
                }
            }
            
            // Save the updated shares
            await this.setSharesOfGeneralFulfillment(updatedShares);
        }
        
        return updatedShares;
    }
    
    /**
     * Calculate mutual recognition between this contributor and another
     * Equivalent to TreeNode's mutualFulfillment method
     * @param otherContributor The contributor to calculate mutual recognition with
     * @returns The mutual recognition value
     */
    async mutualRecognition(otherContributor: Contributor): Promise<Proportion> {
        const myShares = await this.getSharesOfGeneralFulfillment();
        const theirShares = await otherContributor.getSharesOfGeneralFulfillment();
        
        // Find this contributor in their shares
        let myShareInTheirs = 0;
        for (const [contributor, share] of theirShares.entries()) {
            if (await contributor.getId() === await this.getId()) {
                myShareInTheirs = share;
                break;
            }
        }
        
        // Find them in my shares
        let theirShareInMine = 0;
        for (const [contributor, share] of myShares.entries()) {
            if (await contributor.getId() === await otherContributor.getId()) {
                theirShareInMine = share;
                break;
            }
        }
        
        // Mutual recognition is the minimum of the two values
        const mutualRecognition = Math.min(myShareInTheirs, theirShareInMine);
        return asProportion(mutualRecognition);
    }
    
    /**
     * Calculate and return a distribution map of mutual recognition
     * @param depth How many levels of distribution to calculate
     * @returns A distribution map of contributors to their mutual recognition values
     */
    async getMutualRecognitionDistribution(depth: number = 1): Promise<DistributionMap<Contributor>> {
        let distribution = new DistributionMap<Contributor>();
        
        // Get the contributor index
        const contributorIndex = await this.getContributorIndex().once();
        
        if (contributorIndex) {
            // Calculate mutual recognition for each contributor
            for (const key in contributorIndex) {
                if (key !== '_') { // Skip Gun metadata
                    const contributorPath = [...this.path, 'contributorIndex', key];
                    const contributor = new Contributor(contributorPath);
                    
                    // Calculate mutual recognition and add to distribution
                    const mutualRec = await this.mutualRecognition(contributor);
                    distribution.set(contributor, mutualRec);
                }
            }
        }
        
        // Store in social distributions at the specified depth
        let socialDistributions = await this.getSocialDistributions();
        socialDistributions.set(depth, distribution);
        await this.setSocialDistributions(socialDistributions);
        
        return distribution;
    }
    
    /**
     * Calculate mutual distribution for a specific depth
     * @param depth The level of social distribution to calculate
     * @returns The social distribution for the specified depth
     */
    async calculateSocialDistribution(depth: number = 1): Promise<DistributionMap<Contributor>> {
        if (depth <= 0) {
            throw new Error('Depth must be a positive number');
        }
        
        // For depth 1, use direct mutual recognition
        if (depth === 1) {
            return this.getMutualRecognitionDistribution(1);
        }
        
        // For deeper levels, use the cumulative distribution approach
        let previousDistribution = await this.getSocialDistribution(depth - 1);
        if (!previousDistribution) {
            // Calculate the previous level if it doesn't exist
            previousDistribution = await this.calculateSocialDistribution(depth - 1);
        }
        
        const newDistribution = new DistributionMap<Contributor>();
        
        // For each contributor in the previous distribution
        for (const [contributor, weight] of previousDistribution.entries()) {
            // Get their mutual recognition distribution
            const contributorDistribution = await contributor.getMutualRecognitionDistribution(1);
            
            // Add their distribution, weighted by their value in the previous distribution
            for (const [subContributor, subWeight] of contributorDistribution.entries()) {
                // The weight is the product of the weights
                const currentWeight = newDistribution.get(subContributor) || 0;
                newDistribution.set(subContributor, currentWeight + weight * subWeight);
            }
        }
        
        // Store in social distributions
        let socialDistributions = await this.getSocialDistributions();
        socialDistributions.set(depth, newDistribution);
        await this.setSocialDistributions(socialDistributions);
        
        return newDistribution;
    }
    
    /**
     * Get all social distributions
     * @returns Map of depth levels to distribution maps
     */
    async getSocialDistributions(): Promise<Map<number, DistributionMap<Contributor>>> {
        const socialDistributions = new Map<number, DistributionMap<Contributor>>();
        
        // Fetch the social distributions data
        const data = await this.get('socialDistributions').once();
        
        if (data) {
            // Convert Gun data to a Map<number, DistributionMap>
            Object.keys(data).forEach(depthKey => {
                if (depthKey !== '_') { // Skip Gun metadata
                    const depth = Number(depthKey);
                    const distData = data[depthKey];
                    
                    // Create a DistributionMap for this depth
                    const distMap = new DistributionMap<Contributor>();
                    
                    // Populate the distribution map
                    Object.keys(distData).forEach(contribKey => {
                        if (contribKey !== '_') { // Skip Gun metadata
                            const contribPath = [...this.path, 'socialDistributions', depthKey, contribKey];
                            const contributor = new Contributor(contribPath);
                            // Use the number directly - asProportion will handle the conversion
                            distMap.set(contributor, Number(distData[contribKey]) || 0);
                        }
                    });
                    
                    socialDistributions.set(depth, distMap);
                }
            });
        }
        
        return socialDistributions;
    }
    
    /**
     * Get a specific social distribution by depth
     * @param depth The depth level to retrieve
     * @returns The distribution map for the specified depth
     */
    async getSocialDistribution(depth: number = 1): Promise<DistributionMap<Contributor>> {
        const distributions = await this.getSocialDistributions();
        return distributions.get(depth) || new DistributionMap<Contributor>();
    }
    
    /**
     * Save social distributions to Gun
     * @param socialDistributions Map of depth levels to distribution maps
     */
    async setSocialDistributions(socialDistributions: Map<number, DistributionMap<Contributor>>): Promise<void> {
        // Convert Map<number, DistributionMap> to a Gun-friendly object
        const distribObj: Record<string, Record<string, number>> = {};
        
        // Process each depth level
        for (const [depth, distribution] of socialDistributions.entries()) {
            distribObj[depth.toString()] = {};
            
            // Process each contributor in the distribution
            for (const [contributor, value] of distribution.entries()) {
                const contributorId = await contributor.getId();
                if (contributorId) {
                    // Extract just the ID part from the path
                    const contributorKey = contributorId.split('/').pop();
                    if (contributorKey) {
                        distribObj[depth.toString()][contributorKey] = value;
                    }
                }
            }
        }
        
        // Save to Gun
        this.put({ socialDistributions: distribObj });
    }
}


export class CapacityNode extends Oxel {
    constructor(path: string[]) {
        super(path);
    }
    
    getProvider(): GunNode<any> {
        return this.get('provider');
    }
    
    setProvider(provider: GunNode<any>): void {
        this.put({ provider: provider.getChain() });
    }
    
    async getUnit(): Promise<string> {
        return this.get('unit').once().then(unit => String(unit || ''));
    }
    
    setUnit(unit: string): void {
        this.put({ unit });
    }
    
    async getAmount(): Promise<number> {
        return this.get('amount').once().then(amount => Number(amount || 0));
    }
    
    setAmount(amount: number): void {
        this.put({ amount });
    }
    
    async getDepth(): Promise<number> {
        return this.get('depth').once().then(depth => Number(depth || 0));
    }
    
    setDepth(depth: number): void {
        this.put({ depth });
    }
    
    async getShareDistribution(): Promise<any> {
        return this.get('shareDistribution').once();
    }
    
    setShareDistribution(shareDistribution: any): void {
        this.put({ shareDistribution });
    }
    
    async getDerivedShareDistribution(): Promise<any> {
        return this.get('derivedShareDistribution').once();
    }
    
    setDerivedShareDistribution(derivedShareDistribution: any): void {
        this.put({ derivedShareDistribution });
    }
}

/**
 * Helper class for accessing nodes within a specific app scope
 */
export class DatabaseAccess {
    private static instance: DatabaseAccess;
    private appScope: string;
    
    private constructor(appScope: string = 'free-association') {
        this.appScope = appScope;
    }
    
    /**
     * Get the singleton instance
     * @param appScope Optional app scope (namespace)
     * @returns The DatabaseAccess instance
     */
    public static getInstance(appScope?: string): DatabaseAccess {
        if (!DatabaseAccess.instance) {
            DatabaseAccess.instance = new DatabaseAccess(appScope);
        }
        return DatabaseAccess.instance;
    }
    
    /**
     * Get a Recognition node at the specified path
     * @param path Path segments after the app scope
     * @returns A Recognition instance
     */
    public getRecognition(...path: string[]): Recognition {
        return new Recognition([this.appScope, ...path]);
    }
    
    /**
     * Get a Contributor node at the specified path
     * @param path Path segments after the app scope
     * @returns A Contributor instance
     */
    public getContributor(...path: string[]): Contributor {
        return new Contributor([this.appScope, ...path]);
    }
    
    /**
     * Get a stream-ready Recognition node at the specified path
     * @param path Path segments after the app scope
     * @returns A RecognitionStream instance
     */
    public getRecognitionStream(...path: string[]): RecognitionStream {
        return new RecognitionStream([this.appScope, ...path]);
    }
    
    /**
     * Get a stream-ready Contributor node at the specified path
     * @param path Path segments after the app scope
     * @returns A ContributorStream instance
     */
    public getContributorStream(...path: string[]): ContributorStream {
        return new ContributorStream([this.appScope, ...path]);
    }
    
    /**
     * Create a Svelte store for the specified path and property
     * @param property Property name to create a store for
     * @param path Path segments after the app scope
     * @returns A Svelte-compatible store
     */
    public createStore<T>(property: string, ...path: string[]) {
        return this.getRecognitionStream(...path).propertyStore<T>(property);
    }
}
