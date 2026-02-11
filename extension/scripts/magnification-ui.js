/**
 * Magnification Control Module for Extension
 * Manages magnification settings in the extension popup
 */

class ExtensionMagnificationUI {
    constructor() {
        this.panel = null;
        this.isCollapsed = false;
        this.settings = {};
    }

    /**
     * Initialize magnification UI in extension
     */
    init() {
        this.createPanel();
        this.setupEventListeners();
        this.loadSettings();
        console.log('✓ Extension Magnification UI initialized');
    }

    /**
     * Create magnification control panel
     */
    createPanel() {
        const panelHTML = `
            <div id="extension-magnification-section" class="extension-section">
                <div class="section-header">
                    <h3><i class="fas fa-search-plus"></i> Magnification</h3>
                    <button id="magnification-toggle" class="toggle-btn" aria-label="Toggle magnification section" title="Toggle magnification">
                        <i class="fas fa-chevron-up"></i>
                    </button>
                </div>

                <div class="magnification-content">
                    <!-- Page Zoom Control -->
                    <div class="control-group">
                        <label for="page-zoom">
                            <span>Page Zoom</span>
                            <span class="value" id="zoom-value">100%</span>
                        </label>
                        <div class="slider-wrapper">
                            <button class="zoom-btn" id="zoom-decrease" aria-label="Decrease zoom">−</button>
                            <input 
                                type="range" 
                                id="page-zoom" 
                                min="50" 
                                max="300" 
                                value="100" 
                                step="10"
                                aria-label="Page zoom level"
                            >
                            <button class="zoom-btn" id="zoom-increase" aria-label="Increase zoom">+</button>
                        </div>
                    </div>

                    <!-- Font Size Control -->
                    <div class="control-group">
                        <label for="font-size">
                            <span>Font Size</span>
                            <span class="value" id="font-value">100%</span>
                        </label>
                        <div class="slider-wrapper">
                            <button class="zoom-btn" id="font-decrease" aria-label="Decrease font size">−</button>
                            <input 
                                type="range" 
                                id="font-size" 
                                min="80" 
                                max="200" 
                                value="100" 
                                step="10"
                                aria-label="Font size multiplier"
                            >
                            <button class="zoom-btn" id="font-increase" aria-label="Increase font size">+</button>
                        </div>
                    </div>

                    <!-- Magnifier Glass Control -->
                    <div class="control-group">
                        <label for="magnifier-level">
                            <span>Magnifier Glass Level</span>
                            <span class="value" id="magnifier-value">2x</span>
                        </label>
                        <input 
                            type="range" 
                            id="magnifier-level" 
                            min="1" 
                            max="4" 
                            value="2" 
                            step="0.5"
                            aria-label="Magnifier glass magnification level"
                        >
                    </div>

                    <!-- Color Contrast Control -->
                    <div class="control-group">
                        <label for="contrast-mode">Color Contrast</label>
                        <select id="contrast-mode" aria-label="Color contrast mode">
                            <option value="normal">Normal</option>
                            <option value="high">High Contrast</option>
                            <option value="inverting">Inverting Colors</option>
                        </select>
                    </div>

                    <!-- Font Family Control -->
                    <div class="control-group">
                        <label for="font-family">Font Family</label>
                        <select id="font-family" aria-label="Font family selection">
                            <option value="system">System Default</option>
                            <option value="sans-serif">Sans-Serif (Clean)</option>
                            <option value="serif">Serif (Traditional)</option>
                            <option value="monospace">Monospace (Code)</option>
                            <option value="dyslexia">Dyslexia-Friendly</option>
                        </select>
                    </div>

                    <!-- Font Weight Control -->
                    <div class="control-group">
                        <label for="font-weight">Font Weight</label>
                        <select id="font-weight" aria-label="Font weight selection">
                            <option value="normal">Normal</option>
                            <option value="bold">Bold</option>
                            <option value="lighter">Lighter</option>
                        </select>
                    </div>

                    <!-- Text Color Control -->
                    <div class="control-group">
                        <label for="text-color">Text Color</label>
                        <div class="color-picker-group">
                            <input 
                                type="color" 
                                id="text-color" 
                                value="#000000"
                                aria-label="Text color picker"
                            >
                            <div class="color-presets">
                                <button class="color-preset" data-color="#000000" title="Black" aria-label="Black text"></button>
                                <button class="color-preset" data-color="#1f2937" title="Dark Gray" aria-label="Dark gray text"></button>
                                <button class="color-preset" data-color="#1e40af" title="Dark Blue" aria-label="Dark blue text"></button>
                                <button class="color-preset" data-color="#003B49" title="Navy Blue" aria-label="Navy blue text"></button>
                            </div>
                        </div>
                    </div>

                    <!-- Background Color Control -->
                    <div class="control-group">
                        <label for="bg-color">Background Color</label>
                        <div class="color-picker-group">
                            <input 
                                type="color" 
                                id="bg-color" 
                                value="#ffffff"
                                aria-label="Background color picker"
                            >
                            <div class="color-presets">
                                <button class="color-preset" data-color="#ffffff" title="White" aria-label="White background"></button>
                                <button class="color-preset" data-color="#f3f4f6" title="Light Gray" aria-label="Light gray background"></button>
                                <button class="color-preset" data-color="#fef3c7" title="Warm Yellow" aria-label="Warm yellow background"></button>
                                <button class="color-preset" data-color="#e0f2fe" title="Cool Blue" aria-label="Cool blue background"></button>
                            </div>
                        </div>
                    </div>

                    <!-- Line Height Control -->
                    <div class="control-group">
                        <label for="line-height">
                            <span>Line Height</span>
                            <span class="value" id="lineheight-value">1.6</span>
                        </label>
                        <input 
                            type="range" 
                            id="line-height" 
                            min="1" 
                            max="2.5" 
                            value="1.6" 
                            step="0.1"
                            aria-label="Line height spacing"
                        >
                    </div>

                    <!-- Magnifier Glass Toggle -->
                    <div class="control-group checkbox">
                        <input 
                            type="checkbox" 
                            id="magnifier-toggle" 
                            aria-label="Toggle magnifier glass"
                        >
                        <label for="magnifier-toggle">Enable Magnifier Glass</label>
                    </div>

                    <!-- Alt Text Display Toggle -->
                    <div class="control-group checkbox">
                        <input 
                            type="checkbox" 
                            id="alt-text-toggle" 
                            aria-label="Toggle alt text display"
                            checked
                        >
                        <label for="alt-text-toggle">Show Image Alt Text</label>
                    </div>

                    <!-- Focus Indicators Toggle -->
                    <div class="control-group checkbox">
                        <input 
                            type="checkbox" 
                            id="focus-indicator-toggle" 
                            aria-label="Toggle focus indicators"
                            checked
                        >
                        <label for="focus-indicator-toggle">Enhanced Focus Indicators</label>
                    </div>

                    <!-- Buttons -->
                    <div class="button-group">
                        <button id="reset-magnification" class="btn-secondary" aria-label="Reset magnification to defaults">
                            <i class="fas fa-redo"></i> Reset
                        </button>
                        <button id="apply-magnification" class="btn-primary" aria-label="Apply magnification settings">
                            <i class="fas fa-check"></i> Apply
                        </button>
                    </div>

                    <!-- Help Text -->
                    <div class="help-text">
                        <small>
                            <strong>Keyboard Shortcuts:</strong>
                            <br>Ctrl/Cmd + +: Zoom in
                            <br>Ctrl/Cmd + −: Zoom out
                            <br>Ctrl/Cmd + 0: Reset
                            <br>Alt + H: Navigate headings
                        </small>
                    </div>
                </div>
            </div>
        `;

        // Find the extension popup container
        const popup = document.getElementById('extension-popup') || document.body;
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = panelHTML;
        this.panel = tempContainer.firstElementChild;
        popup.appendChild(this.panel);
    }

