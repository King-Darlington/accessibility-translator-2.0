// Service Worker for Accessibility Translator - Offline Functionality
const CACHE_NAME = 'accessibility-translator-v2.0.0';
const API_CACHE_NAME = 'accessibility-translator-api-v1.0.0';

// Assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/home.html',
    '/text-to-speech.html',
    '/object-scanning.html',
    '/color-filter.html',
    '/contact.html',
    '/settings.html',
    '/gallery.html',
    
    // CSS Files
    '/css/main-styles.css',
    '/css/home-styles.css',
    '/css/text-to-speech.css',
    '/css/object-scanning.css',
    '/css/color-filter.css',
    '/css/contact.css',
    '/css/settings.css',
    '/css/Footer.css',
    
    // JavaScript Files
    '/js/main.js',
    '/js/auth.js',
    '/js/carousel.js',
    '/js/color-filter.js',
    '/js/contact.js',
    '/js/settings.js',
    '/js/preferences.js',
    '/js/footer.js',
    '/js/extension-integration.js',
    '/js/extension-trigger.js',
    
    // External Libraries
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.4.1/jquery.min.js'
];

// API endpoints to cache
const API_ENDPOINTS = [
    '/api/preferences/get.php',
    '/api/settings/get.php',
    '/auth/login.php',
    '/auth/register.php'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Service Worker installed successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker activated successfully');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Handle API requests
    if (url.pathname.includes('/api/') || url.pathname.includes('/auth/')) {
        event.respondWith(handleApiRequest(request));
        return;
    }

    // Handle HTML page requests
    if (request.headers.get('Accept')?.includes('text/html')) {
        event.respondWith(handleHtmlRequest(request));
        return;
    }

    // Handle static asset requests
    event.respondWith(handleStaticRequest(request));
});

// Handle API requests with cache-first strategy
async function handleApiRequest(request) {
    const cache = await caches.open(API_CACHE_NAME);
    
    try {
        // Try network first for API calls
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful API responses
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        throw new Error('Network response not ok');
    } catch (error) {
        // Network failed, try cache
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('Serving API from cache:', request.url);
            return cachedResponse;
        }
        
        // No cache available, return offline response for certain endpoints
        return createOfflineResponse(request);
    }
}

// Handle HTML requests with network-first strategy
async function handleHtmlRequest(request) {
    try {
        // Try network first for HTML
        const networkResponse = await fetch(request);
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('Serving HTML from cache:', request.url);
            return cachedResponse;
        }
        
        // Fallback to offline page
        return caches.match('/offline.html') || createOfflineResponse(request);
    }
}

// Handle static asset requests with cache-first strategy
async function handleStaticRequest(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Return generic offline response for assets
        return createOfflineResponse(request);
    }
}

// Create offline response for failed requests
function createOfflineResponse(request) {
    if (request.headers.get('Accept')?.includes('application/json')) {
        return new Response(JSON.stringify({
            success: false,
            error: 'You are offline. Please check your internet connection.',
            offline: true
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    return new Response('You are offline. Please check your internet connection.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
    });
}

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
    console.log('Background sync triggered:', event.tag);
    
    if (event.tag === 'contact-sync') {
        event.waitUntil(syncContactForms());
    }
    
    if (event.tag === 'preferences-sync') {
        event.waitUntil(syncPreferences());
    }
});

// Sync offline contact forms
async function syncContactForms() {
    try {
        const registration = await self.registration;
        const clients = await self.clients.matchAll();
        
        // Get offline messages from storage
        const offlineMessages = await getOfflineData('offlineContactMessages');
        
        for (const message of offlineMessages) {
            try {
                const response = await fetch('/api/contact/submit.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(message)
                });
                
                if (response.ok) {
                    // Remove from offline storage
                    await removeOfflineData('offlineContactMessages', message.id);
                    console.log('Synced contact form:', message.id);
                    
                    // Notify clients
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'CONTACT_SYNC_SUCCESS',
                            id: message.id
                        });
                    });
                }
            } catch (error) {
                console.error('Failed to sync contact form:', error);
            }
        }
    } catch (error) {
        console.error('Contact form sync failed:', error);
    }
}

// Sync offline preferences
async function syncPreferences() {
    try {
        const pendingSync = await getOfflineData('pendingPreferencesSync');
        
        for (const pref of pendingSync) {
            try {
                const response = await fetch('/api/preferences/update.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(pref.data)
                });
                
                if (response.ok) {
                    await removeOfflineData('pendingPreferencesSync', pref.id);
                    console.log('Synced preference:', pref.id);
                }
            } catch (error) {
                console.error('Failed to sync preference:', error);
            }
        }
    } catch (error) {
        console.error('Preferences sync failed:', error);
    }
}

// Helper functions for offline data management
async function getOfflineData(key) {
    const cache = await caches.open('offline-data');
    const response = await cache.match(`/offline-data/${key}`);
    
    if (response) {
        return await response.json();
    }
    
    return [];
}

async function saveOfflineData(key, data) {
    const cache = await caches.open('offline-data');
    const response = new Response(JSON.stringify(data));
    await cache.put(`/offline-data/${key}`, response);
}

async function removeOfflineData(key, id) {
    const data = await getOfflineData(key);
    const filteredData = data.filter(item => item.id !== id);
    await saveOfflineData(key, filteredData);
}

// Push notifications support
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/assets/icon-192.png',
        badge: '/assets/badge-72.png',
        vibrate: [100, 50, 100],
        data: data.url,
        actions: [
            {
                action: 'open',
                title: 'Open App',
                icon: '/assets/checkmark.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/assets/xmark.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                if (clients.length > 0) {
                    clients[0].focus();
                    clients[0].postMessage({
                        type: 'NOTIFICATION_CLICK',
                        url: event.notification.data
                    });
                } else {
                    self.clients.openWindow(event.notification.data || '/');
                }
            })
        );
    }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CACHE_ASSETS':
            cacheAdditionalAssets(data.assets);
            break;
            
        case 'GET_CACHE_INFO':
            sendCacheInfo(event.ports[0]);
            break;
    }
});

async function cacheAdditionalAssets(assets) {
    const cache = await caches.open(CACHE_NAME);
    return cache.addAll(assets);
}

async function sendCacheInfo(port) {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    port.postMessage({
        cachedItems: keys.length,
        cacheName: CACHE_NAME
    });
}

// Performance monitoring
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'cache-cleanup') {
        event.waitUntil(cleanupOldCaches());
    }
});

async function cleanupOldCaches() {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
            const date = response.headers.get('date');
            if (date && new Date(date).getTime() < weekAgo) {
                await cache.delete(request);
            }
        }
    }
}

console.log('Accessibility Translator Service Worker loaded successfully');