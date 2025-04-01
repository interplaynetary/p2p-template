# Reactive Gun Implementation

This implementation follows the principles laid out in the Gun guide and the "5 Things I Wish I Had Known" article, focusing on reactive data handling and proper abstractions.

## Alignment with Gun Recommendations

### From Guide.md:
1. **Treating Data as Streams**: Our implementation embraces the streaming nature of Gun by consistently using subscriptions for all data access.
2. **Proper Subscription Management**: We provide robust cleanup for all subscriptions to prevent memory leaks.
3. **Avoiding Promise Pitfalls**: Added timeout protection and error handling to prevent hanging Promises.
4. **Wrapper Classes**: Created clean abstractions that hide Gun complexity.
5. **Proper Data Nesting**: Maintains the graph structure without serializing complex objects.

### From 5-Things.md:
1. **"Watch values. Don't read too much"**: Our implementation ensures all data flows reactively through subscriptions.
2. **"Create a gun-adapter / wrapper classes"**: GunNode provides a clean API that standardizes interactions.
3. **"Leverage node linking"**: Maintains proper graph structure for efficient traversal.
4. **"Use typescript"**: Full type safety throughout the implementation.
5. **"Wrap map in streams"**: Our GunSubscription class properly wraps map operations in streams with cleanup.

## Core Classes

### GunSubscription

A wrapper around Gun subscriptions with these key benefits:
- Uses ReadableStream for proper reactive data flow
- Handles subscription cleanup automatically
- Provides error handling and timeout protection
- Prevents data leaks by checking subscription status before emitting events
- Caches most recent values for new subscribers
- Allows mapping and iterating over collections
- **NEW**: Support for Svelte stores with the `toStore()` method
- **NEW**: Collection to object conversion with `asObject()`

### GunNode

A base class for working with Gun nodes that:
- Provides a consistent API for Gun operations
- Handles parameter cloning to prevent option mutation
- Exposes methods for reactive data handling
- Creates strongly typed access to Gun data
- Properly tracks paths for reliable navigation
- **NEW**: Direct Svelte store integration with `toStore()`
- **NEW**: Object access with `asObject()`

### TreeNodeReactive

A fully reactive implementation of the TreeNode model that:
- Treats all Gun data as reactive streams
- Maintains a minimalistic local cache that's driven by Gun data
- **IMPROVED**: All property setters now follow the streaming pattern - update Gun first, let subscriptions update local state
- **NEW**: Dedicated stores for properties and calculated values
- **NEW**: Streaming access to collections
- Proper handling of parent-child relationships
- Reactive propagation of type changes

## Key Improvements to Align with Gun Best Practices

1. **More Consistent Streaming Pattern**: Updates always go to Gun first, then flow through subscriptions to local state.

2. **Better Cache Handling**: Last values are cached for immediate delivery to new subscribers.

3. **Framework Integration**: Direct support for Svelte stores makes it easier to build reactive UIs.

4. **Calculated Property Reactivity**: Derived values update automatically when their dependencies change.

5. **Protection Against Race Conditions**: The system now properly handles concurrent updates.

## Usage Examples

```typescript
// Regular property access
const node = TreeNode.getNode('node-id', app);
console.log(node.name);  // Accessing cached value

// Reactive updates with Svelte
import { derived } from 'svelte/store';

// Get a store for the node's name
const nameStore = node.createPropertyStore('name');

// Get a store for a calculated property
const fulfillmentStore = node.getDerivedStore('fulfilled');

// Create a derived store combining multiple values
const combinedStore = derived(
  [nameStore, fulfillmentStore], 
  ([$name, $fulfilled]) => {
    return `${$name}: ${Math.round($fulfilled * 100)}% complete`;
  }
);

// Use in Svelte component
<h1>{$nameStore}</h1>
<div>Fulfillment: {$fulfillmentStore * 100}%</div>
<div>{$combinedStore}</div>
```

This implementation creates a more reliable, maintainable foundation for the Tree Model while maintaining compatibility with the existing API and more closely following Gun best practices. 