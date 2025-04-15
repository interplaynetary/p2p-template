import { Inventory } from './Inventory';
import { TreeNode } from './TreeNode';
import { getUserName } from '../utils/userUtils';
import { createCapacityDistributionChart, CAPACITY_DEPTH_CHANGE_EVENT } from '../components/CapacityDistributionChart';

/**
 * Manages the Inventory UI interactions
 */
export class InventoryManager {
  private _currentNode: TreeNode;
  private _inventory: Inventory;
  private _isInitialized: boolean = false;
  private _initializationPromise: Promise<void> | null = null;
  
  /**
   * Create a new inventory manager for a specific node
   * @param node The tree node to manage inventory for
   */
  constructor(node: TreeNode) {
    this._currentNode = node;
    this._inventory = Inventory.getInventory(node.id, node);
    this._initializationPromise = this.initialize();
  }
  
  /**
   * Initialize the inventory manager
   */
  private async initialize(): Promise<void> {
    try {
      // Wait for inventory to initialize
      await this._inventory.waitForInitialization();
      
      // Set up event listeners after inventory is ready
      this.setupEventListeners();
      
      // Mark as initialized
      this._isInitialized = true;
    } catch (error) {
      console.error(`Error initializing inventory manager: ${error.message}`);
      // Mark as initialized even on error to avoid blocking the app
      this._isInitialized = true;
    }
  }
  
  /**
   * Wait for initialization to complete
   */
  public async waitForInitialization(): Promise<void> {
    if (this._isInitialized) return Promise.resolve();
    return this._initializationPromise || Promise.resolve();
  }
  
  /**
   * Set up event listeners for the inventory form
   */
  private setupEventListeners(): void {
    try {
      // Listen for inventory updates
      const updateButton = document.querySelector('.update-inventory');
      if (updateButton) {
        updateButton.addEventListener('click', async () => {
          try {
            await this.saveInventoryChanges();
          } catch (error) {
            console.error(`Error updating inventory: ${error.message}`);
            alert(`Failed to update inventory: ${error.message}`);
          }
        });
      }
    } catch (error) {
      console.error(`Error setting up event listeners: ${error.message}`);
    }
  }
  
