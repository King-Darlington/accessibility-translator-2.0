// Background service worker for Accessibility Translator Extension

class ExtensionBackground {
    constructor() {
        this.currentTab = null;
        this.isConnected = false;
        this.mainSiteUrl = 'https://your-accessibility-translator-site.com'; // Replace with your main site
        this.messageTimeout = 5000;
        this.init();
    }

    init() {
        try {
            this.setupEventListeners();
            this.checkConnection();
            this.initializeStorage();
            console.log('ExtensionBackground initialized successfully');
        } catch (error) {
            console.error('ExtensionBackground initialization error:', error);
        }
    }

    setupEventListeners() {
        // Tab updates with error handling
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            try {
                if (changeInfo.status === 'complete' && tab.active) {
                    this.currentTab = tabId;
                    this.injectContentScript(tabId).catch(err => 
                        console.warn(`Failed to inject content script in tab ${tabId}:`, err)
                    );
                }
            } catch (error) {
                console.error('Tab update handler error:', error);
            }
        });

        // Tab activation
        chrome.tabs.onActivated.addListener((activeInfo) => {
            try {
                this.currentTab = activeInfo.tabId;
            } catch (error) {
                console.error('Tab activation handler error:', error);
            }
        });

        // Extension icon click
        if (chrome.action && chrome.action.onClicked) {
            chrome.action.onClicked.addListener((tab) => {
                try {
                    if (tab && tab.id) {
                        this.toggleBubble(tab.id).catch(err => 
                            console.warn('Failed to toggle bubble:', err)
                        );
                    }
                } catch (error) {
                    console.error('Action click handler error:', error);
                }
            });
        }

        // Message handling
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            try {
                // Validate request
                if (!request || typeof request !== 'object') {
                    sendResponse({ success: false, error: 'Invalid request' });
                    return;
                }
                
                this.handleMessage(request, sender, sendResponse);
            } catch (error) {
                console.error('Message listener error:', error);
                try {
                    sendResponse({ success: false, error: error.message });
                } catch (e) {
                    // sendResponse might fail if connection is closed
                }
            }
            return true; // Keep message channel open for async response
        });

        // Storage changes
        chrome.storage.onChanged.addListener((changes, area) => {
            try {
                this.handleStorageChanges(changes, area);
            } catch (error) {
                console.error('Storage change handler error:', error);
            }
        });
    }

    async injectContentScript(tabId) {
        try {
            if (!tabId || typeof tabId !== 'number') {
                throw new Error('Invalid tabId provided');
            }

            // First, inject the content script
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.js'],
                world: 'MAIN'
            });

            // Then inject CSS files
            await chrome.scripting.insertCSS({
                target: { tabId },
                files: ['styles/bubble.css', 'styles/animation.css']
            });

            console.log(`Content scripts injected successfully in tab ${tabId}`);
        } catch (error) {
            // Don't throw - some tabs may not support script injection (system pages, etc.)
            console.debug(`Content script injection skipped for tab ${tabId}:`, error.message);
        }
    }

    async toggleBubble(tabId) {
        try {
            if (!tabId || typeof tabId !== 'number') {
                throw new Error('Invalid tabId');
            }

            const response = await this.sendMessageToTab(tabId, { action: 'toggleBubble' });
            return response;
        } catch (error) {
            console.warn(`Could not toggle bubble in tab ${tabId}:`, error);
            // Try to inject content script and retry
            try {
                await this.injectContentScript(tabId);
                await new Promise(r => setTimeout(r, 250));
                return await this.sendMessageToTab(tabId, { action: 'toggleBubble' });
            } catch (retryError) {
                console.error('Bubble toggle failed even after injection:', retryError);
                return { success: false, error: 'Could not toggle bubble' };
            }
        }
    }

    async sendMessageToTab(tabId, message, timeout = this.messageTimeout) {
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
                        resolve(response || {});
                    }
                });
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            const action = request.action;
            const tabId = sender && sender.tab && sender.tab.id;

            switch (action) {
                case 'ping':
                    sendResponse({ success: true, pong: true });
                    break;

                case 'getTabInfo':
                    sendResponse({ 
                        tabId: tabId,
                        url: sender.tab?.url || '',
                        title: sender.tab?.title || ''
                    });
                    break;

                case 'syncSettings':
                    if (request.settings && typeof request.settings === 'object') {
                        await this.saveSettings(request.settings);
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'Invalid settings provided' });
                    }
                    break;

                case 'settingsSync':
                    try {
                        const settings = await this.loadSettings();
                        sendResponse({ success: true, settings });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'syncWithMain':
                    try {
                        const result = await this.syncWithMainSite(request.data || {});
                        sendResponse({ success: true, data: result });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'applyFilter':
                    try {
                        if (!request.filter) {
                            throw new Error('No filter specified');
                        }
                        await this.applyColorFilter(request.filter, tabId);
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'speakText':
                    try {
                        if (!request.text) {
                            throw new Error('No text provided');
                        }
                        await this.speakText(request.text, request.options || {});
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'getVoices':
                    try {
                        const voices = await this.getAvailableVoices();
                        sendResponse({ success: true, voices });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'scanImage':
                    try {
                        if (!request.imageData) {
                            throw new Error('No image data provided');
                        }
                        const results = await this.scanImage(request.imageData);
                        sendResponse({ success: true, results });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'applyTheme':
                    try {
                        if (!request.theme) {
                            throw new Error('No theme specified');
                        }
                        await chrome.storage.sync.set({ theme: request.theme });
                        await this.notifyContentScripts('themeApplied', { theme: request.theme });
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'accessibilityCommand':
                    try {
                        if (!request.command) {
                            throw new Error('No command specified');
                        }
                        await chrome.storage.sync.set({ 
                            lastAccessibilityCmd: request.command, 
                            timestamp: Date.now() 
                        });
                        await this.notifyContentScripts('accessibilityCommand', { 
                            command: request.command 
                        });
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                default:
                    sendResponse({ success: false, error: `Unknown action: ${action}` });
            }
        } catch (err) {
            console.error('handleMessage error:', err);
            try { 
                sendResponse({ success: false, error: err.message }); 
            } catch(e) {
                console.warn('Could not send error response:', e);
            }
        }
    }

    initializeStorage() {
        const defaults = {
            tts: { voice: '', rate: 1, pitch: 1, volume: 1 },
            filters: { active: null, custom: { brightness: 1, contrast: 1, saturation: 1 } },
            voiceControl: { enabled: false, commands: [] },
            bubble: { position: 'right', enabled: true }
        };

        chrome.storage.sync.get(null, (current) => {
            try {
                if (chrome.runtime.lastError) {
                    console.warn('Storage read error:', chrome.runtime.lastError);
                    // Continue with defaults
                    chrome.storage.sync.set(defaults, () => {
                        if (chrome.runtime.lastError) {
                            console.warn('Storage write error:', chrome.runtime.lastError);
                        }
                    });
                } else {
                    const merged = Object.assign({}, defaults, current || {});
                    chrome.storage.sync.set(merged, () => {
                        if (chrome.runtime.lastError) {
                            console.warn('Storage merge error:', chrome.runtime.lastError);
                        }
                    });
                }
            } catch (error) {
                console.error('Storage initialization error:', error);
            }
        });
    }

    async checkConnection() {
        try {
            const response = await fetch(`${this.mainSiteUrl}/api/health`, { 
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                timeout: this.messageTimeout
            });
            this.isConnected = response && response.ok;
            await chrome.storage.sync.set({ mainSiteConnected: this.isConnected });
        } catch (error) {
            this.isConnected = false;
            console.debug('Main site connection check failed (expected if offline):', error.message);
        }
    }

    async syncWithMainSite(userData) {
        try {
            if (!this.isConnected) {
                throw new Error('Not connected to main site');
            }

            if (!userData || typeof userData !== 'object') {
                throw new Error('Invalid user data');
            }

            const response = await fetch(`${this.mainSiteUrl}/api/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    extensionId: chrome.runtime.id,
                    userData: userData,
                    timestamp: new Date().toISOString()
                }),
                timeout: this.messageTimeout
            });

            if (!response.ok) {
                throw new Error(`Sync failed with status ${response.status}`);
            }

            const data = await response.json();
            await chrome.storage.sync.set({ 
                lastSync: new Date().toISOString(),
                mainSiteData: data
            });

            return data;
        } catch (error) {
            console.error('Sync error:', error);
            throw error;
        }
    }

    async applyColorFilter(filter, tabId) {
        try {
            if (!filter || typeof filter !== 'string') {
                throw new Error('Invalid filter');
            }

            const css = this.generateFilterCSS(filter);
            
            if (tabId && typeof tabId === 'number') {
                await chrome.scripting.insertCSS({
                    target: { tabId },
                    css: css
                });
            }

            await chrome.storage.sync.set({ activeFilter: filter });
        } catch (error) {
            console.error(`Filter application failed for ${filter}:`, error);
            throw error;
        }
    }

    generateFilterCSS(filter) {
        const filters = {
            grayscale: 'grayscale(100%)',
            'high-contrast': 'contrast(200%) brightness(120%)',
            invert: 'invert(100%)',
            sepia: 'sepia(100%)',
            'blue-light': 'sepia(30%) hue-rotate(180deg)',
            protanopia: 'url(#protanopia-filter)',
            deuteranopia: 'url(#deuteranopia-filter)',
            tritanopia: 'url(#tritanopia-filter)'
        };
        
        const rule = filters[filter] || 'none';
        return `html, body, * { filter: ${rule} !important; -webkit-filter: ${rule} !important; }`;
    }

    speakText(text, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                if (!text || typeof text !== 'string') {
                    throw new Error('Invalid text provided');
                }

                if (!chrome.tts || typeof chrome.tts.speak !== 'function') {
                    throw new Error('Text-to-speech not available');
                }

                chrome.tts.speak(text, {
                    rate: Math.max(0.1, Math.min(2, options.rate || 1)),
                    pitch: Math.max(0, Math.min(2, options.pitch || 1)),
                    volume: Math.max(0, Math.min(1, options.volume || 1)),
                    onEvent: (event) => {
                        if (event.type === 'end' || event.type === 'interrupted' || event.type === 'error') {
                            resolve();
                        }
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    getAvailableVoices() {
        return new Promise((resolve, reject) => {
            try {
                if (!chrome.tts || typeof chrome.tts.getVoices !== 'function') {
                    resolve([]);
                    return;
                }

                chrome.tts.getVoices((voices) => {
                    resolve(voices || []);
                });
            } catch (error) {
                console.warn('Error getting voices:', error);
                resolve([]);
            }
        });
    }

    async scanImage(imageData) {
        // Placeholder implementation
        // In production, integrate with TensorFlow.js or similar
        try {
            if (!imageData) {
                throw new Error('No image data provided');
            }

            return {
                objects: [],
                text: '',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Image scan error:', error);
            throw error;
        }
    }

    handleStorageChanges(changes, area) {
        try {
            if (area !== 'sync') return;

            Object.keys(changes).forEach((key) => {
                const change = changes[key];
                console.debug(`Storage changed: ${key}`, change.newValue);
                
                // Notify content scripts of important changes
                if (['activeFilter', 'tts', 'theme'].includes(key)) {
                    this.notifyContentScripts('storageUpdated', { 
                        key,
                        value: change.newValue 
                    }).catch(err => 
                        console.debug('Failed to notify content scripts:', err)
                    );
                }
            });
        } catch (error) {
            console.error('Storage change handler error:', error);
        }
    }

    saveSettings(settings) {
        return new Promise((resolve, reject) => {
            try {
                if (!settings || typeof settings !== 'object') {
                    reject(new Error('Invalid settings'));
                    return;
                }

                chrome.storage.sync.set({ 
                    extensionSettings: settings, 
                    lastSettingsSync: Date.now() 
                }, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(true);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    loadSettings() {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.sync.get(['extensionSettings'], (result) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(result.extensionSettings || {});
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async notifyContentScripts(action, data) {
        try {
            if (!action || typeof action !== 'string') {
                throw new Error('Invalid action');
            }

            const tabs = await chrome.tabs.query({});
            
            tabs.forEach((tab) => {
                if (!tab || !tab.id) return;

                try {
                    const p = chrome.tabs.sendMessage(tab.id, { action, data });
                    if (p && typeof p.then === 'function') {
                        p.catch(() => {
                            // Silently ignore - tab may not have content script loaded
                        });
                    }
                } catch (e) {
                    // Some environments may throw synchronously; ignore
                    console.debug(`Could not notify tab ${tab.id}:`, e.message);
                }
            });
        } catch (error) {
            console.error('Error notifying content scripts:', error);
        }
    }
}


// Initialize the background service
const extensionBackground = new ExtensionBackground();

// Export for testing (Node environment)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtensionBackground;
}