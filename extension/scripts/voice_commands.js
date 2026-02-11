/* Extension copy of Voice Commands Library (same API as js/voice_commands.js) */
(function(window){
  'use strict';

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

  function scoreMatch(input, phrase) {
    input = input.toLowerCase();
    phrase = phrase.toLowerCase();
    const nlev = normalizedLevenshtein(input, phrase);
    const overlap = tokenOverlapScore(input, phrase);
    return Math.max(nlev * 0.6 + overlap * 0.4, overlap * 0.9);
  }

  const commands = [
    { id: 'goto_home', phrases: ['go home','home page','open home','navigate home'], action: 'navigate', params: {target: 'home'} },
    { id: 'goto_settings', phrases: ['open settings','settings','preferences','open preferences'], action: 'navigate', params: {target: 'settings'} },
    { id: 'goto_contact', phrases: ['contact page','contact us','open contact'], action: 'navigate', params: {target: 'contact'} },
    { id: 'goto_tts', phrases: ['text to speech','tts','open text to speech','open tts'], action: 'navigate', params: {target: 'text-to-speech'} },
    { id: 'goto_object_scanning', phrases: ['object scanning','scan objects','open object scanning','start scanning'], action: 'navigate', params: {target: 'object-scanning'} },
    { id: 'goto_gallery', phrases: ['gallery','open gallery','show gallery'], action: 'navigate', params: {target: 'gallery'} },

    { id: 'tts_read', phrases: ['read page','read aloud','read this page','read the page aloud','start reading'], action: 'tts', params: {mode: 'read'} },
    { id: 'tts_stop', phrases: ['stop reading','stop','pause reading','pause'], action: 'tts', params: {mode: 'stop'} },
    { id: 'tts_resume', phrases: ['resume reading','continue reading'], action: 'tts', params: {mode: 'resume'} },

    { id: 'scan_page', phrases: ['scan page','scan this page','start page scan','scan for objects'], action: 'scan', params: {scope: 'page'} },
    { id: 'scan_image', phrases: ['scan image','describe image','describe photo','what is in this image'], action: 'scan', params: {scope: 'image'} },

    { id: 'filter_grayscale', phrases: ['grayscale','activate grayscale','apply grayscale','turn on grayscale'], action: 'filter', params: {filter:'grayscale'} },
    { id: 'filter_high_contrast', phrases: ['high contrast','activate high contrast','apply high contrast'], action: 'filter', params: {filter:'high-contrast'} },
    { id: 'filter_invert', phrases: ['invert colors','invert','activate invert'], action: 'filter', params: {filter:'invert'} },
    { id: 'filter_sepia', phrases: ['sepia','apply sepia'], action: 'filter', params: {filter:'sepia'} },
    { id: 'filter_blue_light', phrases: ['blue light filter','reduce blue light','apply blue light'], action: 'filter', params: {filter:'blue-light'} },
    { id: 'filter_none', phrases: ['remove filter','clear filters','reset filter','no filter'], action: 'filter', params: {filter:null} },

    { id: 'increase_text', phrases: ['increase text','bigger text','zoom text','increase font size','make text larger'], action: 'accessibility', params: {cmd:'increaseText'} },
    { id: 'decrease_text', phrases: ['decrease text','smaller text','reduce text','decrease font size'], action: 'accessibility', params: {cmd:'decreaseText'} },
    { id: 'zoom_in', phrases: ['zoom in','increase zoom','magnify'], action: 'accessibility', params: {cmd:'zoomIn'} },
    { id: 'zoom_out', phrases: ['zoom out','decrease zoom','zoom out please'], action: 'accessibility', params: {cmd:'zoomOut'} },

    { id: 'theme_dark', phrases: ['dark mode','enable dark mode','switch to dark'], action: 'theme', params: {theme:'dark'} },
    { id: 'theme_light', phrases: ['light mode','enable light mode','switch to light'], action: 'theme', params: {theme:'light'} },
    { id: 'theme_contrast', phrases: ['high contrast','enable high contrast','contrast mode'], action: 'theme', params: {theme:'high-contrast'} },

    { id: 'help', phrases: ['help','what can i say','list commands','available commands'], action: 'help', params: {} },
    { id: 'settings_sync', phrases: ['sync settings','sync with extension','sync now'], action: 'sync', params: {} },
    { id: 'open_extension', phrases: ['open extension','open tools','open accessibility tools'], action: 'extension', params: {cmd:'open'} },
    { id: 'toggle_voice', phrases: ['toggle voice control','enable voice control','disable voice control','start voice control','stop voice control'], action: 'voice', params: {} }
  ];

  function matchInput(input) {
    if (!input || typeof input !== 'string') return null;
    input = input.trim().toLowerCase();
    let best = {score: 0, command: null, phrase: null};

    for (const cmd of commands) {
      for (const phrase of cmd.phrases) {
        const s = scoreMatch(input, phrase);
        if (s > best.score) {
          best = { score: s, command: cmd, phrase };
        }
      }
    }

    return best.command ? { score: best.score, command: best.command, phrase: best.phrase } : null;
  }

  window.VoiceCommandsLib = {
    commands: commands,
    matchInput: matchInput,
    scoreMatch: scoreMatch
  };

  function scoreMatch(input, phrase) {
    return (function(){
      input = input.toLowerCase();
      phrase = phrase.toLowerCase();
      const nlev = normalizedLevenshtein(input, phrase);
      const overlap = tokenOverlapScore(input, phrase);
      return Math.max(nlev * 0.6 + overlap * 0.4, overlap * 0.9);
    })();
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

})(window);
