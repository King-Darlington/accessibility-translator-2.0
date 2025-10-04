// Object Scanning and OCR Functionality
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const uploadModeBtn = document.getElementById('uploadModeBtn');
  const cameraModeBtn = document.getElementById('cameraModeBtn');
  const uploadMode = document.getElementById('uploadMode');
  const cameraMode = document.getElementById('cameraMode');
  const uploadArea = document.getElementById('uploadArea');
  const imageInput = document.getElementById('imageInput');
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const previewImage = document.getElementById('previewImage');
  const startCameraBtn = document.getElementById('startCameraBtn');
  const captureBtn = document.getElementById('captureBtn');
  const detectBtn = document.getElementById('detectBtn');
  const clearBtn = document.getElementById('clearBtn');
  const scanButtons = document.getElementById('scanButtons');
  const detectionResults = document.getElementById('detectionResults');
  const cameraOverlay = document.getElementById('cameraOverlay');
  
  // OCR Elements
  const ocrUploadArea = document.getElementById('ocrUploadArea');
  const ocrImageInput = document.getElementById('ocrImageInput');
  const ocrPreviewImage = document.getElementById('ocrPreviewImage');
  const ocrBtn = document.getElementById('ocrBtn');
  const ocrClearBtn = document.getElementById('ocrClearBtn');
  const ocrButtons = document.getElementById('ocrButtons');
  const ocrResults = document.getElementById('ocrResults');
  
  let model = null;
  let stream = null;
  let currentImage = null;
  
  // Load COCO-SSD Model
  async function loadModel() {
    try {
      model = await cocoSsd.load();
      console.log('Model loaded successfully');
    } catch (error) {
      console.error('Error loading model:', error);
      alert('Failed to load detection model. Please refresh the page.');
    }
  }
  
  loadModel();
  
  // Mode Selection
  uploadModeBtn.addEventListener('click', () => {
    uploadModeBtn.classList.add('active');
    cameraModeBtn.classList.remove('active');
    uploadMode.style.display = 'block';
    cameraMode.style.display = 'none';
    stopCamera();
  });
  
  cameraModeBtn.addEventListener('click', () => {
    cameraModeBtn.classList.add('active');
    uploadModeBtn.classList.remove('active');
    cameraMode.style.display = 'block';
    uploadMode.style.display = 'none';
  });
  
  // File Upload
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      loadImage(file);
    }
  });
  
  // Drag and Drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });
  
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      loadImage(file);
    }
  });
  
  function loadImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      currentImage = e.target.result;
      previewImage.src = currentImage;
      previewImage.style.display = 'block';
      scanButtons.style.display = 'flex';
      detectionResults.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }
  
  // Camera Functions
  startCameraBtn.addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      video.srcObject = stream;
      cameraOverlay.style.display = 'none';
      startCameraBtn.innerHTML = '<i class="fas fa-stop"></i><span>Stop Camera</span>';
      startCameraBtn.classList.remove('btn-primary-scan');
      startCameraBtn.classList.add('btn-secondary-scan');
      captureBtn.disabled = false;
      startCameraBtn.onclick = stopCamera;
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please check permissions.');
    }
  });
  
  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
      stream = null;
      cameraOverlay.style.display = 'flex';
      startCameraBtn.innerHTML = '<i class="fas fa-play"></i><span>Start Camera</span>';
      startCameraBtn.classList.add('btn-primary-scan');
      startCameraBtn.classList.remove('btn-secondary-scan');
      captureBtn.disabled = true;
      startCameraBtn.onclick = () => startCameraBtn.click();
    }
  }
  
  captureBtn.addEventListener('click', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    currentImage = canvas.toDataURL('image/jpeg');
    previewImage.src = currentImage;
    previewImage.style.display = 'block';
    scanButtons.style.display = 'flex';
    detectionResults.style.display = 'none';
    stopCamera();
  });
  
  // Object Detection
  detectBtn.addEventListener('click', async () => {
    if (!model) {
      alert('Model is still loading. Please wait.');
      return;
    }
    
    if (!currentImage) {
      alert('Please select an image first.');
      return;
    }
    
    detectBtn.disabled = true;
    detectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Detecting...</span>';
    
    try {
      const img = new Image();
      img.src = currentImage;
      await img.decode();
      
      const predictions = await model.detect(img);
      displayResults(predictions);
      
      detectBtn.disabled = false;
      detectBtn.innerHTML = '<i class="fas fa-search"></i><span>Detect Objects</span>';
    } catch (error) {
      console.error('Detection error:', error);
      alert('An error occurred during detection.');
      detectBtn.disabled = false;
      detectBtn.innerHTML = '<i class="fas fa-search"></i><span>Detect Objects</span>';
    }
  });
  
  function displayResults(predictions) {
    detectionResults.style.display = 'block';
    
    if (predictions.length === 0) {
      detectionResults.innerHTML = `
        <div class="results-container">
          <div class="result-item">
            <div class="result-label">No Objects Detected</div>
            <div class="result-text">Try a different image with clear objects.</div>
          </div>
        </div>
      `;
      return;
    }
    
    let resultsHTML = '<div class="results-container">';
    predictions.forEach((prediction, index) => {
      const confidence = (prediction.score * 100).toFixed(2);
      resultsHTML += `
        <div class="result-item">
          <div class="result-label">Object ${index + 1}</div>
          <div class="result-text">${prediction.class}</div>
          <span class="confidence-badge">Confidence: ${confidence}%</span>
        </div>
      `;
    });
    resultsHTML += '</div>';
    
    detectionResults.innerHTML = resultsHTML;
    
    // Speak results
    if ('speechSynthesis' in window) {
      const text = predictions.map(p => p.class).join(', ');
      const utterance = new SpeechSynthesisUtterance(`Detected objects: ${text}`);
      speechSynthesis.speak(utterance);
    }
  }
  
  clearBtn.addEventListener('click', () => {
    previewImage.style.display = 'none';
    scanButtons.style.display = 'none';
    detectionResults.style.display = 'none';
    currentImage = null;
    imageInput.value = '';
  });
  
  // OCR Functionality
  ocrImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      loadOCRImage(file);
    }
  });
  
  ocrUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    ocrUploadArea.classList.add('drag-over');
  });
  
  ocrUploadArea.addEventListener('dragleave', () => {
    ocrUploadArea.classList.remove('drag-over');
  });
  
  ocrUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    ocrUploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      loadOCRImage(file);
    }
  });
  
  function loadOCRImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      ocrPreviewImage.src = e.target.result;
      ocrPreviewImage.style.display = 'block';
      ocrButtons.style.display = 'flex';
      ocrResults.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }
  
  ocrBtn.addEventListener('click', async () => {
    if (!ocrPreviewImage.src) {
      alert('Please select an image first.');
      return;
    }
    
    ocrBtn.disabled = true;
    ocrBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Extracting...</span>';
    
    ocrResults.style.display = 'block';
    ocrResults.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <div class="loading-text">Extracting text from image...</div>
      </div>
    `;
    
    try {
      const result = await Tesseract.recognize(
        ocrPreviewImage.src,
        'eng',
        {
          logger: m => console.log(m)
        }
      );
      
      const text = result.data.text.trim();
      
      if (text) {
        ocrResults.innerHTML = `
          <div class="results-container">
            <div class="result-item">
              <div class="result-label">Extracted Text</div>
              <div class="result-text">${text}</div>
            </div>
          </div>
        `;
        
        // Speak extracted text
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          speechSynthesis.speak(utterance);
        }
      } else {
        ocrResults.innerHTML = `
          <div class="results-container">
            <div class="result-item">
              <div class="result-label">No Text Found</div>
              <div class="result-text">Unable to extract text from this image. Try a clearer image with readable text.</div>
            </div>
          </div>
        `;
      }
      
      ocrBtn.disabled = false;
      ocrBtn.innerHTML = '<i class="fas fa-text-height"></i><span>Extract Text</span>';
    } catch (error) {
      console.error('OCR error:', error);
      ocrResults.innerHTML = `
        <div class="results-container">
          <div class="result-item">
            <div class="result-label">Error</div>
            <div class="result-text">An error occurred during text extraction. Please try again.</div>
          </div>
        </div>
      `;
      ocrBtn.disabled = false;
      ocrBtn.innerHTML = '<i class="fas fa-text-height"></i><span>Extract Text</span>';
    }
  });
  
  ocrClearBtn.addEventListener('click', () => {
    ocrPreviewImage.style.display = 'none';
    ocrButtons.style.display = 'none';
    ocrResults.style.display = 'none';
    ocrImageInput.value = '';
  });
});