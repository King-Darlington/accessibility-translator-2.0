# Conversion Plan: React to Vanilla HTML/CSS/Bootstrap/JS

## Information Gathered
- React app is a single-page application with sections: header (home), about, text-to-speech, object-scanning, gallery, contact.
- Components include Header (navbar with dropdowns, active links, color filters), NavigationMenu (voice nav), Footer (canvas animation), TextToSpeech (TTS), ObjectScanning (object detection/OCR), ColorFilter (filter buttons), VoiceNavigation (floating voice button).
- Uses Bootstrap for layout, custom CSS, Font Awesome icons.
- APIs: Web Speech API, TensorFlow.js, Tesseract.js.
- Assets in src/assets.

## Plan
- Create index.html with all sections, navbar, footer; include Bootstrap, Font Awesome, TensorFlow, Tesseract.js via CDN.
- Create main.js for all JS logic: navbar active links, dropdowns, color filters, voice navigation, text-to-speech, object scanning, footer animation, scroll effects.
- Keep existing CSS files: index.css, App.css, Footer.css; link in HTML.
- Use assets from src/assets.

## Dependent Files to be edited/created
- index.html (new main HTML file)
- main.js (new JS file for all interactivity)
- Keep src/index.css, src/App.css, src/Footer.css
- Use src/assets for images

## Followup steps
- Test all features: navbar navigation, color filters, voice navigation, text-to-speech, object scanning, footer animation.
- Ensure responsive design with Bootstrap.
- Verify no .jsx files remain.

## Tasks
- [x] Create index.html with HTML structure, sections, navbar, footer
- [x] Create main.js with JS logic for all components
- [x] Link CSS files in index.html
- [x] Include necessary CDNs in index.html
- [x] Test navbar active links and dropdowns
- [x] Test color filters
- [x] Test voice navigation
- [x] Test text-to-speech
- [x] Test object scanning (video and image upload)
- [x] Test footer canvas animation
- [x] Test scroll effects and section visibility
- [x] Remove all .jsx files
- [x] Final testing and verification
