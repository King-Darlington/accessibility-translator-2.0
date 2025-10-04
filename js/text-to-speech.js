// Text-to-Speech Functionality
document.addEventListener('DOMContentLoaded', () => {
  const textInput = document.getElementById('textInput');
  const voiceSelect = document.getElementById('voiceSelect');
  const rateSlider = document.getElementById('rateSlider');
  const pitchSlider = document.getElementById('pitchSlider');
  const rateValue = document.getElementById('rateValue');
  const pitchValue = document.getElementById('pitchValue');
  const speakBtn = document.getElementById('speakBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  let voices = [];
  let utterance = null;
  let isPaused = false;
  
  // Check if Speech Synthesis is supported
  if (!('speechSynthesis' in window)) {
    alert('Sorry, your browser does not support text-to-speech.');
    return;
  }
  
  // Load available voices
  function loadVoices() {
    voices = window.speechSynthesis.getVoices();
    
    if (voices.length > 0) {
      voiceSelect.innerHTML = '';
      
      voices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${voice.name} (${voice.lang})`;
        voiceSelect.appendChild(option);
      });
      
      // Set default voice (try to find English voice)
      const defaultVoice = voices.findIndex(voice => voice.lang.startsWith('en'));
      if (defaultVoice !== -1) {
        voiceSelect.value = defaultVoice;
      }
    }
  }
  
  // Load voices on page load and when voices change
  loadVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }
  
  // Update rate value display
  rateSlider.addEventListener('input', () => {
    rateValue.textContent = `${parseFloat(rateSlider.value).toFixed(1)}x`;
  });
  
  // Update pitch value display
  pitchSlider.addEventListener('input', () => {
    pitchValue.textContent = parseFloat(pitchSlider.value).toFixed(1);
  });
  
  // Speak function
  function speak() {
    const text = textInput.value.trim();
    
    if (!text) {
      alert('Please enter some text to speak.');
      return;
    }
    
    // If already speaking, stop first
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    
    // Create new utterance
    utterance = new SpeechSynthesisUtterance(text);
    
    // Set voice
    const selectedVoice = voices[voiceSelect.value];
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    // Set rate and pitch
    utterance.rate = parseFloat(rateSlider.value);
    utterance.pitch = parseFloat(pitchSlider.value);
    
    // Event handlers
    utterance.onstart = () => {
      speakBtn.disabled = true;
      pauseBtn.disabled = false;
      stopBtn.disabled = false;
      speakBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Speaking...</span>';
      isPaused = false;
    };
    
    utterance.onend = () => {
      speakBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
      speakBtn.innerHTML = '<i class="fas fa-play"></i><span>Speak</span>';
      pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
      isPaused = false;
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      speakBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
      speakBtn.innerHTML = '<i class="fas fa-play"></i><span>Speak</span>';
      alert('An error occurred during speech synthesis.');
    };
    
    // Speak
    window.speechSynthesis.speak(utterance);
  }
  
  // Pause/Resume function
  function pauseResume() {
    if (window.speechSynthesis.speaking) {
      if (isPaused) {
        window.speechSynthesis.resume();
        pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
        isPaused = false;
      } else {
        window.speechSynthesis.pause();
        pauseBtn.innerHTML = '<i class="fas fa-play"></i><span>Resume</span>';
        isPaused = true;
      }
    }
  }
  
  // Stop function
  function stop() {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      speakBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
      speakBtn.innerHTML = '<i class="fas fa-play"></i><span>Speak</span>';
      pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
      isPaused = false;
    }
  }
  
  // Event listeners
  speakBtn.addEventListener('click', speak);
  pauseBtn.addEventListener('click', pauseResume);
  stopBtn.addEventListener('click', stop);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to speak
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      speak();
    }
    // Ctrl/Cmd + Space to pause/resume
    if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
      e.preventDefault();
      pauseResume();
    }
    // Escape to stop
    if (e.key === 'Escape') {
      e.preventDefault();
      stop();
    }
  });
});