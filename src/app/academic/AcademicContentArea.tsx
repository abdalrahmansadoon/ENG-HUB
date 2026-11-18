import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDown, ArrowUpLeft, BookOpen, Check, ChevronLeft, ChevronRight, ClipboardList,
  Download, ExternalLink, File, FileText, Folder, FolderPlus, GraduationCap, Layers3,
  Link2, Lock, MoreHorizontal, Play, Plus, Search, ShieldCheck, Trash2, Video, X,
} from 'lucide-react';
import type { Subject } from '../../types';
import type {
  AcademicContentCategory, AcademicContentKind, AcademicContentNode, CreateAcademicContentInput,
} from '../../types/academicContent';

const categories: Array<{ id: AcademicContentCategory; title: string; description: string; icon: typeof BookOpen }> = [
  { id: 'lectures', title: 'المحاضرات', description: 'محاضرات المدرسين والفيديوهات المسجلة', icon: Video },
  { id: 'files', title: 'الملفات والمراجع', description: 'مذكرات وشرائح وملفات المادة', icon: FileText },
  { id: 'exams', title: 'الاختبارات', description: 'اختبارات وتدريبات وتقييمات', icon: ClipboardList },
  { id: 'assignments', title: 'الواجبات', description: 'تكليفات وتسليمات المادة', icon: BookOpen },
  { id: 'resources', title: 'مصادر إضافية', description: 'روابط ومراجع ومواد مساندة', icon: Link2 },
  { id: 'custom', title: 'مجلدات مخصصة', description: 'أقسام إضافية حسب طبيعة المقرر', icon: Folder },
];

const kinds: Array<{ id: AcademicContentKind; label: string }> = [
  { id: 'folder', label: 'مجلد جديد' },
  { id: 'lecturer', label: 'مدرس أو معيد' },
  { id: 'lecture', label: 'محاضرة / مجموعة محتوى' },
  { id: 'video', label: 'فيديو' },
  { id: 'file', label: 'ملف أو مذكرة' },
  { id: 'exam', label: 'اختبار' },
  { id: 'assignment', label: 'واجب أو تكليف' },
  { id: 'link', label: 'رابط خارجي' },
  { id: 'note', label: 'محتوى نصي' },
];

interface Props {
  subject: Subject;
  nodes: AcademicContentNode[];
  category: AcademicContentCategory;
  activeNodeId: string;
  isAdmin: boolean;
  onNavigate: (category: AcademicContentCategory, nodeId?: string) => void;
  onCreate: (input: CreateAcademicContentInput) => Promise<void>;
  onDelete: (node: AcademicContentNode) => Promise<void>;
  onUpload: (file: File) => Promise<{ url: string; mimeType: string }>;
}

