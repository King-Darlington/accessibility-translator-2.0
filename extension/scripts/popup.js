// Main popup script for Accessibility Translator Extension

class PopupManager {
    constructor() {
        this.currentTab = null;
        this.activeTab = 'tts';
        this.isInitialized = false;
        this.messageTimeout = 5000; // 5 second timeout for messages
        this.init();
    }

    async init() {
        try {
            await this.getCurrentTab();
            this.setupEventListeners();
            await this.loadSettings();
            await this.initializeTTS();
            await this.checkConnectionStatus();
            this.isInitialized = true;
            console.log('PopupManager initialized successfully');
        } catch (error) {
            console.error('PopupManager initialization error:', error);
            this.showNotification('Extension initialization failed', 'error');
        }
    } 

    async getCurrentTab() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs.length > 0) {
                this.currentTab = tabs[0];
                return this.currentTab;
            }
            throw new Error('No active tab found');
        } catch (error) {
            console.error('Error getting current tab:', error);
            return null;
        }
    }

    setupEventListeners() {
        // Navigation with error handling
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                try {
                    this.switchTab(e.currentTarget.getAttribute('data-tab'));
                } catch (error) {
                    console.error('Tab switch error:', error);
                    this.showNotification('Failed to switch tab', 'error');
                }
            });
        });

        // Header logo (eye) click: jump to Filters page
        const logo = document.querySelector('.logo-gradient');
        if (logo) {
            logo.setAttribute('role', 'button');
            logo.setAttribute('tabindex', '0');
            logo.setAttribute('aria-label', 'Switch to filters');
            
            logo.addEventListener('click', () => {
                try {
                    this.switchTab('filters');
                } catch (error) {
                    console.error('Logo click error:', error);
                }
            });
            
            // keyboard accessibility
            logo.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    try {
                        this.switchTab('filters');
                    } catch (error) {
                        console.error('Logo keydown error:', error);
                    }
                }
            });
        }

        // TTS Controls with error handling
        const playAllBtn = document.getElementById('playAll');
        if (playAllBtn) {
            playAllBtn.addEventListener('click', () => {
                this.readEntirePage().catch(err => {
                    console.error('Read page error:', err);
                    this.showNotification('Failed to read page', 'error');
                });
            });
        }

        const stopAllBtn = document.getElementById('stopAll');
        if (stopAllBtn) {
            stopAllBtn.addEventListener('click', () => {
                try {
                    this.stopSpeech();
                } catch (error) {
                    console.error('Stop speech error:', error);
                }
            });
        }

        // Voice selection with validation
        const voiceSelect = document.getElementById('voiceSelect');
        if (voiceSelect) {
            voiceSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.saveTTSSettings({ voice: e.target.value })
                        .catch(err => console.error('Failed to save TTS settings:', err));
                }
            });
        }

        // Range inputs with validation
        ['rate', 'pitch', 'volume'].forEach(id => {
            const element = document.getElementById(id);
            const valueElement = document.getElementById(`${id}Value`);
            
            if (element && valueElement) {
                element.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) {
                        valueElement.textContent = value.toFixed(1);
                        this.saveTTSSettings({ [id]: value })
                            .catch(err => console.error(`Failed to save ${id}:`, err));
                    }
                });
            }
        });

        // Quick actions
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.getAttribute('data-action');
                if (action) {
                    this.handleQuickAction(action)
                        .catch(err => console.error(`Quick action ${action} failed:`, err));
                }
            });
        });

        // Filter buttons with error handling
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const filterCard = e.currentTarget.closest('.filter-card');
                if (filterCard) {
                    const filter = filterCard.getAttribute('data-filter');
                    if (filter) {
                        this.applyColorFilter(filter)
                            .catch(err => console.error(`Filter ${filter} error:`, err));
                    }
                }
            });
        });

        // Voice control
        const voiceToggle = document.getElementById('voiceToggle');
        if (voiceToggle) {
            voiceToggle.addEventListener('click', () => {
                this.toggleVoiceControl()
                    .catch(err => console.error('Voice control error:', err));
            });
        }

        // Sync with main site
        const syncBtn = document.getElementById('syncWithMain');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => {
                this.syncWithMainSite()
                    .catch(err => console.error('Sync error:', err));
            });
        }

        // Settings and help
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openOptionsPage());
        }

        const helpBtn = document.getElementById('helpBtn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => this.openHelp());
        }
    }

    switchTab(tabName) {
        if (!tabName) {
            throw new Error('Tab name is required');
        }

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavItem = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const activeContent = document.getElementById(tabName);
        if (activeContent) {
            activeContent.classList.add('active');
        }

        // Update selector position
        this.updateNavSelector(tabName);
        this.activeTab = tabName;
    }

    updateNavSelector(tabName) {
        const navItems = document.querySelectorAll('.nav-item');
        const activeItem = document.querySelector(`[data-tab="${tabName}"]`);
        const selector = document.querySelector('.nav-selector');
        
        if (activeItem && selector) {
            const index = Array.from(navItems).indexOf(activeItem);
            const itemWidth = 100 / Math.max(navItems.length, 1);
            
            selector.style.width = `${itemWidth}%`;
            selector.style.left = `${index * itemWidth}%`;
        }
    }

    async initializeTTS() {
        try {
            const voices = await this.getVoices();
            this.populateVoiceSelect(voices);
            
            const settings = await this.getTTSSettings();
            this.applyTTSSettings(settings);
        } catch (error) {
            console.error('TTS initialization failed:', error);
            // Continue with fallback rather than failing completely
        }
    }

    async getVoices() {
        try {
            // Use Web Speech API instead of non-existent chrome.tts API
            if (!window.speechSynthesis) {
                console.warn('Web Speech API not available');
                return [];
            }
            
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.warn('Voices request timed out');
                    resolve([]);
                }, this.messageTimeout);
                
                // Get available voices from speechSynthesis
                const getAvailableVoices = () => {
                    const voices = window.speechSynthesis.getVoices();
                    clearTimeout(timeout);
                    resolve(voices || []);
                };
                
                // Voices may not be loaded immediately
                if (window.speechSynthesis.getVoices().length > 0) {
                    getAvailableVoices();
                } else {
                    window.speechSynthesis.onvoiceschanged = getAvailableVoices;
                }
            });
        } catch (err) {
            console.warn('Error getting voices:', err);
            return [];
        }
    }

    populateVoiceSelect(voices) {
        const select = document.getElementById('voiceSelect');
        if (!select) return;

        select.innerHTML = '';

        if (voices && voices.length > 0) {
            voices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name || voice.voiceName || voice.lang;
                option.textContent = `${voice.name || voice.voiceName || 'Default'} (${voice.lang || 'unknown'})`;
                select.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Default voice';
            select.appendChild(option);
        }
    }

    async getTTSSettings() {
        return new Promise((resolve) => {
            try {
                chrome.storage.sync.get('tts', (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Storage error:', chrome.runtime.lastError);
                        resolve({});
                    } else {
                        resolve(result.tts || {});
                    }
                });
            } catch (error) {
                console.error('Get TTS settings error:', error);
                resolve({});
            }
        });
    }

    applyTTSSettings(settings) {
        if (!settings || typeof settings !== 'object') return;

        ['rate', 'pitch', 'volume'].forEach(key => {
            if (settings[key] !== undefined) {
                const element = document.getElementById(key);
                const valueElement = document.getElementById(`${key}Value`);
                
                if (element && valueElement) {
                    const value = parseFloat(settings[key]);
                    if (!isNaN(value)) {
                        element.value = value;
                        valueElement.textContent = value.toFixed(1);
                    }
                }
            }
        });

        if (settings.voice) {
            const voiceSelect = document.getElementById('voiceSelect');
            if (voiceSelect) {
                voiceSelect.value = settings.voice;
            }
        }
    }

    async saveTTSSettings(newSettings) {
        try {
            if (!newSettings || typeof newSettings !== 'object') {
                throw new Error('Invalid settings object');
            }

            const current = await this.getTTSSettings();
            const updated = { ...current, ...newSettings };
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Storage write timeout'));
                }, this.messageTimeout);

                chrome.storage.sync.set({ tts: updated }, () => {
                    clearTimeout(timeout);
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.error('Error saving TTS settings:', error);
            this.showNotification('Failed to save settings', 'error');
            throw error;
        }
    }

    async readEntirePage() {
        try {
            if (!this.currentTab || !this.currentTab.id) {
                throw new Error('No active tab available');
            }

            // Try to inject content script if not present
            await this.ensureContentScriptLoaded(this.currentTab.id);

            const response = await this.sendMessageWithTimeout(this.currentTab.id, {
                action: 'extractPageText'
            });

            if (response && response.text) {
                await this.speakText(response.text);
                this.showNotification('Reading page...', 'success');
            } else {
                throw new Error('No text extracted from page');
            }
        } catch (error) {
            console.error('Error reading page:', error);
            this.showNotification('Could not read page content', 'error');
        }
    }

    async ensureContentScriptLoaded(tabId) {
        try {
            // Test if content script is loaded by sending a ping
            await this.sendMessageWithTimeout(tabId, { action: 'ping' }, 1000);
        } catch (error) {
            // Content script not loaded, try to inject it
            try {
                await chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['content.js']
                });
                // Wait for content script to initialize
                await new Promise(r => setTimeout(r, 250));
            } catch (injectionError) {
                console.warn('Could not inject content script:', injectionError);
            }
        }
    }

    async sendMessageWithTimeout(tabId, message, timeout = this.messageTimeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Message timeout after ${timeout}ms`));
            }, timeout);

            try {
                chrome.tabs.sendMessage(tabId, message, (response) => {
                    clearTimeout(timeoutId);
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                });
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    stopSpeech() {
        try {
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
                this.showNotification('Speech stopped', 'info');
            }
        } catch (error) {
            console.error('Error stopping speech:', error);
        }
    }

    async handleQuickAction(action) {
        if (!action) {
            console.warn('No action specified');
            return;
        }

        if (!this.currentTab || !this.currentTab.id) {
            this.showNotification('No active tab available', 'error');
            return;
        }

        try {
            await this.ensureContentScriptLoaded(this.currentTab.id);

            switch (action) {
                case 'read-headers':
                    await this.readPageHeaders(this.currentTab.id);
                    break;
                case 'read-links':
                    await this.readPageLinks(this.currentTab.id);
                    break;
                case 'read-images':
                    await this.readImageAltTexts(this.currentTab.id);
                    break;
                case 'read-selected':
                    await this.readSelectedText(this.currentTab.id);
                    break;
                default:
                    console.warn(`Unknown action: ${action}`);
            }
        } catch (error) {
            console.error(`Quick action error for ${action}:`, error);
            this.showNotification(`Failed to perform action: ${action}`, 'error');
        }
    }

    async readPageHeaders(tabId) {
        try {
            const response = await this.sendMessageWithTimeout(tabId, {
                action: 'extractPageHeaders'
            });

            if (response && response.headers) {
                const headersText = response.headers.join('. ');
                await this.speakText(headersText);
                this.showNotification('Reading page headers...', 'success');
            }
        } catch (error) {
            console.error('Error reading headers:', error);
            this.showNotification('Could not read headers', 'error');
        }
    }

    async readPageLinks(tabId) {
        try {
            const response = await this.sendMessageWithTimeout(tabId, {
                action: 'extractPageLinks'
            });

            if (response && response.links) {
                const linksText = response.links.join('. ');
                await this.speakText(linksText);
                this.showNotification('Reading links...', 'success');
            }
        } catch (error) {
            console.error('Error reading links:', error);
            this.showNotification('Could not read links', 'error');
        }
    }

    async readImageAltTexts(tabId) {
        try {
            const response = await this.sendMessageWithTimeout(tabId, {
                action: 'extractImageAlts'
            });

            if (response && response.alts) {
                const altsText = response.alts.join('. ');
                await this.speakText(altsText);
                this.showNotification('Reading image descriptions...', 'success');
            }
        } catch (error) {
            console.error('Error reading images:', error);
            this.showNotification('Could not read images', 'error');
        }
    }

    async readSelectedText(tabId) {
        try {
            const response = await this.sendMessageWithTimeout(tabId, {
                action: 'getSelectedText'
            });

            if (response && response.text) {
                await this.speakText(response.text);
                this.showNotification('Reading selected text...', 'success');
            } else {
                this.showNotification('No text selected', 'warning');
            }
        } catch (error) {
            console.error('Error reading selected text:', error);
            this.showNotification('Could not read selected text', 'error');
        }
    }

    async speakText(text) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid text provided');
            }

            if (!window.speechSynthesis) {
                throw new Error('Text-to-speech not available');
            }

            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            const settings = await this.getTTSSettings();
            const utterance = new SpeechSynthesisUtterance(text.trim());
            
            // Apply TTS settings
            utterance.rate = settings.rate || 1;
            utterance.pitch = settings.pitch || 1;
            utterance.volume = settings.volume || 1;
            
            // Apply voice if available
            if (settings.voice) {
                const voices = window.speechSynthesis.getVoices();
                const selectedVoice = voices.find(v => v.name === settings.voice || v.voiceName === settings.voice);
                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                }
            }

            // Speak the text
            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('Error speaking text:', error);
            throw error;
        }
    }

    async applyColorFilter(filter) {
        try {
            if (!filter || typeof filter !== 'string') {
                throw new Error('Invalid filter specified');
            }

            if (!this.currentTab || !this.currentTab.id) {
                this.showNotification('No active tab available to apply filter', 'error');
                return;
            }

            // Ensure content script is loaded
            await this.ensureContentScriptLoaded(this.currentTab.id);

            // Apply filter with timeout
            await this.sendMessageWithTimeout(this.currentTab.id, {
                action: 'applyFilter',
                filter: filter
            });

            // Update UI feedback
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.textContent = 'Activate';
                btn.classList.remove('active');
            });

            const filterCard = document.querySelector(`[data-filter="${filter}"]`);
            if (filterCard) {
                const activeBtn = filterCard.querySelector('.filter-btn');
                if (activeBtn) {
                    activeBtn.textContent = 'Active';
                    activeBtn.classList.add('active');
                }
            }

            this.showNotification(`Applied ${filter} filter`, 'success');
        } catch (error) {
            console.error('Error applying filter:', error);
            this.showNotification('Could not apply filter. The page may not support the extension.', 'error');
        }
    }

    async toggleVoiceControl() {
        try {
            const toggleBtn = document.getElementById('voiceToggle');
            if (!toggleBtn) {
                throw new Error('Voice toggle button not found');
            }

            const isListening = toggleBtn.classList.contains('listening');

            if (isListening) {
                await this.stopVoiceControl();
            } else {
                await this.startVoiceControl();
            }
        } catch (error) {
            console.error('Voice control toggle error:', error);
            this.showNotification('Voice control error', 'error');
        }
    }

    async startVoiceControl() {
        try {
            if (!this.currentTab || !this.currentTab.id) {
                throw new Error('No active tab available');
            }

            const toggleBtn = document.getElementById('voiceToggle');
            if (toggleBtn) {
                toggleBtn.classList.add('listening');
                toggleBtn.textContent = 'Listening...';
                toggleBtn.setAttribute('aria-pressed', 'true');
            }

            this.showNotification('Voice control started. Say a command...', 'info');
        } catch (error) {
            console.error('Start voice control error:', error);
            this.showNotification('Could not start voice control', 'error');
        }
    }

    async stopVoiceControl() {
        try {
            const toggleBtn = document.getElementById('voiceToggle');
            if (toggleBtn) {
                toggleBtn.classList.remove('listening');
                toggleBtn.textContent = 'Start Voice Control';
                toggleBtn.setAttribute('aria-pressed', 'false');
            }

            this.showNotification('Voice control stopped', 'info');
        } catch (error) {
            console.error('Stop voice control error:', error);
        }
    }

    async syncWithMainSite() {
        try {
            const settings = await this.getAllSettings();
            const syncResult = await chrome.runtime.sendMessage({
                action: 'syncWithMain',
                data: settings
            });
            
            if (syncResult && syncResult.success) {
                this.showNotification('Synced with main site', 'success');
            } else {
                throw new Error('Sync failed on background process');
            }
        } catch (error) {
            console.error('Sync failed:', error);
            this.showNotification('Sync failed. Check your connection.', 'error');
        }
    }

    async getAllSettings() {
        return new Promise((resolve) => {
            try {
                chrome.storage.sync.get(null, (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Storage error:', chrome.runtime.lastError);
                        resolve({});
                    } else {
                        resolve(result || {});
                    }
                });
            } catch (error) {
                console.error('Get all settings error:', error);
                resolve({});
            }
        });
    }

    async checkConnectionStatus() {
        try {
            const status = await new Promise((resolve) => {
                chrome.storage.sync.get('mainSiteConnected', (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Storage error:', chrome.runtime.lastError);
                        resolve(false);
                    } else {
                        resolve(result.mainSiteConnected || false);
                    }
                });
            });

            const statusElement = document.getElementById('connectionStatus');
            if (statusElement) {
                const statusDot = statusElement.querySelector('.status-dot');
                const statusText = statusElement.querySelector('span');
                
                if (statusDot && statusText) {
                    if (status) {
                        statusDot.classList.remove('offline');
                        statusText.textContent = 'Connected to Main Site';
                    } else {
                        statusDot.classList.add('offline');
                        statusText.textContent = 'Disconnected from Main Site';
                    }
                }
            }
        } catch (error) {
            console.error('Connection status check error:', error);
        }
    }

    showNotification(message, type = 'info') {
        if (!message || typeof message !== 'string') {
            console.warn('Invalid notification message');
            return;
        }

        // Check if notification style exists, if not create it
        if (!document.querySelector('style[data-notifications]')) {
            const style = document.createElement('style');
            style.setAttribute('data-notifications', 'true');
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.setAttribute('role', 'status');
        notification.setAttribute('aria-live', type === 'error' ? 'assertive' : type === 'warning' ? 'polite' : 'polite');
        notification.setAttribute('aria-atomic', 'true');
        notification.textContent = message;
        
        // Determine background color
        let bgColor = 'var(--success)';
        if (type === 'error') bgColor = 'var(--error)';
        if (type === 'warning') bgColor = 'var(--warning)';
        if (type === 'info') bgColor = 'var(--info)';
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 14px 20px;
            border-radius: var(--border-radius);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            font-weight: 500;
            max-width: 350px;
            font-size: 14px;
        `;

        document.body.appendChild(notification);

        // Auto-remove after delay
        const timeoutId = setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                try {
                    notification.remove();
                } catch (e) {
                    // Already removed
                }
            }, 300);
        }, 3000);
        
        // Allow manual dismiss
        notification.style.cursor = 'pointer';
        notification.addEventListener('click', () => {
            clearTimeout(timeoutId);
            try {
                notification.remove();
            } catch (e) {
                // Already removed
            }
        });
    }

    openOptionsPage() {
        try {
            if (chrome.runtime && chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            }
        } catch (error) {
            console.error('Error opening options page:', error);
            this.showNotification('Could not open settings', 'error');
        }
    }

    openHelp() {
        try {
            const helpUrl = chrome.runtime.getURL('help.html');
            chrome.tabs.create({ url: helpUrl });
        } catch (error) {
            console.error('Error opening help:', error);
            this.showNotification('Could not open help', 'error');
        }
    }

    async loadSettings() {
        try {
            // Load any additional settings needed for popup
            const settings = await this.getAllSettings();
            console.log('Settings loaded:', Object.keys(settings).length, 'items');
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.popupManager = new PopupManager();
});

// Listen for messages from content script to open specific tabs
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openExtensionTab') {
        const tabName = message.tab;
        
        // Valid tab names that correspond to the extension popup tabs
        const validTabs = ['magnification', 'tts', 'scanning', 'filters', 'voice'];
        
        if (validTabs.includes(tabName) && window.popupManager) {
            // Switch to the requested tab
            window.popupManager.switchTab(tabName);
            sendResponse({success: true, message: `Switched to ${tabName} tab`});
        } else {
            sendResponse({success: false, message: 'Invalid tab name'});
        }
    }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PopupManager;
}