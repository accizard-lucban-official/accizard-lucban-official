/**
 * Notification Service
 * Handles service worker registration and Firebase config passing
 */

import { getMessaging, getToken, Messaging } from 'firebase/messaging';
import app, { auth, db } from '@/lib/firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { SessionManager } from '@/lib/sessionManager';

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
    let vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

    if (!vapidKey) {
      throw new Error('VAPID key not configured. Please set VITE_FIREBASE_VAPID_KEY in your .env file');
    }

    // Trim whitespace (newlines, spaces, etc.) that might be present in GitHub Secrets
    vapidKey = vapidKey.trim();

    // Validate that it's a non-empty string
    if (!vapidKey || vapidKey.length === 0) {
      throw new Error('VAPID key is empty. Please check your VITE_FIREBASE_VAPID_KEY environment variable');
    }

    // Basic validation: VAPID keys are base64url-encoded strings
    // Base64url uses - and _ instead of + and / (standard base64)
    // They should only contain alphanumeric characters, -, _, and = (for padding)
    const base64urlRegex = /^[A-Za-z0-9\-_=]+$/;
    if (!base64urlRegex.test(vapidKey)) {
      console.error('Invalid VAPID key format. Key length:', vapidKey.length);
      console.error('First 20 chars:', vapidKey.substring(0, 20));
      throw new Error('VAPID key contains invalid characters. It should be a base64url-encoded string (may contain -, _, and =) without spaces or newlines. Please check your VITE_FIREBASE_VAPID_KEY environment variable');
    }

    console.log('Using VAPID key (first 20 chars):', vapidKey.substring(0, 20) + '...');

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('FCM Token obtained:', token);
      
      // Save token to Firestore - handle all user types
      const session = SessionManager.getSession();
      
      if (session?.isLoggedIn) {
        if (session.userType === 'superadmin' && auth.currentUser) {
          // Super admin: save to superAdmin collection by email
          const email = auth.currentUser.email;
          if (email) {
            const superAdminQuery = query(
              collection(db, 'superAdmin'),
              where('email', '==', email)
            );
            const querySnapshot = await getDocs(superAdminQuery);
            
            if (!querySnapshot.empty) {
              const superAdminDocId = querySnapshot.docs[0].id;
              const superAdminRef = doc(db, 'superAdmin', superAdminDocId);
              await setDoc(superAdminRef, {
                webFcmToken: token,
                webFcmTokenUpdatedAt: new Date().toISOString(),
              }, { merge: true });
              console.log('FCM Token saved to superAdmin collection');
            } else {
              console.warn('Super admin document not found in Firestore');
            }
          }
        } else if (session.userType === 'admin' && session.username) {
          // Regular admin: save to admins collection by username
          const adminQuery = query(
            collection(db, 'admins'),
            where('username', '==', session.username)
          );
          const querySnapshot = await getDocs(adminQuery);
          
          if (!querySnapshot.empty) {
            const adminDocId = querySnapshot.docs[0].id;
            const adminRef = doc(db, 'admins', adminDocId);
            await setDoc(adminRef, {
              webFcmToken: token,
              webFcmTokenUpdatedAt: new Date().toISOString(),
            }, { merge: true });
            console.log('FCM Token saved to admins collection');
          } else {
            console.warn('Admin document not found in Firestore for username:', session.username);
          }
        } else if (auth.currentUser) {
          // Regular user (Firebase Auth): save to users collection
          const userRef = doc(db, 'users', auth.currentUser.uid);
          await setDoc(userRef, {
            webFcmToken: token,
            webFcmTokenUpdatedAt: new Date().toISOString(),
          }, { merge: true });
          console.log('FCM Token saved to users collection');
        } else {
          console.warn('No valid user session found for saving FCM token');
        }
      } else {
        console.warn('User not logged in, cannot save FCM token');
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