export function AcademicContentArea({
  subject, nodes, category, activeNodeId, isAdmin, onNavigate, onCreate, onDelete, onUpload,
}: Props) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const activeNode = nodes.find((node) => node.id === activeNodeId) ?? null;
  const children = useMemo(
    () => nodes.filter((node) => node.parentId === (activeNodeId || null) && node.category === category)
      .filter((node) => (node.title + ' ' + node.description).toLowerCase().includes(search.trim().toLowerCase())),
    [nodes, activeNodeId, category, search],
  );
  const linked = activeNode?.linkedNodeIds
    .map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is AcademicContentNode => Boolean(node)) ?? [];
  const openAdd = () => setModalOpen(true);

  const remove = async (node: AcademicContentNode) => {
    if (!window.confirm(`سيتم حذف "${node.title}" وكل ما بداخله من عناصر. هل تريد المتابعة؟`)) return;
    await onDelete(node);
  };

  return <div className="eh-content-studio">
    <div className="eh-content-studio-head">
      <div className="eh-content-studio-title">
        <span className="eh-eyebrow">COURSE CONTENT SYSTEM</span>
        <h2>{subject.name}</h2>
        <p>{subject.code} · مساحة محتوى قابلة للتشكيل حسب طبيعة المادة</p>
      </div>
      <div className="eh-content-studio-actions">
        <label className="eh-content-search"><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث داخل هذا القسم"/></label>
        {isAdmin && <button type="button" className="eh-button primary" onClick={openAdd}><Plus size={16}/> إضافة محتوى</button>}
      </div>
    </div>

    <nav className="eh-content-breadcrumb" aria-label="مسار محتوى المادة">
      <button type="button" onClick={() => onNavigate(category)}><BookOpen size={15}/> {subject.name}</button>
      <ChevronLeft size={14}/>
      <button type="button" className={!activeNode ? 'active' : ''} onClick={() => onNavigate(category)}>{categories.find((item) => item.id === category)?.title ?? 'المحتوى'}</button>
      {activeNode && <>
        <ChevronLeft size={14}/>
        <span>{activeNode.title}</span>
      </>}
      {activeNode && <button type="button" className="eh-content-back" onClick={() => onNavigate(category, activeNode.parentId || undefined)}><ArrowDown size={14}/> رجوع</button>}
    </nav>

    {!activeNode && <section className="eh-content-category-grid">
      {categories.map((item) => {
        const Icon = item.icon;
        const count = nodes.filter((node) => node.category === item.id && node.parentId === null).length;
        return <button type="button" className={category === item.id ? 'eh-content-category selected' : 'eh-content-category'} key={item.id} onClick={() => onNavigate(item.id)}>
          <span className="eh-content-category-icon"><Icon size={23}/></span>
          <span className="eh-content-category-copy"><b>{item.title}</b><small>{item.description}</small></span>
          <span className="eh-content-category-count">{count}</span>
          <ChevronLeft size={17}/>
        </button>;
      })}
    </section>}

    <section className="eh-content-items-section">
      <div className="eh-content-items-heading">
        <div><span className="eh-eyebrow">{category.toUpperCase()} · CONTENT</span><h3>{activeNode?.title ?? (categories.find((item) => item.id === category)?.title || 'المحتوى')}</h3></div>
        <span>{children.length} عنصر</span>
      </div>
      {children.length > 0 ? <div className="eh-content-item-grid">
        {children.map((node, index) => {
          const isFolder = node.kind === 'folder' || node.kind === 'lecturer' || node.kind === 'lecture';
          const Icon = node.kind === 'folder' ? Folder : node.kind === 'lecturer' ? GraduationCap : node.kind === 'lecture' ? BookOpen : node.kind === 'video' ? Video : node.kind === 'exam' ? ClipboardList : node.kind === 'file' ? FileText : node.kind === 'link' ? ExternalLink : File;
          const isDraft = node.publicationStatus === 'draft';
          return <article className="eh-content-item-card" key={node.id}>
            <button type="button" className="eh-content-item-open" onClick={() => isFolder ? onNavigate(category, node.id) : onNavigate(category, node.id)}>
              <span className={`eh-content-item-icon kind-${node.kind}`}><Icon size={22}/></span>
              <span className="eh-content-item-main"><b>{node.title}</b><small>{node.description || kinds.find((kind) => kind.id === node.kind)?.label}</small></span>
              <ChevronLeft size={16}/>
            </button>
            <div className="eh-content-item-meta">
              <span>{node.kind === 'folder' ? 'مجلد' : node.kind === 'lecturer' ? 'مدرس / معيد' : node.kind === 'lecture' ? 'محاضرة' : node.kind === 'video' ? 'فيديو' : node.kind === 'file' ? 'ملف' : node.kind === 'exam' ? 'اختبار' : node.kind === 'assignment' ? 'واجب' : node.kind === 'link' ? 'رابط' : 'محتوى'}</span>
              {node.duration && <span>{node.duration}</span>}
              {isDraft && <span className="eh-content-draft"><Lock size={11}/> مسودة</span>}
              {node.linkedNodeIds.length > 0 && <span><Link2 size={12}/> {node.linkedNodeIds.length} روابط مرتبطة</span>}
            </div>
            {isAdmin && node.createdBy !== 'legacy' && <div className="eh-content-item-admin">
              <button type="button" title="حذف العنصر" onClick={() => void remove(node)}><Trash2 size={14}/></button>
            </div>}
          </article>;
        })}
      </div> : <div className="eh-content-empty">
        <span><Layers3 size={28}/></span>
        <b>{search ? 'لا توجد نتائج' : 'هذا القسم جاهز لإضافة محتواه'}</b>
        <p>{isAdmin ? 'أضف مجلداً أو محاضرة أو فيديو أو ملفاً أو اختباراً، ويمكنك ربط العناصر ببعضها.' : 'سيظهر المحتوى هنا عندما ينشره مدير المادة.'}</p>
        {isAdmin && <button type="button" className="eh-button primary" onClick={openAdd}><Plus size={16}/> إنشاء أول عنصر</button>}
      </div>}
    </section>

    {activeNode && <section className="eh-content-detail">
      <header><span className="eh-content-detail-label">CONTENT DETAILS</span><h3>{activeNode.title}</h3>{activeNode.description && <p>{activeNode.description}</p>}</header>
      {(activeNode.kind === 'video' || activeNode.kind === 'lecture') && activeNode.url && <AcademicVideo url={activeNode.url} title={activeNode.title}/>} 
      {activeNode.kind === 'file' && activeNode.url && <a className="eh-related-content-link" href={activeNode.url} target="_blank" rel="noreferrer"><Download size={17}/><span><b>فتح أو تنزيل الملف</b><small>{activeNode.mimeType || 'مرفق المادة'}</small></span><ExternalLink size={15}/></a>}
      {(activeNode.kind === 'link' || activeNode.kind === 'exam' || activeNode.kind === 'assignment') && activeNode.url && <a className="eh-related-content-link" href={activeNode.url} target="_blank" rel="noreferrer"><ExternalLink size={17}/><span><b>{activeNode.kind === 'exam' ? 'فتح الاختبار' : activeNode.kind === 'assignment' ? 'فتح التكليف' : 'فتح الرابط'}</b><small>{activeNode.url}</small></span><ChevronLeft size={15}/></a>}
      {activeNode.kind === 'note' && <div className="eh-content-note">{activeNode.description || activeNode.title}</div>}
      {activeNode.kind === 'folder' && <p className="eh-content-note">افتح العناصر الموجودة داخل هذا المجلد من القائمة أعلاه.</p>}
      {activeNode.kind === 'lecture' && <p className="eh-content-note">هذه مساحة للمحاضرة. أضف تحتها أي عدد من الفيديوهات والملفات والاختبارات أو المجلدات الفرعية.</p>
      {activeNode.kind === 'lecturer' && <p className="eh-content-note">أضف محاضرات هذا المدرس داخل هذا القسم، أو أضف أي مجلدات ومصادر مرتبطة به.</p>}}

      {linked.length > 0 && <div className="eh-related-content"><div className="eh-content-items-heading"><div><span className="eh-eyebrow">CONNECTED MATERIALS</span><h3>محتوى مرتبط بهذا العنصر</h3></div><span>{linked.length} مرتبط</span></div>
        <div className="eh-related-content-grid">{linked.map((node) => <button type="button" className="eh-related-content-link" key={node.id} onClick={() => onNavigate(node.category, node.id)}>
          <span className="eh-related-icon">{node.kind === 'video' ? <Video size={17}/> : node.kind === 'exam' ? <ClipboardList size={17}/> : node.kind === 'folder' ? <Folder size={17}/> : <FileText size={17}/>}</span>
          <span><b>{node.title}</b><small>{kinds.find((item) => item.id === node.kind)?.label ?? node.kind}</small></span><ChevronLeft size={15}/>
        </button>)}</div>
      </div>}
      {isAdmin && <button type="button" className="eh-button primary" onClick={openAdd}><Plus size={16}/> إضافة عنصر داخل {activeNode.kind === 'folder' ? 'المجلد' : 'هذا القسم'}</button>}
    </section>}

    {modalOpen && <AcademicContentModal
      category={category}
      parent={activeNode}
      nodes={nodes}
      onClose={() => setModalOpen(false)}
      onUpload={onUpload}
      onSave={async (input) => { setBusy(true); try { await onCreate(input); setModalOpen(false); } finally { setBusy(false); } }}
      busy={busy}
    />}
  </div>;
}

