# Conversion Plan: React to Vanilla HTML/CSS/Bootstrap/JS - Multiple Pages

## Information Gathered
- React app is a single-page application with sections: header (home), about, text-to-speech, object-scanning, gallery, contact.
- Components include Header (navbar with dropdowns, active links, color filters), NavigationMenu (voice nav), Footer (canvas animation), TextToSpeech (TTS), ObjectScanning (object detection/OCR), ColorFilter (filter buttons), VoiceNavigation (floating voice button).
- Uses Bootstrap for layout, custom CSS, Font Awesome icons.
- APIs: Web Speech API, TensorFlow.js, Tesseract.js.
- Assets in src/assets.

## Plan
- Create multiple HTML pages: index.html (home with header section, about section below), text-to-speech.html, object-scanning.html, gallery.html, contact.html.
- Each page includes shared navbar and footer.
- Create main.js for all JS logic, adapted for multiple pages.
- Keep existing CSS files: index.css, App.css, Footer.css; link in each HTML.
- Use assets from src/assets.

## Dependent Files to be edited/created
- index.html (home page)
- text-to-speech.html
- object-scanning.html
- gallery.html
- contact.html
- main.js (updated for multiple pages)
- Keep src/index.css, src/App.css, src/Footer.css
- Use src/assets for images

## Followup steps
- Test all features on each page: navbar navigation, color filters, voice navigation, text-to-speech, object scanning, footer animation.
- Ensure responsive design with Bootstrap.
- Verify no .jsx files remain.

## Tasks
- [ ] Create index.html (home page with header and about sections)
- [ ] Create text-to-speech.html
- [ ] Create object-scanning.html
- [ ] Create color-filter.html
- [ ] Create gallery.html
- [ ] Create contact.html
- [ ] Update main.js for multiple pages
- [ ] Link CSS files in each HTML
- [ ] Include necessary CDNs in each HTML
- [ ] Test navbar active links and dropdowns on each page
- [ ] Test color filters on each page
- [ ] Test voice navigation on each page
- [ ] Test text-to-speech on text-to-speech page
- [ ] Test object scanning on object-scanning page
- [ ] Test footer canvas animation on each page
- [ ] Remove all .jsx files
- [ ] Final testing and verification