  /**
   * Populate the inventory form with current capacities
   */
  public async populateInventoryForm(): Promise<void> {
    try {
      // Ensure initialization is complete
      await this.waitForInitialization();
      
      const capacityInputs = document.querySelector('.capacity-inputs');
      if (!capacityInputs) return;
      
      // Clear existing inputs
      capacityInputs.innerHTML = '';
      
      // Get capacities from the current node that this user can provide
      const capacities = this._currentNode.contributors;
      
      // Get current inventory entries
      const entries = this._inventory.entries;
      
      // Add header for existing capacities
      if (capacities.size > 0) {
        const existingHeader = document.createElement('h3');
        existingHeader.className = 'section-header';
        existingHeader.textContent = 'Existing Capacities';
        capacityInputs.appendChild(existingHeader);
      }
      
      // Add inputs for each capacity
      capacities.forEach(capacityId => {
        const capacityName = getUserName(capacityId);
        const entry = entries.get(capacityId);
        
        const row = document.createElement('div');
        row.className = 'capacity-input-row';
        row.dataset.capacityId = capacityId;
        
        // Add wrapper for name
        const nameContainer = document.createElement('div');
        nameContainer.className = 'name-container';
        
        // Capacity name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'capacity-name';
        nameSpan.textContent = capacityName;
        nameContainer.appendChild(nameSpan);
        
        // Add wrapper for inputs
        const inputsContainer = document.createElement('div');
        inputsContainer.className = 'inputs-container';
        
        // Quantity input with label
        const quantityContainer = document.createElement('div');
        quantityContainer.className = 'input-group';
        
        const quantityLabel = document.createElement('label');
        quantityLabel.textContent = 'Quantity:';
        quantityLabel.className = 'input-label';
        
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.className = 'quantity-input';
        quantityInput.min = '0';
        quantityInput.step = '0.01';
        quantityInput.placeholder = 'Quantity';
        quantityInput.value = entry ? entry.quantity.toString() : '';
        
        quantityContainer.appendChild(quantityLabel);
        quantityContainer.appendChild(quantityInput);
        
        // Unit input with label
        const unitContainer = document.createElement('div');
        unitContainer.className = 'input-group';
        
        const unitLabel = document.createElement('label');
        unitLabel.textContent = 'Units:';
        unitLabel.className = 'input-label';
        
        const unitInput = document.createElement('input');
        unitInput.type = 'text';
        unitInput.className = 'unit-input';
        unitInput.placeholder = 'Units';
        unitInput.value = entry ? entry.unit : '';
        
        unitContainer.appendChild(unitLabel);
        unitContainer.appendChild(unitInput);
        
        inputsContainer.appendChild(quantityContainer);
        inputsContainer.appendChild(unitContainer);
        
        // Hidden depth input (for form submission)
        const depthInput = document.createElement('input');
        depthInput.type = 'hidden';
        depthInput.className = 'depth-input';
        depthInput.value = entry ? entry.depth.toString() : '3';
        
        // Distribution chart container
        const chartContainer = document.createElement('div');
        chartContainer.className = 'distribution-chart-container';

        // Create distribution chart
        const currentDepth = entry ? entry.depth : 3;
        const chartElement = createCapacityDistributionChart(this._currentNode, currentDepth, 1);
        
        // Update event listeners for depth changes in existing capacity rows
        chartElement.addEventListener(CAPACITY_DEPTH_CHANGE_EVENT, (e: Event) => {
          const detail = (e as CustomEvent).detail;
          const newDepth = detail.depth;
          console.log(`Depth changed to ${newDepth} for capacity ${capacityName}`);
          
          // Update the hidden input
          depthInput.value = newDepth.toString();
       
          // The chart will update itself automatically - no need to recreate it
        });
        
        // Add elements to row
        row.appendChild(nameContainer);
        row.appendChild(inputsContainer);
        chartContainer.appendChild(chartElement);
        row.appendChild(chartContainer);
        row.appendChild(depthInput);
        
        // Add row to container
        capacityInputs.appendChild(row);
      });
      
      // Add "New Capacity" section
      const newCapacityHeader = document.createElement('h3');
      newCapacityHeader.className = 'section-header';
      newCapacityHeader.textContent = 'Add New Capacity';
      capacityInputs.appendChild(newCapacityHeader);
      
      // Create a new row for adding capacity
      const newRow = document.createElement('div');
      newRow.className = 'capacity-input-row new-capacity-row';
      
      // Add wrapper for name input
      const nameContainer = document.createElement('div');
      nameContainer.className = 'name-container';
      
      // Capacity name input for new capacity
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'capacity-name-input';
      nameInput.placeholder = 'Capacity Name';
      nameContainer.appendChild(nameInput);
      
      // Add wrapper for inputs
      const inputsContainer = document.createElement('div');
      inputsContainer.className = 'inputs-container';
      
      // Quantity input with label
      const quantityContainer = document.createElement('div');
      quantityContainer.className = 'input-group';
      
      const quantityLabel = document.createElement('label');
      quantityLabel.textContent = 'Quantity:';
      quantityLabel.className = 'input-label';
      
      const quantityInput = document.createElement('input');
      quantityInput.type = 'number';
      quantityInput.className = 'quantity-input';
      quantityInput.min = '0';
      quantityInput.step = '0.01';
      quantityInput.placeholder = 'Quantity';
      
      quantityContainer.appendChild(quantityLabel);
      quantityContainer.appendChild(quantityInput);
      
      // Unit input with label
      const unitContainer = document.createElement('div');
      unitContainer.className = 'input-group';
      
      const unitLabel = document.createElement('label');
      unitLabel.textContent = 'Units:';
      unitLabel.className = 'input-label';
      
      const unitInput = document.createElement('input');
      unitInput.type = 'text';
      unitInput.className = 'unit-input';
      unitInput.placeholder = 'Units';
      
      unitContainer.appendChild(unitLabel);
      unitContainer.appendChild(unitInput);
      
      inputsContainer.appendChild(quantityContainer);
      inputsContainer.appendChild(unitContainer);
      
      // Hidden depth input (for form submission)
      const depthInput = document.createElement('input');
      depthInput.type = 'hidden';
      depthInput.className = 'depth-input';
      depthInput.value = '3'; // Default depth
      
      // Distribution chart container
      const chartContainer = document.createElement('div');
      chartContainer.className = 'distribution-chart-container';
      
      // Create distribution chart for new capacity
      const chartElement = createCapacityDistributionChart(this._currentNode, 3, 1);
      
      // Update event listeners for depth changes in new capacity row
      chartElement.addEventListener(CAPACITY_DEPTH_CHANGE_EVENT, (e: Event) => {
        const detail = (e as CustomEvent).detail;
        const newDepth = detail.depth;
        console.log(`Depth changed to ${newDepth} for new capacity`);
        
        // Update the hidden input
        depthInput.value = newDepth.toString();
        
        // The chart will update itself automatically - no need to recreate it
      });
      
      // Add elements to new row
      newRow.appendChild(nameContainer);
      newRow.appendChild(inputsContainer);
      chartContainer.appendChild(chartElement);
      newRow.appendChild(chartContainer);
      newRow.appendChild(depthInput);
      
      // Add new row to container
      capacityInputs.appendChild(newRow);
      
      // Add button to add another new capacity
      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.className = 'add-capacity-button';
      addButton.textContent = '+ Add Another Capacity';
      addButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.addNewCapacityRow();
      });
      
