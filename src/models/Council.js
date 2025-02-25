// Councils
// Councils elect and send rotating revokable delegates with mandates representing their interests/needs to other councils of which they are a member. The decisions of the target-councils (target-council) are binding to its' member-councils, to not accept/follow the decision is to revoke membership (the target-council can vote to revoke membership).

// internal-membership criteria of source-councilshould be approved by the target-council in order to accept the number of members that the mandate carries as voting power within the council.
	
// Proposals should be processed in the Council.
// Gathering support from delegates, once a quorum is reached, the proposal is passed.
// the weight of a delegates support should = delegate.mandate.supporters.length
// the quorum should be 50% of the total voting power of the council.

// The proposal system should include sending a delegate! 
// As well as approving the validity of the mandate.supporters.length

// A council can send only one delegate/mandate to another council.

// Improvements:
// list of supporters should be the supporters of the proposal (should be auto-approved via voting)

// verbal-processes -> everything is recorded. Share of speech-time = share of votingPower.
// verbal-processes are sent with the mandate!

// controllers can be sent to enforce the decisions of the soviet.

// optional observer from the local-council. to ensure the voter votes according to their mandate! For immediate revokation!
// the representative who comes back to the local-council, secretary, and observer, reveal he hasnt enforced the mandate, and we take a vote: is he revoked?
// how? observer view :: from the council-view, live-updates.

// signal violation! of Mandate! Enought support for violation, leads to automatic proposal for revokation!

// mandate is a list of desires.

// proposal is a Map of entities (councils) -> actions to be taken! (description, method call)

// a mandate is in a sense a proposal that is already approved.

/*

Here's an explanation of the system in its own terms:

The system we've built is a flexible framework for coordinated decision-making across interconnected autonomous groups. At its core, it enables groups (councils) to make decisions that affect both their internal operations and their relationships with other groups, while maintaining clear lines of accountability and democratic control.

Each council operates through a system of proposals and delegates. Proposals are structured decisions that can specify actions to be taken by one or multiple councils. These actions, once approved, can execute specific methods or trigger changes across the system. The brilliant part is that delegation itself works through this same proposal mechanism - when a council needs to interact with another council, they do so by first creating a proposal (mandate) that specifies who will represent them and what their scope of authority will be.

The delegate system is particularly innovative because it maintains continuous democratic legitimacy. A delegate's voting power in their target council is directly tied to the ongoing support for their mandate-proposal in their source council. This creates a dynamic system where authority is never truly transferred but rather continuously validated by active support. If support for a delegate's mandate changes, their voting power adjusts automatically, ensuring they always accurately represent their current base of support.

The system also handles inter-council relationships elegantly. When a council makes a decision that affects its member councils, it can specify different actions for different councils within a single proposal. The system then tracks whether member councils accept and implement these decisions, providing a mechanism for maintaining coordination while respecting autonomy. Councils that consistently reject decisions may have their membership relationship reviewed, ensuring that the network of councils maintains coherence in its decision-making.

What makes this system powerful is its unification of concepts. Everything flows through the proposal mechanism - from simple decisions to delegate election to inter-council coordination. This creates a system that is both simple to understand and flexible enough to handle complex organizational needs. The use of modern programming concepts like private fields, revocable proxies, and async iterators ensures that the system is secure, maintainable, and capable of handling real-world complexity while maintaining its conceptual clarity.

*/

// TODO: secure the Council class's properties from being accessed improperly!
// TODO: make better bootstrapping.
// TODO: add a method to delete proposals! Or to hide them from the UI!

class Delegate {
    constructor(name, mandate, from, to) {
        this.name = name;
        this.mandate = mandate;
        this.from = from;
        this.to = to;
    }

    propose(description, actions = new Map()) {
        this.to.addProposal(description, actions);
    }

    // Cast a vote on a proposal
    castVote(proposal, decision) {
        const weight = this.mandate.supporters.length;
        console.log(`${this.name} votes ${decision} on proposal: ${proposal.description} with weight ${weight}`);
        this.to.castVote(this, proposal, decision);
    }
}


