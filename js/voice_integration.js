/*
  Voice Integration Module - Main Site
  Integrates VoiceCommandsLib with site features and extension messaging
*/

class VoiceIntegration {
    constructor() {
        console.log('🔧 VoiceIntegration constructor called');
        this.isListening = false;
        this.recognition = null;
        this.isContinuous = true;
        this.selectedLanguage = 'en-US';
        this.settings = {};
        this.initAttempts = 0;
        this.maxAttempts = 100; // 10 seconds
        this.isStarting = false; // NEW: guard against double-start
        console.log('🔧 Calling init() from constructor...');
        this.init();
    }

    async init() {
        console.log(`🔧 init() called (attempt ${this.initAttempts}/${this.maxAttempts})`);
        console.log('🔧 Checking if VoiceCommandsLib is defined:', typeof VoiceCommandsLib);
        
        // Wait for VoiceCommandsLib to load (with timeout)
        if (typeof VoiceCommandsLib === 'undefined') {
            this.initAttempts++;
            if (this.initAttempts < this.maxAttempts) {
                console.log(`🔧 VoiceCommandsLib not ready, retrying in 100ms...`);
                setTimeout(() => this.init(), 100);
            } else {
                console.warn('VoiceCommandsLib failed to load, continuing anyway');
                this.continueInit();
            }
            return;
        }

        console.log('✅ VoiceCommandsLib is available, proceeding...');
        this.continueInit();
    }

    continueInit() {
        console.log('🔧 continueInit() starting...');
        
        // Load settings from page settings manager if available
        if (window.settingsManager && window.settingsManager.isInitialized) {
            console.log('🔧 Settings manager found');
            this.settings = window.settingsManager.settings;
            this.selectedLanguage = this.settings.voiceControl?.language || 'en-US';
        } else {
            console.log('🔧 Settings manager not available');
        }

        console.log('🔧 Setting up speech recognition...');
        this.setupSpeechRecognition();
        
        console.log('🔧 Adding voice button to page...');
        this.addVoiceButton();

        // Auto-start if enabled in settings
        if (this.settings.voiceControl?.enabled) {
            console.log('🔧 Auto-starting listening (enabled in settings)');
            this.startListening();
        }

        console.log('✅ VoiceIntegration initialized successfully');
    }

    setupSpeechRecognition() {
        console.log('🔧 setupSpeechRecognition() called');
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('🚨 Speech Recognition API NOT found in browser');
            return;
        }

        console.log('✅ Speech Recognition API available');
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = this.selectedLanguage;

        console.log(`🔧 Speech Recognition configured: language=${this.selectedLanguage}, continuous=false`);
        console.log('🔧 Event handlers attaching...');

        this.recognition.onstart = () => {
            console.log('🎤 [SPEECH RECOGNITION] onstart fired - microphone is listening');
            this.onStart();
        };
        
        this.recognition.onresult = (event) => {
            console.log('🎤 [SPEECH RECOGNITION] onresult fired, results count:', event.results.length);
            for (let i = 0; i < event.results.length; i++) {
                console.log(`   Result ${i}:`, event.results[i]);
            }
            this.onResult(event);
        };
        
        this.recognition.onerror = (event) => {
            console.warn('🎤 [SPEECH RECOGNITION] onerror fired, error:', event.error);
            this.onError(event);
        };
        
        this.recognition.onend = () => {
            console.log('🎤 [SPEECH RECOGNITION] onend fired - recognition stopped');
            this.onEnd();
        };

