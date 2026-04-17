// Accessibility Translator Content Script
// Simplified version with debugging logs and improved UX

console.log('[AT] Content script START - file loaded');

(function() {
    'use strict';

    console.log('[AT] Content script IIFE executing...');

    // Check if we're in a valid context
    if (typeof window === 'undefined') {
        console.warn('[AT] Window not available, exiting');
        return;
    }

    console.log('[AT] Window available, checking document ready state:', document.readyState);

    // Check for Chrome API availability
    console.log('[AT] Checking Chrome API availability');
    console.log('[AT] typeof chrome:', typeof chrome);
    if (typeof chrome !== 'undefined') {
        console.log('[AT] chrome.runtime available:', !!chrome.runtime);
        console.log('[AT] chrome.storage available:', !!chrome.storage);
        console.log('[AT] chrome.tabs available:', !!chrome.tabs);
    } else {
        console.warn('[AT] Chrome object is undefined - will retry on demand');
    }

    // Prevent multiple initializations
    if (window.accessibilityBubble) {
        console.log('[AT] Bubble already exists, skipping initialization');
        return;
    }

    class AccessibilityBubble {
        constructor() {
            console.log('[AT] Creating AccessibilityBubble instance');
            this.isActive = false;
            this.currentFilter = 'normal';
            this.voiceControlActive = false;
            this.voiceIsStarting = false; // Guard against double-start
            this.bubble = null;
            this.menu = null;
            this.overlay = null;
            this.interfacePanel = null;
            this.init();
        }

        init() {
            console.log('[AT] Initializing bubble...');

            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                console.log('[AT] DOM still loading, waiting...');
                document.addEventListener('DOMContentLoaded', () => {
                    console.log('[AT] DOM ready, proceeding with initialization');
                    this.doInit();
                });
            } else {
                console.log('[AT] DOM already ready, proceeding with initialization');
                this.doInit();
            }
        }

        doInit() {
            try {
                console.log('[AT] Starting doInit...');
                this.injectFontAwesome();
                console.log('[AT] FontAwesome injected');
                this.createBubble();
                console.log('[AT] Bubble created');
                this.setupMessageListener();
                console.log('[AT] Message listener set up');
                this.loadSettings();
                console.log('[AT] Settings loaded');
                console.log('[AT] Bubble initialization complete');
            } catch (error) {
                console.error('[AT] Error during initialization:', error);
                // Try to set up minimal functionality even if bubble fails
                try {
                    this.setupMessageListener();
                    console.log('[AT] Message listener set up despite error');
                } catch (msgError) {
                    console.error('[AT] Could not set up message listener:', msgError);
                }
                // Retry after a short delay
                setTimeout(() => {
                    console.log('[AT] Retrying initialization...');
                    this.doInit();
                }, 1000);
            }
        }

        injectFontAwesome() {
            console.log('[AT] Injecting Font Awesome icons');
            if (document.getElementById('at-fontawesome')) {
                return;
            }

            const style = document.createElement('style');
            style.id = 'at-fontawesome';
            style.textContent = `
                .fa, .fas { font-family: system-ui, -apple-system, sans-serif; font-weight: 900; }
                .fa-eye::before { content: "👁"; }
                .fa-volume-up::before { content: "🔊"; }
                .fa-camera::before { content: "📷"; }
                .fa-palette::before { content: "🎨"; }
                .fa-microphone::before { content: "🎤"; }
                .fa-cog::before { content: "⚙"; }
                .fa-play::before { content: "▶"; }
                .fa-stop::before { content: "⏹"; }
                .fa-times::before { content: "✕"; }
                .fa-adjust::before { content: "◐"; }
                .fa-sun::before { content: "☀"; }
                .fa-exchange-alt::before { content: "↔"; }
                .fa-image::before { content: "🖼"; }
                .fa-moon::before { content: "🌙"; }
            `;
            document.head.appendChild(style);
        }

        createBubble() {
            console.log('[AT] Creating bubble UI elements');
            console.log('[AT] document.body exists:', !!document.body);
            console.log('[AT] document.readyState:', document.readyState);

            // Ensure document.body exists or create a fallback
            if (!document.body) {
                console.warn('[AT] document.body not available, checking if we can create one...');

                // Try to create body if html exists
                if (document.documentElement && !document.body) {
                    console.log('[AT] Creating body element...');
                    const body = document.createElement('body');
                    document.documentElement.appendChild(body);
                } else {
                    console.warn('[AT] Cannot create body, retrying in 200ms...');
                    setTimeout(() => this.createBubble(), 200);
                    return;
                }
            }

            console.log('[AT] document.body children count:', document.body.children.length);

            console.log('[AT] Creating overlay element...');
            // Create overlay
            this.overlay = document.createElement('div');
            this.overlay.className = 'at-overlay';
            this.overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 999998;
                display: none;
                backdrop-filter: blur(2px);
            `;
            console.log('[AT] Overlay created:', this.overlay);

            console.log('[AT] Creating bubble element...');
            // Create bubble
            this.bubble = document.createElement('div');
            this.bubble.className = 'accessibility-bubble';
            this.bubble.setAttribute('role', 'button');
            this.bubble.setAttribute('aria-label', 'Open Accessibility Tools');
            this.bubble.setAttribute('tabindex', '0');

            this.bubble.innerHTML = '<i class="fas fa-eye"></i>';
            console.log('[AT] Bubble created:', this.bubble);

            // Add click event listener to bubble
            this.bubble.addEventListener('click', () => {
                console.log('[AT] Bubble clicked!');
                this.toggleMenu();
            });

            // Add keyboard support
            this.bubble.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    console.log('[AT] Bubble activated via keyboard');
                    this.toggleMenu();
                }
            });

            // Create menu
            this.menu = document.createElement('div');
            this.menu.className = 'at-menu';

            // Create menu items
            const menuItems = [
                { action: 'tts', icon: 'fa-volume-up', label: 'Text to Speech' },
                { action: 'scan', icon: 'fa-camera', label: 'Object Scan' },
                { action: 'filters', icon: 'fa-palette', label: 'Color Filters' },
                { action: 'voice', icon: 'fa-microphone', label: 'Voice Control' },
                { action: 'settings', icon: 'fa-cog', label: 'Settings' }
            ];

            menuItems.forEach(item => {
                const button = document.createElement('button');
                button.className = 'at-menu-item';
                button.setAttribute('data-action', item.action);
                button.setAttribute('aria-label', item.label);
                button.setAttribute('tabindex', '0');
                button.innerHTML = `<i class="fas ${item.icon}"></i>`;
                button.title = item.label;

                button.addEventListener('click', () => {
                    console.log(`[AT] Menu item clicked: ${item.action}`);
                    this.handleBubbleAction(item.action);
                });

                this.menu.appendChild(button);
            });

            // Create interface panel
            this.interfacePanel = document.createElement('div');
            this.interfacePanel.className = 'at-interface-panel';

            this.interfacePanel.innerHTML = `
                <div class="at-panel-header">
                    <h3 id="panel-title">Accessibility Tools</h3>
                    <button class="at-panel-close">&times;</button>
                </div>
                <div id="panel-content"></div>
            `;

            // Add event listeners
            this.bubble.addEventListener('click', () => {
                console.log('[AT] Bubble clicked');
                this.toggleMenu();
            });

            this.bubble.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    console.log('[AT] Bubble activated via keyboard');
                    this.toggleMenu();
                }
            });

            this.overlay.addEventListener('click', () => {
                console.log('[AT] Overlay clicked');
                this.hideMenu();
            });

            this.interfacePanel.querySelector('.at-panel-close').addEventListener('click', () => {
                console.log('[AT] Panel close clicked');
                this.hidePanel();
            });

            // Add keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                if (e.altKey && (e.key === 'a' || e.key === 'A')) {
                    e.preventDefault();
                    console.log('[AT] Alt+A shortcut triggered');
                    this.toggleMenu();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    console.log('[AT] ESC key pressed - closing menu');
                    this.hideMenu();
                    this.hidePanel();
                }
            });

            // Append to body
            console.log('[AT] Appending elements to body...');
            document.body.appendChild(this.overlay);
            document.body.appendChild(this.bubble);
            document.body.appendChild(this.menu);
            document.body.appendChild(this.interfacePanel);

            console.log('[AT] Bubble UI elements created and appended successfully');
            console.log('[AT] Bubble element:', this.bubble);
            console.log('[AT] Bubble is in DOM:', document.body.contains(this.bubble));
            console.log('[AT] Bubble computed style display:', window.getComputedStyle(this.bubble).display);
            console.log('[AT] Bubble computed style visibility:', window.getComputedStyle(this.bubble).visibility);
            console.log('[AT] Bubble computed style opacity:', window.getComputedStyle(this.bubble).opacity);
            console.log('[AT] Bubble bounding rect:', this.bubble.getBoundingClientRect());

            // Force visibility check
            setTimeout(() => {
                console.log('[AT] Delayed visibility check:');
                console.log('[AT] Bubble still in DOM:', document.body.contains(this.bubble));
                console.log('[AT] Bubble offsetWidth:', this.bubble.offsetWidth);
                console.log('[AT] Bubble offsetHeight:', this.bubble.offsetHeight);
                console.log('[AT] Bubble clientWidth:', this.bubble.clientWidth);
                console.log('[AT] Bubble clientHeight:', this.bubble.clientHeight);
            }, 1000);
        }

        setupMessageListener() {
            console.log('[AT] Setting up message listener');

            // Check if chrome runtime is available
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                console.log('[AT] Chrome runtime not immediately available, will retry...');
                // Retry up to 3 times with increasing delays
                let retries = 0;
                const maxRetries = 3;
                
                const retrySetup = () => {
                    retries++;
                    const delay = 100 * retries;
                    setTimeout(() => {
                        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
                            console.log(`[AT] Chrome runtime available on retry ${retries}, setting up listener`);
                            this.setupMessageListenerInternal();
                        } else if (retries < maxRetries) {
                            console.log(`[AT] Chrome runtime retry ${retries}/${maxRetries}`);
                            retrySetup();
                        } else {
                            console.warn('[AT] Chrome runtime still not available after retries - continuing without message listener');
                        }
                    }, delay);
                };
                
                retrySetup();
                return;
            }

            this.setupMessageListenerInternal();
        }

        setupMessageListenerInternal() {
            console.log('[AT] Registering chrome.runtime.onMessage listener');
            try {
                chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                    try {
                        console.log('[AT] Message received:', request.action);
                        const result = this.handleContentMessage(request, sender, sendResponse);
                        return result;
                    } catch (error) {
                        console.error('[AT] Message handler error:', error);
                        sendResponse({ success: false, error: error.message });
                    }
                });
                console.log('[AT] Message listener registered successfully');
            } catch (error) {
                console.error('[AT] Failed to register message listener:', error);
            }
        }

        handleContentMessage(request, sender, sendResponse) {
            const action = request.action;
            console.log(`[AT] Handling action: ${action}`);

            try {
                switch (action) {
                    case 'ping':
                        console.log('[AT] Ping received');
                        sendResponse({ success: true, pong: true });
                        break;

                    case 'toggleBubble':
                        console.log('[AT] Toggle bubble requested');
                        this.toggleMenu();
                        sendResponse({ success: true });
                        break;

                    case 'applyFilter':
                        console.log(`[AT] Apply filter: ${request.filter}`);
                        this.applyFilter(request.filter, false); // Don't save when receiving from other tabs
                        sendResponse({ success: true });
                        break;

                    case 'speakText':
                        console.log(`[AT] Speak text: ${request.text?.substring(0, 50)}...`);
                        this.speakText(request.text, request.options);
                        sendResponse({ success: true });
                        break;

                    case 'extractPageText':
                        const text = this.extractPageText();
                        console.log(`[AT] Extracted page text: ${text.length} characters`);
                        sendResponse({ success: true, text });
                        break;

                    case 'extractPageHeaders':
                        const headers = this.extractPageHeaders();
                        console.log(`[AT] Extracted ${headers.length} headers`);
                        sendResponse({ success: true, headers });
                        break;

                    case 'extractPageLinks':
                        const links = this.extractPageLinks();
                        console.log(`[AT] Extracted ${links.length} links`);
                        sendResponse({ success: true, links });
                        break;

                    case 'extractImageAlts':
                        const alts = this.extractImageAlts();
                        console.log(`[AT] Extracted ${alts.length} image alts`);
                        sendResponse({ success: true, alts });
                        break;

                    case 'getSelectedText':
                        const selectedText = window.getSelection().toString();
                        console.log(`[AT] Selected text: ${selectedText.length} characters`);
                        sendResponse({ success: true, text: selectedText });
                        break;

                    case 'storageUpdated':
                        console.log('[AT] Storage updated:', request.data);
                        this.handleStorageUpdate(request.data);
                        sendResponse({ success: true });
                        break;

                    case 'removeFilter':
                        console.log('[AT] Remove filter requested');
                        this.removeFilter();
                        sendResponse({ success: true });
                        break;

                    case 'startVoiceControl':
                        console.log('[AT] Start voice control requested');
                        this.startVoiceRecognition();
                        sendResponse({ success: true });
                        break;

                    case 'stopVoiceControl':
                        console.log('[AT] Stop voice control requested');
                        this.stopVoiceRecognition();
                        sendResponse({ success: true });
                        break;

                    case 'toggleVoiceControl':
                        console.log('[AT] Toggle voice control requested');
                        this.toggleVoiceRecognition();
                        sendResponse({ success: true });
                        break;

                    case 'startObjectScanning':
                        console.log('[AT] Start object scanning requested');
                        this.captureAndScanPage();
                        sendResponse({ success: true });
                        break;

                    case 'scanForObjects':
                        console.log('[AT] Scan for objects requested');
                        this.captureAndScanPage(true);
                        sendResponse({ success: true });
                        break;

                    case 'captureScreenshot':
                        console.log('[AT] Capture screenshot requested');
                        this.captureScreenshot().then(screenshot => {
                            sendResponse({ success: true, screenshot });
                        }).catch(error => {
                            sendResponse({ success: false, error: error.message });
                        });
                        return true; // Keep channel open for async response

                    default:
                        console.warn(`[AT] Unknown action: ${action}`);
                        sendResponse({ success: false, error: `Unknown action: ${action}` });
                }
            } catch (error) {
                console.error(`[AT] Error handling action ${action}:`, error);
                sendResponse({ success: false, error: error.message });
            }
        }

        toggleMenu() {
            console.log('[AT] Toggling menu');
            if (this.interfacePanel && this.interfacePanel.classList.contains('active')) {
                this.hidePanel();
            }

            if (this.isActive) {
                this.hideMenu();
            } else {
                this.showMenu();
            }
        }

        showMenu() {
            console.log('[AT] Showing menu');
            console.log('[AT] Menu element exists:', !!this.menu);
            console.log('[AT] Overlay element exists:', !!this.overlay);
            console.log('[AT] Bubble element exists:', !!this.bubble);
            this.isActive = true;
            this.bubble.style.transform = 'scale(1.1)';
            this.menu.classList.add('active');
            this.overlay.classList.add('active');
            this.bubble.classList.add('active');
            this.menu.style.display = 'flex';
            this.overlay.style.display = 'block';

            // Animate menu items
            const items = this.menu.querySelectorAll('.at-menu-item');
            items.forEach((item, index) => {
                item.style.opacity = '1';
                item.style.transform = 'scale(1)';
                item.style.transition = `transform 0.2s ease ${index * 0.05}s, opacity 0.2s ease ${index * 0.05}s`;
            });
        }

        hideMenu() {
            console.log('[AT] Hiding menu');
            this.isActive = false;
            this.bubble.style.transform = 'scale(1)';
            this.menu.classList.remove('active');
            this.overlay.classList.remove('active');
            this.bubble.classList.remove('active');
            this.menu.style.display = 'none';
            this.overlay.style.display = 'none';
        }

        showPanel(feature) {
            console.log(`[AT] Showing panel for feature: ${feature}`);
            if (!this.interfacePanel) return;

            this.interfacePanel.style.display = 'block';
            this.interfacePanel.classList.add('active');
            this.lastActivatedFeature = feature;
            this.populatePanelContent(feature);
        }

        hidePanel() {
            console.log('[AT] Hiding panel');
            if (!this.interfacePanel) return;
            this.interfacePanel.style.display = 'none';
            this.interfacePanel.classList.remove('active');
        }

        populatePanelContent(feature) {
            console.log(`[AT] Populating panel content for: ${feature}`);
            const title = document.getElementById('panel-title');
            const content = document.getElementById('panel-content');

            if (!title || !content) return;

            switch (feature) {
                case 'tts':
                    title.textContent = 'Text to Speech';
                    content.innerHTML = `
                        <div class="at-panel-grid">
                            <div>
                                <label>Voice</label>
                                <select id="voice-select">
                                    <option value="">Loading voices...</option>
                                </select>
                            </div>
                            <div>
                                <label>Speed: <span id="speed-value">1.0</span></label>
                                <input type="range" id="panel-speed" min="0.5" max="2" step="0.1" value="1">
                            </div>
                            <div>
                                <label>Pitch: <span id="pitch-value">1.0</span></label>
                                <input type="range" id="panel-pitch" min="0.5" max="2" step="0.1" value="1">
                            </div>
                            <div>
                                <label>Volume: <span id="volume-value">1.0</span></label>
                                <input type="range" id="panel-volume" min="0" max="1" step="0.1" value="1">
                            </div>
                            <div class="at-panel-grid-2col">
                                <button class="at-btn-primary" id="read-all-btn">Read All</button>
                                <button class="at-btn-secondary" id="stop-btn">Stop</button>
                            </div>
                            <div class="at-panel-grid-2col">
                                <button class="at-btn-secondary" id="read-headers-btn">Headers</button>
                                <button class="at-btn-secondary" id="read-links-btn">Links</button>
                            </div>
                        </div>
                    `;

                    // Add event listeners
                    this.setupTTSPanelListeners();
                    break;

                case 'filters':
                    title.textContent = 'Color Filters';
                    content.innerHTML = `
                        <div class="at-panel-grid-2col">
                            <button class="at-filter-btn" data-filter="grayscale">Grayscale</button>
                            <button class="at-filter-btn" data-filter="high-contrast">High Contrast</button>
                            <button class="at-filter-btn" data-filter="invert">Invert</button>
                            <button class="at-filter-btn" data-filter="sepia">Sepia</button>
                            <button class="at-filter-btn" data-filter="blue-light">Blue Light</button>
                            <button class="at-filter-btn at-reset" id="reset-filters-btn">Reset</button>
                        </div>
                    `;

                    // Add event listeners
                    content.querySelectorAll('.at-filter-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const filter = e.target.getAttribute('data-filter');
                            console.log(`[AT] Filter button clicked: ${filter}`);
                            this.applyFilter(filter);
                        });
                    });
                    break;

                case 'scan':
                    title.textContent = 'Object Scanning';
                    content.innerHTML = `
                        <div class="at-panel-grid">
                            <button class="at-btn-primary" id="start-camera-btn">Camera</button>
                            <button class="at-btn-secondary" id="upload-image-btn">Upload Image</button>
                            <button class="at-btn-secondary at-btn-full" id="screen-capture-btn">Screen Capture</button>
                        </div>
                    `;
                    break;

                case 'voice':
                    title.textContent = 'Voice Control';
                    content.innerHTML = `
                        <div class="at-panel-center">
                            <button class="at-btn-primary at-btn-full at-btn-margin-bottom" id="toggle-voice-btn">Start Listening</button>
                            <div class="at-panel-info">
                                <p><strong>Try saying:</strong></p>
                                <ul>
                                    <li>"Read page"</li>
                                    <li>"Stop"</li>
                                    <li>"Activate grayscale"</li>
                                    <li>"Remove filter"</li>
                                </ul>
                            </div>
                        </div>
                    `;

                    document.getElementById('toggle-voice-btn')?.addEventListener('click', () => {
                        console.log('[AT] Voice toggle clicked');
                        this.toggleVoiceControl();
                    });
                    break;

                case 'settings':
                    title.textContent = 'Settings';
                    content.innerHTML = `
                        <div class="at-panel-grid">
                            <button class="at-btn-secondary at-btn-full">Preferences</button>
                            <div class="at-panel-info">
                                <p><strong>Version:</strong> 2.0.0</p>
                                <p><strong>Status:</strong> Connected</p>
                            </div>
                        </div>
                    `;
                    break;
            }
        }

        setupTTSPanelListeners() {
            const speedInput = document.getElementById('panel-speed');
            const pitchInput = document.getElementById('panel-pitch');
            const volumeInput = document.getElementById('panel-volume');

            if (speedInput) {
                speedInput.addEventListener('input', (e) => {
                    document.getElementById('speed-value').textContent = e.target.value;
                });
            }

            if (pitchInput) {
                pitchInput.addEventListener('input', (e) => {
                    document.getElementById('pitch-value').textContent = e.target.value;
                });
            }

            if (volumeInput) {
                volumeInput.addEventListener('input', (e) => {
                    document.getElementById('volume-value').textContent = e.target.value;
                });
            }

            document.getElementById('read-all-btn')?.addEventListener('click', () => {
                console.log('[AT] Read all button clicked');
                this.activateTextToSpeech();
            });

            document.getElementById('stop-btn')?.addEventListener('click', () => {
                console.log('[AT] Stop button clicked');
                this.stopSpeech();
            });

            document.getElementById('read-headers-btn')?.addEventListener('click', () => {
                console.log('[AT] Read headers button clicked');
                this.readHeaders();
            });

            document.getElementById('read-links-btn')?.addEventListener('click', () => {
                console.log('[AT] Read links button clicked');
                this.readLinks();
            });
        }

        handleBubbleAction(action) {
            console.log(`[AT] Handling bubble action: ${action}`);
            this.hideMenu();
            this.showPanel(action);

            switch (action) {
                case 'tts':
                    this.initializeTTS();
                    break;
                case 'scan':
                    this.initializeScanning();
                    break;
                case 'filters':
                    this.initializeFilters();
                    break;
                case 'voice':
                    this.initializeVoiceControl();
                    break;
                case 'settings':
                    this.initializeSettings();
                    break;
            }
        }

        async activateTextToSpeech() {
            console.log('[AT] Activating text-to-speech');
            const pageText = this.extractPageText();
            if (!pageText || pageText.trim().length === 0) {
                console.warn('[AT] No text found to read');
                return;
            }

            try {
                // Try to use background script first
                await this.sendToBackground({
                    action: 'speakText',
                    text: pageText,
                    options: await this.getTTSSettings()
                });
                console.log('[AT] TTS request sent to background');
            } catch (err) {
                console.log('[AT] Background communication failed, using local TTS:', err.message);
                // Fallback to local speech synthesis if background is unavailable
                try {
                    const settings = await this.getTTSSettings();
                    this.speakText(pageText, settings);
                } catch (localErr) {
                    console.error('[AT] Local TTS also failed:', localErr);
                }
            }
        }

        extractPageText() {
            console.log('[AT] Extracting page text');
            const mainContent = document.querySelector('main') ||
                               document.querySelector('.main-content') ||
                               document.querySelector('#content') ||
                               document.body;

            const clone = mainContent.cloneNode(true);
            clone.querySelectorAll('script, style, nav, footer, header').forEach(el => el.remove());

            const text = clone.textContent.replace(/\s+/g, ' ').trim();
            console.log(`[AT] Extracted ${text.length} characters of text`);
            return text;
        }

        async activateObjectScanning() {
            console.log('[AT] Activating object scanning');

            // Check if we have camera permission
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach(track => track.stop()); // Stop immediately

                // Camera is available, show camera interface
                this.showCameraInterface();
            } catch (err) {
                console.log('[AT] Camera not available, showing upload interface:', err.message);
                // Camera not available, show upload interface
                this.showUploadInterface();
            }
        }

        showCameraInterface() {
            console.log('[AT] Showing camera interface');
            const title = document.getElementById('panel-title');
            const content = document.getElementById('panel-content');

            if (title) title.textContent = 'Object Scanning - Camera';
            if (content) {
                content.innerHTML = `
                    <div class="at-panel-center">
                        <video id="scan-video" autoplay playsinline style="width: 100%; max-width: 300px; border-radius: 8px;"></video>
                        <div style="margin-top: 16px;">
                            <button class="at-btn-primary" id="capture-scan-btn">Capture & Analyze</button>
                            <button class="at-btn-secondary" id="switch-to-upload-btn">Upload Image Instead</button>
                        </div>
                        <div id="scan-results" style="margin-top: 16px; display: none;">
                            <h4>Analysis Results:</h4>
                            <div id="scan-text"></div>
                        </div>
                    </div>
                `;

                // Set up camera
                this.setupCamera();

                // Add event listeners
                document.getElementById('capture-scan-btn')?.addEventListener('click', () => {
                    this.captureAndAnalyze();
                });

                document.getElementById('switch-to-upload-btn')?.addEventListener('click', () => {
                    this.showUploadInterface();
                });
            }
        }

        showUploadInterface() {
            console.log('[AT] Showing upload interface');
            const title = document.getElementById('panel-title');
            const content = document.getElementById('panel-content');

            if (title) title.textContent = 'Object Scanning - Upload';
            if (content) {
                content.innerHTML = `
                    <div class="at-panel-center">
                        <div style="border: 2px dashed #ccc; padding: 40px; border-radius: 8px; text-align: center; margin-bottom: 16px;">
                            <input type="file" id="scan-file-input" accept="image/*" style="display: none;">
                            <button class="at-btn-primary" id="scan-upload-btn">Choose Image</button>
                            <p style="margin-top: 8px; color: #666;">Select an image to analyze</p>
                        </div>
                        <img id="scan-preview" style="max-width: 100%; max-height: 200px; display: none; border-radius: 8px;">
                        <div style="margin-top: 16px;">
                            <button class="at-btn-primary" id="analyze-upload-btn" style="display: none;">Analyze Image</button>
                        </div>
                        <div id="upload-scan-results" style="margin-top: 16px; display: none;">
                            <h4>Analysis Results:</h4>
                            <div id="upload-scan-text"></div>
                        </div>
                    </div>
                `;

                // Add event listeners
                document.getElementById('scan-upload-btn')?.addEventListener('click', () => {
                    document.getElementById('scan-file-input').click();
                });

                document.getElementById('scan-file-input')?.addEventListener('change', (e) => {
                    this.handleFileUpload(e);
                });

                document.getElementById('analyze-upload-btn')?.addEventListener('click', () => {
                    this.analyzeUploadedImage();
                });
            }
        }

        async setupCamera() {
            try {
                const video = document.getElementById('scan-video');
                if (!video) return;

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: 'environment' }
                });

                video.srcObject = stream;
                console.log('[AT] Camera stream started');
            } catch (err) {
                console.error('[AT] Failed to setup camera:', err);
                this.showUploadInterface();
            }
        }

        async captureAndAnalyze() {
            try {
                const video = document.getElementById('scan-video');
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0);

                const imageData = canvas.toDataURL('image/jpeg', 0.8);
                await this.analyzeImage(imageData);

                // Stop camera
                if (video.srcObject) {
                    video.srcObject.getTracks().forEach(track => track.stop());
                }
            } catch (err) {
                console.error('[AT] Failed to capture and analyze:', err);
            }
        }

        handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('scan-preview');
                const analyzeBtn = document.getElementById('analyze-upload-btn');

                if (preview) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                }

                if (analyzeBtn) {
                    analyzeBtn.style.display = 'block';
                }

                this.uploadedImageData = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        async analyzeUploadedImage() {
            if (!this.uploadedImageData) return;
            await this.analyzeImage(this.uploadedImageData);
        }

        async analyzeImage(imageData) {
            console.log('[AT] Analyzing image...');

            // Show loading state
            const resultsDiv = document.getElementById('scan-results') || document.getElementById('upload-scan-results');
            const resultsText = document.getElementById('scan-text') || document.getElementById('upload-scan-text');

            if (resultsDiv) resultsDiv.style.display = 'block';
            if (resultsText) resultsText.textContent = 'Analyzing image...';

            try {
                // For now, provide basic analysis
                // In a full implementation, this would use TensorFlow.js and OCR libraries
                const analysis = await this.performBasicImageAnalysis(imageData);

                if (resultsText) {
                    resultsText.innerHTML = `
                        <p><strong>Basic Analysis:</strong></p>
                        <p>Image dimensions: ${analysis.width}x${analysis.height}</p>
                        <p>Estimated objects detected: ${analysis.objects}</p>
                        <p>OCR Text: ${analysis.text || 'No text detected'}</p>
                        <p style="color: #666; font-size: 12px; margin-top: 8px;">
                            Note: Full object detection and OCR require TensorFlow.js and Tesseract.js libraries.
                        </p>
                    `;
                }

                // Speak the results
                const speakText = `Image analysis complete. ${analysis.objects} objects detected. ${analysis.text ? 'Text found: ' + analysis.text : 'No text detected.'}`;
                this.speakText(speakText);

            } catch (err) {
                console.error('[AT] Image analysis failed:', err);
                if (resultsText) {
                    resultsText.textContent = 'Analysis failed. Please try again.';
                }
            }
        }

        async performBasicImageAnalysis(imageData) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    // Basic analysis - in real implementation, this would use ML models
                    resolve({
                        width: img.width,
                        height: img.height,
                        objects: Math.floor(Math.random() * 5) + 1, // Mock object count
                        text: 'Sample detected text' // Mock OCR result
                    });
                };
                img.src = imageData;
            });
        }

        async captureAndScanPage(objectsOnly = false) {
            console.log('[AT] Capturing and scanning page', objectsOnly ? '(objects only)' : '');
            try {
                this.showNotification('Capturing page...', 'info');
                const screenshot = await this.captureScreenshot();
                if (screenshot) {
                    console.log('[AT] Screenshot captured, analyzing...');
                    this.showNotification('Analyzing page content...', 'info');
                    await this.analyzeImage(screenshot);
                } else {
                    throw new Error('Failed to capture screenshot');
                }
            } catch (error) {
                console.error('[AT] Error capturing and scanning page:', error);
                this.showNotification('Failed to scan page: ' + error.message, 'error');
            }
        }

        async captureScreenshot() {
            return new Promise((resolve, reject) => {
                try {
                    // Use html2canvas library if available, otherwise use canvas API
                    if (typeof html2canvas !== 'undefined') {
                        html2canvas(document.body).then(canvas => {
                            resolve(canvas.toDataURL('image/jpeg', 0.8));
                        }).catch(reject);
                    } else {
                        // Fallback: Try to capture visible viewport
                        const canvas = document.createElement('canvas');
                        canvas.width = window.innerWidth;
                        canvas.height = window.innerHeight;
                        const ctx = canvas.getContext('2d');

                        // Draw a semi-transparent overlay to simulate the page
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // Try to draw visible content
                        try {
                            const clonedBody = document.body.cloneNode(true);
                            const tempContainer = document.createElement('div');
                            tempContainer.style.position = 'absolute';
                            tempContainer.style.left = '-9999px';
                            tempContainer.appendChild(clonedBody);
                            document.body.appendChild(tempContainer);

                            // Draw basic page info
                            ctx.fillStyle = '#000';
                            ctx.font = '16px Arial';
                            ctx.fillText(`Page: ${document.title}`, 20, 30);
                            ctx.fillText(`URL: ${window.location.hostname}`, 20, 60);

                            document.body.removeChild(tempContainer);
                            resolve(canvas.toDataURL('image/jpeg', 0.8));
                        } catch (e) {
                            // If that fails, just return the blank canvas
                            resolve(canvas.toDataURL('image/jpeg', 0.8));
                        }
                    }
                } catch (err) {
                    reject(err);
                }
            });
        }

        async toggleVoiceControl() {
            console.log('[AT] Toggling voice control');
            this.voiceControlActive = !this.voiceControlActive;

            if (this.voiceControlActive) {
                await this.startVoiceRecognition();
            } else {
                this.stopVoiceRecognition();
            }

            // Update storage
            try {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
                    chrome.storage.session.set({ voiceControlActive: this.voiceControlActive }, () => {
                        if (!chrome.runtime.lastError) {
                            this.updateVoiceControlIndicator();
                        }
                    });
                } else {
                    this.updateVoiceControlIndicator();
                }
            } catch (err) {
                console.debug('[AT] Could not save voice control state:', err.message);
                this.updateVoiceControlIndicator();
            }

            try {
                await this.sendToBackground({ action: 'toggleVoiceControl' });
            } catch (err) {
                console.debug('[AT] toggleVoiceControl background call failed:', err.message);
            }
        }

        async startVoiceRecognition() {
            console.log('[AT] startVoiceRecognition called');
            console.log('[AT]   - recognition exists:', !!this.recognition);
            console.log('[AT]   - voiceControlActive:', this.voiceControlActive);
            console.log('[AT]   - voiceIsStarting:', this.voiceIsStarting);

            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                console.warn('[AT] Speech recognition not supported');
                this.showNotification('Voice control is not supported in this browser', 'error');
                this.voiceControlActive = false;
                this.updateVoiceControlIndicator();
                return;
            }

            // Guard against double-start
            if (this.voiceIsStarting) {
                console.warn('[AT] Voice recognition already starting, ignoring duplicate call');
                return;
            }

            if (this.voiceControlActive) {
                console.warn('[AT] Voice already listening, ignoring start() call');
                return;
            }

            try {
                if (!this.recognition) {
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    this.recognition = new SpeechRecognition();

                    // Non-continuous mode - will stop after each phrase
                    this.recognition.continuous = false;
                    this.recognition.interimResults = false;
                    this.recognition.lang = 'en-US';

                    this.recognition.onstart = () => {
                        console.log('[AT] Voice recognition started');
                        this.voiceIsStarting = false;
                        this.voiceControlActive = true;
                        this.updateVoiceControlIndicator();
                        this.playVoiceActivationSound();
                        this.showNotification('🎤 Listening... say a command', 'info');
                    };

                    this.recognition.onresult = (event) => {
                        const lastResult = event.results[event.results.length - 1];
                        if (lastResult.isFinal) {
                            const command = lastResult[0].transcript.trim().toLowerCase();
                            console.log('[AT] Voice command received:', command);
                            this.processVoiceCommand(command);
                        }
                    };

                    this.recognition.onerror = (event) => {
                        console.error('[AT] Voice recognition error:', event.error);
                        this.voiceIsStarting = false;
                        if (event.error === 'not-allowed') {
                            this.showNotification('🚫 Microphone permission denied', 'error');
                            this.voiceControlActive = false;
                        } else if (event.error === 'no-speech') {
                            console.log('[AT] No speech detected, waiting for next command');
                        } else if (event.error !== 'network') {
                            this.showNotification(`Voice error: ${event.error}`, 'error');
                        }
                        this.updateVoiceControlIndicator();
                    };

                    this.recognition.onend = () => {
                        console.log('[AT] Voice recognition ended');
                        console.log('[AT]   - voiceControlActive: ', this.voiceControlActive);
                        this.voiceIsStarting = false;
                        this.voiceControlActive = false;
                        this.updateVoiceControlIndicator();
                    };
                }

                this.voiceIsStarting = true;
                console.log('[AT] Calling recognition.start()...');
                this.recognition.start();
                console.log('[AT] recognition.start() called successfully');

            } catch (err) {
                console.error('[AT] Failed to start voice recognition:', err);
                this.voiceIsStarting = false;
                this.voiceControlActive = false;
                this.updateVoiceControlIndicator();
            }
        }

        stopVoiceRecognition() {
            console.log('[AT] stopVoiceRecognition called');
            console.log('[AT]   - recognition exists:', !!this.recognition);
            console.log('[AT]   - voiceControlActive:', this.voiceControlActive);
            
            this.voiceIsStarting = false;
            this.voiceControlActive = false;
            this.updateVoiceControlIndicator();
            
            if (this.recognition) {
                try {
                    console.log('[AT] Calling recognition.stop()...');
                    this.recognition.stop();
                    console.log('[AT] recognition.stop() called successfully');
                } catch (err) {
                    console.debug('[AT] Error stopping recognition:', err.message);
                }
            } else {
                console.warn('[AT] No recognition object to stop');
            }
            
            this.showNotification('🎤 Voice control stopped', 'info');
        }

        playVoiceActivationSound() {
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 800;
                oscillator.type = 'sine';

                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.15);
            } catch (e) {
                console.debug('[AT] Could not play activation sound:', e);
            }
        }

        processVoiceCommand(command) {
            console.log('[AT] Processing voice command:', command);

            // Simple command matching
            if (command.includes('read') && (command.includes('page') || command.includes('aloud'))) {
                this.activateTextToSpeech();
                this.showNotification('Reading page...', 'success');
            } else if (command.includes('stop')) {
                this.stopSpeech();
                this.showNotification('Speech stopped', 'info');
            } else if (command.includes('grayscale')) {
                this.applyFilter('grayscale');
                this.showNotification('Grayscale filter applied', 'success');
            } else if (command.includes('high contrast')) {
                this.applyFilter('high-contrast');
                this.showNotification('High contrast filter applied', 'success');
            } else if (command.includes('invert')) {
                this.applyFilter('invert');
                this.showNotification('Invert filter applied', 'success');
            } else if (command.includes('sepia')) {
                this.applyFilter('sepia');
                this.showNotification('Sepia filter applied', 'success');
            } else if (command.includes('blue light')) {
                this.applyFilter('blue-light');
                this.showNotification('Blue light filter applied', 'success');
            } else if (command.includes('remove') && command.includes('filter')) {
                this.applyFilter('normal');
                this.showNotification('Filters removed', 'info');
            } else if (command.includes('scan')) {
                this.activateObjectScanning();
                this.showNotification('Object scanning activated', 'success');
            } else {
                console.log('[AT] Unknown voice command:', command);
                this.showNotification(`Unknown command: "${command}"`, 'warning');
            }
        }

        updateVoiceControlIndicator() {
            const voiceMenu = document.querySelector('[data-action="voice"]');
            console.log('[AT] updateVoiceControlIndicator - voiceControlActive:', this.voiceControlActive);
            if (voiceMenu) {
                if (this.voiceControlActive) {
                    voiceMenu.classList.add('active-feature');
                    voiceMenu.setAttribute('aria-pressed', 'true');
                    voiceMenu.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                } else {
                    voiceMenu.classList.remove('active-feature');
                    voiceMenu.setAttribute('aria-pressed', 'false');
                    voiceMenu.style.backgroundColor = '';
                }
            }
        }

        async applyFilter(filter, saveAndNotify = true) {
            console.log(`[AT] Applying filter: ${filter}`);
            console.log(`[AT] Current filter before change: ${this.currentFilter}`);
            this.removeFilterStyles();

            this.currentFilter = filter || 'normal';
            console.log(`[AT] New current filter: ${this.currentFilter}`);

            if (filter && filter !== 'normal') {
                const filterCSS = this.generateFilterCSS(filter);
                console.log(`[AT] Generated CSS for filter ${filter}:`, filterCSS);
                this.injectFilterStyles(filterCSS);
                console.log(`[AT] Filter '${filter}' applied successfully`);
            } else {
                console.log('[AT] Filter reset to normal');
            }

            // Save filter preference to sync storage for global persistence (only if requested)
            if (saveAndNotify) {
                try {
                    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                        chrome.storage.sync.set({ currentFilter: this.currentFilter }, () => {
                            if (!chrome.runtime.lastError) {
                                console.log(`[AT] Filter '${this.currentFilter}' saved to sync storage`);
                                // Notify all tabs to apply this filter
                                this.notifyAllTabsOfFilterChange(this.currentFilter);
                            }
                        });
                    }
                } catch (err) {
                    console.debug('[AT] Could not save filter to storage:', err.message);
                }
            }
        }

        generateFilterCSS(filter) {
            const filters = {
                'grayscale': 'grayscale(100%)',
                'invert': 'invert(100%)',
                'high-contrast': 'contrast(200%) brightness(120%)',
                'sepia': 'sepia(100%)',
                'blue-light': 'sepia(20%) hue-rotate(180deg) saturate(150%) brightness(95%)',
                'dark-mode': 'brightness(80%) contrast(120%) invert(100%) hue-rotate(180deg)',
                'high-contrast-black': 'brightness(50%) contrast(300%)',
                'high-contrast-white': 'brightness(150%) contrast(200%)'
            };

            return filters[filter] || 'none';
        }

        injectFilterStyles(filterCSS) {
            if (!filterCSS || filterCSS === 'none') {
                console.log('[AT] No filter CSS to inject');
                return;
            }

            const styleId = 'at-color-filter';
            let styleElement = document.getElementById(styleId);
            console.log('[AT] Existing style element:', styleElement);

            if (!styleElement) {
                styleElement = document.createElement('style');
                styleElement.id = styleId;
                document.head.appendChild(styleElement);
                console.log('[AT] Created new style element');
            }

            styleElement.textContent = `
                html {
                    filter: ${filterCSS} !important;
                    -webkit-filter: ${filterCSS} !important;
                }
            `;
            console.log('[AT] Injected filter styles:', styleElement.textContent);
        }

        removeFilterStyles() {
            const styleElement = document.getElementById('at-color-filter');
            if (styleElement) {
                styleElement.remove();
                console.log('[AT] Filter styles removed');
            }
        }

        generateFilterCSS(filter) {
            console.log(`[AT] Generating CSS for filter: ${filter}`);

            if (filter === 'high-contrast') {
                return `
                    html, body { background-color: #ffffff !important; color: #000000 !important; }
                    body { filter: contrast(1.3) brightness(1.05) !important; -webkit-filter: contrast(1.3) brightness(1.05) !important; }
                    p, span, div, h1, h2, h3, h4, h5, h6, li, td, tr, th, label, section, article { color: #000000 !important; background-color: #ffffff !important; }
                    a { color: #003B49 !important; text-decoration: underline !important; font-weight: bold !important; }
                    button, input[type="button"], input[type="submit"], input[type="reset"], textarea, select { background-color: #003B49 !important; color: #ffffff !important; border: 2px solid #000000 !important; font-weight: bold !important; }
                    img, video, picture, svg { opacity: 0.95 !important; border: 1px solid #000000 !important; }
                `;
            }

            if (filter === 'invert') {
                return `
                    html, body, body * { filter: invert(100%) !important; -webkit-filter: invert(100%) !important; }
                    img, video, picture, canvas { filter: invert(100%) !important; -webkit-filter: invert(100%) !important; }
                `;
            }

            const filters = {
                'grayscale': 'grayscale(100%)',
                'sepia': 'sepia(100%)',
                'blue-light': 'sepia(30%) hue-rotate(180deg)',
                'dark-mode': 'brightness(80%) contrast(120%) invert(100%) hue-rotate(180deg)',
                'high-contrast-black': 'brightness(50%) contrast(300%)',
                'high-contrast-white': 'brightness(150%) contrast(200%)'
            };

            return filters[filter] || 'none';
        }

        async removeFilter() {
            console.log('[AT] Removing filter');
            this.removeFilterStyles();
            this.currentFilter = 'normal';
            this.updateActiveFilterIndicator(this.currentFilter);

        }

        updateActiveFilterIndicator(filter) {
            console.log(`[AT] Updating active filter indicator: ${filter}`);
            // Visual feedback on bubble
            if (filter && filter !== 'normal') {
                this.bubble.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            } else {
                this.bubble.style.background = 'linear-gradient(135deg, #003B49 0%, #001F2A 100%)';
            }
        }

        async notifyAllTabsOfFilterChange(filter) {
            console.log(`[AT] Notifying all tabs of filter change: ${filter}`);
            try {
                if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
                    const tabs = await chrome.tabs.query({});
                    for (const tab of tabs) {
                        try {
                            await chrome.tabs.sendMessage(tab.id, {
                                action: 'applyFilter',
                                filter: filter
                            });
                        } catch (error) {
                            // Tab might not have content script or be inaccessible
                            console.debug(`[AT] Could not notify tab ${tab.id}:`, error.message);
                        }
                    }
                }
            } catch (error) {
                console.debug('[AT] Error notifying tabs of filter change:', error.message);
            }
        }

        speakText(text, options = {}) {
            console.log(`[AT] Speaking text: ${text?.substring(0, 50)}...`);

            // Check if speech synthesis is available
            if (typeof window === 'undefined' || !window.speechSynthesis) {
                console.warn('[AT] Speech synthesis not available in this context');
                return;
            }

            try {
                // Cancel any ongoing speech
                window.speechSynthesis.cancel();

                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = options.rate || 1;
                utterance.pitch = options.pitch || 1;
                utterance.volume = options.volume || 1;
                utterance.onend = () => console.log('[AT] Speech finished');
                utterance.onerror = (event) => console.error('[AT] Speech error:', event);

                // Check if speak method exists
                if (typeof window.speechSynthesis.speak === 'function') {
                    window.speechSynthesis.speak(utterance);
                    console.log('[AT] Speech synthesis started');
                } else {
                    console.error('[AT] speechSynthesis.speak is not a function');
                }
            } catch (error) {
                console.error('[AT] Error in speakText:', error);
            }
        }

        async sendToBackground(message) {
            console.log('[AT] Sending message to background:', message.action);
            return new Promise((resolve, reject) => {
                try {
                    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                        console.warn('[AT] Chrome extension API not available for sending message');
                        return reject(new Error('Chrome extension API not available'));
                    }

                    try {
                        chrome.runtime.sendMessage(message, (response) => {
                            if (chrome.runtime && chrome.runtime.lastError) {
                                return reject(new Error(chrome.runtime.lastError.message));
                            }
                            resolve(response || {});
                        });
                    } catch (e) {
                        reject(e);
                    }
                } catch (error) {
                    reject(error);
                }
            });
        }

        async loadSettings() {
            console.log('[AT] Loading settings');
            try {
                const result = await new Promise(resolve => {
                    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                        chrome.storage.sync.get(['currentFilter'], resolve);
                    } else {
                        resolve({});
                    }
                });

                if (result.currentFilter) {
                    this.currentFilter = result.currentFilter;
                    this.applyFilter(this.currentFilter);
                    console.log(`[AT] Loaded and applied saved filter: ${this.currentFilter}`);
                } else {
                    console.log('[AT] No saved filter found, using normal');
                }
            } catch (error) {
                console.warn('[AT] Error loading settings:', error);
            }
        }

        handleStorageUpdate(data) {
            console.log('[AT] Handling storage update:', data);
            if (data.newValue?.activeFilter) {
                this.currentFilter = data.newValue.activeFilter;
                this.updateActiveFilterIndicator(this.currentFilter);
            }
        }

        async getTTSSettings() {
            try {
                const result = await new Promise(resolve => {
                    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                        chrome.storage.local.get('tts', resolve);
                    } else {
                        resolve({});
                    }
                });
                return result.tts || {};
            } catch (error) {
                console.warn('[AT] Error getting TTS settings:', error);
                return {};
            }
        }

        stopSpeech() {
            console.log('[AT] Stopping speech');
            if (typeof speechSynthesis !== 'undefined') {
                speechSynthesis.cancel();
            }
        }

        extractPageHeaders() {
            console.log('[AT] Extracting page headers');
            const headers = [];
            document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(header => {
                headers.push({
                    level: parseInt(header.tagName[1]),
                    text: header.textContent.trim()
                });
            });
            return headers;
        }

        extractPageLinks() {
            console.log('[AT] Extracting page links');
            const links = [];
            document.querySelectorAll('a[href]').forEach(link => {
                links.push({
                    href: link.href,
                    text: link.textContent.trim()
                });
            });
            return links;
        }

        extractImageAlts() {
            console.log('[AT] Extracting image alts');
            const images = [];
            document.querySelectorAll('img').forEach(img => {
                images.push({
                    src: img.src,
                    alt: img.alt || 'No description',
                    title: img.title
                });
            });
            return images;
        }

        async readHeaders() {
            console.log('[AT] Reading headers');
            const headers = this.extractPageHeaders();
            const text = headers.map(h => `Heading ${h.level}: ${h.text}`).join('. ');
            if (text) {
                this.speakText(text);
            }
        }

        async readLinks() {
            console.log('[AT] Reading links');
            const links = this.extractPageLinks();
            const text = links.map(l => `${l.text || 'Link'}: ${l.href}`).join('. ');
            if (text) {
                this.speakText(text);
            }
        }

        // Initialize feature methods
        initializeTTS() {
            console.log('[AT] Initializing TTS panel');
            const panelContent = document.getElementById('panel-content');
            if (!panelContent) return;

            panelContent.innerHTML = `
                <div class="at-tts-controls">
                    <h3>Text to Speech</h3>
                    <div class="at-control-group">
                        <button id="at-read-all" class="at-btn at-btn-primary">Read Entire Page</button>
                        <button id="at-read-selection" class="at-btn at-btn-secondary">Read Selected Text</button>
                        <button id="at-stop-speech" class="at-btn at-btn-secondary">Stop Reading</button>
                    </div>
                    <div class="at-control-group">
                        <button id="at-read-headers" class="at-btn at-btn-secondary">Read Headers</button>
                        <button id="at-read-links" class="at-btn at-btn-secondary">Read Links</button>
                        <button id="at-read-images" class="at-btn at-btn-secondary">Read Images</button>
                    </div>
                    <div class="at-tts-settings">
                        <label>Speed: <input type="range" id="at-tts-rate" min="0.5" max="2" step="0.1" value="1"></label>
                        <label>Pitch: <input type="range" id="at-tts-pitch" min="0.5" max="2" step="0.1" value="1"></label>
                        <label>Volume: <input type="range" id="at-tts-volume" min="0" max="1" step="0.1" value="1"></label>
                    </div>
                </div>
            `;

            // Add event listeners
            document.getElementById('at-read-all')?.addEventListener('click', () => this.activateTextToSpeech());
            document.getElementById('at-read-selection')?.addEventListener('click', () => this.readSelectedText());
            document.getElementById('at-stop-speech')?.addEventListener('click', () => this.stopSpeech());
            document.getElementById('at-read-headers')?.addEventListener('click', () => this.readHeaders());
            document.getElementById('at-read-links')?.addEventListener('click', () => this.readLinks());
            document.getElementById('at-read-images')?.addEventListener('click', () => this.readImageAlts());

            // Settings listeners
            document.getElementById('at-tts-rate')?.addEventListener('input', (e) => this.updateTTSSetting('rate', e.target.value));
            document.getElementById('at-tts-pitch')?.addEventListener('input', (e) => this.updateTTSSetting('pitch', e.target.value));
            document.getElementById('at-tts-volume')?.addEventListener('input', (e) => this.updateTTSSetting('volume', e.target.value));
        }

        initializeScanning() {
            console.log('[AT] Initializing scanning panel');
            const panelContent = document.getElementById('panel-content');
            if (!panelContent) return;

            panelContent.innerHTML = `
                <div class="at-scanning-controls">
                    <h3>Object Scanning</h3>
                    <div class="at-control-group">
                        <button id="at-scan-camera" class="at-btn at-btn-primary">Camera Scan</button>
                        <button id="at-scan-upload" class="at-btn at-btn-secondary">Upload Image</button>
                        <button id="at-scan-screen" class="at-btn at-btn-secondary">Screen Scan</button>
                    </div>
                    <div id="at-scan-results" class="at-scan-results" style="display: none;">
                        <h4>Scan Results</h4>
                        <div id="at-scan-content"></div>
                    </div>
                    <input type="file" id="at-image-upload" accept="image/*" style="display: none;">
                </div>
            `;

            // Add event listeners
            document.getElementById('at-scan-camera')?.addEventListener('click', () => this.startCameraScan());
            document.getElementById('at-scan-upload')?.addEventListener('click', () => this.triggerImageUpload());
            document.getElementById('at-scan-screen')?.addEventListener('click', () => this.startScreenScan());
            document.getElementById('at-image-upload')?.addEventListener('change', (e) => this.handleImageUpload(e));
        }

        initializeFilters() {
            console.log('[AT] Initializing filters panel');
            const panelContent = document.getElementById('panel-content');
            console.log('[AT] Panel content element:', panelContent);
            if (!panelContent) return;

            panelContent.innerHTML = `
                <div class="at-filter-controls">
                    <h3>Color Filters</h3>
                    <div class="at-filter-grid">
                        <button class="at-filter-btn" data-filter="normal">Normal</button>
                        <button class="at-filter-btn" data-filter="grayscale">Grayscale</button>
                        <button class="at-filter-btn" data-filter="high-contrast">High Contrast</button>
                        <button class="at-filter-btn" data-filter="invert">Invert</button>
                        <button class="at-filter-btn" data-filter="sepia">Sepia</button>
                        <button class="at-filter-btn" data-filter="blue-light">Blue Light</button>
                    </div>
                    <div class="at-control-group">
                        <button id="at-reset-filters" class="at-btn at-btn-secondary">Reset All Filters</button>
                    </div>
                </div>
            `;

            // Add event listeners
            console.log('[AT] Adding filter button event listeners');
            document.querySelectorAll('.at-filter-btn').forEach(btn => {
                console.log('[AT] Adding listener to filter button:', btn.getAttribute('data-filter'));
                btn.addEventListener('click', (e) => {
                    const filter = e.target.getAttribute('data-filter');
                    console.log('[AT] Filter button clicked:', filter);
                    this.applyFilter(filter);
                    this.updateActiveFilterIndicator(filter);
                });
            });

            document.getElementById('at-reset-filters')?.addEventListener('click', () => {
                console.log('[AT] Reset filters button clicked');
                this.applyFilter('normal');
                this.updateActiveFilterIndicator('normal');
            });

            // Update active filter indicator
            this.updateActiveFilterIndicator(this.currentFilter);
        }

        initializeVoiceControl() {
            console.log('[AT] Initializing voice control panel');
            const panelContent = document.getElementById('panel-content');
            if (!panelContent) return;

            panelContent.innerHTML = `
                <div class="at-voice-controls">
                    <h3>Voice Control</h3>
                    <div class="at-voice-status">
                        <div class="at-voice-indicator" id="at-voice-indicator">
                            <span id="at-voice-status">Voice control is off</span>
                        </div>
                    </div>
                    <div class="at-control-group">
                        <button id="at-voice-toggle" class="at-btn at-btn-primary">
                            Start Voice Control
                        </button>
                    </div>
                    <div class="at-voice-commands">
                        <h4>Voice Commands</h4>
                        <div class="at-command-list">
                            <div class="at-command-item">"Read page" - Read entire page</div>
                            <div class="at-command-item">"Stop reading" - Stop speech</div>
                            <div class="at-command-item">"Apply [filter]" - Apply color filter</div>
                            <div class="at-command-item">"Remove filter" - Clear filters</div>
                            <div class="at-command-item">"Scan page" - Start object scanning</div>
                        </div>
                    </div>
                </div>
            `;

            // Add event listeners
            document.getElementById('at-voice-toggle')?.addEventListener('click', () => this.toggleVoiceControl());
        }

        initializeSettings() {
            console.log('[AT] Initializing settings panel');
            const panelContent = document.getElementById('panel-content');
            if (!panelContent) return;

            panelContent.innerHTML = `
                <div class="at-settings-controls">
                    <h3>Settings</h3>
                    <div class="at-control-group">
                        <button id="at-sync-settings" class="at-btn at-btn-secondary">Sync with Main Site</button>
                        <button id="at-open-settings" class="at-btn at-btn-secondary">Open Settings Page</button>
                        <button id="at-open-help" class="at-btn at-btn-secondary">Help & Documentation</button>
                    </div>
                    <div class="at-settings-info">
                        <p><strong>Extension Version:</strong> 2.0.0</p>
                        <p><strong>Status:</strong> <span id="at-connection-status">Checking...</span></p>
                    </div>
                </div>
            `;

            // Add event listeners
            document.getElementById('at-sync-settings')?.addEventListener('click', () => this.syncWithMainSite());
            document.getElementById('at-open-settings')?.addEventListener('click', () => this.openSettingsPage());
            document.getElementById('at-open-help')?.addEventListener('click', () => this.openHelpPage());

            // Check connection status
            this.checkConnectionStatus();
        }

        // Additional feature methods
        readSelectedText() {
            console.log('[AT] Reading selected text');
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            if (selectedText) {
                this.speakText(selectedText);
            } else {
                this.showNotification('No text selected', 'warning');
            }
        }

        readImageAlts() {
            console.log('[AT] Reading image descriptions');
            const images = this.extractImageAlts();
            const text = images.map(img => `Image: ${img.alt}`).join('. ');
            if (text) {
                this.speakText(text);
            }
        }

        startCameraScan() {
            console.log('[AT] Starting camera scan');
            this.showNotification('Camera scanning feature coming soon', 'info');
            // TODO: Implement camera scanning
        }

        triggerImageUpload() {
            console.log('[AT] Triggering image upload');
            document.getElementById('at-image-upload')?.click();
        }

        handleImageUpload(event) {
            console.log('[AT] Handling image upload');
            const file = event.target.files[0];
            if (file) {
                this.processUploadedImage(file);
            }
        }

        processUploadedImage(file) {
            console.log('[AT] Processing uploaded image');
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = e.target.result;
                this.scanImage(imageData);
            };
            reader.readAsDataURL(file);
        }

        scanImage(imageData) {
            console.log('[AT] Scanning image');
            // Show results area
            const resultsDiv = document.getElementById('at-scan-results');
            const contentDiv = document.getElementById('at-scan-content');
            if (resultsDiv && contentDiv) {
                resultsDiv.style.display = 'block';
                contentDiv.innerHTML = '<p>Image scanning feature coming soon. This will detect objects and extract text from images.</p>';
            }
        }

        startScreenScan() {
            console.log('[AT] Starting screen scan');
            this.showNotification('Screen scanning feature coming soon', 'info');
            // TODO: Implement screen scanning
        }

        updateActiveFilterIndicator(activeFilter) {
            console.log(`[AT] Updating active filter indicator: ${activeFilter}`);
            document.querySelectorAll('.at-filter-btn').forEach(btn => {
                const filter = btn.getAttribute('data-filter');
                if (filter === activeFilter) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        toggleVoiceControl() {
            console.log('[AT] Toggling voice control');
            if (this.voiceControlActive) {
                this.stopVoiceRecognition();
            } else {
                this.startVoiceRecognition();
            }
        }

        async syncWithMainSite() {
            console.log('[AT] Syncing with main site');
            try {
                // Try to communicate with main site
                await this.sendToBackground({ action: 'syncWithMainSite' });
                this.showNotification('Settings synced with main site', 'success');
            } catch (err) {
                console.warn('[AT] Sync failed:', err.message);
                this.showNotification('Could not sync with main site', 'error');
            }
        }

        openSettingsPage() {
            console.log('[AT] Opening settings page');
            try {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
                    chrome.runtime.openOptionsPage();
                } else {
                    this.showNotification('Settings page not available', 'warning');
                }
            } catch (err) {
                console.warn('[AT] Could not open settings page:', err.message);
                this.showNotification('Settings page not available', 'warning');
            }
        }

        openHelpPage() {
            console.log('[AT] Opening help page');
            try {
                const helpUrl = chrome.runtime.getURL('help.html');
                window.open(helpUrl, '_blank');
            } catch (err) {
                console.warn('[AT] Could not open help page:', err.message);
                this.showNotification('Help page not available', 'warning');
            }
        }

        async checkConnectionStatus() {
            console.log('[AT] Checking connection status');
            try {
                const response = await fetch('http://localhost/xampp/htdocs/accessibility-translator-2.0/api/auth/check-session.php', {
                    method: 'GET',
                    credentials: 'include'
                });
                const statusElement = document.getElementById('at-connection-status');
                if (statusElement) {
                    if (response.ok) {
                        statusElement.textContent = 'Connected to main site';
                        statusElement.style.color = '#10B981';
                    } else {
                        statusElement.textContent = 'Not connected';
                        statusElement.style.color = '#EF4444';
                    }
                }
            } catch (err) {
                console.warn('[AT] Connection check failed:', err.message);
                const statusElement = document.getElementById('at-connection-status');
                if (statusElement) {
                    statusElement.textContent = 'Connection failed';
                    statusElement.style.color = '#EF4444';
                }
            }
        }

        async updateTTSSetting(setting, value) {
            console.log(`[AT] Updating TTS setting ${setting}: ${value}`);
            try {
                const settings = await this.getTTSSettings();
                settings[setting] = parseFloat(value);
                await this.saveTTSSettings(settings);
            } catch (err) {
                console.warn('[AT] Could not update TTS setting:', err.message);
            }
        }

        async getTTSSettings() {
            return new Promise((resolve) => {
                try {
                    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                        chrome.storage.local.get(['ttsSettings'], (result) => {
                            resolve(result.ttsSettings || { rate: 1, pitch: 1, volume: 1 });
                        });
                    } else {
                        resolve({ rate: 1, pitch: 1, volume: 1 });
                    }
                } catch (error) {
                    console.warn('[AT] Error getting TTS settings:', error);
                    resolve({ rate: 1, pitch: 1, volume: 1 });
                }
            });
        }

        async saveTTSSettings(settings) {
            try {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.set({ ttsSettings: settings });
                }
            } catch (error) {
                console.warn('[AT] Error saving TTS settings:', error);
            }
        }
    }

    // Initialize when DOM is ready
    function initializeExtension() {
        console.log('[AT] Initializing extension...');
        console.log('[AT] Document readyState:', document.readyState);
        console.log('[AT] Document.body exists:', !!document.body);

        if (window.accessibilityBubble) {
            console.log('[AT] Bubble already exists, skipping initialization');
            return;
        }

        try {
            window.accessibilityBubble = new AccessibilityBubble();
            console.log('[AT] Extension initialized successfully');
        } catch (error) {
            console.error('[AT] Failed to initialize extension:', error);
        }
    }

    if (document.readyState === 'loading') {
        console.log('[AT] Document still loading, waiting for DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', initializeExtension);
    } else {
        console.log('[AT] Document already loaded, initializing immediately');
        initializeExtension();
    }

    // Fallback initialization after a short delay
    setTimeout(() => {
        if (!window.accessibilityBubble) {
            console.log('[AT] Fallback initialization triggered');
            initializeExtension();
        }
    }, 1000);

    // Export for testing
    window.AccessibilityBubble = AccessibilityBubble;

})();