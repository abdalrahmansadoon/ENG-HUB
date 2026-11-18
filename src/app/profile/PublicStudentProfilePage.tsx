import { useEffect, useState } from 'react';
import { ArrowDownLeft, BookOpen, GraduationCap, Lock, ShieldCheck, UserRound } from 'lucide-react';
import { getPublicStudentProfile, type PublicStudentProfile } from '../../lib/profiles';

export function PublicStudentProfilePage({ uid, currentUid, onBack }: {
  uid: string;
  currentUid: string;
  onBack: () => void;
}) {
  const [profile, setProfile] = useState<PublicStudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setProfile(null);
    if (uid && uid === currentUid) {
      setLoading(false);
      onBack();
      return;
    }
    void getPublicStudentProfile(uid).then((next) => {
      if (!cancelled) setProfile(next);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'تعذر تحميل الملف الشخصي.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid, currentUid]);

  return <main className="eh-public-profile-page">
    <button type="button" className="eh-button" onClick={onBack}><ArrowDownLeft size={16}/> رجوع</button>
    {loading ? <section className="eh-public-profile-state"><span className="spinner"/><b>جارٍ تحميل الملف الشخصي</b></section>
      : error ? <section className="eh-public-profile-state"><span className="eh-public-profile-state-icon"><Lock size={25}/></span><b>لا يمكن عرض هذا الملف</b><p>{error}</p></section>
      : profile ? <section className="eh-public-profile-card">
          <div className="eh-public-profile-cover"/>
          <div className="eh-public-profile-content">
            <div className="eh-public-profile-avatar">{profile.photoURL ? <img src={profile.photoURL} alt={profile.displayName}/> : <span>{profile.displayName.slice(0,1) || <UserRound size={30}/>}</span>}</div>
            <span className="eh-eyebrow">ENG HUB · PUBLIC STUDENT PROFILE</span>
            <h1>{profile.displayName}</h1>
            {profile.username && <small className="eh-public-profile-username">@{profile.username}</small>}
            {profile.bio && <p className="eh-public-profile-bio">{profile.bio}</p>}
            <div className="eh-public-profile-facts">
              {profile.academicYear && <span><GraduationCap size={16}/>{profile.academicYear}</span>}
              {profile.term && <span><BookOpen size={16}/>{profile.term}</span>}
              <span><ShieldCheck size={16}/>ملف عام</span>
            </div>
          </div>
        </section> : null}
  </main>;
}
