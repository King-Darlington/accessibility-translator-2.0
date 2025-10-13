// Color Filter Management for Accessibility Translator

class ColorFilterManager {
    constructor() {
        this.activeFilter = null;
        this.customSettings = {};
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupMessageListener();
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['filters', 'activeFilter'], (result) => {
                this.activeFilter = result.activeFilter || null;
                this.customSettings = result.filters?.custom || {
                    brightness: 1,
                    contrast: 1,
                    saturation: 1
                };
                resolve();
            });
        });
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'applyFilter':
                    this.applyFilter(request.filter, sender.tab?.id);
                    sendResponse({ success: true });
                    break;

                case 'removeFilter':
                    this.removeFilter(sender.tab?.id);
                    sendResponse({ success: true });
                    break;

                case 'updateCustomSettings':
                    this.updateCustomSettings(request.settings, sender.tab?.id);
                    sendResponse({ success: true });
                    break;

                case 'getFilterState':
                    sendResponse({ 
                        activeFilter: this.activeFilter,
                        customSettings: this.customSettings
                    });
                    break;
            }
            return true;
        });
    }

    async applyFilter(filterName, tabId = null) {
        // Remove any existing filter first
        await this.removeFilter(tabId);

        if (!filterName) {
            this.activeFilter = null;
            await this.saveSettings();
            return;
        }

        const css = this.generateFilterCSS(filterName);
        
        try {
            if (tabId) {
                // Apply to specific tab
                await chrome.scripting.insertCSS({
                    target: { tabId: tabId },
                    css: css
                });
            } else {
                // Apply to all tabs
                const tabs = await chrome.tabs.query({});
                for (const tab of tabs) {
                    try {
                        await chrome.scripting.insertCSS({
                            target: { tabId: tab.id },
                            css: css
                        });
                    } catch (error) {
                        console.log(`Could not apply filter to tab ${tab.id}:`, error);
                    }
                }
            }

            this.activeFilter = filterName;
            await this.saveSettings();
            
            this.notifyFilterApplied(filterName);
        } catch (error) {
            console.error('Error applying filter:', error);
            throw error;
        }
    }

    async removeFilter(tabId = null) {
        try {
            if (tabId) {
                // Remove from specific tab
                await chrome.scripting.removeCSS({
                    target: { tabId: tabId },
                    css: this.generateFilterCSS(this.activeFilter)
                });
            } else {
                // Remove from all tabs
                const tabs = await chrome.tabs.query({});
                for (const tab of tabs) {
                    try {
                        await chrome.scripting.removeCSS({
                            target: { tabId: tab.id },
                            css: this.generateFilterCSS(this.activeFilter)
                        });
                    } catch (error) {
                        // Tab might not have the CSS applied
                    }
                }
            }

            this.activeFilter = null;
            await this.saveSettings();
            
            this.notifyFilterRemoved();
        } catch (error) {
            console.error('Error removing filter:', error);
        }
    }

    generateFilterCSS(filterName) {
        const filterDefinitions = {
            grayscale: 'grayscale(100%)',
            'high-contrast': 'contrast(200%) brightness(120%)',
            invert: 'invert(100%) hue-rotate(180deg)',
            sepia: 'sepia(100%)',
            'blue-light': 'sepia(30%) hue-rotate(180deg) saturate(150%)',
            protanopia: 'url("#protanopia-filter")',
            deuteranopia: 'url("#deuteranopia-filter")',
            tritanopia: 'url("#tritanopia-filter")',
            custom: this.generateCustomFilterCSS()
        };

        const filterValue = filterDefinitions[filterName] || 'none';
        
        return `
            html, body, body * {
                filter: ${filterValue} !important;
                -webkit-filter: ${filterValue} !important;
            }
            
            /* Preserve images and videos for some filters */
            ${filterName === 'invert' ? `
                img, video, iframe, canvas, svg, [style*="background-image"] {
                    filter: invert(100%) hue-rotate(180deg) !important;
                    -webkit-filter: invert(100%) hue-rotate(180deg) !important;
                }
            ` : ''}
            
            ${filterName === 'high-contrast' ? `
                * {
                    background-color: #000000 !important;
                    color: #ffffff !important;
                    border-color: #ffffff !important;
                }
                
                a, a * {
                    color: #ffff00 !important;
                }
                
                button, input, textarea, select {
                    background-color: #ffffff !important;
                    color: #000000 !important;
                    border: 2px solid #ffff00 !important;
                }
            ` : ''}
        `;
    }

    generateCustomFilterCSS() {
        const { brightness = 1, contrast = 1, saturation = 1 } = this.customSettings;
        
        return `
            brightness(${brightness}) 
            contrast(${contrast}) 
            saturate(${saturation})
        `.trim();
    }

    async updateCustomSettings(settings, tabId = null) {
        this.customSettings = { ...this.customSettings, ...settings };
        
        await this.saveSettings();

        // Re-apply custom filter if it's active
        if (this.activeFilter === 'custom') {
            await this.applyFilter('custom', tabId);
        }
    }

    async saveSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.set({
                activeFilter: this.activeFilter,
                filters: {
                    custom: this.customSettings
                }
            }, resolve);
        });
    }

    notifyFilterApplied(filterName) {
        // Notify all tabs about filter change
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'filterApplied',
                    filter: filterName
                }).catch(() => {
                    // Tab might not have content script
                });
            });
        });

        // Send notification
        chrome.runtime.sendMessage({
            action: 'showNotification',
            message: `Applied ${this.getFilterDisplayName(filterName)} filter`,
            type: 'success'
        });
    }

    notifyFilterRemoved() {
        // Notify all tabs about filter removal
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'filterRemoved'
                }).catch(() => {
                    // Tab might not have content script
                });
            });
        });

        // Send notification
        chrome.runtime.sendMessage({
            action: 'showNotification',
            message: 'Filter removed',
            type: 'info'
        });
    }

    getFilterDisplayName(filterName) {
        const names = {
            grayscale: 'Grayscale',
            'high-contrast': 'High Contrast',
            invert: 'Invert Colors',
            sepia: 'Sepia',
            'blue-light': 'Blue Light Filter',
            protanopia: 'Protanopia',
            deuteranopia: 'Deuteranopia',
            tritanopia: 'Tritanopia',
            custom: 'Custom'
        };
        
        return names[filterName] || filterName;
    }

    // Color blindness simulation filters (SVG filters)
    getColorBlindnessFilters() {
        return `
            <svg style="position: absolute; width: 0; height: 0;" aria-hidden="true">
                <!-- Protanopia (red-blind) -->
                <filter id="protanopia-filter">
                    <feColorMatrix type="matrix" values="
                        0.567, 0.433, 0,     0, 0
                        0.558, 0.442, 0,     0, 0
                        0,     0.242, 0.758, 0, 0
                        0,     0,     0,     1, 0
                    "/>
                </filter>
                
                <!-- Deuteranopia (green-blind) -->
                <filter id="deuteranopia-filter">
                    <feColorMatrix type="matrix" values="
                        0.625, 0.375, 0,   0, 0
                        0.7,   0.3,   0,   0, 0
                        0,     0.3,   0.7, 0, 0
                        0,     0,     0,   1, 0
                    "/>
                </filter>
                
                <!-- Tritanopia (blue-blind) -->
                <filter id="tritanopia-filter">
                    <feColorMatrix type="matrix" values="
                        0.95, 0.05,  0,     0, 0
                        0,    0.433, 0.567, 0, 0
                        0,    0.475, 0.525, 0, 0
                        0,    0,     0,     1, 0
                    "/>
                </filter>
            </svg>
        `;
    }

    // Inject color blindness filters into pages
    async injectColorBlindnessFilters(tabId) {
        const css = this.getColorBlindnessFilters();
        
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: (css) => {
                    if (!document.getElementById('color-blindness-filters')) {
                        const div = document.createElement('div');
                        div.id = 'color-blindness-filters';
                        div.innerHTML = css;
                        document.body.appendChild(div);
                    }
                },
                args: [css]
            });
        } catch (error) {
            console.error('Error injecting color blindness filters:', error);
        }
    }

    // Keyboard shortcut handler
    handleKeyboardShortcut(key) {
        const filterMap = {
            '1': 'grayscale',
            '2': 'high-contrast',
            '3': 'invert',
            '4': 'sepia',
            '5': 'blue-light',
            '6': 'protanopia',
            '7': 'deuteranopia',
            '8': 'tritanopia',
            '0': null // Remove filter
        };

        if (filterMap[key] !== undefined) {
            this.applyFilter(filterMap[key]);
        }
    }
}

// Initialize filter manager
const filterManager = new ColorFilterManager();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColorFilterManager;
}