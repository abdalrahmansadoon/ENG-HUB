import { useState, type FormEvent } from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';

export function ChatWarningModal({ userName, onClose, onSave, busy }: {
  userName: string;
  onClose: () => void;
  onSave: (reason: string) => Promise<void>;
  busy: boolean;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (reason.trim().length < 4) { setError('اكتب سبباً واضحاً للتحذير.'); return; }
    await onSave(reason.trim());
  };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="modal-card eh-chat-settings-modal" role="dialog" aria-modal="true" aria-labelledby="chat-warning-title">
      <header className="modal-head"><div><span className="eh-eyebrow">COMMUNITY MODERATION</span><h2 id="chat-warning-title">إرسال تحذير إداري</h2><p>سيظهر التحذير لصاحبه في المحادثة العامة.</p></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="إغلاق"><X size={18}/></button></header>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <div className="eh-chat-warning-recipient"><span><AlertTriangle size={18}/></span><div><b>{userName}</b><small>المستخدم المستهدف بالتحذير</small></div></div>
        <label>سبب التحذير<textarea rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="اشرح سبب التحذير وما الذي يجب على المستخدم تعديله..." required/></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>إلغاء</button><button type="submit" className="btn btn-primary" disabled={busy || reason.trim().length < 4}><ShieldCheck size={15}/>{busy ? 'جارٍ الإرسال...' : 'إرسال التحذير'}</button></div>
      </form>
    </section>
  </div>;
}
