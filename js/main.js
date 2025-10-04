// main.js - Main JavaScript for Accessibility Translator multi-page app

// Utility to get current page filename
const currentPage = window.location.pathname.split('/').pop() || 'index.html';

// Navbar toggler and active link handling
document.addEventListener('DOMContentLoaded', () => {
  const navbarToggler = document.querySelector('.navbar-toggler');
  const navbarCollapse = document.querySelector('.navbar-collapse');
  const navItems = document.querySelectorAll('.navbar-nav .nav-item');
  const horiSelector = document.querySelector('.hori-selector');

  function updateHoriSelector() {
    const activeItem = document.querySelector('.navbar-nav .nav-item.active');
    if (!activeItem || !horiSelector) return;
    horiSelector.style.top = activeItem.offsetTop + 'px';
    horiSelector.style.left = activeItem.offsetLeft + 'px';
    horiSelector.style.height = activeItem.offsetHeight + 'px';
    horiSelector.style.width = activeItem.offsetWidth + 'px';
  }

  navbarToggler.addEventListener('click', () => {
    navbarCollapse.classList.toggle('show');
    updateHoriSelector();
  });

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
      if (navbarCollapse.classList.contains('show')) {
        navbarCollapse.classList.remove('show');
      }
      updateHoriSelector();
    });
  });

  updateHoriSelector();

  // Removed custom dropdown toggles to use Bootstrap's built-in dropdown functionality

  // Color Filter Dropdown Menu
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
    document.body.classList.remove(...colorFilters.map(f => f.value));
    document.body.classList.add(filterValue);
    if (colorFilterDropdown) colorFilterDropdown.classList.remove('show');
  }

  if (colorFilterMenu) {
    colorFilterMenu.innerHTML = '';
    colorFilters.forEach(filter => {
      const btn = document.createElement('button');
      btn.className = 'dropdown-item';
      btn.textContent = filter.label;
      btn.type = 'button';
      btn.addEventListener('click', () => applyColorFilter(filter.value));
      colorFilterMenu.appendChild(btn);
    });
  }

  // Voice Navigation Button in Navbar
  const voiceNavContainer = document.getElementById('voiceNavigationContainer');
  if (voiceNavContainer) {
    voiceNavContainer.innerHTML = `
      <button id="voiceNavBtn" class="btn d-flex align-items-center gap-2 px-3 py-2" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 500; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: all 0.3s ease;" aria-label="Start voice navigation" title="Start voice navigation">
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

    const sectionNames = {
      "index.html": "Home",
      "index.html#about": "About",
      "text-to-speech.html": "Text to Speech",
      "object-scanning.html": "Object Scanning",
      "color-filter.html": "Color Filter",
      "gallery.html": "Gallery",
      "contact.html": "Contact"
    };

    function speakMessage(message) {
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
      }
    }

    function handleVoiceCommand(command) {
      command = command.toLowerCase();
      for (const key in navigationCommands) {
        if (command.includes(key)) {
          if (navigationCommands[key] === "help") {
            speakMessage("Available voice commands: Home, About, Text to Speech, Object Scanning, Color Filter, Gallery, Contact. Say 'Help' to hear this again.");
            return;
          }
          const page = navigationCommands[key];
          if (page.includes('#')) {
            const [url, hash] = page.split('#');
            window.location.href = url + '#' + hash;
          } else {
            window.location.href = page;
          }
          speakMessage(`Navigating to ${sectionNames[page]} page.`);
          return;
        }
      }
      speakMessage("Command not recognized. Say 'Help' to hear available commands.");
    }

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        voiceNavStatus.textContent = `"${transcript}"`;
        handleVoiceCommand(transcript);
      };

      recognition.onend = () => {
        isListening = false;
        voiceNavBtn.classList.remove('btn-danger');
        voiceNavBtn.classList.add('btn-primary');
        voiceNavBtn.setAttribute('aria-label', 'Start voice navigation');
        voiceNavBtn.setAttribute('title', 'Start voice navigation');
        voiceNavStatus.textContent = '';
        if (timeoutId) clearTimeout(timeoutId);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isListening = false;
        voiceNavBtn.classList.remove('btn-danger');
        voiceNavBtn.classList.add('btn-primary');
        voiceNavStatus.textContent = '';
        speakMessage("Sorry, I didn't catch that. Please try again.");
      };
    } else {
      voiceNavBtn.style.display = 'none';
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
        voiceNavBtn.classList.remove('btn-primary');
        voiceNavBtn.classList.add('btn-danger');
        voiceNavBtn.setAttribute('aria-label', 'Stop voice navigation');
        voiceNavBtn.setAttribute('title', 'Stop voice navigation');
        voiceNavStatus.textContent = 'Listening...';
        timeoutId = setTimeout(() => {
          if (isListening) {
            recognition.stop();
            speakMessage("Voice navigation timed out. Tap the button again to try again.");
          }
        }, 5000);
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        isListening = false;
        speakMessage("Error starting voice navigation. Please try again.");
      }
    });
  }

  // Header buttons scroll (only on index.html)
  if (currentPage === 'index.html') {
    const btnGetStarted = document.getElementById('btnGetStarted');
    const btnLearnMore = document.getElementById('btnLearnMore');
    if (btnGetStarted) {
      btnGetStarted.addEventListener('click', () => {
        const el = document.getElementById('about');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    }
    if (btnLearnMore) {
      btnLearnMore.addEventListener('click', () => {
        const el = document.getElementById('about');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
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
});