      capacityInputs.appendChild(addButton);
      
      // Update the inventory list
      await this.updateInventoryList();
    } catch (error) {
      console.error(`Error populating inventory form: ${error.message}`);
    }
  }
  
  /**
   * Add a new capacity input row
   */
  private addNewCapacityRow(): void {
    try {
      const capacityInputs = document.querySelector('.capacity-inputs');
      if (!capacityInputs) return;
      
      // Create a new row for adding capacity
      const newRow = document.createElement('div');
      newRow.className = 'capacity-input-row new-capacity-row';
      
      // Add wrapper for name input
      const nameContainer = document.createElement('div');
      nameContainer.className = 'name-container';
      
      // Capacity name input for new capacity
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'capacity-name-input';
      nameInput.placeholder = 'Capacity Name';
      nameContainer.appendChild(nameInput);
      
      // Add wrapper for inputs
      const inputsContainer = document.createElement('div');
      inputsContainer.className = 'inputs-container';
      
      // Quantity input with label
      const quantityContainer = document.createElement('div');
      quantityContainer.className = 'input-group';
      
      const quantityLabel = document.createElement('label');
      quantityLabel.textContent = 'Quantity:';
      quantityLabel.className = 'input-label';
      
      const quantityInput = document.createElement('input');
      quantityInput.type = 'number';
      quantityInput.className = 'quantity-input';
      quantityInput.min = '0';
      quantityInput.step = '0.01';
      quantityInput.placeholder = 'Quantity';
      
      quantityContainer.appendChild(quantityLabel);
      quantityContainer.appendChild(quantityInput);
      
      // Unit input with label
      const unitContainer = document.createElement('div');
      unitContainer.className = 'input-group';
      
      const unitLabel = document.createElement('label');
      unitLabel.textContent = 'Units:';
      unitLabel.className = 'input-label';
      
      const unitInput = document.createElement('input');
      unitInput.type = 'text';
      unitInput.className = 'unit-input';
      unitInput.placeholder = 'Units';
      
      unitContainer.appendChild(unitLabel);
      unitContainer.appendChild(unitInput);
      
      inputsContainer.appendChild(quantityContainer);
      inputsContainer.appendChild(unitContainer);
      
      // Hidden depth input (for form submission)
      const depthInput = document.createElement('input');
      depthInput.type = 'hidden';
      depthInput.className = 'depth-input';
      depthInput.value = '3'; // Default depth
      
      // Distribution chart container
      const chartContainer = document.createElement('div');
      chartContainer.className = 'distribution-chart-container';
      
      // Add depth indicator
      const depthIndicator = document.createElement('span');
      depthIndicator.className = 'depth-indicator';
      depthIndicator.textContent = 'Depth: 3';
      chartContainer.appendChild(depthIndicator);
      
      // Create distribution chart for new capacity
      const chartElement = createCapacityDistributionChart(this._currentNode, 3, 1);
      
      // Update event listeners for depth changes in new capacity row
      chartElement.addEventListener(CAPACITY_DEPTH_CHANGE_EVENT, (e: Event) => {
        const detail = (e as CustomEvent).detail;
        const newDepth = detail.depth;
        console.log(`Depth changed to ${newDepth} for new capacity`);
        
        // Update the hidden input
        depthInput.value = newDepth.toString();
        
        // Update the depth indicator
        depthIndicator.textContent = `Depth: ${newDepth}`;
        
        // The chart will update itself automatically - no need to recreate it
      });
      
      // Add elements to new row
      newRow.appendChild(nameContainer);
      newRow.appendChild(inputsContainer);
      chartContainer.appendChild(chartElement);
      newRow.appendChild(chartContainer);
      newRow.appendChild(depthInput);
      
      // Find the add button
      const addButton = capacityInputs.querySelector('.add-capacity-button');
      
      // Insert the new row before the add button
      if (addButton) {
        capacityInputs.insertBefore(newRow, addButton);
      } else {
        capacityInputs.appendChild(newRow);
      }
    } catch (error) {
      console.error(`Error adding new capacity row: ${error.message}`);
    }
  }
  
  /**
   * Update the inventory list to show current capacities
   */
  private async updateInventoryList(): Promise<void> {
    try {
      // Ensure initialization is complete
      await this.waitForInitialization();
      
      const inventoryList = document.querySelector('.inventory-list');
      if (!inventoryList) return;
      
      // Clear the list
      inventoryList.innerHTML = '';
      
      // Get current inventory entries
      const entries = this._inventory.entries;
      
      if (entries.size === 0) {
        inventoryList.innerHTML = '<p class="no-inventory">No capacity declarations found.</p>';
        return;
      }
      
      // Create header
      const header = document.createElement('div');
      header.className = 'inventory-header';
      header.innerHTML = '<strong>Current Capacity Declarations</strong>';
      inventoryList.appendChild(header);
      
      // Add items for each entry
      entries.forEach(entry => {
        const capacityName = getUserName(entry.capacityId);
        
        const item = document.createElement('div');
        item.className = 'inventory-item';
        
        // Create distribution chart for this entry
        const chartElement = createCapacityDistributionChart(this._currentNode, entry.depth, 0.8);
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'item-name';
        nameSpan.textContent = capacityName;
        
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'item-details-container';
        
        const detailsSpan = document.createElement('span');
        detailsSpan.className = 'item-details';
        detailsSpan.textContent = `${entry.quantity} ${entry.unit}`;
        
        detailsContainer.appendChild(detailsSpan);
        detailsContainer.appendChild(chartElement);
        
        item.appendChild(nameSpan);
        item.appendChild(detailsContainer);
        
        inventoryList.appendChild(item);
      });
    } catch (error) {
      console.error(`Error updating inventory list: ${error.message}`);
    }
  }
  
  /**
   * Save changes from the inventory form
   */
  public async saveInventoryChanges(): Promise<void> {
    try {
      // Ensure initialization is complete
      await this.waitForInitialization();
      
      // Process existing capacity rows
      const existingRows = document.querySelectorAll('.capacity-input-row:not(.new-capacity-row)');
      
      // Use Promise.all to process updates concurrently
      await Promise.all(Array.from(existingRows).map(async (row) => {
        const capacityId = (row as HTMLElement).dataset.capacityId;
        if (!capacityId) return;
        
        const quantityInput = row.querySelector('.quantity-input') as HTMLInputElement;
        const unitInput = row.querySelector('.unit-input') as HTMLInputElement;
        const depthInput = row.querySelector('.depth-input') as HTMLInputElement;
        
        if (!quantityInput || !unitInput || !depthInput) return;
        
        const quantity = parseFloat(quantityInput.value);
        const unit = unitInput.value.trim();
        const depth = parseInt(depthInput.value) || 3; // Default to 3 if not specified
        
        // Skip if no quantity or unit
        if (isNaN(quantity) || quantity <= 0 || !unit) {
          // If entry exists, remove it
          const existingEntry = this._inventory.getCapacityEntry(capacityId);
          if (existingEntry) {
            await this._inventory.removeCapacity(capacityId);
          }
          return;
        }
        
        // Update inventory with the depth parameter
        await this._inventory.setCapacity(capacityId, quantity, unit, depth);
      }));
      
      // Process new capacity rows
      const newRows = document.querySelectorAll('.new-capacity-row');
      const processedCapacities = new Set<string>();
      
      // Process new capacity rows sequentially to avoid race conditions
      for (const row of Array.from(newRows)) {
        const nameInput = row.querySelector('.capacity-name-input') as HTMLInputElement;
        const quantityInput = row.querySelector('.quantity-input') as HTMLInputElement;
        const unitInput = row.querySelector('.unit-input') as HTMLInputElement;
        const depthInput = row.querySelector('.depth-input') as HTMLInputElement;
        
        if (!nameInput || !quantityInput || !unitInput || !depthInput) continue;
        
        const capacityName = nameInput.value.trim();
        const quantity = parseFloat(quantityInput.value);
        const unit = unitInput.value.trim();
        const depth = parseInt(depthInput.value) || 3; // Default to 3 if not specified
        
        // Skip if any field is empty
        if (!capacityName || isNaN(quantity) || quantity <= 0 || !unit) continue;
        
        // Skip if we've already processed this capacity name (avoid duplicates)
        if (processedCapacities.has(capacityName)) continue;
        processedCapacities.add(capacityName);
        
        try {
          // Check if a capacity with this name already exists
          let capacityId = await this.findCapacityIdByName(capacityName);
          
          // If capacity doesn't exist yet, create it
          if (!capacityId) {
            // Create a new capacity node using the TreeNode interface
            const capacityNode = await this._currentNode.root.addChild(capacityName, 0);
            capacityId = capacityNode.id;
            
            // Add the capacity to the current node
            this._currentNode.addContributor(capacityId);
            
            console.log(`Created new capacity ${capacityName} with ID ${capacityId}`);
          }
          
          // Update inventory with the new capacity, including depth
          await this._inventory.setCapacity(capacityId, quantity, unit, depth);
        } catch (error) {
          console.error(`Error creating capacity for ${capacityName}:`, error);
        }
      }
      
      // Update the inventory list
      await this.updateInventoryList();
      
      // Show confirmation
      alert('Capacity declarations updated successfully.');
      
      // Close the form
      const popup = document.querySelector('.node-popup');
      if (popup) {
        popup.classList.remove('active');
      }
    } catch (error) {
      console.error(`Error saving inventory changes: ${error.message}`);
      alert(`Failed to save inventory changes: ${error.message}`);
    }
  }
  
  /**
   * Find a capacity ID by name
   * @param name Name to search for
   * @returns Capacity ID if found, otherwise null
   */
  private async findCapacityIdByName(name: string): Promise<string | null> {
    try {
      // First check if this node has the capacity
      for (const capacityId of this._currentNode.contributors) {
        if (getUserName(capacityId).toLowerCase() === name.toLowerCase()) {
          return capacityId;
        }
      }
      
      // Check root's capacity index for a match
      const rootCapacities = this._currentNode.rootContributors;
      for (const capacityId of rootCapacities) {
        if (getUserName(capacityId).toLowerCase() === name.toLowerCase()) {
          return capacityId;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error finding capacity ID by name: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Calculate allocation for a requester
   * @param capacityId Capacity ID to calculate allocation for
   * @param requesterId ID of the requester
   * @returns Promise resolving with allocation details or null
   */
  public async calculateAllocation(capacityId: string, requesterId: string) {
    try {
      // Ensure initialization is complete
      await this.waitForInitialization();
      return this._inventory.calculateAllocation(capacityId, requesterId);
    } catch (error) {
      console.error(`Error calculating allocation: ${error.message}`);
      return null;
    }
  }
} 