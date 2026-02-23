// main.js - Main JavaScript for Accessibility Translator multi-page app

// Utility to get current page filename
const currentPage = window.location.pathname.split('/').pop() || 'index.html';

// Global state management
const AppState = {
    currentColorFilter: 'normal',
    isVoiceNavActive: false,
    speechSynthesis: window.speechSynthesis || null
};

// Navbar toggler and active link handling
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeColorFilters();
    initializeVoiceNavigation();
    initializePageSpecificFeatures();
});

function initializeNavigation() {
    const navbarToggler = document.querySelector('.navbar-toggler');
    const navbarCollapse = document.querySelector('.navbar-collapse');
    const navItems = document.querySelectorAll('.navbar-nav .nav-item');
    const horiSelector = document.querySelector('.hori-selector');

    function updateHoriSelector() {
        const activeItem = document.querySelector('.navbar-nav .nav-item.active');
        if (!activeItem || !horiSelector) return;
        
        horiSelector.style.top = `${activeItem.offsetTop}px`;
        horiSelector.style.left = `${activeItem.offsetLeft}px`;
        horiSelector.style.height = `${activeItem.offsetHeight}px`;
        horiSelector.style.width = `${activeItem.offsetWidth}px`;
    }

    // Navbar toggler for mobile
    if (navbarToggler && navbarCollapse) {
        navbarToggler.addEventListener('click', () => {
            navbarCollapse.classList.toggle('show');
            setTimeout(updateHoriSelector, 300); // Wait for collapse animation
        });
    }

    // Set active navigation item based on current page
    navItems.forEach(item => {
        const link = item.querySelector('a');
        if (link) {
            const href = link.getAttribute('href');
            if (href === currentPage || (currentPage === 'index.html' && href === 'index.html')) {
                item.classList.add('active');
            }
        }

        // Only add click listener to non-dropdown nav items
        if (!item.classList.contains('dropdown')) {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                const link = item.querySelector('a');
                if (link && link.getAttribute('href')) {
                    const href = link.getAttribute('href');
                    if (href && href !== '#') {
                        window.location.href = href;
                    }
                }

                if (navbarCollapse && navbarCollapse.classList.contains('show')) {
                    navbarCollapse.classList.remove('show');
                }
                updateHoriSelector();
            });
        }
    });

    updateHoriSelector();
    window.addEventListener('resize', updateHoriSelector);
}

function initializeColorFilters() {
    const colorFilters = [
        { id: 1, label: "Normal", value: "normal" },
        { id: 2, label: "Invert", value: "invert" },
        { id: 3, label: "Grayscale", value: "grayscale" },
        { id: 4, label: "High Contrast", value: "high-contrast" },
        { id: 5, label: "High Contrast (Black)", value: "high-contrast-black" },
        { id: 6, label: "High Contrast (White)", value: "high-contrast-white" },
        { id: 7, label: "Sepia", value: "sepia" },
        { id: 8, label: "Dark Mode", value: "dark-mode" },
    ];

    const colorFilterMenu = document.getElementById('colorFilterMenu');

    function applyColorFilter(filterValue) {
        // Remove all filter classes
        document.body.classList.remove(...colorFilters.map(f => f.value));
        
        // Apply new filter
        document.body.classList.add(filterValue);
        AppState.currentColorFilter = filterValue;
        
        // Save to localStorage
        localStorage.setItem('colorFilter', filterValue);
        
        // Close dropdown if exists
        const colorFilterDropdown = document.querySelector('.dropdown-menu.show');
        if (colorFilterDropdown) {
            colorFilterDropdown.classList.remove('show');
        }
    }

    // Load saved filter
    const savedFilter = localStorage.getItem('colorFilter');
    if (savedFilter) {
        applyColorFilter(savedFilter);
    }

    if (colorFilterMenu) {
        colorFilterMenu.innerHTML = '';
        colorFilters.forEach(filter => {
            const btn = document.createElement('button');
            btn.className = `dropdown-item ${AppState.currentColorFilter === filter.value ? 'active' : ''}`;
            btn.textContent = filter.label;
            btn.type = 'button';
            btn.addEventListener('click', () => applyColorFilter(filter.value));
            colorFilterMenu.appendChild(btn);
        });
    }
}

