// Gesture handling utility for improved touch interactions
import { createGesture } from '@use-gesture/vanilla';

/**
 * Maps common touch gestures to callback functions for TreeMap nodes
 * @param {HTMLElement} element - The DOM element to attach gestures to
 * @param {Object} handlers - Object containing gesture handlers
 * @param {Function} handlers.onPan - Called during panning with (dx, dy, event)
 * @param {Function} handlers.onPinch - Called during pinching with (scale, origin, event)
 * @param {Function} handlers.onTap - Called on tap with (event, position)
 * @param {Function} handlers.onLongPress - Called on long press with (event, position)
 * @param {Function} handlers.onDoubleTap - Called on double tap with (event, position)
 * @param {Object} options - Additional configuration options
 * @returns {Function} Cleanup function to remove gesture handlers
 */
export function attachNodeGestures(element, handlers = {}, options = {}) {
    const {
        onPan,
        onPinch,
        onTap,
        onLongPress,
        onDoubleTap
    } = handlers;

    // Default configuration
    const config = {
        longPressDelay: 500,
        doubleTapDelay: 300,
        panThreshold: 3,
        ...options
    };

    // Track gesture state
    let touchStartTime = 0;
    let lastTapTime = 0;
    let longPressTimer = null;
    let initialTouchPosition = { x: 0, y: 0 };
    let isPanning = false;
    let isPinching = false;

    // Create the gesture handler
    const gesture = createGesture(
        element,
        {
            // Handle drag/pan gesture
            onDrag: ({ movement: [mx, my], first, last, event, pinching }) => {
                // Don't handle pan if pinching
                if (pinching) {
                    isPinching = true;
                    return;
                }

                // Handle start of drag
                if (first) {
                    // Clear long press timer if panning starts
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                    
                    // Only start panning if movement exceeds threshold
                    if (Math.abs(mx) > config.panThreshold || 
                        Math.abs(my) > config.panThreshold) {
                        isPanning = true;
                    }
                }

                // Call pan handler if panning
                if (isPanning && onPan) {
                    onPan(mx, my, event);
                }

                // Handle end of drag
                if (last) {
                    isPanning = false;
                }

                // Prevent default to avoid text selection, etc.
                event.preventDefault();
            },

            // Handle pinch gesture
            onPinch: ({ origin, movement: [scale], first, last, event }) => {
                isPinching = true;

                // Clear long press timer if pinching starts
                if (first && longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }

                // Call pinch handler
                if (onPinch) {
                    onPinch(scale, origin, event);
                }

                // Reset state when pinch ends
                if (last) {
                    isPinching = false;
                }

                event.preventDefault();
            },

            // Handle basic pointerdown
            onPointerDown: ({ event }) => {
                touchStartTime = Date.now();
                initialTouchPosition = {
                    x: event.clientX,
                    y: event.clientY
                };

                // Set up long press timer
                if (onLongPress) {
                    longPressTimer = setTimeout(() => {
                        // Only trigger if we haven't started panning or pinching
                        if (!isPanning && !isPinching) {
                            onLongPress(event, initialTouchPosition);
                        }
                        longPressTimer = null;
                    }, config.longPressDelay);
                }
            },

            // Handle basic pointerup
            onPointerUp: ({ event }) => {
                const touchDuration = Date.now() - touchStartTime;
                const position = {
                    x: event.clientX,
                    y: event.clientY
                };

                // Clear long press timer
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }

                // Don't handle tap if we were panning or pinching
                if (isPanning || isPinching) {
                    return;
                }

                // Short touches are taps
                if (touchDuration < config.longPressDelay) {
                    const now = Date.now();
                    
                    // Check for double tap
                    if (onDoubleTap && now - lastTapTime < config.doubleTapDelay) {
                        onDoubleTap(event, position);
                        lastTapTime = 0; // Reset to prevent triple tap
                    } else {
                        // Single tap
                        if (onTap) {
                            onTap(event, position);
                        }
                        lastTapTime = now;
                    }
                }
            }
        },
        {
            // Additional configuration for the gesture handler
            drag: {
                filterTaps: true,
                threshold: config.panThreshold
            },
            pinch: {
                threshold: 0
            },
            eventOptions: {
                passive: false // Needed to prevent default scrolling
            }
        }
    );

    // Return cleanup function
    return () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
        }
        gesture.destroy();
    };
}

/**
 * Creates gesture handlers specifically for TreeMap nodes
 * @param {Object} node - D3 node object
 * @param {Object} options - Configuration for node behavior
 * @returns {Object} Gesture handler functions
 */
export function createTreeMapNodeGestures(node, options = {}) {
    const {
        onZoomIn,
        onZoomOut,
        onGrow,
        onShrink,
        isRoot,
        growthRate = 0.05
    } = options;

    // Growth state
    let isGrowing = false;
    let growthInterval = null;
    const GROWTH_TICK = 50;

    // Create gesture handlers
    return {
        onTap: (event) => {
            // Prevent growing from triggering navigation
            if (isGrowing) return;
            
            if (isRoot && node.parent) {
                // If this is the root rectangle and has a parent, zoom out
                if (onZoomOut) onZoomOut(node);
            } else if (!isRoot) {
                // If this is not the root, zoom in
                if (onZoomIn) onZoomIn(node);
            }
            
            event.stopPropagation();
        },
        
        onLongPress: (event) => {
            // Start growing the node
            isGrowing = true;
            
            // Clear any existing interval
            if (growthInterval) clearInterval(growthInterval);
            
            // Set up growth interval
            growthInterval = setInterval(() => {
                if (onGrow) onGrow(node, growthRate * node.data.points);
            }, GROWTH_TICK);
            
            event.stopPropagation();
        },
        
        onPinch: (scale, origin, event) => {
            // Handle pinch to zoom (future enhancement)
            // This could be implemented to zoom the entire treemap view
            event.stopPropagation();
        },
        
        onDoubleTap: (event) => {
            // Double tap to shrink the node
            if (onShrink) onShrink(node, growthRate * node.data.points);
            event.stopPropagation();
        }
    };
}

/**
 * Detect if the browser supports touch events
 * @returns {Boolean} True if touch is supported
 */
export function isTouchDevice() {
    return (('ontouchstart' in window) ||
       (navigator.maxTouchPoints > 0) ||
       (navigator.msMaxTouchPoints > 0));
} 