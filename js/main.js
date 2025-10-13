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

        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const link = item.querySelector('a').getAttribute('href');
            if (link) {
                window.location.href = link;
            }
            
            if (navbarCollapse && navbarCollapse.classList.contains('show')) {
                navbarCollapse.classList.remove('show');
            }
            updateHoriSelector();
        });
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
                style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: solid #ffffff9d; border-radius: 8px; font-weight: 500; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: all 0.3s ease;" 
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
    let timeoutId = null;

    const navigationCommands = {
        "home": "index.html",
        "about": "index.html#about",
        "text to speech": "text-to-speech.html",
        "text-to-speech": "text-to-speech.html",
        "tts": "text-to-speech.html",
        "object scanning": "object-scanning.html",
        "object-scanning": "object-scanning.html",
        "scan": "object-scanning.html",
        "scanning": "object-scanning.html",
        "color filter": "color-filter.html",
        "color-filter": "color-filter.html",
        "gallery": "gallery.html",
        "contact": "contact.html",
        "help": "help"
    };

    function speakMessage(message) {
        if (AppState.speechSynthesis) {
            // Cancel any ongoing speech
            AppState.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.volume = 0.8;
            AppState.speechSynthesis.speak(utterance);
        }
    }

    function handleVoiceCommand(command) {
        command = command.toLowerCase().trim();
        
        // Help command
        if (command === 'help') {
            const availableCommands = Object.keys(navigationCommands)
                .filter(cmd => cmd !== 'help')
                .join(', ');
            speakMessage(`Available voice commands: ${availableCommands}. Say 'Help' to hear this again.`);
            return;
        }

        // Find matching command
        for (const [key, page] of Object.entries(navigationCommands)) {
            if (command.includes(key)) {
                if (page === "help") {
                    speakMessage("Available voice commands: Home, About, Text to Speech, Object Scanning, Color Filter, Gallery, Contact. Say 'Help' to hear this again.");
                    return;
                }
                
                speakMessage(`Navigating to ${key} page.`);
                setTimeout(() => {
                    if (page.includes('#')) {
                        const [url, hash] = page.split('#');
                        window.location.href = `${url}#${hash}`;
                    } else {
                        window.location.href = page;
                    }
                }, 1000);
                return;
            }
        }
        
        speakMessage("Command not recognized. Say 'Help' to hear available commands.");
    }

    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.trim();
            voiceNavStatus.textContent = `Heard: "${transcript}"`;
            handleVoiceCommand(transcript);
        };

        recognition.onend = () => {
            isListening = false;
            AppState.isVoiceNavActive = false;
            voiceNavBtn.classList.remove('btn-danger');
            voiceNavBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            voiceNavBtn.setAttribute('aria-label', 'Start voice navigation');
            voiceNavBtn.setAttribute('title', 'Start voice navigation');
            
            setTimeout(() => {
                voiceNavStatus.textContent = '';
            }, 3000);
            
            if (timeoutId) clearTimeout(timeoutId);
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isListening = false;
            AppState.isVoiceNavActive = false;
            voiceNavBtn.classList.remove('btn-danger');
            voiceNavBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            voiceNavStatus.textContent = 'Error listening. Try again.';
            speakMessage("Sorry, I didn't catch that. Please try again.");
        };
    } else {
        voiceNavBtn.style.display = 'none';
        voiceNavStatus.textContent = 'Voice navigation not supported';
    }

    voiceNavBtn.addEventListener('click', () => {
        if (!recognition) {
            speakMessage("Voice navigation is not supported in your browser.");
            return;
        }

        if (isListening) {
            recognition.stop();
            return;
        }

        try {
            recognition.start();
            isListening = true;
            AppState.isVoiceNavActive = true;
            voiceNavBtn.classList.add('btn-danger');
            voiceNavBtn.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
            voiceNavBtn.setAttribute('aria-label', 'Stop voice navigation');
            voiceNavBtn.setAttribute('title', 'Stop voice navigation');
            voiceNavStatus.textContent = 'Listening... Speak now';
            
            timeoutId = setTimeout(() => {
                if (isListening) {
                    recognition.stop();
                    speakMessage("Voice navigation timed out. Tap the button again to try again.");
                }
            }, 10000); // Increased to 10 seconds
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            isListening = false;
            AppState.isVoiceNavActive = false;
            speakMessage("Error starting voice navigation. Please try again.");
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

    // Logout functionality (if element exists)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const response = await fetch('auth/logout.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Remove user data from local storage
                    localStorage.removeItem('user');
                    localStorage.removeItem('colorFilter');
                    
                    // Redirect to login page
                    window.location.href = 'index.html';
                } else {
                    console.error('Logout failed:', data.message);
                    alert('Logout failed. Please try again.');
                }
            } catch (error) {
                console.error('Logout failed:', error);
                alert('Logout failed. Please check your connection.');
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

