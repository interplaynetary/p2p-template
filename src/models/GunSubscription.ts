import { gun } from './Gun';

// Type definition for subscription handlers
export type SubscriptionHandler<T> = (value: T) => void;

// Type for subscription cleanup function
export type SubscriptionCleanup = () => void;

/**
 * A wrapper around Gun subscriptions that provides:
 * 1. Proper cleanup of subscriptions
 * 2. Better error handling
 * 3. Consistent stream-based API
 * 4. Protection against receiving data after unsubscribe
 * 5. Support for Svelte-compatible stores
 */
export class GunSubscription<T = any> {
  private gunRef: any;
  private active: boolean = false;
  private handlers: Set<SubscriptionHandler<T>> = new Set();
  private reader: ReadableStreamDefaultReader<T> | null = null;
  private stream: ReadableStream<T> | null = null;
  // Track last value for late subscribers
  private lastValue: T | undefined = undefined;
  private hasValue: boolean = false;

  /**
   * Create a subscription to a Gun node path
   * @param path Array of path segments to the Gun node
   */
  constructor(path: string[]) {
    // Navigate the Gun path
    let ref = gun as any;
    for (const segment of path) {
      ref = ref.get(segment);
    }
    this.gunRef = ref;
  }

  /**
   * Create a subscription to a Gun path with a more natural syntax
   * @param path Array of path segments to the Gun node
   * @returns A new GunSubscription instance
   */
  public static from<T>(path: string[]): GunSubscription<T> {
    return new GunSubscription<T>(path);
  }

  /**
   * Start the subscription and get a stream that can be read
   * @returns A ReadableStream of data from the Gun node
   */
  public subscribe(): ReadableStream<T> {
    if (this.stream) {
      return this.stream;
    }

    this.active = true;

    // Create a stream that will emit values from Gun
    this.stream = new ReadableStream<T>({
      start: (controller) => {
        // Emit the last value immediately if we have one
        if (this.hasValue && this.lastValue !== undefined) {
          controller.enqueue(this.lastValue);
        }
        
        // Set up Gun subscription
        this.gunRef.on((data: T, key: string) => {
          if (!this.active) return; // Skip if we've been unsubscribed
          if (key === '_') return;  // Skip Gun metadata
          
          // Store the last value
          this.lastValue = data;
          this.hasValue = true;

          // Emit the value to all handlers
          this.handlers.forEach(handler => {
            try {
              handler(data);
            } catch (err) {
              console.error('Error in Gun subscription handler:', err);
            }
          });

          // Send the value to the stream consumer
          controller.enqueue(data);
        });
      },
      cancel: () => {
        // Clean up when the stream is cancelled
        this.unsubscribe();
      }
    });

    return this.stream;
  }

  /**
   * Subscribe with a callback instead of using the stream directly
   * @param handler Function to call when new data arrives
   * @returns A function to unsubscribe
   */
  public on(handler: SubscriptionHandler<T>): SubscriptionCleanup {
    // Start the subscription if it's not active
    if (!this.active) {
      this.subscribe();
    }

    // Add the handler
    this.handlers.add(handler);
    
    // Immediately emit the last value if we have one
    if (this.hasValue && this.lastValue !== undefined) {
      try {
        handler(this.lastValue);
      } catch (err) {
        console.error('Error in Gun subscription handler (immediate):', err);
      }
    }

    // Return a function to remove this specific handler
    return () => {
      this.handlers.delete(handler);
      // If no more handlers, unsubscribe completely
      if (this.handlers.size === 0) {
        this.unsubscribe();
      }
    };
  }

  /**
   * Get a single value from Gun and then unsubscribe
   * @returns Promise that resolves with the value
   */
  public once(): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Immediately return last value if available
      if (this.hasValue && this.lastValue !== undefined) {
        resolve(this.lastValue);
        return;
      }
      
      // Create a timeout to avoid hanging forever
      const timeout = setTimeout(() => {
        if (cleanup) {
          cleanup(); // Ensure we clean up if we timeout
        }
        reject(new Error('Gun once() timed out after 10 seconds'));
      }, 10000);

