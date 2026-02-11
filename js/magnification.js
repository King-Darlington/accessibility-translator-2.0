/**
 * Magnification Module
 * Provides advanced magnification and zoom capabilities for users with low vision
 * Features: Page zoom, focus magnification, magnified cursor, text magnification
 */

class MagnificationManager {
    constructor() {
        this.currentZoomLevel = 100;
        this.currentMagnification = 1;
        this.magnifierActive = false;
        this.magnifierSize = 150; // pixels
        this.magnificationLevel = 2; // 2x magnification
        this.magnifierElement = null;
        this.settingsManager = window.settingsManager;
        
        // Enhanced features for accessibility
        this.fontSizeMultiplier = 1;
        this.colorContrastMode = 'normal'; // normal, high, inverting
        this.showFocusIndicators = true;
        this.showAltText = true;
        this.headingNavigationActive = false;
        this.currentHeadingIndex = 0;
        this.headings = [];
        
        // Font and color customization
        this.fontFamily = 'system'; // system, sans-serif, serif, monospace, dyslexia
        this.fontWeight = 'normal'; // normal, bold, lighter
        this.textColor = '#000000'; // Default black
        this.backgroundColor = '#ffffff'; // Default white
        this.lineHeight = 1.6; // Default 1.6
        
        // Binding methods
        this.init = this.init.bind(this);
        this.setZoomLevel = this.setZoomLevel.bind(this);
        this.toggleMagnifier = this.toggleMagnifier.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.focusMagnification = this.focusMagnification.bind(this);
        this.setMagnificationLevel = this.setMagnificationLevel.bind(this);
        this.setFontSize = this.setFontSize.bind(this);
        this.setColorContrast = this.setColorContrast.bind(this);
        this.toggleAltTextDisplay = this.toggleAltTextDisplay.bind(this);
        this.navigateHeadings = this.navigateHeadings.bind(this);
        this.setFontFamily = this.setFontFamily.bind(this);
        this.setFontWeight = this.setFontWeight.bind(this);
        this.setTextColor = this.setTextColor.bind(this);
        this.setBackgroundColor = this.setBackgroundColor.bind(this);
    }

    /**
     * Initialize magnification manager
     */
    init() {
        this.loadSettings();
        this.createMagnifierElement();
        this.setupEventListeners();
        this.enhanceFocusIndicators();
        this.setupAltTextDisplay();
        this.setupHeadingNavigation();
        this.improveKeyboardAccessibility();
        console.log('✓ Magnification Manager initialized with full accessibility features');
    }

    /**
     * Load magnification settings from storage
     */
    loadSettings() {
        if (this.settingsManager && this.settingsManager.settings) {
            const magnSettings = this.settingsManager.settings.magnification || {};
            this.currentZoomLevel = magnSettings.zoomLevel || 100;
            this.magnificationLevel = magnSettings.magnificationLevel || 2;
            this.magnifierSize = magnSettings.magnifierSize || 150;
            this.fontSizeMultiplier = magnSettings.fontSizeMultiplier || 1;
            this.colorContrastMode = magnSettings.colorContrastMode || 'normal';
            this.showFocusIndicators = magnSettings.showFocusIndicators !== false;
            this.showAltText = magnSettings.showAltText !== false;
            
            // Font and color settings
            this.fontFamily = magnSettings.fontFamily || 'system';
            this.fontWeight = magnSettings.fontWeight || 'normal';
            this.textColor = magnSettings.textColor || '#000000';
            this.backgroundColor = magnSettings.backgroundColor || '#ffffff';
            this.lineHeight = magnSettings.lineHeight || 1.6;
            
            this.applyZoom(this.currentZoomLevel);
            this.applyFontSize(this.fontSizeMultiplier);
            this.applyColorContrast(this.colorContrastMode);
            this.applyFontFamily(this.fontFamily);
            this.applyFontWeight(this.fontWeight);
            this.applyTextColor(this.textColor, this.backgroundColor);
            this.applyLineHeight(this.lineHeight);
        }
    }

