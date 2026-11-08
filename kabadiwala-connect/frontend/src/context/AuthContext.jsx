import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendEmailVerification } from 'firebase/auth';
import { api, session } from '../lib/api.js';
import { firebaseAuth, firebaseEnabled } from '../lib/firebase.js';

const DEV_KEY = 'kc-dev-email';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);      // backend profile (role, city, collector code...)
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const profile = await api('/auth/me');
      setUser(profile);
      return profile;
    } catch (err) {
      setUser(null);
      if (err.status !== 401) throw err;
      return null;
    }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      try {
        if (firebaseEnabled) {
          session.getToken = async () => (firebaseAuth.currentUser ? firebaseAuth.currentUser.getIdToken() : null);
          unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
            if (fbUser) await loadProfile().catch(() => setUser(null));
            else setUser(null);
            setLoading(false);
          });
          return;
        }
        session.devEmail = localStorage.getItem(DEV_KEY);
        if (session.devEmail) await loadProfile().catch(() => setUser(null));
      } finally {
        if (!firebaseEnabled) setLoading(false);
      }
    })();
    return () => unsubscribe();
  }, [loadProfile]);

  // Dev mode: demo accounts only. Firebase mode never reaches this path.
  const loginDev = async (email) => {
    session.devEmail = email.trim().toLowerCase();
    localStorage.setItem(DEV_KEY, session.devEmail);
    const profile = await loadProfile();
    if (!profile) throw new Error('No account found for that email.');
    return profile;
  };

  const loginFirebase = async (email, password) => {
    const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
    if (!cred.user.emailVerified) {
      await sendEmailVerification(cred.user).catch(() => {});
      await signOut(firebaseAuth);
      throw new Error('Please verify your email first. We have sent a new verification link to your inbox.');
    }
    return loadProfile();
  };

  const logout = async () => {
    if (firebaseEnabled) await signOut(firebaseAuth);
    session.devEmail = null;
    localStorage.removeItem(DEV_KEY);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, loginDev, loginFirebase, logout, refreshUser: loadProfile, firebaseEnabled }),
    [user, loading, loadProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
