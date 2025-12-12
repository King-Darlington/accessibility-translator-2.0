# Quick Start Guide - Testing the Voice Control Extension

## 🚀 30-Second Setup

### Step 1: Load the Extension
1. Open Chrome and go to **chrome://extensions/**
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Navigate to and select the **`extension/`** folder
5. ✅ Extension should appear in your extensions list

### Step 2: Test Voice Commands
1. Click the extension icon in your browser toolbar
2. You should see the Accessibility Translator popup
3. Go to the **Voice Control** tab
4. Click **"Start Voice Control"** button
5. Say one of these commands:
   - **"read page"** - reads the current webpage
   - **"dark mode"** - applies dark theme
   - **"help"** - lists available commands

## 📱 Test on Main Website

### Navigate to Settings Page
1. Open `settings.html` in your browser (e.g., `http://localhost/xampp/htdocs/accessibility-translator-2.0/settings.html`)
2. Look for the **🎤 Voice** button in the top-right navbar
3. Click it to start voice control
4. Try commands like:
   - **"go home"** - navigate to home.html
   - **"increase text"** - increase font size
   - **"read page"** - read the settings page

### Configure Voice Settings
1. On settings.html, find the **Voice Control** section
2. Enable voice control and set:
   - Voice recognition language
   - Voice feedback option
3. Click **"Save All Changes"**
4. Try voice commands immediately

### Sync with Extension
1. In the **Extension Sync** section
2. Click **"Sync with Chrome Extension"**
3. Settings should synchronize between site and extension

## 🎯 Test Fuzzy Matching

Try these variations to test the matching algorithm:

### Exact Matches
- **"go home"** ✓ - Direct match

### Typos (Levenshtein)
- **"go homee"** ✓ - Should still match
- **"raed page"** ✓ - Should match "read page"

### Natural Language (Token Overlap)
- **"navigate home"** ✓ - Should match "go home"
- **"activate dark mode"** ✓ - Should match "dark mode"

### Partial Sentences
- **"hey can you read the page"** ✓ - Should extract "read page"
- **"please go home for me"** ✓ - Should match "go home"

### Listen to Feedback
After each command, you should hear/see feedback:
- ✅ **Success**: "Command executed" + action happens
- ❌ **Error**: "Command not recognized" message
- ℹ️ **Info**: Notification with command details

## 🔧 Debugging

### Check Loading Status
Open browser console (F12) and look for:
```
🎤 Accessibility Translator - Voice Control Loader
✅ Voice Commands Library loaded
✅ Voice Integration loaded
✅ Extension detected
```

### Test Matching Directly
In browser console:
```javascript
// Test voice command matching
VoiceControlDebug.testMatch("read the page");

// Should output:
// Input: "read the page"
// Match: { score: 0.92, command: {...}, phrase: 'read page' }
```

### List All Commands
In browser console:
```javascript
VoiceControlDebug.listCommands();
// Shows all 30+ available commands
```

### Manual Voice Control
In browser console:
```javascript
VoiceControlDebug.startVoice();   // Start listening
VoiceControlDebug.stopVoice();    // Stop listening
VoiceControlDebug.getStatus();    // Check status
```

## 📊 Command Categories

### Navigation (6 commands)
```
go home, home page, open home, navigate home
settings, preferences, open settings, open preferences
contact page, contact us
text to speech, tts
object scanning, scan objects
gallery, open gallery
```

### Text-to-Speech (3 commands)
```
read page, read aloud, start reading
stop reading, pause reading, pause
resume reading, continue reading
```

### Filters (6 commands)
```
grayscale, activate grayscale
high contrast, activate high contrast
invert colors, invert
sepia, apply sepia
blue light filter, reduce blue light
remove filter, clear filters, reset filter
```

### Accessibility (4 commands)
```
increase text, bigger text, zoom text
decrease text, smaller text, reduce text
zoom in, magnify, increase zoom
zoom out, decrease zoom
```

### Themes (3 commands)
```
dark mode, enable dark mode
light mode, enable light mode
high contrast (theme mode)
```

### Miscellaneous
```
help, what can i say, list commands
sync settings, sync with extension
open extension, open tools
toggle voice control, enable voice control
```

## 🐛 Troubleshooting

### Microphone Not Working
- [ ] Check browser permissions: Settings → Privacy → Microphone
- [ ] Allow microphone access when prompted
- [ ] Restart browser and try again
- [ ] Check system microphone is working

### Commands Not Recognized
- [ ] Say commands slowly and clearly
- [ ] Try exact phrases from the command list
- [ ] Check browser console for error messages
- [ ] Use `VoiceControlDebug.testMatch()` to test matching

### Extension Not Showing
- [ ] Go to `chrome://extensions/`
- [ ] Make sure Developer mode is ON
- [ ] Ensure extension loaded from correct folder
- [ ] Try refreshing the page

### Settings Not Syncing
- [ ] Check chrome://sync is enabled
- [ ] Click "Sync Now" button manually
- [ ] Check browser console for errors
- [ ] Verify extension has storage permission

### Voice Button Not Appearing
- [ ] Check that voice_integration.js loaded (F12 console)
- [ ] Verify voiceNavigationContainer element exists
- [ ] Check for JavaScript errors in console
- [ ] Try hard refresh (Ctrl+Shift+R)

## 📋 Feature Checklist

### Main Site Features
- [ ] Voice button appears in navbar
- [ ] Voice commands work on any page
- [ ] Settings page synchronizes with extension
- [ ] Color filters apply correctly
- [ ] Text-to-speech reads page
- [ ] Fuzzy matching works (try typos)

### Extension Features
- [ ] Extension loads from chrome://extensions
- [ ] Popup opens when clicking extension icon
- [ ] Voice Control tab is accessible
- [ ] Color filters apply to any website
- [ ] Text-to-speech works on any site
- [ ] Settings sync with main site

### Integration Features
- [ ] Extension detects when site is open
- [ ] Site detects when extension is installed
- [ ] Settings can be synced between site and extension
- [ ] Voice commands work on both site and extension
- [ ] Theme changes apply across both

## 💡 Pro Tips

1. **Test with exact phrases first**, then try variations
2. **Check console** (F12) for detailed matching information
3. **Use "help" command** to hear available options
4. **Enable browser microphone** for all websites
5. **Test on different pages** to verify compatibility

## 📞 Getting Help

If something doesn't work:
1. Check the **VOICE_COMMANDS_GUIDE.md** for detailed documentation
2. Review **IMPLEMENTATION_SUMMARY.md** for architecture details
3. Check browser console (F12) for error messages
4. Use `VoiceControlDebug` utilities for testing
5. Verify all files are in correct locations

## 🎉 You're Ready!

The system is now fully operational. Try these in order:
1. Load extension from `chrome://extensions`
2. Visit a webpage
3. Click extension icon → Voice Control tab
4. Click "Start Voice Control"
5. Say **"read page"**
6. Extension should read the page aloud

**That's it! Enjoy the voice-controlled accessibility features! 🎤**
