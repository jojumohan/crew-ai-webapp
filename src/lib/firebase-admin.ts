import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initFirebase() {
  if (getApps().length) return getApps()[0];

  const rawKey = process.env.FIREBASE_PRIVATE_KEY ?? '';
  // Handle both literal \n (from .env files) and already-decoded newlines
  const privateKey = rawKey.includes('\\n')
    ? rawKey.replace(/\\n/g, '\n')
    : rawKey;

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

initFirebase();
export const db = getFirestore();
