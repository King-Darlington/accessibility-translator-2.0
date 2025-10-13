// Enhanced Settings Manager with Offline Support and Advanced Features
class SettingsManager {
    constructor() {
        this.settings = {};
        this.isOnline = navigator.onLine;
        this.pendingChanges = [];
        this.isInitialized = false;
        this.dbName = 'AccessibilitySettings';
        this.dbVersion = 2;
        this.init();
    }

    async init() {
        try {
            await this.loadSettings();
            this.setupEventListeners();
            this.initializeForm();
            this.checkExtensionStatus();
            this.setupOfflineSupport();
            this.loadUserProfile();
            this.applyCurrentSettings();
            this.isInitialized = true;
            
            console.log('SettingsManager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize SettingsManager:', error);
            this.showStatus('Failed to initialize settings', 'error');
        }
    }

    async loadSettings() {
        // Priority: IndexedDB -> localStorage -> defaults
        try {
            // Try IndexedDB first
            const dbSettings = await this.loadFromIndexedDB();
            if (dbSettings && this.validateSettings(dbSettings)) {
                this.settings = dbSettings;
                return this.settings;
            }
        } catch (error) {
            console.warn('IndexedDB load failed:', error);
        }

        // Fallback to localStorage
        try {
            const saved = localStorage.getItem('accessibilitySettings');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (this.validateSettings(parsed)) {
                    this.settings = parsed;
                    return this.settings;
                }
            }
        } catch (error) {
            console.warn('localStorage load failed:', error);
        }

