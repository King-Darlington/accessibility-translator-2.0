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
        this.initAttempts = 0;
        this.maxAttempts = 100; // 10 seconds
        this.init();
    }

    async init() {
        // Wait for VoiceCommandsLib to load (with timeout)
        if (typeof VoiceCommandsLib === 'undefined') {
            this.initAttempts++;
            if (this.initAttempts < this.maxAttempts) {
                setTimeout(() => this.init(), 100);
            } else {
                console.warn('VoiceCommandsLib failed to load, continuing anyway');
                this.continueInit();
            }
            return;
        }

        this.continueInit();
    }

    continueInit() {
        // Load settings from page settings manager if available
        if (window.settingsManager && window.settingsManager.isInitialized) {
            this.settings = window.settingsManager.settings;
            this.selectedLanguage = this.settings.voiceControl?.language || 'en-US';
        }

        this.setupSpeechRecognition();
        this.addVoiceButton();

        // Auto-start if enabled in settings
        if (this.settings.voiceControl?.enabled) {
            this.startListening();
        }

        console.log('✅ VoiceIntegration initialized successfully');
    }

    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('🚨 Speech Recognition not supported in this browser');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false; // Changed to false for better offline support
        this.recognition.interimResults = false; // Disabled for offline mode
        this.recognition.lang = this.selectedLanguage;

        this.recognition.onstart = () => this.onStart();
        this.recognition.onresult = (event) => this.onResult(event);
        this.recognition.onerror = (event) => this.onError(event);
        this.recognition.onend = () => this.onEnd();
    }

    onStart() {
        this.isListening = true;
        this.updateVoiceButtonState();
        console.log('🎤 Voice listening started');
        this.playActivationSound();
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
        console.error('🚨 Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
            this.showFeedback('Microphone access denied. Please enable microphone permissions.', 'error');
        } else if (event.error === 'network' || event.error === 'network-error') {
            // Network errors are expected when offline - voice commands still work
            console.log('Network error detected - but voice commands work offline with local matching');
        } else if (event.error === 'no-speech') {
            console.log('No speech detected, try speaking more clearly');
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

    startListening() {
        if (!this.recognition) {
            this.showFeedback('Voice recognition not available in this browser', 'error');
            return;
        }

        try {
            this.recognition.start();
        } catch (e) {
            console.warn('Recognition already started or error:', e);
        }
    }

    stopListening() {
        if (this.recognition) {
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

    playActivationSound() {
        // Create a simple beep sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Short beep: frequency 800Hz, duration 150ms
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.15);
        } catch (e) {
            console.warn('Could not play activation sound:', e);
        }
    }

    processVoiceCommand(transcript) {
        console.log('Voice input:', transcript);

        // Check if VoiceCommandsLib is available
        if (typeof VoiceCommandsLib === 'undefined') {
            this.showFeedback('Voice commands library not loaded', 'warning');
            return;
        }

        // Use VoiceCommandsLib to match command
        const match = VoiceCommandsLib.matchInput(transcript);
        const threshold = 0.55;

        if (!match || match.score < threshold) {
            this.showFeedback(`"${transcript}" - not recognized. Say "help" for commands.`, 'warning');
            return;
        }

        console.log('✅ Matched command:', match.command.id, 'Score:', match.score);
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

            case 'extension':
                this.handleExtensionCommand(cmdObj.params.cmd);
                break;

            case 'voice':
                this.toggleListening();
                this.showFeedback('Voice control toggled');
                break;

            case 'sync':
                this.showFeedback('Settings synced with extension');
                break;

            default:
                console.warn('Unknown action:', cmdObj.action);
        }
    }

    handleNavigate(target) {
        const routes = {
            'home': 'index.html',
            'settings': 'settings.html',
            'contact': 'contact.html',
            'text-to-speech': 'text-to-speech.html',
            'object-scanning': 'object-scanning.html',
            'gallery': 'gallery.html',
        };

        const url = routes[target];
        if (url) {
            this.showFeedback(`Navigating to ${target}...`, 'success');
            setTimeout(() => {
                window.location.href = url;
            }, 500);
        }
    }

    handleFilterCommand(filterName) {
        this.showFeedback(`Applying ${filterName} filter...`, 'success');
        
        // Trigger filter event if AppState exists
        if (window.AppState) {
            const event = new CustomEvent('applyColorFilter', { detail: { filter: filterName } });
            document.dispatchEvent(event);
        }
    }

    handleTTSCommand(mode) {
        if (mode === 'read') {
            this.showFeedback('Reading page content...', 'success');
            
            // Try to trigger TTS if available
            if (window.textToSpeechManager) {
                window.textToSpeechManager.readPage();
            } else {
                this.readPageContent();
            }
        } else if (mode === 'stop') {
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
            this.showFeedback('Reading stopped', 'success');
        } else if (mode === 'resume') {
            if (window.speechSynthesis) {
                window.speechSynthesis.resume();
            }
            this.showFeedback('Reading resumed', 'success');
        }
    }

    readPageContent() {
        const speechSynthesis = window.speechSynthesis;
        if (!speechSynthesis) {
            this.showFeedback('Text-to-speech not supported', 'error');
            return;
        }

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
    }

    handleScanCommand(scope) {
        if (scope === 'page') {
            this.showFeedback('Scanning page for objects...', 'success');
            window.location.href = 'object-scanning.html';
        } else if (scope === 'image') {
            this.showFeedback('Ready to scan image', 'success');
            window.location.href = 'object-scanning.html';
        }
    }

    handleAccessibilityCommand(cmd) {
        if (cmd === 'increaseText') {
            this.showFeedback('Increasing text size...', 'success');
            if (window.AppState && window.AppState.increaseTextSize) {
                window.AppState.increaseTextSize();
            }
        } else if (cmd === 'decreaseText') {
            this.showFeedback('Decreasing text size...', 'success');
            if (window.AppState && window.AppState.decreaseTextSize) {
                window.AppState.decreaseTextSize();
            }
        } else if (cmd === 'zoomIn') {
            document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) + 0.1) + '';
            this.showFeedback('Zooming in...', 'success');
        } else if (cmd === 'zoomOut') {
            document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) - 0.1) + '';
            this.showFeedback('Zooming out...', 'success');
        }
    }

    handleThemeCommand(theme) {
        this.showFeedback(`Switching to ${theme} mode...`, 'success');
        document.body.setAttribute('data-theme', theme);
        document.body.classList.remove('dark-mode', 'light-mode', 'high-contrast');
        document.body.classList.add(`${theme}-mode`);
    }

    handleExtensionCommand(cmd) {
        if (cmd === 'open') {
            this.showFeedback('Opening extension...', 'success');
            window.openExtensionModal?.();
        }
    }

    showAvailableCommands() {
        const commands = VoiceCommandsLib?.commands || [];
        const commandList = commands.map(c => `${c.id}: ${c.phrases[0]}`).join('\n');
        
        const message = `Available voice commands:\n${commandList.substring(0, 500)}...\nSay "help" again for more.`;
        this.showFeedback('Commands available in console', 'info');
        console.log('📋 Available Voice Commands:');
        commands.forEach(cmd => {
            console.log(`  ${cmd.id}: ${cmd.phrases.join(', ')}`);
        });
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
        if (!voiceContainer) {
            console.warn('voiceNavigationContainer not found');
            return;
        }

        // Check if button already exists
        if (document.getElementById('voiceControlBtn')) {
            return;
        }

        const btn = document.createElement('button');
        btn.id = 'voiceControlBtn';
        btn.className = 'btn btn-link text-white voice-control-btn';
        btn.innerHTML = '<i class="fas fa-microphone"></i> Start Listening';
        btn.setAttribute('aria-label', 'Voice Control');
        btn.setAttribute('title', 'Click to toggle voice control');
        btn.style.cursor = 'pointer';

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleListening();
        });

        voiceContainer.appendChild(btn);
        console.log('✅ Voice button added to navbar');
    }

    showFeedback(message, type = 'info') {
        // Show notification/feedback to user
        const notification = document.createElement('div');
        notification.className = `voice-feedback ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}-circle"></i>
            <span>${message}</span>
        `;

        // Add basic styling if not already present
        if (!document.getElementById('voice-feedback-styles')) {
            const style = document.createElement('style');
            style.id = 'voice-feedback-styles';
            style.textContent = `
                .voice-feedback {
                    position: fixed;
                    bottom: -100px;
                    right: 20px;
                    background: #1e293b;
                    color: white;
                    padding: 15px 20px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    z-index: 9999;
                    transition: bottom 0.3s ease;
                }
                .voice-feedback.show {
                    bottom: 20px;
                }
                .voice-feedback.success {
                    background: #10b981;
                    border-left: 4px solid #059669;
                }
                .voice-feedback.error {
                    background: #ef4444;
                    border-left: 4px solid #dc2626;
                }
                .voice-feedback.warning {
                    background: #f59e0b;
                    border-left: 4px solid #d97706;
                }
                .voice-feedback i {
                    font-size: 18px;
                }
            `;
            document.head.appendChild(style);
        }

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
        console.log('VoiceIntegration created on DOMContentLoaded');
    });
} else {
    window.voiceIntegration = new VoiceIntegration();
    console.log('VoiceIntegration created immediately');
}
