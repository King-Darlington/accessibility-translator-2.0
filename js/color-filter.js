// Enhanced Color Filter with Database Integration
class ColorFilterManager {
    constructor() {
        this.filters = {
            'normal': 'Normal',
            'invert': 'Inverted',
            'grayscale': 'Grayscale',
            'high-contrast': 'High Contrast',
            'high-contrast-black': 'High Contrast Dark',
            'high-contrast-white': 'High Contrast Light',
            'sepia': 'Sepia',
            'dark-mode': 'Dark Mode',
            'blue-light': 'Blue Light Filter'
        };
        this.currentFilter = 'normal';
        this.init();
    }

    async init() {
        await this.loadSavedFilter();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.updateUI();
    }

    async loadSavedFilter() {
        // Try to load from server if logged in and online
        if (window.authManager?.isAuthenticated() && navigator.onLine) {
            try {
                const response = await fetch('api/preferences/get.php');
                const data = await response.json();
                
                if (data.success) {
                    const filter = data.preferences.color_filter || 
                                 data.preferences.preferences_json?.color_filter || 
                                 'normal';
                    this.currentFilter = filter;
                    return;
                }
            } catch (error) {
                console.log('Failed to load filter from server, using local storage');
            }
        }

        // Fallback to localStorage
        const savedFilter = localStorage.getItem('colorFilter');
        if (savedFilter && this.filters[savedFilter]) {
            this.currentFilter = savedFilter;
        }
    }

    setupEventListeners() {
        const filterCards = document.querySelectorAll('.filter-card');
        
        filterCards.forEach(card => {
            card.addEventListener('click', () => {
                const filter = card.getAttribute('data-filter');
                this.applyFilter(filter);
            });

            // Keyboard support
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const filter = card.getAttribute('data-filter');
                    this.applyFilter(filter);
                }
            });
        });

        // Listen for filter changes from other components
        document.addEventListener('colorFilterChanged', (e) => {
            this.applyFilter(e.detail.filter, false);
        });

        // Online/offline handling for sync
        window.addEventListener('online', () => this.syncFilterToServer());
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.altKey) {
                const keyMap = {
                    '1': 'normal',
                    '2': 'invert',
                    '3': 'grayscale',
                    '4': 'high-contrast',
                    '5': 'sepia',
                    '6': 'dark-mode',
                    '7': 'blue-light'
                };

                if (keyMap[e.key]) {
                    e.preventDefault();
                    this.applyFilter(keyMap[e.key]);
                }
            }
        });
    }

    async applyFilter(filter, showFeedback = true) {
        if (!this.filters[filter] || filter === this.currentFilter) return;

        // Remove all filter classes
        document.body.classList.remove(...Object.keys(this.filters));
        
        // Add new filter class
        if (filter !== 'normal') {
            document.body.classList.add(filter);
        }

        this.currentFilter = filter;
        
        // Update UI
        this.updateUI();
        
        // Save filter
        await this.saveFilter(filter);
        
        // Show feedback
        if (showFeedback) {
            this.showFeedback();
            this.speakFeedback(filter);
        }

        // Dispatch event for other components
        document.dispatchEvent(new CustomEvent('colorFilterChanged', {
            detail: { filter }
        }));
    }

    updateUI() {
        // Update active card
        const filterCards = document.querySelectorAll('.filter-card');
        filterCards.forEach(card => {
            const filter = card.getAttribute('data-filter');
            card.classList.toggle('active', filter === this.currentFilter);
            card.setAttribute('aria-pressed', filter === this.currentFilter ? 'true' : 'false');
        });

        // Update current filter display
        const filterName = document.getElementById('filterName');
        const currentFilterDisplay = document.getElementById('currentFilterDisplay');
        
        if (filterName) {
            filterName.textContent = this.filters[this.currentFilter];
        }
        
        if (currentFilterDisplay) {
            currentFilterDisplay.classList.add('show');
            setTimeout(() => {
                currentFilterDisplay.classList.remove('show');
            }, 3000);
        }
    }

    showFeedback() {
        // Create visual feedback
        const feedback = document.createElement('div');
        feedback.className = 'filter-feedback';
        feedback.textContent = `Filter applied: ${this.filters[this.currentFilter]}`;
        feedback.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(99, 102, 241, 0.9);
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            z-index: 1000;
            font-size: 14px;
            animation: slideInUp 0.3s ease;
        `;
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.style.animation = 'slideOutDown 0.3s ease';
            setTimeout(() => feedback.remove(), 300);
        }, 2000);
    }

    speakFeedback(filter) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`Color filter changed to ${this.filters[filter]}`);
            utterance.rate = 1.2;
            utterance.pitch = 1.1;
            speechSynthesis.speak(utterance);
        }
    }

    async saveFilter(filter) {
        // Save to localStorage for immediate access
        localStorage.setItem('colorFilter', filter);
        
        // Save to database if user is logged in
        if (window.authManager?.isAuthenticated()) {
            await this.saveToDatabase(filter);
        }
    }

    async saveToDatabase(filter) {
        try {
            const response = await fetch('api/preferences/update.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    color_filter: filter
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error('Failed to save to database');
            }
            
            console.log('Filter saved to database');
        } catch (error) {
            console.warn('Failed to save filter to database:', error);
            
            // Queue for sync when online
            this.queueForSync(filter);
        }
    }

    queueForSync(filter) {
        const pendingSync = JSON.parse(localStorage.getItem('pendingFilterSync') || '[]');
        pendingSync.push({
            filter,
            timestamp: Date.now()
        });
        localStorage.setItem('pendingFilterSync', JSON.stringify(pendingSync));
    }

    async syncFilterToServer() {
        const pendingSync = JSON.parse(localStorage.getItem('pendingFilterSync') || '[]');
        
        if (pendingSync.length > 0 && window.authManager?.isAuthenticated()) {
            const latestFilter = pendingSync[pendingSync.length - 1].filter;
            
            try {
                await this.saveToDatabase(latestFilter);
                localStorage.removeItem('pendingFilterSync');
                console.log('Pending filter sync completed');
            } catch (error) {
                console.warn('Failed to sync pending filter');
            }
        }
    }

    // Public methods
    getCurrentFilter() {
        return this.currentFilter;
    }

    getAvailableFilters() {
        return this.filters;
    }

    // Method to apply filter programmatically
    setFilter(filter) {
        this.applyFilter(filter);
    }
}

// Initialize color filter manager
document.addEventListener('DOMContentLoaded', () => {
    window.colorFilterManager = new ColorFilterManager();
});

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInUp {
        from {
            transform: translateY(100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutDown {
        from {
            transform: translateY(0);
            opacity: 1;
        }
        to {
            transform: translateY(100%);
            opacity: 0;
        }
    }
    
    .filter-card {
        transition: all 0.3s ease;
        cursor: pointer;
    }
    
    .filter-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }
    
    .filter-card.active {
        border-color: #06b6d4;
        box-shadow: 0 0 0 2px #06b6d4;
    }
`;
document.head.appendChild(style);