    /**
     * Setup event listeners for UI controls
     */
    setupEventListeners() {
        // Page zoom
        const pageZoom = document.getElementById('page-zoom');
        const zoomValue = document.getElementById('zoom-value');
        const zoomDecrease = document.getElementById('zoom-decrease');
        const zoomIncrease = document.getElementById('zoom-increase');

        pageZoom?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            zoomValue.textContent = value + '%';
            this.settings.zoomLevel = value;
        });

        zoomDecrease?.addEventListener('click', () => {
            pageZoom.value = Math.max(50, parseInt(pageZoom.value) - 10);
            pageZoom.dispatchEvent(new Event('input'));
        });

        zoomIncrease?.addEventListener('click', () => {
            pageZoom.value = Math.min(300, parseInt(pageZoom.value) + 10);
            pageZoom.dispatchEvent(new Event('input'));
        });

        // Font size
        const fontSize = document.getElementById('font-size');
        const fontValue = document.getElementById('font-value');
        const fontDecrease = document.getElementById('font-decrease');
        const fontIncrease = document.getElementById('font-increase');

        fontSize?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            fontValue.textContent = value + '%';
            this.settings.fontSizeMultiplier = value / 100;
        });

        fontDecrease?.addEventListener('click', () => {
            fontSize.value = Math.max(80, parseInt(fontSize.value) - 10);
            fontSize.dispatchEvent(new Event('input'));
        });

        fontIncrease?.addEventListener('click', () => {
            fontSize.value = Math.min(200, parseInt(fontSize.value) + 10);
            fontSize.dispatchEvent(new Event('input'));
        });

        // Magnifier level
        const magnifierLevel = document.getElementById('magnifier-level');
        const magnifierValue = document.getElementById('magnifier-value');

        magnifierLevel?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            magnifierValue.textContent = value + 'x';
            this.settings.magnificationLevel = value;
        });

        // Contrast mode
        const contrastMode = document.getElementById('contrast-mode');
        contrastMode?.addEventListener('change', (e) => {
            this.settings.colorContrastMode = e.target.value;
        });

        // Font family
        const fontFamily = document.getElementById('font-family');
        fontFamily?.addEventListener('change', (e) => {
            this.settings.fontFamily = e.target.value;
        });

        // Font weight
        const fontWeight = document.getElementById('font-weight');
        fontWeight?.addEventListener('change', (e) => {
            this.settings.fontWeight = e.target.value;
        });

        // Text color
        const textColor = document.getElementById('text-color');
        textColor?.addEventListener('input', (e) => {
            this.settings.textColor = e.target.value;
        });

        // Color presets for text
        document.querySelectorAll('#text-color').parentElement?.querySelectorAll('.color-preset')?.forEach(btn => {
            btn?.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                document.getElementById('text-color').value = color;
                this.settings.textColor = color;
            });
        });

        // Background color
        const bgColor = document.getElementById('bg-color');
        bgColor?.addEventListener('input', (e) => {
            this.settings.backgroundColor = e.target.value;
        });

        // Color presets for background
        document.querySelectorAll('#bg-color').parentElement?.querySelectorAll('.color-preset')?.forEach(btn => {
            btn?.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                document.getElementById('bg-color').value = color;
                this.settings.backgroundColor = color;
            });
        });

        // Line height
        const lineHeight = document.getElementById('line-height');
        const lineHeightValue = document.getElementById('lineheight-value');
        lineHeight?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            lineHeightValue.textContent = value.toFixed(1);
            this.settings.lineHeight = value;
        });

        // Toggles
        const magnifierToggle = document.getElementById('magnifier-toggle');
        const altTextToggle = document.getElementById('alt-text-toggle');
        const focusToggle = document.getElementById('focus-indicator-toggle');

        magnifierToggle?.addEventListener('change', (e) => {
            this.settings.magnifierActive = e.target.checked;
        });

        altTextToggle?.addEventListener('change', (e) => {
            this.settings.showAltText = e.target.checked;
        });

        focusToggle?.addEventListener('change', (e) => {
            this.settings.showFocusIndicators = e.target.checked;
        });

        // Buttons
        const resetBtn = document.getElementById('reset-magnification');
        const applyBtn = document.getElementById('apply-magnification');
        const toggleBtn = document.getElementById('magnification-toggle');

        resetBtn?.addEventListener('click', () => this.resetSettings());
        applyBtn?.addEventListener('click', () => this.applySettings());
        toggleBtn?.addEventListener('click', () => this.togglePanel());
    }

    /**
     * Load settings from storage
     */
    loadSettings() {
        chrome.storage.sync.get('magnification', (data) => {
            if (data.magnification) {
                this.settings = data.magnification;
                this.updateUI();
            }
        });
    }

    /**
     * Update UI with current settings
     */
    updateUI() {
        const pageZoom = document.getElementById('page-zoom');
        const zoomValue = document.getElementById('zoom-value');
        const fontSize = document.getElementById('font-size');
        const fontValue = document.getElementById('font-value');
        const magnifierLevel = document.getElementById('magnifier-level');
        const magnifierValue = document.getElementById('magnifier-value');
        const contrastMode = document.getElementById('contrast-mode');
        const fontFamily = document.getElementById('font-family');
        const fontWeight = document.getElementById('font-weight');
        const textColor = document.getElementById('text-color');
        const bgColor = document.getElementById('bg-color');
        const lineHeight = document.getElementById('line-height');
        const lineHeightValue = document.getElementById('lineheight-value');
        const magnifierToggle = document.getElementById('magnifier-toggle');
        const altTextToggle = document.getElementById('alt-text-toggle');
        const focusToggle = document.getElementById('focus-indicator-toggle');

        if (pageZoom && this.settings.zoomLevel) {
            pageZoom.value = this.settings.zoomLevel;
            zoomValue.textContent = this.settings.zoomLevel + '%';
        }

        if (fontSize && this.settings.fontSizeMultiplier) {
            const fontPercent = Math.round(this.settings.fontSizeMultiplier * 100);
            fontSize.value = fontPercent;
            fontValue.textContent = fontPercent + '%';
        }

        if (magnifierLevel && this.settings.magnificationLevel) {
            magnifierLevel.value = this.settings.magnificationLevel;
            magnifierValue.textContent = this.settings.magnificationLevel + 'x';
        }

        if (contrastMode && this.settings.colorContrastMode) {
            contrastMode.value = this.settings.colorContrastMode;
        }

        if (fontFamily && this.settings.fontFamily) {
            fontFamily.value = this.settings.fontFamily;
        }

        if (fontWeight && this.settings.fontWeight) {
            fontWeight.value = this.settings.fontWeight;
        }

        if (textColor && this.settings.textColor) {
            textColor.value = this.settings.textColor;
        }

        if (bgColor && this.settings.backgroundColor) {
            bgColor.value = this.settings.backgroundColor;
        }

        if (lineHeight && this.settings.lineHeight) {
            lineHeight.value = this.settings.lineHeight;
            lineHeightValue.textContent = parseFloat(this.settings.lineHeight).toFixed(1);
        }

        if (magnifierToggle) {
            magnifierToggle.checked = this.settings.magnifierActive || false;
        }

        if (altTextToggle) {
            altTextToggle.checked = this.settings.showAltText !== false;
        }

        if (focusToggle) {
            focusToggle.checked = this.settings.showFocusIndicators !== false;
        }
    }

    /**
     * Apply settings to page
     */
    applySettings() {
        chrome.storage.sync.set({ magnification: this.settings }, () => {
            // Send message to content script to apply settings
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                tabs[0] && chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'applyMagnification',
                    magnification: this.settings
                }).catch(() => {
                    console.log('Could not apply magnification to this page');
                });
            });

            // Show confirmation
            const applyBtn = document.getElementById('apply-magnification');
            if (applyBtn) {
                const originalText = applyBtn.textContent;
                applyBtn.textContent = '✓ Applied!';
                setTimeout(() => {
                    applyBtn.textContent = originalText;
                }, 2000);
            }
        });
    }

    /**
     * Reset settings to defaults
     */
    resetSettings() {
        this.settings = {
            zoomLevel: 100,
            fontSizeMultiplier: 1,
            magnificationLevel: 2,
            colorContrastMode: 'normal',
            magnifierActive: false,
            showAltText: true,
            showFocusIndicators: true,
            fontFamily: 'system',
            fontWeight: 'normal',
            textColor: '#000000',
            backgroundColor: '#ffffff',
            lineHeight: 1.6
        };
        this.updateUI();
        this.applySettings();
    }

    /**
     * Toggle panel expand/collapse
     */
    togglePanel() {
        const content = this.panel?.querySelector('.magnification-content');
        const toggle = document.getElementById('magnification-toggle');
        
        if (content) {
            this.isCollapsed = !this.isCollapsed;
            content.style.display = this.isCollapsed ? 'none' : 'block';
            if (toggle) {
                toggle.innerHTML = this.isCollapsed ? '<i class="fas fa-chevron-down"></i>' : '<i class="fas fa-chevron-up"></i>';
            }
        }
    }
}

// Initialize when extension popup loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.extensionMagnificationUI) {
            window.extensionMagnificationUI = new ExtensionMagnificationUI();
            window.extensionMagnificationUI.init();
        }
    });
} else {
    if (!window.extensionMagnificationUI) {
        window.extensionMagnificationUI = new ExtensionMagnificationUI();
        window.extensionMagnificationUI.init();
    }
}
