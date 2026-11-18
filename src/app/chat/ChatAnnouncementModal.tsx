import { useState, type FormEvent } from 'react';
import { Megaphone, Pencil, X } from 'lucide-react';

export function ChatAnnouncementModal({ initialText = '', onClose, onSave, busy }: {
  initialText?: string;
  onClose: () => void;
  onSave: (text: string) => Promise<void>;
  busy: boolean;
}) {
  const [text, setText] = useState(initialText);
  const [error, setError] = useState('');
  const editing = Boolean(initialText);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (text.trim().length < 4) { setError('اكتب تعميماً واضحاً من أربعة أحرف على الأقل.'); return; }
    await onSave(text.trim());
  };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="modal-card eh-chat-settings-modal" role="dialog" aria-modal="true" aria-labelledby="chat-announcement-title">
      <header className="modal-head"><div><span className="eh-eyebrow">ROOM ANNOUNCEMENT</span><h2 id="chat-announcement-title">{editing ? 'تعديل التعميم' : 'إضافة تعميم جديد'}</h2><p>سيظهر التعميم لجميع أعضاء هذه المحادثة بشكل منفصل عن الرسائل.</p></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="إغلاق"><X size={18}/></button></header>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <label>نص التعميم<textarea autoFocus rows={6} maxLength={2500} value={text} onChange={(event) => setText(event.target.value)} placeholder="اكتب إعلاناً أو تعليمات مهمة لأعضاء الغرفة..." required/></label>
        <div className="eh-announcement-preview"><span><Megaphone size={17}/></span><div><b>معاينة التعميم</b><p>{text.trim() || 'سيظهر نص التعميم هنا بعد كتابته.'}</p></div></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>إلغاء</button><button type="submit" className="btn btn-primary" disabled={busy || text.trim().length < 4}>{busy ? 'جارٍ الحفظ...' : <>{editing ? <Pencil size={15}/> : <Megaphone size={15}/>}{editing ? 'حفظ التعديل' : 'نشر التعميم'}</>}</button></div>
      </form>
    </section>
  </div>;
}
