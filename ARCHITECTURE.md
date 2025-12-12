# Architecture & Development Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MAIN WEBSITE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Settings.html / Home.html / Any Page                            │
│  ├─ voice_commands.js (Library)                                  │
│  ├─ voice_integration.js (Main Integration)                      │
│  ├─ voice_loader.js (Debug Tools)                                │
│  └─ js/settings.js (Extension Sync)                              │
│                                                                   │
│  Web Speech API ←→ VoiceIntegration ←→ VoiceCommandsLib          │
│       ↓                    ↓                                      │
│   [Browser]          [Command Matching]                          │
│                          ↓                                        │
│              ┌───────────────────────┐                          │
│              │  Fuzzy Match Engine   │                          │
│              │  ├─ Levenshtein (60%) │                          │
│              │  └─ Token Overlap (40%)│                          │
│              └───────────────────────┘                          │
│                          ↓                                        │
│              Command Execution (30+ types)                       │
│              ├─ Navigate                                         │
│              ├─ Filter                                           │
│              ├─ TTS                                              │
│              ├─ Theme                                            │
│              └─ Accessibility                                    │
│                                                                   │
│  ↔ Window.postMessage (←→ Extension Bridge)                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                            ↑↓
┌─────────────────────────────────────────────────────────────────┐
│                    CHROME EXTENSION                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  manifest.json (v3) ←→ background.js (Service Worker)            │
│                             ↓                                     │
│                    Message Router                                │
│                  ├─ applyFilter                                  │
│                  ├─ speakText                                    │
│                  ├─ syncSettings                                 │
│                  ├─ applyTheme                                   │
│                  └─ accessibilityCommand                         │
│                             ↓                                     │
│  ┌─────────────────────────────────┐                            │
│  │  content.js (Content Script)    │                            │
│  │  ├─ voice_commands.js (Library) │                            │
│  │  ├─ voice-control.js (Handler)  │                            │
│  │  └─ Window.postMessage Bridge   │                            │
│  └─────────────────────────────────┘                            │
│             ↓                                                     │
│  popup.html (Extension Popup)                                    │
│  ├─ popup.js (UI Controller)                                     │
│  ├─ tts.js (Text-to-Speech)                                      │
│  ├─ color-filters.js (Filter Logic)                              │
│  ├─ object-scanning.js (Image Scanning)                          │
│  └─ voice-control.js (Voice Handler)                             │
│                                                                   │
│  styles/popup.css (Primary Colors)                               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

### Voice Command Flow
```
User speaks:
  "read the page"
    ↓
Web Speech API (Browser)
  [Speech Recognition]
    ↓
voice_integration.js
  processVoiceCommand()
    ↓
VoiceCommandsLib.matchInput()
  Fuzzy matching (Levenshtein + Token Overlap)
    ↓
Match Result:
  score: 0.92
  command: { id: 'tts_read', action: 'tts', params: {mode: 'read'} }
    ↓
executeCommand()
  [Read Page Text]
    ↓
speechSynthesis.speak()
  [Browser TTS]
    ↓
User hears: Page content read aloud
```

### Extension-to-Site Sync Flow
```
Main Site Settings Change
    ↓
settings.js save()
    ↓
chrome.runtime.sendMessage({
  action: 'syncSettings',
  settings: {...}
})
    ↓
background.js handleMessage()
  saveSettings()
    ↓
chrome.storage.sync.set()
    ↓
Storage Updated
    ↓
notifyContentScripts()
    ↓
All tabs receive:
  storageUpdated event
    ↓
Settings applied across all pages
```

## Key Components

### 1. VoiceCommandsLib (voice_commands.js)
**Purpose**: Centralized command library with fuzzy matching
**Location**: `js/voice_commands.js`, `extension/scripts/voice_commands.js`
**Key Functions**:
- `matchInput(text)` - Returns best match with score
- `scoreMatch(input, phrase)` - Calculates similarity
- `commands` array - 30+ command definitions

**Command Structure**:
```javascript
{
  id: 'unique_id',
  phrases: ['phrase1', 'phrase2', ...],
  action: 'navigate|filter|tts|scan|accessibility|theme|help|sync|extension|voice',
  params: {
    // Action-specific parameters
    target: 'page_name',    // for navigate
    filter: 'filter_name',  // for filter
    mode: 'read|stop',      // for tts
    // etc.
  }
}
```

