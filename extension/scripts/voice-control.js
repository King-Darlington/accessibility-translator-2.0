// Voice Control System for Accessibility Translator

class VoiceControlManager {
    constructor() {
        this.isListening = false;
        this.recognition = null;
        this.commands = new Map();
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupCommands();
        this.setupMessageListener();
        
        if (this.settings.enabled) {
            this.initializeSpeechRecognition();
        }
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get('voiceControl', (result) => {
                this.settings = result.voiceControl || {
                    enabled: false,
                    language: 'en-US',
                    continuous: true,
                    interimResults: false
                };
                resolve(this.settings);
            });
        });
    }

    setupCommands() {
        // Basic navigation commands
        this.commands.set('read page', this.handleReadPage.bind(this));
        this.commands.set('stop reading', this.handleStopReading.bind(this));
        this.commands.set('stop', this.handleStopReading.bind(this));
        this.commands.set('pause', this.handleStopReading.bind(this));
        
        // Filter commands
        this.commands.set('activate grayscale', () => this.handleActivateFilter('grayscale'));
        this.commands.set('activate high contrast', () => this.handleActivateFilter('high-contrast'));
        this.commands.set('activate invert', () => this.handleActivateFilter('invert'));
        this.commands.set('activate sepia', () => this.handleActivateFilter('sepia'));
        this.commands.set('activate blue light', () => this.handleActivateFilter('blue-light'));
        this.commands.set('remove filter', this.handleRemoveFilter.bind(this));
        this.commands.set('reset filter', this.handleRemoveFilter.bind(this));
        
        // Scanning commands
        this.commands.set('scan page', this.handleScanPage.bind(this));
        this.commands.set('scan objects', this.handleScanObjects.bind(this));
        this.commands.set('scan text', this.handleScanText.bind(this));
        
        // Navigation commands
        this.commands.set('navigate to top', () => this.handleNavigateTo('top'));
        this.commands.set('navigate to bottom', () => this.handleNavigateTo('bottom'));
        this.commands.set('navigate to header', () => this.handleNavigateTo('header'));
        this.commands.set('navigate to main', () => this.handleNavigateTo('main'));
        this.commands.set('navigate to footer', () => this.handleNavigateTo('footer'));
        
        // Control commands
        this.commands.set('start listening', this.startListening.bind(this));
        this.commands.set('stop listening', this.stopListening.bind(this));
        this.commands.set('help', this.showHelp.bind(this));
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'toggleVoiceControl':
                    this.toggleListening();
                    sendResponse({ success: true });
                    break;
                    
                case 'startVoiceControl':
                    this.startListening();
                    sendResponse({ success: true });
                    break;
                    
                case 'stopVoiceControl':
                    this.stopListening();
                    sendResponse({ success: true });
                    break;
                    
                case 'getVoiceCommands':
                    sendResponse({ commands: Array.from(this.commands.keys()) });
                    break;
            }
            return true;
        });
    }

    initializeSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = this.settings.continuous;
        this.recognition.interimResults = this.settings.interimResults;
        this.recognition.lang = this.settings.language;
        
        this.recognition.onstart = this.onRecognitionStart.bind(this);
        this.recognition.onresult = this.onRecognitionResult.bind(this);
        this.recognition.onerror = this.onRecognitionError.bind(this);
        this.recognition.onend = this.onRecognitionEnd.bind(this);
    }

    async toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            await this.startListening();
        }
    }

    async startListening() {
        if (!this.recognition) {
            this.initializeSpeechRecognition();
        }

        if (this.recognition && !this.isListening) {
            try {
                this.recognition.start();
                this.isListening = true;
                this.updateListeningState(true);
                
                // Notify user
                this.speakFeedback('Voice control activated. Say "help" for available commands.');
            } catch (error) {
                console.error('Error starting speech recognition:', error);
                this.speakFeedback('Sorry, I could not start voice control.');
            }
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
            this.updateListeningState(false);
            
            this.speakFeedback('Voice control deactivated.');
        }
    }

    onRecognitionStart() {
        console.log('Speech recognition started');
        this.isListening = true;
        this.updateListeningState(true);
    }

        onRecognitionResult(event) {
        const results = event.results;
        const lastResult = results[results.length - 1];
        const transcript = lastResult[0].transcript.trim().toLowerCase();
        
        console.log('Voice command:', transcript);
        
        if (lastResult.isFinal) {
            this.processCommand(transcript);
        }
    }

    onRecognitionError(event) {
        console.error('Speech recognition error:', event.error);
        
        if (event.error === 'not-allowed') {
            this.speakFeedback('Microphone access is not allowed. Please check your browser permissions.');
        } else if (event.error === 'network') {
            this.speakFeedback('Network error occurred. Please check your internet connection.');
        } else {
            this.speakFeedback('Sorry, there was an error with voice recognition.');
        }
        
        this.isListening = false;
        this.updateListeningState(false);
    }

    onRecognitionEnd() {
        console.log('Speech recognition ended');
        this.isListening = false;
        this.updateListeningState(false);
        
        // Restart listening if it was stopped unexpectedly
        if (this.settings.continuous && this.settings.enabled) {
            setTimeout(() => {
                if (this.settings.enabled && !this.isListening) {
                    this.startListening();
                }
            }, 1000);
        }
    }

    processCommand(transcript) {
        let commandExecuted = false;
        
        // Exact match
        if (this.commands.has(transcript)) {
            this.commands.get(transcript)();
            commandExecuted = true;
        } else {
            // Partial match with fuzzy matching
            for (const [command, handler] of this.commands) {
                if (transcript.includes(command) || this.fuzzyMatch(transcript, command)) {
                    handler();
                    commandExecuted = true;
                    break;
                }
            }
        }
        
        if (!commandExecuted) {
            // Handle dynamic commands
            this.handleDynamicCommand(transcript);
        }
        
        // Provide feedback for successful commands
        if (commandExecuted) {
            this.speakFeedback('Command executed');
        } else {
            this.speakFeedback(`Command not recognized: ${transcript}. Say "help" for available commands.`);
        }
    }

    fuzzyMatch(transcript, command) {
        const transcriptWords = transcript.split(' ');
        const commandWords = command.split(' ');
        
        // Check if most words in command are present in transcript
        const matchingWords = commandWords.filter(word => 
            transcriptWords.some(tWord => tWord.includes(word) || word.includes(tWord))
        );
        
        return matchingWords.length >= commandWords.length * 0.7; // 70% match threshold
    }

    handleDynamicCommand(transcript) {
        // Handle filter activation with dynamic filter names
        const filterMatch = transcript.match(/activate\s+(\w+(?:\s+\w+)*)/);
        if (filterMatch) {
            const filterName = filterMatch[1].toLowerCase().replace(/\s+/g, '-');
            this.handleActivateFilter(filterName);
            return;
        }
        
        // Handle navigation to specific elements
        const navigateMatch = transcript.match(/navigate to (\w+)/);
        if (navigateMatch) {
            const target = navigateMatch[1].toLowerCase();
            this.handleNavigateTo(target);
            return;
        }
        
        // Handle click commands
        const clickMatch = transcript.match(/click (\w+)/);
        if (clickMatch) {
            const elementType = clickMatch[1].toLowerCase();
            this.handleClickElement(elementType);
            return;
        }
    }

    // Command Handlers
    async handleReadPage() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: 'extractPageText' }, (response) => {
            if (response && response.text) {
                chrome.runtime.sendMessage({
                    action: 'speakText',
                    text: response.text
                });
            }
        });
    }

    handleStopReading() {
        chrome.runtime.sendMessage({
            action: 'stopSpeech'
        });
    }

    async handleActivateFilter(filterName) {
        const validFilters = [
            'grayscale', 'high-contrast', 'invert', 'sepia', 
            'blue-light', 'protanopia', 'deuteranopia', 'tritanopia'
        ];
        
        if (validFilters.includes(filterName)) {
            chrome.runtime.sendMessage({
                action: 'applyFilter',
                filter: filterName
            });
            this.speakFeedback(`Activated ${filterName} filter`);
        } else {
            this.speakFeedback(`Filter ${filterName} not found`);
        }
    }

    handleRemoveFilter() {
        chrome.runtime.sendMessage({
            action: 'applyFilter',
            filter: null
        });
        this.speakFeedback('Filter removed');
    }

    async handleScanPage() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: 'startObjectScanning' });
        this.speakFeedback('Starting page scan');
    }

    async handleScanObjects() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: 'scanForObjects' });
        this.speakFeedback('Scanning for objects');
    }

    async handleScanText() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: 'extractAllText' });
        this.speakFeedback('Extracting text from page');
    }

    async handleNavigateTo(target) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        const scrollPositions = {
            'top': 0,
            'bottom': 'document.body.scrollHeight',
            'header': 'document.querySelector("header")',
            'main': 'document.querySelector("main")',
            'footer': 'document.querySelector("footer")'
        };
        
        if (scrollPositions[target]) {
            chrome.tabs.sendMessage(tab.id, {
                action: 'scrollToElement',
                target: target,
                position: scrollPositions[target]
            });
            this.speakFeedback(`Navigated to ${target}`);
        } else {
            this.speakFeedback(`Navigation target ${target} not found`);
        }
    }

    async handleClickElement(elementType) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        chrome.tabs.sendMessage(tab.id, {
            action: 'clickElementByType',
            elementType: elementType
        });
        
        this.speakFeedback(`Attempting to click ${elementType}`);
    }

    showHelp() {
        const commands = Array.from(this.commands.keys()).slice(0, 10); // Show first 10 commands
        const helpText = `Available commands: ${commands.join(', ')}. Say a command to execute it.`;
        this.speakFeedback(helpText);
    }

    async speakFeedback(text) {
        // Use TTS for feedback
        chrome.runtime.sendMessage({
            action: 'speakText',
            text: text,
            options: {
                rate: 1.2,
                pitch: 1.1
            }
        });
    }

    updateListeningState(isListening) {
        // Update UI in popup and content scripts
        chrome.runtime.sendMessage({
            action: 'voiceControlStateChanged',
            isListening: isListening
        });

        // Update badge
        const badgeText = isListening ? 'ON' : '';
        const badgeColor = isListening ? '#10b981' : '#666666';
        
        chrome.action.setBadgeText({ text: badgeText });
        chrome.action.setBadgeBackgroundColor({ color: badgeColor });

        // Send to all tabs
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'voiceControlStateChanged',
                    isListening: isListening
                }).catch(() => {
                    // Tab might not have content script
                });
            });
        });
    }

    async saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        
        await new Promise((resolve) => {
            chrome.storage.sync.set({ voiceControl: this.settings }, resolve);
        });

        // Restart recognition if settings changed
        if (this.isListening) {
            this.stopListening();
            if (this.settings.enabled) {
                setTimeout(() => this.startListening(), 500);
            }
        }
    }

    // Voice training and customization
    async trainVoiceModel() {
        // This would integrate with more advanced speech recognition
        // For now, it's a placeholder for future enhancement
        console.log('Voice training started');
        this.speakFeedback('Voice training feature coming soon');
    }

    // Export voice commands for backup
    exportCommands() {
        const commandList = Array.from(this.commands.keys());
        const data = {
            commands: commandList,
            settings: this.settings,
            exportDate: new Date().toISOString()
        };
        
        return JSON.stringify(data, null, 2);
    }

    // Import voice commands
    importCommands(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (data.commands && Array.isArray(data.commands)) {
                // Rebuild commands map (this would need more sophisticated handling)
                console.log('Importing commands:', data.commands);
                this.speakFeedback(`Imported ${data.commands.length} commands`);
            }
            
            if (data.settings) {
                this.saveSettings(data.settings);
            }
        } catch (error) {
            console.error('Error importing commands:', error);
            this.speakFeedback('Error importing commands');
        }
    }
}

// Initialize voice control manager
const voiceControlManager = new VoiceControlManager();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceControlManager;
}