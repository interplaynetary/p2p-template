import { Coordinator } from './Coordinator';
import { user, recallUser, authenticate, logout} from './gun/gunSetup';
import './style.css';
import $ from 'jquery';
import encodeQR from '@paulmillr/qr';
import decodeQR from '@paulmillr/qr/decode.js';

let coordinator: Coordinator | undefined;

// Initialize function that handles recall and coordinator initialization
async function initializeApp() {
    console.log('Starting coordinator initialization...');    
    console.log('Attempting to recall user session');
    await recallUser();
    // Check if the user is authenticated after recall
    if (user.is && user.is.pub) {
        console.log('User session recalled successfully', user.is.pub);
        const authContainer = document.getElementById('auth-container');
        if (authContainer) {
            authContainer.classList.add('hidden');
        }
        
        try {
            console.log('Initializing coordinator with authenticated user');
            coordinator = new Coordinator();
            await coordinator.initialize();
            console.log('Coordinator initialized after session recall:', coordinator);
            
            // Only enable UI interactions after coordinator is fully initialized
            setupUIHandlers();
        } catch (error) {
            console.error('Failed to initialize coordinator after session recall:', error);
            // Show auth container if coordinator initialization fails
            if (authContainer) {
                authContainer.classList.remove('hidden');
            }
        }
    } else {
        console.log('No valid user session found, showing login form');
        // Show auth container if no user session
        const authContainer = document.getElementById('auth-container');
        if (authContainer) {
            authContainer.classList.remove('hidden');
        }
    }
}

async function handleAuth(event: Event) {
    event.preventDefault();
    console.log('Auth handler started');
    const username = (document.getElementById('username') as HTMLInputElement).value;
    const password = (document.getElementById('password') as HTMLInputElement).value;

    try {
        await authenticate(username, password);
        console.log('Login successful');
    } catch(error) {
        console.log('Auth failed:', error);
        alert('Authentication failed. Please try again.');
        return;
    }

    const authContainer = document.getElementById('auth-container');
    if (!authContainer) {
        console.error('Auth container not found');
        return;
    }
    authContainer.classList.add('hidden');
    console.log('Auth container hidden');

    try {
        // Initialize coordinator with proper await
        coordinator = new Coordinator();
        await coordinator.initialize();  // Wait for initialization
        console.log('Coordinator initialized:', coordinator);

        // Only enable UI interactions after coordinator is fully initialized
        setupUIHandlers();
    } catch (error) {
        console.error('Failed to initialize coordinator:', error);
    }
}

