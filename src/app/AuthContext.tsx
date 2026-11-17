import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { readLocal, writeLocal } from '../lib/storage';
import type { AppUser, UserRole } from '../types';

type AuthContextValue = {
  user: AppUser | null;
  isDemo: boolean;
  loading: boolean;
  login: (email: string, password: string, name?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  toggleDemoRole: () => void;
};

const demoUser: AppUser = {
  uid: 'demo-student',
  displayName: 'عبدالرحمن',
  email: 'student@enghub.demo',
  photoURL: null,
  role: 'student',
  academicYear: 'السنة الإعدادية',
  term: 'الترم الأول',
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => isFirebaseConfigured ? null : readLocal('demoUser', demoUser));
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const isDemo = !isFirebaseConfigured;

  useEffect(() => {
    const firebaseAuth = auth;
    const firestore = db;
    if (!firebaseAuth || !firestore) {
      setLoading(false);
      return;
    }
    const stop = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          return;
        }
        const token = await firebaseUser.getIdTokenResult();
        const profileRef = doc(firestore, 'users', firebaseUser.uid);
        let profileSnap = await getDoc(profileRef);
        if (!profileSnap.exists()) {
          await setDoc(profileRef, {
            displayName: firebaseUser.displayName || 'طالب هندسة',
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
            role: 'student',
            academicYear: 'السنة الإعدادية',
            term: 'الترم الأول',
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          profileSnap = await getDoc(profileRef);
        }
        const profile = profileSnap.exists() ? profileSnap.data() : {};
        // The admins document ID must exactly match the email returned by Firebase Authentication.
        const authEmail = (firebaseUser.email ?? '').trim();
        const adminSnap = authEmail ? await getDoc(doc(firestore, 'admins', authEmail)) : null;
        const adminRecord = adminSnap?.exists() ? adminSnap.data() : null;
        const adminRoleIsValid = adminRecord?.role === 'admin' || adminRecord?.role === 'super-admin';
        const activeAdminRecord = Boolean(
          adminRecord?.active === true
          && adminRoleIsValid
          && String(adminRecord.email ?? '').trim() === authEmail,
        );
        const storedAdminRole: UserRole = adminRecord?.role === 'super-admin' ? 'super-admin' : 'admin';
        const tokenRole = token.claims.role as UserRole | undefined;
        // Only the protected admins collection grants admin UI access; profile fields cannot elevate a user.
        const role: UserRole = activeAdminRecord ? storedAdminRole : tokenRole === 'moderator' ? 'moderator' : 'student';
        setUser({
          uid: firebaseUser.uid,
          displayName: (profile.displayName as string) || firebaseUser.displayName || 'طالب هندسة',
          email: firebaseUser.email || '',
          photoURL: firebaseUser.photoURL,
          role,
          academicYear: (profile.academicYear as string) || 'السنة الإعدادية',
          term: (profile.term as string) || 'الترم الأول',
        });
      } catch (error) {
        console.error('ENG HUB could not load the signed-in profile or admin record.', error);
        // Fail closed: a failed permission lookup must never grant admin UI access.
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return stop;
  }, []);

  const login = async (email: string, password: string, name?: string) => {
    const firebaseAuth = auth; const firestore = db;
    if (!firebaseAuth || !firestore) {
      const next = { ...demoUser, displayName: name || email.split('@')[0] || 'طالب هندسة', email };
      setUser(next);
      writeLocal('demoUser', next);
      return;
    }
    const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    const ref = doc(firestore, 'users', credential.user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        displayName: credential.user.displayName || email.split('@')[0],
        email,
        role: 'student',
        academicYear: 'السنة الإعدادية',
        term: 'الترم الأول',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  const loginWithGoogle = async () => {
    const firebaseAuth = auth; const firestore = db;
    if (!firebaseAuth || !firestore) {
      const next = { ...demoUser, displayName: 'طالب تجريبي' };
      setUser(next);
      writeLocal('demoUser', next);
      return;
    }
    const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
    const ref = doc(firestore, 'users', credential.user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        displayName: credential.user.displayName || 'طالب هندسة',
        email: credential.user.email,
        photoURL: credential.user.photoURL,
        role: 'student',
        academicYear: 'السنة الإعدادية',
        term: 'الترم الأول',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  const logout = async () => {
    if (auth) await signOut(auth);
    if (isDemo) {
      const next = { ...demoUser, displayName: 'زائر تجريبي', email: 'guest@enghub.demo' };
      setUser(next);
      writeLocal('demoUser', next);
    } else {
      setUser(null);
    }
  };

  const toggleDemoRole = () => {
    if (!isDemo) return;
    setUser((current) => {
      if (!current) return current;
      const role: UserRole = current.role === 'student' ? 'admin' : 'student';
      const next = { ...current, role, displayName: role === 'admin' ? 'مدير المنصة (تجريبي)' : 'عبدالرحمن' };
      writeLocal('demoUser', next);
      return next;
    });
  };

  const value = useMemo(() => ({ user, isDemo, loading, login, loginWithGoogle, logout, toggleDemoRole }), [user, isDemo, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export async function registerAccount(email: string, password: string, displayName: string) {
  const firebaseAuth = auth; const firestore = db;
  if (!firebaseAuth || !firestore) throw new Error('Firebase غير مهيأ بعد. التسجيل التجريبي متاح دون إنشاء حساب سحابي.');
  const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  await updateProfile(credential.user, { displayName });
  await setDoc(doc(firestore, 'users', credential.user.uid), {
    displayName,
    email,
    role: 'student',
    academicYear: 'السنة الإعدادية',
    term: 'الترم الأول',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
