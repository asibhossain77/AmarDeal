import { type Messaging, getMessaging } from 'firebase-admin/messaging';
import { initializeApp, type App, cert, getApps } from 'firebase-admin/app';

let _messaging: Messaging | null = null;

export function getAdminMessaging(): Messaging {
  if (_messaging) return _messaging;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
  }

  let serviceAccount: Record<string, string>;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount),
    });
    console.log('[Firebase Admin] Initialized successfully');
  }

  _messaging = getMessaging();
  return _messaging;
}
