import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { readLocal, writeLocal } from '../lib/storage';
import { deleteOwnAccountData } from '../lib/account';
import { syncPublicProfile } from '../lib/publicProfiles';
import type { AppUser, UserRole } from '../types';

type ProfileInput = {
  displayName: string;
  photoURL?: string | null;
  phone?: string;
  bio?: string;
  profileVisibility?: 'public' | 'private';
  showBioOnPublicProfile?: boolean;
  showAcademicInfoOnPublicProfile?: boolean;
};

type AuthContextValue = {
  user: AppUser | null;
  isDemo: boolean;
  loading: boolean;
  profileComplete: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  completeProfile: (profile: ProfileInput) => Promise<void>;
  saveProfile: (profile: ProfileInput) => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
  logout: () => Promise<void>;
  toggleDemoRole: () => void;
};

const demoUser: AppUser = {
  uid: 'demo-student',
  displayName: 'طالب تجريبي',
  email: 'student@enghub.demo',
  photoURL: null,
  role: 'student',
  academicYear: 'السنة الإعدادية',
  term: 'الترم الأول',
  providerId: 'demo',
};

const AuthContext = createContext<AuthContextValue | null>(null);

function appUserFromFirebase(firebaseUser: FirebaseUser, profile: Record<string, unknown>, role: UserRole): AppUser {
  return {
    uid: firebaseUser.uid,
    displayName: String(profile.displayName || firebaseUser.displayName || ''),
    email: firebaseUser.email || '',
    photoURL: (profile.photoURL as string | null | undefined) ?? firebaseUser.photoURL,
    phone: typeof profile.phone === 'string' ? profile.phone : '',
    bio: typeof profile.bio === 'string' ? profile.bio : '',
    profileVisibility: profile.profileVisibility === 'private' ? 'private' : 'public',
    showBioOnPublicProfile: profile.showBioOnPublicProfile !== false,
    showAcademicInfoOnPublicProfile: profile.showAcademicInfoOnPublicProfile !== false,
    providerId: firebaseUser.providerData[0]?.providerId ?? 'password',
    role,
    academicYear: String(profile.academicYear || 'السنة الإعدادية'),
    term: String(profile.term || 'الترم الأول'),
  };
}

