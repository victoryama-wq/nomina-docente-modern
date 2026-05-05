import admin from 'firebase-admin';
import { config } from './config.js';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: config.FIREBASE_PROJECT_ID
  });
}

export const firebaseAdmin = admin;
