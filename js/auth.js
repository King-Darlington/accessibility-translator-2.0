// Enhanced Authentication Manager with Advanced Security & Offline Support
class AuthManager {
    constructor() {
        this.isLoggedIn = false;
        this.user = null;
        this.sessionExpiry = 24 * 60 * 60 * 1000; // 24 hours
        this.offlineQueue = [];
        this.init();
    }

    async init() {
        await this.checkAuthStatus();
        this.setupEventListeners();
        this.setupSecurityFeatures();
        this.startSessionMonitor();
    }

    async checkAuthStatus() {
        // Check multiple storage sources with priority
        const authSources = [
            () => this.checkLocalStorage(),
            () => this.checkSessionStorage(),
            () => this.checkIndexedDB(),
            () => this.checkServerSession()
        ];

        for (const source of authSources) {
            try {
                const result = await source();
                if (result) {
                    this.isLoggedIn = true;
                    this.updateUI();
                    await this.syncOfflineActions();
                    return true;
                }
            } catch (error) {
                console.warn(`Auth source failed:`, error);
            }
        }

        this.isLoggedIn = false;
        this.user = null;
        this.updateUI();
        return false;
    }

    async checkLocalStorage() {
        const userData = localStorage.getItem('user');
        const lastLogin = localStorage.getItem('lastLogin');
        
        if (userData && lastLogin) {
            const loginTime = parseInt(lastLogin);
            const currentTime = Date.now();
            
            // Check if session is expired
            if (currentTime - loginTime > this.sessionExpiry) {
                this.clearStorage();
                return false;
            }

            try {
                this.user = JSON.parse(userData);
                return this.validateUserData(this.user);
            } catch (e) {
                console.error('Error parsing user data:', e);
                this.clearStorage();
            }
        }
        return false;
    }

    checkSessionStorage() {
        const sessionUser = sessionStorage.getItem('sessionUser');
        if (sessionUser) {
            try {
                this.user = JSON.parse(sessionUser);
                return this.validateUserData(this.user);
            } catch (e) {
                sessionStorage.removeItem('sessionUser');
            }
        }
        return false;
    }

