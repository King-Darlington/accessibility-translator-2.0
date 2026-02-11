// Content script for Accessibility Translator Bubble Interface

// Prevent redeclaration if the script is injected multiple times
if (typeof window.AccessibilityBubble === 'undefined') {
class AccessibilityBubble {
    constructor() {
        this.isActive = false;
        this.bubble = null;
        this.menu = null;
        this.overlay = null;
        this.currentFilter = null;
        this.messageTimeout = 5000;
        this.isInitialized = false;
        this.init();
    }
 
    init() {
        try {
            this.createBubble();
            this.setupMessageListener();
            this.loadSettings().catch(err => 
                console.warn('Failed to load settings:', err)
            );
            
            // Notify page that extension content script is active
            this.notifyPageOfExtension();
            
            // Listen for messages posted by the page (from site integration)
            window.addEventListener('message', (event) => {
                try {
                    if (event.source !== window) return;
                    this.handlePageMessage(event.data || {});
                } catch (error) {
                    console.error('Error handling page message:', error);
                }
            });
            
            this.isInitialized = true;
            console.log('AccessibilityBubble initialized successfully');
        } catch (error) {
            console.error('AccessibilityBubble initialization error:', error);
        }
    }

    notifyPageOfExtension() {
        try {
            window.postMessage({ type: 'AT_EXTENSION_INSTALLED' }, '*');
        } catch (e) {
            console.debug('Could not notify page of extension:', e.message);
        }
    }

    handlePageMessage(message) {
        if (!message || typeof message !== 'object') return;

        switch (message.type) {
            case 'AT_TRIGGER_FEATURE':
                if (message.feature && typeof message.feature === 'string') {
                    this.handleBubbleAction(message.feature);
                }
                break;

            case 'AT_OPEN_MODAL':
                this.showMenu();
                break;

            case 'AT_CONFIG':
                if (message.theme && typeof message.theme === 'object') {
                    this.applyPageConfig(message.theme);
                }
                break;
        }
    }

    applyPageConfig(theme) {
        try {
            if (theme.primary && /^#[0-9A-F]{6}$/i.test(theme.primary)) {
                document.documentElement.style.setProperty('--at-primary', theme.primary);
            }
            if (theme.secondary && /^#[0-9A-F]{6}$/i.test(theme.secondary)) {
                document.documentElement.style.setProperty('--at-secondary', theme.secondary);
            }
        } catch (error) {
            console.warn('Error applying page config:', error);
        }
    }

    createBubble() {
        try {
            // Create bubble element with safety checks
            this.bubble = document.createElement('div');
            this.bubble.className = 'accessibility-bubble';
            this.bubble.setAttribute('role', 'toolbar');
            this.bubble.setAttribute('aria-label', 'Accessibility Translator');
            this.bubble.innerHTML = `
                <button class="bubble-trigger" aria-label="Open accessibility menu" title="Accessibility Tools">
                    <i class="fas fa-eye"></i>
                </button>
            `;

            // Create menu
            this.menu = document.createElement('div');
            this.menu.className = 'bubble-menu';
            this.menu.setAttribute('role', 'menu');
            this.menu.innerHTML = `
                <div class="bubble-item" data-action="tts" role="menuitem">
                    <i class="fas fa-volume-up"></i>
                    <div class="bubble-tooltip">Text to Speech</div>
                </div>
                <div class="bubble-item" data-action="scan" role="menuitem">
                    <i class="fas fa-camera"></i>
                    <div class="bubble-tooltip">Object Scan</div>
                </div>
                <div class="bubble-item" data-action="filters" role="menuitem">
                    <i class="fas fa-palette"></i>
                    <div class="bubble-tooltip">Color Filters</div>
                </div>
                <div class="bubble-item" data-action="voice" role="menuitem">
                    <i class="fas fa-microphone"></i>
                    <div class="bubble-tooltip">Voice Control</div>
                </div>
                <div class="bubble-item" data-action="settings" role="menuitem">
                    <i class="fas fa-cog"></i>
                    <div class="bubble-tooltip">Settings</div>
                </div>
            `;

            // Create overlay
            this.overlay = document.createElement('div');
            this.overlay.className = 'bubble-overlay';
            this.overlay.setAttribute('role', 'presentation');

            // Add to page with safety checks
            if (document.body) {
                document.body.appendChild(this.bubble);
                document.body.appendChild(this.menu);
                document.body.appendChild(this.overlay);
            } else {
                throw new Error('document.body not available');
            }

            this.setupEventListeners();
        } catch (error) {
            console.error('Error creating bubble:', error);
            throw error;
        }
    }

    setupEventListeners() {
        try {
            // Bubble click
            if (this.bubble) {
                const trigger = this.bubble.querySelector('.bubble-trigger');
                if (trigger) {
                    trigger.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.toggleMenu();
                    });
                }
            }

            // Menu item clicks
            if (this.menu) {
                this.menu.querySelectorAll('.bubble-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const action = item.getAttribute('data-action');
                        if (action) {
                            this.handleBubbleAction(action);
                        }
                    });
                });
            }

            // Overlay click
            if (this.overlay) {
                this.overlay.addEventListener('click', () => {
                    this.hideMenu();
                });
            }

            // Document click to close menu
            document.addEventListener('click', (e) => {
                if (this.bubble && this.menu) {
                    if (!this.bubble.contains(e.target) && !this.menu.contains(e.target)) {
                        this.hideMenu();
                    }
                }
            });

            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                this.handleKeyboardShortcuts(e);
            });
        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }

    setupMessageListener() {
        try {
            if (!chrome || !chrome.runtime) {
                console.warn('chrome.runtime not available');
                return;
            }

            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                try {
                    if (!request || typeof request !== 'object') {
                        sendResponse({ success: false, error: 'Invalid request' });
                        return;
                    }

                    this.handleContentMessage(request, sender, sendResponse);
                } catch (error) {
                    console.error('Message listener error:', error);
                    try {
                        sendResponse({ success: false, error: error.message });
                    } catch (e) {
                        // sendResponse might fail
                    }
                }
                return true;
            });
        } catch (error) {
            console.error('Error setting up message listener:', error);
        }
    }

    handleContentMessage(request, sender, sendResponse) {
        const action = request.action;

        try {
            switch (action) {
                case 'ping':
                    sendResponse({ success: true, pong: true });
                    break;

                case 'toggleBubble':
                    this.toggleMenu();
                    sendResponse({ success: true });
                    break;

                case 'applyFilter':
                    if (!request.filter) {
                        throw new Error('No filter specified');
                    }
                    this.applyFilter(request.filter);
                    sendResponse({ success: true });
                    break;

                case 'speakText':
                    if (!request.text) {
                        throw new Error('No text provided');
                    }
                    this.speakText(request.text, request.options);
                    sendResponse({ success: true });
                    break;

                case 'extractPageText':
                    {
                        const text = this.extractPageText();
                        sendResponse({ success: true, text });
                    }
                    break;

                case 'extractPageHeaders':
                    {
                        const headers = this.extractPageHeaders();
                        sendResponse({ success: true, headers });
                    }
                    break;

                case 'extractPageLinks':
                    {
                        const links = this.extractPageLinks();
                        sendResponse({ success: true, links });
                    }
                    break;

                case 'extractImageAlts':
                    {
                        const alts = this.extractImageAlts();
                        sendResponse({ success: true, alts });
                    }
                    break;

                case 'getSelectedText':
                    {
                        const text = window.getSelection().toString();
                        sendResponse({ success: true, text });
                    }
                    break;

                case 'storageUpdated':
                    this.handleStorageUpdate(request.data);
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: `Unknown action: ${action}` });
            }
        } catch (error) {
            console.error(`Error handling action ${action}:`, error);
            sendResponse({ success: false, error: error.message });
        }
    }

    // Safe wrapper to send messages to background/service worker
    sendToBackground(message) {
        return new Promise((resolve, reject) => {
            try {
                if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
                    return reject(new Error('chrome.runtime.sendMessage not available'));
                }

                chrome.runtime.sendMessage(message, (response) => {
                    const err = chrome.runtime.lastError;
                    if (err) {
                        // Common when extension context invalidated or no listener
                        return reject(err);
                    }
                    resolve(response);
                });
            } catch (e) {
                // Synchronous throw (very rare)
                reject(e);
            }
        });
    }

    toggleMenu() {
        if (this.isActive) {
            this.hideMenu();
        } else {
            this.showMenu();
        }
    }

    showMenu() {
        this.isActive = true;
        this.bubble.classList.add('active');
        this.menu.classList.add('active');
        this.overlay.classList.add('active');
        
        // Animate menu items
        this.animateMenuItems();
    }

    hideMenu() {
        this.isActive = false;
        this.bubble.classList.remove('active');
        this.menu.classList.remove('active');
        this.overlay.classList.remove('active');
    }

    animateMenuItems() {
        const items = this.menu.querySelectorAll('.bubble-item');
        items.forEach((item, index) => {
            item.style.animation = `popIn 0.3s ease-out ${index * 0.1}s backwards`;
        });
    }

    handleBubbleAction(action) {
        this.hideMenu();

        // Map bubble actions to extension popup tab names
        const actionToTabMap = {
            'tts': 'tts',
            'scan': 'scanning',
            'filters': 'filters',
            'voice': 'voice',
            'settings': 'magnification' // Settings opens magnification tab by default
        };

        // Send message to extension popup to open the correct tab
        const tabName = actionToTabMap[action];
        if (tabName) {
            // First, try to open the extension popup
            chrome.action.openPopup(() => {
                if (chrome.runtime.lastError) {
                    // openPopup is not available on all platforms, so silently fail
                    console.warn('Could not open extension popup:', chrome.runtime.lastError.message);
                }
                
                // Send message to switch to the correct tab
                // This works whether popup was just opened or was already open
                chrome.runtime.sendMessage({
                    action: 'openExtensionTab',
                    tab: tabName
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Extension not available:', chrome.runtime.lastError.message);
                    } else if (response && response.success) {
                        console.log('Extension tab switched:', tabName);
                    }
                });
            });
        }

        switch (action) {
            case 'tts':
                this.activateTextToSpeech();
                break;

            case 'scan':
                this.activateObjectScanning();
                break;

            case 'filters':
                this.showColorFilters();
                break;

            case 'voice':
                this.toggleVoiceControl();
                break;

            case 'settings':
                this.openSettings();
                break;
        }
    }

    async activateTextToSpeech() {
        // Get page content and send to background for speech
        const pageText = this.extractPageText();
        try {
            await this.sendToBackground({
                action: 'speakText',
                text: pageText,
                options: await this.getTTSSettings()
            });
        } catch (err) {
            // Extension context may be invalidated (service worker restarted). Log and ignore.
            console.warn('Failed to send speakText to background:', err);
        }
    }

    extractPageText() {
        // Extract main content, excluding navigation and footer
        const mainContent = document.querySelector('main') || 
                           document.querySelector('.main-content') ||
                           document.querySelector('#content') ||
                           document.body;

        // Remove script and style elements
        const clone = mainContent.cloneNode(true);
        clone.querySelectorAll('script, style, nav, footer, header').forEach(el => el.remove());
        
        return clone.textContent.replace(/\s+/g, ' ').trim();
    }

    async activateObjectScanning() {
        // Show camera interface or upload dialog
        this.showScanningInterface();
    }

    showScanningInterface() {
        // Create scanning modal
        const modal = this.createModal('Object Scanning');
        modal.innerHTML = `
            <div class="scanning-modal-content">
                <div class="scan-options">
                    <button class="scan-option-btn" id="useCamera">
                        <i class="fas fa-camera"></i>
                        Use Camera
                    </button>
                    <button class="scan-option-btn" id="uploadImage">
                        <i class="fas fa-upload"></i>
                        Upload Image
                    </button>
                    <button class="scan-option-btn" id="scanScreen">
                        <i class="fas fa-desktop"></i>
                        Scan Screen
                    </button>
                </div>
                <div class="scan-preview" id="scanPreview"></div>
                <div class="scan-results" id="scanResults"></div>
            </div>
        `;

        this.setupScanningEventListeners(modal);
    }

    showColorFilters() {
        const modal = this.createModal('Color Filters');
        modal.innerHTML = `
            <div class="filters-modal-content">
                <div class="filters-grid">
                    ${this.generateFilterOptions()}
                </div>
                <div class="filter-controls">
                    <button class="filter-control-btn" id="resetFilter">Reset</button>
                    <button class="filter-control-btn" id="applyCustom">Custom Settings</button>
                </div>
            </div>
        `;

        this.setupFilterEventListeners(modal);
    }

    generateFilterOptions() {
        const filters = [
            { id: 'grayscale', name: 'Grayscale', icon: 'fa-adjust' },
            { id: 'high-contrast', name: 'High Contrast', icon: 'fa-sun' },
            { id: 'invert', name: 'Invert Colors', icon: 'fa-exchange-alt' },
            { id: 'sepia', name: 'Sepia', icon: 'fa-image' },
            { id: 'blue-light', name: 'Blue Light', icon: 'fa-moon' },
            { id: 'protanopia', name: 'Protanopia', icon: 'fa-eye' },
            { id: 'deuteranopia', name: 'Deuteranopia', icon: 'fa-eye' },
            { id: 'tritanopia', name: 'Tritanopia', icon: 'fa-eye' }
        ];

        return filters.map(filter => `
            <div class="filter-option" data-filter="${filter.id}">
                <i class="fas ${filter.icon}"></i>
                <span>${filter.name}</span>
            </div>
        `).join('');
    }

    toggleVoiceControl() {
        this.sendToBackground({ action: 'toggleVoiceControl' }).catch(err => {
            console.warn('toggleVoiceControl failed:', err);
        });
    }

    openSettings() {
        this.sendToBackground({ action: 'openOptionsPage' }).catch(err => {
            console.warn('openOptionsPage failed:', err);
        });
    }

    applyFilter(filter) {
        this.sendToBackground({ action: 'applyFilter', filter }).then(() => {
            this.currentFilter = filter;
            this.updateActiveFilterIndicator(filter);
        }).catch(err => {
            console.warn('applyFilter failed:', err);
            // Still update UI optimistically
            this.currentFilter = filter;
            this.updateActiveFilterIndicator(filter);
        });
    }

    updateActiveFilterIndicator(filter) {
        // Update bubble appearance based on active filter
        if (filter) {
            this.bubble.style.background = 'linear-gradient(135deg, var(--secondary), var(--accent))';
        } else {
            this.bubble.style.background = 'linear-gradient(135deg, var(--primary), var(--secondary))';
        }
    }

    speakText(text, options) {
        // Use Web Speech API for immediate feedback
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = options.rate || 1;
        utterance.pitch = options.pitch || 1;
        utterance.volume = options.volume || 1;
        
        speechSynthesis.speak(utterance);
    }

    handleKeyboardShortcuts(event) {
        // Alt + 1-5 for quick filter activation
        if (event.altKey && event.key >= '1' && event.key <= '8') {
            event.preventDefault();
            const filters = ['grayscale', 'high-contrast', 'invert', 'sepia', 'blue-light', 'protanopia', 'deuteranopia', 'tritanopia'];
            const filterIndex = parseInt(event.key) - 1;
            if (filters[filterIndex]) {
                this.applyFilter(filters[filterIndex]);
            }
        }

        // Alt + S to toggle speech
        if (event.altKey && event.key === 's') {
            event.preventDefault();
            this.activateTextToSpeech();
        }

        // Alt + V to toggle voice control
        if (event.altKey && event.key === 'v') {
            event.preventDefault();
            this.toggleVoiceControl();
        }
    }

    createModal(title) {
        // Remove existing modal
        const existingModal = document.getElementById('accessibility-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create new modal
        const modal = document.createElement('div');
        modal.id = 'accessibility-modal';
        modal.className = 'accessibility-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body"></div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup close event
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('.modal-backdrop').addEventListener('click', () => {
            modal.remove();
        });

        return modal.querySelector('.modal-body');
    }

    async loadSettings() {
        const settings = await new Promise(resolve => {
            chrome.storage.sync.get(['tts', 'filters', 'bubble'], resolve);
        });

        if (settings.filters?.active) {
            this.currentFilter = settings.filters.active;
            this.updateActiveFilterIndicator(this.currentFilter);
        }
    }

    handleStorageUpdate(data) {
        // Handle storage updates from background
        if (data.newValue?.activeFilter) {
            this.currentFilter = data.newValue.activeFilter;
            this.updateActiveFilterIndicator(this.currentFilter);
        }
    }

    async getTTSSettings() {
        const settings = await new Promise(resolve => {
            chrome.storage.sync.get('tts', resolve);
        });
        return settings.tts || {};
    }

    setupScanningEventListeners(modal) {
        // Implementation for scanning event listeners
        modal.querySelector('#useCamera').addEventListener('click', () => {
            this.activateCamera();
        });

        modal.querySelector('#uploadImage').addEventListener('click', () => {
            this.uploadImage();
        });

        modal.querySelector('#scanScreen').addEventListener('click', () => {
            this.scanScreen();
        });
    }

    setupFilterEventListeners(modal) {
        modal.querySelectorAll('.filter-option').forEach(option => {
            option.addEventListener('click', () => {
                const filter = option.getAttribute('data-filter');
                this.applyFilter(filter);
            });
        });

        modal.querySelector('#resetFilter').addEventListener('click', () => {
            this.applyFilter(null);
        });
    }

    // Placeholder methods for scanning functionality
    activateCamera() {
        console.log('Activating camera...');
    }

    uploadImage() {
        console.log('Uploading image...');
    }

    scanScreen() {
        console.log('Scanning screen...');
    }
}

    // Initialize the bubble when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!window.accessibilityBubble) window.accessibilityBubble = new AccessibilityBubble();
        });
    } else {
        if (!window.accessibilityBubble) window.accessibilityBubble = new AccessibilityBubble();
    }

    // Expose constructor to window to prevent redeclaration
    window.AccessibilityBubble = AccessibilityBubble;

    // Export for testing
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AccessibilityBubble;
    }
}