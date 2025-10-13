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
        ocrResults: document.getElementById('ocrResults')
    };

    // Initialize the application
    initializeScanningApp();

    async function initializeScanningApp() {
        await loadModel();
        initializeEventListeners();
        initializeModeSelection();
    }

    async function loadModel() {
        if (!window.cocoSsd) {
            console.error('COCO-SSD model not loaded. Make sure the script is included.');
            showError('Object detection model not available. Please refresh the page.');
            return;
        }

        try {
            ScanState.isModelLoading = true;
            ScanState.model = await cocoSsd.load();
            console.log('COCO-SSD model loaded successfully');
            ScanState.isModelLoading = false;
        } catch (error) {
            console.error('Error loading model:', error);
            ScanState.isModelLoading = false;
            showError('Failed to load detection model. Please refresh the page.');
        }
    }

    function initializeEventListeners() {
        // File upload handlers
        if (elements.imageInput) {
            elements.imageInput.addEventListener('change', handleImageUpload);
        }

        if (elements.uploadArea) {
            initializeDragAndDrop(elements.uploadArea, handleImageUpload);
        }

        if (elements.ocrImageInput) {
            elements.ocrImageInput.addEventListener('change', handleOCRImageUpload);
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
            return; // Prevent multiple simultaneous detections
        }

        ScanState.isDetecting = true;
        setButtonState(elements.detectBtn, true, '<i class="fas fa-spinner fa-spin"></i><span>Detecting...</span>');

        try {
            const img = new Image();
            img.src = ScanState.currentImage;
            await img.decode();
            
            const predictions = await ScanState.model.detect(img);
            displayDetectionResults(predictions);
            
        } catch (error) {
            console.error('Detection error:', error);
            showError('An error occurred during object detection. Please try again.');
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
        if (!elements.ocrPreviewImage.src || elements.ocrPreviewImage.src === window.location.href) {
            showError('Please select an image first.');
            return;
        }

        if (ScanState.isOCRExtracting) {
            return;
        }

        ScanState.isOCRExtracting = true;
        setButtonState(elements.ocrBtn, true, '<i class="fas fa-spinner fa-spin"></i><span>Extracting...</span>');

        elements.ocrResults.style.display = 'block';
        elements.ocrResults.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <div class="loading-text">Extracting text from image...</div>
            </div>
        `;

        try {
            if (!window.Tesseract) {
                throw new Error('Tesseract OCR not loaded');
            }

            const result = await Tesseract.recognize(
                elements.ocrPreviewImage.src,
                'eng',
                { logger: m => console.log(m) }
            );
            
            const text = result.data.text.trim();
            
            if (text) {
                elements.ocrResults.innerHTML = `
                    <div class="results-container">
                        <div class="result-item">
                            <div class="result-label">Extracted Text</div>
                            <div class="result-text">${text}</div>
                            <button class="btn btn-sm btn-primary mt-2" onclick="speakOCRText('${text.replace(/'/g, "\\'")}')">
                                <i class="fas fa-volume-up"></i> Read Aloud
                            </button>
                        </div>
                    </div>
                `;
                
                speakText(`Extracted text: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
            } else {
                elements.ocrResults.innerHTML = `
                    <div class="results-container">
                        <div class="result-item">
                            <div class="result-label">No Text Found</div>
                            <div class="result-text">Unable to extract text from this image. Try a clearer image with readable text.</div>
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

    function speakText(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.8;
            utterance.pitch = 1;
            utterance.volume = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }
});

// Global function for OCR text speaking
function speakOCRText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.8;
        utterance.pitch = 1;
        utterance.volume = 0.9;
        window.speechSynthesis.speak(utterance);
    }
}