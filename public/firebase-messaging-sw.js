// Service Worker for Firebase Cloud Messaging
// This file must be in the public directory to be accessible

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Get Firebase config from the client (passed during registration)
let firebaseInitialized = false;
let messaging = null;

// Initialize Firebase when config is received
function initializeFirebase(firebaseConfig) {
  if (firebaseInitialized || !firebaseConfig || !firebaseConfig.apiKey) {
    return;
  }

  try {
    firebase.initializeApp(firebaseConfig);
    firebaseInitialized = true;
    messaging = firebase.messaging();
    
    // Set up background message handler
    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message ', payload);
      
      const notificationTitle = payload.notification?.title || 'AcciZard Lucban';
      const notificationOptions = {
        body: payload.notification?.body || 'You have a new notification',
        icon: '/accizard-uploads/accizard-logo-white-png.png',
        badge: '/accizard-uploads/accizard-logo-white-png.png',
        image: payload.notification?.image,
        data: payload.data || {},
        tag: payload.data?.type || 'default',
        requireInteraction: payload.data?.priority === 'high',
        vibrate: payload.data?.priority === 'high' ? [200, 100, 200] : [200],
        timestamp: Date.now(),
      };

          // Add click action based on notification type
          if (payload.data?.type === 'report_update' || payload.data?.type === 'report_created') {
            notificationOptions.actions = [
              {
                action: 'view',
                title: 'View Report'
              }
            ];
          } else if (payload.data?.type === 'announcement') {
            notificationOptions.actions = [
              {
                action: 'view',
                title: 'View Announcement'
              }
            ];
          } else if (payload.data?.type === 'chat_message') {
            notificationOptions.actions = [
              {
                action: 'view',
                title: 'Open Chat'
              }
            ];
          } else if (payload.data?.type === 'user_registered') {
            notificationOptions.actions = [
              {
                action: 'view',
                title: 'View Users'
              }
            ];
          }

      return self.registration.showNotification(notificationTitle, notificationOptions);
    });
    
    console.log('[firebase-messaging-sw.js] Firebase initialized in service worker');
  } catch (error) {
    // App might already be initialized, which is fine
    if (error.code !== 'app/duplicate-app') {
      console.error('[firebase-messaging-sw.js] Error initializing Firebase:', error);
    } else {
      firebaseInitialized = true;
      messaging = firebase.messaging();
    }
  }
}

// Listen for config message from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    initializeFirebase(event.data.config);
  }
});

// Handle notification clicks - MUST be registered at top level
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  
  event.notification.close();

  const notificationData = event.notification.data || {};
  let urlToOpen = '/';

  // Determine URL based on notification type
  if (notificationData.type === 'report_update' || notificationData.type === 'report_created') {
    urlToOpen = `/reports?highlight=${notificationData.reportId || ''}`;
  } else if (notificationData.type === 'announcement') {
    urlToOpen = `/announcements${notificationData.announcementId ? `?id=${notificationData.announcementId}` : ''}`;
  } else if (notificationData.type === 'chat_message') {
    urlToOpen = '/chat';
  } else if (notificationData.type === 'user_registered') {
    urlToOpen = '/users';
  }

  // Handle action clicks
  if (event.action === 'view') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  } else {
    // Default click behavior
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.navigate(urlToOpen).then(() => client.focus());
          }
        }
        // If not, open a new window/tab
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  }
});

// Handle push subscription change - MUST be registered at top level
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[firebase-messaging-sw.js] Push subscription changed.');
  
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: null // Will be set by Firebase
    }).then((subscription) => {
      console.log('[firebase-messaging-sw.js] New subscription:', subscription);
      // The subscription will be automatically handled by Firebase
    }).catch((error) => {
      console.error('[firebase-messaging-sw.js] Error resubscribing:', error);
    })
  );
});

// Handle push events - MUST be registered at top level
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push event received.');
  
  // Firebase Messaging SDK handles push events automatically via onBackgroundMessage
  // This handler is here to satisfy the browser requirement
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[firebase-messaging-sw.js] Push payload:', payload);
    } catch (error) {
      console.error('[firebase-messaging-sw.js] Error parsing push data:', error);
    }
  }
});
