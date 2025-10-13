// Text-to-Speech Functionality
document.addEventListener('DOMContentLoaded', () => {
    // State management
    const TTSState = {
        voices: [],
        utterance: null,
        isPaused: false,
        isSpeaking: false,
        currentSettings: {
            rate: 1.0,
            pitch: 1.0,
            volume: 1.0,
            voice: null
        }
    };

    // Elements
    const elements = {
        textInput: document.getElementById('textInput'),
        voiceSelect: document.getElementById('voiceSelect'),
        rateSlider: document.getElementById('rateSlider'),
        pitchSlider: document.getElementById('pitchSlider'),
        volumeSlider: document.getElementById('volumeSlider'),
        rateValue: document.getElementById('rateValue'),
        pitchValue: document.getElementById('pitchValue'),
        volumeValue: document.getElementById('volumeValue'),
        speakBtn: document.getElementById('speakBtn'),
        pauseBtn: document.getElementById('pauseBtn'),
        stopBtn: document.getElementById('stopBtn'),
        clearBtn: document.getElementById('clearBtn'),
        charCount: document.getElementById('charCount'),
        wordCount: document.getElementById('wordCount')
    };

    // Initialize TTS functionality
    initializeTTS();

    function initializeTTS() {
        // Check if Speech Synthesis is supported
        if (!('speechSynthesis' in window)) {
            showError('Sorry, your browser does not support text-to-speech functionality.');
            disableAllControls();
            return;
        }

        loadSavedPreferences();
        initializeEventListeners();
        loadVoices();
    }

    function loadSavedPreferences() {
        // Load from localStorage
        const savedRate = localStorage.getItem('tts_rate');
        const savedPitch = localStorage.getItem('tts_pitch');
        const savedVolume = localStorage.getItem('tts_volume');
        const savedVoice = localStorage.getItem('tts_voice');

        if (savedRate && elements.rateSlider) {
            elements.rateSlider.value = savedRate;
            TTSState.currentSettings.rate = parseFloat(savedRate);
            if (elements.rateValue) {
                elements.rateValue.textContent = `${parseFloat(savedRate).toFixed(1)}x`;
            }
        }

        if (savedPitch && elements.pitchSlider) {
            elements.pitchSlider.value = savedPitch;
            TTSState.currentSettings.pitch = parseFloat(savedPitch);
            if (elements.pitchValue) {
                elements.pitchValue.textContent = parseFloat(savedPitch).toFixed(1);
            }
        }

        if (savedVolume && elements.volumeSlider) {
            elements.volumeSlider.value = savedVolume;
            TTSState.currentSettings.volume = parseFloat(savedVolume);
            if (elements.volumeValue) {
                elements.volumeValue.textContent = `${Math.round(savedVolume * 100)}%`;
            }
        }

        if (savedVoice) {
            TTSState.currentSettings.voice = savedVoice;
        }
    }

    function savePreferenceToDatabase(setting) {
        // Save to localStorage immediately
        Object.keys(setting).forEach(key => {
            localStorage.setItem(`tts_${key}`, setting[key]);
        });

        // If user is logged in, save to database
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.id) {
            fetch('auth/save_preferences.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: user.id,
                    preferences: setting
                })
            }).catch(error => {
                console.error('Failed to save preferences to database:', error);
            });
        }
    }

    function initializeEventListeners() {
        // Text input handlers
        if (elements.textInput) {
            elements.textInput.addEventListener('input', updateTextStats);
            elements.textInput.addEventListener('keydown', handleKeyboardShortcuts);
        }

        // Voice selection
        if (elements.voiceSelect) {
            elements.voiceSelect.addEventListener('change', handleVoiceChange);
        }

        // Slider handlers
        if (elements.rateSlider) {
            elements.rateSlider.addEventListener('input', handleRateChange);
            elements.rateSlider.addEventListener('change', () => {
                savePreferenceToDatabase({ rate: TTSState.currentSettings.rate });
            });
        }

        if (elements.pitchSlider) {
            elements.pitchSlider.addEventListener('input', handlePitchChange);
            elements.pitchSlider.addEventListener('change', () => {
                savePreferenceToDatabase({ pitch: TTSState.currentSettings.pitch });
            });
        }

        if (elements.volumeSlider) {
            elements.volumeSlider.addEventListener('input', handleVolumeChange);
            elements.volumeSlider.addEventListener('change', () => {
                savePreferenceToDatabase({ volume: TTSState.currentSettings.volume });
            });
        }

        // Control buttons
        if (elements.speakBtn) {
            elements.speakBtn.addEventListener('click', speak);
        }

        if (elements.pauseBtn) {
            elements.pauseBtn.addEventListener('click', pauseResume);
        }

        if (elements.stopBtn) {
            elements.stopBtn.addEventListener('click', stop);
        }

        if (elements.clearBtn) {
            elements.clearBtn.addEventListener('click', clearText);
        }

        // Global keyboard shortcuts
        document.addEventListener('keydown', handleGlobalKeyboardShortcuts);

        // Handle page visibility change (stop speaking when tab is hidden)
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    function loadVoices() {
        // Get available voices
        TTSState.voices = window.speechSynthesis.getVoices();
        
        if (TTSState.voices.length === 0) {
            // If no voices are available, try again after a short delay
            setTimeout(loadVoices, 100);
            return;
        }

        populateVoiceSelect();
    }

    function populateVoiceSelect() {
        if (!elements.voiceSelect) return;

        elements.voiceSelect.innerHTML = '';
        
        // Group voices by language
        const voicesByLang = {};
        TTSState.voices.forEach(voice => {
            const lang = voice.lang.split('-')[0]; // Get base language
            if (!voicesByLang[lang]) {
                voicesByLang[lang] = [];
            }
            voicesByLang[lang].push(voice);
        });

        // Create optgroups for each language
        Object.keys(voicesByLang).sort().forEach(lang => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = lang.toUpperCase();
            
            voicesByLang[lang].forEach((voice, index) => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.name} (${voice.lang})`;
                option.dataset.lang = voice.lang;
                optgroup.appendChild(option);
            });
            
            elements.voiceSelect.appendChild(optgroup);
        });

        // Set saved voice or default to first English voice
        const savedVoice = TTSState.currentSettings.voice;
        if (savedVoice && TTSState.voices.some(voice => voice.name === savedVoice)) {
            elements.voiceSelect.value = savedVoice;
        } else {
            const defaultVoice = TTSState.voices.find(voice => 
                voice.lang.startsWith('en-') && voice.default
            ) || TTSState.voices.find(voice => 
                voice.lang.startsWith('en-')
            ) || TTSState.voices[0];
            
            if (defaultVoice) {
                elements.voiceSelect.value = defaultVoice.name;
                TTSState.currentSettings.voice = defaultVoice.name;
                savePreferenceToDatabase({ voice: defaultVoice.name });
            }
        }
    }

    function handleVoiceChange() {
        const selectedVoiceName = elements.voiceSelect.value;
        TTSState.currentSettings.voice = selectedVoiceName;
        savePreferenceToDatabase({ voice: selectedVoiceName });
    }

    function handleRateChange() {
        const rate = parseFloat(elements.rateSlider.value);
        TTSState.currentSettings.rate = rate;
        if (elements.rateValue) {
            elements.rateValue.textContent = `${rate.toFixed(1)}x`;
        }
    }

    function handlePitchChange() {
        const pitch = parseFloat(elements.pitchSlider.value);
        TTSState.currentSettings.pitch = pitch;
        if (elements.pitchValue) {
            elements.pitchValue.textContent = pitch.toFixed(1);
        }
    }

    function handleVolumeChange() {
        const volume = parseFloat(elements.volumeSlider.value);
        TTSState.currentSettings.volume = volume;
        if (elements.volumeValue) {
            elements.volumeValue.textContent = `${Math.round(volume * 100)}%`;
        }
    }

    function updateTextStats() {
        const text = elements.textInput.value;
        const charCount = text.length;
        const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

        if (elements.charCount) {
            elements.charCount.textContent = charCount;
        }
        if (elements.wordCount) {
            elements.wordCount.textContent = wordCount;
        }
    }

    function speak() {
        const text = elements.textInput.value.trim();
        
        if (!text) {
            showError('Please enter some text to speak.');
            elements.textInput.focus();
            return;
        }

        // Stop any ongoing speech
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }

        // Create new utterance
        TTSState.utterance = new SpeechSynthesisUtterance(text);
        
        // Apply settings
        const selectedVoice = TTSState.voices.find(voice => voice.name === TTSState.currentSettings.voice);
        if (selectedVoice) {
            TTSState.utterance.voice = selectedVoice;
        }
        
        TTSState.utterance.rate = TTSState.currentSettings.rate;
        TTSState.utterance.pitch = TTSState.currentSettings.pitch;
        TTSState.utterance.volume = TTSState.currentSettings.volume;

        // Event handlers
        TTSState.utterance.onstart = () => {
            TTSState.isSpeaking = true;
            updateButtonStates();
            elements.speakBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Speaking...</span>';
            TTSState.isPaused = false;
        };

        TTSState.utterance.onend = () => {
            TTSState.isSpeaking = false;
            updateButtonStates();
            elements.speakBtn.innerHTML = '<i class="fas fa-play"></i><span>Speak</span>';
            elements.pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
            TTSState.isPaused = false;
        };

        TTSState.utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            TTSState.isSpeaking = false;
            updateButtonStates();
            elements.speakBtn.innerHTML = '<i class="fas fa-play"></i><span>Speak</span>';
            showError('An error occurred during speech synthesis. Please try again.');
        };

        TTSState.utterance.onpause = () => {
            TTSState.isPaused = true;
            elements.pauseBtn.innerHTML = '<i class="fas fa-play"></i><span>Resume</span>';
        };

        TTSState.utterance.onresume = () => {
            TTSState.isPaused = false;
            elements.pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
        };

        // Start speaking
        window.speechSynthesis.speak(TTSState.utterance);
    }

    function pauseResume() {
        if (!window.speechSynthesis.speaking) return;

        if (TTSState.isPaused) {
            window.speechSynthesis.resume();
            elements.pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
            TTSState.isPaused = false;
        } else {
            window.speechSynthesis.pause();
            elements.pauseBtn.innerHTML = '<i class="fas fa-play"></i><span>Resume</span>';
            TTSState.isPaused = true;
        }
    }

    function stop() {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            TTSState.isSpeaking = false;
            updateButtonStates();
            elements.speakBtn.innerHTML = '<i class="fas fa-play"></i><span>Speak</span>';
            elements.pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
            TTSState.isPaused = false;
        }
    }

    function clearText() {
        elements.textInput.value = '';
        updateTextStats();
        elements.textInput.focus();
    }

    function updateButtonStates() {
        elements.speakBtn.disabled = TTSState.isSpeaking;
        elements.pauseBtn.disabled = !TTSState.isSpeaking;
        elements.stopBtn.disabled = !TTSState.isSpeaking;
    }

    function handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Enter to speak (only when text input is focused)
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            speak();
        }
    }

    function handleGlobalKeyboardShortcuts(e) {
        // Escape to stop (works globally)
        if (e.key === 'Escape' && TTSState.isSpeaking) {
            e.preventDefault();
            stop();
        }
        
        // Ctrl/Cmd + Space to pause/resume (works globally)
        if ((e.ctrlKey || e.metaKey) && e.key === ' ' && TTSState.isSpeaking) {
            e.preventDefault();
            pauseResume();
        }
    }

    function handleVisibilityChange() {
        // Stop speaking when page becomes hidden (user switches tabs)
        if (document.hidden && TTSState.isSpeaking) {
            stop();
        }
    }

    function showError(message) {
        // Use a more user-friendly error display instead of alert
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger alert-dismissible fade show';
        errorDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Insert at the top of the TTS container
        const ttsContainer = document.querySelector('.tts-container') || document.body;
        ttsContainer.insertBefore(errorDiv, ttsContainer.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }

    function disableAllControls() {
        Object.values(elements).forEach(element => {
            if (element && element.disabled !== undefined) {
                element.disabled = true;
            }
        });
    }

    // Re-load voices when they become available
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }
});

// Utility function to speak any text (can be called from other modules)
function speakText(text, options = {}) {
    if (!('speechSynthesis' in window)) return null;

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply options or defaults
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume || 1.0;
    utterance.lang = options.lang || 'en-US';

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    window.speechSynthesis.speak(utterance);
    return utterance;
}