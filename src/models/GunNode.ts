import { gun } from './Gun';
import { GunSubscription, SubscriptionCleanup, SubscriptionHandler } from './GunSubscription';

/**
 * Base class for Gun node wrappers that provides a consistent API
 * Following the guide's recommendations for wrapping Gun functionality
 */
export class GunNode<T = any> {
  protected chain: any;
  
  /**
   * Create a new Gun node wrapper
   * @param path Array of path segments to the node
   */
  constructor(path: string[]) {
    // Navigate the Gun path to create the chain
    let ref = gun as any;
    for (const segment of path) {
      ref = ref.get(segment);
    }
    this.chain = ref;
  }

  /**
   * Get a child node at the given path
   * @param key The key of the child node
   * @param NodeClass The class to use for the child node (defaults to GunNode)
   * @returns A new instance of the provided NodeClass
   */
  public get<R = any, N extends GunNode<R> = GunNode<R>>(
    key: string,
    NodeClass: new (path: string[]) => N = GunNode as any
  ): N {
    // Get the current path and add the new key
    const path = this.getPath();
    return new NodeClass([...path, key]);
  }

  /**
   * Put a value to the Gun node
   * @param value The value to put
   * @param options Optional Gun options (e.g., for certificates)
   * @returns This node instance for chaining
   */
  public put(value: Partial<T>, options?: any): this {
    // Create a clone of options to avoid mutation
    const opts = options ? structuredClone(options) : null;
    this.chain.put(value, null, opts);
    return this;
  }

  /**
   * Subscribe to updates from this node
   * @param handler Function to call with updates
   * @returns A function to unsubscribe
   */
  public on(handler: SubscriptionHandler<T>): SubscriptionCleanup {
    const subscription = new GunSubscription<T>(this.getPath());
    return subscription.on(handler);
  }

  /**
   * Get a single value from the node and resolve
   * @returns Promise that resolves with the node value
   */
  public once(): Promise<T> {
    const subscription = new GunSubscription<T>(this.getPath());
    return subscription.once();
  }

  /**
   * Get a readable stream of values from this node
   * @returns A subscription that can be used as a stream
   */
  public stream(): GunSubscription<T> {
    return new GunSubscription<T>(this.getPath());
  }

  /**
   * Subscribe to all values in this node (for collections)
   * @param handler Function to call with each item
   * @returns A function to unsubscribe
   */
  public each(handler: SubscriptionHandler<any>): SubscriptionCleanup {
    const subscription = new GunSubscription(this.getPath());
    const eachSub = subscription.each();
    return eachSub.on(handler);
  }

  /**
   * Get the full path to this node as an array
   * @returns Array of path segments
   */
  protected getPath(): string[] {
    // This would need to be tracked during construction and get() calls
    // For now, let's extract it from the Soul if available
    const soul = this.getSoul();
    if (soul) {
      // For simple paths, the soul might be something like 'nodes/abc123'
      return soul.split('/');
    }
    
    // Fallback: cannot determine path
    console.warn('Could not determine Gun path, using empty path');
    return [];
  }

  /**
   * Get the Soul (unique identifier) of this node if it has one
   * @returns The Soul string or undefined
   */
  public getSoul(): string | undefined {
    return new Promise<string | undefined>((resolve) => {
      this.chain.once((data: any) => {
        if (data && data['_'] && data['_']['#']) {
          resolve(data['_']['#']);
        } else {
          resolve(undefined);
        }
      });
    }) as any; // This is a hack to avoid dealing with async
  }

  /**
   * Check if this node exists in the database
   * @returns Promise that resolves to true if the node exists with data
   */
  public async exists(): Promise<boolean> {
    try {
      const data = await this.once();
      return Boolean(data && Object.keys(data).filter(k => k !== '_').length > 0);
    } catch (err) {
      return false;
    }
  }
} 