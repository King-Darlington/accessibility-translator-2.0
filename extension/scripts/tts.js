// Text-to-Speech functionality for Accessibility Translator

class TextToSpeechManager {
    constructor() {
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.voices = [];
        this.settings = {};
        this.init();
    }

    async init() {
        await this.loadSettings();
        await this.loadVoices();
        this.setupEventListeners();
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get('tts', (result) => {
                this.settings = result.tts || {
                    voice: '',
                    rate: 1,
                    pitch: 1,
                    volume: 1
                };
                resolve(this.settings);
            });
        });
    }

    async loadVoices() {
        return new Promise((resolve) => {
            const loadVoices = () => {
                this.voices = speechSynthesis.getVoices();
                if (this.voices.length > 0) {
                    resolve(this.voices);
                }
            };

            if (speechSynthesis.getVoices().length > 0) {
                loadVoices();
            } else {
                speechSynthesis.addEventListener('voiceschanged', loadVoices);
            }
        });
    }

    setupEventListeners() {
        // Listen for messages from popup and content scripts
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'speakText') {
                this.speak(request.text, request.options);
                sendResponse({ success: true });
            }
            
            if (request.action === 'stopSpeech') {
                this.stop();
                sendResponse({ success: true });
            }
            
            if (request.action === 'getVoices') {
                sendResponse({ voices: this.voices });
            }
            
            return true;
        });
    }

    async speak(text, options = {}) {
        if (this.isSpeaking) {
            this.stop();
        }

        return new Promise((resolve) => {
            this.currentUtterance = new SpeechSynthesisUtterance(text);
            
            // Apply settings
            const settings = { ...this.settings, ...options };
            this.applySettings(this.currentUtterance, settings);
            
            // Set up event handlers
            this.currentUtterance.onstart = () => {
                this.isSpeaking = true;
                this.updateSpeakingState(true);
            };
            
            this.currentUtterance.onend = () => {
                this.isSpeaking = false;
                this.updateSpeakingState(false);
                resolve();
            };
            
            this.currentUtterance.onerror = (event) => {
                this.isSpeaking = false;
                this.updateSpeakingState(false);
                console.error('Speech synthesis error:', event.error);
                resolve();
            };
            
            speechSynthesis.speak(this.currentUtterance);
        });
    }

    applySettings(utterance, settings) {
        if (settings.voice) {
            const voice = this.voices.find(v => v.voiceName === settings.voice);
            if (voice) {
                utterance.voice = voice;
            }
        }
        
        utterance.rate = settings.rate || 1;
        utterance.pitch = settings.pitch || 1;
        utterance.volume = settings.volume || 1;
    }

    stop() {
        if (this.isSpeaking) {
            speechSynthesis.cancel();
            this.isSpeaking = false;
            this.updateSpeakingState(false);
        }
    }

    updateSpeakingState(isSpeaking) {
        // Notify all tabs about speaking state
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'speakingStateChanged',
                    isSpeaking: isSpeaking
                }).catch(() => {
                    // Tab might not have content script
                });
            });
        });
    }

    async saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        
        return new Promise((resolve) => {
            chrome.storage.sync.set({ tts: this.settings }, resolve);
        });
    }

    // Quick action methods
    async readSelectedText() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' }, (response) => {
            if (response && response.text) {
                this.speak(response.text);
            }
        });
    }

    async readPageContent() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        chrome.tabs.sendMessage(tab.id, { action: 'extractPageText' }, (response) => {
            if (response && response.text) {
                this.speak(response.text);
            }
        });
    }

    async readHeaders() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        chrome.tabs.sendMessage(tab.id, { action: 'extractHeaders' }, (response) => {
            if (response && response.headers) {
                this.speak(response.headers.join('. '));
            }
        });
    }

    async readLinks() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        chrome.tabs.sendMessage(tab.id, { action: 'extractLinks' }, (response) => {
            if (response && response.links) {
                this.speak(response.links.join('. '));
            }
        });
    }

    async readImages() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        chrome.tabs.sendMessage(tab.id, { action: 'extractImageAlts' }, (response) => {
            if (response && response.altTexts) {
                const filtered = response.altTexts.filter(alt => alt.trim().length > 0);
                if (filtered.length > 0) {
                    this.speak(`Images with descriptions: ${filtered.join('. ')}`);
                } else {
                    this.speak('No images with descriptions found on this page.');
                }
            }
        });
    }
}

// Initialize TTS manager
const ttsManager = new TextToSpeechManager();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextToSpeechManager;
}