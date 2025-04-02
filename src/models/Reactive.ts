import { GunSubscription, SubscriptionCleanup, SubscriptionHandler } from './GunSubscription';
import { GunNode } from './GunNode';
import { App } from '../App';

/**
 * Core reactive primitive that can be observed for changes
 */
export class Reactive<T> {
    private _value: T;
    private _observers = new Set<(value: T) => void>();
    private _dependents = new Set<Computed<any>>();
  
    constructor(initialValue: T) {
      this._value = initialValue;
    }
  
    get value(): T {
      // Track this access if we're inside a computation
      Computed.trackAccess(this);
      return this._value;
    }
  
    set value(newValue: T) {
      if (this._value !== newValue) {
        this._value = newValue;
        this.notify();
      }
    }
  
    /**
     * Update the value using a function
     */
    update(updater: (current: T) => T): void {
      this.value = updater(this._value);
    }
  
    /**
     * Add a dependency to this reactive value
     */
    addDependent(dependent: Computed<any>): void {
      this._dependents.add(dependent);
    }
  
    /**
     * Remove a dependency from this reactive value
     */
    removeDependent(dependent: Computed<any>): void {
      this._dependents.delete(dependent);
    }
  
    /**
     * Subscribe to changes in the value
     */
    subscribe(observer: (value: T) => void): () => void {
      this._observers.add(observer);
      
      // Call immediately with current value
      observer(this._value);
      
      return () => {
        this._observers.delete(observer);
      };
    }
  
    /**
     * Notify all observers and dependents about changes
     */
    private notify(): void {
      // Notify direct observers
      this._observers.forEach(observer => observer(this._value));
      
      // Invalidate dependent computations
      this._dependents.forEach(dependent => dependent.invalidate());
    }
  
    /**
     * Create a Svelte-compatible store
     */
    toStore() {
      return {
        subscribe: (run: SubscriptionHandler<T>) => {
          return this.subscribe(run);
        }
      };
    }
  