function hasValidAdminRecord(record: Record<string, unknown> | undefined, email: string): boolean {
  return Boolean(
    record
    && record.active === true
    && (record.role === 'admin' || record.role === 'super-admin')
    && String(record.email ?? '').trim() === email,
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => isFirebaseConfigured ? null : readLocal('demoUser', demoUser));
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [profileComplete, setProfileComplete] = useState(!isFirebaseConfigured);

  useEffect(() => {
    const firebaseAuth = auth;
    const firestore = db;
    if (!firebaseAuth || !firestore) {
      setLoading(false);
      setProfileComplete(true);
      return;
    }

    const stop = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      setLoading(true);
      if (!firebaseUser) {
        setUser(null);
        setProfileComplete(false);
        setLoading(false);
        return;
      }

      try {
        const profileRef = doc(firestore, 'users', firebaseUser.uid);
        const profileSnap = await getDoc(profileRef);
        const profile = profileSnap.exists() ? profileSnap.data() : {};
        const authEmail = (firebaseUser.email ?? '').trim();
        const adminSnap = authEmail ? await getDoc(doc(firestore, 'admins', authEmail)) : null;
        const adminRecord = adminSnap?.exists() ? adminSnap.data() : undefined;
        const token = await firebaseUser.getIdTokenResult();
        const activeAdmin = authEmail ? hasValidAdminRecord(adminRecord, authEmail) : false;
        const storedAdminRole: UserRole = adminRecord?.role === 'super-admin' ? 'super-admin' : 'admin';
        const role: UserRole = activeAdmin
          ? storedAdminRole
          : token.claims.role === 'moderator'
            ? 'moderator'
            : 'student';

        // Migrate only existing, completed profiles into the safe public projection.
        // New OAuth accounts stay unpublished until the owner completes onboarding.
        if (profileSnap.exists() && profile.profileCompleted === true) {
          try {
            await syncPublicProfile({
              uid: firebaseUser.uid,
              displayName: String(profile.displayName || firebaseUser.displayName || ''),
              photoURL: (profile.photoURL as string | null | undefined) ?? firebaseUser.photoURL,
              bio: typeof profile.bio === 'string' ? profile.bio : '',
              academicYear: String(profile.academicYear || ''),
              term: String(profile.term || ''),
              profileVisibility: profile.profileVisibility === 'private' ? 'private' : 'public',
              showBioOnPublicProfile: profile.showBioOnPublicProfile !== false,
              showAcademicInfoOnPublicProfile: profile.showAcademicInfoOnPublicProfile !== false,
            });
          } catch (publicProfileError) {
            console.warn('ENG HUB public profile sync is pending Firestore rules publication.', publicProfileError);
          }
        }

        const isGoogleAccount = firebaseUser.providerData.some((provider) => provider.providerId === 'google.com');
        const profileName = String(profile.displayName || firebaseUser.displayName || '').trim();
        const legacyEmailProfileIsComplete = !isGoogleAccount
          && profileSnap.exists()
          && profileName.length > 1
          && profileName !== 'طالب هندسة';
        const isComplete = profileSnap.exists()
          && (profile.profileCompleted === true || legacyEmailProfileIsComplete);

        setUser(appUserFromFirebase(firebaseUser, profile, role));
        setProfileComplete(isComplete);
      } catch (error) {
        console.error('ENG HUB could not load the signed-in profile.', error);
        setUser(appUserFromFirebase(firebaseUser, {}, 'student'));
        setProfileComplete(false);
      } finally {
        setLoading(false);
      }
    });
    return stop;
  }, []);

  const login = async (email: string, password: string) => {
    const firebaseAuth = auth;
    if (!firebaseAuth) {
      const next = { ...demoUser, displayName: email.split('@')[0] || demoUser.displayName, email };
      setUser(next);
      setProfileComplete(true);
      writeLocal('demoUser', next);
      return;
    }
    await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  };

  const loginWithGoogle = async () => {
    const firebaseAuth = auth;
    if (!firebaseAuth) {
      const next = { ...demoUser, displayName: 'طالب تجريبي' };
      setUser(next);
      setProfileComplete(true);
      writeLocal('demoUser', next);
      return;
    }
    const provider = new GoogleAuthProvider();
    // Redirect is more reliable than popups on phones and embedded browsers.
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isEmbeddedBrowser = /FBAN|FBAV|Instagram|Line\//i.test(userAgent);
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
      || (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true);
    if (isMobile || isEmbeddedBrowser) {
      await signInWithRedirect(firebaseAuth, provider);
      return;
    }
    await signInWithPopup(firebaseAuth, provider);
  };

  const persistProfile = async (profile: ProfileInput) => {
    const firebaseUser = auth?.currentUser;
    const firestore = db;
    const displayName = profile.displayName.trim();
    if (!firebaseUser || !firestore) throw new Error('يجب تسجيل الدخول قبل حفظ بيانات الملف الشخصي.');
    if (displayName.length < 2) throw new Error('اكتب اسمًا صحيحًا من حرفين على الأقل.');

    const photoURL = profile.photoURL?.trim() || null;
    const phone = profile.phone?.trim() || '';
    const bio = profile.bio?.trim() || '';
    const profileVisibility = profile.profileVisibility === 'private' ? 'private' : 'public';
    const showBioOnPublicProfile = profile.showBioOnPublicProfile !== false;
    const showAcademicInfoOnPublicProfile = profile.showAcademicInfoOnPublicProfile !== false;

    await updateProfile(firebaseUser, { displayName, photoURL });

    const profileRef = doc(firestore, 'users', firebaseUser.uid);
    const existing = await getDoc(profileRef);
    const editableFields = {
      displayName,
      photoURL,
      phone,
      bio,
      profileVisibility,
      showBioOnPublicProfile,
      showAcademicInfoOnPublicProfile,
      profileCompleted: true,
      updatedAt: serverTimestamp(),
    };

    if (existing.exists()) {
      // Keep protected account fields unchanged; Firestore rules allow only profile edits.
      await setDoc(profileRef, editableFields, { merge: true });
    } else {
      await setDoc(profileRef, {
        ...editableFields,
        email: firebaseUser.email || '',
        role: 'student',
        status: 'active',
        academicYear: 'السنة الإعدادية',
        term: 'الترم الأول',
        createdAt: serverTimestamp(),
      });
    }

    try {
      await syncPublicProfile({
        uid: firebaseUser.uid,
        displayName,
        photoURL,
        bio,
        academicYear: user?.academicYear || 'السنة الإعدادية',
        term: user?.term || 'الترم الأول',
        profileVisibility,
        showBioOnPublicProfile,
        showAcademicInfoOnPublicProfile,
      });
    } catch (publicProfileError) {
      console.warn('ENG HUB profile saved privately; public projection will sync after rules are published.', publicProfileError);
    }

    const previousRole = user?.role ?? 'student';
    setUser((current) => current ? {
      ...current,
      displayName,
      photoURL,
      phone,
      bio,
      profileVisibility,
      showBioOnPublicProfile,
      showAcademicInfoOnPublicProfile,
      role: previousRole,
    } : current);
    setProfileComplete(true);
  };

  const completeProfile = async (profile: ProfileInput) => persistProfile(profile);
  const saveProfile = async (profile: ProfileInput) => persistProfile(profile);

  const deleteAccount = async (password?: string) => {
    const firebaseUser = auth?.currentUser;
    const firestore = db;
    if (!firebaseUser || !firestore) throw new Error('حذف الحساب متاح للحسابات المرتبطة بـ Firebase فقط.');

    const email = (firebaseUser.email ?? '').trim();
    if (email) {
      const adminSnap = await getDoc(doc(firestore, 'admins', email));
      if (adminSnap.exists() && hasValidAdminRecord(adminSnap.data(), email)) {
        throw new Error('هذا الحساب يمتلك صلاحية مدير. عطّل مستنده في admins من Firebase Console أولاً، ثم سجّل الدخول مجدداً لحذف الحساب.');
      }
    }

    const providerIds = firebaseUser.providerData.map((provider) => provider.providerId);
    if (providerIds.includes('password')) {
      if (!password) throw new Error('أدخل كلمة مرور الحساب لتأكيد هويتك قبل الحذف.');
      const credential = EmailAuthProvider.credential(firebaseUser.email || '', password);
      await reauthenticateWithCredential(firebaseUser, credential);
    } else if (providerIds.includes('google.com')) {
      await reauthenticateWithPopup(firebaseUser, new GoogleAuthProvider());
    } else {
      throw new Error('يتطلب حذف هذا الحساب إعادة تسجيل الدخول بالطريقة نفسها التي أنشأته بها.');
    }

    try {
      await deleteOwnAccountData(firestore, firebaseUser.uid);
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      if (code === 'permission-denied') {
        throw new Error('رفضت قواعد Firestore حذف بعض بيانات الحساب. افتح Firebase Console ثم Firestore Database → Rules، وانشر آخر نسخة من firestore.rules الموجودة في المستودع، ثم أعد المحاولة.');
      }
      if (code === 'failed-precondition') {
        throw new Error('تعذر تنظيف بعض البيانات بسبب فهرس Firestore أو شرط قاعدة بيانات. راجع رسالة الخطأ في وحدة تحكم Firebase ثم أعد المحاولة.');
      }
      throw error;
    }

    try {
      await deleteUser(firebaseUser);
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      if (code === 'auth/requires-recent-login') {
        throw new Error('انتهت صلاحية التحقق الأمني. سجّل الخروج ثم الدخول مجدداً، وبعدها أعد حذف الحساب.');
      }
      if (code === 'auth/network-request-failed') {
        throw new Error('انقطع الاتصال أثناء حذف الحساب. تحقق من الإنترنت ثم أعد المحاولة.');
      }
      throw error;
    }
    setUser(null);
    setProfileComplete(false);
  };

  const logout = async () => {
    if (auth) {
      await signOut(auth);
      return;
    }
    const next = { ...demoUser, displayName: 'زائر تجريبي', email: 'guest@enghub.demo' };
    setUser(next);
    setProfileComplete(true);
    writeLocal('demoUser', next);
  };

  const toggleDemoRole = () => {
    if (isFirebaseConfigured) return;
    setUser((current) => {
      if (!current) return current;
      const role: UserRole = current.role === 'student' ? 'admin' : 'student';
      const next = { ...current, role, displayName: role === 'admin' ? 'مدير تجريبي' : 'طالب تجريبي' };
      writeLocal('demoUser', next);
      return next;
    });
  };

  const value = useMemo(() => ({
    user, isDemo: !isFirebaseConfigured, loading, profileComplete,
    login, loginWithGoogle, completeProfile, saveProfile, deleteAccount, logout, toggleDemoRole,
  }), [user, loading, profileComplete]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export async function registerAccount(email: string, password: string, displayName: string) {
  const firebaseAuth = auth;
  if (!firebaseAuth) throw new Error('Firebase غير مهيأ بعد. لا يمكن إنشاء حساب سحابي حالياً.');
  const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
  if (displayName.trim()) await updateProfile(credential.user, { displayName: displayName.trim() });
  // The account remains in the completion step until its profile is explicitly saved.
}