// Move all UI handlers into a separate function
function setupUIHandlers() {
    // Define texts array
    const addNodeTexts = ['Add Value', 'Add Goal', 'Add Dependency', 'Add Desire', 'Add Strategy'];
    let currentTextIndex = 0;

    // Menu button and drop-zone handlers
    $('.menu-button, .drop-zone').on('click', function(e) {
        if (!coordinator) {
            console.error('Coordinator not initialized yet');
            return;
        }
        console.log('Menu/drop-zone clicked');
        console.log('coordinator exists:', coordinator);
        console.log('coordinator treemap exists:', (coordinator?.treemap));
        const formId = $(this).data('form');
        if (!formId) return; // Skip if no form ID is set
        
        // If this is the add node form, cycle text first
        if (formId === 'addNode') {
            currentTextIndex = (currentTextIndex + 1) % addNodeTexts.length;
            $('.cycle-text').text(addNodeTexts[currentTextIndex]);
            $('#addNodeForm h2').text(addNodeTexts[currentTextIndex]);
        }
        
        // Then open the form
        $('.popup-form').hide();
        $(`#${formId}Form`).show();
        $('.node-popup').addClass('active');

        if (formId === 'addNode') {
            const hasChildren = coordinator?.currentView?.hasChildren;
            console.log('currentViewData:', coordinator?.currentView.data);  // Debug log
            console.log('currentView:', coordinator?.currentView.data.name);  // Debug log
        
            $('#percentageGroup').toggle(hasChildren);
        }

        if (formId === 'revealQR') {
            generateQRCode();
        }
    });

    // Form submission handler
    $('#addNodeForm').on('submit', async function(e) {
        e.preventDefault();
        if (!coordinator) {
            console.error('Coordinator not initialized yet');
            return;
        }
        console.log('Form submitted');
        console.log('coordinator exists:', coordinator);
        console.log('coordinator treemap exists:', (coordinator?.treemap));
        const name = $('#nodeName').val();
        const currentViewData = coordinator?.currentView.data;
        
        const hasChildren = currentViewData.hasChildren;
        const percentage = hasChildren ? Number($('#nodePercentage').val()) : 100;
        
        if (hasChildren && (percentage <= 0 || percentage >= 100)) {
            alert('Percentage must be between 1 and 99');
            return;
        }
        
        const currentTotal = currentViewData.totalChildPoints || currentViewData.points || 100;
        const points = hasChildren ? 
            Math.max(1, Math.ceil(currentTotal / (1 - percentage/100)) - currentTotal) : 
            currentTotal;
        
        console.log('Adding node to:', currentViewData.name);  // Debug log
        currentViewData.addChild(name, points);
        
        // Update visualizations
        await coordinator?.updateVisualizations();
        
        // Close and reset form
        $('.node-popup').removeClass('active');
        ($('#addNodeForm')[0] as HTMLFormElement).reset();
    });

    // Menu button handlers - moved out of DOMContentLoaded
    $('.menu-button').on('click', function(e) {
        const formId = $(this).data('form');
        if (!formId) return;
        
        console.log('Menu button clicked:', formId); // Debug log
        $(`#${formId}Form`).show();
    });

    // Range input handler
    $('#nodePercentage').on('input', function() {
        $(this).next('output').text($(this).val() + '%');
    });

    // Cancel buttons
    $('.cancel').on('click', function() {
        $('.node-popup').removeClass('active');
        ($('#addNodeForm')[0] as HTMLFormElement).reset();
    });

    // Copy key handler
    $('.copy-key').on('click', function() {
        const publicKey = $('#public-key-text').text();
        navigator.clipboard.writeText(publicKey)
            .then(() => alert('Public key copied to clipboard!'));
    });

    function generateQRCode() {
        // Use the existing 'player' Gun reciever instance
        const publicKey = user.is?.pub;  // Add optional chaining for safety
        
        if (!publicKey) {
            console.log('Reciever not logged in yet');
            return;
        }
        
        $('#qr-code').empty();
        const qrSvg = encodeQR(publicKey, 'svg', { 
            scale: 4, 
            ecc: 'high' 
        });
        $('#qr-code').append(qrSvg);
        $('#public-key-text').text(publicKey);
    }

    // Add keyboard event listener for Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const treemap = coordinator?.treemap;  // Get treemap instance from coordinator
            if (treemap) {
                const currentView = treemap.getCurrentView();  // Use treemap's method to get current view
                
                if (currentView && currentView.parent) {
                    treemap.zoomout(currentView);  // Use treemap's zoomout method directly
                }
            }
        }
    });

    // QR code scanning functionality
    let videoStream: MediaStream | null = null;
    let scanInterval: number | null = null;

    // QR Tab switching functionality
    $('.tab-button').on('click', function() {
        const tabId = $(this).data('tab');
        $('.tab-button').removeClass('active');
        $(this).addClass('active');
        $('.tab-content').hide();
        $(`#${tabId}`).show();
        
        // If discover tab is clicked, automatically trigger user discovery
        if (tabId === 'discover-tab') {
            $('#discover-users-tab').trigger('click');
        }
    });

    // Discover users from tab button
    $('#discover-users-tab').on('click', function() {
        $('#discover-users').trigger('click');
    });

    // Start camera for QR scanning
    $('.menu-button[data-form="scanQR"]').on('click', function() {
        startQRScanner();
    });

    function startQRScanner() {
        const video = document.getElementById('qr-video') as HTMLVideoElement;
        const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        const scanResult = document.getElementById('scan-result');

        if (!ctx || !scanResult) return;

        // Stop any existing scanner
        stopQRScanner();

        // Request camera access
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                videoStream = stream;
                video.srcObject = stream;
                video.play();

                // Set canvas size to match video
                video.onloadedmetadata = () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                };

                // Start scanning for QR codes
                scanInterval = window.setInterval(() => {
                    if (video.readyState === video.HAVE_ENOUGH_DATA) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        
                        try {
                            const result = decodeQR(imageData);
                            if (result) {
                                stopQRScanner();
                                scanResult.textContent = `Found: ${result}`;
                                $('#manual-key').val(result);
                            }
                        } catch (error) {
                            // No QR code found, continue scanning
                        }
                    }
                }, 500);
            })
            .catch(error => {
                console.error('Camera access error:', error);
                scanResult.textContent = 'Camera access denied or error occurred';
            });
    }

    function stopQRScanner() {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
        }
        
        if (scanInterval !== null) {
            window.clearInterval(scanInterval);
            scanInterval = null;
        }
    }

    // Logout button handler
    $('#logout').on('click', function() {
        logout();
        location.reload(); // Refresh the page to show login screen
    });

    // Add click handler to close popups when clicking outside the form
    $('.node-popup').on('click', function(e) {
        // Only close if clicking the overlay itself, not its children
        if (e.target === this) {
            // Check if inventory form is visible and has unsaved changes
            if ($('#inventoryForm').is(':visible')) {
                const hasChanges = checkForInventoryChanges();
                
                if (hasChanges) {
                    // Ask for confirmation before closing
                    if (confirm('You have unsaved changes. Are you sure you want to close?')) {
                        $('.node-popup').removeClass('active');
                    }
                } else {
                    // No changes, close directly
                    $('.node-popup').removeClass('active');
                }
            } else {
                // Not inventory form, close directly
                $('.node-popup').removeClass('active');
            }
        }
    });
    
    // Helper function to check for unsaved changes in the inventory form
    function checkForInventoryChanges(): boolean {
        // Check if any input fields have been modified
        const modifiedInputs = $('#inventoryForm input').filter(function() {
            return ($(this).val() !== '' && $(this).val() !== $(this).prop('defaultValue'));
        });
        
        // Return true if any inputs have been modified
        return modifiedInputs.length > 0;
    }
    
    // Prevent form clicks from propagating to the overlay
    $('.node-popup-content').on('click', function(e) {
        e.stopPropagation();
    });
    
    // Also update the ESC key handler with the same logic
    $(document).on('keydown', function(e) {
        // Check if popup is active and ESC key was pressed
        if ($('.node-popup').hasClass('active') && e.key === 'Escape') {
            // Check if inventory form is visible and has unsaved changes
            if ($('#inventoryForm').is(':visible')) {
                const hasChanges = checkForInventoryChanges();
                
                if (hasChanges) {
                    // Ask for confirmation before closing
                    if (confirm('You have unsaved changes. Are you sure you want to close?')) {
                        $('.node-popup').removeClass('active');
                    }
                } else {
                    // No changes, close directly
                    $('.node-popup').removeClass('active');
                }
            } else {
                // Not inventory form, close directly
                $('.node-popup').removeClass('active');
            }
        }
    });
}

// Wait for DOM to be fully loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');
    
    // Try to initialize the coordinator with recalled user session
    initializeApp();
    
    // Attach auth form submission event
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', handleAuth);
    } else {
        console.error('Auth form not found in DOM');
    }
});

// Add this to your existing script section
const messageInput = document.getElementById('message-input');
if (messageInput) {
    messageInput.addEventListener('input', function(e) {
        // Reset height to auto to get the right scrollHeight
        this.style.height = 'auto';
        // Set new height based on content
        this.style.height = (this.scrollHeight) + 'px';
    });
}

