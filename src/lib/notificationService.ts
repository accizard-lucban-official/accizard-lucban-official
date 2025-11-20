/**
 * Notification Service
 * Handles service worker registration and Firebase config passing
 */

import { getMessaging, getToken, Messaging } from 'firebase/messaging';
import app, { auth, db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

/**
 * Register service worker and pass Firebase config
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers are not supported');
    return null;
  }

  try {
    // Register the service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });

    console.log('Service Worker registered:', registration);

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    // Get Firebase config from environment variables
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

    // Send config to service worker
    if (registration.active) {
      registration.active.postMessage({
        type: 'FIREBASE_CONFIG',
        config: firebaseConfig,
      });
    } else if (registration.waiting) {
      registration.waiting.postMessage({
        type: 'FIREBASE_CONFIG',
        config: firebaseConfig,
      });
    } else if (registration.installing) {
      registration.installing.addEventListener('statechange', () => {
        if (registration.installing?.state === 'activated') {
          registration.installing.postMessage({
            type: 'FIREBASE_CONFIG',
            config: firebaseConfig,
          });
        }
      });
    }

    return registration;
  } catch (error) {
    console.error('Error registering service worker:', error);
    return null;
  }
}

/**
 * Initialize Firebase Messaging and get token
 */
export async function initializeMessaging(
  registration: ServiceWorkerRegistration
): Promise<string | null> {
  try {
    const messaging = getMessaging(app);
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

    if (!vapidKey) {
      throw new Error('VAPID key not configured. Please set VITE_FIREBASE_VAPID_KEY in your .env file');
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('FCM Token obtained:', token);
      
      // Save token to Firestore if user is authenticated
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userRef, {
          webFcmToken: token,
          webFcmTokenUpdatedAt: new Date().toISOString(),
        }, { merge: true });
      }
      
      return token;
    } else {
      console.warn('No registration token available');
      return null;
    }
  } catch (error) {
    console.error('Error initializing messaging:', error);
    return null;
  }
}

