/**
 * Global Preferences Manager
 * Loads and applies user preferences across all pages
 * Handles persistence via localStorage/IndexedDB and cross-tab sync
 */
class GlobalPreferencesManager {
    constructor() {
        this.preferences = {};
        this.storageKey = 'at_preferences';
        this.initialized = false;
        this.initializePreferences();
    }

    /**
     * Initialize preferences from storage and apply them immediately
     */
    initializePreferences() {
        try {
            // Load preferences from localStorage
            const savedPrefs = this.loadFromStorage();
            
            if (savedPrefs) {
                this.preferences = savedPrefs;
            } else {
                // Initialize with defaults
                this.preferences = this.getDefaultPreferences();
            }

            // Apply preferences immediately on page load
            this.applyPreferences();
            this.initialized = true;

            // Setup listeners for preference changes
            this.setupChangeListeners();

            // Setup cross-tab sync
            this.setupCrossTabSync();

            console.log('GlobalPreferencesManager initialized', this.preferences);
        } catch (error) {
            console.error('Failed to initialize preferences:', error);
        }
    }

    /**
     * Get default preference values
     */
    getDefaultPreferences() {
        return {
            // Text & View Format
            fontSize: 16,           // px
            lineHeight: 1.6,        // unitless
            fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
            
            // Magnifier
            magnifierEnabled: false,
            magnifyLevel: 1.0,
            
            // Theme
            theme: 'dark',
            
            // Color Filter
            colorFilter: 'normal',
            
            // TTS
            ttsRate: 1.0,
            ttsPitch: 1.0,
            ttsVolume: 100,
            
            // Other
            autoStart: false,
            offlineMode: true,
            
            // Timestamp
            lastUpdated: Date.now()
        };
    }

    /**
     * Load preferences from storage (localStorage or IndexedDB)
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.warn('Failed to load preferences from storage:', error);
        }
        return null;
    }

    /**
     * Save preferences to storage
     */
    saveToStorage(prefs = null) {
        try {
            const toSave = prefs || this.preferences;
            toSave.lastUpdated = Date.now();
            localStorage.setItem(this.storageKey, JSON.stringify(toSave));
            return true;
        } catch (error) {
            console.error('Failed to save preferences:', error);
            return false;
        }
    }

    /**
     * Apply preferences to the current page
     */
    applyPreferences() {
        try {
            const root = document.documentElement;
            const body = document.body;

            // Apply text formatting preferences
            this.applyTextFormatting();

            // Apply magnification
            this.applyMagnification();

            // Apply theme
            this.applyTheme();

            // Apply color filter
            this.applyColorFilter();

            // Dispatch event for other scripts to listen to
            window.dispatchEvent(new CustomEvent('preferencesApplied', {
                detail: { preferences: this.preferences }
            }));

            console.log('Preferences applied to page');
        } catch (error) {
            console.error('Error applying preferences:', error);
        }
    }

    /**
     * Apply text formatting (font size, line height, font family)
     */
    applyTextFormatting() {
        const root = document.documentElement;
        const body = document.body;

        // Font size
        root.style.setProperty('--base-font-size', this.preferences.fontSize + 'px');
        body.style.fontSize = this.preferences.fontSize + 'px';

        // Line height
        root.style.setProperty('--base-line-height', this.preferences.lineHeight);
        body.style.lineHeight = this.preferences.lineHeight;

        // Font family
        root.style.setProperty('font-family', this.preferences.fontFamily);
        body.style.fontFamily = this.preferences.fontFamily;

        // Note: Removed global wildcard style that was forcing font-size on ALL elements
        // This allows CSS defaults and other scripts to manage font sizing properly
    }

    /**
     * Apply magnification level
     */
    applyMagnification() {
        const body = document.body;

        if (this.preferences.magnifierEnabled && this.preferences.magnifyLevel !== 1.0) {
            body.style.zoom = this.preferences.magnifyLevel;
            body.classList.add('magnified');
        } else {
            body.style.zoom = '1';
            body.classList.remove('magnified');
        }
    }

    /**
     * Apply theme
     */
    applyTheme() {
        document.body.setAttribute('data-theme', this.preferences.theme);
        document.body.classList.remove('dark-theme', 'light-theme', 'high-contrast-theme', 'auto-theme');
        document.body.classList.add(this.preferences.theme + '-theme');
    }

    /**
     * Apply color filter
     */
    applyColorFilter() {
        document.body.classList.remove(
            'invert', 'grayscale', 'high-contrast', 'high-contrast-black',
            'high-contrast-white', 'sepia', 'dark-mode', 'blue-light'
        );

        if (this.preferences.colorFilter && this.preferences.colorFilter !== 'normal') {
            document.body.classList.add(this.preferences.colorFilter);
        }
    }