    /**
     * Set page zoom level (affects entire page)
     * @param {number} level - Zoom level in percentage (50-300)
     */
    setZoomLevel(level) {
        level = Math.max(50, Math.min(300, level)); // Clamp between 50-300
        this.currentZoomLevel = level;
        this.applyZoom(level);
        this.saveSettings();
    }

    /**
     * Apply zoom to page
     * @param {number} level - Zoom percentage
     */
    applyZoom(level) {
        const zoomValue = level / 100;
        document.documentElement.style.zoom = zoomValue;
        
        // Adjust body padding to prevent content cutoff
        if (level > 100) {
            document.body.style.paddingRight = '20px';
            document.body.style.paddingBottom = '20px';
        } else {
            document.body.style.paddingRight = '0';
            document.body.style.paddingBottom = '0';
        }
    }

    /**
     * Create magnifier glass element
     */
    createMagnifierElement() {
        if (this.magnifierElement) return;

        this.magnifierElement = document.createElement('div');
        this.magnifierElement.id = 'accessibility-magnifier';
        this.magnifierElement.style.cssText = `
            position: fixed;
            width: ${this.magnifierSize}px;
            height: ${this.magnifierSize}px;
            border-radius: 50%;
            border: 3px solid var(--primary);
            background-color: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(2px);
            pointer-events: none;
            display: none;
            z-index: 10000;
            box-shadow: 0 0 15px rgba(0, 59, 73, 0.2);
            overflow: hidden;
        `;

        // Create magnified content container
        const magnifiedContent = document.createElement('div');
        magnifiedContent.id = 'accessibility-magnifier-content';
        magnifiedContent.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            overflow: hidden;
        `;
        
        this.magnifierElement.appendChild(magnifiedContent);
        document.body.appendChild(this.magnifierElement);
    }

    /**
     * Toggle magnifier on/off
     */
    toggleMagnifier() {
        this.magnifierActive = !this.magnifierActive;
        
        if (this.magnifierActive) {
            this.magnifierElement.style.display = 'block';
            document.addEventListener('mousemove', this.handleMouseMove);
            document.addEventListener('touchmove', this.handleMouseMove);
        } else {
            this.magnifierElement.style.display = 'none';
            document.removeEventListener('mousemove', this.handleMouseMove);
            document.removeEventListener('touchmove', this.handleMouseMove);
        }
        
        this.saveSettings();
    }

    /**
     * Handle mouse/touch move for magnifier
     */
    handleMouseMove(e) {
        if (!this.magnifierActive || !this.magnifierElement) return;

        const x = e.pageX || e.touches?.[0]?.pageX || 0;
        const y = e.pageY || e.touches?.[0]?.pageY || 0;

        // Position magnifier around cursor
        this.magnifierElement.style.left = (x - this.magnifierSize / 2) + 'px';
        this.magnifierElement.style.top = (y - this.magnifierSize / 2) + 'px';

        // Update magnified content
        const content = this.magnifierElement.querySelector('#accessibility-magnifier-content');
        if (content) {
            const scale = this.magnificationLevel;
            const offsetX = -(x * scale - this.magnifierSize / 2);
            const offsetY = -(y * scale - this.magnifierSize / 2);
            
            content.style.transform = `scale(${scale}) translate(${offsetX / scale}px, ${offsetY / scale}px)`;
            content.style.transformOrigin = `${x}px ${y}px`;
        }
    }

    /**
     * Set magnification level for magnifier glass
     * @param {number} level - Magnification multiplier (1-4x)
     */
    setMagnificationLevel(level) {
        level = Math.max(1, Math.min(4, level));
        this.magnificationLevel = level;
        this.saveSettings();
    }

    /**
     * Focus magnification - magnify specific element
     * @param {HTMLElement} element - Element to magnify
     */
    focusMagnification(element) {
        if (!element) return;

        // Get element's position and size
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Zoom to focus on element
        const zoomLevel = Math.min(200, 100 + (50 * this.magnificationLevel));
        this.setZoomLevel(zoomLevel);

        // Scroll element into view with center positioning
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

        // Add visual highlight
        element.style.outline = '3px solid var(--primary)';
        element.style.outlineOffset = '2px';
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
            element.style.outline = '';
        }, 3000);
    }

    /**
     * Increase magnifier size
     */
    increaseMagnifierSize() {
        this.magnifierSize = Math.min(400, this.magnifierSize + 25);
        if (this.magnifierElement) {
            this.magnifierElement.style.width = this.magnifierSize + 'px';
            this.magnifierElement.style.height = this.magnifierSize + 'px';
        }
        this.saveSettings();
    }

    /**
     * Decrease magnifier size
     */
    decreaseMagnifierSize() {
        this.magnifierSize = Math.max(75, this.magnifierSize - 25);
        if (this.magnifierElement) {
            this.magnifierElement.style.width = this.magnifierSize + 'px';
            this.magnifierElement.style.height = this.magnifierSize + 'px';
        }
        this.saveSettings();
    }

    /**
     * Reset magnification to default
     */
    resetMagnification() {
        this.currentZoomLevel = 100;
        this.magnificationLevel = 2;
        this.magnifierSize = 150;
        this.magnifierActive = false;
        
        this.applyZoom(100);
        if (this.magnifierElement) {
            this.magnifierElement.style.display = 'none';
        }
        
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('touchmove', this.handleMouseMove);
        
        this.saveSettings();
    }

    /**
     * Save magnification settings
     */
    saveSettings() {
        if (this.settingsManager) {
            this.settingsManager.settings.magnification = {
                zoomLevel: this.currentZoomLevel,
                magnificationLevel: this.magnificationLevel,
                magnifierSize: this.magnifierSize,
                magnifierActive: this.magnifierActive,
                fontSizeMultiplier: this.fontSizeMultiplier,
                colorContrastMode: this.colorContrastMode,
                showFocusIndicators: this.showFocusIndicators,
                showAltText: this.showAltText,
                fontFamily: this.fontFamily,
                fontWeight: this.fontWeight,
                textColor: this.textColor,
                backgroundColor: this.backgroundColor,
                lineHeight: this.lineHeight
            };
            this.settingsManager.saveSettings();
        }
    }

    /**
     * Sync magnification settings with extension
     */
    syncWithExtension() {
        if (window.chrome && window.chrome.runtime) {
            chrome.runtime.sendMessage({
                action: 'syncMagnification',
                magnification: {
                    zoomLevel: this.currentZoomLevel,
                    magnificationLevel: this.magnificationLevel,
                    magnifierSize: this.magnifierSize
                }
            }).catch(() => {
                // Extension not available
            });
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                // Ctrl/Cmd + Plus: Zoom in
                if (e.key === '+' || e.key === '=') {
                    e.preventDefault();
                    this.setZoomLevel(this.currentZoomLevel + 10);
                }
                // Ctrl/Cmd + Minus: Zoom out
                else if (e.key === '-') {
                    e.preventDefault();
                    this.setZoomLevel(this.currentZoomLevel - 10);
                }
                // Ctrl/Cmd + 0: Reset zoom
                else if (e.key === '0') {
                    e.preventDefault();
                    this.resetMagnification();
                }
            }
            // Alt + H: Navigate headings
            if (e.altKey && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                this.navigateHeadings('next');
            }
            // Alt + Shift + H: Previous heading
            if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                this.navigateHeadings('prev');
            }
        });
    }

    /**
     * Set font size multiplier for text
     * @param {number} multiplier - Font size multiplier (0.8 - 2)
     */
    setFontSize(multiplier) {
        multiplier = Math.max(0.8, Math.min(2, multiplier));
        this.fontSizeMultiplier = multiplier;
        this.applyFontSize(multiplier);
        this.saveSettings();
    }

    /**
     * Apply font size changes to the page
     * @param {number} multiplier - Font size multiplier
     */
    applyFontSize(multiplier) {
        if (multiplier === 1) {
            document.documentElement.style.fontSize = '16px';
            return;
        }
        
        const baseSize = 16;
        document.documentElement.style.fontSize = (baseSize * multiplier) + 'px';
        
        // Also apply to body to ensure inheritance
        document.body.style.lineHeight = (1.6 * multiplier) + 'em';
        document.body.style.letterSpacing = (0.5 * multiplier) + 'px';
    }

    /**
     * Set color contrast mode
     * @param {string} mode - 'normal', 'high', or 'inverting'
     */
    setColorContrast(mode) {
        this.colorContrastMode = mode;
        this.applyColorContrast(mode);
        this.saveSettings();
    }

    /**
     * Apply color contrast adjustments
     * @param {string} mode - Contrast mode to apply
     */
    applyColorContrast(mode) {
        const style = document.getElementById('magnification-contrast-style') || document.createElement('style');
        style.id = 'magnification-contrast-style';
        
        if (mode === 'high') {
            style.innerHTML = `
                * {
                    background-color: !important;
                    color: #000 !important;
                }
                body { background-color: #fff !important; color: #000 !important; }
                a { color: #0066cc !important; font-weight: bold; }
                button, input, textarea { 
                    border: 2px solid #000 !important; 
                    background-color: #f5f5f5 !important;
                    color: #000 !important;
                }
                h1, h2, h3, h4, h5, h6 { color: #000 !important; font-weight: bold; }
            `;
        } else if (mode === 'inverting') {
            style.innerHTML = `
                html { filter: invert(1) hue-rotate(180deg); }
                img { filter: invert(1) hue-rotate(180deg); }
                video { filter: invert(1) hue-rotate(180deg); }
            `;
        } else {
            style.innerHTML = '';
        }
        
        if (!document.head.contains(style)) {
            document.head.appendChild(style);
        }
    }

    /**
     * Enhance focus indicators for keyboard navigation
     */
    enhanceFocusIndicators() {
        const focusStyle = document.getElementById('magnification-focus-style') || document.createElement('style');
        focusStyle.id = 'magnification-focus-style';
        focusStyle.innerHTML = `
            :focus, :focus-visible {
                outline: 3px solid var(--primary) !important;
                outline-offset: 2px !important;
                border-radius: 4px !important;
            }
            a:focus, button:focus, input:focus, textarea:focus, select:focus {
                outline: 3px solid var(--primary) !important;
                outline-offset: 3px !important;
                box-shadow: 0 0 0 4px rgba(0, 59, 73, 0.08) !important;
            }
            .magnification-focus-indicator {
                outline: 3px dashed var(--primary);
                outline-offset: 2px;
                border-radius: 4px;
            }
        `;
        
        if (!document.head.contains(focusStyle)) {
            document.head.appendChild(focusStyle);
        }
    }

    /**
     * Setup alt text display for images
     */
    setupAltTextDisplay() {
        const altTextStyle = document.getElementById('magnification-alttext-style') || document.createElement('style');
        altTextStyle.id = 'magnification-alttext-style';
        altTextStyle.innerHTML = `
            .magnification-alt-text {
                position: absolute;
                background-color: #fff3cd;
                color: #333;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                border: 1px solid #ffc107;
                white-space: pre-wrap;
                word-wrap: break-word;
                max-width: 300px;
                z-index: 5000;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }
        `;
        
        if (!document.head.contains(altTextStyle)) {
            document.head.appendChild(altTextStyle);
        }

        if (this.showAltText) {
            this.displayAltTexts();
        }
    }

    /**
     * Display alt text for images on hover
     */
    displayAltTexts() {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (!img.hasAttribute('data-alttext-listener')) {
                img.setAttribute('data-alttext-listener', 'true');
                
                // Add visible indicator if no alt text
                if (!img.alt) {
                    img.style.border = '2px solid #ff6b6b';
                    img.title = 'Image missing description (alt text)';
                }
                
                img.addEventListener('mouseenter', () => {
                    if (img.alt && this.showAltText) {
                        const tooltip = document.createElement('div');
                        tooltip.className = 'magnification-alt-text';
                        tooltip.textContent = 'ALT: ' + img.alt;
                        
                        const rect = img.getBoundingClientRect();
                        tooltip.style.top = (rect.bottom + 5) + 'px';
                        tooltip.style.left = rect.left + 'px';
                        
                        document.body.appendChild(tooltip);
                        
                        img.addEventListener('mouseleave', () => {
                            tooltip.remove();
                        }, { once: true });
                    }
                });
            }
        });
    }

    /**
     * Toggle alt text display
     */
    toggleAltTextDisplay() {
        this.showAltText = !this.showAltText;
        if (this.showAltText) {
            this.displayAltTexts();
        }
        this.saveSettings();
    }

    /**
     * Setup heading navigation
     */
    setupHeadingNavigation() {
        this.updateHeadingsList();
    }

    /**
     * Update list of headings on the page
     */
    updateHeadingsList() {
        this.headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        this.currentHeadingIndex = 0;
    }

    /**
     * Navigate between headings
     * @param {string} direction - 'next' or 'prev'
     */
    navigateHeadings(direction = 'next') {
        if (this.headings.length === 0) {
            this.updateHeadingsList();
        }
        
        if (this.headings.length === 0) {
            console.warn('No headings found on this page');
            return;
        }

        if (direction === 'next') {
            this.currentHeadingIndex = (this.currentHeadingIndex + 1) % this.headings.length;
        } else if (direction === 'prev') {
            this.currentHeadingIndex = (this.currentHeadingIndex - 1 + this.headings.length) % this.headings.length;
        }

        const currentHeading = this.headings[this.currentHeadingIndex];
        this.focusMagnification(currentHeading);
        
        // Announce heading for screen readers
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `Heading ${this.currentHeadingIndex + 1} of ${this.headings.length}: ${currentHeading.textContent}`;
        announcement.style.display = 'none';
        document.body.appendChild(announcement);
        
        setTimeout(() => announcement.remove(), 1000);
    }

    /**
     * Improve keyboard accessibility
     */
    improveKeyboardAccessibility() {
        // Ensure all clickable elements are keyboard accessible
        const clickableElements = document.querySelectorAll('[onclick], .clickable');
        clickableElements.forEach(element => {
            if (!element.hasAttribute('tabindex') && element.tagName !== 'A' && element.tagName !== 'BUTTON') {
                element.setAttribute('tabindex', '0');
                element.setAttribute('role', 'button');
            }
        });

        // Add keyboard support for elements
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && document.activeElement?.classList.contains('clickable')) {
                document.activeElement.click();
            }
        });

        // Trap focus in modals if present
        this.setupModalFocusTrap();
    }

    /**
     * Setup focus trap for modals
     */
    setupModalFocusTrap() {
        const modalElements = document.querySelectorAll('[role="dialog"], .modal');
        modalElements.forEach(modal => {
            const focusableElements = modal.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (firstElement && lastElement) {
                modal.addEventListener('keydown', (e) => {
                    if (e.key === 'Tab') {
                        if (e.shiftKey && document.activeElement === firstElement) {
                            e.preventDefault();
                            lastElement.focus();
                        } else if (!e.shiftKey && document.activeElement === lastElement) {
                            e.preventDefault();
                            firstElement.focus();
                        }
                    }
                });
            }
        });
    }

    /**
     * Set font family
     * @param {string} family - 'system', 'sans-serif', 'serif', 'monospace', 'dyslexia'
     */
    setFontFamily(family) {
        this.fontFamily = family;
        this.applyFontFamily(family);
        this.saveSettings();
    }

    /**
     * Apply font family to page
     * @param {string} family - Font family type
     */
    applyFontFamily(family) {
        const fontMap = {
            'system': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            'sans-serif': '"Arial", "Helvetica", sans-serif',
            'serif': '"Georgia", "Times New Roman", serif',
            'monospace': '"Courier New", "Monospace", monospace',
            'dyslexia': '"OpenDyslexic", "Arial", sans-serif' // Dyslexia-friendly font
        };

        const fontFamily = fontMap[family] || fontMap['system'];
        const style = document.getElementById('magnification-font-style') || document.createElement('style');
        style.id = 'magnification-font-style';
        style.innerHTML = `
            * {
                font-family: ${fontFamily} !important;
            }
            body {
                font-family: ${fontFamily} !important;
            }
            h1, h2, h3, h4, h5, h6 {
                font-family: ${fontFamily} !important;
            }
            button, input, select, textarea {
                font-family: ${fontFamily} !important;
            }
        `;

        if (!document.head.contains(style)) {
            document.head.appendChild(style);
        }
    }

    /**
     * Set font weight
     * @param {string} weight - 'normal', 'bold', 'lighter'
     */
    setFontWeight(weight) {
        this.fontWeight = weight;
        this.applyFontWeight(weight);
        this.saveSettings();
    }

    /**
     * Apply font weight to page
     * @param {string} weight - Font weight value
     */
    applyFontWeight(weight) {
        const weightMap = {
            'normal': '400',
            'bold': '700',
            'lighter': '300'
        };

        const fontWeight = weightMap[weight] || '400';
        const style = document.getElementById('magnification-weight-style') || document.createElement('style');
        style.id = 'magnification-weight-style';
        style.innerHTML = `
            body {
                font-weight: ${fontWeight} !important;
            }
            p, span, a, button {
                font-weight: ${fontWeight} !important;
            }
        `;

        if (!document.head.contains(style)) {
            document.head.appendChild(style);
        }
    }

    /**
     * Set text color
     * @param {string} color - Text color in hex or CSS format
     * @param {string} bgColor - Background color
     */
    setTextColor(color, bgColor = null) {
        this.textColor = color;
        if (bgColor) {
            this.backgroundColor = bgColor;
        }
        this.applyTextColor(color, bgColor || this.backgroundColor);
        this.saveSettings();
    }

    /**
     * Apply text color to page
     * @param {string} textColor - Text color
     * @param {string} bgColor - Background color
     */
    applyTextColor(textColor, bgColor) {
        const style = document.getElementById('magnification-color-style') || document.createElement('style');
        style.id = 'magnification-color-style';
        
        // Only apply if not in high contrast mode
        if (this.colorContrastMode === 'normal') {
            style.innerHTML = `
                body {
                    color: ${textColor} !important;
                    background-color: ${bgColor} !important;
                }
                p, span, a, button, div, section, article {
                    color: ${textColor} !important;
                }
                input, textarea, select {
                    color: ${textColor} !important;
                    background-color: ${bgColor} !important;
                    border-color: ${textColor} !important;
                }
                h1, h2, h3, h4, h5, h6 {
                    color: ${textColor} !important;
                }
            `;
        }

        if (!document.head.contains(style)) {
            document.head.appendChild(style);
        }
    }

    /**
     * Set background color
     * @param {string} color - Background color in hex or CSS format
     */
    setBackgroundColor(color) {
        this.backgroundColor = color;
        this.applyTextColor(this.textColor, color);
        this.saveSettings();
    }

    /**
     * Set line height
     * @param {number} height - Line height multiplier (1-2.5)
     */
    setLineHeight(height) {
        height = Math.max(1, Math.min(2.5, height));
        this.lineHeight = height;
        this.applyLineHeight(height);
        this.saveSettings();
    }

    /**
     * Apply line height to page
     * @param {number} height - Line height value
     */
    applyLineHeight(height) {
        const style = document.getElementById('magnification-lineheight-style') || document.createElement('style');
        style.id = 'magnification-lineheight-style';
        style.innerHTML = `
            body {
                line-height: ${height} !important;
            }
            p, li, article, section {
                line-height: ${height} !important;
            }
        `;

        if (!document.head.contains(style)) {
            document.head.appendChild(style);
        }
    }

    /**
     * Get current state
     */
    getState() {
        return {
            currentZoomLevel: this.currentZoomLevel,
            magnificationLevel: this.magnificationLevel,
            magnifierActive: this.magnifierActive,
            magnifierSize: this.magnifierSize,
            fontFamily: this.fontFamily,
            fontWeight: this.fontWeight,
            textColor: this.textColor,
            backgroundColor: this.backgroundColor,
            lineHeight: this.lineHeight
        };
    }
}

// Initialize on load if not already done
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.magnificationManager) {
            window.magnificationManager = new MagnificationManager();
            window.magnificationManager.init();
        }
    });
} else {
    if (!window.magnificationManager) {
        window.magnificationManager = new MagnificationManager();
        window.magnificationManager.init();
    }
}
