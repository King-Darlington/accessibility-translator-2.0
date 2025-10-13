// Enhanced Carousel with Performance Optimizations
class CarouselManager {
    constructor() {
        this.track = null;
        this.slides = [];
        this.currentIndex = 0;
        this.totalSlides = 0;
        this.autoplayInterval = null;
        this.isPaused = false;
        this.touchStartX = 0;
        this.touchEndX = 0;
        this.init();
    }

    init() {
        this.track = document.getElementById('carouselTrack');
        if (!this.track) return;

        this.slides = this.track.querySelectorAll('.about-slide');
        this.totalSlides = this.slides.length;
        
        if (this.totalSlides === 0) return;

        this.createIndicators();
        this.setupEventListeners();
        this.startAutoplay();
        this.updateCarousel();

        // Add performance optimization
        this.optimizeCarousel();
    }

    createIndicators() {
        const indicatorsContainer = document.getElementById('carouselIndicators');
        if (!indicatorsContainer) return;

        indicatorsContainer.innerHTML = '';
        
        this.slides.forEach((_, index) => {
            const indicator = document.createElement('button');
            indicator.className = 'indicator';
            indicator.setAttribute('aria-label', `Go to slide ${index + 1}`);
            indicator.setAttribute('role', 'tab');
            indicator.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
            
            if (index === 0) indicator.classList.add('active');
            
            indicator.addEventListener('click', () => this.goToSlide(index));
            indicator.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.goToSlide(index);
                }
            });
            
            indicatorsContainer.appendChild(indicator);
        });
    }

    setupEventListeners() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.prevSlide();
                this.resetAutoplay();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.nextSlide();
                this.resetAutoplay();
            });
        }

        // Pause autoplay on hover/focus for accessibility
        if (this.track) {
            this.track.addEventListener('mouseenter', () => this.pauseAutoplay());
            this.track.addEventListener('mouseleave', () => this.resumeAutoplay());
            this.track.addEventListener('focusin', () => this.pauseAutoplay());
            this.track.addEventListener('focusout', () => this.resumeAutoplay());
        }

        // Touch/swipe support
        this.track.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        this.track.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        }, { passive: true });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.target.closest('.carousel-container')) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.prevSlide();
                    this.resetAutoplay();
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    this.nextSlide();
                    this.resetAutoplay();
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    this.goToSlide(0);
                    this.resetAutoplay();
                } else if (e.key === 'End') {
                    e.preventDefault();
                    this.goToSlide(this.totalSlides - 1);
                    this.resetAutoplay();
                }
            }
        });

        // Visibility API support - pause when page is hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAutoplay();
            } else {
                this.resumeAutoplay();
            }
        });
    }

    updateCarousel() {
        if (!this.track) return;

        // Use transform for better performance
        this.track.style.transform = `translateX(-${this.currentIndex * 100}%)`;
        
        // Update ARIA attributes for accessibility
        this.slides.forEach((slide, index) => {
            slide.setAttribute('aria-hidden', index !== this.currentIndex ? 'true' : 'false');
            slide.setAttribute('role', 'tabpanel');
        });

        // Update indicators
        const indicators = document.querySelectorAll('.indicator');
        indicators.forEach((indicator, index) => {
            const isActive = index === this.currentIndex;
            indicator.classList.toggle('active', isActive);
            indicator.setAttribute('aria-selected', isActive ? 'true' : 'false');
            indicator.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        // Announce slide change for screen readers
        this.announceSlideChange();
    }

    goToSlide(index) {
        this.currentIndex = index;
        this.updateCarousel();
    }

    nextSlide() {
        this.currentIndex = (this.currentIndex + 1) % this.totalSlides;
        this.updateCarousel();
    }

    prevSlide() {
        this.currentIndex = (this.currentIndex - 1 + this.totalSlides) % this.totalSlides;
        this.updateCarousel();
    }

    startAutoplay() {
        // Only autoplay if not reduced motion
        if (this.shouldReduceMotion()) return;

        this.autoplayInterval = setInterval(() => {
            if (!this.isPaused) {
                this.nextSlide();
            }
        }, 5000); // 5 seconds per slide
    }

    stopAutoplay() {
        if (this.autoplayInterval) {
            clearInterval(this.autoplayInterval);
            this.autoplayInterval = null;
        }
    }

    pauseAutoplay() {
        this.isPaused = true;
    }

    resumeAutoplay() {
        this.isPaused = false;
    }

    resetAutoplay() {
        this.stopAutoplay();
        this.startAutoplay();
    }

    handleSwipe() {
        const swipeThreshold = 50;
        
        if (this.touchEndX < this.touchStartX - swipeThreshold) {
            this.nextSlide();
            this.resetAutoplay();
        } else if (this.touchEndX > this.touchStartX + swipeThreshold) {
            this.prevSlide();
            this.resetAutoplay();
        }
    }

    announceSlideChange() {
        // Create live region for screen reader announcements
        let liveRegion = document.getElementById('carousel-announce');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'carousel-announce';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
            document.body.appendChild(liveRegion);
        }

        const currentSlide = this.slides[this.currentIndex];
        const slideTitle = currentSlide.querySelector('h3')?.textContent || `Slide ${this.currentIndex + 1}`;
        liveRegion.textContent = `Now viewing: ${slideTitle}`;
    }

    shouldReduceMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    optimizeCarousel() {
        // Lazy load images in carousel
        const images = this.track.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));

        // Preload adjacent slides for smoother transitions
        this.preloadAdjacentSlides();
    }

    preloadAdjacentSlides() {
        const nextIndex = (this.currentIndex + 1) % this.totalSlides;
        const prevIndex = (this.currentIndex - 1 + this.totalSlides) % this.totalSlides;
        
        [nextIndex, prevIndex].forEach(index => {
            const slide = this.slides[index];
            const images = slide.querySelectorAll('img[data-src]');
            images.forEach(img => {
                if (img.dataset.src) {
                    const preloadImg = new Image();
                    preloadImg.src = img.dataset.src;
                }
            });
        });
    }

    // Public method to manually go to a specific slide
    goToSlide(index) {
        if (index >= 0 && index < this.totalSlides) {
            this.currentIndex = index;
            this.updateCarousel();
            this.resetAutoplay();
        }
    }

    // Public method to destroy carousel and clean up
    destroy() {
        this.stopAutoplay();
        
        // Remove event listeners
        const indicators = document.querySelectorAll('.indicator');
        indicators.forEach(indicator => {
            indicator.replaceWith(indicator.cloneNode(true));
        });
    }
}

// Initialize carousel
document.addEventListener('DOMContentLoaded', () => {
    window.carouselManager = new CarouselManager();
});