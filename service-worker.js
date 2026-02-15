// ======================================================
// 🔥 FACULTECH PWA - Service Worker with Firebase Messaging
// ======================================================

const CACHE_NAME = "facultech-cache-v1";
const urlsToCache = ["index.html", "style.css", "app.js", "theme.js", "manifest.json"];

// ---------------- Firebase Messaging Setup ----------------
// Import Firebase Messaging scripts for background notifications
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging.js');

// Firebase configuration (same as in app.js)
firebase.initializeApp({
  apiKey: "AIzaSyABC_3jc_TYgCKIq0RtK6YjDdGaRx4LeNY",
  authDomain: "facultech2.firebaseapp.com",
  databaseURL: "https://facultech2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "facultech2",
  storageBucket: "facultech2.firebasestorage.app",
  messagingSenderId: "614350399768",
  appId: "1:614350399768:web:9bb18fde62621c18c7566d"
});

// Get Firebase Messaging instance
const messaging = firebase.messaging();

// ---------------- Handle Background Push Notifications ----------------
// This handles notifications when the app is in the background or closed
messaging.onBackgroundMessage(function(payload) {
  console.log('[Service Worker] Received background message:', payload);

  // Customize notification appearance
  const notificationTitle = payload.notification?.title || "🚨 Alert";
  const notificationOptions = {
    body: payload.notification?.body || "Sensor threshold exceeded!",
    icon: "icons/icon-192x192.png",
    badge: "icons/icon-192x192.png",
    tag: "sensor-alert",
    renotify: true,
    data: {
      url: payload.data?.url || "/",
      timestamp: Date.now()
    }
  };

  // Show the notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ---------------- Handle Notification Click ----------------
self.addEventListener("notificationclick", function(event) {
  console.log('[Service Worker] Notification click:', event);
  
  event.notification.close();

  // Open the app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});

// ---------------- Basic Caching Logic ----------------
self.addEventListener("install", event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("activate", event => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API calls; always hit network for live sensor values.
  if (
    request.method !== "GET" ||
    url.pathname.includes("/latest-data") ||
    url.pathname.startsWith("/api/")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then(response => {
      return response || fetch(request);
    })
  );
});
