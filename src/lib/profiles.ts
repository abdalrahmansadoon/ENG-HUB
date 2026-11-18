import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface PublicStudentProfile {
  uid: string;
  displayName: string;
  username?: string;
  photoURL?: string | null;
  bio?: string;
  academicYear?: string;
  term?: string;
  profileVisibility: 'public' | 'private';
  showBioOnPublicProfile: boolean;
  showAcademicInfoOnPublicProfile: boolean;
}

export async function getPublicStudentProfile(uid: string): Promise<PublicStudentProfile> {
  if (!db) throw new Error('Firebase غير متصل.');
  if (!uid) throw new Error('رابط الملف الشخصي غير صالح.');
  let snapshot;
  try {
    snapshot = await getDoc(doc(db, 'users', uid));
  } catch (error) {
    const code = (error as { code?: string })?.code ?? '';
    if (code === 'permission-denied') throw new Error('هذا الملف الشخصي خاص ولا يمكن عرضه للطلاب الآخرين.');
    throw error;
  }
  if (!snapshot.exists()) throw new Error('الملف الشخصي غير موجود.');
  const data = snapshot.data();
  if (data.profileVisibility === 'private') {
    throw new Error('هذا الملف الشخصي خاص ولا يمكن عرضه للطلاب الآخرين.');
  }
  return {
    uid,
    displayName: String(data.displayName ?? data.name ?? 'طالب هندسة'),
    username: typeof data.username === 'string' ? data.username : undefined,
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
    bio: data.showBioOnPublicProfile === false ? '' : (typeof data.bio === 'string' ? data.bio : ''),
    academicYear: typeof data.academicYear === 'string' ? data.academicYear : '',
    term: typeof data.term === 'string' ? data.term : '',
    profileVisibility: 'public',
    showBioOnPublicProfile: data.showBioOnPublicProfile !== false,
    showAcademicInfoOnPublicProfile: data.showAcademicInfoOnPublicProfile !== false,
  };
}
