import { useState, type FormEvent } from 'react';
import { CalendarClock, Info, Lock, X } from 'lucide-react';

const toLocalInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export function ChatLockModal({ onClose, onSave, busy }: {
  onClose: () => void;
  onSave: (startAt: Date, endAt: Date | null, reason: string, autoExpire: boolean) => Promise<void>;
  busy: boolean;
}) {
  const [startAt, setStartAt] = useState(toLocalInput(new Date()));
  const [endAt, setEndAt] = useState('');
  const [autoExpire, setAutoExpire] = useState(true);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    const start = new Date(startAt);
    const end = autoExpire && endAt ? new Date(endAt) : null;
    if (Number.isNaN(start.getTime())) { setError('حدد وقت بداية صحيحاً.'); return; }
    if (autoExpire && (!end || Number.isNaN(end.getTime()) || end <= start)) {
      setError('حدد وقت انتهاء بعد وقت البداية، أو أوقف الفتح التلقائي.');
      return;
    }
    await onSave(start, end, reason.trim(), autoExpire);
  };

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="modal-card eh-chat-settings-modal" role="dialog" aria-modal="true" aria-labelledby="chat-lock-title">
      <header className="modal-head"><div><span className="eh-eyebrow">MODERATION SETTINGS</span><h2 id="chat-lock-title">إعدادات قفل المحادثة</h2><p>حدد متى يتوقف إرسال الطلاب ومتى تعود المحادثة للعمل.</p></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="إغلاق"><X size={18}/></button></header>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <label>بداية القفل<input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required/></label>
        <label className="eh-chat-setting-toggle"><span><b>فتح تلقائي في موعد محدد</b><small>أوقف الخيار لإبقاء المحادثة مقفلة حتى يفتحها مدير المنصة.</small></span><input type="checkbox" checked={autoExpire} onChange={(event) => setAutoExpire(event.target.checked)}/></label>
        {autoExpire && <label>موعد فتح المحادثة<input type="datetime-local" value={endAt} min={startAt} onChange={(event) => setEndAt(event.target.value)} required/></label>}
        <label>سبب القفل (اختياري)<textarea rows={3} maxLength={400} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="مثال: صيانة أو تنظيم للمحادثة"/></label>
        <div className="eh-chat-lock-note"><Info size={16}/><span>سيُمنع الطلاب من الإرسال خلال فترة القفل، لكن يستطيع المدير مواصلة الكتابة وإرسال التعليمات.</span></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>إلغاء</button><button type="submit" className="btn btn-primary" disabled={busy}><Lock size={15}/>{busy ? 'جارٍ الحفظ...' : 'حفظ القفل'}</button></div>
      </form>
    </section>
  </div>;
}
