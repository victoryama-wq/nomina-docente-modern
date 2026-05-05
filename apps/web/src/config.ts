export const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'nomina-docente-prod',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:443985127112:web:b189dd630e1e51b99ba7fd',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'nomina-docente-prod.firebasestorage.app',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyA3d5Dl8QegJprkyUSLcnbYrFJA7ZRVwnQ',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'nomina-docente-prod.firebaseapp.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '443985127112'
};

const localApiBaseUrl = 'http://localhost:8080';
const hostedApiBaseUrl = '/api';
const isLocalBrowser =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || (isLocalBrowser ? localApiBaseUrl : hostedApiBaseUrl);
