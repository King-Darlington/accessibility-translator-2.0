// Main popup script for Accessibility Translator Extension

// Ensure chrome API is available and create a fallback if needed
if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.warn('Chrome extension API not available in this context');
    window.chrome = window.chrome || {};
    window.chrome.runtime = {
        lastError: null,
        sendMessage: () => Promise.resolve({}),
        onMessage: { addListener: () => {} }
    };
    window.chrome.storage = {
        sync: { get: (key, cb) => cb({}), set: () => {} },
        session: { get: () => Promise.resolve({}), remove: () => Promise.resolve({}) }
    };
    window.chrome.tabs = {
        query: () => Promise.resolve([])
    };
}

class PopupManager {
    constructor() {
        this.currentTab = null;
        this.activeTab = 'tts';
        this.isInitialized = false;
        this.messageTimeout = 2000; // Reduced from 5000 to 2000ms
        this.init();
    }

    async init() {
        console.log('[AT] PopupManager initialization started');
        try {
            await this.getCurrentTab();
            console.log('[AT] Current tab retrieved');

            this.setupEventListeners();
            console.log('[AT] Event listeners set up');

            await this.loadSettings();
            console.log('[AT] Settings loaded');

            await this.initializeTTS();
            console.log('[AT] TTS initialized');

            await this.checkConnectionStatus();
            console.log('[AT] Connection status checked');

            this.setupLoginModal();
            console.log('[AT] Login modal set up');

            // Check if a specific tab was requested from the bubble/content script
            try {
                const stored = await chrome.storage.session.get(['requestedTab']);
                if (stored && stored.requestedTab) {
                    const requestedTab = stored.requestedTab;
                    console.log(`[AT] Requested tab found: ${requestedTab}`);
                    // Clear the stored request
                    await chrome.storage.session.remove(['requestedTab']);
                    // Switch to the requested tab without activating the feature
                    setTimeout(() => {
                        this.switchTab(requestedTab, false);
                    }, 100);
                } else {
                    // Ensure TTS tab is initialized and active by default without activating the feature
                    this.switchTab('tts', false);
                    console.log('[AT] Switched to default TTS tab');
                }
            } catch (error) {
                console.warn('[AT] Could not check for requested tab:', error);
                // Ensure TTS tab is active even if there's an error
                this.switchTab('tts', false);
            }

            this.isInitialized = true;
            console.log('[AT] PopupManager initialized successfully');
        } catch (error) {
            console.error('[AT] PopupManager initialization error:', error);
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

        // Keyboard shortcuts for tab navigation
        document.addEventListener('keydown', (e) => {
            this.handlePopupKeyboardShortcuts(e);
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
                const filter = e.currentTarget.getAttribute('data-filter');
                if (filter) {
                    this.applyColorFilter(filter)
                        .catch(err => console.error(`Filter ${filter} error:`, err));
                }
            });
        });

