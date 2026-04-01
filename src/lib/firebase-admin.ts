import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminDb: Firestore;

const hasCredentials = 
  process.env.FIREBASE_PROJECT_ID && 
  process.env.FIREBASE_CLIENT_EMAIL && 
  process.env.FIREBASE_PRIVATE_KEY;

if (hasCredentials) {
  try {
    const existingApp = getApps().length > 0 ? getApps()[0] : null;
    
    if (!existingApp) {
      const app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      adminDb = getFirestore(app);
    } else {
      adminDb = getFirestore(existingApp);
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
} else {
  // Build-time fallback - will fail gracefully at runtime
  console.warn('Firebase Admin credentials missing - initialization deferred to runtime');
  // @ts-ignore
  adminDb = {} as Firestore;
}

export { adminDb };
export const db = adminDb;