        console.log('✅ Speech Recognition event handlers attached');
    }

    onStart() {
        console.log('🎤 onStart() - Recognition started listening, clearing isStarting flag');
        this.isStarting = false; // clear the starting flag
        this.isListening = true;
        this.updateVoiceButtonState();
        console.log('🎤 Voice listening started, playing beep...');
        this.playActivationSound();
    }

    onResult(event) {
        console.log('🎤 onResult() - processing ' + event.results.length + ' result(s)');
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.toLowerCase();
            const isFinal = event.results[i].isFinal;

            console.log(`  Result ${i}: "${transcript}" (final: ${isFinal}, confidence: ${event.results[i][0].confidence.toFixed(2)})`);

            if (isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }

        console.log('🎤 Final transcript:', finalTranscript.trim() || '(none)');
        console.log('🎤 Interim transcript:', interimTranscript || '(none)');

        if (finalTranscript) {
            console.log('🎤 Processing voice command:', finalTranscript.trim());
            this.processVoiceCommand(finalTranscript.trim());
        }
    }

    onError(event) {
        console.error('🚨 Speech recognition error:', event.error);
        this.isStarting = false; // clear the starting flag
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
        console.log('🎤 onEnd() - Recognition ended');
        console.log('  - wasListening before:', this.isListening);
        this.isStarting = false; // clear the starting flag
        this.isListening = false;
        this.updateVoiceButtonState();

        // Auto-restart if continuous listening enabled
        if (this.isContinuous && this.settings.voiceControl?.enabled) {
            console.log('🎤 Auto-restart enabled, waiting 500ms...');
            setTimeout(() => this.startListening(), 500);
        } else {
            console.log('🎤 No auto-restart (isContinuous:', this.isContinuous, ', voiceControl.enabled:', this.settings.voiceControl?.enabled, ')');
        }
    }

    startListening() {
        console.log('🎤 startListening() called');
        console.log('  - this.recognition exists:', !!this.recognition);
        console.log('  - this.isListening:', this.isListening);
        console.log('  - this.isStarting:', this.isStarting);
        console.log('  - recognition.constructor:', this.recognition?.constructor?.name);
        
        if (!this.recognition) {
            console.error('🚨 Speech Recognition object not initialized!');
            console.error('🚨 SpeechRecognition constructor:', window.SpeechRecognition || window.webkitSpeechRecognition);
            this.showFeedback('Voice recognition not available in this browser', 'error');
            return;
        }

        if (this.isStarting) {
            console.warn('⚠️ Recognition already starting, ignoring duplicate call');
            return;
        }

        if (this.isListening) {
            console.warn('⚠️ Already listening, ignoring start() call');
            return;
        }

        try {
            this.isStarting = true;
            console.log('🎤 Calling recognition.start()...');
            console.log('🎤 Current recognition state before start:', {
                continuous: this.recognition.continuous,
                interimResults: this.recognition.interimResults,
                lang: this.recognition.lang
            });
            this.recognition.start();
            console.log('✅ recognition.start() called successfully');
        } catch (e) {
            console.warn('⚠️ Error calling recognition.start():', e.message);
            console.error('⚠️ Full error:', e);
            this.isStarting = false;
        }
    }

    stopListening() {
        console.log('🎤 stopListening() called');
        console.log('  - this.recognition exists:', !!this.recognition);
        console.log('  - this.isListening:', this.isListening);
        if (this.recognition) {
            try {
                console.log('🎤 Calling recognition.stop()...');
                this.recognition.stop();
                console.log('✅ recognition.stop() called');
            } catch (e) {
                console.warn('⚠️ Error calling recognition.stop():', e.message);
            }
        } else {
            console.warn('⚠️ No recognition object to stop');
        }
    }

    toggleListening() {
        console.log('🎤 toggleListening() called, currently listening:', this.isListening);
        if (this.isListening) {
            console.log('🎤 Currently listening, stopping...');
            this.stopListening();
        } else {
            console.log('🎤 Not listening, starting...');
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
        console.log('🎯 processVoiceCommand() called with:', transcript);

        // Check if VoiceCommandsLib is available
        if (typeof VoiceCommandsLib === 'undefined') {
            console.error('🚨 VoiceCommandsLib not available!');
            this.showFeedback('Voice commands library not loaded', 'warning');
            return;
        }

        console.log('✅ VoiceCommandsLib available, attempting to match input...');
        
        // Use VoiceCommandsLib to match command
        const match = VoiceCommandsLib.matchInput(transcript);
        const threshold = 0.55;

        console.log('🎯 Match result:', match);
        console.log('  - Command matched:', match?.command?.id || 'NONE');
        console.log('  - Score:', match?.score || 'N/A');
        console.log('  - Threshold:', threshold);
        console.log('  - Phrase matched:', match?.phrase || 'NONE');

        if (!match || match.score < threshold) {
            console.warn(`🚨 No match or score too low (${match?.score || 0} < ${threshold})`);
            this.showFeedback(`"${transcript}" - not recognized. Say "help" for commands.`, 'warning');
            return;
        }

        console.log('✅ Matched command:', match.command.id, 'Score:', match.score);
        console.log('🎯 Executing command:', {
            id: match.command.id,
            action: match.command.action,
            params: match.command.params
        });
        this.executeCommand(match.command);
    }

    executeCommand(cmdObj) {
        console.log('🚀 executeCommand() - Starting command execution');
        if (!cmdObj || !cmdObj.action) {
            console.error('🚨 Invalid command object:', cmdObj);
            return;
        }

        console.log('🚀 Command action:', cmdObj.action);
        console.log('🚀 Command params:', cmdObj.params);

        switch (cmdObj.action) {
            case 'navigate':
                console.log('🚀 Executing NAVIGATE action to:', cmdObj.params.target);
                this.handleNavigate(cmdObj.params.target);
                break;

            case 'filter':
                console.log('🚀 Executing FILTER action:', cmdObj.params.filter);
                this.handleFilterCommand(cmdObj.params.filter);
                break;

            case 'tts':
                console.log('🚀 Executing TTS action:', cmdObj.params.mode);
                this.handleTTSCommand(cmdObj.params.mode);
                break;

            case 'scan':
                console.log('🚀 Executing SCAN action:', cmdObj.params.scope);
                this.handleScanCommand(cmdObj.params.scope);
                break;

            case 'accessibility':
                console.log('🚀 Executing ACCESSIBILITY action:', cmdObj.params.cmd);
                this.handleAccessibilityCommand(cmdObj.params.cmd);
                break;

            case 'theme':
                console.log('🚀 Executing THEME action:', cmdObj.params.theme);
                this.handleThemeCommand(cmdObj.params.theme);
                break;

            case 'help':
                console.log('🚀 Executing HELP action');
                this.showAvailableCommands();
                break;

            case 'extension':
                console.log('🚀 Executing EXTENSION action:', cmdObj.params.cmd);
                this.handleExtensionCommand(cmdObj.params.cmd);
                break;

            case 'voice':
                console.log('🚀 Executing VOICE toggle action');
                this.toggleListening();
                this.showFeedback('Voice control toggled');
                break;

            case 'sync':
                console.log('🚀 Executing SYNC action');
                this.showFeedback('Settings synced with extension');
                break;

            default:
                console.warn('🚨 Unknown action:', cmdObj.action);
        }
        console.log('🚀 Command execution completed');
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

        const preferredVoice = this.getPreferredVoice();
        if (preferredVoice) {
            utterance.voice = preferredVoice;
            console.log('Using voice:', preferredVoice.name, preferredVoice.lang);
        }

        speechSynthesis.speak(utterance);
    }

    getPreferredVoice() {
        if (!window.speechSynthesis) return null;

        const voices = window.speechSynthesis.getVoices();
        if (!voices || !voices.length) return null;

        const normalized = (str) => (str || '').toLowerCase();

        // Best match: en-NG or explicit Nigerian/African voice name
        let preferred = voices.find(v => normalized(v.lang) === 'en-ng');
        if (!preferred) {
            preferred = voices.find(v => normalized(v.name).includes('nigerian') || normalized(v.name).includes('african'));
        }
        if (!preferred) {
            preferred = voices.find(v => normalized(v.lang).startsWith('en-') && (normalized(v.name).includes('africa') || normalized(v.name).includes('afro')));
        }

        // fallback to any en-GB / en-US if African style isn't available
        if (!preferred) {
            preferred = voices.find(v => normalized(v.lang) === 'en-gb' || normalized(v.lang) === 'en-us');
        }

        return preferred || voices[0] || null;
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
        console.log('🔘 updateVoiceButtonState() - isListening:', this.isListening);
        const btn = document.getElementById('voiceControlBtn');
        
        if (!btn) {
            console.warn('🔘 Voice button not found in DOM');
            return;
        }

        console.log('✅ Voice button found, updating state...');
        if (this.isListening) {
            btn.classList.add('listening');
            btn.innerHTML = '<i class="fas fa-microphone-slash"></i> Stop Listening';
            console.log('🔘 Button set to: STOP LISTENING');
        } else {
            btn.classList.remove('listening');
            btn.innerHTML = '<i class="fas fa-microphone"></i> Start Listening';
            console.log('🔘 Button set to: START LISTENING');
        }
    }

    addVoiceButton() {
        console.log('🔘 addVoiceButton() called');
        
        const voiceContainer = document.getElementById('voiceNavigationContainer');
        if (!voiceContainer) {
            console.warn('🔘 voiceNavigationContainer element NOT FOUND in DOM');
            console.log('🔘 Looking for parent elements...');
            const navbar = document.querySelector('nav');
            const header = document.querySelector('header');
            console.log('  - nav found:', !!navbar);
            console.log('  - header found:', !!header);
            return;
        }

        console.log('✅ voiceNavigationContainer found');

        // Check if button already exists
        if (document.getElementById('voiceControlBtn')) {
            console.log('🔘 Voice button already exists, skipping creation');
            return;
        }

        console.log('🔘 Creating new voice button...');
        const btn = document.createElement('button');
        btn.id = 'voiceControlBtn';
        btn.className = 'btn btn-link text-white voice-control-btn';
        btn.innerHTML = '<i class="fas fa-microphone"></i> Start Listening';
        btn.setAttribute('aria-label', 'Voice Control');
        btn.setAttribute('title', 'Click to toggle voice control');
        btn.style.cursor = 'pointer';

        btn.addEventListener('click', (e) => {
            console.log('🔘 Voice button CLICKED! Event details:', {
                type: e.type,
                button: e.button,
                timeStamp: e.timeStamp,
                target: e.target.id
            });
            console.log('🔘 Current state:', {
                isListening: this.isListening,
                isStarting: this.isStarting,
                recognitionExists: !!this.recognition
            });
            console.log('🔘 About to call toggleListening()');
            e.preventDefault();
            try {
                this.toggleListening();
                console.log('🔘 toggleListening() completed successfully');
            } catch (err) {
                console.error('🔘 ERROR in toggleListening():', err);
            }
        });

        voiceContainer.appendChild(btn);
        console.log('✅ Voice button added to navbar');
    }

    showFeedback(message, type = 'info') {
        console.log(`📢 showFeedback() called: [${type.toUpperCase()}] ${message}`);
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
            console.log('📢 Feedback styles added to page');
        }

        document.body.appendChild(notification);
        console.log('📢 Feedback notification added to DOM');

        setTimeout(() => {
            console.log('📢 Showing feedback notification');
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            console.log('📢 Hiding feedback notification');
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
                console.log('📢 Feedback notification removed from DOM');
            }, 300);
        }, 3000);
    }
}

// Initialize when DOM is ready
console.log('🔧 voice_integration.js loaded, document.readyState:', document.readyState);

if (document.readyState === 'loading') {
    console.log('🔧 DOM still loading, waiting for DOMContentLoaded event...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📢 DOMContentLoaded fired, creating VoiceIntegration instance...');
        window.voiceIntegration = new VoiceIntegration();
        console.log('✅ VoiceIntegration instance created and assigned to window.voiceIntegration');
    });
} else {
    console.log('🔧 DOM already loaded, creating VoiceIntegration instance immediately...');
    window.voiceIntegration = new VoiceIntegration();
    console.log('✅ VoiceIntegration instance created and assigned to window.voiceIntegration');
}

