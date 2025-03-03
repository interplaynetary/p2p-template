# Readme
- [ ] Add intro on how this economy is based on gratitude! Recognize, feel, and act!
- [ ] Add examples
- [ ] Correspondance Truth : make commodity fetish etc more discreet, focus on subject, verb object correspondence.

# Code in General
- [ ] Make comprehensive tests!
- [ ] Make tests for all the edge cases!

# Treemap
- [x] Make text scale to fit
- [x] Descriptions on nodes
- [x] Make contributor instances last node (can't go further down in tree)
- [x] Make calculations more efficient? using contributor-map?
- [x] It should be clearly possible to make a node a contributor simply if it doesnt have a parent!
- [ ] Lets simplify isContributor logic!
- [ ] Lets simplify getShareOfGeneralContribution logic! And generalize to traversal of any note, default is general.
- [ ] Allow for distributing surplus to any branch
- [ ] shareOfGeneralRecognition view: the size of the squares of shareOfGeneralRecognition: is the **potential** mutual-recognition -> and **potential** share of surplus-distribution
- [ ] Create generic treemap for displaying:
    - [ ] shareOfGeneralFulfillment view: the size of the squares of shareOfGeneralRecognition: the fulfilled is what is recognized as actual!
    - [ ] One's share of surplus-distribution is based on one's share of one's mutual-self-actualization!
- [ ] Currently we see parent-children relationships. But lets also show type-parents-of-instances relationships!

# Node
- [ ] Are we properly accounting for the share of an instance in a node? (especially when it has multiple types which are contributors) (split the share of that instance between the types)?
- [ ] Make type-circles on nodes transition more smoothly
- [ ] recursive saves!
- [ ] Allow nodes to store space-time-data and even hyperlinks!

# Organizations
- [ ] Right now the code focuses on mutual-recognition between individuals. We should also allow for mutual-recognition between organizations! [resources/leafs.md](resources/leafs.md)
- [ ] Delegate a portion of your allocation-power within a category to others!

# P2P
- [x] Gun.js user-space
- [ ] add a way for nodes to be saved also in the public space! (so we can have shared-nodes in our trees)
- [ ] Gun.js add peers
- [ ] Peers as types!
- [ ] Add type indexing rebuilding


# Inventory & Associations
- [x] Add a button to distribute surplus (in general, or to a specific branch/leaf?)
- [ ] Integrate with inventory.html
- [ ] Make inventory.html more user-friendly

# Interface
- [ ] + Node button (big) (Import sub-treefrom Library)
- [ ] - Node button (big) (Drop sub-tree into Library)

- [ ] Make everything more smooth, with less sharp clicks!

- [ ] Allow for touching multiple nodes at once
- [ ] Allow for dragging nodes around
- [ ] Allow for composing nodes (dragging nodes to other nodes)
- [ ] Allow for changing speed of growth
- [ ] Allow for changing speed of growth
- [ ] Menubuttons instead of text for add value
- [ ] Distribute surplus to any branch
- [ ] AI Integration!
- [ ] Allow for choosing your own name!
- [ ] Allow adding multiple types/contributors to nodes
- [ ] How to unallocate points? (when points = 0, remove node)
- [ ] How to manually reorder them? (by dragging?)
- [ ] How do we show mutuality directly in the structure? (Showing max min and overlap? Of colors? Of self and other?)
- [ ] Add a new intermediary class? For networking / persistence?
- [ ] Add description to Nodes (and maybe other things?)
- [ ] node.makeContributor (retroactively) turns type into contributor
- [ ] Display Descriptions to Nodes if they exist! 
- [ ] Make contributor have special outline
- [ ] "Add Contributor" button should reveal tabs: known (including self), add new contributor (reveal QR of self to others)
- [ ] Clicking contributor makes it the new root?
    (so you can see the tree from their perspective)
    (but your perspective is retained (your perspective of their perspective))

/*
// NEW CODE: Check if this node has children
if (childData.childrenIds && typeof childData.childrenIds === 'object') {
    const grandchildIds = Object.keys(childData.childrenIds)
        .filter(id => id !== '_' && !loadedNodes.has(id));
    
    if (grandchildIds.length > 0) {
        console.log(`Node ${childData.name} has ${grandchildIds.length} children to load`);
        // Add these IDs to our list of nodes to load
        childIds.push(...grandchildIds);
    }
}

lodadedCount++
*/