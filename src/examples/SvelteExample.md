# Svelte Integration Examples

Here are some examples of how to use the Free-Association database with Svelte components.

## Basic Node Display

```svelte
<script>
  import { createNodeStore, createPropertyStore } from '../models/svelte-helpers';
  
  // Path to a recognition node
  const nodePath = ['nodes', 'example-123'];
  
  // Get a store for the entire node
  const nodeStore = createNodeStore(...nodePath);
  
  // Get stores for specific properties
  const nameStore = createPropertyStore('name', ...nodePath);
  const pointsStore = createPropertyStore('points', ...nodePath);
</script>

<div class="node-info">
  <!-- Access values with $ syntax -->
  <h3>{$nameStore || 'Loading...'}</h3>
  <p>Points: {$pointsStore || 0}</p>
  
  <!-- Use the entire node if needed -->
  {#if $nodeStore}
    <p>Data loaded: {JSON.stringify($nodeStore)}</p>
  {/if}
</div>
```

## Displaying Children

```svelte
<script>
  import { createChildrenListStore, isContributionStore, updateProperty } from '../models/svelte-helpers';
  
  // Path to parent node
  const parentPath = ['nodes', 'parent-456'];
  
  // Get a store of children as [id, node] pairs for easy iteration
  const childrenStore = createChildrenListStore(...parentPath);
  
  // Function to update a child's points
  function updatePoints(childId, points) {
    updateProperty(points, 'points', 'nodes', childId);
  }
</script>

<div class="children-list">
  <h3>Children</h3>
  
  {#if $childrenStore && $childrenStore.length > 0}
    <ul>
      {#each $childrenStore as [id, child]}
        <li>
          <!-- Check if the child is a contribution -->
          {@const isContribution = isContributionStore('nodes', id)}
          
          <strong>{child.name}</strong>
          <span class:contribution={$isContribution}>
            ({$isContribution ? 'Contribution' : 'Regular'})
          </span>
          
          <div class="points-control">
            <span>Points: {child.points || 0}</span>
            <button on:click={() => updatePoints(id, (child.points || 0) + 1)}>+</button>
            <button on:click={() => updatePoints(id, Math.max(0, (child.points || 0) - 1))}>-</button>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p>No children found</p>
  {/if}
</div>

<style>
  .contribution {
    color: green;
    font-weight: bold;
  }
  
  .points-control {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
</style>
```

## Fulfillment and Desire

```svelte
<script>
  import { createFulfillmentStore, createDesireStore } from '../models/svelte-helpers';
  
  // Path to a recognition node
  const nodePath = ['nodes', 'example-123'];
  
  // Get reactive fulfillment and desire values
  const fulfillmentStore = createFulfillmentStore(...nodePath);
  const desireStore = createDesireStore(...nodePath);
</script>

<div class="fulfillment-widget">
  <div class="progress-bar">
    <div class="progress" style="width: {($fulfillmentStore * 100).toFixed(1)}%"></div>
  </div>
  
  <div class="stats">
    <p>Fulfillment: {($fulfillmentStore * 100).toFixed(1)}%</p>
    <p>Desire: {($desireStore * 100).toFixed(1)}%</p>
  </div>
</div>

<style>
  .progress-bar {
    width: 100%;
    height: 20px;
    background-color: #eee;
    border-radius: 10px;
    overflow: hidden;
  }
  
  .progress {
    height: 100%;
    background-color: #4caf50;
    transition: width 0.3s ease;
  }
  
  .stats {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
  }
</style>
```

## Creating New Nodes

