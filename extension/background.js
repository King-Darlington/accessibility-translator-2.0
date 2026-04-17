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
        console.log('[AT] ExtensionBackground initialization started');
        try {
            this.setupEventListeners();
            console.log('[AT] Event listeners set up');

            this.checkConnection();
            console.log('[AT] Connection check initiated');

            this.initializeStorage();
            console.log('[AT] Storage initialized');

            console.log('[AT] ExtensionBackground initialized successfully');
        } catch (error) {
            console.error('[AT] ExtensionBackground initialization error:', error);
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
        console.log(`[AT] Injecting content script into tab ${tabId}`);
        try {
            if (!tabId || typeof tabId !== 'number') {
                throw new Error('Invalid tabId provided');
            }

            // First, inject the content script
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.js'],
                world: 'ISOLATED'
            });
            console.log(`[AT] Content script injected into tab ${tabId}`);

            // Then inject CSS files
            await chrome.scripting.insertCSS({
                target: { tabId },
                files: ['styles/bubble.css', 'styles/animation.css']
            });
            console.log(`[AT] CSS files injected into tab ${tabId}`);

            console.log(`[AT] Content scripts injected successfully in tab ${tabId}`);
        } catch (error) {
            // Don't throw - some tabs may not support script injection (system pages, etc.)
            console.debug(`[AT] Content script injection skipped for tab ${tabId}:`, error.message);
        }
    }

    async toggleBubble(tabId) {
        console.log(`[AT] Toggling bubble in tab ${tabId}`);
        try {
            if (!tabId || typeof tabId !== 'number') {
                throw new Error('Invalid tabId');
            }

            const response = await this.sendMessageToTab(tabId, { action: 'toggleBubble' });
            console.log(`[AT] Bubble toggled successfully in tab ${tabId}`);
            return response;
        } catch (error) {
            console.warn(`[AT] Could not toggle bubble in tab ${tabId}:`, error);
            // Try to inject content script and retry
            try {
                console.log(`[AT] Retrying bubble toggle after content script injection for tab ${tabId}`);
                await this.injectContentScript(tabId);
                await new Promise(r => setTimeout(r, 250));
                const retryResponse = await this.sendMessageToTab(tabId, { action: 'toggleBubble' });
                console.log(`[AT] Bubble toggle succeeded on retry for tab ${tabId}`);
                return retryResponse;
            } catch (retryError) {
                console.error('[AT] Bubble toggle failed even after injection:', retryError);
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
                        console.log(`[AT] Syncing with main site, data keys: ${Object.keys(request.data || {}).length}`);
                        const result = await this.syncWithMainSite(request.data || {});
                        console.log('[AT] Sync with main site completed successfully');
                        sendResponse({ success: true, data: result });
                    } catch (error) {
                        console.error('[AT] Sync with main site failed:', error);
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'applyFilter':
                    try {
                        if (!request.filter) {
                            throw new Error('No filter specified');
                        }
                        console.log(`[AT] Applying filter: ${request.filter} to tab ${tabId}`);
                        await this.applyColorFilter(request.filter, tabId);
                        console.log(`[AT] Filter ${request.filter} applied successfully`);
                        sendResponse({ success: true });
                    } catch (error) {
                        console.error(`[AT] Filter application failed:`, error);
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

                case 'openExtensionTab':
                    try {
                        if (!request.tab) {
                            throw new Error('No tab specified');
                        }
                        // Store the requested tab in storage so popup can read it
                        await chrome.storage.session.set({ 
                            requestedTab: request.tab,
                            timestamp: Date.now()
                        });
                        // Try to open the popup
                        chrome.action.openPopup(() => {
                            if (chrome.runtime.lastError) {
                                console.warn('Could not open popup:', chrome.runtime.lastError);
                            }
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
            filters: { active: 'normal', custom: { brightness: 1, contrast: 1, saturation: 1 } },
            voiceControl: { enabled: false, commands: [] },
            bubble: { position: 'right', enabled: true },
            activeFilter: 'normal'
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
            console.log('[AT] Attempting to sync with main site');

            // Check connection status first
            if (!this.isConnected) {
                console.log('[AT] Not connected to main site, storing data locally');
                // Store locally instead of throwing error
                await chrome.storage.sync.set({
                    pendingSync: userData,
                    lastSyncAttempt: new Date().toISOString()
                });
                return { success: false, message: 'Not connected, data stored locally' };
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
                mainSiteData: data,
                pendingSync: null // Clear pending sync
            });

            console.log('[AT] Sync with main site successful');
            return data;
        } catch (error) {
            console.error('[AT] Sync with main site failed:', error.message);
            // Store data locally for later sync
            try {
                await chrome.storage.sync.set({
                    pendingSync: userData,
                    lastSyncError: error.message,
                    lastSyncAttempt: new Date().toISOString()
                });
            } catch (storageError) {
                console.error('[AT] Failed to store pending sync:', storageError);
            }
            throw error;
        }
    }

    async applyColorFilter(filter, tabId) {
        try {
            if (!filter || typeof filter !== 'string') {
                throw new Error('Invalid filter');
            }

            if (tabId && typeof tabId === 'number') {
                // First, remove any previously applied filter CSS
                try {
                    await chrome.scripting.removeCSS({
                        target: { tabId },
                        css: `.at-color-filter-placeholder { }` // Dummy to clear previous
                    });
                } catch (e) {
                    // Continue even if removal fails (CSS may not exist)
                }

                // Now apply the new filter CSS
                const css = this.generateFilterCSS(filter);
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
        // Normal filter - no filter applied
        if (filter === 'normal' || (!filter)) {
            return `html, body, body * { filter: none !important; -webkit-filter: none !important; }`;
        }

        // High-contrast needs special handling to avoid darkening the page
        if (filter === 'high-contrast') {
            return `
                html, body {
                    background-color: #ffffff !important;
                    color: #000000 !important;
                }
                
                body {
                    filter: contrast(1.3) brightness(1.05) !important;
                    -webkit-filter: contrast(1.3) brightness(1.05) !important;
                }
                
                p, span, div, h1, h2, h3, h4, h5, h6, 
                li, td, tr, th, label, section, article {
                    color: #000000 !important;
                    background-color: #ffffff !important;
                }
                
                a {
                    color: #003B49 !important;
                    text-decoration: underline !important;
                    font-weight: bold !important;
                }
                
                button, input[type="button"], input[type="submit"], 
                input[type="reset"], textarea, select {
                    background-color: #003B49 !important;
                    color: #ffffff !important;
                    border: 2px solid #000000 !important;
                    font-weight: bold !important;
                }
                
                img, video, picture, svg {
                    opacity: 0.95 !important;
                    border: 1px solid #000000 !important;
                }
            `;
        }

        // Invert filter needs special handling to invert images too
        if (filter === 'invert') {
            return `
                html, body, body * {
                    filter: invert(100%) !important;
                    -webkit-filter: invert(100%) !important;
                }
                
                img, video, picture, canvas {
                    filter: invert(100%) !important;
                    -webkit-filter: invert(100%) !important;
                }
            `;
        }

        const filters = {
            grayscale: 'grayscale(100%)',
            sepia: 'sepia(100%)',
            'blue-light': 'sepia(30%) hue-rotate(180deg)',
            protanopia: 'url(#protanopia-filter)',
            deuteranopia: 'url(#deuteranopia-filter)',
            tritanopia: 'url(#tritanopia-filter)'
        };
        
        const rule = filters[filter] || 'none';
        return `html, body, body * { filter: ${rule} !important; -webkit-filter: ${rule} !important; }`;
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