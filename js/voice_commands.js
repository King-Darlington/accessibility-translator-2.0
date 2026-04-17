/*
  Voice Commands Library
  - Exposes a global `VoiceCommandsLib` object with a large offline command set
  - Provides `matchInput(text)` to return the best matching command and score
  - Uses a combined normalized Levenshtein + token overlap scoring for fuzzy matching
*/
(function(window){
  'use strict';

  // Simple normalized Levenshtein distance
  function levenshtein(a, b) {
    if (!a || !b) return (a === b) ? 0 : Math.max(a.length, b.length);
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i-1) === a.charAt(j-1)) matrix[i][j] = matrix[i-1][j-1];
        else matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, Math.min(matrix[i][j-1] + 1, matrix[i-1][j] + 1));
      }
    }
    return matrix[b.length][a.length];
  }

  function normalizedLevenshtein(a, b) {
    const dist = levenshtein(a, b);
    return 1 - dist / Math.max(a.length, b.length, 1);
  }

  function tokenOverlapScore(a, b) {
    const aw = a.split(/\s+/).filter(Boolean);
    const bw = b.split(/\s+/).filter(Boolean);
    if (aw.length === 0 || bw.length === 0) return 0;
    const match = aw.filter(x => bw.includes(x)).length;
    return match / Math.max(aw.length, bw.length);
  }

  // Scoring: weighted combination
  function scoreMatch(input, phrase) {
    input = input.toLowerCase();
    phrase = phrase.toLowerCase();
    const nlev = normalizedLevenshtein(input, phrase);
    const overlap = tokenOverlapScore(input, phrase);
    // prefer token overlap but also allow fuzzy levenshtein
    return Math.max(nlev * 0.6 + overlap * 0.4, overlap * 0.9);
  }

  // Command definitions: each command has id, phrases[], action, and optional params
  const commands = [
    // Navigation
    { id: 'goto_home', phrases: ['go home','home page','open home','navigate home'], action: 'navigate', params: {target: 'home'} },
    { id: 'goto_settings', phrases: ['open settings','settings','preferences','open preferences'], action: 'navigate', params: {target: 'settings'} },
    { id: 'goto_contact', phrases: ['contact page','contact us','open contact'], action: 'navigate', params: {target: 'contact'} },
    { id: 'goto_tts', phrases: ['text to speech','tts','open text to speech','open tts'], action: 'navigate', params: {target: 'text-to-speech'} },
    { id: 'goto_object_scanning', phrases: ['object scanning','scan objects','open object scanning','start scanning'], action: 'navigate', params: {target: 'object-scanning'} },
    { id: 'goto_gallery', phrases: ['gallery','open gallery','show gallery'], action: 'navigate', params: {target: 'gallery'} },

    // Text-to-speech control
    { id: 'tts_read', phrases: ['read page','read aloud','read this page','read the page aloud','start reading'], action: 'tts', params: {mode: 'read'} },
    { id: 'tts_stop', phrases: ['stop reading','stop','pause reading','pause'], action: 'tts', params: {mode: 'stop'} },
    { id: 'tts_resume', phrases: ['resume reading','continue reading'], action: 'tts', params: {mode: 'resume'} },

    // Scanning
    { id: 'scan_page', phrases: ['scan page','scan this page','start page scan','scan for objects'], action: 'scan', params: {scope: 'page'} },
    { id: 'scan_image', phrases: ['scan image','describe image','describe photo','what is in this image'], action: 'scan', params: {scope: 'image'} },

    // Filters
    { id: 'filter_grayscale', phrases: ['grayscale','activate grayscale','apply grayscale','turn on grayscale'], action: 'filter', params: {filter:'grayscale'} },
    { id: 'filter_high_contrast', phrases: ['high contrast','activate high contrast','apply high contrast'], action: 'filter', params: {filter:'high-contrast'} },
    { id: 'filter_invert', phrases: ['invert colors','invert','activate invert'], action: 'filter', params: {filter:'invert'} },
    { id: 'filter_sepia', phrases: ['sepia','apply sepia'], action: 'filter', params: {filter:'sepia'} },
    { id: 'filter_blue_light', phrases: ['blue light filter','reduce blue light','apply blue light'], action: 'filter', params: {filter:'blue-light'} },
    { id: 'filter_none', phrases: ['remove filter','clear filters','reset filter','no filter'], action: 'filter', params: {filter:null} },

    // Accessibility adjustments
    { id: 'increase_text', phrases: ['increase text','bigger text','zoom text','increase font size','make text larger'], action: 'accessibility', params: {cmd:'increaseText'} },
    { id: 'decrease_text', phrases: ['decrease text','smaller text','reduce text','decrease font size'], action: 'accessibility', params: {cmd:'decreaseText'} },
    { id: 'zoom_in', phrases: ['zoom in','increase zoom','magnify'], action: 'accessibility', params: {cmd:'zoomIn'} },
    { id: 'zoom_out', phrases: ['zoom out','decrease zoom','zoom out please'], action: 'accessibility', params: {cmd:'zoomOut'} },

    // Theme
    { id: 'theme_dark', phrases: ['dark mode','enable dark mode','switch to dark'], action: 'theme', params: {theme:'dark'} },
    { id: 'theme_light', phrases: ['light mode','enable light mode','switch to light'], action: 'theme', params: {theme:'light'} },
    { id: 'theme_contrast', phrases: ['high contrast','enable high contrast','contrast mode'], action: 'theme', params: {theme:'high-contrast'} },

    // Help and misc
    { id: 'help', phrases: ['help','what can i say','list commands','available commands'], action: 'help', params: {} },
    { id: 'settings_sync', phrases: ['sync settings','sync with extension','sync now'], action: 'sync', params: {} },
    { id: 'open_extension', phrases: ['open extension','open tools','open accessibility tools'], action: 'extension', params: {cmd:'open'} },
    { id: 'toggle_voice', phrases: ['toggle voice control','enable voice control','disable voice control','start voice control','stop voice control'], action: 'voice', params: {} }
  ];

  function matchInput(input) {
    console.log('🔍 matchInput() called with input:', input);
    
    if (!input || typeof input !== 'string') {
      console.log('🔍 Invalid input, returning null');
      return null;
    }
    
    input = input.trim().toLowerCase();
    console.log('🔍 Normalized input:', input);
    console.log('🔍 Total commands to check:', commands.length);
    
    let best = {score: 0, command: null, phrase: null};
    let totalPhrasesChecked = 0;

    for (const cmd of commands) {
      for (const phrase of cmd.phrases) {
        totalPhrasesChecked++;
        const s = scoreMatch(input, phrase);
        
        // Log all matches above 0.5
        if (s > 0.5) {
          console.log(`  [${s.toFixed(2)}] "${phrase}" (command: ${cmd.id})`);
        }
        
        if (s > best.score) {
          best = { score: s, command: cmd, phrase };
        }
      }
    }

    console.log('🔍 Total phrases checked:', totalPhrasesChecked);
    console.log('🔍 Best match score:', best.score.toFixed(2));
    console.log('🔍 Best match phrase:', best.phrase);
    console.log('🔍 Best match command:', best.command?.id);

    return best.command ? { score: best.score, command: best.command, phrase: best.phrase } : null;
  }

  // Expose global
  window.VoiceCommandsLib = {
    commands: commands,
    matchInput: matchInput,
    scoreMatch: scoreMatch
  };

  console.log('✅ VoiceCommandsLib loaded! Available commands:', commands.length);
  console.log('   - Commands:', commands.map(c => c.id).join(', '));

})(window);