        // Use defaults as last resort
        this.settings = this.getDefaultSettings();
        await this.saveToMultipleStorages(this.settings);
        return this.settings;
    }

    validateSettings(settings) {
        const required = ['profile', 'theme', 'language', 'tts', 'voiceControl'];
        return required.every(section => settings.hasOwnProperty(section));
    }

    getDefaultSettings() {
        const defaults = {
            profile: {
                displayName: '',
                email: '',
                emailNotifications: true,
                avatar: '',
                lastActive: Date.now()
            },
            theme: 'dark',
            language: 'en',
            autoStart: false,
            offlineMode: true,
            tts: {
                voice: '',
                rate: 1,
                pitch: 1,
                volume: 100,
                autoRead: false,
                highlightText: true,
                preferredVoices: []
            },
            voiceControl: {
                enabled: true,
                language: 'en-US',
                feedback: true,
                sensitivity: 0.5,
                commands: []
            },
            filters: {
                defaultFilter: 'none',
                rememberFilter: true,
                autoContrast: false,
                colorBlindMode: 'none',
                fontSize: 'medium'
            },
            performance: {
                cacheSize: 50,
                lazyLoading: true,
                reduceAnimations: false,
                hardwareAcceleration: true,
                backgroundThrottling: false
            },
            privacy: {
                dataCollection: false,
                analytics: false,
                crashReports: false,
                telemetry: false
            },
            extension: {
                sync: false,
                autoUpdate: true,
                permissions: []
            },
            shortcuts: {
                toggleTTS: 'Ctrl+Shift+S',
                toggleVoiceControl: 'Ctrl+Shift+V',
                quickSettings: 'Ctrl+Shift+Q'
            },
            lastSync: Date.now(),
            version: '2.0'
        };

        // Merge with any existing settings to preserve custom fields
        return this.deepMerge(defaults, this.settings || {});
    }

    deepMerge(target, source) {
        const output = { ...target };
        
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        output[key] = source[key];
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    output[key] = source[key];
                }
            });
        }
        
        return output;
    }

    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    setupEventListeners() {
        const elements = {
            saveSettings: () => this.saveSettings(),
            cancelChanges: () => this.resetForm(),
            resetSettings: () => this.resetToDefaults(),
            manualSync: () => this.syncWithExtension(),
            exportSettings: () => this.exportSettings(),
            importSettings: () => this.importSettings(),
            exportData: () => this.exportAllData(),
            clearCache: () => this.clearCache(),
            backupNow: () => this.createBackup(),
            restoreBackup: () => this.restoreFromBackup()
        };

        // Attach event listeners safely
        Object.entries(elements).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', handler);
            }
        });

        // Real-time updates with debouncing
        this.setupRealTimeUpdates();
        
        // Import file handler
        const importInput = document.getElementById('importFileInput');
        if (importInput) {
            importInput.addEventListener('change', (e) => {
                this.handleFileImport(e.target.files[0]);
            });
        }

        // Online/offline detection
        window.addEventListener('online', () => this.handleOnlineStatus());
        window.addEventListener('offline', () => this.handleOfflineStatus());

        // Beforeunload to warn about unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    setupRealTimeUpdates() {
        const debouncedSave = this.debounce(() => this.autoSave(), 1000);
        
        const realTimeElements = [
            'defaultRate', 'defaultPitch', 'defaultVolume', 'cacheSize',
            'displayName', 'userEmail', 'theme', 'language'
        ];

        realTimeElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', (e) => {
                    this.updateLivePreview(id, e.target.value);
                    if (this.settings.performance.autoSave) {
                        debouncedSave();
                    }
                });
            }
        });

        // Specific handlers for visual updates
        const rateElement = document.getElementById('defaultRate');
        if (rateElement) {
            rateElement.addEventListener('input', (e) => {
                document.getElementById('rateValue').textContent = e.target.value;
            });
        }

        const pitchElement = document.getElementById('defaultPitch');
        if (pitchElement) {
            pitchElement.addEventListener('input', (e) => {
                document.getElementById('pitchValue').textContent = e.target.value;
            });
        }

        const volumeElement = document.getElementById('defaultVolume');
        if (volumeElement) {
            volumeElement.addEventListener('input', (e) => {
                document.getElementById('volumeValue').textContent = e.target.value + '%';
            });
        }

        const cacheElement = document.getElementById('cacheSize');
        if (cacheElement) {
            cacheElement.addEventListener('input', (e) => {
                document.getElementById('cacheSizeValue').textContent = e.target.value + 'MB';
            });
        }

        const nameElement = document.getElementById('displayName');
        if (nameElement) {
            nameElement.addEventListener('input', (e) => {
                document.getElementById('profileName').textContent = e.target.value || 'Guest User';
            });
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    updateLivePreview(settingId, value) {
        // Apply immediate visual feedback for certain settings
        switch (settingId) {
            case 'theme':
                this.applyTheme(value);
                break;
            case 'defaultRate':
                // Preview TTS rate if TTS is active
                break;
        }
    }

    initializeForm() {
        if (!this.settings) return;

        const mappings = {
            // Profile settings
            'displayName': () => document.getElementById('displayName').value = this.settings.profile.displayName,
            'userEmail': () => document.getElementById('userEmail').value = this.settings.profile.email,
            'emailNotifications': () => document.getElementById('emailNotifications').checked = this.settings.profile.emailNotifications,
            
            // General settings
            'theme': () => document.getElementById('theme').value = this.settings.theme,
            'language': () => document.getElementById('language').value = this.settings.language,
            'autoStart': () => document.getElementById('autoStart').checked = this.settings.autoStart,
            'offlineMode': () => document.getElementById('offlineMode').checked = this.settings.offlineMode,
            
            // TTS settings
            'defaultRate': () => {
                document.getElementById('defaultRate').value = this.settings.tts.rate;
                document.getElementById('rateValue').textContent = this.settings.tts.rate;
            },
            'defaultPitch': () => {
                document.getElementById('defaultPitch').value = this.settings.tts.pitch;
                document.getElementById('pitchValue').textContent = this.settings.tts.pitch;
            },
            'defaultVolume': () => {
                document.getElementById('defaultVolume').value = this.settings.tts.volume;
                document.getElementById('volumeValue').textContent = this.settings.tts.volume + '%';
            },
            'autoRead': () => document.getElementById('autoRead').checked = this.settings.tts.autoRead,
            'highlightText': () => document.getElementById('highlightText').checked = this.settings.tts.highlightText,
            
            // Voice control
            'voiceControlEnabled': () => document.getElementById('voiceControlEnabled').checked = this.settings.voiceControl.enabled,
            'voiceLanguage': () => document.getElementById('voiceLanguage').value = this.settings.voiceControl.language,
            'voiceFeedback': () => document.getElementById('voiceFeedback').checked = this.settings.voiceControl.feedback,
            
            // Filter settings
            'defaultFilter': () => document.getElementById('defaultFilter').value = this.settings.filters.defaultFilter,
            'rememberFilter': () => document.getElementById('rememberFilter').checked = this.settings.filters.rememberFilter,
            'autoContrast': () => document.getElementById('autoContrast').checked = this.settings.filters.autoContrast,
            
            // Performance settings
            'cacheSize': () => {
                document.getElementById('cacheSize').value = this.settings.performance.cacheSize;
                document.getElementById('cacheSizeValue').textContent = this.settings.performance.cacheSize + 'MB';
            },
            'lazyLoading': () => document.getElementById('lazyLoading').checked = this.settings.performance.lazyLoading,
            'reduceAnimations': () => document.getElementById('reduceAnimations').checked = this.settings.performance.reduceAnimations,
            
            // Extension settings
            'extensionSync': () => document.getElementById('extensionSync').checked = this.settings.extension.sync
        };

        // Apply all mappings
        Object.values(mappings).forEach(initFunction => {
            try {
                initFunction();
            } catch (error) {
                console.warn('Failed to initialize form element:', error);
            }
        });

        // Load available voices
        this.loadVoices();
    }

    async loadVoices() {
        try {
            const voices = await this.getVoices();
            const select = document.getElementById('defaultVoice');
            
            if (!select) return;

            select.innerHTML = '<option value="">Default Voice</option>';
            voices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.voiceURI;
                option.textContent = `${voice.name} (${voice.lang})`;
                option.selected = voice.voiceURI === this.settings.tts.voice;
                select.appendChild(option);
            });

            // Store preferred voices for offline use
            this.settings.tts.preferredVoices = voices
                .filter(v => v.lang.startsWith(this.settings.language))
                .map(v => v.voiceURI);
                
        } catch (error) {
            console.warn('Failed to load voices:', error);
        }
    }

    getVoices() {
        return new Promise((resolve) => {
            let voices = speechSynthesis.getVoices();
            if (voices.length > 0) {
                resolve(voices);
            } else {
                const voicesChanged = () => {
                    voices = speechSynthesis.getVoices();
                    if (voices.length > 0) {
                        speechSynthesis.removeEventListener('voiceschanged', voicesChanged);
                        resolve(voices);
                    }
                };
                speechSynthesis.addEventListener('voiceschanged', voicesChanged);
                
                // Timeout fallback
                setTimeout(() => {
                    speechSynthesis.removeEventListener('voiceschanged', voicesChanged);
                    resolve(voices);
                }, 3000);
            }
        });
    }

    async saveSettings() {
        try {
            if (!this.gatherSettingsFromForm()) {
                this.showStatus('Invalid settings detected', 'error');
                return;
            }

            await this.saveToMultipleStorages(this.settings);

            // Apply settings immediately
            this.applyCurrentSettings();

            // Sync with extension if enabled
            if (this.settings.extension.sync && this.isOnline) {
                await this.syncWithExtension();
            }

            this.showStatus('Settings saved successfully!', 'success');
            this.updateProfileDisplay();

        } catch (error) {
            console.error('Error saving settings:', error);
            this.showStatus('Error saving settings. Changes stored offline.', 'warning');
            this.pendingChanges.push({...this.settings});
        }
    }

    gatherSettingsFromForm() {
        try {
            this.settings = {
                profile: {
                    displayName: document.getElementById('displayName').value,
                    email: document.getElementById('userEmail').value,
                    emailNotifications: document.getElementById('emailNotifications').checked,
                    lastActive: Date.now()
                },
                theme: document.getElementById('theme').value,
                language: document.getElementById('language').value,
                autoStart: document.getElementById('autoStart').checked,
                offlineMode: document.getElementById('offlineMode').checked,
                tts: {
                    voice: document.getElementById('defaultVoice').value,
                    rate: parseFloat(document.getElementById('defaultRate').value),
                    pitch: parseFloat(document.getElementById('defaultPitch').value),
                    volume: parseInt(document.getElementById('defaultVolume').value),
                    autoRead: document.getElementById('autoRead').checked,
                    highlightText: document.getElementById('highlightText').checked,
                    preferredVoices: this.settings.tts.preferredVoices || []
                },
                voiceControl: {
                    enabled: document.getElementById('voiceControlEnabled').checked,
                    language: document.getElementById('voiceLanguage').value,
                    feedback: document.getElementById('voiceFeedback').checked,
                    sensitivity: this.settings.voiceControl.sensitivity || 0.5,
                    commands: this.settings.voiceControl.commands || []
                },
                filters: {
                    defaultFilter: document.getElementById('defaultFilter').value,
                    rememberFilter: document.getElementById('rememberFilter').checked,
                    autoContrast: document.getElementById('autoContrast').checked,
                    colorBlindMode: this.settings.filters.colorBlindMode || 'none',
                    fontSize: this.settings.filters.fontSize || 'medium'
                },
                performance: {
                    cacheSize: parseInt(document.getElementById('cacheSize').value),
                    lazyLoading: document.getElementById('lazyLoading').checked,
                    reduceAnimations: document.getElementById('reduceAnimations').checked,
                    hardwareAcceleration: this.settings.performance.hardwareAcceleration ?? true,
                    backgroundThrottling: this.settings.performance.backgroundThrottling ?? false,
                    autoSave: this.settings.performance.autoSave ?? true
                },
                privacy: this.settings.privacy || {
                    dataCollection: false,
                    analytics: false,
                    crashReports: false,
                    telemetry: false
                },
                extension: {
                    sync: document.getElementById('extensionSync').checked,
                    autoUpdate: this.settings.extension.autoUpdate ?? true,
                    permissions: this.settings.extension.permissions || []
                },
                shortcuts: this.settings.shortcuts || {
                    toggleTTS: 'Ctrl+Shift+S',
                    toggleVoiceControl: 'Ctrl+Shift+V',
                    quickSettings: 'Ctrl+Shift+Q'
                },
                lastSync: Date.now(),
                version: '2.0'
            };

            return this.validateSettings(this.settings);
        } catch (error) {
            console.error('Error gathering settings:', error);
            return false;
        }
    }

    async saveToMultipleStorages(settings) {
        // Save to localStorage (immediate)
        localStorage.setItem('accessibilitySettings', JSON.stringify(settings));
        
        // Save to IndexedDB for offline access
        try {
            await this.saveToIndexedDB(settings);
        } catch (error) {
            console.warn('IndexedDB save failed:', error);
        }
        
        // If online, try to save to server
        if (this.isOnline) {
            await this.saveToServer(settings);
        }
    }

    async saveToIndexedDB(settings) {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB not supported'));
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['settings'], 'readwrite');
                const store = transaction.objectStore('settings');
                const putRequest = store.put(settings, 'userSettings');
                
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('settings')) {
                    const store = db.createObjectStore('settings');
                    // Create indexes for better querying
                    store.createIndex('timestamp', 'lastSync', { unique: false });
                }
            };
        });
    }

    async loadFromIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB not supported'));
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = (event) => {
                const db = event.target.result;
                // Check if we have the settings store
                if (!db.objectStoreNames.contains('settings')) {
                    resolve(null);
                    return;
                }
                
                const transaction = db.transaction(['settings'], 'readonly');
                const store = transaction.objectStore('settings');
                const getRequest = store.get('userSettings');
                
                getRequest.onsuccess = () => resolve(getRequest.result);
                getRequest.onerror = () => reject(getRequest.error);
            };
            
            request.onupgradeneeded = (event) => {
                // Handle database upgrades
                const db = event.target.result;
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings');
                }
            };
        });
    }

    async saveToServer(settings) {
        // Enhanced server save with retry logic
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch('api/settings/save.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({
                        settings: settings,
                        timestamp: Date.now(),
                        version: '2.0'
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    return result;
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                console.warn(`Server save attempt ${attempt} failed:`, error);
                if (attempt === maxRetries) {
                    throw error;
                }
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    applyCurrentSettings() {
        this.applyTheme(this.settings.theme);
        this.applyPerformanceSettings();
        this.applyAccessibilitySettings();
    }

    applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        
        // Remove all theme classes first
        document.body.classList.remove('dark-theme', 'light-theme', 'high-contrast', 'auto-theme');
        
        // Add current theme class
        document.body.classList.add(`${theme}-theme`);
        
        // Apply additional theme-specific styles
        if (theme === 'high-contrast') {
            document.body.classList.add('high-contrast');
        }
        
        // Update meta theme-color if supported
        this.updateThemeColor(theme);
    }

    updateThemeColor(theme) {
        const themeColors = {
            dark: '#1a1a1a',
            light: '#ffffff',
            'high-contrast': '#000000'
        };
        
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', themeColors[theme] || themeColors.dark);
        }
    }

    applyPerformanceSettings() {
        const perf = this.settings.performance;
        
        // Apply lazy loading
        if (perf.lazyLoading) {
            this.enableLazyLoading();
        }
        
        // Reduce animations if requested
        if (perf.reduceAnimations) {
            document.body.classList.add('reduce-motion');
        } else {
            document.body.classList.remove('reduce-motion');
        }
        
        // Hardware acceleration
        if (perf.hardwareAcceleration) {
            document.body.classList.add('hardware-acceleration');
        } else {
            document.body.classList.remove('hardware-acceleration');
        }
    }

    applyAccessibilitySettings() {
        const filters = this.settings.filters;
        
        // Apply font size
        document.body.style.fontSize = this.getFontSizeValue(filters.fontSize);
        
        // Apply color blind mode
        document.body.setAttribute('data-color-blind', filters.colorBlindMode);
    }

    getFontSizeValue(size) {
        const sizes = {
            'small': '14px',
            'medium': '16px',
            'large': '18px',
            'x-large': '20px'
        };
        return sizes[size] || sizes.medium;
    }

    enableLazyLoading() {
        if (this.lazyLoadingObserver) {
            this.lazyLoadingObserver.disconnect();
        }

        this.lazyLoadingObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    this.lazyLoadingObserver.unobserve(img);
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            this.lazyLoadingObserver.observe(img);
        });
    }

    resetForm() {
        this.initializeForm();
        this.showStatus('Changes discarded', 'info');
    }

    async resetToDefaults() {
        if (confirm('Are you sure you want to reset all settings to default? This cannot be undone.')) {
            const currentTheme = this.settings.theme;
            this.settings = this.getDefaultSettings();
            await this.saveToMultipleStorages(this.settings);
            this.initializeForm();
            this.applyTheme(currentTheme); // Keep current theme for better UX
            this.showStatus('Settings reset to defaults', 'success');
        }
    }

    async syncWithExtension() {
        try {
            this.showStatus('Syncing with extension...', 'info');
            
            // Check if extension is available
            if (!window.AccessibilityExtension) {
                throw new Error('Extension not detected');
            }
            
            // Simulate extension sync with progress
            await this.simulateSyncWithProgress();
            
            this.showStatus('Sync completed successfully!', 'success');
        } catch (error) {
            console.error('Sync failed:', error);
            this.showStatus('Sync failed: ' + error.message, 'error');
        }
    }

    async simulateSyncWithProgress() {
        return new Promise((resolve) => {
            const steps = 5;
            let currentStep = 0;
            
            const interval = setInterval(() => {
                currentStep++;
                this.showStatus(`Syncing... (${currentStep}/${steps})`, 'info');
                
                if (currentStep >= steps) {
                    clearInterval(interval);
                    resolve();
                }
            }, 400);
        });
    }

    exportSettings() {
        const exportData = {
            ...this.settings,
            exportDate: new Date().toISOString(),
            exportVersion: '2.0'
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        this.downloadFile(dataStr, `accessibility-settings-${Date.now()}.json`, 'application/json');
        this.showStatus('Settings exported successfully!', 'success');
    }

    importSettings() {
        document.getElementById('importFileInput').click();
    }

    handleFileImport(file) {
        if (!file) return;
        
        // Validate file type and size
        if (!file.name.endsWith('.json')) {
            this.showStatus('Please select a JSON file', 'error');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            this.showStatus('File too large (max 5MB)', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedSettings = JSON.parse(e.target.result);
                
                if (!this.validateSettings(importedSettings)) {
                    throw new Error('Invalid settings format');
                }
                
                // Merge with current settings, preserving any new fields
                this.settings = this.deepMerge(this.settings, importedSettings);
                await this.saveSettings();
                this.showStatus('Settings imported successfully!', 'success');
            } catch (error) {
                console.error('Import failed:', error);
                this.showStatus('Invalid settings file format', 'error');
            }
        };
        
        reader.onerror = () => {
            this.showStatus('Error reading file', 'error');
        };
        
        reader.readAsText(file);
    }

    exportAllData() {
        const exportData = {
            settings: this.settings,
            systemInfo: this.getSystemInfo(),
            exportDate: new Date().toISOString(),
            version: '2.0'
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        this.downloadFile(dataStr, `accessibility-backup-${Date.now()}.json`, 'application/json');
        this.showStatus('All data exported successfully!', 'success');
    }

    getSystemInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cookiesEnabled: navigator.cookieEnabled,
            javaEnabled: navigator.javaEnabled ? navigator.javaEnabled() : false,
            screen: {
                width: screen.width,
                height: screen.height,
                colorDepth: screen.colorDepth
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            localStorage: !!window.localStorage,
            indexedDB: !!window.indexedDB,
            serviceWorker: !!navigator.serviceWorker
        };
    }

    downloadFile(data, filename, type) {
        try {
            const file = new Blob([data], { type });
            const a = document.createElement('a');
            const url = URL.createObjectURL(file);
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);
        } catch (error) {
            console.error('Download failed:', error);
            this.showStatus('Download failed', 'error');
        }
    }

    async clearCache() {
        if (confirm('Clear all cached data? This will remove offline settings and temporary files.')) {
            try {
                // Clear localStorage
                localStorage.removeItem('accessibilitySettings');
                localStorage.removeItem('user');
                
                // Clear IndexedDB
                if (window.indexedDB) {
                    const request = indexedDB.deleteDatabase(this.dbName);
                    request.onsuccess = () => console.log('IndexedDB cleared');
                }
                
                // Clear service worker cache if exists
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                }
                
                // Clear session storage
                sessionStorage.clear();
                
                this.showStatus('Cache cleared successfully', 'success');
                setTimeout(() => location.reload(), 1500);
            } catch (error) {
                console.error('Cache clearance error:', error);
                this.showStatus('Error clearing cache', 'error');
            }
        }
    }

    async createBackup() {
        try {
            const backup = {
                settings: this.settings,
                timestamp: Date.now(),
                version: '2.0'
            };
            
            await this.saveToIndexedDB(backup, 'backup');
            this.showStatus('Backup created successfully', 'success');
        } catch (error) {
            this.showStatus('Backup creation failed', 'error');
        }
    }

    async restoreFromBackup() {
        try {
            const backup = await this.loadFromIndexedDB('backup');
            if (backup) {
                this.settings = backup.settings;
                await this.saveSettings();
                this.showStatus('Backup restored successfully', 'success');
            } else {
                this.showStatus('No backup found', 'warning');
            }
        } catch (error) {
            this.showStatus('Backup restoration failed', 'error');
        }
    }

    setupOfflineSupport() {
        // Register service worker for offline functionality
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                    this.serviceWorker = registration;
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }

        // Setup periodic sync if supported
        if ('periodicSync' in navigator && 'serviceWorker' in navigator) {
            this.setupPeriodicSync();
        }
    }

    async setupPeriodicSync() {
        try {
            const registration = await navigator.serviceWorker.ready;
            if ('periodicSync' in registration) {
                await registration.periodicSync.register('settings-sync', {
                    minInterval: 24 * 60 * 60 * 1000 // 24 hours
                });
            }
        } catch (error) {
            console.log('Periodic sync not supported:', error);
        }
    }

    handleOnlineStatus() {
        this.isOnline = true;
        this.showStatus('Back online - syncing changes...', 'info');
        
        // Sync pending changes
        this.syncPendingChanges();
        
        // Update online indicator
        document.body.classList.remove('offline');
        document.body.classList.add('online');
    }

    handleOfflineStatus() {
        this.isOnline = false;
        this.showStatus('Offline mode active', 'warning');
        
        // Update offline indicator
        document.body.classList.remove('online');
        document.body.classList.add('offline');
    }

    async syncPendingChanges() {
        if (this.pendingChanges.length === 0) return;

        this.showStatus(`Syncing ${this.pendingChanges.length} pending changes...`, 'info');
        
        const successfulSyncs = [];
        
        for (let i = 0; i < this.pendingChanges.length; i++) {
            try {
                await this.saveToServer(this.pendingChanges[i]);
                successfulSyncs.push(i);
            } catch (error) {
                console.warn(`Failed to sync change ${i}:`, error);
                break; // Stop on first failure
            }
        }
        
        // Remove successfully synced changes
        this.pendingChanges = this.pendingChanges.filter((_, index) => 
            !successfulSyncs.includes(index)
        );
        
        if (successfulSyncs.length > 0) {
            this.showStatus(`Synced ${successfulSyncs.length} pending changes`, 'success');
        }
    }

    loadUserProfile() {
        // Load user data from localStorage or server
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                const user = JSON.parse(userData);
                this.settings.profile.displayName = user.name || this.settings.profile.displayName;
                this.settings.profile.email = user.email || this.settings.profile.email;
                this.updateProfileDisplay();
            }
        } catch (error) {
            console.warn('Failed to load user profile:', error);
        }
    }

    updateProfileDisplay() {
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        
        if (profileName) {
            profileName.textContent = this.settings.profile.displayName || 'Guest User';
        }
        
        if (profileEmail) {
            profileEmail.textContent = this.settings.profile.email || 'Not logged in';
        }
    }

    checkExtensionStatus() {
        const statusElement = document.getElementById('statusText');
        const syncStatus = document.getElementById('syncStatus');

        if (!statusElement || !syncStatus) return;

        if (window.AccessibilityExtension && typeof window.AccessibilityExtension.detected === 'function' && window.AccessibilityExtension.detected()) {
            statusElement.textContent = 'Connected';
            syncStatus.className = 'sync-status connected';
        } else {
            statusElement.textContent = 'Not Installed';
            syncStatus.className = 'sync-status disconnected';
        }
    }

    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('saveStatus');
        if (!statusElement) return;

        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        statusElement.setAttribute('aria-live', 'polite');
        
        // Auto-hide after delay
        clearTimeout(this.statusTimeout);
        this.statusTimeout = setTimeout(() => {
            statusElement.textContent = '';
            statusElement.className = 'status-message';
        }, type === 'error' ? 10000 : 5000);
    }

    hasUnsavedChanges() {
        // Implement logic to detect form changes
        // This is a simplified version - you might want to implement proper dirty checking
        return false;
    }

    autoSave() {
        if (this.settings.performance.autoSave) {
            this.saveSettings();
        }
    }

    // Utility method to get setting by path
    getSetting(path, defaultValue = null) {
        return path.split('.').reduce((obj, key) => 
            obj && obj[key] !== undefined ? obj[key] : defaultValue, this.settings
        );
    }

    // Utility method to set setting by path
    setSetting(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => {
            if (!obj[key] || typeof obj[key] !== 'object') {
                obj[key] = {};
            }
            return obj[key];
        }, this.settings);
        
        target[lastKey] = value;
    }

    // Method to migrate settings from older versions
    migrateSettings(oldSettings) {
        const migrations = {
            '1.0': (settings) => {
                // Migration from v1.0 to v2.0
                if (!settings.version) {
                    settings.version = '2.0';
                    settings.privacy = {
                        dataCollection: false,
                        analytics: false,
                        crashReports: false,
                        telemetry: false
                    };
                    settings.shortcuts = {
                        toggleTTS: 'Ctrl+Shift+S',
                        toggleVoiceControl: 'Ctrl+Shift+V',
                        quickSettings: 'Ctrl+Shift+Q'
                    };
                }
                return settings;
            }
        };

        let migrated = { ...oldSettings };
        Object.keys(migrations).forEach(version => {
            if (!migrated.version || migrated.version < version) {
                migrated = migrations[version](migrated);
            }
        });

        return migrated;
    }
}

// Initialize settings manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsManager;
}