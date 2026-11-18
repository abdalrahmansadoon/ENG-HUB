import { useState, type FormEvent } from 'react';
import { Clock3, Info, X } from 'lucide-react';
import type { ChatSlowModeStatus } from '../../lib/chat';

export function ChatSlowModeModal({ initial, onClose, onSave, busy }: {
  initial: ChatSlowModeStatus;
  onClose: () => void;
  onSave: (enabled: boolean, seconds: number) => Promise<void>;
  busy: boolean;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [seconds, setSeconds] = useState(String(initial.seconds || 15));
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const value = Number(seconds);
    if (enabled && (!Number.isInteger(value) || value < 5 || value > 300)) {
      setError('اختر مدة صحيحة بين 5 و300 ثانية.');
      return;
    }
    await onSave(enabled, enabled ? value : 0);
  };

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="modal-card eh-chat-settings-modal" role="dialog" aria-modal="true" aria-labelledby="chat-slow-mode-title">
      <header className="modal-head">
        <div><span className="eh-eyebrow">MODERATION SETTINGS</span><h2 id="chat-slow-mode-title">إعدادات الوضع البطيء</h2><p>ضع فترة انتظار بين رسائل الطلاب لتقليل التتابع السريع والرسائل المزعجة.</p></div>
        <button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="إغلاق"><X size={18}/></button>
      </header>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <label className="eh-chat-setting-toggle">
          <span><b>تفعيل الوضع البطيء</b><small>سيُطلب من الطالب الانتظار قبل إرسال رسالة أخرى. لا ينطبق ذلك على المشرفين.</small></span>
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)}/>
        </label>
        {enabled && <label>المدة بين الرسائل (بالثواني)
          <input type="number" min={5} max={300} step={1} value={seconds} onChange={(event) => setSeconds(event.target.value)} required/>
        </label>}
        <div className="eh-chat-lock-note"><Info size={16}/><span>المهلة محفوظة لكل مستخدم داخل هذه الغرفة، وتُراجع مع عملية إرسال الرسالة في Firestore. اختر من 5 إلى 300 ثانية.</span></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>إلغاء</button>
          <button type="submit" className="btn btn-primary" disabled={busy}><Clock3 size={15}/>{busy ? 'جارٍ الحفظ...' : enabled ? 'تفعيل الوضع البطيء' : 'إيقاف الوضع البطيء'}</button>
        </div>
      </form>
    </section>
  </div>;
}