class Proposal {
    constructor(description) {
        this.description = description;
        this.votes = new Map(); // Store delegate/member references and their vote
        this.actions = new Map(); // Map of council -> { description, methodName, methodArgs }
    }

    // Add an action for a specific council
    addAction(council, description, methodName = null, methodArgs = []) {
        // Store using the council directly (it's already a proxy)
        this.actions.set(council, {
            description,
            methodName,
            methodArgs
        });
    }

    // Cast a vote on the proposal
    castVote(voter, vote) {
        this.votes.set(voter, vote);
    }

    // Get current vote totals, calculating weights appropriately
    getCurrentVotes() {
        let yes = 0;
        let no = 0;
        
        this.votes.forEach((vote, voter) => {
            // If voter is a delegate, use mandate supporters length
            const weight = voter.mandate ? voter.mandate.supporters.length : 1;
            
            if (vote === 'yes') {
                yes += weight;
            } else if (vote === 'no') {
                no += weight;
            }
        });

        return { yes, no };
    }

    // Get actions for a specific council
    getActionsForCouncil(council) {
        // Debug the lookup
        console.log('Looking up actions for:', council);
        console.log('Available actions:', Array.from(this.actions.entries()));
        
        // Use direct council reference (it's already a proxy)
        const action = this.actions.get(council);
        return action;
    }

    // Get all actions
    get allActions() {
        return Array.from(this.actions.entries()).map(([council, action]) => ({
            council: council.name,
            ...action
        }));
    }

    get supporters() {
        return Array.from(this.votes.entries())
            .filter(([voter, vote]) => vote === 'yes')
            .map(([voter, _]) => voter);
    }
}

class Member {
    constructor(name, council) {
        this.name = name;
        this.council = council;
    }

    castVote(proposal, decision) {
        console.log(`${this.name} votes ${decision} on proposal: ${proposal.description}`);
        this.council.castVote(this, proposal, decision);
    }
}


// we are going to want to protect the methods from being executed improperly!
class Council {
    #name;
    #members = [];  // Can hold both individual members and councils
    #delegates = [];
    #proposals = [];
    #pendingResponses = new Map();

    constructor(name) {
        this.#name = name;
        this.proxyRef = null
    }

    // Bootstrap method - only available during initialization
    bootstrap() {
        return {
            addMember: (memberName) => {
                const member = new Member(memberName, this.proxyRef);
                this.#members.push(member);
                console.log(`Bootstrapped member ${member.name} added to ${this.#name}`);
                return member;
            },
            addMethod: (methodName, method) => {
                this[methodName] = method;
                console.log(`Bootstrapped method ${methodName} added to ${this.#name}`);
                return this.proxyRef;  // Return proxy instead of 'this'
            }
        };
    }

    // Regular methods remain private/controlled
    get name() {
        return this.#name;
    }