    async checkIndexedDB() {
        if (!window.indexedDB) return false;
        
        return new Promise((resolve) => {
            const request = indexedDB.open('AuthDB', 1);
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['users'], 'readonly');
                const store = transaction.objectStore('users');
                const getRequest = store.get('currentUser');
                
                getRequest.onsuccess = () => {
                    if (getRequest.result && this.validateUserData(getRequest.result)) {
                        this.user = getRequest.result;
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                };
                
                getRequest.onerror = () => resolve(false);
            };
            
            request.onerror = () => resolve(false);
        });
    }

    async checkServerSession() {
        if (!navigator.onLine) return false;

        try {
            const response = await this.fetchWithTimeout('auth/session-status.php?action=status', {
                method: 'GET',
                credentials: 'include'
            }, 5000);

            if (!response.ok) throw new Error('Session check failed');
            
            const data = await response.json();
            
            if (data.authenticated && data.user) {
                this.user = data.user;
                await this.saveToMultipleStorages(data.user);
                return true;
            }
        } catch (error) {
            console.log('Server session check failed:', error);
        }
        
        return false;
    }

    validateUserData(user) {
        return user && 
               typeof user === 'object' &&
               user.id && 
               user.email && 
               user.name;
    }

    setupEventListeners() {
        // Form event listeners with enhanced validation
        this.setupFormListeners();
        
        // Security event listeners
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
        window.addEventListener('storage', (e) => this.handleStorageChange(e));
        
        // Online/Offline detection
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Password visibility toggles
        this.setupPasswordToggles();
    }

    setupFormListeners() {
        const forms = {
            'signupForm': (e) => this.handleSignUp(e),
            'loginForm': (e) => this.handleLogin(e),
            'forgotPasswordForm': (e) => this.handleForgotPassword(e),
            'resetPasswordForm': (e) => this.handleResetPassword(e)
        };

        Object.entries(forms).forEach(([formId, handler]) => {
            const form = document.getElementById(formId);
            if (form) {
                form.addEventListener('submit', handler);
                
                // Real-time validation
                form.addEventListener('input', (e) => this.validateField(e.target));
            }
        });

        // Settings Button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.redirectToSettings());
        }

        // Social login buttons
        this.setupSocialLogins();
    }

    setupPasswordToggles() {
        document.querySelectorAll('.password-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const input = e.target.closest('.password-input').querySelector('input');
                const icon = e.target.querySelector('i');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.className = 'fas fa-eye-slash';
                    toggle.setAttribute('aria-label', 'Hide password');
                } else {
                    input.type = 'password';
                    icon.className = 'fas fa-eye';
                    toggle.setAttribute('aria-label', 'Show password');
                }
            });
        });
    }

    setupSocialLogins() {
        const socialButtons = {
            'googleLogin': 'google',
            'facebookLogin': 'facebook',
            'githubLogin': 'github'
        };

        Object.entries(socialButtons).forEach(([buttonId, provider]) => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => this.handleSocialLogin(provider));
            }
        });
    }

    setupSecurityFeatures() {
        // Setup security headers for future requests
        this.securityToken = this.generateSecurityToken();
        
        // Setup biometric authentication if available
        this.setupBiometricAuth();
    }

    generateSecurityToken() {
        return 'token_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    async setupBiometricAuth() {
        if (window.PublicKeyCredential) {
            try {
                const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                if (available) {
                    console.log('Biometric authentication available');
                    // Store capability for future use
                    localStorage.setItem('biometricAvailable', 'true');
                }
            } catch (error) {
                console.log('Biometric auth check failed:', error);
            }
        }
    }

    async handleSignUp(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const errorDiv = document.getElementById('signup-error');
        const submitBtn = form.querySelector('button[type="submit"]');
        
        // Enhanced client-side validation
        if (!this.validateSignUpForm(formData, errorDiv)) {
            return;
        }

        this.setButtonState(submitBtn, true, 'Creating Account...');

        try {
            const response = await this.fetchWithTimeout('auth/register.php', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Security-Token': this.securityToken
                }
            }, 10000);

            const data = await response.json();
            
            if (data.success) {
                await this.handleSuccessfulAuth(data.user, 'Registration');
                
                // Track signup event
                this.trackAuthEvent('signup_success');
                
            } else {
                this.handleAuthError(data, errorDiv, 'signup');
            }
        } catch (error) {
            this.handleNetworkError(error, errorDiv, 'signup');
        } finally {
            this.setButtonState(submitBtn, false, 'Sign up');
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const errorDiv = document.getElementById('login-error');
        const submitBtn = form.querySelector('button[type="submit"]');

        this.setButtonState(submitBtn, true, 'Signing In...');

        try {
            const response = await this.fetchWithTimeout('auth/login.php', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Security-Token': this.securityToken
                }
            }, 10000);
            
            const data = await response.json();
            
            if (data.success) {
                await this.handleSuccessfulAuth(data.user, 'Login');
                
                // Track login event
                this.trackAuthEvent('login_success');
                
            } else {
                this.handleAuthError(data, errorDiv, 'login');
            }
        } catch (error) {
            this.handleNetworkError(error, errorDiv, 'login');
        } finally {
            this.setButtonState(submitBtn, false, 'Login');
        }
    }

    async handleSocialLogin(provider) {
        try {
            // Redirect to social auth endpoint
            const response = await fetch(`auth/social-login.php?provider=${provider}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Security-Token': this.securityToken
                }
            });
            
            const data = await response.json();
            
            if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
            } else {
                throw new Error('No redirect URL provided');
            }
        } catch (error) {
            this.showError(null, `Social login failed: ${error.message}`);
        }
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const submitBtn = form.querySelector('button[type="submit"]');

        this.setButtonState(submitBtn, true, 'Sending...');

        try {
            const response = await fetch('auth/forgot-password.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Password reset instructions sent to your email');
            } else {
                this.showError(document.getElementById('forgot-password-error'), data.error || 'Failed to send reset instructions');
            }
        } catch (error) {
            this.showError(document.getElementById('forgot-password-error'), 'Network error. Please try again.');
        } finally {
            this.setButtonState(submitBtn, false, 'Reset Password');
        }
    }

    async handleResetPassword(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const submitBtn = form.querySelector('button[type="submit"]');

        this.setButtonState(submitBtn, true, 'Resetting...');

        try {
            const response = await fetch('auth/reset-password.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Password reset successfully! Redirecting to login...');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            } else {
                this.showError(document.getElementById('reset-password-error'), data.error || 'Password reset failed');
            }
        } catch (error) {
            this.showError(document.getElementById('reset-password-error'), 'Network error. Please try again.');
        } finally {
            this.setButtonState(submitBtn, false, 'Reset Password');
        }
    }

    async handleSuccessfulAuth(user, action) {
        this.user = user;
        this.isLoggedIn = true;
        
        await this.saveToMultipleStorages(user);
        await this.loadUserPreferences();
        
        this.showSuccess(`${action} successful! Redirecting...`);
        
        // Voice feedback
        this.speakFeedback(`${action} successful. Welcome${action === 'Login' ? ' back' : ''}.`);
        
        // Track successful authentication
        this.trackAuthEvent(`${action.toLowerCase()}_success`);
        
        // Redirect after delay
        setTimeout(() => {
            const redirectUrl = this.getRedirectUrl();
            window.location.href = redirectUrl;
        }, action === 'Registration' ? 2000 : 1500);
    }

    handleAuthError(data, errorElement, action) {
        const errorMsg = data.errors ? 
            Object.values(data.errors).join(', ') : 
            (data.error || `${action} failed`);
        
        this.showError(errorElement, errorMsg);
        
        // Track failed attempt
        this.trackAuthEvent(`${action}_failed`, { reason: errorMsg });
        
        // Security: Check for multiple failed attempts
        this.recordFailedAttempt(action);
    }

    handleNetworkError(error, errorElement, action) {
        console.error(`${action} error:`, error);
        
        if (!navigator.onLine) {
            this.handleOfflineAuth(action, errorElement);
        } else {
            this.showError(errorElement, `${action} failed. Please check your connection and try again.`);
        }
        
        this.trackAuthEvent(`${action}_network_error`);
    }

    handleOfflineAuth(action, errorElement) {
        if (action === 'login') {
            // Check for offline credentials
            const savedUser = localStorage.getItem('user');
            if (savedUser && this.validateUserData(JSON.parse(savedUser))) {
                this.user = JSON.parse(savedUser);
                this.isLoggedIn = true;
                this.showSuccess('Offline login successful!');
                setTimeout(() => {
                    window.location.href = 'home.html';
                }, 1000);
            } else {
                this.showError(errorElement, 'Login failed. You are offline and no valid saved credentials found.');
            }
        } else {
            this.showError(errorElement, `${action} failed. You are offline. Please try again when online.`);
        }
    }

    validateSignUpForm(formData, errorDiv) {
        const password = formData.get('password');
        const confirmPassword = formData.get('password_confirmation');
        const email = formData.get('email');
        const terms = formData.get('terms');

        const errors = [];

        // Password validation
        if (password !== confirmPassword) {
            errors.push('Passwords do not match');
        }
        if (password.length < 8) {
            errors.push('Password must be at least 8 characters');
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password)) {
            errors.push('Password must contain uppercase, lowercase, number and special character');
        }

        // Email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Please enter a valid email address');
        }

        // Terms agreement
        if (!terms) {
            errors.push('You must agree to the terms and conditions');
        }

        if (errors.length > 0) {
            this.showError(errorDiv, errors.join('. '));
            return false;
        }

        return true;
    }

    validateField(field) {
        const errorElement = field.parentNode.querySelector('.field-error');
        
        if (!errorElement) return;

        let error = '';
        
        switch (field.type) {
            case 'email':
                if (field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
                    error = 'Please enter a valid email address';
                }
                break;
            case 'password':
                if (field.value && field.value.length < 8) {
                    error = 'Password must be at least 8 characters';
                }
                break;
        }

        if (error) {
            errorElement.textContent = error;
            errorElement.style.display = 'block';
            field.classList.add('error');
        } else {
            errorElement.style.display = 'none';
            field.classList.remove('error');
        }
    }

    async handleLogout() {
        // Confirm logout
        if (!confirm('Are you sure you want to logout?')) {
            return;
        }

        try {
            if (navigator.onLine) {
                await this.fetchWithTimeout('auth/logout.php', {
                    method: 'POST',
                    headers: {
                        'X-Security-Token': this.securityToken
                    }
                }, 5000);
            }
        } catch (error) {
            console.log('Logout API call failed, clearing local data anyway');
        } finally {
            await this.clearAllStorage();
            this.isLoggedIn = false;
            this.user = null;

            // Track logout event
            this.trackAuthEvent('logout');

            // Redirect to login page
            window.location.href = 'index.html';
        }
    }

    redirectToSettings() {
        window.location.href = 'settings.html';
    }

    async saveToMultipleStorages(user) {
        // Save to localStorage
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('lastLogin', Date.now().toString());
        
        // Save to sessionStorage for current session
        sessionStorage.setItem('sessionUser', JSON.stringify(user));
        
        // Save to IndexedDB for offline access
        await this.saveToIndexedDB(user);
    }

    async saveToIndexedDB(user) {
        if (!window.indexedDB) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AuthDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['users'], 'readwrite');
                const store = transaction.objectStore('users');
                store.put(user, 'currentUser');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('users')) {
                    db.createObjectStore('users');
                }
            };
        });
    }

    async clearAllStorage() {
        // Clear all storage locations
        localStorage.removeItem('user');
        localStorage.removeItem('lastLogin');
        localStorage.removeItem('userPreferences');
        localStorage.removeItem('failedAttempts');
        
        sessionStorage.removeItem('sessionUser');
        
        // Clear IndexedDB
        if (window.indexedDB) {
            const request = indexedDB.deleteDatabase('AuthDB');
            request.onsuccess = () => console.log('Auth IndexedDB cleared');
        }
    }

    async loadUserPreferences() {
        if (!this.isLoggedIn) return;
        
        try {
            const response = await this.fetchWithTimeout('api/preferences/get.php', {}, 5000);
            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('userPreferences', JSON.stringify(data.preferences));
                this.applyUserPreferences(data.preferences);
            }
        } catch (error) {
            console.log('Failed to load preferences, using cached version');
            const cachedPrefs = localStorage.getItem('userPreferences');
            if (cachedPrefs) {
                try {
                    this.applyUserPreferences(JSON.parse(cachedPrefs));
                } catch (e) {
                    console.error('Error parsing cached preferences:', e);
                }
            }
        }
    }

    applyUserPreferences(preferences) {
        // Apply accessibility settings
        if (preferences.theme && window.settingsManager) {
            window.settingsManager.applyTheme(preferences.theme);
        }
        
        if (preferences.color_filter && typeof applyColorFilter === 'function') {
            applyColorFilter(preferences.color_filter);
        }
        
        if (preferences.tts_speed && window.ttsManager) {
            window.ttsManager.setRate(preferences.tts_speed);
        }
        
        if (preferences.tts_pitch && window.ttsManager) {
            window.ttsManager.setPitch(preferences.tts_pitch);
        }
        
        // Apply language preference
        if (preferences.language) {
            document.documentElement.lang = preferences.language;
        }
    }

    updateUI() {
        this.updateNavigation();
        this.updateAuthDependentElements();
        this.updateUserProfile();
    }

    updateNavigation() {
        const settingsBtn = document.getElementById('settingsBtn');
        const userIcon = document.querySelector('#settingsBtn i');

        if (settingsBtn && userIcon) {
            if (this.isLoggedIn && this.user) {
                settingsBtn.setAttribute('title', `Settings - Logged in as ${this.user.name}`);
                settingsBtn.setAttribute('aria-label', `Settings: ${this.user.name}`);
                userIcon.style.color = '#10b981';
            } else {
                settingsBtn.setAttribute('title', 'Settings');
                settingsBtn.setAttribute('aria-label', 'Settings');
                userIcon.style.color = '';
            }
        }
    }

    updateAuthDependentElements() {
        const authElements = document.querySelectorAll('[data-auth-only]');
        const unauthElements = document.querySelectorAll('[data-unauth-only]');
        
        authElements.forEach(el => {
            el.style.display = this.isLoggedIn ? (el.dataset.authDisplay || 'block') : 'none';
        });
        
        unauthElements.forEach(el => {
            el.style.display = this.isLoggedIn ? 'none' : (el.dataset.unauthDisplay || 'block');
        });
    }

    updateUserProfile() {
        const profileElements = document.querySelectorAll('[data-user-profile]');
        
        profileElements.forEach(el => {
            const property = el.dataset.userProfile;
            if (this.user && this.user[property]) {
                el.textContent = this.user[property];
            }
        });
    }

    async handleOnline() {
        console.log('Back online - syncing authentication data');
        await this.checkAuthStatus();
        await this.syncOfflineActions();
    }

    handleOffline() {
        console.log('Offline - using cached authentication');
        this.showStatus('Offline mode - using cached data', 'warning');
    }

    async syncOfflineActions() {
        if (this.offlineQueue.length === 0) return;
        
        console.log(`Syncing ${this.offlineQueue.length} offline actions`);
        
        for (const action of this.offlineQueue) {
            try {
                await this.processOfflineAction(action);
            } catch (error) {
                console.warn('Failed to sync offline action:', action, error);
            }
        }
        
        this.offlineQueue = [];
    }

    async processOfflineAction(action) {
        // Process queued offline actions like preference updates
        // Implementation depends on specific application needs
    }

    startSessionMonitor() {
        // Monitor session expiry
        setInterval(() => {
            if (this.isLoggedIn) {
                const lastLogin = localStorage.getItem('lastLogin');
                if (lastLogin && Date.now() - parseInt(lastLogin) > this.sessionExpiry) {
                    this.showStatus('Session expired. Please login again.', 'warning');
                    this.handleLogout();
                }
            }
        }, 60000); // Check every minute
    }

    handleVisibilityChange() {
        if (document.visibilityState === 'visible' && this.isLoggedIn) {
            // Refresh auth status when tab becomes visible
            this.checkAuthStatus();
        }
    }

    handleStorageChange(e) {
        if (e.key === 'user' && !e.newValue) {
            // User data was cleared from another tab
            this.isLoggedIn = false;
            this.user = null;
            this.updateUI();
        }
    }

    recordFailedAttempt(action) {
        const attempts = JSON.parse(localStorage.getItem('failedAttempts') || '{}');
        const now = Date.now();
        
        if (!attempts[action]) {
            attempts[action] = [];
        }
        
        attempts[action] = attempts[action].filter(time => now - time < 15 * 60 * 1000); // Keep last 15 minutes
        attempts[action].push(now);
        
        localStorage.setItem('failedAttempts', JSON.stringify(attempts));
        
        // Implement rate limiting if too many attempts
        if (attempts[action].length > 5) {
            this.showError(null, 'Too many failed attempts. Please wait 15 minutes.');
            // Disable form for 15 minutes
            this.disableAuthForms(15 * 60 * 1000);
        }
    }

    disableAuthForms(duration) {
        document.querySelectorAll('#loginForm, #signupForm').forEach(form => {
            form.style.opacity = '0.5';
            form.querySelectorAll('input, button').forEach(el => {
                el.disabled = true;
            });
        });
        
        setTimeout(() => {
            document.querySelectorAll('#loginForm, #signupForm').forEach(form => {
                form.style.opacity = '1';
                form.querySelectorAll('input, button').forEach(el => {
                    el.disabled = false;
                });
            });
        }, duration);
    }

    fetchWithTimeout(url, options = {}, timeout = 10000) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
        ]);
    }

    showError(element, message) {
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
            element.className = 'error-message active';
            
            setTimeout(() => {
                element.style.display = 'none';
            }, 5000);
        } else {
            // Global error display
            this.showStatus(message, 'error');
        }
        
        console.error('Auth Error:', message);
    }

    showSuccess(message) {
        this.showStatus(message, 'success');
    }

    showStatus(message, type = 'info') {
        // Remove existing status messages
        const existing = document.querySelectorAll('.global-status-message');
        existing.forEach(el => el.remove());
        
        const statusDiv = document.createElement('div');
        statusDiv.className = `global-status-message ${type}`;
        statusDiv.textContent = message;
        statusDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            z-index: 10000;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            max-width: 400px;
            transition: all 0.3s ease;
        `;
        
        if (type === 'success') statusDiv.style.background = '#10b981';
        else if (type === 'error') statusDiv.style.background = '#ef4444';
        else if (type === 'warning') statusDiv.style.background = '#f59e0b';
        else statusDiv.style.background = '#3b82f6';
        
        document.body.appendChild(statusDiv);
        
        setTimeout(() => {
            statusDiv.style.opacity = '0';
            statusDiv.style.transform = 'translateX(100px)';
            setTimeout(() => {
                if (statusDiv.parentNode) {
                    statusDiv.remove();
                }
            }, 300);
        }, type === 'error' ? 10000 : 5000);
    }

    setButtonState(button, disabled, text) {
        if (button) {
            button.disabled = disabled;
            const originalHTML = button.dataset.originalHtml || button.innerHTML;
            
            if (disabled) {
                button.dataset.originalHtml = originalHTML;
                button.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>${text}</span>`;
            } else {
                button.innerHTML = originalHTML;
                delete button.dataset.originalHtml;
            }
        }
    }

    speakFeedback(message) {
        if ('speechSynthesis' in window && window.settingsManager) {
            const ttsSettings = window.settingsManager.getSetting('tts');
            const utterance = new SpeechSynthesisUtterance(message);
            
            if (ttsSettings) {
                utterance.rate = ttsSettings.rate || 1;
                utterance.pitch = ttsSettings.pitch || 1;
                utterance.volume = (ttsSettings.volume || 100) / 100;
            }
            
            speechSynthesis.speak(utterance);
        }
    }

    trackAuthEvent(event, data = {}) {
        // Analytics tracking
        if (typeof gtag !== 'undefined') {
            gtag('event', event, data);
        }
        
        // Custom analytics
        const analyticsData = {
            event,
            userId: this.user?.id,
            timestamp: new Date().toISOString(),
            ...data
        };
        
        console.log('Auth Event:', analyticsData);
        
        // Store for offline analytics
        this.queueAnalyticsEvent(analyticsData);
    }

    queueAnalyticsEvent(eventData) {
        const queue = JSON.parse(localStorage.getItem('analyticsQueue') || '[]');
        queue.push(eventData);
        localStorage.setItem('analyticsQueue', JSON.stringify(queue.slice(-50))); // Keep last 50 events
    }

    getRedirectUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('redirect') || 'home.html';
    }

    // Public API
    getUser() {
        return this.user;
    }

    isAuthenticated() {
        return this.isLoggedIn;
    }

    getUserId() {
        return this.user?.id;
    }

    getUserName() {
        return this.user?.name;
    }

    getUserEmail() {
        return this.user?.email;
    }

    // Security methods
    hasPermission(permission) {
        return this.user?.permissions?.includes(permission) || false;
    }

    isAdmin() {
        return this.user?.role === 'admin';
    }
}

// Initialize auth manager
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}