    /**
     * Dispose of all resources
     */
    dispose(): void {
      this._observers.clear();
      this._dependents.clear();
    }
  }
  
  /**
   * Computed value that depends on reactive values
   */
  export class Computed<T> {
    private _value: T | null = null;
    private _computer: () => T;
    private _observers = new Set<(value: T) => void>();
    private _dependencies = new Set<Reactive<any> | Computed<any>>();
    private _dependents = new Set<Computed<any>>();
    private _valid = false;
    private _disposed = false;
  
    // Static tracking for automatic dependency detection - make this public
    public static currentComputation: Computed<any> | null = null;
  
    constructor(computer: () => T) {
      this._computer = computer;
    }
  
    /**
     * Track access to a reactive value during computation
     */
    static trackAccess(dependency: Reactive<any> | Computed<any>): void {
      if (Computed.currentComputation) {
        Computed.currentComputation.addDependency(dependency);
      }
    }
  
    /**
     * Add a dependency to this computation
     */
    addDependency(dependency: Reactive<any> | Computed<any>): void {
      if (this._dependencies.has(dependency)) return;
      
      this._dependencies.add(dependency);
      
      // Register this computation as a dependent of the dependency
      if (dependency instanceof Reactive) {
        dependency.addDependent(this);
      } else if (dependency instanceof Computed) {
        dependency.addDependent(this);
      }
    }
  
    /**
     * Remove a dependency from this computation
     */
    removeDependency(dependency: Reactive<any> | Computed<any>): void {
      if (!this._dependencies.has(dependency)) return;
      
      this._dependencies.delete(dependency);
      
      // Unregister this computation as a dependent
      if (dependency instanceof Reactive) {
        dependency.removeDependent(this);
      } else if (dependency instanceof Computed) {
        dependency.removeDependent(this);
      }
    }
  
    /**
     * Add a dependent computation
     */
    addDependent(dependent: Computed<any>): void {
      this._dependents.add(dependent);
    }
  
    /**
     * Remove a dependent computation
     */
    removeDependent(dependent: Computed<any>): void {
      this._dependents.delete(dependent);
    }
  
    /**
     * Get the computed value
     */
    get value(): T {
      // Track this access if we're inside another computation
      Computed.trackAccess(this);
      
      // Recompute if invalid
      if (!this._valid) {
        this.recompute();
      }
      
      return this._value!;
    }
  
    /**
     * Invalidate the computed value
     */
    invalidate(): void {
      if (!this._valid || this._disposed) return;
      
      this._valid = false;
      
      // Invalidate dependents
      this._dependents.forEach(dependent => dependent.invalidate());
      
      // Notify observers if we have any
      if (this._observers.size > 0) {
        this.recompute();
        this.notify();
      }
    }
  
    /**
     * Recompute the value
     */
    private recompute(): void {
      if (this._disposed) return;
      
      // Clear existing dependencies
      const oldDependencies = new Set(this._dependencies);
      this._dependencies.clear();
      
      // Set this as the current computation
      const previousComputation = Computed.currentComputation;
      Computed.currentComputation = this;
      
      try {
        // Compute the new value
        this._value = this._computer();
        this._valid = true;
      } finally {
        // Restore the previous computation
        Computed.currentComputation = previousComputation;
        
        // Remove this as a dependent from any dependencies that are no longer used
        oldDependencies.forEach(dependency => {
          if (!this._dependencies.has(dependency)) {
            if (dependency instanceof Reactive) {
              dependency.removeDependent(this);
            } else if (dependency instanceof Computed) {
              dependency.removeDependent(this);
            }
          }
        });
      }
    }
  
    /**
     * Subscribe to changes in the computed value
     */
    subscribe(observer: (value: T) => void): () => void {
      // Ensure we have a valid value
      if (!this._valid) {
        this.recompute();
      }
      
      this._observers.add(observer);
      
      // Call immediately with current value
      observer(this._value!);
      
      return () => {
        this._observers.delete(observer);
      };
    }
  
    /**
     * Notify all observers about changes
     */
    private notify(): void {
      if (this._disposed) return;
      this._observers.forEach(observer => observer(this._value!));
    }
  
    /**
     * Create a Svelte-compatible store
     */
    toStore() {
      return {
        subscribe: (run: SubscriptionHandler<T>) => {
          return this.subscribe(run);
        }
      };
    }
  
    /**
     * Dispose of all resources
     */
    dispose(): void {
      this._disposed = true;
      this._valid = false;
      this._value = null;
      this._observers.clear();
      
      // Remove this as a dependent from all dependencies
      this._dependencies.forEach(dependency => {
        if (dependency instanceof Reactive) {
          dependency.removeDependent(this);
        } else if (dependency instanceof Computed) {
          dependency.removeDependent(this);
        }
      });
      
      this._dependencies.clear();
      this._dependents.clear();
    }
  }
  
  /**
   * Batch processor for scheduling related updates
   */
  export class Batch {
    private static _queue = new Set<() => void>();
    private static _scheduled = false;
    private static _timeoutId: any = null;
  
    /**
     * Add a task to the batch
     */
    static schedule(task: () => void): void {
      Batch._queue.add(task);
      
      if (!Batch._scheduled) {
        Batch._scheduled = true;
        
        // Use requestAnimationFrame when available, fall back to setTimeout
        Batch._timeoutId = setTimeout(() => {
          Batch.run();
        }, 16); // ~60fps
      }
    }
  
    /**
     * Run all tasks in the batch
     */
    static run(): void {
      Batch._scheduled = false;
      
      if (Batch._timeoutId) {
        clearTimeout(Batch._timeoutId);
        Batch._timeoutId = null;
      }
      
      // Create a copy to avoid issues if tasks schedule more tasks
      const tasks = Array.from(Batch._queue);
      Batch._queue.clear();
      
      // Run all tasks
      tasks.forEach(task => {
        try {
          task();
        } catch (err) {
          console.error('Error in batch task:', err);
        }
      });
    }
  
    /**
     * Clear all pending tasks
     */
    static clear(): void {
      Batch._queue.clear();
      
      if (Batch._timeoutId) {
        clearTimeout(Batch._timeoutId);
        Batch._timeoutId = null;
      }
      
      Batch._scheduled = false;
    }
  }
  
  /**
   * Debounced function that automatically schedules via the batch system
   */
  export function debounced<T extends (...args: any[]) => void>(
    fn: T,
    delay: number = 100
  ): (...args: Parameters<T>) => void {
    let timeoutId: any = null;
    let lastArgs: Parameters<T> | null = null;
    
    return (...args: Parameters<T>) => {
      lastArgs = args;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        timeoutId = null;
        
        if (lastArgs) {
          Batch.schedule(() => fn(...lastArgs!));
        }
      }, delay);
    };
  }
  
  /**
   * Cache for expensive computations with automatic dependency tracking
   */
  export class ComputationCache<K, V> {
    private _cache = new Map<K, V>();
    private _dependencies = new Map<K, Set<Reactive<any> | Computed<any>>>();
    private _computeFunc: (key: K) => V;
  
    constructor(computeFunc: (key: K) => V) {
      this._computeFunc = computeFunc;
    }
  
    /**
     * Get a value from the cache, computing it if needed
     */
    get(key: K): V {
      // If we're in a computation, track this key as dependent on the current computation
      const currentComputation = Computed.currentComputation;
      if (currentComputation) {
        this.trackDependencies(key, new Set([currentComputation]));
      }
      
      if (!this._cache.has(key)) {
        this._cache.set(key, this._computeFunc(key));
      }
      
      return this._cache.get(key)!;
    }
  
    /**
     * Invalidate a specific key or all entries
     */
    invalidate(key?: K): void {
      if (key !== undefined) {
        this._cache.delete(key);
      } else {
        this._cache.clear();
      }
    }
  
    /**
     * Track dependencies for a key
     */
    trackDependencies(key: K, deps: Set<Reactive<any> | Computed<any>>): void {
      if (!this._dependencies.has(key)) {
        this._dependencies.set(key, new Set());
      }
      
      // Add new dependencies
      deps.forEach(dep => {
        this._dependencies.get(key)!.add(dep);
      });
    }
  
    /**
     * Clear all cache entries
     */
    clear(): void {
      this._cache.clear();
      this._dependencies.clear();
    }
  }
  
  /**
   * Integration with Gun for reactive data
   */
  export class ReactiveGun<T> extends Reactive<T> {
    private _subscription: SubscriptionCleanup | null = null;
    private _gunNode: GunNode<T>;
  
    constructor(path: string[], initialValue: T) {
      super(initialValue);
      this._gunNode = new GunNode<T>(path);
      this.setupSubscription();
    }
  
    private setupSubscription(): void {
      // Unsubscribe if we already have a subscription
      if (this._subscription) {
        this._subscription();
        this._subscription = null;
      }
  
      // Subscribe to changes from Gun and update the reactive value
      this._subscription = this._gunNode.on((data) => {
        // Update without triggering a write back to Gun
        super.value = data as T;
      });
    }
  
    set value(newValue: T) {
      // Call the parent setter to update local value and notify observers
      super.value = newValue;
      
      // Write the value to Gun
      this._gunNode.put(newValue);
    }
  
    dispose(): void {
      // Clean up Gun subscription
      if (this._subscription) {
        this._subscription();
        this._subscription = null;
      }
      
      // Call parent dispose
      super.dispose();
    }
    
    // Expose GunNode methods that might be needed
    get gunNode(): GunNode<T> {
      return this._gunNode;
    }
    
    // Add methods to access GunNode functionality
    once(): Promise<T> {
      return this._gunNode.once();
    }
    
    stream(): GunSubscription<T> {
      return this._gunNode.stream();
    }
  }
  
  /**
   * Base for reactive entities connected to Gun
   */
  export abstract class ReactiveEntity<T> {
    private _id: string;
    protected _reactives = new Map<string, Reactive<any>>();
    protected _computed = new Map<string, Computed<any>>();
    protected _subscriptions: SubscriptionCleanup[] = [];
    protected _app: App;
    protected _gunNode: GunNode<T>;
  
    constructor(id: string, app: App) {
      this._id = id;
      this._app = app;
      this._gunNode = new GunNode<T>(['entities', this.constructor.name.toLowerCase(), id]);
    }
  
    get id(): string {
      return this._id;
    }
    
    get gunNode(): GunNode<T> {
      return this._gunNode;
    }
  
    protected defineReactiveProperty<K extends keyof T & string>(
      propertyName: K,
      initialValue: T[K],
      path: string[] = []
    ): void {
      // Determine whether to use Gun or local reactive
      if (path.length > 0) {
        // Create a ReactiveGun property that syncs with the database
        const reactiveGun = new ReactiveGun<T[K]>(path, initialValue);
        this._reactives.set(propertyName, reactiveGun);
        
        // Define the property on this instance
        Object.defineProperty(this, propertyName, {
          get: () => reactiveGun.value,
          set: (value: T[K]) => { reactiveGun.value = value; },
          enumerable: true,
          configurable: true
        });
      } else {
        // Create a local reactive property
        const reactive = new Reactive<T[K]>(initialValue);
        this._reactives.set(propertyName, reactive);
        
        // Define the property on this instance
        Object.defineProperty(this, propertyName, {
          get: () => reactive.value,
          set: (value: T[K]) => { reactive.value = value; },
          enumerable: true,
          configurable: true
        });
      }
    }
  
    protected defineComputedProperty<V>(
      propertyName: string,
      computer: () => V
    ): void {
      // Create a computed property
      const computed = new Computed<V>(computer.bind(this) as () => V);
      this._computed.set(propertyName, computed);
      
      // Define the property on this instance
      Object.defineProperty(this, propertyName, {
        get: () => computed.value,
        enumerable: true,
        configurable: true
      });
    }
  
    protected addSubscription(subscription: SubscriptionCleanup): void {
      this._subscriptions.push(subscription);
    }
  
    getStore<K extends keyof T & string>(propertyName: K) {
      const reactive = this._reactives.get(propertyName);
      if (!reactive) {
        throw new Error(`No reactive property found with name: ${String(propertyName)}`);
      }
      
      return reactive.toStore();
    }
  
    getComputedStore(propertyName: string) {
      const computed = this._computed.get(propertyName);
      if (!computed) {
        throw new Error(`No computed property found with name: ${propertyName}`);
      }
      
      return computed.toStore();
    }
  
    dispose(): void {
      // Clean up all subscriptions
      this._subscriptions.forEach(unsub => unsub());
      this._subscriptions = [];
      
      // Dispose all reactive properties
      this._reactives.forEach(reactive => reactive.dispose());
      this._reactives.clear();
      
      // Dispose all computed properties
      this._computed.forEach(computed => computed.dispose());
      this._computed.clear();
    }
  }
  

// Export additional utility functions
export function reactive<T>(initialValue: T): Reactive<T> {
  return new Reactive<T>(initialValue);
}

export function computed<T>(computer: () => T): Computed<T> {
  return new Computed<T>(computer);
}

