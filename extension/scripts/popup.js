// Main popup script for Accessibility Translator Extension

class PopupManager {
    constructor() {
        this.currentTab = null;
        this.activeTab = 'tts';
        this.init();
    }

    async init() {
        await this.getCurrentTab();
        this.setupEventListeners();
        this.loadSettings();
        this.initializeTTS();
        this.checkConnectionStatus();
    }

    async getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        this.currentTab = tab;
        return tab;
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchTab(e.currentTarget.getAttribute('data-tab'));
            });
        });

        // TTS Controls
        document.getElementById('playAll').addEventListener('click', () => {
            this.readEntirePage();
        });

        document.getElementById('stopAll').addEventListener('click', () => {
            this.stopSpeech();
        });

        // Voice selection
        document.getElementById('voiceSelect').addEventListener('change', (e) => {
            this.saveTTSSettings({ voice: e.target.value });
        });

        // Range inputs
        ['rate', 'pitch', 'volume'].forEach(id => {
            const element = document.getElementById(id);
            const valueElement = document.getElementById(`${id}Value`);
            
            element.addEventListener('input', (e) => {
                valueElement.textContent = e.target.value;
                this.saveTTSSettings({ [id]: parseFloat(e.target.value) });
            });
        });

        // Quick actions
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.getAttribute('data-action');
                this.handleQuickAction(action);
            });
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.currentTarget.closest('.filter-card').getAttribute('data-filter');
                this.applyColorFilter(filter);
            });
        });

        // Voice control
        document.getElementById('voiceToggle').addEventListener('click', () => {
            this.toggleVoiceControl();
        });

        // Sync with main site
        document.getElementById('syncWithMain').addEventListener('click', () => {
            this.syncWithMainSite();
        });

        // Settings and help
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openOptionsPage();
        });

        document.getElementById('helpBtn').addEventListener('click', () => {
            this.openHelp();
        });
    }

    switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        // Update selector position
        this.updateNavSelector(tabName);
        
        this.activeTab = tabName;
    }

    updateNavSelector(tabName) {
        const navItems = document.querySelectorAll('.nav-item');
        const activeItem = document.querySelector(`[data-tab="${tabName}"]`);
        const selector = document.querySelector('.nav-selector');
        
        const index = Array.from(navItems).indexOf(activeItem);
        const itemWidth = 100 / navItems.length;
        
        selector.style.width = `${itemWidth}%`;
        selector.style.left = `${index * itemWidth}%`;
    }

    async initializeTTS() {
        try {
            const voices = await this.getVoices();
            this.populateVoiceSelect(voices);
            
            const settings = await this.getTTSSettings();
            this.applyTTSSettings(settings);
        } catch (error) {
            console.error('TTS initialization failed:', error);
        }
    }

    async getVoices() {
        return new Promise((resolve) => {
            chrome.tts.getVoices((voices) => {
                resolve(voices || []);
            });
        });
    }

    populateVoiceSelect(voices) {
        const select = document.getElementById('voiceSelect');
        select.innerHTML = '';

        voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.voiceName;
            option.textContent = `${voice.voiceName} (${voice.lang})`;
            select.appendChild(option);
        });

        if (voices.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'No voices available';
            select.appendChild(option);
        }
    }

    async getTTSSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get('tts', (result) => {
                resolve(result.tts || {});
            });
        });
    }

    applyTTSSettings(settings) {
        if (settings.voice) {
            document.getElementById('voiceSelect').value = settings.voice;
        }
        
        ['rate', 'pitch', 'volume'].forEach(key => {
            if (settings[key] !== undefined) {
                const element = document.getElementById(key);
                const valueElement = document.getElementById(`${key}Value`);
                
                element.value = settings[key];
                valueElement.textContent = settings[key];
            }
        });
    }

    async saveTTSSettings(newSettings) {
        const current = await this.getTTSSettings();
        const updated = { ...current, ...newSettings };
        
        await new Promise((resolve) => {
            chrome.storage.sync.set({ tts: updated }, resolve);
        });
    }

    async readEntirePage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'extractPageText'
            });

            if (response && response.text) {
                const settings = await this.getTTSSettings();
                await chrome.runtime.sendMessage({
                    action: 'speakText',
                    text: response.text,
                    options: settings
                });
            }
        } catch (error) {
            console.error('Error reading page:', error);
            this.showNotification('Could not read page content', 'error');
        }
    }

    stopSpeech() {
        chrome.tts.stop();
    }

    async handleQuickAction(action) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        switch (action) {
            case 'read-headers':
                await this.readPageHeaders(tab.id);
                break;
            case 'read-links':
                await this.readPageLinks(tab.id);
                break;
            case 'read-images':
                await this.readImageAltTexts(tab.id);
                break;
            case 'read-selected':
                await this.readSelectedText(tab.id);
                break;
        }
    }

    async readPageHeaders(tabId) {
        // Implementation to extract and read headers
    }

    async readPageLinks(tabId) {
        // Implementation to extract and read links
    }

    async readImageAltTexts(tabId) {
        // Implementation to extract and read image alt texts
    }

    async readSelectedText(tabId) {
        // Implementation to read selected text
    }

    async applyColorFilter(filter) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, {
                action: 'applyFilter',
                filter: filter
            });

            // Update UI
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.textContent = 'Activate';
                btn.classList.remove('active');
            });

            const activeBtn = document.querySelector(`[data-filter="${filter}"] .filter-btn`);
            if (activeBtn) {
                activeBtn.textContent = 'Active';
                activeBtn.classList.add('active');
            }

            this.showNotification(`Applied ${filter} filter`, 'success');
        } catch (error) {
            console.error('Error applying filter:', error);
            this.showNotification('Could not apply filter', 'error');
        }
    }

    async toggleVoiceControl() {
        const toggleBtn = document.getElementById('voiceToggle');
        const isListening = toggleBtn.classList.contains('listening');

        if (isListening) {
            this.stopVoiceControl();
        } else {
            await this.startVoiceControl();
        }
    }

    async startVoiceControl() {
        // Implementation for voice control
    }

    stopVoiceControl() {
        // Implementation to stop voice control
    }

    async syncWithMainSite() {
        try {
            const settings = await this.getAllSettings();
            await chrome.runtime.sendMessage({
                action: 'syncWithMain',
                data: settings
            });
            
            this.showNotification('Synced with main site', 'success');
        } catch (error) {
            console.error('Sync failed:', error);
            this.showNotification('Sync failed', 'error');
        }
    }

    async getAllSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(null, resolve);
        });
    }

    async checkConnectionStatus() {
        const status = await new Promise((resolve) => {
            chrome.storage.sync.get('mainSiteConnected', (result) => {
                resolve(result.mainSiteConnected || false);
            });
        });

        const statusElement = document.getElementById('connectionStatus');
        const statusDot = statusElement.querySelector('.status-dot');
        
        if (status) {
            statusDot.style.background = 'var(--success)';
            statusElement.querySelector('span').textContent = 'Connected to Main Site';
        } else {
            statusDot.style.background = 'var(--error)';
            statusElement.querySelector('span').textContent = 'Disconnected from Main Site';
        }
    }

    showNotification(message, type = 'info') {
        // Create and show notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? 'var(--error)' : 'var(--success)'};
            color: white;
            padding: 12px 20px;
            border-radius: var(--border-radius);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    openOptionsPage() {
        chrome.runtime.openOptionsPage();
    }

    openHelp() {
        chrome.tabs.create({ url: chrome.runtime.getURL('help.html') });
    }

    async loadSettings() {
        // Load any additional settings needed for popup
    }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.popupManager = new PopupManager();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PopupManager;
}