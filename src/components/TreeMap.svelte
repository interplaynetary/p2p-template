<script lang="ts">
    import { TreeNode } from '../models/old/TreeNode';
    import { createTreemap } from './TreeMap';

    // With this in mind carefully translate TreeMap.ts to TreeMap.svelte into svelte x d3. Be careful to preserve all functionality

    let treeMap: any;
</script>

<div bind:this={treeMap}></div>

<style>
    div {
        width: 100%;
        height: 100%;
    }
</style>