### 2. VoiceIntegration (voice_integration.js)
**Purpose**: Main site integration with speech recognition
**Location**: `js/voice_integration.js`
**Key Methods**:
- `init()` - Initialize on page load
- `setupSpeechRecognition()` - Initialize Web Speech API
- `processVoiceCommand()` - Handle user input
- `executeCommand()` - Execute matched command
- `startListening()` / `stopListening()` - Control speech recognition

**Integration with Settings**:
```javascript
// Reads settings from settings.js
if (window.settingsManager && window.settingsManager.isInitialized) {
  this.settings = window.settingsManager.settings;
  this.selectedLanguage = this.settings.voiceControl?.language;
}
```

### 3. Extension Integration (background.js + content.js)
**Purpose**: Chrome extension functionality and sync
**Location**: `extension/background.js`, `extension/content.js`

**background.js Responsibilities**:
- Message routing and handling
- Settings synchronization
- Color filter application
- Storage management
- Content script injection

**content.js Responsibilities**:
- Inject accessibility bubble on pages
- Listen for extension messages
- Communicate with main site via window.postMessage
- Notify site of extension presence

### 4. Fuzzy Matching Engine
**Location**: `js/voice_commands.js` (lines: scoring functions)
**Algorithm**:
```
Score = max(
  (Levenshtein_Score * 0.6) + (TokenOverlap_Score * 0.4),
  TokenOverlap_Score * 0.9
)
```

**Scoring Breakdown**:
- **Levenshtein Distance** (60% weight):
  - Handles typos: "homee" → "home"
  - Character-level matching
  - O(n*m) complexity
  
- **Token Overlap** (40% weight):
  - Word-level matching: "navigate home" → "go home"
  - Synonym handling
  - O(n+m) complexity
  
- **Boost**: Token overlap at 90% minimum weight
  - Ensures word matches are prioritized
  - Handles "dark mode" vs "dark"

**Threshold**: 0.55 (empirically tuned)
- Below 0.55: Reject match
- 0.55-0.75: Accept with confidence
- 0.75+: High confidence match

## Extension Communication Protocol

### Site → Extension (window.postMessage)
```javascript
// From settings.html or main site
window.postMessage({
  type: 'AT_TRIGGER_FEATURE',
  feature: 'filters|scan|tts|voice',
  params: {
    filter: 'grayscale',
    scope: 'page'
    // ... action-specific params
  }
}, '*');
```

### Extension → Background (chrome.runtime.sendMessage)
```javascript
// From content.js or popup.js
chrome.runtime.sendMessage({
  action: 'applyFilter|speakText|syncSettings|accessibilityCommand',
  filter: '...',
  text: '...',
  settings: {...},
  command: '...'
}, response => {
  console.log('Response:', response);
});
```

### Background → Content (chrome.tabs.sendMessage)
```javascript
// From background.js
chrome.tabs.sendMessage(tabId, {
  action: 'storageUpdated|voiceControlStateChanged',
  data: {...}
});
```

## Storage Architecture

### localStorage (Client-side, Immediate)
```javascript
localStorage.setItem('accessibilitySettings', JSON.stringify(settings));
```

### IndexedDB (Client-side, Persistent)
```javascript
// Stores full settings with indexed timestamp
dbName: 'AccessibilitySettings'
objectStore: 'settings'
key: 'userSettings'
```

### chrome.storage.sync (Extension)
```javascript
chrome.storage.sync.set({
  tts: {...},
  filters: {...},
  voiceControl: {...},
  bubble: {...},
  extensionSettings: {...},
  lastSync: timestamp
});
```

### Server (Optional)
```javascript
// Via settings.js saveToServer()
POST /api/settings/save.php
body: {
  settings: {...},
  timestamp: date,
  version: '2.0'
}
```

## Adding New Voice Commands

### 1. Add Command Definition
```javascript
// In js/voice_commands.js, add to commands array:
{
  id: 'my_custom_command',
  phrases: ['say this', 'or this', 'or even this'],
  action: 'custom',
  params: {
    // Your custom parameters
    option: 'value'
  }
}
```

### 2. Add Handler
```javascript
// In js/voice_integration.js, add case:
case 'custom':
  this.handleMyCommand(cmdObj.params);
  break;

// Implement handler method:
handleMyCommand(params) {
  console.log('Custom command executed with:', params);
  // Implement your logic
}
```

### 3. For Extension
```javascript
// In extension/scripts/voice-control.js, add case:
case 'custom':
  // Call appropriate extension handler
  chrome.runtime.sendMessage({
    action: 'myCustomAction',
    params: cmdObj.params
  });
  break;
```

