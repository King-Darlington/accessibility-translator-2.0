/*
  Voice Integration Module - Main Site
  Integrates VoiceCommandsLib with site features and extension messaging
*/

class VoiceIntegration {
    constructor() {
        this.isListening = false;
        this.recognition = null;
        this.isContinuous = true;
        this.selectedLanguage = 'en-US';
        this.settings = {};
        this.init();
    }

    async init() {
        // Wait for VoiceCommandsLib to load
        if (typeof VoiceCommandsLib === 'undefined') {
            setTimeout(() => this.init(), 500);
            return;
        }

        // Load settings from page settings manager if available
        if (window.settingsManager && window.settingsManager.isInitialized) {
            this.settings = window.settingsManager.settings;
            this.selectedLanguage = this.settings.voiceControl?.language || 'en-US';
        }

        this.setupSpeechRecognition();
        this.setupEventListeners();
        this.addVoiceButton();

        // Auto-start if enabled in settings
        if (this.settings.voiceControl?.enabled) {
            this.startListening();
        }

        console.log('VoiceIntegration initialized');
    }

    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('Speech Recognition not supported in this browser');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = this.isContinuous;
        this.recognition.interimResults = true;
        this.recognition.lang = this.selectedLanguage;

        this.recognition.onstart = () => this.onStart();
        this.recognition.onresult = (event) => this.onResult(event);
        this.recognition.onerror = (event) => this.onError(event);
        this.recognition.onend = () => this.onEnd();
    }

    onStart() {
        this.isListening = true;
        this.updateVoiceButtonState();
        console.log('Voice listening started');
    }

    onResult(event) {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;

            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }

        if (finalTranscript) {
            this.processVoiceCommand(finalTranscript.trim());
        }
    }

    onError(event) {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
            this.showFeedback('Microphone access denied. Please enable microphone permissions.', 'error');
        } else if (event.error === 'network') {
            this.showFeedback('Network error. Check your internet connection.', 'error');
        }
    }

    onEnd() {
        this.isListening = false;
        this.updateVoiceButtonState();

        // Auto-restart if continuous listening enabled
        if (this.isContinuous && this.settings.voiceControl?.enabled) {
            setTimeout(() => this.startListening(), 500);
        }
    }

    processVoiceCommand(transcript) {
        console.log('Voice input:', transcript);

        // Use VoiceCommandsLib to match command
        const match = VoiceCommandsLib.matchInput(transcript);
        const threshold = 0.55;

        if (!match || match.score < threshold) {
            this.showFeedback(`"${transcript}" - not recognized. Say "help" for commands.`, 'warning');
            return;
        }

        console.log('Matched command:', match.command.id, 'Score:', match.score);
        this.executeCommand(match.command);
    }

    executeCommand(cmdObj) {
        if (!cmdObj || !cmdObj.action) return;

        switch (cmdObj.action) {
            case 'navigate':
                this.handleNavigate(cmdObj.params.target);
                break;

            case 'filter':
                this.handleFilterCommand(cmdObj.params.filter);
                break;

            case 'tts':
                this.handleTTSCommand(cmdObj.params.mode);
                break;

            case 'scan':
                this.handleScanCommand(cmdObj.params.scope);
                break;

            case 'accessibility':
                this.handleAccessibilityCommand(cmdObj.params.cmd);
                break;

            case 'theme':
                this.handleThemeCommand(cmdObj.params.theme);
                break;

            case 'help':
                this.showAvailableCommands();
                break;

            case 'sync':
                this.syncSettingsWithExtension();
                break;

            case 'extension':
                this.triggerExtensionFeature('open');
                break;

            case 'voice':
                this.toggleListening();
                break;

            default:
                console.log('Unhandled command:', cmdObj.action);
        }

        this.showFeedback(`Command executed: ${cmdObj.id}`, 'success');
    }

    handleNavigate(target) {
        const routes = {
            'home': 'home.html',
            'settings': 'settings.html',
            'contact': 'contact.html',
            'text-to-speech': 'text-to-speech.html',
            'object-scanning': 'object-scanning.html',
            'gallery': 'gallery.html'
        };

        if (routes[target]) {
            window.location.href = routes[target];
        }
    }

    handleFilterCommand(filter) {
        // Trigger filter via extension or direct CSS
        if (window.AccessibilityExtension && window.AccessibilityExtension.detected()) {
            window.postMessage({
                type: 'AT_TRIGGER_FEATURE',
                feature: 'filters',
                params: { filter }
            }, '*');
        } else {
            // Apply filter directly if extension not available
            this.applyColorFilter(filter);
        }
    }

    applyColorFilter(filter) {
        const filterMap = {
            'grayscale': 'grayscale(100%)',
            'high-contrast': 'contrast(1.5) brightness(1.1)',
            'invert': 'invert(100%)',
            'sepia': 'sepia(100%)',
            'blue-light': 'saturate(0.8) hue-rotate(15deg)',
            'protanopia': 'url(#protanopia)',
            'deuteranopia': 'url(#deuteranopia)',
            'tritanopia': 'url(#tritanopia)'
        };

        if (!filter || filter === 'none' || filter === null) {
            document.body.style.filter = 'none';
        } else if (filterMap[filter]) {
            document.body.style.filter = filterMap[filter];
        }
    }

    handleTTSCommand(mode) {
        if (mode === 'read') {
            this.readPageContent();
        } else if (mode === 'stop') {
            speechSynthesis.cancel();
        } else if (mode === 'resume') {
            speechSynthesis.resume();
        }
    }

    readPageContent() {
        // Extract main content and read
        const mainContent = document.querySelector('main') || 
                            document.querySelector('.main-content') || 
                            document.body;

        const clone = mainContent.cloneNode(true);
        clone.querySelectorAll('script, style, nav, footer, .ads, .sidebar').forEach(el => el.remove());
        
        const text = clone.textContent.replace(/\s+/g, ' ').trim();
        
        if (!text) {
            this.showFeedback('No content to read', 'warning');
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = this.settings.tts?.rate || 1;
        utterance.pitch = this.settings.tts?.pitch || 1;
        utterance.volume = (this.settings.tts?.volume || 100) / 100;
        
        speechSynthesis.speak(utterance);
        this.showFeedback('Reading page...', 'info');
    }

    handleScanCommand(scope) {
        if (window.AccessibilityExtension && window.AccessibilityExtension.detected()) {
            window.postMessage({
                type: 'AT_TRIGGER_FEATURE',
                feature: 'scan'
            }, '*');
        } else {
            this.showFeedback('Object scanning requires extension', 'warning');
        }
    }

    handleAccessibilityCommand(cmd) {
        switch (cmd) {
            case 'increaseText':
                this.adjustTextSize(1.1);
                break;
            case 'decreaseText':
                this.adjustTextSize(0.9);
                break;
            case 'zoomIn':
                document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) * 1.1) + '';
                break;
            case 'zoomOut':
                document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) / 1.1) + '';
                break;
        }
    }

    adjustTextSize(factor) {
        const root = document.documentElement;
        const current = parseFloat(getComputedStyle(root).fontSize);
        root.style.fontSize = (current * factor) + 'px';
    }

    handleThemeCommand(theme) {
        if (window.settingsManager) {
            window.settingsManager.applyTheme(theme);
        }
    }

    showAvailableCommands() {
        const commands = VoiceCommandsLib.commands
            .slice(0, 15)
            .map(c => c.phrases[0])
            .join(', ');
        
        this.showFeedback(`Try saying: ${commands}`, 'info');
    }

    syncSettingsWithExtension() {
        if (window.settingsManager) {
            const settings = window.settingsManager.settings;
            if (window.AccessibilityExtension && window.AccessibilityExtension.detected()) {
                chrome.runtime.sendMessage({
                    action: 'syncSettings',
                    settings: settings
                });
            }
        }
    }

    triggerExtensionFeature(feature) {
        if (window.AccessibilityExtension && window.AccessibilityExtension.detected()) {
            window.AccessibilityExtension.openModal();
        }
    }

    startListening() {
        if (!this.recognition) {
            this.setupSpeechRecognition();
        }

        if (this.recognition && !this.isListening) {
            this.recognition.start();
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    updateVoiceButtonState() {
        const btn = document.getElementById('voiceControlBtn');
        if (btn) {
            if (this.isListening) {
                btn.classList.add('listening');
                btn.innerHTML = '<i class="fas fa-microphone-slash"></i> Stop Listening';
            } else {
                btn.classList.remove('listening');
                btn.innerHTML = '<i class="fas fa-microphone"></i> Start Listening';
            }
        }
    }

    addVoiceButton() {
        const voiceContainer = document.getElementById('voiceNavigationContainer');
        if (!voiceContainer) return;

        const btn = document.createElement('button');
        btn.id = 'voiceControlBtn';
        btn.className = 'btn btn-link text-white voice-control-btn';
        btn.innerHTML = '<i class="fas fa-microphone"></i> Voice';
        btn.setAttribute('aria-label', 'Voice Control');
        btn.setAttribute('title', 'Click to toggle voice control');

        btn.addEventListener('click', () => this.toggleListening());
        voiceContainer.appendChild(btn);
    }

    showFeedback(message, type = 'info') {
        // Show notification/feedback to user
        const notification = document.createElement('div');
        notification.className = `voice-feedback ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}-circle"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.voiceIntegration = new VoiceIntegration();
    });
} else {
    window.voiceIntegration = new VoiceIntegration();
}
