// Enhanced Contact Form with Real Submission
class ContactFormManager {
    constructor() {
        this.form = null;
        this.init();
    }

    init() {
        this.form = document.getElementById('contactForm');
        if (!this.form) return;

        this.setupEventListeners();
        this.setupAccessibility();
    }

    setupEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Real-time validation
        const inputs = this.form.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });

        // Form field animations
        this.setupFieldAnimations();
    }

    setupAccessibility() {
        // Add ARIA labels and descriptions
        const fields = {
            'name': 'Your full name',
            'email': 'Your email address',
            'subject': 'Subject of your message',
            'message': 'Your message details'
        };

        Object.entries(fields).forEach(([id, description]) => {
            const field = document.getElementById(id);
            if (field) {
                field.setAttribute('aria-describedby', `${id}-description`);
                
                const desc = document.createElement('div');
                desc.id = `${id}-description`;
                desc.className = 'field-description';
                desc.textContent = description;
                desc.style.cssText = 'font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem;';
                
                field.parentNode.insertBefore(desc, field.nextSibling);
            }
        });
    }

    setupFieldAnimations() {
        const formInputs = document.querySelectorAll('.form-control-custom');
        formInputs.forEach(input => {
            input.addEventListener('focus', () => {
                input.parentElement.style.transform = 'translateX(5px)';
                input.parentElement.style.borderColor = '#06b6d4';
            });
            
            input.addEventListener('blur', () => {
                input.parentElement.style.transform = 'translateX(0)';
                input.parentElement.style.borderColor = '';
            });
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        const formData = this.getFormData();
        const submitBtn = this.form.querySelector('.submit-btn');
        const formMessage = document.getElementById('formMessage');

        // Disable submit button
        this.setButtonState(submitBtn, true, 'Sending...');

        try {
            const response = await this.submitForm(formData);
            
            if (response.success) {
                this.showSuccess('Thank you! Your message has been sent successfully. We\'ll get back to you soon.', formMessage);
                this.form.reset();
                this.speakSuccess();
                this.trackSubmission('success');
            } else {
                throw new Error(response.error || 'Submission failed');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            this.showError('Sorry, there was an error sending your message. Please try again later.', formMessage);
            this.trackSubmission('error', error.message);
        } finally {
            this.setButtonState(submitBtn, false, 'Send Message');
        }
    }

    getFormData() {
        return {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            subject: document.getElementById('subject').value.trim(),
            message: document.getElementById('message').value.trim(),
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            page: window.location.href
        };
    }

    async submitForm(formData) {
        // Try to submit to server if online
        if (navigator.onLine) {
            try {
                const response = await fetch('api/contact/submit.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                return await response.json();
            } catch (error) {
                console.log('Server submission failed, saving offline');
            }
        }

        // Save offline for later submission
        await this.saveOffline(formData);
        return { success: true, message: 'Message saved offline and will be sent when online' };
    }

    async saveOffline(formData) {
        const offlineMessages = JSON.parse(localStorage.getItem('offlineContactMessages') || '[]');
        offlineMessages.push({
            ...formData,
            id: Date.now().toString(),
            status: 'pending'
        });
        localStorage.setItem('offlineContactMessages', JSON.stringify(offlineMessages));
        
        // Register background sync if available
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            registration.sync.register('contact-sync');
        }
    }

    validateForm() {
        let isValid = true;
        const formData = this.getFormData();

        // Validate name
        if (!formData.name || formData.name.length < 2) {
            this.showFieldError('name', 'Name must be at least 2 characters');
            isValid = false;
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email || !emailRegex.test(formData.email)) {
            this.showFieldError('email', 'Please enter a valid email address');
            isValid = false;
        }

        // Validate subject
        if (!formData.subject || formData.subject.length < 5) {
            this.showFieldError('subject', 'Subject must be at least 5 characters');
            isValid = false;
        }

        // Validate message
        if (!formData.message || formData.message.length < 10) {
            this.showFieldError('message', 'Message must be at least 10 characters');
            isValid = false;
        }

        return isValid;
    }

    validateField(field) {
        const value = field.value.trim();
        const fieldId = field.id;

        switch (fieldId) {
            case 'name':
                if (value.length < 2) {
                    this.showFieldError(fieldId, 'Name must be at least 2 characters');
                    return false;
                }
                break;
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    this.showFieldError(fieldId, 'Please enter a valid email address');
                    return false;
                }
                break;
            case 'subject':
                if (value.length < 5) {
                    this.showFieldError(fieldId, 'Subject must be at least 5 characters');
                    return false;
                }
                break;
            case 'message':
                if (value.length < 10) {
                    this.showFieldError(fieldId, 'Message must be at least 10 characters');
                    return false;
                }
                break;
        }

        this.clearFieldError(fieldId);
        return true;
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        let errorElement = document.getElementById(`${fieldId}-error`);
        
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = `${fieldId}-error`;
            errorElement.className = 'field-error';
            errorElement.style.cssText = 'color: #ef4444; font-size: 0.8rem; margin-top: 0.25rem;';
            field.parentNode.insertBefore(errorElement, field.nextSibling);
        }
        
        errorElement.textContent = message;
        field.setAttribute('aria-invalid', 'true');
        field.style.borderColor = '#ef4444';
    }

    clearFieldError(fieldId) {
        const field = typeof fieldId === 'string' ? document.getElementById(fieldId) : fieldId;
        const fieldName = typeof fieldId === 'string' ? fieldId : fieldId.id;
        
        const errorElement = document.getElementById(`${fieldName}-error`);
        if (errorElement) {
            errorElement.remove();
        }
        
        if (field) {
            field.setAttribute('aria-invalid', 'false');
            field.style.borderColor = '';
        }
    }

    showMessage(message, type, element) {
        if (element) {
            element.textContent = message;
            element.className = `form-message ${type} active`;
            element.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                element.style.display = 'none';
            }, 5000);
        } else {
            // Create temporary message
            const messageDiv = document.createElement('div');
            messageDiv.className = `form-message ${type} active`;
            messageDiv.textContent = message;
            messageDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                z-index: 10000;
                color: white;
                ${type === 'success' ? 'background: #10b981;' : 'background: #ef4444;'}
            `;
            
            document.body.appendChild(messageDiv);
            
            setTimeout(() => {
                messageDiv.remove();
            }, 5000);
        }
    }

    showSuccess(message, element) {
        this.showMessage(message, 'success', element);
    }

    showError(message, element) {
        this.showMessage(message, 'error', element);
    }

    setButtonState(button, disabled, text) {
        if (button) {
            button.disabled = disabled;
            const icon = button.querySelector('i');
            const span = button.querySelector('span');
            
            if (disabled) {
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>' + text + '</span>';
            } else {
                button.innerHTML = '<i class="fas fa-paper-plane"></i><span>' + text + '</span>';
            }
        }
    }

    speakSuccess() {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance('Your message has been sent successfully.');
            utterance.rate = 1.1;
            speechSynthesis.speak(utterance);
        }
    }

    trackSubmission(status, error = null) {
        // Track form submission for analytics
        const eventData = {
            event: 'contact_form_submission',
            status: status,
            timestamp: new Date().toISOString(),
            error: error
        };
        
        // Send to analytics if available
        if (typeof gtag !== 'undefined') {
            gtag('event', 'contact_submit', {
                'event_category': 'form',
                'event_label': status
            });
        }
        
        // Log to console for debugging
        console.log('Contact form submission:', eventData);
    }
}

// Initialize contact form manager
document.addEventListener('DOMContentLoaded', () => {
    window.contactFormManager = new ContactFormManager();
});