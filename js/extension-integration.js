// Complete Extension Integration for Main Website
// Add this file as: js/extension-integration.js

(function() {
  'use strict';
  
  let extensionDetected = false;
  let statusBanner = null;
  
  // Initialize extension detection
  function init() {
    checkForExtension();
    setupCommunication();
    addExtensionButton();
  }
  
  // Check if extension is installed
  function checkForExtension() {
    // Listen for extension response
    window.addEventListener('message', handleExtensionMessage);
    
    // Send check message
    setTimeout(() => {
      window.postMessage({ type: 'AT_CHECK_EXTENSION' }, '*');
      
      // If no response after 2 seconds, assume not installed
      setTimeout(() => {
        if (!extensionDetected) {
          showInstallPrompt();
        }
      }, 2000);
    }, 1000);
  }
  
  // Handle messages from extension
  function handleExtensionMessage(event) {
    // Verify message origin
    if (event.source !== window) return;
    
    const message = event.data;
    
    switch(message.type) {
      case 'AT_EXTENSION_INSTALLED':
        extensionDetected = true;
        showExtensionActive();
        updateExtensionButton(true);
        break;
        
      case 'AT_FEATURE_USED':
        trackFeatureUsage(message.feature);
        break;
        
      case 'AT_REQUEST_CONFIG':
        sendConfigToExtension();
        break;
    }
  }
  
  // Setup bidirectional communication
  function setupCommunication() {
    // Allow website to trigger extension features
    window.triggerExtensionFeature = function(feature) {
      window.postMessage({
        type: 'AT_TRIGGER_FEATURE',
        feature: feature
      }, '*');
    };
    
    // Allow website to open extension modal
    window.openExtensionModal = function() {
      window.postMessage({
        type: 'AT_OPEN_MODAL'
      }, '*');
    };
  }
  
  // Show extension active banner
  function showExtensionActive() {
    if (statusBanner) return; // Already showing
    
    statusBanner = document.createElement('div');
    statusBanner.id = 'at-extension-banner';
    statusBanner.innerHTML = `
      <div class="at-banner-content">
        <div class="at-banner-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="at-banner-text">
          <strong>Extension Active</strong>
          <span>Accessibility tools ready</span>
        </div>
        <button id="at-banner-open-btn" class="at-banner-btn">
          Open Tools
        </button>
        <button id="at-banner-close" class="at-banner-close">×</button>
      </div>
    `;
    
    document.body.appendChild(statusBanner);
    
    // Add event listeners
    document.getElementById('at-banner-open-btn').addEventListener('click', () => {
      window.openExtensionModal();
    });
    
    document.getElementById('at-banner-close').addEventListener('click', () => {
      closeBanner();
    });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (statusBanner) {
        statusBanner.classList.add('at-banner-hiding');
        setTimeout(closeBanner, 500);
      }
    }, 5000);
  }
  
  // Show install prompt
  function showInstallPrompt() {
    if (statusBanner) return;
    
    statusBanner = document.createElement('div');
    statusBanner.id = 'at-extension-banner';
    statusBanner.className = 'at-banner-install';
    statusBanner.innerHTML = `
      <div class="at-banner-content">
        <div class="at-banner-icon at-banner-icon-install">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 4v16m0 0l-4-4m4 4l4-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="at-banner-text">
          <strong>Get Browser Extension</strong>
          <span>Use our tools on any website</span>
        </div>
        <button id="at-banner-install-btn" class="at-banner-btn at-banner-btn-install">
          Install Now
        </button>
        <button id="at-banner-close" class="at-banner-close">×</button>
      </div>
    `;
    
    document.body.appendChild(statusBanner);
    
    // Add event listeners
    document.getElementById('at-banner-install-btn').addEventListener('click', () => {
      openExtensionModal();
    });
    
    document.getElementById('at-banner-close').addEventListener('click', () => {
      closeBanner();
      // Remember user dismissed
      localStorage.setItem('at-extension-prompt-dismissed', 'true');
    });
    
    // Check if user previously dismissed
    if (localStorage.getItem('at-extension-prompt-dismissed')) {
      closeBanner();
    }
  }
  
  function closeBanner() {
    if (statusBanner) {
      statusBanner.remove();
      statusBanner = null;
    }
  }
  
  // Add extension button to navbar
  function addExtensionButton() {
    const navbar = document.querySelector('.navbar-nav');
    if (!navbar) return;
    
    const li = document.createElement('li');
    li.className = 'nav-item';
    li.innerHTML = `
      <a class="nav-link" href="#" id="extension-nav-link" data-link="extension">
        <i class="fas fa-puzzle-piece"></i>
        <span class="extension-status-indicator"></span>
        Extension
      </a>
    `;
    
    // Insert before logout button
    const logoutBtn = document.querySelector('#logoutBtn')?.parentElement;
    if (logoutBtn) {
      navbar.insertBefore(li, logoutBtn);
    } else {
      navbar.appendChild(li);
    }
    
    // Add click handler
    document.getElementById('extension-nav-link').addEventListener('click', (e) => {
      e.preventDefault();
      if (extensionDetected) {
        window.openExtensionModal();
      } else {
        openExtensionModal();
      }
    });
  }
  
  function updateExtensionButton(active) {
    const indicator = document.querySelector('.extension-status-indicator');
    if (indicator) {
      indicator.classList.add(active ? 'active' : 'inactive');
    }
  }
  
  // Open extension info modal
  function openExtensionModal() {
    // Check if modal exists
    let modal = document.getElementById('extensionInfoModal');
    
    if (!modal) {
      modal = createExtensionModal();
      document.body.appendChild(modal);
    }
    
    // Show modal using Bootstrap
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }
  
  function createExtensionModal() {
    const modal = document.createElement('div');
    modal.id = 'extensionInfoModal';
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content at-extension-modal">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="fas fa-puzzle-piece"></i>
              Browser Extension
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="extension-hero">
              <div class="extension-hero-icon">
                <i class="fas fa-universal-access"></i>
              </div>
              <h3>Access Accessibility Tools Anywhere</h3>
              <p>Install our browser extension to use powerful accessibility features on any website you visit.</p>
            </div>
            
            <div class="extension-features">
              <h4>What You Get:</h4>
              <div class="feature-list">
                <div class="feature-item">
                  <i class="fas fa-volume-up"></i>
                  <div>
                    <strong>Text-to-Speech</strong>
                    <span>Read any webpage aloud with natural voices</span>
                  </div>
                </div>
                <div class="feature-item">
                  <i class="fas fa-palette"></i>
                  <div>
                    <strong>Color Filters</strong>
                    <span>Apply visual filters for better readability</span>
                  </div>
                </div>
                <div class="feature-item">
                  <i class="fas fa-search-plus"></i>
                  <div>
                    <strong>Text Magnification</strong>
                    <span>Increase text size on any page</span>
                  </div>
                </div>
                <div class="feature-item">
                  <i class="fas fa-image"></i>
                  <div>
                    <strong>Image Descriptions</strong>
                    <span>Get AI-powered descriptions of images</span>
                  </div>
                </div>
                <div class="feature-item">
                  <i class="fas fa-link"></i>
                  <div>
                    <strong>Link Reader</strong>
                    <span>Hear all links on a page read aloud</span>
                  </div>
                </div>
                <div class="feature-item">
                  <i class="fas fa-file-alt"></i>
                  <div>
                    <strong>Page Simplification</strong>
                    <span>Remove distractions for easier reading</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="extension-cta">
              <h4>Get Started Now</h4>
              <div class="browser-buttons">
                <a href="YOUR_CHROME_STORE_URL" target="_blank" class="browser-btn chrome-btn">
                  <i class="fab fa-chrome"></i>
                  <div>
                    <strong>Chrome</strong>
                    <span>Install for Chrome</span>
                  </div>
                </a>
                <a href="YOUR_FIREFOX_STORE_URL" target="_blank" class="browser-btn firefox-btn">
                  <i class="fab fa-firefox"></i>
                  <div>
                    <strong>Firefox</strong>
                    <span>Install for Firefox</span>
                  </div>
                </a>
                <a href="YOUR_EDGE_STORE_URL" target="_blank" class="browser-btn edge-btn">
                  <i class="fab fa-edge"></i>
                  <div>
                    <strong>Edge</strong>
                    <span>Install for Edge</span>
                  </div>
                </a>
              </div>
            </div>
            
            <div class="extension-info">
              <p><i class="fas fa-shield-alt"></i> <strong>100% Free & Secure</strong> - No account required</p>
              <p><i class="fas fa-lock"></i> <strong>Privacy First</strong> - Your data stays on your device</p>
              <p><i class="fas fa-sync"></i> <strong>Auto-Updates</strong> - Always get the latest features</p>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    `;
    
    return modal;
  }
  
  // Send configuration to extension
  function sendConfigToExtension() {
    const config = {
      type: 'AT_CONFIG',
      siteUrl: window.location.origin,
      apiEndpoint: 'YOUR_API_ENDPOINT',
      features: {
        tts: true,
        colorFilters: true,
        magnifier: true,
        imageDesc: true,
        linkReader: true,
        simplify: true
      },
      theme: {
        primary: '#6366f1',
        secondary: '#06b6d4',
        accent: '#a855f7'
      }
    };
    
    window.postMessage(config, '*');
  }
  
  // Track feature usage
  function trackFeatureUsage(feature) {
    // Send to analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', 'extension_feature_used', {
        'feature_name': feature
      });
    }
    
    console.log('Extension feature used:', feature);
  }
  
  // Add CSS styles
  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'at-extension-styles';
    style.textContent = `
      /* Extension Banner */
      #at-extension-banner {
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 999998;
        animation: slideInRight 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      }
      
      #at-extension-banner.at-banner-hiding {
        animation: slideOutRight 0.5s ease;
      }
      
      .at-banner-content {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        padding: 15px 20px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        gap: 12px;
        color: white;
        min-width: 320px;
      }
      
      #at-extension-banner.at-banner-install .at-banner-content {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      
      .at-banner-icon {
        width: 40px;
        height: 40px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      
      .at-banner-icon svg {
        width: 24px;
        height: 24px;
      }
      
      .at-banner-text {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      
      .at-banner-text strong {
        font-size: 16px;
        font-weight: 600;
      }
      
      .at-banner-text span {
        font-size: 13px;
        opacity: 0.9;
      }
      
      .at-banner-btn {
        background: white;
        color: #10b981;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.3s ease;
        white-space: nowrap;
      }
      
      .at-banner-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }
      
      .at-banner-btn-install {
        color: #667eea;
      }
      
      .at-banner-close {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        padding: 0;
      }
      
      .at-banner-close:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: rotate(90deg);
      }
      
      /* Extension Status Indicator */
      .extension-status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
        margin-left: 5px;
        position: relative;
        top: -2px;
      }
      
      .extension-status-indicator.active {
        background: #10b981;
        box-shadow: 0 0 8px #10b981;
        animation: pulse 2s ease-in-out infinite;
      }
      
      .extension-status-indicator.inactive {
        background: #6b7280;
      }
      
      /* Extension Modal */
      .at-extension-modal .modal-content {
        background: linear-gradient(135deg, rgba(17, 24, 39, 0.98) 0%, rgba(31, 41, 55, 0.98) 100%);
        border: 2px solid rgba(99, 102, 241, 0.4);
        border-radius: 20px;
        color: #f3f4f6;
      }
      
      .at-extension-modal .modal-header {
        border-bottom: 1px solid rgba(99, 102, 241, 0.3);
        padding: 20px 30px;
      }
      
      .at-extension-modal .modal-title {
        color: #06b6d4;
        font-size: 24px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .at-extension-modal .btn-close {
        filter: invert(1);
      }
      
      .at-extension-modal .modal-body {
        padding: 30px;
      }
      
      .extension-hero {
        text-align: center;
        padding: 30px 0;
        border-bottom: 1px solid rgba(99, 102, 241, 0.2);
        margin-bottom: 30px;
      }
      
      .extension-hero-icon {
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
        font-size: 40px;
        color: white;
        box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
      }
      
      .extension-hero h3 {
        color: #06b6d4;
        font-size: 28px;
        margin-bottom: 15px;
      }
      
      .extension-hero p {
        color: #9ca3af;
        font-size: 16px;
        max-width: 600px;
        margin: 0 auto;
      }
      
      .extension-features h4 {
        color: #06b6d4;
        font-size: 20px;
        margin-bottom: 20px;
      }
      
      .feature-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 15px;
        margin-bottom: 30px;
      }
      
      .feature-item {
        display: flex;
        gap: 15px;
        padding: 15px;
        background: rgba(31, 41, 55, 0.6);
        border-radius: 12px;
        border: 1px solid rgba(99, 102, 241, 0.2);
        transition: all 0.3s ease;
      }
      
      .feature-item:hover {
        border-color: rgba(6, 182, 212, 0.5);
        transform: translateY(-3px);
        box-shadow: 0 5px 15px rgba(102, 126, 234, 0.2);
      }
      
      .feature-item i {
        font-size: 24px;
        color: #667eea;
        flex-shrink: 0;
      }
      
      .feature-item strong {
        display: block;
        color: #f3f4f6;
        margin-bottom: 3px;
      }
      
      .feature-item span {
        color: #9ca3af;
        font-size: 14px;
      }
      
      .extension-cta {
        margin: 30px 0;
        padding: 30px;
        background: rgba(102, 126, 234, 0.1);
        border-radius: 15px;
        border: 1px solid rgba(99, 102, 241, 0.3);
      }
      
      .extension-cta h4 {
        color: #06b6d4;
        font-size: 20px;
        margin-bottom: 20px;
        text-align: center;
      }
      
      .browser-buttons {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
      }
      
      .browser-btn {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 15px 20px;
        background: rgba(17, 24, 39, 0.8);
        border: 2px solid rgba(99, 102, 241, 0.3);
        border-radius: 12px;
        text-decoration: none;
        color: #f3f4f6;
        transition: all 0.3s ease;
      }
      
      .browser-btn:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        color: #f3f4f6;
      }
      
      .browser-btn i {
        font-size: 32px;
      }
      
      .chrome-btn:hover {
        border-color: #4285f4;
        box-shadow: 0 10px 25px rgba(66, 133, 244, 0.3);
      }
      
      .firefox-btn:hover {
        border-color: #ff7139;
        box-shadow: 0 10px 25px rgba(255, 113, 57, 0.3);
      }
      
      .edge-btn:hover {
        border-color: #0078d4;
        box-shadow: 0 10px 25px rgba(0, 120, 212, 0.3);
      }
      
      .browser-btn strong {
        display: block;
        font-size: 16px;
      }
      
      .browser-btn span {
        display: block;
        font-size: 13px;
        color: #9ca3af;
      }
      
      .extension-info {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid rgba(99, 102, 241, 0.2);
      }
      
      .extension-info p {
        color: #9ca3af;
        font-size: 14px;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .extension-info i {
        color: #667eea;
      }
      
      /* Animations */
      @keyframes slideInRight {
        from {
          opacity: 0;
          transform: translateX(100%);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      
      @keyframes slideOutRight {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100%);
        }
      }
      
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }
      
      /* Mobile Responsive */
      @media (max-width: 768px) {
        #at-extension-banner {
          right: 10px;
          left: 10px;
        }
        
        .at-banner-content {
          min-width: auto;
          flex-wrap: wrap;
        }
        
        .browser-buttons {
          grid-template-columns: 1fr;
        }
        
        .feature-list {
          grid-template-columns: 1fr;
        }
      }
    `;
    
    document.head.appendChild(style);
  }
  
  // Initialize everything
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectStyles();
      init();
    });
  } else {
    injectStyles();
    init();
  }
  
  // Expose public API
  window.AccessibilityExtension = {
    detected: () => extensionDetected,
    openModal: openExtensionModal,
    triggerFeature: (feature) => window.triggerExtensionFeature(feature)
  };
})();