        // Reset filters button
        const resetBtn = document.getElementById('resetFilters');
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.resetColorFilters();
            });
        }

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

    switchTab(tabName, shouldActivate = true) {
        console.log(`[AT] Switching to tab: ${tabName} (shouldActivate=${shouldActivate})`);
        if (!tabName) {
            console.error('[AT] Tab name is required');
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
            
            console.log(`[AT] Switched to tab: ${tabName}`);
        }

        // Update selector position
        this.updateNavSelector(tabName);
        this.activeTab = tabName;

        // Activate the corresponding feature on the page when requested
        if (shouldActivate) {
            this.activateFeature(tabName);
        }
    }

    async activateFeature(tabName) {
        console.log(`[AT] Activating feature: ${tabName}`);
        try {
            // Always get the current active tab
            const currentTab = await this.getCurrentTab();
            if (!currentTab || !currentTab.id) {
                console.warn('[AT] No active tab available for feature activation');
                return;
            }

            // Check if the tab URL is supported
            if (!currentTab.url || (!currentTab.url.startsWith('http://') && !currentTab.url.startsWith('https://'))) {
                console.log(`[AT] Feature activation skipped - unsupported URL: ${currentTab.url}`);
                this.showNotification('Features are not available on this page type', 'warning');
                return;
            }

            // Inject feature code directly into the page
            const actionMap = {
                'tts': this.injectTTS,
                'scanning': this.injectScanning,
                'filters': this.injectFilters,
                'voice': this.injectVoice
            };

            const injectFunction = actionMap[tabName];
            if (injectFunction) {
                await injectFunction.call(this, currentTab.id);
                console.log(`[AT] Activated feature: ${tabName} on tab ${currentTab.id}`);
                this.showNotification(`${tabName} feature activated`, 'success');
            }
        } catch (error) {
            console.warn(`[AT] Could not activate feature ${tabName}:`, error.message);
            this.showNotification(`Could not activate ${tabName} feature`, 'error');
        }
    }

    async injectTTS(tabId) {
        // Inject TTS functionality
        const code = `
            (function() {
                // Extract page text
                const pageText = document.body.innerText || document.body.textContent || '';
                if (pageText.trim()) {
                    // Use Web Speech API
                    if ('speechSynthesis' in window) {
                        const utterance = new SpeechSynthesisUtterance(pageText.substring(0, 5000)); // Limit to first 5000 chars
                        window.speechSynthesis.speak(utterance);
                    }
                }
            })();
        `;
        await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const pageText = document.body.innerText || document.body.textContent || '';
                if (pageText.trim() && 'speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(pageText.substring(0, 5000));
                    window.speechSynthesis.speak(utterance);
                }
            }
        });
    }

    async injectScanning(tabId) {
        // Notify user that scanning is available
        console.log('[AT] Object scanning tab activated - camera and OCR features available');
        // The UI is already displayed in the popup, no additional injection needed
    }

    async injectFilters(tabId) {
        // Feature UI is already displayed in popup, no injection needed
        console.log('[AT] Color filters tab activated');
    }

    async injectVoice(tabId) {
        // Feature UI is already displayed in popup, no injection needed
        console.log('[AT] Voice control tab activated');
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
            if (!window.speechSynthesis) {
                console.warn('Web Speech API not available');
                return [];
            }

            return new Promise((resolve) => {
                let resolved = false;
                const MAX_VOICE_TIMEOUT = 5000;

                const finish = (voices) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeoutId);
                        if (voiceListener) {
                            window.speechSynthesis.removeEventListener('voiceschanged', voiceListener);
                        }
                        resolve(voices || []);
                    }
                };

                const getAvailableVoices = () => {
                    const voices = window.speechSynthesis.getVoices();
                    if (voices && voices.length > 0) {
                        finish(voices);
                    }
                };

                const voiceListener = () => {
                    getAvailableVoices();
                };

                const timeoutId = setTimeout(() => {
                    console.warn(`Voices request timed out after ${MAX_VOICE_TIMEOUT}ms`);
                    finish(window.speechSynthesis.getVoices() || []);
                }, MAX_VOICE_TIMEOUT);

                window.speechSynthesis.addEventListener('voiceschanged', voiceListener);

                // Browse voices one last time in case they are already loaded
                if (window.speechSynthesis.getVoices().length > 0) {
                    getAvailableVoices();
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
                    if (chrome.runtime && chrome.runtime.lastError) {
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
                    if (chrome.runtime && chrome.runtime.lastError) {
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
        console.log('[AT] Reading entire page');
        try {
            if (!this.currentTab || !this.currentTab.id) {
                throw new Error('No active tab available');
            }

            // Try to inject content script if not present
            await this.ensureContentScriptLoaded(this.currentTab.id);
            console.log(`[AT] Content script ensured for page reading on tab ${this.currentTab.id}`);

            const response = await this.sendMessageWithTimeout(this.currentTab.id, {
                action: 'extractPageText'
            });

            if (response && response.text) {
                console.log(`[AT] Page text extracted, length: ${response.text.length}`);
                await this.speakText(response.text);
                this.showNotification('Reading page...', 'success');
            } else {
                console.log('[AT] No text extracted from page');
                throw new Error('No text extracted from page');
            }
        } catch (error) {
            console.error('[AT] Error reading page:', error);
            this.showNotification('Could not read page content', 'error');
        }
    }

    async ensureContentScriptLoaded(tabId) {
        try {
            // Test if content script is loaded by sending a ping
            await this.sendMessageWithTimeout(tabId, { action: 'ping' }, 1000);
            return true;
        } catch (error) {
            console.warn('[AT] Ping failed, injecting content script:', error);
            try {
                // Inject all required CSS files first
                const cssFiles = [
                    'styles/bubble.css',
                    'styles/animation.css',
                    'styles/extension-interface.css'
                ];

                for (const cssFile of cssFiles) {
                    await chrome.scripting.insertCSS({
                        target: { tabId },
                        files: [cssFile]
                    });
                }

                // Inject all required JS files
                const jsFiles = [
                    'scripts/voice_commands.js',
                    'content.js'
                ];

                for (const jsFile of jsFiles) {
                    await chrome.scripting.executeScript({
                        target: { tabId },
                        files: [jsFile]
                    });
                }

                // Wait for scripts to initialize
                await new Promise(r => setTimeout(r, 500));

                // Test again
                await this.sendMessageWithTimeout(tabId, { action: 'ping' }, 2000);
                return true;
            } catch (injectionError) {
                console.warn('[AT] Could not inject content script:', injectionError);
                return false;
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
                    if (chrome.runtime && chrome.runtime.lastError) {
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
            // Use Web Speech API to stop speech
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
                console.log('Speech stopped');
            } else {
                console.warn('Web Speech API not available');
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

            if (response && response.headers && Array.isArray(response.headers)) {
                // Convert header objects to readable text with level indication
                const headersText = response.headers
                    .map(header => `Heading ${header.level}: ${header.text}`)
                    .join('. ');
                
                if (headersText) {
                    await this.speakText(headersText);
                    this.showNotification(`Found ${response.headers.length} headings`, 'success');
                }
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

            if (response && response.links && Array.isArray(response.links)) {
                // Convert link objects to readable text
                const linksText = response.links
                    .map(link => `${link.text || 'Link'}: ${link.href}`)
                    .join('. ');
                
                if (linksText) {
                    await this.speakText(linksText);
                    this.showNotification(`Found ${response.links.length} links`, 'success');
                }
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

            if (response && response.alts && Array.isArray(response.alts)) {
                // Convert image objects to readable text
                const altsText = response.alts
                    .map(img => img.alt || 'Image without description')
                    .join('. ');
                
                if (altsText) {
                    await this.speakText(altsText);
                    this.showNotification(`Found ${response.alts.length} images`, 'success');
                }
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

    getPreferredAfricanVoice(voices) {
        if (!voices || !voices.length) return null;

        const normalized = (s) => (s || '').toLowerCase();

        let preferred = voices.find(v => normalized(v.lang) === 'en-ng');
        if (!preferred) {
            preferred = voices.find(v => normalized(v.name).includes('nigerian') || normalized(v.name).includes('african'));
        }
        if (!preferred) {
            preferred = voices.find(v => normalized(v.lang).startsWith('en-') && (normalized(v.name).includes('africa') || normalized(v.name).includes('afro')));
        }
        if (!preferred) {
            preferred = voices.find(v => normalized(v.lang) === 'en-gb' || normalized(v.lang) === 'en-us');
        }

        return preferred || voices[0] || null;
    }

    async speakText(text) {
        console.log(`[AT] Speaking text, length: ${text?.length || 0}`);
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid text provided');
            }

            if (!window.speechSynthesis) {
                throw new Error('Text-to-speech not available');
            }

            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            console.log('[AT] Cancelled any ongoing speech');

            const settings = await this.getTTSSettings();
            const utterance = new SpeechSynthesisUtterance(text.trim());

            // Apply TTS settings
            utterance.rate = settings.rate || 1;
            utterance.pitch = settings.pitch || 1;
            utterance.volume = settings.volume || 1;
            console.log(`[AT] Applied TTS settings: rate=${utterance.rate}, pitch=${utterance.pitch}, volume=${utterance.volume}`);

            const voices = window.speechSynthesis.getVoices();
            let selectedVoice = null;
            if (settings.voice) {
                selectedVoice = voices.find(v => v.name === settings.voice || v.voiceName === settings.voice || v.lang === settings.voice);
            }

            if (!selectedVoice) {
                selectedVoice = this.getPreferredAfricanVoice(voices);
            }

            if (selectedVoice) {
                utterance.voice = selectedVoice;
                console.log(`[AT] Selected voice: ${selectedVoice.name} (${selectedVoice.lang})`);
            }

            window.speechSynthesis.speak(utterance);
            console.log('[AT] Started speech synthesis');
        } catch (error) {
            console.error('[AT] Error speaking text:', error);
            throw error;
        }
    }

    async applyColorFilter(filter) {
        console.log(`[AT] Applying color filter: ${filter}`);
        try {
            if (!filter || typeof filter !== 'string') {
                throw new Error('Invalid filter specified');
            }

            if (!this.currentTab || !this.currentTab.id) {
                console.log('[AT] No active tab available for filter application');
                this.showNotification('No active tab available to apply filter', 'error');
                return;
            }

            // Ensure content script is loaded
            const contentLoaded = await this.ensureContentScriptLoaded(this.currentTab.id);
            if (!contentLoaded) {
                console.error('[AT] Content script could not be loaded for filter application');
                this.showNotification('Could not apply filter. Content script not loaded.', 'error');
                return;
            }
            console.log(`[AT] Content script ensured for tab ${this.currentTab.id}`);

            // Apply filter with timeout
            await this.sendMessageWithTimeout(this.currentTab.id, {
                action: 'applyFilter',
                filter: filter
            });
            console.log(`[AT] Filter ${filter} applied successfully`);

            // Update UI feedback
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            const activeButton = document.querySelector(`.filter-btn[data-filter="${filter}"]`);
            if (activeButton) {
                activeButton.classList.add('active');
            }

            this.showNotification(`Applied ${filter} filter`, 'success');
        } catch (error) {
            console.error(`[AT] Error applying filter ${filter}:`, error);
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

            // Ensure content script is loaded
            const contentLoaded = await this.ensureContentScriptLoaded(this.currentTab.id);
            if (!contentLoaded) {
                throw new Error('Content script not loaded');
            }

            // Send message to start voice control in content script
            await this.sendMessageWithTimeout(this.currentTab.id, {
                action: 'startVoiceControl'
            }, 3000);

            const toggleBtn = document.getElementById('voiceToggle');
            if (toggleBtn) {
                toggleBtn.classList.add('listening');
                toggleBtn.textContent = '⏹ Stop Voice';
                toggleBtn.setAttribute('aria-pressed', 'true');
            }

            this.showNotification('🎤 listening... say a command', 'info');
        } catch (error) {
            console.error('Start voice control error:', error);
            this.showNotification('Could not start voice control', 'error');
        }
    }

    async stopVoiceControl() {
        try {
            if (this.currentTab && this.currentTab.id) {
                // Send message to stop voice control in content script
                await this.sendMessageWithTimeout(this.currentTab.id, {
                    action: 'stopVoiceControl'
                }, 3000).catch(err => console.debug('Stop voice control message error:', err));
            }

            const toggleBtn = document.getElementById('voiceToggle');
            if (toggleBtn) {
                toggleBtn.classList.remove('listening');
                toggleBtn.textContent = '🎤 Start Voice';
                toggleBtn.setAttribute('aria-pressed', 'false');
            }

            this.showNotification('🎤 Voice control stopped', 'info');
        } catch (error) {
            console.error('Stop voice control error:', error);
        }
    }

    async syncWithMainSite() {
        console.log('[AT] Starting sync with main site');
        try {
            const settings = await this.getAllSettings();
            console.log(`[AT] Retrieved ${Object.keys(settings).length} settings for sync`);

            const syncResult = await this.sendRuntimeMessage({
                action: 'syncWithMain',
                data: settings
            });
            
            if (syncResult && syncResult.success) {
                console.log('[AT] Sync with main site successful');
                this.showNotification('Synced with main site', 'success');
            } else {
                console.log('[AT] Sync with main site failed:', syncResult);
                throw new Error('Sync failed on background process');
            }
        } catch (error) {
            console.error('[AT] Sync failed:', error);
            this.showNotification('Sync failed. Check your connection.', 'error');
        }
    }

    async sendRuntimeMessage(message) {
        /**
         * Safely send a message to the background script
         * Includes error handling for when chrome.runtime is not available
         */
        try {
            if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
                console.warn('Chrome runtime not available for messaging', message);
                return { success: false, error: 'chrome.runtime not available' };
            }
            return await chrome.runtime.sendMessage(message);
        } catch (error) {
            console.error('Error sending runtime message:', error, message);
            return { success: false, error: error.message };
        }
    }

    async getAllSettings() {
        return new Promise((resolve) => {
            try {
                chrome.storage.sync.get(null, (result) => {
                    if (chrome.runtime && chrome.runtime.lastError) {
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
                chrome.storage.sync.get(['mainSiteConnected', 'extensionUser'], (result) => {
                    if (chrome.runtime && chrome.runtime.lastError) {
                        console.warn('Storage error:', chrome.runtime.lastError);
                        resolve({ connected: false });
                    } else {
                        resolve({
                            connected: result.mainSiteConnected || false,
                            user: result.extensionUser || null
                        });
                    }
                });
            });

            const statusElement = document.getElementById('connectionStatus');
            const statusDot = statusElement?.querySelector('.status-dot');
            const statusText = document.getElementById('status-text');
            const connectBtn = document.getElementById('connect-btn');

            if (statusDot && statusText) {
                if (status.connected && status.user) {
                    statusDot.classList.remove('offline');
                    statusText.textContent = `Connected as ${status.user.name}`;
                    if (connectBtn) connectBtn.style.display = 'none';
                } else {
                    statusDot.classList.add('offline');
                    statusText.textContent = 'Not Connected';
                    if (connectBtn) connectBtn.style.display = 'inline-flex';
                }
            }

            // Auto-refresh connection status every 30 seconds
            if (!window.connectionStatusRefreshInterval) {
                window.connectionStatusRefreshInterval = setInterval(() => {
                    this.checkConnectionStatus().catch(err => 
                        console.debug('Auto-refresh connection status failed:', err)
                    );
                }, 30000);
            }
        } catch (error) {
            console.error('Connection status check error:', error);
        }
    }

    setupLoginModal() {
        const loginForm = document.getElementById('extension-login-form');
        const connectBtn = document.getElementById('connect-btn');
        const loginModal = document.getElementById('login-modal');
        const loginCloseBtn = document.getElementById('login-close-btn');

        if (connectBtn) {
            connectBtn.addEventListener('click', async () => {
                // First check if user is logged in on main site
                await this.verifyMainSiteSession();
                if (loginModal) loginModal.style.display = 'flex';
            });
        }

        if (loginCloseBtn) {
            loginCloseBtn.addEventListener('click', () => {
                if (loginModal) loginModal.style.display = 'none';
                this.clearLoginForm();
            });
        }

        if (loginModal) {
            loginModal.addEventListener('click', (e) => {
                if (e.target === loginModal) {
                    loginModal.style.display = 'none';
                    this.clearLoginForm();
                }
            });
        }

        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleExtensionLogin();
            });
        }
    }

    async verifyMainSiteSession() {
        try {
            // Try to get main site URL from different sources
            let mainSiteUrl = null;

            // First, try to get it from saved preferences
            const storageData = await new Promise((resolve) => {
                chrome.storage.sync.get(['mainSiteUrl'], resolve);
            });
            
            if (storageData?.mainSiteUrl) {
                mainSiteUrl = storageData.mainSiteUrl;
            } else {
                // For development, use localhost
                mainSiteUrl = 'http://localhost/accessibility-translator-2.0';
            }

            const response = await fetch(`${mainSiteUrl}/api/auth/check-session.php`, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include',
                mode: 'cors'
            });

            const data = await response.json();
            
            if (data.success && data.isLoggedIn) {
                console.log('User is logged in on main site:', data.user);
                return true;
            } else {
                console.warn('User not logged in on main site');
                return false;
            }
        } catch (error) {
            console.warn('Main site session verification failed:', error.message);
            // If verification fails, allow login to proceed (connection issue or site offline)
            return true;
        }
    }

    async handleExtensionLogin() {
        console.log('[AT] Starting extension login process');
        const email = document.getElementById('login-email')?.value.trim();
        const password = document.getElementById('login-password')?.value;
        const submitBtn = document.getElementById('login-submit-btn');
        const errorDiv = document.getElementById('login-error');

        if (!email || !password) {
            console.log('[AT] Login validation failed: missing email or password');
            this.showLoginError('Email and password are required');
            return;
        }

        if (submitBtn) submitBtn.disabled = true;
        if (errorDiv) errorDiv.style.display = 'none';
        console.log('[AT] Login form validated, attempting authentication');

        try {
            // Get main site URL 
            let mainSiteUrl = 'http://localhost/accessibility-translator-2.0';
            const storageData = await new Promise((resolve) => {
                chrome.storage.sync.get(['mainSiteUrl'], resolve);
            });
            if (storageData?.mainSiteUrl) {
                mainSiteUrl = storageData.mainSiteUrl;
            }
            console.log(`[AT] Using main site URL: ${mainSiteUrl}`);

            const response = await fetch(`${mainSiteUrl}/api/auth/extension-login.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ email, password }),
                credentials: 'include',
                mode: 'cors'
            });

            if (!response.ok) {
                const data = await response.json();
                console.log(`[AT] Login HTTP error: ${response.status}`, data);
                throw new Error(data.error || 'Login failed');
            }

            const data = await response.json();
            if (!data.success) {
                console.log('[AT] Login API error:', data);
                throw new Error(data.error || 'Login failed');
            }

            console.log('[AT] Login successful, storing user data');
            // Store connection data in chrome storage
            await new Promise((resolve) => {
                chrome.storage.sync.set({
                    mainSiteConnected: true,
                    mainSiteUrl: mainSiteUrl,
                    extensionUser: data.user,
                    extensionToken: data.token,
                    tokenExpiry: data.tokenExpiry,
                    userPreferences: data.preferences
                }, resolve);
            });

            // Apply user preferences
            if (data.preferences) {
                this.applyUserPreferences(data.preferences);
                console.log('[AT] User preferences applied');
            }

            this.showNotification(`Welcome, ${data.user.name}!`, 'success');
            
            // Close login modal
            const loginModal = document.getElementById('login-modal');
            if (loginModal) loginModal.style.display = 'none';

            // Update connection status display
            await this.checkConnectionStatus();
            
            this.clearLoginForm();

        } catch (error) {
            console.error('Login error:', error);
            this.showLoginError(error.message || 'Login failed. Please try again.');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    showLoginError(message) {
        const errorDiv = document.getElementById('login-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    clearLoginForm() {
        const form = document.getElementById('extension-login-form');
        if (form) form.reset();
        const errorDiv = document.getElementById('login-error');
        if (errorDiv) errorDiv.style.display = 'none';
    }

    applyUserPreferences(preferences) {
        try {
            if (!preferences) return;

            // Apply TTS settings
            if (preferences.tts_speed) {
                const speedInput = document.getElementById('rate');
                if (speedInput) speedInput.value = preferences.tts_speed;
            }
            if (preferences.tts_pitch) {
                const pitchInput = document.getElementById('pitch');
                if (pitchInput) pitchInput.value = preferences.tts_pitch;
            }
            if (preferences.tts_voice) {
                const voiceSelect = document.getElementById('voiceSelect');
                if (voiceSelect) voiceSelect.value = preferences.tts_voice;
            }

            // Apply other preferences as needed
            console.log('User preferences applied');
        } catch (error) {
            console.warn('Error applying user preferences:', error);
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

    handlePopupKeyboardShortcuts(event) {
        // Ctrl+1 or Cmd+1 for TTS tab
        if ((event.ctrlKey || event.metaKey) && event.key === '1') {
            event.preventDefault();
            this.switchTab('tts');
        }

        // Ctrl+3 or Cmd+3 for Scanning tab
        if ((event.ctrlKey || event.metaKey) && event.key === '3') {
            event.preventDefault();
            this.switchTab('scanning');
        }

        // Ctrl+4 or Cmd+4 for Filters tab
        if ((event.ctrlKey || event.metaKey) && event.key === '4') {
            event.preventDefault();
            this.switchTab('filters');
        }

        // Ctrl+5 or Cmd+5 for Voice tab
        if ((event.ctrlKey || event.metaKey) && event.key === '5') {
            event.preventDefault();
            this.switchTab('voice');
        }

        // Ctrl+Space or Cmd+Space for quick play all
        if ((event.ctrlKey || event.metaKey) && event.key === ' ') {
            event.preventDefault();
            const playBtn = document.getElementById('playAll');
            if (playBtn && this.activeTab === 'tts') {
                playBtn.click();
            }
        }

        // Escape key to close notifications
        if (event.key === 'Escape') {
            const notifications = document.querySelectorAll('.notification');
            notifications.forEach(notif => {
                try {
                    notif.remove();
                } catch (e) {
                    // Already removed
                }
            });
        }
    }

    openOptionsPage() {
        try {
            if (chrome.runtime && chrome.runtime.openOptionsPage && typeof chrome.runtime.openOptionsPage === 'function') {
                chrome.runtime.openOptionsPage();
            } else {
                this.showNotification('Options page is not configured', 'info');
            }
        } catch (error) {
            console.debug('Error opening options page:', error.message);
            this.showNotification('Options page is not available', 'info');
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

    async resetColorFilters() {
        try {
            if (!this.currentTab || !this.currentTab.id) {
                this.showNotification('No active tab available to reset filter', 'error');
                return;
            }
            const contentLoaded = await this.ensureContentScriptLoaded(this.currentTab.id);
            if (!contentLoaded) {
                this.showNotification('Could not reset filters. Content script not loaded.', 'error');
                return;
            }
            await this.sendMessageWithTimeout(this.currentTab.id, { action: 'removeFilter' });
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.showNotification('All color filters reset', 'success');
        } catch (error) {
            console.error('Error resetting filters:', error);
            this.showNotification('Could not reset filters', 'error');
        }
    }

    // Utility methods
    async withLoadingState(element, asyncFn, loadingText = null) {
        const originalText = element?.textContent || '';
        const originalDisabled = element?.disabled || false;
        
        try {
            if (element) {
                element.disabled = true;
                if (loadingText) element.textContent = loadingText;
            }
            
            const result = await asyncFn();
            
            if (element) {
                element.disabled = originalDisabled;
                element.textContent = originalText;
            }
            
            return result;
        } catch (error) {
            if (element) {
                element.disabled = originalDisabled;
                element.textContent = originalText;
            }
            throw error;
        }
    }

    logOperation(operationName, details = {}) {
        console.log(`[${new Date().toISOString()}] Operation: ${operationName}`, details);
    }

    logError(operationName, error) {
        console.error(`[${new Date().toISOString()}] Error in ${operationName}:`, error);
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    // Method to close all modals
    closeAllModals() {
        try {
            const modals = document.querySelectorAll('.modal, [role="dialog"]');
            modals.forEach(modal => {
                try {
                    modal.remove();
                } catch (e) {
                    // Already removed
                }
            });
        } catch (error) {
            console.debug('Error closing modals:', error);
        }
    }

    // Cleanup on popup close
    cleanup() {
        if (window.connectionStatusRefreshInterval) {
            clearInterval(window.connectionStatusRefreshInterval);
            delete window.connectionStatusRefreshInterval;
        }
        this.closeAllModals();
        this.logOperation('PopupManager cleanup complete');
    }
}

// Cleanup when popup closes
window.addEventListener('beforeunload', () => {
    if (window.popupManager) {
        window.popupManager.cleanup();
    }
});

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[AT] Popup DOM loaded, initializing PopupManager');
    window.popupManager = new PopupManager();
    window.popupManager.init();
});

// Listen for messages from content script to open specific tabs
if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'openExtensionTab') {
            const tabName = message.tab;
            
            // Valid tab names that correspond to the extension popup tabs
            const validTabs = ['tts', 'scanning', 'filters', 'voice'];
            
            if (validTabs.includes(tabName) && window.popupManager) {
                // Switch to the requested tab
                window.popupManager.switchTab(tabName);
                sendResponse({success: true, message: `Switched to ${tabName} tab`});
            } else {
                sendResponse({success: false, message: 'Invalid tab name'});
            }
        }
    });
}

// Add more voice control commands for accessibility
window.addEventListener('DOMContentLoaded', () => {
    // Add extra commands to the voice commands list
    const commandsList = document.querySelector('.commands-list');
    if (commandsList) {
        const extraCommands = [
            { command: '"Increase zoom"', description: 'Zoom in the page' },
            { command: '"Decrease zoom"', description: 'Zoom out the page' },
            { command: '"Reset zoom"', description: 'Reset page zoom' },
            { command: '"Change font"', description: 'Change font family' },
            { command: '"Bold text"', description: 'Make text bold' },
            { command: '"Lighten text"', description: 'Make text lighter' },
            { command: '"Change background"', description: 'Change background color' },
            { command: '"Show alt text"', description: 'Display image alt text' },
            { command: '"Hide alt text"', description: 'Hide image alt text' },
            { command: '"Enable focus indicators"', description: 'Show focus indicators' },
            { command: '"Disable focus indicators"', description: 'Hide focus indicators' }
        ];
        extraCommands.forEach(cmd => {
            const item = document.createElement('div');
            item.className = 'command-item';
            item.innerHTML = `<span class="command">${cmd.command}</span><span class="description">${cmd.description}</span>`;
            commandsList.appendChild(item);
        });
    }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PopupManager;
}