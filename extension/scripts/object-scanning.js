// Object Scanning with AI for Accessibility Translator

class ObjectScanningManager {
    constructor() {
        this.isInitialized = false;
        this.tfModel = null;
        this.tesseractWorker = null;
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupMessageListener();
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get('objectScanning', (result) => {
                this.settings = result.objectScanning || {
                    confidenceThreshold: 0.6,
                    maxObjects: 10,
                    enableSound: true,
                    autoReadResults: true
                };
                resolve(this.settings);
            });
        });
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'scanImage':
                    this.scanImage(request.imageData, request.options)
                        .then(results => sendResponse({ results }))
                        .catch(error => sendResponse({ error: error.message }));
                    return true; // Keep message channel open
                    
                case 'initializeModels':
                    this.initializeModels()
                        .then(() => sendResponse({ success: true }))
                        .catch(error => sendResponse({ error: error.message }));
                    return true;
                    
                case 'getScanningStatus':
                    sendResponse({ 
                        isInitialized: this.isInitialized,
                        settings: this.settings 
                    });
                    break;
            }
        });
    }

    async initializeModels() {
        if (this.isInitialized) {
            return;
        }

        try {
            // Load TensorFlow.js and COCO-SSD model
            await this.loadTensorFlowModel();
            
            // Initialize Tesseract.js for OCR
            await this.initializeTesseract();
            
            this.isInitialized = true;
            console.log('AI models initialized successfully');
        } catch (error) {
            console.error('Error initializing AI models:', error);
            throw error;
        }
    }

    async loadTensorFlowModel() {
        // Load TensorFlow.js dynamically
        await import(chrome.runtime.getURL('libs/tensorflow.js'));
        
        // Load COCO-SSD model
        const cocoSsd = await import('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd');
        this.tfModel = await cocoSsd.load();
    }

    async initializeTesseract() {
        // Initialize Tesseract.js worker
        const Tesseract = await import(chrome.runtime.getURL('libs/tesseract.js'));
        
        this.tesseractWorker = await Tesseract.createWorker('eng', 1, {
            logger: progress => {
                console.log('OCR Progress:', progress);
            }
        });
    }

    async scanImage(imageData, options = {}) {
        if (!this.isInitialized) {
            await this.initializeModels();
        }

        try {
            const results = {
                objects: [],
                text: '',
                timestamp: new Date().toISOString(),
                imageSize: { width: 0, height: 0 }
            };

            // Create image element for processing
            const img = await this.loadImage(imageData);
            results.imageSize = { width: img.width, height: img.height };

            // Run object detection
            if (options.detectObjects !== false) {
                results.objects = await this.detectObjects(img);
            }

            // Run OCR text extraction
            if (options.extractText !== false) {
                results.text = await this.extractText(img);
            }

            // Announce results if enabled
            if (this.settings.autoReadResults) {
                this.announceResults(results);
            }

            return results;
        } catch (error) {
            console.error('Error scanning image:', error);
            throw error;
        }
    }

    async loadImage(imageData) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = imageData;
        });
    }

    async detectObjects(img) {
        if (!this.tfModel) {
            throw new Error('TensorFlow model not loaded');
        }

        const predictions = await this.tfModel.detect(img);
        
        // Filter by confidence threshold and limit results
        return predictions
            .filter(pred => pred.score >= this.settings.confidenceThreshold)
            .slice(0, this.settings.maxObjects)
            .map(pred => ({
                label: pred.class,
                confidence: Math.round(pred.score * 100),
                bbox: {
                    x: pred.bbox[0],
                    y: pred.bbox[1],
                    width: pred.bbox[2],
                    height: pred.bbox[3]
                }
            }));
    }

    async extractText(img) {
        if (!this.tesseractWorker) {
            throw new Error('Tesseract worker not initialized');
        }

        const { data: { text } } = await this.tesseractWorker.recognize(img);
        return text.trim();
    }

    announceResults(results) {
        let announcement = '';
        
        if (results.objects.length > 0) {
            const objectList = results.objects.map(obj => 
                `${obj.label} with ${obj.confidence}% confidence`
            ).join(', ');
            announcement += `Detected objects: ${objectList}. `;
        }
        
        if (results.text) {
            const textPreview = results.text.length > 100 ? 
                results.text.substring(0, 100) + '...' : results.text;
            announcement += `Extracted text: ${textPreview}`;
        }
        
        if (announcement) {
            chrome.runtime.sendMessage({
                action: 'speakText',
                text: announcement
            });
        }
    }

    // Camera and screenshot functionality
    async captureFromCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            
            return stream;
        } catch (error) {
            console.error('Error accessing camera:', error);
            throw new Error('Could not access camera. Please check permissions.');
        }
    }

    async captureScreenshot(tabId = null) {
        try {
            if (!tabId) {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                tabId = tab.id;
            }

            const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
            return dataUrl;
        } catch (error) {
            console.error('Error capturing screenshot:', error);
            throw new Error('Could not capture screenshot');
        }
    }

    // Process screenshot for current tab
    async scanCurrentPage() {
        try {
            const screenshot = await this.captureScreenshot();
            const results = await this.scanImage(screenshot);
            return results;
        } catch (error) {
            console.error('Error scanning current page:', error);
            throw error;
        }
    }

    // Process uploaded image
    async processUploadedImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const results = await this.scanImage(e.target.result);
                    resolve(results);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    // Draw bounding boxes on image (for visualization)
    drawBoundingBoxes(canvas, objects) {
        const ctx = canvas.getContext('2d');
        
        objects.forEach(obj => {
            const { x, y, width, height } = obj.bbox;
            
            // Draw rectangle
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
            
            // Draw label background
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            const text = `${obj.label} ${obj.confidence}%`;
            const textWidth = ctx.measureText(text).width;
            ctx.fillRect(x, y - 20, textWidth + 10, 20);
            
            // Draw label text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '14px Arial';
            ctx.fillText(text, x + 5, y - 5);
        });
    }

    // Clean up resources
    async cleanup() {
        if (this.tesseractWorker) {
            await this.tesseractWorker.terminate();
            this.tesseractWorker = null;
        }
        
        this.tfModel = null;
        this.isInitialized = false;
    }

    async saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        
        await new Promise((resolve) => {
            chrome.storage.sync.set({ objectScanning: this.settings }, resolve);
        });
    }

    // Export results
    exportResults(results, format = 'json') {
        switch (format) {
            case 'json':
                return JSON.stringify(results, null, 2);
            case 'csv':
                return this.convertToCSV(results);
            case 'text':
                return this.convertToText(results);
            default:
                return JSON.stringify(results);
        }
    }

    convertToCSV(results) {
        let csv = 'Object,Confidence%,X,Y,Width,Height\n';
        
        results.objects.forEach(obj => {
            csv += `"${obj.label}",${obj.confidence},${obj.bbox.x},${obj.bbox.y},${obj.bbox.width},${obj.bbox.height}\n`;
        });
        
        if (results.text) {
            csv += '\nExtracted Text\n';
            csv += `"${results.text.replace(/"/g, '""')}"\n`;
        }
        
        return csv;
    }

    convertToText(results) {
        let text = 'OBJECT DETECTION RESULTS\n';
        text += '=======================\n\n';
        
        results.objects.forEach(obj => {
            text += `- ${obj.label}: ${obj.confidence}% confidence\n`;
            text += `  Location: (${obj.bbox.x}, ${obj.bbox.y}) Size: ${obj.bbox.width}x${obj.bbox.height}\n\n`;
        });
        
        if (results.text) {
            text += 'EXTRACTED TEXT\n';
            text += '==============\n\n';
            text += results.text + '\n';
        }
        
        return text;
    }
}

// Initialize object scanning manager
const objectScanningManager = new ObjectScanningManager();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ObjectScanningManager;
}