```svelte
<script>
  import { createRecognition, createNodeStore } from '../models/svelte-helpers';
  
  // Parent node path
  const parentPath = ['nodes', 'parent-456'];
  
  // Form state
  let name = '';
  let points = 0;
  let creating = false;
  let error = null;
  
  // Reactive parent store
  const parentStore = createNodeStore(...parentPath);
  
  async function createNode() {
    creating = true;
    error = null;
    
    try {
      const path = await createRecognition(name, points, parentPath);
      name = '';
      points = 0;
      console.log('Created node at:', path);
    } catch (err) {
      error = err.message;
      console.error('Error creating node:', err);
    } finally {
      creating = false;
    }
  }
</script>

<div class="create-form">
  <h3>Create under: {$parentStore?.name || 'Loading...'}</h3>
  
  <form on:submit|preventDefault={createNode}>
    <div class="form-field">
      <label for="name">Name:</label>
      <input id="name" bind:value={name} required />
    </div>
    
    <div class="form-field">
      <label for="points">Points:</label>
      <input id="points" type="number" bind:value={points} min="0" />
    </div>
    
    {#if error}
      <div class="error">{error}</div>
    {/if}
    
    <button type="submit" disabled={creating || !name}>
      {creating ? 'Creating...' : 'Create Node'}
    </button>
  </form>
</div>

<style>
  .create-form {
    border: 1px solid #ddd;
    padding: 1rem;
    border-radius: 4px;
    max-width: 400px;
  }
  
  .form-field {
    margin-bottom: 1rem;
  }
  
  .error {
    color: red;
    margin: 1rem 0;
  }
</style>
```

## Advanced: Combining Multiple Stores

```svelte
<script>
  import { createCombinedStore } from '../models/svelte-helpers';
  
  // Create a store that combines data from multiple sources
  const contributionRatioStore = createCombinedStore(
    // Combine function to calculate ratio
    (contributionPoints, nonContributionPoints) => {
      const total = contributionPoints + nonContributionPoints;
      return total > 0 ? contributionPoints / total : 0;
    },
    // Properties to combine
    {
      contributionPoints: { 
        property: 'contributionPoints', 
        path: ['metrics', 'contributions'] 
      },
      nonContributionPoints: { 
        property: 'nonContributionPoints', 
        path: ['metrics', 'regular'] 
      }
    }
  );
</script>

<div class="metric-display">
  <h3>Contribution Ratio</h3>
  <div class="ratio-display">
    <div class="ratio-bar">
      <div 
        class="ratio-indicator" 
        style="width: {($contributionRatioStore * 100).toFixed(1)}%"
      ></div>
    </div>
    <div class="ratio-value">
      {($contributionRatioStore * 100).toFixed(1)}%
    </div>
  </div>
</div>

<style>
  .ratio-bar {
    width: 100%;
    height: 24px;
    background-color: #f3f3f3;
    border-radius: 12px;
    overflow: hidden;
  }
  
  .ratio-indicator {
    height: 100%;
    background-color: #2196F3;
    transition: width 0.5s ease;
  }
  
  .ratio-value {
    font-size: 1.2rem;
    font-weight: bold;
    margin-top: 0.5rem;
    text-align: center;
  }
</style>
```

## Using the Gun Chain Extension

If you want to use Gun's chain directly with Svelte's reactive syntax, you can use the extension method:

```svelte
<script>
  import { gun } from '../models/Gun';
  import { extendGunForSvelte } from '../models/svelte-helpers';
  
  // Enable Gun chain subscription for Svelte
  extendGunForSvelte();
  
  // Now you can use Gun chains directly with $ syntax
  const messages = gun.get('chat').get('messages').map();
  
  // Form state
  let newMessage = '';
  
  function sendMessage() {
    if (!newMessage.trim()) return;
    
    gun.get('chat').get('messages').set({
      text: newMessage,
      timestamp: Date.now(),
      sender: 'Me'
    });
    
    newMessage = '';
  }
</script>

<div class="chat">
  <div class="messages">
    {#each $messages || [] as [id, message]}
      <div class="message" key={id}>
        <span class="sender">{message.sender}:</span>
        <span class="text">{message.text}</span>
      </div>
    {/each}
  </div>
  
  <form on:submit|preventDefault={sendMessage}>
    <input 
      type="text" 
      bind:value={newMessage} 
      placeholder="Type a message..." 
    />
    <button type="submit">Send</button>
  </form>
</div>

<style>
  .chat {
    display: flex;
    flex-direction: column;
    height: 400px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }
  
  .message {
    margin-bottom: 0.5rem;
  }
  
  .sender {
    font-weight: bold;
    margin-right: 0.5rem;
  }
  
  form {
    display: flex;
    padding: 0.5rem;
    border-top: 1px solid #ddd;
  }
  
  input {
    flex: 1;
    margin-right: 0.5rem;
  }
</style>
``` 