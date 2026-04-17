# Accessibility Translator 2.0 - Testing Guide

## Quick Reference
- **Main Site**: http://localhost/accessibility-translator-2.0/
- **Database**: at.sql (MySQL)
- **Test User**: Use any registered account (create one via registration page)

---

## 1. Authentication & Connection Flow

### Test 1.1: Login on Main Site
1. Go to http://localhost/accessibility-translator-2.0/
2. Click "Login" 
3. Enter registered account credentials (email, password)
4. Verify: Dashboard shows your name and "Logged In" status (not "Guest User")
5. Expected Result: ✅ Session established, user authenticated

### Test 1.2: Extension Connection
1. Open extension popup (click extension icon)
2. Verify: "Not Connected" status shown initially with "Connect" button visible
3. Click "Connect" button
4. Enter same login credentials (email, password)
5. Submit form
6. Expected Result: ✅ Status changes to "Connected as [Your Name]", Connect button disappears

### Test 1.3: Session Synchronization
1. Close extension popup
2. Go to main site (http://localhost/accessibility-translator-2.0/)
3. Verify: You're still logged in (shows your username, not "Guest User")
4. Open extension popup again
5. Verify: Still shows "Connected as [Your Name]"
6. Expected Result: ✅ Session and connection state persist correctly

### Test 1.4: Logout Sync
1. On main site, click logout
2. Verify: You're redirected to home, shown as "Guest User"
3. Open extension popup
4. Verify: Shows "Not Connected" and displays "Connect" button again
5. Expected Result: ✅ Extension detects logout and updates status

---

## 2. Extension UI & Layout

### Test 2.1: Popup Interface
1. Open extension popup
2. Verify window dimensions: ~400px width × 600px height
3. Verify header with status indicator (green dot = connected, red dot = disconnected)
4. Verify tabs visible: Magnification, TTS (Text-to-Speech), Scanning, Filters, Voice
5. Expected Result: ✅ Clean, responsive UI layout

### Test 2.2: Icon Display (Font Awesome)
1. Open extension popup
2. Check each tab for icons:
   - Magnification tab: Should show magnifying glass icons
   - TTS tab: Should show speaker icons
   - Filters tab: Should show palette/eye icons  
   - Scanning tab: Should show camera/document icons
   - Voice tab: Should show microphone icons
3. Expected Result: ✅ All Font Awesome icons render properly (not showing as blank squares)
4. If blank: Try refreshing extension (reload extension in chrome://extensions)

### Test 2.3: Feature Bubble on Web Pages
1. Visit any website (Google, Wikipedia, etc.)
2. Verify: Blue circular bubble appears in bottom-right corner of page
3. Click bubble: Should expand into menu with 5 circular feature options
4. Verify icons visible in menu (magnifying glass, ear, camera, eye, mic)
5. Hover over each feature: Should show tooltip or glow effect
6. Expected Result: ✅ Bubble UI functional, icons visible, proper animations

---

## 3. Text-to-Speech (TTS)

### Test 3.1: Basic TTS Playback
1. Navigate to a page with text (Wikipedia article, news site, etc.)
2. Open extension popup → TTS tab
3. Click "Read Page" button
4. Verify: Audio plays and page text is highlighted
5. Click "Pause" button: Audio should pause
6. Click "Resume" button: Audio should continue
7. Click "Stop" button: Audio stops completely
8. Expected Result: ✅ TTS plays, pauses, resumes, and stops correctly

### Test 3.2: TTS Settings
1. In TTS tab, adjust:
   - **Speed**: Slider from -10 to +10
     - Verify audio playback rate changes (slower/faster)
   - **Pitch**: Slider from -10 to +10
     - Verify audio pitch changes (lower/higher)
   - **Voice**: Select different option from dropdown
     - Verify voice changes (male/female/variant)
2. Expected Result: ✅ All settings apply to audio playback in real-time

### Test 3.3: Read Headers/Links Only
1. Open extension popup → TTS tab
2. Select "Read Headers" or "Read Links" checkpoint (if available)
3. Click "Read Page"
4. Verify: Only headers or links are read, not full text
5. Expected Result: ✅ Selective reading works

### Test 3.4: Download Audio
1. Open extension popup → TTS tab (if download button exists)
2. Click "Download Audio" 
3. Verify: WAV file downloads with appropriate name
4. Play downloaded file: Should contain TTS audio
5. Expected Result: ✅ Audio file created and downloads successfully

---

## 4. Color Filters

### Test 4.1: High-Contrast Filter
1. Visit a website with colored content (Google, news site, etc.)
2. Open extension popup → Filters tab
3. Click "High Contrast" filter
4. **CRITICAL**: Verify page does NOT turn completely black
5. Verify: Text remains readable, colors are adjusted (black background, white text, yellow links)
6. Verify: Images remain visible (not completely dark)
7. Click filter again to disable
8. Expected Result: ✅ High-contrast improves readability WITHOUT causing black-out

### Test 4.2: Grayscale Filter
1. Open extension popup → Filters tab
2. Click "Grayscale" filter
3. Verify: Page converts to grayscale (no colors)
4. Content remains fully readable
5. Click filter again to disable
6. Expected Result: ✅ Grayscale applied correctly, all content visible

### Test 4.3: Invert Colors Filter
1. Open extension popup → Filters tab
2. Click "Invert" filter
3. Verify: Page colors inverted (light backgrounds become dark, etc.)
4. Text remains readable (good contrast)
5. Click filter again to disable
6. Expected Result: ✅ Invert applied, no readability issues

### Test 4.4: Other Filters
Test each filter:
- **Sepia**: Warm, vintage effect
- **Deuteranopia** (Red-blind): Simulates red-color blindness
- **Protanopia** (Green-blind): Simulates green-color blindness
- **Tritanopia** (Blue-blind): Simulates blue-color blindness
- **Achromatopsia** (Complete colorblindness): All grayscale

For each:
1. Apply filter
2. Verify: Content visible, colors adjusted appropriately
3. No black-out or complete unreadability
4. Click to disable

Expected Result: ✅ All filters apply without breaking page readability

### Test 4.5: Filter Persistence
1. Apply a filter (e.g., High-Contrast)
2. Visit a different website
3. Verify: Filter still active on new page
4. Close extension popup
5. Reopen extension popup
6. Navigate to another page
7. Verify: Filter persists
8. Expected Result: ✅ Filters remain active across pages and sessions

---

## 5. Object Scanning

### Test 5.1: Object Detection via Camera
1. Open extension popup → Scanning tab
2. Click "Detect Objects" or open camera option
3. Allow camera access when prompted
4. Point camera at objects
5. Verify: Objects are labeled with boxes/text (using TensorFlow.js)
6. Verify: Audio description plays (using TTS)
7. Click "Stop"
8. Expected Result: ✅ Objects detected, labeled, and described

### Test 5.2: Object Detection via Upload
1. Open extension popup → Scanning tab
2. Click "Upload Image"
3. Select an image file
4. Verify: Image analyzed for objects
5. Verify: Objects labeled with descriptions
6. Verify: Audio description available
7. Expected Result: ✅ Image analysis works

### Test 5.3: Object Detection via Screenshot
1. Open extension popup → Scanning tab
2. Click "Scan Screen" or take screenshot
3. Verify: Current page screenshot captured
4. Verify: Page objects detected and labeled
5. Verify: Descriptions provided via TTS
6. Expected Result: ✅ Screenshot analysis works

---

## 6. Magnification

### Test 6.1: Zoom Control
1. Open extension popup → Magnification tab
2. Verify controls visible (zoom-in, zoom-out, reset buttons, or slider)
3. Click "Zoom In" multiple times
4. Verify: Page content enlarges
5. Click "Zoom Out" multiple times
6. Verify: Page content reduces
7. Click "Reset"
8. Verify: Returns to original zoom level
9. Expected Result: ✅ Zoom controls work smoothly

### Test 6.2: Font Size Adjustment
1. In Magnification tab, locate Font Size control
2. Increase font size
3. Verify: All text on page increases in size
4. Decrease font size
5. Verify: Text reduces appropriately
6. Expected Result: ✅ Font size adjustment works

### Test 6.3: Contrast Enhancement
1. In Magnification tab, locate Contrast control
2. Increase contrast
3. Verify: Text and elements have better contrast against background
4. Decrease contrast
5. Verify: Returns to normal
6. Expected Result: ✅ Contrast adjustment improves readability

### Test 6.4: Magnification Persistence
1. Apply magnification settings (zoom 150%, font +5px, contrast +20%)
2. Navigate to different page
3. Verify: Settings persist
4. Close and reopen extension
5. Verify: Settings still applied
6. Expected Result: ✅ Magnification settings save and persist

---

## 7. Voice Control

### Test 7.1: Start Voice Commands
1. Open extension popup → Voice tab
2. Click "Start Listening" button
3. Verify: Microphone indicator shows (animated or active state)
4. Speak a command: "Read Page" or similar
5. Verify: Command recognized
6. Expected Result: ✅ Voice input detected and processed

### Test 7.2: Voice Commands Recognition
Test various commands:
- "Read Page": Should activate TTS
- "Stop Reading": Should stop TTS
- "Zoom In": Should increase magnification
- "Apply Filter": Should open filter options
- "Next Link": Should navigate to next link
- "Previous Link": Should go back

For each:
1. Say command clearly
2. Verify: Extension recognizes and executes
3. Expected Result: ✅ Commands execute correctly

### Test 7.3: Stop Voice Control
1. Voice commands active
2. Click "Stop Listening" button
3. Speak a command: Should NOT execute
4. Verify: Microphone indicator off
5. Expected Result: ✅ Voice control stops

### Test 7.4: Voice Settings (if available)
1. In Voice tab, check for settings:
   - Language selection
   - Sensitivity/confidence threshold
   - Feedback preferences (voice/visual)
2. Adjust settings
3. Verify: Changes apply to voice recognition
4. Expected Result: ✅ Voice settings configurable

---

## 8. Settings & Preferences

### Test 8.1: Save Preferences
1. Open extension popup
2. Adjust multiple settings:
   - TTS speed, pitch, voice
   - Magnification zoom, font size, contrast
   - Default filter preference
3. Close and fully reload extension
4. Verify: All settings persisted
5. Expected Result: ✅ Preferences saved and restored

### Test 8.2: Export/Import Settings
1. Open Settings tab (if available)
2. Click "Export Preferences" (if available)
3. Verify: JSON file or config downloaded
4. Create new user account
5. Login to extension with new account
6. Click "Import Preferences"
7. Select previously exported file
8. Verify: Settings imported and applied
9. Expected Result: ✅ Preferences portable between accounts

### Test 8.3: Settings Sync Across Devices
1. On Device A: Open extension, apply settings
2. On Device B: Login to same account, open extension
3. Verify: Same settings visible (if cloud sync enabled)
4. Expected Result: ✅ Settings sync correctly (or note if not implemented)

---

## 9. Navigation & Tab Management

### Test 9.1: Tab Switching
1. Open extension popup
2. Click each tab (Magnification, TTS, Scanning, Filters, Voice)
3. Verify: Content switches smoothly
4. Verify: Previous tab content not visible
5. Click back to first tab
6. Verify: Content preserved (if applicable)
7. Expected Result: ✅ Tab navigation smooth and content isolated

### Test 9.2: Feature Activation
1. From each tab, activate a feature (e.g., "Read Page" from TTS)
2. Verify: Feature applies to current webpage
3. Switch tabs
4. Verify: Previously activated feature remains active
5. Switch back to original tab
6. Verify: Feature state preserved or resume available
7. Expected Result: ✅ Features persist across tab switches

---

## 10. Cross-Browser Compatibility (if deploying beyond Chrome)

### Test 10.1: Firefox Compatibility
1. Install extension in Firefox
2. Run tests 1.1 - 9.2 (above)
3. Expected Result: ✅ Features work identically in Firefox

### Test 10.2: Edge/Safari Compatibility
1. Install extension in Edge or Safari
2. Run critical tests (1, 3.1, 4.1, 5.1, 7.1)
3. Expected Result: ✅ Working (or document known limitations)

---

## 11. Performance & Stability

### Test 11.1: Memory Usage
1. Open extension
2. Apply all filters simultaneously
3. Open 10+ tabs with extension active on each
4. Check browser memory usage
5. Expected Result: ✅ No excessive increases, extension remains responsive

### Test 11.2: Large Page Handling
1. Visit large website (Reddit, Wikipedia with many images)
2. Apply magnification (300% zoom)
3. Enable TTS and start reading
4. Verify: No lag, stuttering, or crashes
5. Expected Result: ✅ Stable even on large pages

### Test 11.3: Extension Reload Recovery
1. While extension actively processing (e.g., TTS playing)
2. Reload extension (chrome://extensions → reload button)
3. Verify: Extension resets without browser crash
4. Verify: Popup displays correctly
5. Expected Result: ✅ Graceful reload, no browser issues

---

## 12. Accessibility of the Extension Itself

### Test 12.1: Keyboard Navigation
1. Open extension popup
2. Tab through all buttons, inputs, sliders
3. Verify: Focus visible on each element
4. Verify: Can activate buttons/submit forms with Enter key
5. Expected Result: ✅ Fully keyboard accessible

### Test 12.2: Screen Reader Compatibility
1. Enable screen reader (NVDA, JAWS, or browser built-in)
2. Open extension popup
3. Verify: All buttons, tabs, inputs have proper labels
4. Verify: Screen reader announces button purposes
5. Expected Result: ✅ Screen reader friendly

### Test 12.3: Color Contrast in Extension UI
1. Open extension popup in dark mode (if applicable)
2. Verify: All text readable, good contrast
3. Check with contrast checker tool (WebAIM, Axe)
4. Expected Result: ✅ WCAG AA minimum contrast met

---

## Bug Report Template

If you encounter issues, document:

```
BUG: [Feature] - Brief Description
  Severity: Critical | High | Medium | Low
  Steps to Reproduce:
    1. 
    2. 
    3. 
  Expected Result: 
  Actual Result:
  Environment: Chrome/Firefox/Edge, Version X.X, URL tested
  Screenshot/Video: [Attach if possible]
```

---

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Icons showing as blank squares | Reload extension (chrome://extensions), then reload tested page |
| Page turns black with filter | Disable all filters, hard-refresh page, try High-Contrast filter again |
| Voice commands not recognized | Check microphone permissions in chrome://settings/content/microphone |
| Settings not saving | Check browser storage space, clear cache, try incognito mode |
| TTS not playing audio | Unmute browser tab, check audio output device, verify speakers connected |
| Extension popup won't open | Uninstall and reinstall extension, restart browser |

---

## Sign-Off Checklist

- [ ] All authentication flows working (login, connection, logout)
- [ ] All 5 feature tabs accessible and functional
- [ ] No pages turn completely black with filters
- [ ] Font Awesome icons display properly
- [ ] Settings persist across sessions
- [ ] Voice control activated successfully
- [ ] Performance acceptable on large pages
- [ ] Keyboard navigation works
- [ ] No console errors

**Last Updated**: March 2024
**Status**: Ready for QA Testing
