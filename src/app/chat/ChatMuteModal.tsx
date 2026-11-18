import { useState, type FormEvent } from 'react';
import { Clock3, ShieldCheck, X } from 'lucide-react';

const options = [
  { value: '60', label: 'ساعة واحدة' },
  { value: '1440', label: 'يوم واحد' },
  { value: '4320', label: '3 أيام' },
  { value: '10080', label: '7 أيام' },
  { value: '43200', label: '30 يوماً' },
  { value: 'custom', label: 'وقت مخصص' },
  { value: 'manual', label: 'حتى إلغاء الكتم يدوياً' },
];

const toLocalInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export function ChatMuteModal({ userName, onClose, onSave, busy }: {
  userName: string;
  onClose: () => void;
  onSave: (duration: number | Date | null, reason: string) => Promise<void>;
  busy: boolean;
}) {
  const [duration, setDuration] = useState('60');
  const [endAt, setEndAt] = useState(toLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (duration === 'custom') {
      const until = new Date(endAt);
      if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
        setError('حدد تاريخاً ووقتاً في المستقبل.');
        return;
      }
      await onSave(until, reason.trim());
      return;
    }
    await onSave(duration === 'manual' ? null : Number(duration), reason.trim());
  };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="modal-card eh-chat-settings-modal" role="dialog" aria-modal="true" aria-labelledby="chat-mute-title">
      <header className="modal-head"><div><span className="eh-eyebrow">STUDENT MODERATION</span><h2 id="chat-mute-title">كتم مشاركة الطالب</h2><p>لن يتمكن {userName} من إرسال الرسائل أو المرفقات أو التفاعلات خلال المدة المحددة.</p></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="إغلاق"><X size={18}/></button></header>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <label>مدة الكتم<select value={duration} onChange={(event) => setDuration(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {duration === 'custom' && <label>تاريخ ووقت انتهاء الكتم<input type="datetime-local" min={toLocalInput(new Date())} value={endAt} onChange={(event) => setEndAt(event.target.value)} required/></label>}
        <label>سبب الكتم (اختياري)<textarea rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="يمكن كتابة ملاحظة توضح سبب الإجراء..."/></label>
        <div className="eh-chat-lock-note"><ShieldCheck size={16}/><span>يُحفظ إجراء الكتم داخل غرفة المحادثة المحددة فقط، ويمكن إلغاء الكتم في أي وقت.</span></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>إلغاء</button><button type="submit" className="btn btn-primary" disabled={busy}><Clock3 size={15}/>{busy ? 'جارٍ الحفظ...' : 'تأكيد الكتم'}</button></div>
      </form>
    </section>
  </div>;
}
