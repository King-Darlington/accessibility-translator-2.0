/*
  Quick Integration Loader
  Ensures all voice control and extension integration is loaded properly
*/

(function() {
  'use strict';

  console.log('🎤 Accessibility Translator - Voice Control Loader');

  // Track loading status
  const loadingStatus = {
    voiceCommandsLib: false,
    voiceIntegration: false,
    extensionDetected: false,
    settingsManager: false
  };

  // Wait for VoiceCommandsLib
  function waitForVoiceLib(attempts = 0) {
    if (window.VoiceCommandsLib) {
      loadingStatus.voiceCommandsLib = true;
      console.log('✅ Voice Commands Library loaded');
      return true;
    }
    if (attempts < 50) { // 5 second timeout
      setTimeout(() => waitForVoiceLib(attempts + 1), 100);
      return false;
    }
    console.warn('⚠️ Voice Commands Library not found after timeout');
    return false;
  }

  // Wait for Voice Integration
  function waitForVoiceIntegration(attempts = 0) {
    if (window.voiceIntegration) {
      loadingStatus.voiceIntegration = true;
      console.log('✅ Voice Integration loaded');
      return true;
    }
    if (attempts < 30) { // 3 second timeout
      setTimeout(() => waitForVoiceIntegration(attempts + 1), 100);
      return false;
    }
    console.warn('⚠️ Voice Integration not loaded after timeout');
    return false;
  }

  // Detect Extension
  function detectExtension() {
    window.addEventListener('message', function handler(event) {
      if (event.source !== window) return;
      if (event.data.type === 'AT_EXTENSION_INSTALLED') {
        loadingStatus.extensionDetected = true;
        console.log('✅ Extension detected');
        window.removeEventListener('message', handler);
      }
    });

    // Send detection message
    try {
      window.postMessage({ type: 'AT_CHECK_EXTENSION' }, '*');
    } catch (e) {
      console.warn('Could not send extension check message');
    }

    // Give it 2 seconds to respond
    setTimeout(() => {
      if (!loadingStatus.extensionDetected) {
        console.log('ℹ️ Extension not detected (this is okay, site works standalone)');
      }
    }, 2000);
  }

  // Wait for Settings Manager
  function waitForSettingsManager(attempts = 0) {
    if (window.settingsManager && window.settingsManager.isInitialized) {
      loadingStatus.settingsManager = true;
      console.log('✅ Settings Manager initialized');
      return true;
    }
    if (attempts < 50) { // 5 second timeout
      setTimeout(() => waitForSettingsManager(attempts + 1), 100);
      return false;
    }
    console.log('ℹ️ Settings Manager not available (expected on non-settings pages)');
    return false;
  }

  // Report final status
  function reportStatus() {
    console.log('\n📊 Voice Control Status Report:');
    console.log('--------------------------------');
    console.log('Voice Commands Library:', loadingStatus.voiceCommandsLib ? '✅' : '❌');
    console.log('Voice Integration:', loadingStatus.voiceIntegration ? '✅' : '❌');
    console.log('Extension Detection:', loadingStatus.extensionDetected ? '✅' : 'ℹ️ (Optional)');
    console.log('Settings Manager:', loadingStatus.settingsManager ? '✅' : 'ℹ️ (Optional)');
    console.log('--------------------------------');

    const critical = loadingStatus.voiceCommandsLib && loadingStatus.voiceIntegration;
    if (critical) {
      console.log('🎤 Voice Control: READY');
      console.log('Say "help" to hear available commands');
    } else {
      console.warn('⚠️ Voice Control: PARTIAL');
    }
  }

  // Initialize loader
  function initialize() {
    console.log('Initializing voice control system...\n');

    // Start all checks in parallel
    waitForVoiceLib();
    waitForVoiceIntegration();
    detectExtension();
    waitForSettingsManager();

    // Report status after 6 seconds
    setTimeout(reportStatus, 6000);

    // Expose debug utilities
    window.VoiceControlDebug = {
      getStatus: () => loadingStatus,
      testMatch: (input) => {
        if (!window.VoiceCommandsLib) {
          console.warn('VoiceCommandsLib not loaded yet');
          return null;
        }
        const result = window.VoiceCommandsLib.matchInput(input);
        console.log(`Input: "${input}"`);
        console.log('Match:', result);
        return result;
      },
      listCommands: () => {
        if (!window.VoiceCommandsLib) {
          console.warn('VoiceCommandsLib not loaded yet');
          return null;
        }
        return window.VoiceCommandsLib.commands.map(c => ({
          id: c.id,
          action: c.action,
          phrases: c.phrases
        }));
      },
      startVoice: () => {
        if (window.voiceIntegration) {
          window.voiceIntegration.startListening();
          console.log('Voice listening started');
        } else {
          console.warn('Voice integration not loaded');
        }
      },
      stopVoice: () => {
        if (window.voiceIntegration) {
          window.voiceIntegration.stopListening();
          console.log('Voice listening stopped');
        } else {
          console.warn('Voice integration not loaded');
        }
      }
    };

    console.log('💡 Debug Utilities Available:');
    console.log('  VoiceControlDebug.getStatus()    - Check loading status');
    console.log('  VoiceControlDebug.testMatch(text) - Test voice matching');
    console.log('  VoiceControlDebug.listCommands() - Show all commands');
    console.log('  VoiceControlDebug.startVoice()   - Start listening');
    console.log('  VoiceControlDebug.stopVoice()    - Stop listening');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