      // Set up a one-time handler
      let cleanup: SubscriptionCleanup | null = null;
      cleanup = this.on((data) => {
        clearTimeout(timeout);
        if (cleanup) {
          cleanup(); // Only call if cleanup is defined
        }
        resolve(data);
      });
    });
  }

  /**
   * Stop the subscription and clean up resources
   */
  public unsubscribe(): void {
    if (!this.active) return;

    // Mark as inactive
    this.active = false;

    // Clean up Gun subscription
    if (this.gunRef) {
      this.gunRef.off();
    }

    // Clear handlers
    this.handlers.clear();

    // Clean up stream
    if (this.reader) {
      this.reader.cancel();
      this.reader = null;
    }

    this.stream = null;
  }

  /**
   * Create a Svelte-compatible store from this subscription
   * @returns An object with subscribe method compatible with Svelte stores
   */
  public toStore() {
    return {
      subscribe: (run: SubscriptionHandler<T>) => {
        const cleanup = this.on(run);
        return cleanup;
      }
    };
  }

  /**
   * Map values from a Gun node using the provided mapper function
   * @param mapFn Function to transform each item
   * @returns A new GunSubscription with mapped values
   */
  public map<R>(mapFn: (value: T) => R): GunSubscription<R> {
    const source = this.subscribe();
    const mappedSub = new GunSubscription<R>([]);

    // Create a transformed stream
    mappedSub.stream = new ReadableStream<R>({
      start: (controller) => {
        // Get a reader for the source stream
        this.reader = source.getReader();

        // Read values and map them
        const processValues = async () => {
          try {
            while (true) {
              const { value, done } = await this.reader.read();
              if (done) break;

              // Map the value and send to stream
              const mappedValue = mapFn(value);
              mappedSub.lastValue = mappedValue;
              mappedSub.hasValue = true;
              controller.enqueue(mappedValue);

              // Send to handlers
              mappedSub.handlers.forEach(handler => {
                try {
                  handler(mappedValue);
                } catch (err) {
                  console.error('Error in mapped subscription handler:', err);
                }
              });
            }
          } catch (err) {
            console.error('Error reading from Gun subscription:', err);
            controller.error(err);
          }
        };

        processValues();
      },
      cancel: () => {
        // Clean up when the stream is cancelled
        mappedSub.unsubscribe();
        this.unsubscribe();
      }
    });

    return mappedSub;
  }

  /**
   * Create a mapped subscription to all values in a Gun node
   * For iterating over collections of values
   * @returns A subscription to all values in the node
   */
  public each(): GunSubscription {
    // Create a new subscription that will use .map() internally
    const mapSub = new GunSubscription([]);
    mapSub.gunRef = this.gunRef.map();
    mapSub.active = true;
    
    // Track seen keys to help with cleanup
    const seenKeys = new Set<string>();
    
    // Create the stream with proper Gun map handling
    mapSub.stream = new ReadableStream({
      start: (controller) => {
        mapSub.gunRef.on((data: any, key: string) => {
          if (!mapSub.active) return;
          if (key === '_') return; // Skip Gun metadata
          
          if (!data) {
            // Item was removed, we need to handle this
            seenKeys.delete(key);
            // Could emit a removal event here if needed
            return;
          }
          
          // Add the key to the data for context
          const valueWithKey = { ...data, _key: key };
          seenKeys.add(key);
          
          // Emit to handlers
          mapSub.handlers.forEach(handler => {
            try {
              handler(valueWithKey);
            } catch (err) {
              console.error('Error in Gun map subscription handler:', err);
            }
          });
          
          // Send to stream
          controller.enqueue(valueWithKey);
        });
      },
      cancel: () => {
        mapSub.unsubscribe();
      }
    });
    
    return mapSub;
  }
  
  /**
   * Transform this subscription to a JSON-compatible object
   * @param initialValue Optional initial value to use before data arrives
   * @returns A subscription that emits the full object
   */
  public asObject(initialValue: Record<string, any> = {}): GunSubscription<Record<string, any>> {
    const objSub = new GunSubscription<Record<string, any>>([]);
    objSub.hasValue = true;
    objSub.lastValue = initialValue;
    
    // Track the current state
    let currentState = { ...initialValue };
    
    // Create the stream
    objSub.stream = new ReadableStream<Record<string, any>>({
      start: (controller) => {
        // Start by emitting the initial value
        controller.enqueue(currentState);
        
        // Set up subscription to each property
        this.gunRef.map().on((data: any, key: string) => {
          if (!objSub.active) return;
          if (key === '_') return; // Skip Gun metadata
          
          // Update the state with this property
          if (data === null || data === undefined) {
            // Property was removed
            delete currentState[key];
          } else {
            currentState[key] = data;
          }
          
          // Clone to avoid reference issues
          const newState = { ...currentState };
          objSub.lastValue = newState;
          
          // Emit to handlers
          objSub.handlers.forEach(handler => {
            try {
              handler(newState);
            } catch (err) {
              console.error('Error in object subscription handler:', err);
            }
          });
          
          // Send to stream
          controller.enqueue(newState);
        });
      },
      cancel: () => {
        objSub.unsubscribe();
      }
    });
    
    return objSub;
  }
} 