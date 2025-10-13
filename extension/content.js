// Content script for Accessibility Translator Bubble Interface

class AccessibilityBubble {
    constructor() {
        this.isActive = false;
        this.bubble = null;
        this.menu = null;
        this.overlay = null;
        this.currentFilter = null;
        this.init();
    }

    init() {
        this.createBubble();
        this.setupMessageListener();
        this.loadSettings();
    }

    createBubble() {
        // Create bubble element
        this.bubble = document.createElement('div');
        this.bubble.className = 'accessibility-bubble';
        this.bubble.innerHTML = `
            <i class="fas fa-eye"></i>
        `;

        // Create menu
        this.menu = document.createElement('div');
        this.menu.className = 'bubble-menu';
        this.menu.innerHTML = `
            <div class="bubble-item" data-action="tts">
                <i class="fas fa-volume-up"></i>
                <div class="bubble-tooltip">Text to Speech</div>
            </div>
            <div class="bubble-item" data-action="scan">
                <i class="fas fa-camera"></i>
                <div class="bubble-tooltip">Object Scan</div>
            </div>
            <div class="bubble-item" data-action="filters">
                <i class="fas fa-palette"></i>
                <div class="bubble-tooltip">Color Filters</div>
            </div>
            <div class="bubble-item" data-action="voice">
                <i class="fas fa-microphone"></i>
                <div class="bubble-tooltip">Voice Control</div>
            </div>
            <div class="bubble-item" data-action="settings">
                <i class="fas fa-cog"></i>
                <div class="bubble-tooltip">Settings</div>
            </div>
        `;

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'bubble-overlay';

        // Add to page
        document.body.appendChild(this.bubble);
        document.body.appendChild(this.menu);
        document.body.appendChild(this.overlay);

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Bubble click
        this.bubble.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
        });

        // Menu item clicks
        this.menu.querySelectorAll('.bubble-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.getAttribute('data-action');
                this.handleBubbleAction(action);
            });
        });

        // Overlay click
        this.overlay.addEventListener('click', () => {
            this.hideMenu();
        });

        // Document click to close menu
        document.addEventListener('click', (e) => {
            if (!this.bubble.contains(e.target) && !this.menu.contains(e.target)) {
                this.hideMenu();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'toggleBubble':
                    this.toggleMenu();
                    sendResponse({ success: true });
                    break;

                case 'applyFilter':
                    this.applyFilter(request.filter);
                    sendResponse({ success: true });
                    break;

                case 'speakText':
                    this.speakText(request.text, request.options);
                    sendResponse({ success: true });
                    break;

                case 'storageUpdated':
                    this.handleStorageUpdate(request.data);
                    sendResponse({ success: true });
                    break;

                default:
                    console.log('Unknown action in content script:', request.action);
            }
            return true;
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
        
        chrome.runtime.sendMessage({
            action: 'speakText',
            text: pageText,
            options: await this.getTTSSettings()
        });
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
        chrome.runtime.sendMessage({
            action: 'toggleVoiceControl'
        });
    }

    openSettings() {
        chrome.runtime.sendMessage({
            action: 'openOptionsPage'
        });
    }

    applyFilter(filter) {
        chrome.runtime.sendMessage({
            action: 'applyFilter',
            filter: filter
        });
        
        this.currentFilter = filter;
        this.updateActiveFilterIndicator(filter);
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
        window.accessibilityBubble = new AccessibilityBubble();
    });
} else {
    window.accessibilityBubble = new AccessibilityBubble();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AccessibilityBubble;
}