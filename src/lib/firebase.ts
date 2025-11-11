// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate that required environment variables are present
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Firebase configuration error: Missing required environment variables');
  console.error('Required: VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID');
  console.error('Current values:', {
    apiKey: firebaseConfig.apiKey ? '***' : 'MISSING',
    projectId: firebaseConfig.projectId || 'MISSING'
  });
}

// Initialize Firebase - check if app already exists to prevent duplicate initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// Cloud Functions
export const deleteResidentUserFunction = httpsCallable(functions, 'deleteResidentUser');

// Initialize Analytics only if not already initialized (prevents errors in development)
let analytics;
try {
  analytics = getAnalytics(app);
} catch (error) {
  // Analytics may already be initialized, ignore error
  console.warn('Analytics initialization skipped:', error);
}

export default app;
export { auth, db, storage, functions }; 