    /**
     * Update a single preference and apply it
     */
    updatePreference(key, value) {
        this.preferences[key] = value;
        this.saveToStorage();

        // Reapply all preferences to ensure consistency
        this.applyPreferences();

        // Dispatch update event for extension and other scripts
        window.dispatchEvent(new CustomEvent('preferenceUpdated', {
            detail: { key, value, preferences: this.preferences }
        }));

        // Broadcast to other tabs
        this.broadcastToOtherTabs({ action: 'preferenceUpdate', key, value });
    }

    /**
     * Update multiple preferences at once
     */
    updatePreferences(updates) {
        Object.assign(this.preferences, updates);
        this.saveToStorage();
        this.applyPreferences();

        window.dispatchEvent(new CustomEvent('preferencesUpdated', {
            detail: { updates, preferences: this.preferences }
        }));

        this.broadcastToOtherTabs({ action: 'preferencesUpdate', updates });
    }

    /**
     * Setup listeners for local changes
     */
    setupChangeListeners() {
        // Listen for storage changes from localStorage (cross-tab sync)
        window.addEventListener('storage', (e) => {
            if (e.key === this.storageKey) {
                try {
                    const newPrefs = JSON.parse(e.newValue);
                    this.preferences = newPrefs;
                    this.applyPreferences();
                    console.log('Preferences updated from storage event', newPrefs);
                } catch (error) {
                    console.error('Error processing storage update:', error);
                }
            }
        });

        // Listen for preference update events from settings page
        window.addEventListener('preferenceUpdate', (e) => {
            if (e.detail && e.detail.key) {
                this.preferences[e.detail.key] = e.detail.value;
                this.applyPreferences();
            }
        });

        window.addEventListener('preferencesUpdated', (e) => {
            if (e.detail && e.detail.updates) {
                Object.assign(this.preferences, e.detail.updates);
                this.applyPreferences();
            }
        });

        // Listen for custom events from extension or other components
        window.addEventListener('accessibility-magnifier-toggle', (e) => {
            if (e.detail && typeof e.detail.enabled !== 'undefined') {
                this.updatePreference('magnifierEnabled', e.detail.enabled);
            }
        });

        window.addEventListener('accessibility-magnifier-change', (e) => {
            if (e.detail && e.detail.level) {
                this.updatePreference('magnifyLevel', e.detail.level);
            }
        });

        // Listen for color filter changes
        window.addEventListener('colorFilterChanged', (e) => {
            if (e.detail && e.detail.filter) {
                this.updatePreference('colorFilter', e.detail.filter);
            }
        });
    }

    /**
     * Setup cross-tab synchronization using BroadcastChannel API
     */
    setupCrossTabSync() {
        // Use BroadcastChannel if available (modern browsers)
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                this.channel = new BroadcastChannel('at_preferences_sync');
                this.channel.addEventListener('message', (e) => {
                    try {
                        const { action, key, value, updates } = e.data;

                        if (action === 'preferenceUpdate' && key && value !== undefined) {
                            this.preferences[key] = value;
                            this.applyPreferences();
                        } else if (action === 'preferencesUpdate' && updates) {
                            Object.assign(this.preferences, updates);
                            this.applyPreferences();
                        }

                        console.log('Preferences synced from other tab:', e.data);
                    } catch (error) {
                        console.error('Error processing broadcast message:', error);
                    }
                });
                console.log('BroadcastChannel sync enabled');
            } catch (error) {
                console.warn('BroadcastChannel not available:', error);
            }
        }
    }

    /**
     * Broadcast preference changes to other tabs
     */
    broadcastToOtherTabs(message) {
        if (this.channel) {
            try {
                this.channel.postMessage(message);
            } catch (error) {
                console.warn('Failed to broadcast to other tabs:', error);
            }
        }
    }

    /**
     * Export current preferences (for debugging or export feature)
     */
    exportPreferences() {
        return JSON.parse(JSON.stringify(this.preferences));
    }

    /**
     * Import preferences from external source
     */
    importPreferences(prefsData) {
        try {
            const validated = { ...this.getDefaultPreferences(), ...prefsData };
            this.preferences = validated;
            this.saveToStorage();
            this.applyPreferences();
            return true;
        } catch (error) {
            console.error('Failed to import preferences:', error);
            return false;
        }
    }

    /**
     * Reset preferences to defaults
     */
    resetPreferences() {
        this.preferences = this.getDefaultPreferences();
        this.saveToStorage();
        this.applyPreferences();
    }
}

// Initialize on DOM ready and expose globally
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.globalPreferencesManager) {
            window.globalPreferencesManager = new GlobalPreferencesManager();
        }
    });
} else {
    // DOM already loaded
    if (!window.globalPreferencesManager) {
        window.globalPreferencesManager = new GlobalPreferencesManager();
    }
}

// Also try to initialize immediately for early page load
try {
    if (!window.globalPreferencesManager && document.documentElement) {
        window.globalPreferencesManager = new GlobalPreferencesManager();
    }
} catch (e) {
    console.warn('Early initialization failed, will retry on DOMContentLoaded');
}
