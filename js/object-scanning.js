// Object Scanning and OCR Functionality
document.addEventListener('DOMContentLoaded', () => {
    // State management
    const ScanState = {
        model: null,
        stream: null,
        currentImage: null,
        isModelLoading: false,
        isDetecting: false,
        isOCRExtracting: false
    };

    // Elements
    const elements = {
        // Mode selection
        uploadModeBtn: document.getElementById('uploadModeBtn'),
        cameraModeBtn: document.getElementById('cameraModeBtn'),
        uploadMode: document.getElementById('uploadMode'),
        cameraMode: document.getElementById('cameraMode'),
        
        // Upload mode
        uploadArea: document.getElementById('uploadArea'),
        imageInput: document.getElementById('imageInput'),
        previewImage: document.getElementById('previewImage'),
        browseBtn: document.querySelector('#uploadArea .file-input-btn'),
        
        // Camera mode
        video: document.getElementById('video'),
        canvas: document.getElementById('canvas'),
        startCameraBtn: document.getElementById('startCameraBtn'),
        captureBtn: document.getElementById('captureBtn'),
        cameraOverlay: document.getElementById('cameraOverlay'),
        
        // Detection
        detectBtn: document.getElementById('detectBtn'),
        clearBtn: document.getElementById('clearBtn'),
        scanButtons: document.getElementById('scanButtons'),
        detectionResults: document.getElementById('detectionResults'),
        
        // OCR
        ocrUploadArea: document.getElementById('ocrUploadArea'),
        ocrImageInput: document.getElementById('ocrImageInput'),
        ocrPreviewImage: document.getElementById('ocrPreviewImage'),
        ocrBtn: document.getElementById('ocrBtn'),
        ocrClearBtn: document.getElementById('ocrClearBtn'),
        ocrButtons: document.getElementById('ocrButtons'),
        ocrResults: document.getElementById('ocrResults'),
        ocrBrowseBtn: document.querySelector('#ocrUploadArea .file-input-btn')
    };

    // Clear model cache (useful for debugging or forced refresh)
    async function clearModelCache() {
        try {
            if ('caches' in window) {
                await caches.delete(MODEL_CACHE_NAME);
                console.log('Model cache cleared');
                updateModelStatus('Cache cleared - refresh to reload', 'info');
                speakText('Model cache has been cleared. Please refresh the page to reload the model.');
                return true;
            }
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
        return false;
    }

    // Initialize the application
    initializeScanningApp();

    function updateModelStatus(status, message) {
        const statusElement = document.getElementById('modelStatus');
        if (statusElement) {
            let html = '';

            if (status === true) {
                html = `<i class="fas fa-check-circle text-success"></i> ${message || 'Model Ready'}`;
                // Add cache clear button when model is ready
                html += ` <button onclick="clearModelCache()" class="btn btn-sm btn-outline-light ms-2" title="Clear cached model" style="font-size: 10px; padding: 2px 6px;">Clear Cache</button>`;
            } else if (status === false) {
                html = `<i class="fas fa-exclamation-triangle text-warning"></i> ${message || 'Model Failed'}`;
            } else if (status === 'loading') {
                html = `<i class="fas fa-spinner fa-spin text-info"></i> ${message || 'Loading...'}`;
            } else {
                // Legacy boolean support
                if (status) {
                    html = '<i class="fas fa-check-circle text-success"></i> Model Ready';
                    html += ` <button onclick="clearModelCache()" class="btn btn-sm btn-outline-light ms-2" title="Clear cached model" style="font-size: 10px; padding: 2px 6px;">Clear Cache</button>`;
                } else {
                    html = '<i class="fas fa-exclamation-triangle text-warning"></i> Model Failed';
                }
            }

            statusElement.innerHTML = html;
            statusElement.className = `model-status ${status === true ? 'ready' : status === false ? 'error' : status === 'loading' ? 'loading' : status ? 'ready' : 'error'}`;
        }
    }

    async function initializeScanningApp() {
        console.log('Initializing object scanning app...');

        // Add loading indicator
        const loadingElement = document.createElement('div');
        loadingElement.id = 'modelStatus';
        loadingElement.className = 'model-status loading';
        loadingElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading AI Model...';
        loadingElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 1000;
        `;

        // Only add if not already present
        if (!document.getElementById('modelStatus')) {
            document.body.appendChild(loadingElement);
        }

        try {
            // Load model asynchronously without blocking
            setTimeout(() => loadModel(), 100);
        } catch (error) {
            console.error('Failed to initialize model loading:', error);
            updateModelStatus(false);
        }

        // Initialize other components immediately
        initializeEventListeners();
        initializeModeSelection();

        console.log('Object scanning app initialized');
    }

    // Enhanced model caching with better persistence and reliability
    const MODEL_CACHE_NAME = 'accessibility-translator-models-v2';
    const MODEL_BASE_URL = 'https://storage.googleapis.com/tfjs-models/savedmodel/ssd_mobilenet_v2/';

    async function openModelCache() {
        if ('caches' in window) {
            return await caches.open(MODEL_CACHE_NAME);
        }
        throw new Error('Cache API not supported');
    }

    async function isModelCached() {
        try {
            const cache = await openModelCache();
            const keys = await cache.keys();

            // Check for all essential model files
            const modelFiles = [
                'model.json',
                'group1-shard1of5',
                'group1-shard2of5',
                'group1-shard3of5',
                'group1-shard4of5',
                'group1-shard5of5'
            ];

            let cachedCount = 0;
            for (const file of modelFiles) {
                const url = `${MODEL_BASE_URL}${file}`;
                const cachedResponse = await cache.match(url);
                if (cachedResponse) {
                    cachedCount++;
                }
            }

            console.log(`Model cache status: ${cachedCount}/${modelFiles.length} files cached`);
            return cachedCount >= modelFiles.length; // Require all files to be cached

        } catch (error) {
            console.error('Error checking model cache:', error);
            return false;
        }
    }

    async function cacheModelFiles() {
        try {
            console.log('Caching model files...');
            updateModelStatus('Caching model files...', 'info');

            const cache = await openModelCache();

            // List of model files to cache
            const modelFiles = [
                'model.json',
                'group1-shard1of5',
                'group1-shard2of5',
                'group1-shard3of5',
                'group1-shard4of5',
                'group1-shard5of5'
            ];

            const cachePromises = modelFiles.map(async (file) => {
                const url = `${MODEL_BASE_URL}${file}`;
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        await cache.put(url, response.clone());
                        console.log(`Cached: ${file}`);
                    } else {
                        console.warn(`Failed to fetch ${file}: ${response.status}`);
                    }
                } catch (error) {
                    console.warn(`Failed to cache ${file}:`, error);
                }
            });

            await Promise.all(cachePromises);
            console.log('Model files cached successfully');
            updateModelStatus('Model cached for future use', 'success');

        } catch (error) {
            console.warn('Failed to cache model files:', error);
            updateModelStatus('Caching failed, but model loaded', 'warning');
        }
    }

    async function loadModelWithCache() {
        try {
            // Check if model is fully cached
            const cached = await isModelCached();

            if (cached) {
                console.log('Loading model from cache...');
                updateModelStatus('Loading from cache...', 'info');

                // Use cached model by intercepting fetch requests
                const originalFetch = window.fetch;
                window.fetch = async function(url, options) {
                    if (url.includes(MODEL_BASE_URL)) {
                        try {
                            const cache = await caches.open(MODEL_CACHE_NAME);
                            const cachedResponse = await cache.match(url);
                            if (cachedResponse) {
                                console.log(`Serving ${url} from cache`);
                                return cachedResponse.clone();
                            }
                        } catch (error) {
                            console.warn(`Cache miss for ${url}:`, error);
                        }
                    }
                    return originalFetch.call(this, url, options);
                };

                const model = await cocoSsd.load();
                window.fetch = originalFetch; // Restore original fetch

                console.log('Model loaded from cache successfully');
                updateModelStatus('Model ready (from cache)', 'success');
                return model;

            } else {
                console.log('Downloading model...');
                updateModelStatus('Downloading model (27MB)...', 'warning');

                const model = await cocoSsd.load();

                console.log('Model downloaded successfully');
                updateModelStatus('Model ready', 'success');

                // Cache the files in background after successful load
                setTimeout(() => cacheModelFiles(), 2000);

                return model;
            }

        } catch (error) {
            console.error('Error in loadModelWithCache:', error);
            updateModelStatus('Failed to load model', 'danger');

            // Fallback: try loading without cache
            console.log('Attempting fallback load...');
            try {
                const model = await cocoSsd.load();
                updateModelStatus('Model loaded (fallback)', 'warning');
                return model;
            } catch (fallbackError) {
                console.error('Fallback load also failed:', fallbackError);
                throw fallbackError;
            }
        }
    }

    async function loadModel() {
        console.log('Loading COCO-SSD model...');

        // Check if TensorFlow.js is loaded
        if (typeof tf === 'undefined') {
            console.error('TensorFlow.js not loaded');
            showError('TensorFlow.js not available. Please refresh the page.');
            return;
        }

        // Check if COCO-SSD is loaded
        if (!window.cocoSsd) {
            console.error('COCO-SSD model not loaded');
            showError('Object detection model not available. Please refresh the page.');
            return;
        }

        try {
            ScanState.isModelLoading = true;
            updateModelStatus('loading', 'Loading model...');

            // Check if model is cached
            const cached = await isModelCached();

            if (cached) {
                console.log('Using cached model');
                updateModelStatus('loading', 'Loading from cache...');
                ScanState.model = await loadModelWithCache();
                ScanState.isModelLoading = false;
                updateModelStatus(true, 'Model ready (cached)');
            } else {
                console.log('Downloading model from network...');
                updateModelStatus('loading', 'Downloading model...');

                // Add a timeout to prevent hanging
                const modelLoadPromise = loadModelWithCache();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Model loading timeout')), 120000) // 2 minutes for first load
                );

                ScanState.model = await Promise.race([modelLoadPromise, timeoutPromise]);
                console.log('COCO-SSD model loaded and cached successfully');
                ScanState.isModelLoading = false;
                updateModelStatus(true, 'Model ready');
            }

        } catch (error) {
            console.error('Error loading model:', error);
            ScanState.isModelLoading = false;
            showError('Failed to load detection model. Please refresh the page.');
            updateModelStatus(false, 'Model failed to load');
        }
    }

    async function clearModelCache() {
        try {
            console.log('Clearing model cache...');
            if ('caches' in window) {
                await caches.delete(MODEL_CACHE_NAME);
                console.log('Model cache cleared');
            } else {
                console.warn('Cache API not supported');
            }

            // Reset model state and reload
            ScanState.model = null;
            ScanState.isModelLoading = false;
            updateModelStatus('loading', 'Reloading model...');
            setTimeout(() => loadModel(), 500);
        } catch (error) {
            console.warn('Failed to clear model cache:', error);
        }
    }

    // Make clearModelCache globally accessible
    window.clearModelCache = clearModelCache;

    // Post-process OCR text to fix common errors and improve readability
    function postProcessOCRText(text) {
        return text
            // Fix common OCR errors
            .replace(/l/g, 'l') // Keep l as l
            .replace(/1/g, '1') // Keep 1 as 1
            .replace(/0/g, '0') // Keep 0 as 0
            .replace(/O/g, 'O') // Keep O as O
            // Fix spacing issues
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/(\w)\.(\w)/g, '$1. $2') // Add space after periods if missing
            .replace(/(\w),(\w)/g, '$1, $2') // Add space after commas if missing
            // Clean up line breaks
            .replace(/\n\s*\n/g, '\n\n') // Ensure double line breaks
            .trim();
    }

    // Preprocess image for better OCR results
    async function preprocessImageForOCR(imageSrc) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Set canvas size to image size
                canvas.width = img.width;
                canvas.height = img.height;

                // Draw original image
                ctx.drawImage(img, 0, 0);

                // Get image data for processing
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // Apply basic image enhancement for OCR
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    // Convert to grayscale using luminance formula
                    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

                    // Increase contrast slightly
                    const contrasted = Math.min(255, Math.max(0, (gray - 128) * 1.2 + 128));

                    // Apply slight sharpening effect
                    data[i] = data[i + 1] = data[i + 2] = contrasted;
                    // Keep alpha channel unchanged
                }

                // Put processed image data back
                ctx.putImageData(imageData, 0, 0);

                // Return processed image as data URL
                resolve(canvas.toDataURL('image/png'));
            };
            img.src = imageSrc;
        });
    }

    // Speak OCR text aloud
    function speakOCRText(text) {
        if (!text || text.trim().length === 0) {
            speakText('No text to read aloud.');
            return;
        }

        // Clean the text for speech
        const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.rate = 0.9; // Slightly slower for clarity
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            utterance.lang = 'en-US'; // English language

            utterance.onstart = () => {
                console.log('Started speaking OCR text');
            };

            utterance.onend = () => {
                console.log('Finished speaking OCR text');
            };

            utterance.onerror = (error) => {
                console.error('Speech synthesis error:', error);
                speakText('Unable to speak the text. Please check your browser settings.');
            };

            speechSynthesis.speak(utterance);
        } else {
            speakText('Speech synthesis is not supported in this browser.');
        }
    }

    // Copy OCR text to clipboard
    function copyOCRText(text) {
        if (!text || text.trim().length === 0) {
            speakText('No text to copy.');
            return;
        }

        // Clean the text for copying
        const cleanText = text.replace(/\\n/g, '\n').trim();

        navigator.clipboard.writeText(cleanText).then(() => {
            speakText('Text copied to clipboard.');
            // Show visual feedback
            const notification = document.createElement('div');
            notification.className = 'alert alert-success position-fixed';
            notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 300px;';
            notification.innerHTML = '<i class="fas fa-check"></i> Text copied to clipboard!';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        }).catch(err => {
            console.error('Failed to copy text:', err);
            speakText('Failed to copy text to clipboard.');
        });
    }

    // Download OCR text as file
    function downloadOCRText(text, filename) {
        if (!text || text.trim().length === 0) {
            speakText('No text to download.');
            return;
        }

        const cleanText = text.replace(/\\n/g, '\n').trim();
        const blob = new Blob([cleanText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        speakText('Text downloaded as file.');
    }

    function initializeEventListeners() {
        // File upload handlers
        if (elements.imageInput) {
            elements.imageInput.addEventListener('change', handleImageUpload);
        }

        if (elements.browseBtn) {
            elements.browseBtn.addEventListener('click', () => elements.imageInput?.click());
        }

        if (elements.uploadArea) {
            initializeDragAndDrop(elements.uploadArea, handleImageUpload);
        }

        if (elements.ocrImageInput) {
            elements.ocrImageInput.addEventListener('change', handleOCRImageUpload);
        }

        if (elements.ocrBrowseBtn) {
            elements.ocrBrowseBtn.addEventListener('click', () => elements.ocrImageInput?.click());
        }

        if (elements.ocrUploadArea) {
            initializeDragAndDrop(elements.ocrUploadArea, handleOCRImageUpload);
        }

        // Camera handlers
        if (elements.startCameraBtn) {
            elements.startCameraBtn.addEventListener('click', toggleCamera);
        }

        if (elements.captureBtn) {
            elements.captureBtn.addEventListener('click', captureImage);
        }

        // Detection handlers
        if (elements.detectBtn) {
            elements.detectBtn.addEventListener('click', detectObjects);
        }

        if (elements.clearBtn) {
            elements.clearBtn.addEventListener('click', clearScanning);
        }

        // OCR handlers
        if (elements.ocrBtn) {
            elements.ocrBtn.addEventListener('click', extractText);
        }

        if (elements.ocrClearBtn) {
            elements.ocrClearBtn.addEventListener('click', clearOCR);
        }
    }

    function initializeModeSelection() {
        if (elements.uploadModeBtn && elements.cameraModeBtn) {
            elements.uploadModeBtn.addEventListener('click', () => switchMode('upload'));
            elements.cameraModeBtn.addEventListener('click', () => switchMode('camera'));
            
            // Set initial mode
            switchMode('upload');
        }
    }

    function switchMode(mode) {
        if (mode === 'upload') {
            elements.uploadModeBtn.classList.add('active');
            elements.cameraModeBtn.classList.remove('active');
            elements.uploadMode.style.display = 'block';
            elements.cameraMode.style.display = 'none';
            stopCamera();
        } else if (mode === 'camera') {
            elements.cameraModeBtn.classList.add('active');
            elements.uploadModeBtn.classList.remove('active');
            elements.cameraMode.style.display = 'block';
            elements.uploadMode.style.display = 'none';
        }
    }

    function initializeDragAndDrop(element, callback) {
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            element.classList.add('drag-over');
        });

        element.addEventListener('dragleave', () => {
            element.classList.remove('drag-over');
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                callback(file);
            }
        });
    }

    function handleImageUpload(file) {
        if (file instanceof Event) {
            file = file.target.files[0];
        }
        
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            ScanState.currentImage = e.target.result;
            elements.previewImage.src = ScanState.currentImage;
            elements.previewImage.style.display = 'block';
            elements.scanButtons.style.display = 'flex';
            elements.detectionResults.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    function handleOCRImageUpload(file) {
        if (file instanceof Event) {
            file = file.target.files[0];
        }
        
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            elements.ocrPreviewImage.src = e.target.result;
            elements.ocrPreviewImage.style.display = 'block';
            elements.ocrButtons.style.display = 'flex';
            elements.ocrResults.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    async function toggleCamera() {
        if (ScanState.stream) {
            stopCamera();
        } else {
            await startCamera();
        }
    }

    async function startCamera() {
        try {
            ScanState.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            
            elements.video.srcObject = ScanState.stream;
            elements.cameraOverlay.style.display = 'none';
            elements.startCameraBtn.innerHTML = '<i class="fas fa-stop"></i><span>Stop Camera</span>';
            elements.startCameraBtn.classList.remove('btn-primary-scan');
            elements.startCameraBtn.classList.add('btn-secondary-scan');
            elements.captureBtn.disabled = false;
        } catch (error) {
            console.error('Error accessing camera:', error);
            showError('Unable to access camera. Please check permissions and ensure no other app is using the camera.');
        }
    }

    function stopCamera() {
        if (ScanState.stream) {
            ScanState.stream.getTracks().forEach(track => track.stop());
            ScanState.stream = null;
            elements.video.srcObject = null;
            elements.cameraOverlay.style.display = 'flex';
            elements.startCameraBtn.innerHTML = '<i class="fas fa-play"></i><span>Start Camera</span>';
            elements.startCameraBtn.classList.add('btn-primary-scan');
            elements.startCameraBtn.classList.remove('btn-secondary-scan');
            elements.captureBtn.disabled = true;
        }
    }

    function captureImage() {
        if (!elements.video.videoWidth) {
            showError('Camera not ready. Please wait for camera to initialize.');
            return;
        }

        elements.canvas.width = elements.video.videoWidth;
        elements.canvas.height = elements.video.videoHeight;
        const ctx = elements.canvas.getContext('2d');
        ctx.drawImage(elements.video, 0, 0);
        
        ScanState.currentImage = elements.canvas.toDataURL('image/jpeg');
        elements.previewImage.src = ScanState.currentImage;
        elements.previewImage.style.display = 'block';
        elements.scanButtons.style.display = 'flex';
        elements.detectionResults.style.display = 'none';
        
        stopCamera();
    }

    async function detectObjects() {
        console.log('Starting object detection...');

        if (ScanState.isModelLoading) {
            showError('Model is still loading. Please wait.');
            return;
        }

        if (!ScanState.model) {
            showError('Detection model not available. Please refresh the page.');
            return;
        }

        if (!ScanState.currentImage) {
            showError('Please select or capture an image first.');
            return;
        }

        if (ScanState.isDetecting) {
            console.log('Detection already in progress');
            return; // Prevent multiple simultaneous detections
        }

        ScanState.isDetecting = true;
        setButtonState(elements.detectBtn, true, '<i class="fas fa-spinner fa-spin"></i><span>Detecting...</span>');

        try {
            console.log('Creating image for detection...');
            const img = new Image();

            // Add timeout for image loading
            const imageLoadPromise = new Promise((resolve, reject) => {
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = ScanState.currentImage;

                // Timeout after 10 seconds
                setTimeout(() => reject(new Error('Image load timeout')), 10000);
            });

            const loadedImg = await imageLoadPromise;
            console.log('Image loaded, running detection...');

            // Add timeout for detection
            const detectionPromise = ScanState.model.detect(loadedImg);
            const detectionTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Detection timeout')), 30000)
            );

            const predictions = await Promise.race([detectionPromise, detectionTimeout]);
            console.log('Detection complete, displaying results...');
            displayDetectionResults(predictions);
            
        } catch (error) {
            console.error('Detection error:', error);
            showError(`An error occurred during object detection: ${error.message}. Please try again.`);
        } finally {
            ScanState.isDetecting = false;
            setButtonState(elements.detectBtn, false, '<i class="fas fa-search"></i><span>Detect Objects</span>');
        }
    }

    function displayDetectionResults(predictions) {
        elements.detectionResults.style.display = 'block';
        
        if (predictions.length === 0) {
            elements.detectionResults.innerHTML = `
                <div class="results-container">
                    <div class="result-item">
                        <div class="result-label">No Objects Detected</div>
                        <div class="result-text">Try a different image with clear, visible objects.</div>
                    </div>
                </div>
            `;
            speakText('No objects detected in the image.');
            return;
        }
        
        let resultsHTML = '<div class="results-container">';
        predictions.forEach((prediction, index) => {
            const confidence = (prediction.score * 100).toFixed(2);
            resultsHTML += `
                <div class="result-item">
                    <div class="result-label">Object ${index + 1}</div>
                    <div class="result-text">${prediction.class}</div>
                    <span class="confidence-badge">${confidence}% confident</span>
                </div>
            `;
        });
        resultsHTML += '</div>';
        
        elements.detectionResults.innerHTML = resultsHTML;
        
        // Speak results
        const objectList = predictions.map(p => p.class).join(', ');
        speakText(`Detected ${predictions.length} objects: ${objectList}`);
    }

    async function extractText() {
        if (ScanState.isOCRExtracting) {
            return;
        }

        ScanState.isOCRExtracting = true;
        setButtonState(elements.ocrBtn, true, '<i class="fas fa-spinner fa-spin"></i><span>Extracting...</span>');

        elements.ocrResults.style.display = 'block';
        elements.ocrResults.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <div class="loading-text">Preprocessing image and extracting text...</div>
            </div>
        `;

        try {
            if (!window.Tesseract) {
                throw new Error('Tesseract OCR not loaded');
            }

            // Preprocess image for better OCR results
            const processedImageSrc = await preprocessImageForOCR(elements.ocrPreviewImage.src);

            // Enhanced OCR configuration for better text extraction
            const result = await Tesseract.recognize(
                processedImageSrc,
                'eng',
                {
                    logger: m => console.log('OCR Progress:', m),
                    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                    tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
                    tessedit_char_whitelist: '',
                    textord_heavy_nr: 1,
                    textord_min_linesize: 2.5
                }
            );

            const text = result.data.text.trim();

            if (text) {
                const formattedText = text.replace(/\n\s*\n/g, '\n\n').trim();

                elements.ocrResults.innerHTML = `
                    <div class="results-container">
                        <div class="result-item">
                            <div class="result-label">Extracted Text</div>
                            <div class="result-text" style="white-space: pre-wrap; max-height: 300px; overflow-y: auto;">${formattedText}</div>
                            <div class="mt-2">
                                <button class="btn btn-sm btn-primary me-2" onclick="readExtractedText()">
                                    <i class="fas fa-volume-up"></i> Read Aloud
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="copyExtractedText()">
                                    <i class="fas fa-copy"></i> Copy Text
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                // Store the extracted text for the buttons
                window.lastExtractedText = formattedText;

                speakText('Extracted text: ' + formattedText.substring(0, 100) + (formattedText.length > 100 ? '...' : ''));
            } else {
                elements.ocrResults.innerHTML = `
                    <div class="results-container">
                        <div class="result-item">
                            <div class="result-label">No Text Found</div>
                            <div class="result-text">Unable to extract text from this image. Try a clearer image with readable text, better lighting, and higher contrast.</div>
                        </div>
                    </div>
                `;
                speakText('No text found in the image.');
            }

        } catch (error) {
            console.error('OCR error:', error);
            elements.ocrResults.innerHTML = `
                <div class="results-container">
                    <div class="result-item">
                        <div class="result-label">Error</div>
                        <div class="result-text">An error occurred during text extraction. Please try again.</div>
                    </div>
                </div>
            `;
            speakText('Error extracting text from image.');
        } finally {
            ScanState.isOCRExtracting = false;
            setButtonState(elements.ocrBtn, false, '<i class="fas fa-text-height"></i><span>Extract Text</span>');
        }
    }

    function clearScanning() {
        ScanState.currentImage = null;
        elements.previewImage.style.display = 'none';
        elements.scanButtons.style.display = 'none';
        elements.detectionResults.style.display = 'none';
        if (elements.imageInput) elements.imageInput.value = '';
    }

    function clearOCR() {
        elements.ocrPreviewImage.style.display = 'none';
        elements.ocrButtons.style.display = 'none';
        elements.ocrResults.style.display = 'none';
        if (elements.ocrImageInput) elements.ocrImageInput.value = '';
    }

    function setButtonState(button, disabled, html) {
        if (button) {
            button.disabled = disabled;
            button.innerHTML = html;
        }
    }

    function showError(message) {
        alert(message); // Replace with better error display
        console.error('Scanning Error:', message);
    }

    function showComingSoonMessage(featureName, description) {
        elements.ocrResults.style.display = 'block';
        elements.ocrResults.innerHTML = `
            <div class="coming-soon-container" style="
                background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
                color: white;
                padding: 30px;
                border-radius: 12px;
                text-align: center;
                margin: 20px 0;
            ">
                <div style="font-size: 48px; margin-bottom: 15px;">🚀</div>
                <h3 style="margin-bottom: 10px; font-size: 1.5rem;">${featureName} Coming Soon</h3>
                <p style="margin: 0; font-size: 1.1rem; line-height: 1.6;">${description}</p>
                <p style="margin-top: 15px; font-size: 0.9rem; opacity: 0.9;">Thank you for your patience!</p>
            </div>
        `;
    }

    function speakText(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.8;
            utterance.pitch = 1;
            utterance.volume = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }

    // Clear model cache (useful for debugging or forced refresh)
    async function clearModelCache() {
        try {
            if ('caches' in window) {
                await caches.delete(MODEL_CACHE_NAME);
                console.log('Model cache cleared');
                updateModelStatus('Cache cleared - refresh to reload', 'info');
                speakText('Model cache has been cleared. Please refresh the page to reload the model.');
                return true;
            }
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
        return false;
    }

    // Initialize the application
    initializeScanningApp();

// Global function for OCR text speaking
function speakOCRText(text) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.8;
        utterance.pitch = 1;
        utterance.volume = 0.9;
        utterance.lang = 'en-US'; // Set language explicitly

        // Add event listeners for better UX
        utterance.onstart = () => console.log('Started speaking OCR text');
        utterance.onend = () => console.log('Finished speaking OCR text');
        utterance.onerror = (e) => console.error('Speech error:', e);

        window.speechSynthesis.speak(utterance);
    } else {
        console.warn('Speech synthesis not supported');
        alert('Text-to-speech is not supported in this browser.');
    }
    return false; // Prevent any default behavior
}

// Global function for copying OCR text
function copyOCRText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        // Use modern clipboard API
        navigator.clipboard.writeText(text).then(() => {
            // Show success feedback
            const notification = document.createElement('div');
            notification.textContent = 'Text copied to clipboard!';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                z-index: 10000;
                font-size: 14px;
            `;
            document.body.appendChild(notification);
            setTimeout(() => document.body.removeChild(notification), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            fallbackCopyTextToClipboard(text);
        });
    } else {
        // Fallback for older browsers
        fallbackCopyTextToClipboard(text);
    }
    return false; // Prevent any default behavior
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            const notification = document.createElement('div');
            notification.textContent = 'Text copied to clipboard!';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                z-index: 10000;
                font-size: 14px;
            `;
            document.body.appendChild(notification);
            setTimeout(() => document.body.removeChild(notification), 2000);
        }
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        alert('Unable to copy text. Please select and copy manually.');
    }

    document.body.removeChild(textArea);
}

// Global functions for OCR text handling
function readExtractedText() {
    if (window.lastExtractedText) {
        speakOCRText(window.lastExtractedText);
    } else {
        speakText('No text available to read.');
    }
}

function copyExtractedText() {
    if (window.lastExtractedText) {
        copyOCRText(window.lastExtractedText);
    } else {
        speakText('No text available to copy.');
    }
}

// Global function for OCR text speaking
function speakOCRText(text) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.8;
        utterance.pitch = 1;
        utterance.volume = 0.9;
        utterance.lang = 'en-US'; // Set language explicitly

        // Add event listeners for better UX
        utterance.onstart = () => console.log('Started speaking OCR text');
        utterance.onend = () => console.log('Finished speaking OCR text');
        utterance.onerror = (e) => console.error('Speech error:', e);

        window.speechSynthesis.speak(utterance);
    } else {
        console.warn('Speech synthesis not supported');
        alert('Text-to-speech is not supported in this browser.');
    }
    return false; // Prevent any default behavior
}

// Global function for copying OCR text
function copyOCRText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        // Use modern clipboard API
        navigator.clipboard.writeText(text).then(() => {
            const notification = document.createElement('div');
            notification.textContent = 'Text copied to clipboard!';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                z-index: 10000;
                font-size: 14px;
            `;
            document.body.appendChild(notification);
            setTimeout(() => document.body.removeChild(notification), 2000);
        });
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.cssText = `
            position: fixed;
            left: -999999px;
            top: -999999px;
        `;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                const notification = document.createElement('div');
                notification.textContent = 'Text copied to clipboard!';
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #10b981;
                    color: white;
                    padding: 10px 15px;
                    border-radius: 5px;
                    z-index: 10000;
                    font-size: 14px;
                `;
                document.body.appendChild(notification);
                setTimeout(() => document.body.removeChild(notification), 2000);
            }
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
            alert('Unable to copy text. Please select and copy manually.');
        }

        document.body.removeChild(textArea);
    }
}
});