function AcademicVideo({ url, title }: { url: string; title: string }) {
  let embed = '';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') embed = 'https://www.youtube-nocookie.com/embed/' + parsed.pathname.split('/').filter(Boolean)[0] + '?rel=0';
    else if (host === 'youtube.com' || host.endsWith('.youtube.com')) embed = 'https://www.youtube-nocookie.com/embed/' + (parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop()) + '?rel=0';
    else if (host.endsWith('vimeo.com')) embed = 'https://player.vimeo.com/video/' + parsed.pathname.split('/').filter(Boolean).pop() + '?dnt=1';
  } catch { /* validated when saved */ }
  if (embed) return <div className="eh-content-video"><iframe src={embed} title={title} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div>;
  if (/\.(mp4|webm|mov)(?:[?#].*)?$/i.test(url)) return <div className="eh-content-video"><video src={url} controls playsInline preload="metadata"/></div>;
  return <a className="eh-related-content-link" href={url} target="_blank" rel="noreferrer"><ExternalLink size={17}/><span><b>فتح مصدر الفيديو</b><small>{url}</small></span></a>;
}

function AcademicContentModal({ category, parent, nodes, onClose, onSave, onUpload, busy }: {
  category: AcademicContentCategory;
  parent: AcademicContentNode | null;
  nodes: AcademicContentNode[];
  onClose: () => void;
  onSave: (input: CreateAcademicContentInput) => Promise<void>;
  onUpload: (file: File) => Promise<{ url: string; mimeType: string }>;
  busy: boolean;
}) {
  const [kind, setKind] = useState<AcademicContentKind>(parent?.kind === 'lecture' ? 'video' : 'folder');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [duration, setDuration] = useState('');
  const [itemCategory, setItemCategory] = useState<AcademicContentCategory>(parent?.category || category);
  const [publicationStatus, setPublicationStatus] = useState<'published' | 'draft'>('published');
  const [linkedNodeIds, setLinkedNodeIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [mimeType, setMimeType] = useState('');
  const needsUrl = ['video','file','exam','assignment','link'].includes(kind);
  const availableLinks = nodes.filter((node) => node.id !== parent?.id && node.kind !== 'folder' && node.publicationStatus === 'published');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (title.trim().length < 2) { setError('اكتب عنواناً واضحاً.'); return; }
    if (needsUrl && !url.trim()) { setError('أضف رابطاً أو ارفع الملف.'); return; }
    await onSave({
      parentId: parent?.id ?? null, kind, category: itemCategory, title: title.trim(), description: description.trim(),
      ...(url.trim() ? { url: url.trim() } : {}), ...(mimeType ? { mimeType } : {}),
      duration: duration.trim(), linkedNodeIds, publicationStatus, sortOrder: Date.now(),
    });
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true); setError('');
    try { const result = await onUpload(file); setUrl(result.url); setMimeType(result.mimeType); if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, '')); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر رفع الملف.'); }
    finally { setUploading(false); }
  };

  return <div className="modal-backdrop eh-content-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card eh-content-modal" role="dialog" aria-modal="true" aria-labelledby="eh-content-modal-title">
      <div className="modal-head"><div><span className="eh-eyebrow">CONTENT BUILDER</span><h2 id="eh-content-modal-title">إضافة محتوى للمادة</h2><p>{parent ? 'سيتم إنشاء العنصر داخل: ' + parent.title : 'أنشئ بنية المادة بالطريقة التي تناسبك.'}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={18}/></button></div>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <div className="eh-content-kind-grid">{kinds.map((item) => <button key={item.id} type="button" className={kind === item.id ? 'selected' : ''} onClick={() => setKind(item.id)}><span>{item.id === 'folder' ? <FolderPlus size={17}/> : item.id === 'video' ? <Video size={17}/> : item.id === 'file' ? <FileText size={17}/> : item.id === 'exam' ? <ClipboardList size={17}/> : item.id === 'lecture' ? <GraduationCap size={17}/> : <MoreHorizontal size={17}/>}</span>{item.label}</button>)}</div>
        <label>اسم العنصر<input required minLength={2} maxLength={140} autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === 'folder' ? 'مثال: المحاضرات الإضافية' : 'عنوان المحتوى'}/></label>
        <div className="form-row">
          <label>القسم<select value={itemCategory} onChange={(event) => setItemCategory(event.target.value as AcademicContentCategory)}>{categories.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
          <label>حالة النشر<select value={publicationStatus} onChange={(event) => setPublicationStatus(event.target.value as 'published'|'draft')}><option value="published">منشور للطلاب</option><option value="draft">مسودة للمدير</option></select></label>
        </div>
        {needsUrl && <label>الرابط<input type="url" dir="ltr" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..."/></label>}
        {kind === 'file' && <label className="eh-content-upload"><input type="file" onChange={(event) => void upload(event.target.files?.[0])}/><span><File size={18}/>{uploading ? 'جارٍ رفع الملف...' : url ? 'تم رفع الملف — يمكنك استبداله' : 'رفع ملف إلى مكتبة المادة'}</span></label>}
        {['video','lecture'].includes(kind) && <label>المدة (اختياري)<input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="مثال: 35 دقيقة"/></label>}
        <label>وصف أو ملاحظات<textarea rows={3} maxLength={1400} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="تفاصيل المحتوى أو تعليمات الطالب..."/></label>
        {availableLinks.length > 0 && <div className="eh-content-link-picker"><b>ربط هذا العنصر بملفات أو فيديوهات أو اختبارات أخرى</b><small>يمكن اختيار أكثر من عنصر، وتظهر الروابط في صفحة المحتوى بعد النشر.</small><div>{availableLinks.map((node) => <label key={node.id}><input type="checkbox" checked={linkedNodeIds.includes(node.id)} onChange={(event) => setLinkedNodeIds((current) => event.target.checked ? [...current, node.id] : current.filter((id) => id !== node.id))}/><span>{node.title}</span><small>{kinds.find((item) => item.id === node.kind)?.label ?? node.kind}</small></label>)}</div></div>}
        {error && <p className="auth-error">{error}</p>}
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose}>إلغاء</button><button type="submit" className="btn btn-primary" disabled={busy || uploading || !title.trim() || (needsUrl && !url.trim())}>{busy || uploading ? 'جارٍ الحفظ...' : <><Check size={15}/> حفظ المحتوى</>}</button></div>
      </form>
    </section>
  </div>;
}
