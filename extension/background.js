// Background service worker for Accessibility Translator Extension

class ExtensionBackground {
    constructor() {
        this.currentTab = null;
        this.isConnected = false;
        this.mainSiteUrl = 'https://your-accessibility-translator-site.com'; // Replace with your main site
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkConnection();
        this.initializeStorage();
    }

    setupEventListeners() {
        // Tab updates
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.active) {
                this.currentTab = tabId;
                this.injectContentScript(tabId);
            }
        });

        // Tab activation
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.currentTab = activeInfo.tabId;
        });

        // Extension icon click
        chrome.action.onClicked.addListener((tab) => {
            this.toggleBubble(tab.id);
        });

        // Message handling
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async response
        });

        // Storage changes
        chrome.storage.onChanged.addListener((changes, area) => {
            this.handleStorageChanges(changes, area);
        });
    }

    async injectContentScript(tabId) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
            
            await chrome.scripting.insertCSS({
                target: { tabId: tabId },
                files: ['styles/bubble.css', 'styles/animations.css']
            });

            console.log('Content scripts injected successfully');
        } catch (error) {
            console.log('Content script injection failed:', error);
        }
    }

    async toggleBubble(tabId) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, {
                action: 'toggleBubble'
            });
            return response;
        } catch (error) {
            console.log('Could not toggle bubble:', error);
        }
    }

    async handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'getTabInfo':
                sendResponse({ tabId: sender.tab.id, url: sender.tab.url });
                break;

            case 'syncWithMain':
                await this.syncWithMainSite(request.data);
                sendResponse({ success: true });
                break;

            case 'applyFilter':
                await this.applyColorFilter(request.filter, sender.tab.id);
                sendResponse({ success: true });
                break;

            case 'speakText':
                await this.speakText(request.text, request.options);
                sendResponse({ success: true });
                break;

            case 'getVoices':
                const voices = await this.getAvailableVoices();
                sendResponse({ voices });
                break;

            case 'scanImage':
                const results = await this.scanImage(request.imageData);
                sendResponse({ results });
                break;

            default:
                console.log('Unknown action:', request.action);
        }
    }

    async initializeStorage() {
        const defaults = {
            tts: {
                voice: '',
                rate: 1,
                pitch: 1,
                volume: 1
            },
            filters: {
                active: null,
                custom: {
                    brightness: 1,
                    contrast: 1,
                    saturation: 1
                }
            },
            voiceControl: {
                enabled: false,
                commands: []
            },
            bubble: {
                position: 'right',
                enabled: true
            }
        };

        const current = await chrome.storage.sync.get(null);
        const merged = { ...defaults, ...current };
        await chrome.storage.sync.set(merged);
    }

    async checkConnection() {
        try {
            const response = await fetch(`${this.mainSiteUrl}/api/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            this.isConnected = response.ok;
            
            await chrome.storage.sync.set({ 
                mainSiteConnected: this.isConnected 
            });
        } catch (error) {
            this.isConnected = false;
            console.log('Main site connection failed:', error);
        }
    }

    async syncWithMainSite(userData) {
        if (!this.isConnected) {
            throw new Error('Not connected to main site');
        }

        try {
            const response = await fetch(`${this.mainSiteUrl}/api/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    extensionId: chrome.runtime.id,
                    userData: userData,
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error('Sync failed');
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
        const css = this.generateFilterCSS(filter);
        
        try {
            await chrome.scripting.insertCSS({
                target: { tabId: tabId },
                css: css
            });
            
            await chrome.storage.sync.set({ 
                activeFilter: filter 
            });
        } catch (error) {
            console.error('Filter application failed:', error);
        }
    }

    generateFilterCSS(filter) {
        const filters = {
            grayscale: 'grayscale(100%)',
            'high-contrast': 'contrast(200%) brightness(120%)',
            invert: 'invert(100%)',
            sepia: 'sepia(100%)',
            'blue-light': 'sepia(30%) hue-rotate(180deg)',
            protanopia: 'url(#protanopia)',
            deuteranopia: 'url(#deuteranopia)',
            tritanopia: 'url(#tritanopia)'
        };

        return `
            html, body, * {
                filter: ${filters[filter]} !important;
                -webkit-filter: ${filters[filter]} !important;
            }
        `;
    }

    async speakText(text, options = {}) {
        return new Promise((resolve) => {
            chrome.tts.speak(text, {
                rate: options.rate || 1,
                pitch: options.pitch || 1,
                volume: options.volume || 1,
                onEvent: (event) => {
                    if (event.type === 'end' || event.type === 'interrupted') {
                        resolve();
                    }
                }
            });
        });
    }

    async getAvailableVoices() {
        return new Promise((resolve) => {
            chrome.tts.getVoices((voices) => {
                resolve(voices || []);
            });
        });
    }

    async scanImage(imageData) {
        // This would integrate with your TensorFlow.js and Tesseract.js
        // For now, return mock data
        return {
            objects: [
                { label: 'person', confidence: 0.95 },
                { label: 'chair', confidence: 0.87 }
            ],
            text: 'Sample extracted text',
            timestamp: new Date().toISOString()
        };
    }

    handleStorageChanges(changes, area) {
        if (area === 'sync') {
            Object.keys(changes).forEach(key => {
                console.log(`Storage changed: ${key}`, changes[key]);
                
                // Notify content scripts about relevant changes
                if (key === 'activeFilter' || key === 'tts') {
                    this.notifyContentScripts('storageUpdated', changes[key]);
                }
            });
        }
    }

    async notifyContentScripts(action, data) {
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                action: action,
                data: data
            }).catch(() => {
                // Tab might not have content script
            });
        });
    }
}

// Initialize the background service
const extensionBackground = new ExtensionBackground();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtensionBackground;
}