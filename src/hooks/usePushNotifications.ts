import { useState, useEffect, useCallback } from 'react';
import { getMessaging, getToken, onMessage, Messaging, isSupported } from 'firebase/messaging';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from '@/components/ui/sonner';
import app from '@/lib/firebase';
import { registerServiceWorker, initializeMessaging } from '@/lib/notificationService';
import { SessionManager } from '@/lib/sessionManager';

export interface NotificationPermission {
  state: NotificationPermissionState;
  isSupported: boolean;
}

export interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermissionState | null;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for managing web push notifications
 * Handles permission requests, token management, and message receiving
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: null,
    isSubscribed: false,
    isLoading: true,
    error: null,
  });

  const [messaging, setMessaging] = useState<Messaging | null>(null);

  // Check if browser supports notifications and service workers
  useEffect(() => {
    const checkSupport = async () => {
      const browserSupported = 
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window;

      let firebaseSupported = false;
      try {
        firebaseSupported = await isSupported();
      } catch (error) {
        console.warn('Firebase Messaging not supported:', error);
      }

      const supported = browserSupported && firebaseSupported;

      setState(prev => ({
        ...prev,
        isSupported: supported,
        permission: supported ? Notification.permission : null,
        isLoading: false,
      }));

      if (supported) {
        try {
          // Initialize Firebase Messaging
          const messagingInstance = getMessaging(app);
          setMessaging(messagingInstance);

          // Listen for foreground messages
          onMessage(messagingInstance, (payload) => {
            console.log('Message received in foreground:', payload);
            
            // Show notification even when app is in foreground
            if (payload.notification) {
              const notificationTitle = payload.notification.title || 'AcciZard Lucban';
              const notificationOptions: NotificationOptions = {
                body: payload.notification.body,
                icon: '/accizard-uploads/accizard-logo-white-png.png',
                badge: '/accizard-uploads/accizard-logo-white-png.png',
                image: payload.notification.image,
                tag: payload.data?.type || 'default',
                requireInteraction: payload.data?.priority === 'high',
                vibrate: payload.data?.priority === 'high' ? [200, 100, 200] : [200],
                data: payload.data || {},
              };

              // Show browser notification
              if (Notification.permission === 'granted') {
                new Notification(notificationTitle, notificationOptions);
              }

              // Also show toast notification
              toast.info(notificationTitle, {
                description: payload.notification.body,
                duration: 5000,
              });
            }
          });
        } catch (error) {
          console.error('Error initializing Firebase Messaging:', error);
          setState(prev => ({
            ...prev,
            error: 'Failed to initialize push notifications',
            isLoading: false,
          }));
        }
      }
    };

    checkSupport();
  }, []);

  // Check subscription status and update permission from browser
  useEffect(() => {
    const checkSubscription = async () => {
      if (!state.isSupported) {
        setState(prev => ({ ...prev, isSubscribed: false, isLoading: false }));
        return;
      }

      // Update permission state from browser (in case it changed)
      const currentPermission = Notification.permission;
      setState(prev => ({
        ...prev,
        permission: currentPermission,
      }));

      if (!auth.currentUser) {
        setState(prev => ({ ...prev, isSubscribed: false, isLoading: false }));
        return;
      }

      try {
        const session = SessionManager.getSession();
        const isSuperAdmin = session?.userType === 'superadmin';
        let hasWebFcmToken = false;

        if (isSuperAdmin) {
          // Super admin: check superAdmin collection by email
          const email = auth.currentUser?.email;
          if (email) {
            const superAdminQuery = query(
              collection(db, 'superAdmin'),
              where('email', '==', email)
            );
            const querySnapshot = await getDocs(superAdminQuery);
            if (!querySnapshot.empty) {
              const superAdminData = querySnapshot.docs[0].data();
              hasWebFcmToken = !!superAdminData?.webFcmToken;
            }
          }
        } else {
          // Regular user or admin: check users collection
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
          const userData = userDoc.data();
          hasWebFcmToken = !!userData?.webFcmToken;
        }

        setState(prev => ({
          ...prev,
          isSubscribed: hasWebFcmToken,
          isLoading: false,
        }));
      } catch (error) {
        console.error('Error checking subscription:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    if (state.isSupported) {
      checkSubscription();
    }
  }, [state.isSupported, auth.currentUser]);

  /**
   * Request notification permission from the user
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    if (state.permission === 'granted') {
      return true;
    }

    if (state.permission === 'denied') {
      toast.error('Notification permission was previously denied. Please enable it in your browser settings.');
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      
      setState(prev => ({
        ...prev,
        permission,
      }));

      if (permission === 'granted') {
        // Permission granted, but don't call subscribe here
        // Let the caller handle subscription
        setState(prev => ({ ...prev, isLoading: false }));
        return true;
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
        toast.error('Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to request notification permission',
        isLoading: false,
      }));
      toast.error('Failed to request notification permission');
      return false;
    }
  }, [state.isSupported, state.permission]);

  /**
   * Subscribe to push notifications
   */
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      toast.error('Push notifications are not supported in this browser');
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }

    if (!auth.currentUser) {
      toast.error('Please log in to enable push notifications');
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }

    // Check current permission state (might have changed)
    const currentPermission = Notification.permission;
    if (currentPermission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }
    }

    // Ensure messaging is initialized
    let messagingInstance = messaging;
    if (!messagingInstance) {
      try {
        messagingInstance = getMessaging(app);
        setMessaging(messagingInstance);
      } catch (error) {
        console.error('Error initializing messaging:', error);
        setState(prev => ({ ...prev, isLoading: false, error: 'Failed to initialize messaging' }));
        toast.error('Failed to initialize messaging');
        return false;
      }
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    // Add timeout to prevent infinite loading
    let timeoutId: NodeJS.Timeout | null = null;
    timeoutId = setTimeout(() => {
      setState(prev => {
        if (prev.isLoading) {
          return {
            ...prev,
            isLoading: false,
            error: 'Subscription timed out. Please try again.',
          };
        }
        return prev;
      });
      toast.error('Subscription timed out. Please try again.');
    }, 30000); // 30 second timeout

    try {
      // Register service worker
      const registration = await registerServiceWorker();
      if (!registration) {
        if (timeoutId) clearTimeout(timeoutId);
        setState(prev => ({ ...prev, isLoading: false, error: 'Failed to register service worker' }));
        toast.error('Failed to register service worker');
        return false;
      }

      // Initialize messaging and get token
      const token = await initializeMessaging(registration);
      if (!token) {
        if (timeoutId) clearTimeout(timeoutId);
        setState(prev => ({ ...prev, isLoading: false, error: 'No registration token available. Please check your VAPID key configuration.' }));
        toast.error('No registration token available. Please check your VAPID key configuration.');
        return false;
      }

      if (timeoutId) clearTimeout(timeoutId);
      setState(prev => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
        permission: 'granted',
      }));

      toast.success('Push notifications enabled successfully!');
      return true;
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      console.error('Error subscribing to push notifications:', error);
      const errorMessage = error.message || 'Failed to subscribe to push notifications';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      toast.error(errorMessage);
      return false;
    }
  }, [state.isSupported, messaging, requestPermission]);

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) {
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Remove token from Firestore
      const session = SessionManager.getSession();
      const isSuperAdmin = session?.userType === 'superadmin';

      if (isSuperAdmin) {
        // Super admin: remove from superAdmin collection by email
        const email = auth.currentUser?.email;
        if (email) {
          const superAdminQuery = query(
            collection(db, 'superAdmin'),
            where('email', '==', email)
          );
          const querySnapshot = await getDocs(superAdminQuery);
          if (!querySnapshot.empty) {
            const superAdminDocId = querySnapshot.docs[0].id;
            const superAdminRef = doc(db, 'superAdmin', superAdminDocId);
            await updateDoc(superAdminRef, {
              webFcmToken: null,
              webFcmTokenUpdatedAt: null,
            });
          }
        }
      } else {
        // Regular user or admin: remove from users collection
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          webFcmToken: null,
          webFcmTokenUpdatedAt: null,
        });
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      toast.success('Push notifications disabled');
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to unsubscribe from push notifications',
        isLoading: false,
      }));
      toast.error('Failed to disable push notifications');
      return false;
    }
  }, []);

  /**
   * Toggle subscription (subscribe if not subscribed, unsubscribe if subscribed)
   */
  const toggleSubscription = useCallback(async (): Promise<boolean> => {
    // Prevent multiple simultaneous toggles
    if (state.isLoading) {
      console.warn('Subscription toggle already in progress');
      return false;
    }

    // Set loading state at the start
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (state.isSubscribed) {
        const result = await unsubscribe();
        // unsubscribe already handles loading state
        return result;
      } else {
        // Check current permission state (might have changed in browser settings)
        const currentPermission = Notification.permission;
        
        // Update state with current permission
        setState(prev => ({
          ...prev,
          permission: currentPermission,
        }));

        // If permission is not granted, request it first
        if (currentPermission !== 'granted') {
          const granted = await requestPermission();
          if (!granted) {
            setState(prev => ({ ...prev, isLoading: false }));
            return false;
          }
        }
        // subscribe will handle its own loading state
        return await subscribe();
      }
    } catch (error: any) {
      console.error('Error in toggleSubscription:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to toggle subscription',
      }));
      toast.error(error.message || 'Failed to toggle subscription');
      return false;
    }
  }, [state.isSubscribed, state.isLoading, state.permission, subscribe, unsubscribe, requestPermission]);

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    toggleSubscription,
  };
}