## Testing Framework

### Unit Testing Voice Matching
```javascript
// Test fuzzy matching
const test1 = VoiceCommandsLib.matchInput("go homee"); // typo
const test2 = VoiceCommandsLib.matchInput("navigate home"); // synonym
const test3 = VoiceCommandsLib.matchInput("can you read the page"); // extraction

console.assert(test1.score > 0.8, 'Typo handling failed');
console.assert(test2.command.id === 'goto_home', 'Synonym handling failed');
console.assert(test3.command.action === 'tts', 'Phrase extraction failed');
```

### Integration Testing
```javascript
// Test end-to-end voice command
VoiceControlDebug.startVoice();
// [User speaks "read page"]
// Check: TTS should start reading
setTimeout(() => {
  console.assert(window.speechSynthesis.speaking, 'TTS not started');
}, 1000);
```

### Extension Testing
```javascript
// Test extension messaging
chrome.runtime.sendMessage({
  action: 'applyFilter',
  filter: 'grayscale'
}, response => {
  console.log('Filter applied:', response.success);
});
```

## Performance Optimization

### Lazy Loading
```javascript
// VoiceIntegration only loads after page ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
}
```

### Caching
```javascript
// Settings cached in memory
this.settings = loadedSettings;
// Avoid repeated storage lookups
```

### Debouncing
```javascript
// Settings auto-save debounced
this.debouncedSave = debounce(() => this.autoSave(), 1000);
```

## Browser API Dependencies

| API | Usage | Fallback |
|-----|-------|----------|
| Web Speech API | Voice recognition | Disable voice control |
| speechSynthesis | Text-to-speech | Browser TTS |
| chrome.storage.sync | Settings sync | localStorage |
| IndexedDB | Offline storage | localStorage |
| Fetch API | Server sync | Offline mode |
| localStorage | Client storage | In-memory |
| postMessage | Cross-context messaging | Direct calls |

## Error Handling Strategy

### Graceful Degradation
```javascript
// If extension not available, site still works
if (window.AccessibilityExtension?.detected()) {
  // Use extension features
} else {
  // Use site features only
}
```

### Fallback Chains
```javascript
// Settings loading priority:
// 1. IndexedDB (most reliable)
// 2. localStorage (backup)
// 3. Defaults (last resort)
```

### Error Logging
```javascript
// All errors logged to console with context
try {
  operation();
} catch (error) {
  console.error('Operation failed:', {
    error: error.message,
    stack: error.stack,
    context: 'specific context'
  });
}
```

## Future Enhancement Ideas

### Machine Learning
- Train model on user voice patterns
- Improve accuracy over time
- Predict user intent from context

### Custom Commands
- Let users define custom commands
- Voice command macros
- Workflow automation

### Context Awareness
- Commands aware of current page/context
- "Click the first button" (visual context)
- "Read the article" (content awareness)

### Multi-language
- Support for 10+ languages
- Auto-detect user language
- Multilingual command matching

### Advanced Scanning
- Better image recognition (TensorFlow.js v3)
- OCR improvements (Tesseract.js v4)
- Real-time video processing

### Analytics
- Track command usage
- Identify improvement areas
- User behavior insights

## Contributing Guidelines

### Code Style
```javascript
// Use consistent naming
const voiceIntegration = new VoiceIntegration();
const matchResult = VoiceCommandsLib.matchInput(input);

// Use meaningful variable names
const THRESHOLD = 0.55; // Not const a = 0.55;

// Comment complex logic
// Levenshtein distance with memoization for performance
```

### Commit Messages
```
[Feature] Add voice command for X
[Fix] Correct matching threshold issue
[Docs] Update voice commands guide
[Perf] Optimize matching algorithm
[Test] Add unit tests for X
```

### Testing Before Commit
- [ ] All voice commands work
- [ ] No console errors
- [ ] Extension loads without issues
- [ ] Settings sync correctly
- [ ] Fuzzy matching works

## Maintenance Checklist

- [ ] Monitor error logs monthly
- [ ] Update command library based on user feedback
- [ ] Test with new browser versions
- [ ] Update documentation
- [ ] Performance profiling
- [ ] Security audit
- [ ] Accessibility compliance check

---

This architecture supports the current feature set while remaining extensible for future enhancements. Follow these patterns when adding new features to maintain consistency and reliability.
