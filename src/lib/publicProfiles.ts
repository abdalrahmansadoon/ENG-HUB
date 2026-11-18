import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface PublicProfileWrite {
  uid: string;
  displayName: string;
  photoURL?: string | null;
  bio?: string;
  academicYear?: string;
  term?: string;
  profileVisibility?: 'public' | 'private';
  showBioOnPublicProfile?: boolean;
  showAcademicInfoOnPublicProfile?: boolean;
}

/**
 * Writes a strict public-profile projection.
 * Never persist email, phone, role, account status or other private fields here.
 */
export async function syncPublicProfile(profile: PublicProfileWrite): Promise<void> {
  if (!db) throw new Error('Firebase غير متصل.');
  const showBio = profile.showBioOnPublicProfile !== false;
  const showAcademic = profile.showAcademicInfoOnPublicProfile !== false;
  await setDoc(doc(db, 'publicProfiles', profile.uid), {
    uid: profile.uid,
    displayName: profile.displayName.trim(),
    photoURL: profile.photoURL ?? null,
    bio: showBio ? (profile.bio ?? '') : '',
    academicYear: showAcademic ? (profile.academicYear ?? '') : '',
    term: showAcademic ? (profile.term ?? '') : '',
    profileVisibility: profile.profileVisibility === 'private' ? 'private' : 'public',
    showBioOnPublicProfile: showBio,
    showAcademicInfoOnPublicProfile: showAcademic,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
