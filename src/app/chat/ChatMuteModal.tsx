import { useState, type FormEvent } from 'react';
import { Clock3, ShieldCheck, X } from 'lucide-react';

const options = [
  { value: '15', label: '15 دقيقة' },
  { value: '60', label: 'ساعة واحدة' },
  { value: '360', label: '6 ساعات' },
  { value: '1440', label: '24 ساعة' },
  { value: '10080', label: '7 أيام' },
  { value: 'manual', label: 'حتى إلغاء الكتم يدوياً' },
];

export function ChatMuteModal({ userName, onClose, onSave, busy }: {
  userName: string;
  onClose: () => void;
  onSave: (minutes: number | null) => Promise<void>;
  busy: boolean;
}) {
  const [duration, setDuration] = useState('60');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSave(duration === 'manual' ? null : Number(duration));
  };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="modal-card eh-chat-settings-modal" role="dialog" aria-modal="true" aria-labelledby="chat-mute-title">
      <header className="modal-head"><div><span className="eh-eyebrow">STUDENT MODERATION</span><h2 id="chat-mute-title">كتم مشاركة الطالب</h2><p>لن يتمكن {userName} من إرسال رسائل خلال المدة المحددة.</p></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="إغلاق"><X size={18}/></button></header>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <label>مدة الكتم<select value={duration} onChange={(event) => setDuration(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <div className="eh-chat-lock-note"><ShieldCheck size={16}/><span>يمكنك إلغاء الكتم في أي وقت من قائمة إجراءات رسالة الطالب.</span></div>
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>إلغاء</button><button type="submit" className="btn btn-primary" disabled={busy}><Clock3 size={15}/>{busy ? 'جارٍ الحفظ...' : 'تأكيد الكتم'}</button></div>
      </form>
    </section>
  </div>;
}