function initializeVoiceNavigation() {
    const voiceNavContainer = document.getElementById('voiceNavigationContainer');
    if (!voiceNavContainer) return;

    voiceNavContainer.innerHTML = `
        <button id="voiceNavBtn" class="btn d-flex align-items-center gap-2 px-3 py-2" 
                style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color: white; border: solid #ffffff9d; border-radius: 8px; font-weight: 500; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: all 0.3s ease;" 
                aria-label="Start voice navigation" 
                title="Start voice navigation">
            <i class="fas fa-microphone" style="font-size: 1rem;"></i>
            <span>Voice Nav</span>
        </button>
        <div id="voiceNavStatus" class="mt-1 text-center" style="font-size: 0.75rem; color: white;"></div>
    `;

    const voiceNavBtn = document.getElementById('voiceNavBtn');
    const voiceNavStatus = document.getElementById('voiceNavStatus');
    let recognition = null;
    let isListening = false;

    function executeVoiceCommand(cmdObj) {
        if (!cmdObj || !cmdObj.action) return;

        switch (cmdObj.action) {
            case 'navigate':
                if (cmdObj.params && cmdObj.params.target) {
                    const targetMap = {
                        'home': 'index.html',
                        'contact': 'contact.html',
                        'text-to-speech': 'text-to-speech.html',
                        'object-scanning': 'object-scanning.html',
                        'gallery': 'gallery.html',
                        'settings': 'settings.html'
                    };
                    const url = targetMap[cmdObj.params.target];
                    if (url) {
                        window.location.href = url;
                    }
                }
                break;

            case 'filter':
                if (cmdObj.params && cmdObj.params.filter) {
                    applyColorFilter(cmdObj.params.filter || 'normal');
                }
                break;

            case 'tts':
                if (cmdObj.params.mode === 'read') {
                    // Trigger TTS reading
                    window.postMessage({ type: 'AT_TRIGGER_FEATURE', feature: 'tts' }, '*');
                } else if (cmdObj.params.mode === 'stop') {
                    window.postMessage({ type: 'AT_TRIGGER_FEATURE', feature: 'stop-tts' }, '*');
                    AppState.speechSynthesis?.cancel();
                }
                break;

            case 'accessibility':
                switch (cmdObj.params.cmd) {
                    case 'increaseText':
                        document.body.style.fontSize = (parseFloat(window.getComputedStyle(document.body).fontSize) * 1.1) + 'px';
                        break;
                    case 'decreaseText':
                        document.body.style.fontSize = (parseFloat(window.getComputedStyle(document.body).fontSize) / 1.1) + 'px';
                        break;
                    case 'zoomIn':
                        document.body.style.transform = `scale(${(parseFloat(window.getComputedStyle(document.body).transform.match(/[\d.]+/) || 1) * 1.1)})`;
                        break;
                }
                break;

            case 'theme':
                if (cmdObj.params && cmdObj.params.theme) {
                    document.body.setAttribute('data-theme', cmdObj.params.theme);
                    localStorage.setItem('theme', cmdObj.params.theme);
                }
                break;

            case 'help':
                console.log('Help command - use voice_integration.js for command listing');
                break;
        }
    }

    function handleVoiceInput(transcript) {
        // Try to use VoiceCommandsLib for advanced matching
        try {
            if (window.VoiceCommandsLib && typeof window.VoiceCommandsLib.matchInput === 'function') {
                const match = window.VoiceCommandsLib.matchInput(transcript);
                if (match && match.score >= 0.55) {
                    executeVoiceCommand(match.command);
                    return;
                }
            }
        } catch (err) {
            console.warn('VoiceCommandsLib error:', err);
        }

        // Command not recognized - let voice_integration.js handle feedback
        console.log('Command not recognized:', transcript);
    }

    function startListening() {
        if (!recognition) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.warn('Speech recognition not supported in your browser');
                return;
            }
            
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                isListening = true;
                voiceNavBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                voiceNavStatus.textContent = 'Listening...';
            };

            recognition.onresult = (event) => {
                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript;
                }

                if (event.isFinal) {
                    handleVoiceInput(transcript);
                }
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                voiceNavStatus.textContent = 'Error: ' + event.error;
            };

            recognition.onend = () => {
                isListening = false;
                voiceNavBtn.style.background = 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)';
                voiceNavStatus.textContent = '';
            };
        }

        recognition.start();
    }

    voiceNavBtn.addEventListener('click', () => {
        if (isListening) {
            recognition?.stop();
            isListening = false;
        } else {
            startListening();
        }
    });
}

function initializePageSpecificFeatures() {
    // Header buttons scroll (only on index.html)
    if (currentPage === 'index.html') {
        const btnGetStarted = document.getElementById('btnGetStarted');
        const btnLearnMore = document.getElementById('btnLearnMore');

        if (btnGetStarted) {
            btnGetStarted.addEventListener('click', () => {
                const aboutSection = document.getElementById('about');
                if (aboutSection) {
                    aboutSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }

        if (btnLearnMore) {
            btnLearnMore.addEventListener('click', () => {
                const aboutSection = document.getElementById('about');
                if (aboutSection) {
                    aboutSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }

        // Arrow Navigation Buttons
        const scrollUpBtn = document.getElementById('scrollUpBtn');
        const scrollDownBtn = document.getElementById('scrollDownBtn');

        if (scrollUpBtn) {
            scrollUpBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        if (scrollDownBtn) {
            scrollDownBtn.addEventListener('click', () => {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            });
        }
    }

    // Settings button functionality (if element exists)
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // If already on settings page, scroll to top of settings content
            if (currentPage === 'settings.html') {
                const settingsHeader = document.querySelector('.settings-header');
                if (settingsHeader) {
                    settingsHeader.scrollIntoView({ behavior: 'smooth' });
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } else {
                // Navigate to settings page from other pages
                window.location.href = 'settings.html';
            }
        });
    }
}

// Utility function for speaking text
function speakText(text, rate = 0.9, pitch = 1, volume = 0.8) {
    if (AppState.speechSynthesis) {
        AppState.speechSynthesis.cancel(); // Stop any ongoing speech
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = volume;
        
        AppState.speechSynthesis.speak(utterance);
        return utterance;
    }
    return null;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppState, speakText };
}

