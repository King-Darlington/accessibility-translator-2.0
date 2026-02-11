# Voice Commands Integration Guide

## Overview
This document explains how to test the enhanced voice control system with fuzzy matching and extension integration.

## Architecture

### Voice Commands Library (`js/voice_commands.js`)
- **Location**: `js/voice_commands.js` (main site) and `extension/scripts/voice_commands.js` (extension)
- **API**: Exposes `window.VoiceCommandsLib` with:
  - `matchInput(text)` - Returns best matching command with score
  - `scoreMatch(input, phrase)` - Calculates similarity score
  - `commands` - Array of all available commands

### Scoring Algorithm
- **Normalized Levenshtein Distance** (60% weight): Character-level fuzzy matching for typos
- **Token Overlap** (40% weight): Word-level matching for phrase recognition
- **Threshold**: 0.55 (tuned for accuracy)

### Available Commands

#### Navigation
- "go home", "home page", "open home"
- "settings", "preferences", "open settings"
- "contact page", "contact us"
- "text to speech", "tts"
- "object scanning", "scan objects"
- "gallery", "open gallery"

#### Text-to-Speech
- "read page", "read aloud", "start reading"
- "stop reading", "pause"
- "resume reading", "continue reading"

#### Filters
- "grayscale", "activate grayscale"
- "high contrast", "activate high contrast"
- "invert colors", "invert"
- "sepia", "apply sepia"
- "blue light filter", "reduce blue light"
- "remove filter", "clear filters"

#### Accessibility
- "increase text", "bigger text"
- "decrease text", "smaller text"
- "zoom in", "magnify"
- "zoom out"

#### Themes
- "dark mode", "enable dark mode"
- "light mode", "enable light mode"
- "high contrast" (theme mode)

#### Misc
- "help", "what can i say", "list commands"
- "sync settings", "sync with extension"
- "toggle voice control"

## Testing Instructions

### 1. Main Website Testing

#### Setup
1. Open any page on the main site (home.html, settings.html, etc.)
2. Look for the **Voice** button in the top-right navbar
3. Click to start voice control (button should turn green with "listening" animation)

#### Testing Voice Commands
1. Click the Voice button to start listening
2. Speak a command (e.g., "read page", "go home", "dark mode")
3. Check the feedback notification that appears
4. Command should execute (navigate, apply filter, read text, etc.)

#### Example Commands to Test
- **"read page"** → Starts reading the page content aloud
- **"go home"** → Navigate to home.html
- **"dark mode"** → Apply dark theme
- **"increase text"** → Increase font size
- **"help"** → Show available commands

### 2. Extension Testing

#### Installation
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Navigate to `extension/` folder in the project
5. Extension should appear in your extensions list

#### Verify Installation
1. Open any website
2. Look for the **accessibility bubble** (floating icon in bottom-right)
3. Click bubble to open menu with options:
   - Text to Speech
   - Object Scan
   - Color Filters
   - Voice Control
   - Settings

#### Testing Extension Voice Commands
1. Click extension bubble → Voice Control
2. Click "Start Listening" or use keyboard shortcut
3. Speak commands (same as main site)
4. Commands should work across any website

#### Extension Features
- **Color Filters**: Apply filters to any webpage
- **Text to Speech**: Read any webpage aloud
- **Voice Control**: Use voice commands on any site
- **Object Scanning**: Analyze images with TensorFlow.js
- **Settings Sync**: Sync preferences with main website

### 3. Settings Page Integration

#### Sync Settings
1. Go to `settings.html`
2. Enable voice control and configure:
   - Default voice
   - Speech rate, pitch, volume
   - Voice control language
3. Click "Save All Changes"
4. Go to "Extension Sync" section
5. Click "Sync with Chrome Extension"

#### Verify Sync
1. Open extension popup
2. Go to Voice Control tab
3. Settings should match what you configured on main site

### 4. Testing Fuzzy Matching

#### Test Accuracy
- **Exact**: "go home" ✓
- **With typos**: "go homee" ✓ (Levenshtein handles typos)
- **Synonyms**: "navigate home" ✓ (Token overlap handles variants)
- **Partial**: "just say read the page" ✓ (Matches "read page" within sentence)

#### Test Edge Cases
- **Long sentences**: "hey can you please read this page for me" → Should match "read page"
- **Multiple commands**: "can you darken the page and read it" → Matches "dark mode"
- **Unfamiliar phrases**: "xyz abc def" → Shows help message

### 5. Troubleshooting

#### Microphone Issues
- **"Microphone access denied"**: Grant permission when browser asks
- **"Network error"**: Check internet connection
- **No sound feedback**: Check system volume and browser audio settings

#### Command Not Recognized
1. Check console for the matched score
2. If score < 0.55, command is rejected
3. Try exact phrase from command list
4. Use "help" command to see available options

#### Extension Not Detected
1. Verify extension is loaded: `chrome://extensions/`
2. Check that content scripts are injected
3. Try refreshing the page
4. Check console for errors

#### Settings Not Syncing
1. Make sure extension has "sync" permission in manifest
2. Check chrome://sync is enabled
3. Try manual "Sync Now" button in settings
4. Clear extension storage and reload

## File Structure

```
js/
  voice_commands.js          # Shared offline command library
  voice_integration.js       # Main site voice control
  settings.js                # Enhanced with extension sync
  
extension/
  manifest.json              # v3 with permissions & scripts
  background.js              # Service worker with handlers
  content.js                 # Page integration & messaging
  scripts/
    voice_commands.js        # Copy of library for extension
    voice-control.js         # Enhanced with VoiceCommandsLib
    popup.js                 # Extension popup logic
  styles/
    popup.css                # Primary colors updated
    
settings.html               # Includes voice_integration.js
```

## Performance Notes

- **Offline**: All voice matching works offline (no server required)
- **Fuzzy Matching**: Levenshtein distance computed in O(n*m) where n,m are string lengths
- **Command Lookup**: 30+ commands checked per match (optimized with early exit)
- **Browser Support**: 
  - Chrome/Edge: Full support
  - Firefox: Partial (Web Speech API support varies)
  - Safari: Limited (some Speech Recognition issues)

## Future Enhancements

- [ ] Add more languages beyond en-US
- [ ] User-defined custom voice commands
- [ ] Machine learning-based command prediction
- [ ] Command history and learning
- [ ] Voice model training for better accuracy
- [ ] Context-aware commands (e.g., "click the first button")
- [ ] Multi-step commands (e.g., "go to settings and enable dark mode")

## API Reference

### VoiceCommandsLib.matchInput(input)
```javascript
const match = VoiceCommandsLib.matchInput("read the page");
// Returns:
{
  score: 0.92,
  command: {
    id: 'tts_read',
    phrases: ['read page', ...],
    action: 'tts',
    params: {mode: 'read'}
  },
  phrase: 'read page'
}
```

### Custom Command Execution
```javascript
const match = VoiceCommandsLib.matchInput(userInput);
if (match && match.score > 0.55) {
  const cmd = match.command;
  // Execute based on cmd.action and cmd.params
}
```

## Support & Feedback

For issues or suggestions:
1. Check console for error messages
2. Review the troubleshooting section
3. Test with exact phrases from command list
4. Report bugs with console output and browser info
