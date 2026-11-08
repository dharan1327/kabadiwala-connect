import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

export const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || 'dev';
export const firebaseEnabled = AUTH_MODE === 'firebase';

// Firebase web config identifies the project and is public by design. Secrets (service-account
// keys) belong only on the server. Security is enforced by backend token verification.
export const firebaseAuth = firebaseEnabled
  ? getAuth(initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    }))
  : null;