    get members() {
        return [...this.#members];
    }

    // Getter for delegates - returns a copy of the delegates array
    get delegates() {
        console.log('Getting delegates:', this.#delegates);
        return this.#delegates.map(delegate => delegate.proxy);
    }

    // Getter for proposals - returns a copy of the proposals array
    get proposals() {
        // Return the actual proposal objects instead of spreading them
        return [...this.#proposals];
    }

    addProposal(description, actions = new Map()) {
        console.log('Adding proposal with actions:', actions);
        const proposal = new Proposal(description);
        
        // Add actions from the map
        actions.forEach((action, council) => {
            console.log(`Adding action for council ${council.name}:`, action);
            proposal.addAction(council, action.description, action.methodName, action.methodArgs);
        });

        this.#proposals.push(proposal);
        //console.log(`Proposal "${description}" added to ${this.#name}`);
        return proposal;
    }

    castVote(voter, proposal, decision) {
        // Check if voter is a direct member or a delegate from a member
        const isDirectMember = this.#members.includes(voter);
        const isDelegateFromMemberCouncil = voter.mandate && 
            this.#members.includes(voter.from);

        if (!isDirectMember && !isDelegateFromMemberCouncil) {
            console.log(`${voter.name} is not a member or delegate from a member of ${this.#name}`);
            return;
        }

        // Use the proposal's castVote method
        proposal.castVote(voter, decision);
        console.log(`${voter.name} votes ${decision} on proposal: ${proposal.description}`);
    }

    addMember(member) {
        this.#members.push(member);
    }

    electDelegate(delegateName, mandateDescription, targetCouncil) {
        console.log('Starting electDelegate method');
        const existingDelegate = this.#delegates.find(d => d.proxy.to === targetCouncil);
        if (existingDelegate) {
            console.log(`A delegate already exists for ${targetCouncil.name}. Cannot send another delegate.`);
            return;
        }

        // Find the mandate proposal
        const mandate = this.#proposals.find(p => p.description === mandateDescription);
        if (!mandate) {
            console.log(`No mandate proposal found with description: ${mandateDescription}`);
            return;
        }

        console.log('Using mandate proposal:', mandate);
        
        const { proxy: mandateProxy, revoke: revokeMandate } = Proxy.revocable(mandate, {});
        const delegate = new Delegate(delegateName, mandateProxy, this.proxyRef, targetCouncil);
        
        console.log('Delegate created:', delegate);

        const { proxy: delegateProxy, revoke: revokeDelegate } = Proxy.revocable(delegate, {});
        
        console.log('Current delegates before push:', this.#delegates);
        this.#delegates.push({ proxy: delegateProxy, revoke: revokeDelegate });
        console.log('Current delegates after push:', this.#delegates);

        console.log(`Delegate ${delegateProxy.name} created and added to ${this.#name}`);
        return delegateProxy;
    }

    withdrawDelegate(delegateProxy) {
        const delegateEntry = this.#delegates.find(d => d.proxy === delegateProxy);
        if (delegateEntry) {
            delegateEntry.revoke();
            this.#delegates = this.#delegates.filter(d => d.proxy !== delegateProxy);
            console.log(`${delegateProxy.name} with mandate "${delegateProxy.mandate.description}" has been revoked from ${this.#name}`);
            delegateProxy.to.removeDelegate(delegateProxy);
        }
    }

    substituteDelegate(delegateProxy, newDelegateName, newMandateDescription) {
        const delegateEntry = this.#delegates.find(d => d.proxy === delegateProxy);
        if (delegateEntry) {
            delegateEntry.revoke();
            const newMandate = new Proposal(newMandateDescription);
            const { proxy: newMandateProxy, revoke: revokeNewMandate } = Proxy.revocable(newMandate, {});
            const newDelegate = new Delegate(newDelegateName, newMandateProxy, this.proxyRef, delegateProxy.to);
            const { proxy: newDelegateProxy, revoke: revokeNewDelegate } = Proxy.revocable(newDelegate, {});

            this.#delegates = this.#delegates.map(d => d.proxy === delegateProxy ? { proxy: newDelegateProxy, revoke: revokeNewDelegate } : d);
            console.log(`${delegateProxy.name} with mandate "${delegateProxy.mandate.description}" has been replaced by ${newDelegate.name} with mandate "${newDelegate.mandate.description}" in ${this.#name}`);
            delegateProxy.to.removeDelegate(delegateProxy);

            this.mandates = this.mandates.map(m => m.proxy === delegateProxy.mandate ? { proxy: newMandateProxy, revoke: revokeNewMandate } : m);
        }
    }

    revokeMandate(mandateProxy) {
        const mandateEntry = this.mandates.find(m => m.proxy === mandateProxy);
        if (mandateEntry) {
            mandateEntry.revoke();
            console.log(`Mandate "${mandateProxy.description}" has been revoked from ${this.#name}`);
        }
    }

    removeDelegate(delegate) {
        this.#delegates = this.#delegates.filter(d => d !== delegate);
        console.log(`${delegate.name} has been removed from ${this.#name}`);
    }

    // Execute the method on the council if the proposal is approved
    #execute(proposal) {
        const actions = proposal.getActionsForCouncil(this.proxyRef);
        console.log('Executing proposal with actions:', actions);
        console.log('Available methods on council:', Object.getOwnPropertyNames(this));
        console.log('Looking for method:', actions?.methodName);
        
        if (actions && actions.methodName && typeof this[actions.methodName] === 'function') {
            console.log(`Executing method ${actions.methodName} on ${this.#name}`);
            this[actions.methodName](...actions.methodArgs);
        } else {
            console.log(`No valid method to execute for proposal: ${proposal.description}`);
            if (actions) {
                console.log('Action exists but method not found. Action details:', {
                    methodName: actions.methodName,
                    methodExists: typeof this[actions.methodName],
                    methodArgs: actions.methodArgs
                });
            } else {
                console.log('No actions found for this council');
            }
        }
    }

    // Method to check member council responses
    async checkMemberResponses() {
        const responseStatus = [];
        
        for (const [council, proposals] of this.#pendingResponses) {
            for (const [description, proposal] of proposals) {
                const status = {
                    council: council.name,
                    proposal: description,
                    accepted: proposal.isApproved,
                    completed: proposal.isComplete
                };
                responseStatus.push(status);
                
                // If proposal is complete and was rejected, consider revoking membership
                if (status.completed && !status.accepted) {
                    //console.log(`Warning: ${council.name} rejected proposal "${description}"`);
                    // Could trigger membership review process
                }
            }
        }
        
        return responseStatus;
    }

    // Revoke membership of a council
    revokeMembership(council) {
        this.#members = this.#members.filter(c => c !== council);
        console.log(`${council.name} has been revoked from ${this.#name}`);
    }

    addMethod(methodName, method) {
        this[methodName] = method;
    }

    // Update voting power calculations
    get memberVotingPower() {
        return this.#members.reduce((sum, member) => {
            // If member is a council, count its members
            if (member instanceof Council) {
                return sum + member.memberVotingPower;
            }
            // If individual member, count as 1
            return sum + 1;
        }, 0);
    }
    
    async *processProposals() {
        for (const proposal of this.#proposals) {
            const currentVotes = proposal.getCurrentVotes();
            
            // Calculate total voting power from both delegates and regular members
            const delegateVotingPower = this.#delegates
                .reduce((sum, delegate) => {
                    return sum + (delegate.proxy.mandate.supporters?.length || 0);
                }, 0);
                
            const memberVotingPower = this.#members.length;
            const totalVotingPower = delegateVotingPower + memberVotingPower;
            
            const quorum = totalVotingPower * 0.5;

            const status = {
                proposal: proposal,  // Pass the entire proposal object
                description: proposal.description,
                votes: currentVotes,
                totalVotingPower,
                quorum,
                isApproved: currentVotes.yes >= quorum
            };

            yield status;

            if (status.isApproved) {
                //console.log(`Proposal "${status.proposal.description}" is approved.`);
                this.#execute(status.proposal);  // Execute the approved proposal's actions
                
                // Send to member councils and track their responses
                const memberProposals = await Promise.all(this.#members
                    .filter(member => member instanceof Council)  // Only process council members
                    .map(async member => {
                        const actions = status.proposal.getActionsForCouncil(member.proxyRef);
                        if (actions) {
                            const memberProposal = await member.addProposal(
                                status.proposal.description,
                                new Map([[member, actions]])
                            );
                            return { council: member, proposal: memberProposal };
                        }
                        return null;
                    }));

                // Store references to track responses
                memberProposals.filter(Boolean).forEach(({ council, proposal }) => {
                    if (!this.#pendingResponses.has(council)) {
                        this.#pendingResponses.set(council, new Map());
                    }
                    this.#pendingResponses.get(council).set(proposal.description, proposal);
                });
            } else {
                //console.log(`Proposal "${status.proposal.description}" is not approved.`);
            }
        }
    }

    getMethods() {
        // Get all methods from the prototype
        const prototypeMethods = Object.getOwnPropertyNames(Council.prototype)
            .filter(prop => prop !== 'constructor')
            .filter(prop => typeof Council.prototype[prop] === 'function');

        // Get all methods directly on the instance
        const instanceMethods = Object.getOwnPropertyNames(this)
            .filter(prop => typeof this[prop] === 'function');

        // Combine and deduplicate
        return [...new Set([...prototypeMethods, ...instanceMethods])];
    }
}

function createCouncil(name) {
    const council = new Council(name);
    
    // Define allowed public methods/properties
    const publicInterface = new Set([
        'name',
        'members',
        'delegates',
        'proposals',
        'addProposal',
        'castVote',
        'bootstrap',
        'processProposals',
        'getMethods'
    ]);

    // Define properties that should be accessed directly (not bound)
    const directProperties = new Set([
        'name',
        'members',
        'delegates',
        'proposals',
        'isExecutingProposal'
    ]);

        // Store the proxy reference to return from internal methods
        const proxy = new Proxy(council, {
            get(target, prop, receiver) {
                // Handle symbol properties
                if (typeof prop === 'symbol') {
                    return Reflect.get(target, prop, receiver);
                }
    
                // Direct properties should be returned without binding
                if (directProperties.has(prop)) {
                    return target[prop];
                }
    
                // Public interface methods need binding
                if (publicInterface.has(prop)) {
                    const value = target[prop];
                    // For methods that return council references, ensure we return the proxy
                    if (typeof value === 'function') {
                        return function(...args) {
                            const result = value.apply(target, args);
                            // If result is the council itself, return the proxy instead
                            return result === target ? proxy : result;
                        };
                    }
                    return value;
                }
    
                // During proposal execution, allow access to ANY method
                if (target.isExecutingProposal) {
                    const value = target[prop];
                    if (typeof value === 'function') {
                        return function(...args) {
                            const result = value.apply(target, args);
                            // If result is the council itself, return the proxy instead
                            return result === target ? proxy : result;
                        };
                    }
                    return value;
                }
    
                console.log(`Attempted to access restricted method/property: ${String(prop)}`);
                return undefined;
            }
        });
    
        // Modify the council to use its proxy reference
        council.proxyRef = proxy;
        
        return proxy;
    }
    
// Example usage demonstrating the full flow of the system
async function main() {
    // Create councils
    const councilA = createCouncil('Council A');
    const councilB = createCouncil('Council B');

    // Bootstrap phase
    const bootstrapA = councilA.bootstrap();
    const member1 = bootstrapA.addMember('Member 1');
    const member2 = bootstrapA.addMember('Member 2');
    bootstrapA.addMethod('increaseFunding', function(amount) {
        console.log(`${this.name} increasing funding by ${amount}`);
    });

    const bootstrapB = councilB.bootstrap();
    bootstrapB.addMethod('acceptFunding', function(amount) {
        console.log(`${this.name} accepting funding of ${amount}`);
    });

    // After bootstrap, continue with normal operation
    const mandateDescription = 'Negotiate trade agreement with Council B';
    const mandateActions = new Map();
    mandateActions.set(councilA, {
        description: 'Elect delegate with negotiation powers',
        methodName: 'electDelegate',
        methodArgs: ['Ruzgar', mandateDescription, councilB]
    });

    // Create and add the mandate proposal
    const mandateProposal = councilA.addProposal(mandateDescription, mandateActions);

    // Members vote on the mandate
    member1.castVote(mandateProposal, 'yes');
    member2.castVote(mandateProposal, 'yes');

    // First, process the mandate proposal to create the delegate
    let delegate = null;
    for await (const status of councilA.processProposals()) {
        console.log('Proposal status:', status);
        if (status.isApproved) {
            //console.log(`Mandate proposal "${status.proposal.description}" is approved.`);
            // Let the processProposals method handle the execution
            // The delegate will be created after this iteration
        }
    }

    // Now that the delegate is created, we can get it and use it
    const delegates = councilA.delegates;
    console.log('Available delegates after mandate approval:', delegates);
    
    if (delegates.length > 0) {
        delegate = delegates[0];
        console.log('Selected delegate:', delegate);

        // Delegate proposes action in Council B
        const proposalActions = new Map();
        proposalActions.set(councilA, {
            description: 'Increase funding for public works',
            methodName: 'increaseFunding',
            methodArgs: [1000]
        });
        proposalActions.set(councilB, {
            description: 'Accept funding increase',
            methodName: 'acceptFunding',
            methodArgs: [1000]
        });

        delegate.propose('Inter-council funding proposal', proposalActions);
    } else {
        console.log('No delegates available after mandate approval');
    }
}

// Run the main function
main().catch(console.error);

async function testVotingScenarios() {
    console.log('=== Testing Voting Scenarios ===');

    // Test Case 1: Simple Majority
    console.log('\nTest Case 1: Simple Majority');
    const councilA = createCouncil('Council A');
    const bootstrapA = councilA.bootstrap();
    const member1 = bootstrapA.addMember('Member 1');
    const member2 = bootstrapA.addMember('Member 2');
    
    const proposal1 = councilA.addProposal('Simple majority test');
    member1.castVote(proposal1, 'yes');
    member2.castVote(proposal1, 'no');
    
    for await (const status of councilA.processProposals()) {
        console.log('Status:', status);
    }

    // Test Case 2: Unanimous Approval
    console.log('\nTest Case 2: Unanimous Approval');
    const councilB = createCouncil('Council B');
    const bootstrapB = councilB.bootstrap();
    const memberB1 = bootstrapB.addMember('Member B1');
    const memberB2 = bootstrapB.addMember('Member B2');
    const memberB3 = bootstrapB.addMember('Member B3');
    
    const proposal2 = councilB.addProposal('Unanimous test');
    memberB1.castVote(proposal2, 'yes');
    memberB2.castVote(proposal2, 'yes');
    memberB3.castVote(proposal2, 'yes');
    
    for await (const status of councilB.processProposals()) {
        console.log('Status:', status);
    }

    // Test Case 3: Mixed Delegate and Member Voting
    console.log('\nTest Case 3: Mixed Delegate and Member Voting');
    const councilC = createCouncil('Council C');
    const councilD = createCouncil('Council D');

    // Bootstrap both councils
    const bootstrapC = councilC.bootstrap();
    const bootstrapD = councilD.bootstrap();
    bootstrapC.addMethod('testMethod', function() {
        console.log('Test method called in Council C');
    });
    bootstrapD.addMethod('testMethod', function() {
        console.log('Test method called in Council D');
    });

    // First establish that Council C is a member of Council D
    const membershipProposal = councilD.addProposal('Accept Council C as member', new Map([
        [councilD, {
            description: 'Add Council C as member',
            methodName: 'addMember',
            methodArgs: [councilC]
        }]
    ]));

    // Vote on membership
    const memberD1 = bootstrapD.addMember('Member D1');
    memberD1.castVote(membershipProposal, 'yes');

    // Process membership proposal
    for await (const status of councilD.processProposals()) {
        console.log('Membership Status:', status);
    }

    // Now continue with delegate election...

    // Test Case 4: Below Quorum
    console.log('\nTest Case 4: Below Quorum');
    const councilE = createCouncil('Council E');
    const bootstrapE = councilE.bootstrap();
    const memberE1 = bootstrapE.addMember('Member E1');
    const memberE2 = bootstrapE.addMember('Member E2');
    const memberE3 = bootstrapE.addMember('Member E3');
    
    const proposal4 = councilE.addProposal('Below quorum test');
    memberE1.castVote(proposal4, 'yes');  // Only one vote out of three members
    
    for await (const status of councilE.processProposals()) {
        console.log('Status:', status);
    }
}

// Run the tests
testVotingScenarios().catch(console.error);

export { createCouncil };