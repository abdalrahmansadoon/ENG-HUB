import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDown, ArrowUpLeft, BookOpen, Check, ChevronLeft, ChevronRight, ClipboardList,
  Download, ExternalLink, File, FileText, Folder, FolderPlus, GraduationCap, Layers3,
  Link2, Lock, MoreHorizontal, Pencil, Play, Plus, Search, ShieldCheck, Sparkles, Trash2, Video, X,
} from 'lucide-react';
import type { Subject } from '../../types';
import { isAcademicContentContainer } from '../../types/academicContent';
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
  { id: 'custom', label: 'نوع مخصص جديد' },
];

interface Props {
  subject: Subject;
  nodes: AcademicContentNode[];
  category: AcademicContentCategory;
  activeNodeId: string;
  isAdmin: boolean;
  onNavigate: (category: AcademicContentCategory, nodeId?: string) => void;
  onBackToSubject: () => void;
  onCreate: (input: CreateAcademicContentInput) => Promise<void>;
  onDelete: (node: AcademicContentNode) => Promise<void>;
  onUpdate: (nodeId: string, patch: Partial<CreateAcademicContentInput>) => Promise<void>;
  onUpload: (file: File) => Promise<{ url: string; mimeType: string }>;
}

export function AcademicContentArea({
  subject, nodes, category, activeNodeId, isAdmin, onNavigate, onBackToSubject, onCreate, onDelete, onUpdate, onUpload,
}: Props) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AcademicContentNode | null>(null);
  const [busy, setBusy] = useState(false);
  const activeNode = nodes.find((node) => node.id === activeNodeId) ?? null;
  const ancestorTrail = useMemo(() => {
    const trail: AcademicContentNode[] = [];
    const visited = new Set<string>();
    let cursor = activeNode;
    while (cursor?.parentId && !visited.has(cursor.parentId)) {
      visited.add(cursor.parentId);
      const parentNode = nodes.find((node) => node.id === cursor!.parentId);
      if (!parentNode) break;
      trail.unshift(parentNode);
      cursor = parentNode;
    }
    return trail;
  }, [activeNode, nodes]);
  const children = useMemo(
    () => nodes.filter((node) => node.parentId === (activeNodeId || null) && (activeNodeId ? true : node.category === category))
      .filter((node) => (node.title + ' ' + node.description).toLowerCase().includes(search.trim().toLowerCase())),
    [nodes, activeNodeId, category, search],
  );
  const linked = activeNode ? [...new Set([
    ...activeNode.linkedNodeIds,
    ...nodes.filter((node) => node.linkedNodeIds.includes(activeNode.id)).map((node) => node.id),
  ])]
    .map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is AcademicContentNode => Boolean(node) && node.id !== activeNode.id) : [];
  const openAdd = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit = (node: AcademicContentNode) => { setEditTarget(node); setModalOpen(true); };

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
        <button type="button" className="eh-button eh-content-subject-back" onClick={onBackToSubject}><ArrowUpLeft size={15}/> أقسام المادة</button>
        <label className="eh-content-search"><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث داخل هذا القسم"/></label>
        {isAdmin && (!activeNode || isAcademicContentContainer(activeNode)) && <button type="button" className="eh-button primary" onClick={openAdd}><Plus size={16}/> إضافة محتوى</button>}
      </div>
    </div>

    <nav className="eh-content-breadcrumb" aria-label="مسار محتوى المادة">
      <button type="button" onClick={() => onNavigate(category)}><BookOpen size={15}/> {subject.name}</button>
      <ChevronLeft size={14}/>
      <button type="button" className={!activeNode ? 'active' : ''} onClick={() => onNavigate(category)}>{categories.find((item) => item.id === category)?.title ?? 'المحتوى'}</button>
      {ancestorTrail.map((ancestor) => <span className="eh-content-ancestor" key={ancestor.id}>
        <ChevronLeft size={14}/>
        <button type="button" onClick={() => onNavigate(category, ancestor.id)}>{ancestor.title}</button>
      </span>)}
      {activeNode && <>
        <ChevronLeft size={14}/>
        <span className="active">{activeNode.title}</span>
      </>}
      {activeNode && <button type="button" className="eh-content-back" onClick={() => onNavigate(category, activeNode.parentId || undefined)}><ArrowDown size={14}/> رجوع</button>}
    </nav>

    <section className="eh-content-items-section">
      <div className="eh-content-items-heading">
        <div><span className="eh-eyebrow">{category.toUpperCase()} · CONTENT</span><h3>{activeNode?.title ?? (categories.find((item) => item.id === category)?.title || 'المحتوى')}</h3></div>
        <span>{children.length} عنصر</span>
      </div>
      {children.length > 0 ? <div className="eh-content-item-grid">
        {children.map((node, index) => {
          const isFolder = isAcademicContentContainer(node);
          const Icon = node.kind === 'folder' || node.kind === 'custom' ? Folder : node.kind === 'lecturer' ? GraduationCap : node.kind === 'lecture' ? BookOpen : node.kind === 'video' ? Video : node.kind === 'exam' ? ClipboardList : node.kind === 'file' ? FileText : node.kind === 'link' ? ExternalLink : File;
          const isDraft = node.publicationStatus === 'draft';
          const kindLabel = node.kind === 'custom' ? (node.customTypeName || 'نوع مخصص') : (kinds.find((kind) => kind.id === node.kind)?.label ?? node.kind);
          return <article className="eh-content-item-card" key={node.id}>
            <button type="button" className="eh-content-item-open" onClick={() => isFolder ? onNavigate(category, node.id) : onNavigate(category, node.id)}>
              <span className={`eh-content-item-icon kind-${node.kind}`} style={node.kind === 'custom' && node.customTypeColor ? { color: node.customTypeColor, borderColor: node.customTypeColor } : undefined}>{node.kind === 'custom' && node.customTypeIcon ? <span className="eh-custom-kind-symbol">{node.customTypeIcon}</span> : <Icon size={22}/>}</span>
              <span className="eh-content-item-main"><b>{node.title}</b><small>{node.description || kindLabel}</small></span>
              <ChevronLeft size={16}/>
            </button>
            <div className="eh-content-item-meta">
              <span>{node.kind === 'custom' ? kindLabel : node.kind === 'folder' ? 'مجلد' : node.kind === 'lecturer' ? 'مدرس / معيد' : node.kind === 'lecture' ? 'محاضرة' : node.kind === 'video' ? 'فيديو' : node.kind === 'file' ? 'ملف' : node.kind === 'exam' ? 'اختبار' : node.kind === 'assignment' ? 'واجب' : node.kind === 'link' ? 'رابط' : 'محتوى'}</span>
              {node.duration && <span>{node.duration}</span>}
              {isDraft && <span className="eh-content-draft"><Lock size={11}/> مسودة</span>}
              {node.linkedNodeIds.length > 0 && <span><Link2 size={12}/> {node.linkedNodeIds.length} روابط مرتبطة</span>}
            </div>
            {isAdmin && node.createdBy !== 'legacy' && <div className="eh-content-item-admin">
              <button type="button" title="تعديل العنصر" aria-label={'تعديل ' + node.title} onClick={() => openEdit(node)}><Pencil size={14}/></button>
              <button type="button" title="حذف العنصر" aria-label={'حذف ' + node.title} onClick={() => void remove(node)}><Trash2 size={14}/></button>
            </div>}
          </article>;
        })}
      </div> : <div className="eh-content-empty">
        <span><Layers3 size={28}/></span>
        <b>{search ? 'لا توجد نتائج' : 'هذا القسم جاهز لإضافة محتواه'}</b>
        <p>{isAdmin ? 'أضف مجلداً أو محاضرة أو فيديو أو ملفاً أو اختباراً، ويمكنك ربط العناصر ببعضها.' : 'سيظهر المحتوى هنا عندما ينشره مدير المادة.'}</p>
        {isAdmin && (!activeNode || isAcademicContentContainer(activeNode)) && <button type="button" className="eh-button primary" onClick={openAdd}><Plus size={16}/> إنشاء أول عنصر</button>}
      </div>}
    </section>

    {activeNode && <section className="eh-content-detail">
      <header><span className="eh-content-detail-label">CONTENT DETAILS</span><h3>{activeNode.title}</h3>{activeNode.description && <p>{activeNode.description}</p>}</header>
      {(activeNode.kind === 'video' || activeNode.kind === 'lecture') && activeNode.url && <AcademicVideo url={activeNode.url} title={activeNode.title}/>} 
      {activeNode.kind === 'file' && activeNode.url && <a className="eh-related-content-link" href={activeNode.url} target="_blank" rel="noreferrer"><Download size={17}/><span><b>فتح أو تنزيل الملف</b><small>{activeNode.mimeType || 'مرفق المادة'}</small></span><ExternalLink size={15}/></a>}
      {(activeNode.kind === 'link' || activeNode.kind === 'exam' || activeNode.kind === 'assignment') && activeNode.url && <a className="eh-related-content-link" href={activeNode.url} target="_blank" rel="noreferrer"><ExternalLink size={17}/><span><b>{activeNode.kind === 'exam' ? 'فتح الاختبار' : activeNode.kind === 'assignment' ? 'فتح التكليف' : 'فتح الرابط'}</b><small>{activeNode.url}</small></span><ChevronLeft size={15}/></a>}
      {activeNode.kind === 'note' && <div className="eh-content-note">{activeNode.description || activeNode.title}</div>}
      {activeNode.kind === 'folder' && <p className="eh-content-note">افتح العناصر الموجودة داخل هذا المجلد من القائمة أعلاه.</p>}
      {activeNode.kind === 'custom' && <p className="eh-content-note">{activeNode.canContainChildren ? 'هذا نوع مجلد مخصص. يمكنك إضافة أي أنواع من المحتوى بداخله.' : (activeNode.description || 'هذا عنصر من نوع مخصص.')}</p>}
      {activeNode.kind === 'custom' && activeNode.url && <AcademicCustomAttachment url={activeNode.url} title={activeNode.title} mimeType={activeNode.mimeType}/>}
      {['exam','assignment'].includes(activeNode.kind) && !activeNode.url && <div className="eh-content-note">{activeNode.description || 'تفاصيل هذا العنصر متاحة في صفحة المحتوى المرتبط.'}</div>}
      {activeNode.kind === 'file' && !activeNode.url && <div className="eh-content-note">لم يعد رابط الملف متاحاً. تواصل مع مدير المادة لإعادة رفعه.</div>}
      {activeNode.kind === 'lecture' && <p className="eh-content-note">هذه مساحة للمحاضرة. أضف تحتها أي عدد من الفيديوهات والملفات والاختبارات أو المجلدات الفرعية.</p>}
      {activeNode.kind === 'lecturer' && <p className="eh-content-note">أضف محاضرات هذا المدرس داخل هذا القسم، أو أضف أي مجلدات ومصادر مرتبطة به.</p>}

      {linked.length > 0 && <div className="eh-related-content"><div className="eh-content-items-heading"><div><span className="eh-eyebrow">CONNECTED MATERIALS</span><h3>محتوى مرتبط بهذا العنصر</h3></div><span>{linked.length} مرتبط</span></div>
        <div className="eh-related-content-grid">{linked.map((node) => <button type="button" className="eh-related-content-link" key={node.id} onClick={() => onNavigate(node.category, node.id)}>
          <span className="eh-related-icon">{node.kind === 'video' ? <Video size={17}/> : node.kind === 'exam' ? <ClipboardList size={17}/> : node.kind === 'folder' ? <Folder size={17}/> : <FileText size={17}/>}</span>
          <span><b>{node.title}</b><small>{node.kind === 'custom' ? (node.customTypeName || 'نوع مخصص') : (kinds.find((item) => item.id === node.kind)?.label ?? node.kind)}</small></span><ChevronLeft size={15}/>
        </button>)}</div>
      </div>}
      {isAdmin && <div className="eh-content-detail-actions">
        {activeNode.createdBy !== 'legacy' && <button type="button" className="eh-button" onClick={() => openEdit(activeNode)}><Pencil size={15}/> تعديل العنصر</button>}
        {isAcademicContentContainer(activeNode) && <button type="button" className="eh-button primary" onClick={openAdd}><Plus size={16}/> إضافة عنصر داخل {activeNode.kind === 'folder' || activeNode.kind === 'custom' ? 'المجلد' : 'هذا القسم'}</button>}
      </div>}
    </section>}

    {modalOpen && <AcademicContentModal
      category={category}
      parent={activeNode}
      initialNode={editTarget}
      nodes={nodes}
      onClose={() => setModalOpen(false)}
      onUpload={onUpload}
      onSave={async (input) => { setBusy(true); try { await onCreate(input); setModalOpen(false); } finally { setBusy(false); } }}
      onUpdate={async (nodeId, patch) => { setBusy(true); try { await onUpdate(nodeId, patch); setModalOpen(false); } finally { setBusy(false); } }}
      busy={busy}
    />}
  </div>;
}

function AcademicCustomAttachment({ url, title, mimeType }: { url: string; title: string; mimeType?: string }) {
  const type = mimeType?.toLowerCase() ?? '';
  const isVideo = type.startsWith('video/') || /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(url)
    || /(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(url);
  if (isVideo) return <AcademicVideo url={url} title={title}/>;
  if (type.startsWith('audio/')) return <div className="eh-custom-audio"><audio src={url} controls preload="metadata">{'متصفحك لا يدعم تشغيل الصوت.'}</audio></div>;
  if (type.startsWith('image/')) return <a className="eh-custom-image-link" href={url} target="_blank" rel="noreferrer" aria-label={'فتح ' + title}><img src={url} alt={title} loading="lazy"/></a>;
  return <a className="eh-related-content-link" href={url} target="_blank" rel="noreferrer">
    <Download size={17}/>
    <span><b>{type.includes('pdf') || type.includes('document') || type.includes('spreadsheet') || type.includes('presentation') ? 'فتح أو تنزيل المرفق' : 'فتح المصدر المرتبط'}</b><small>{mimeType || url}</small></span>
    <ExternalLink size={15}/>
  </a>;
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

function AcademicContentModal({ category, parent, initialNode, nodes, onClose, onSave, onUpdate, onUpload, busy }: {
  category: AcademicContentCategory;
  parent: AcademicContentNode | null;
  initialNode: AcademicContentNode | null;
  nodes: AcademicContentNode[];
  onClose: () => void;
  onSave: (input: CreateAcademicContentInput) => Promise<void>;
  onUpdate: (nodeId: string, patch: Partial<CreateAcademicContentInput>) => Promise<void>;
  onUpload: (file: File) => Promise<{ url: string; mimeType: string }>;
  busy: boolean;
}) {
  const [kind, setKind] = useState<AcademicContentKind>(initialNode?.kind ?? 'folder');
  const [customTypeName, setCustomTypeName] = useState(initialNode?.customTypeName ?? '');
  const [customTypeIcon, setCustomTypeIcon] = useState(initialNode?.customTypeIcon ?? '✳');
  const [customTypeColor, setCustomTypeColor] = useState(initialNode?.customTypeColor ?? '#4169e1');
  const [canContainChildren, setCanContainChildren] = useState(initialNode?.canContainChildren ?? true);
  const [title, setTitle] = useState(initialNode?.title ?? '');
  const [description, setDescription] = useState(initialNode?.description ?? '');
  const [url, setUrl] = useState(initialNode?.url ?? '');
  const [duration, setDuration] = useState(initialNode?.duration ?? '');
  const [itemCategory, setItemCategory] = useState<AcademicContentCategory>(initialNode?.category ?? parent?.category ?? category);
  const [publicationStatus, setPublicationStatus] = useState<'published' | 'draft'>(initialNode?.publicationStatus ?? 'published');
  const [linkedNodeIds, setLinkedNodeIds] = useState<string[]>(initialNode?.linkedNodeIds ?? []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [mimeType, setMimeType] = useState(initialNode?.mimeType ?? '');
  const needsUrl = ['video','file','exam','assignment','link'].includes(kind);
  const availableLinks = nodes.filter((node) => node.id !== (initialNode?.id ?? parent?.id) && !isAcademicContentContainer(node) && node.publicationStatus === 'published');
  const customTypePresets = Array.from(nodes.reduce((presets, node) => {
    if (node.kind === 'custom' && node.customTypeName && !presets.has(node.customTypeName)) {
      presets.set(node.customTypeName, {
        name: node.customTypeName,
        icon: node.customTypeIcon || '✳',
        color: node.customTypeColor || '#4169e1',
        canContainChildren: node.canContainChildren === true,
      });
    }
    return presets;
  }, new Map<string, { name: string; icon: string; color: string; canContainChildren: boolean }>()).values());
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (title.trim().length < 2) { setError('اكتب عنواناً واضحاً.'); return; }
    if (needsUrl && !url.trim()) { setError('أضف رابطاً أو ارفع الملف.'); return; }
    if (kind === 'custom' && customTypeName.trim().length < 2) { setError('اكتب اسماً للنوع المخصص.'); return; }
    const payload: CreateAcademicContentInput = {
      parentId: initialNode?.parentId ?? parent?.id ?? null,
      kind, category: itemCategory, title: title.trim(), description: description.trim(),
      ...(url.trim() ? { url: url.trim() } : {}), ...(mimeType ? { mimeType } : {}),
      ...(kind === 'custom' ? {
        customTypeName: customTypeName.trim(), customTypeIcon: customTypeIcon.trim() || '✳',
        customTypeColor, canContainChildren,
      } : {}),
      duration: duration.trim(), linkedNodeIds, publicationStatus,
      sortOrder: initialNode?.sortOrder ?? Date.now(),
    };
    if (initialNode) await onUpdate(initialNode.id, payload);
    else await onSave(payload);
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
      <div className="modal-head"><div><span className="eh-eyebrow">CONTENT BUILDER</span><h2 id="eh-content-modal-title">{initialNode ? 'تعديل المحتوى' : 'إضافة محتوى للمادة'}</h2><p>{initialNode ? 'عدّل بيانات هذا العنصر وروابطه مع الاحتفاظ بمكانه.' : parent ? 'سيتم إنشاء العنصر داخل: ' + parent.title : 'أنشئ بنية المادة بالطريقة التي تناسبك.'}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={18}/></button></div>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <div className="eh-content-kind-grid">{kinds.map((item) => <button key={item.id} type="button" className={kind === item.id ? 'selected' : ''} onClick={() => setKind(item.id)}><span>{item.id === 'folder' ? <FolderPlus size={17}/> : item.id === 'video' ? <Video size={17}/> : item.id === 'file' ? <FileText size={17}/> : item.id === 'exam' ? <ClipboardList size={17}/> : item.id === 'lecture' ? <GraduationCap size={17}/> : item.id === 'custom' ? <Sparkles size={17}/> : <MoreHorizontal size={17}/>}</span>{item.label}</button>)}</div>
        <label>اسم العنصر<input required minLength={2} maxLength={140} autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === 'folder' ? 'مثال: المحاضرات الإضافية' : 'عنوان المحتوى'}/></label>
        {kind === 'custom' && <section className="eh-custom-kind-fields">
          <div className="eh-custom-kind-heading"><b>إعداد النوع المخصص</b><small>يمكنك إنشاء نوع مثل: سكشن، ورشة، بنك مسائل، مشروع، أو أي تصنيف يناسب المادة.</small></div>
          {customTypePresets.length > 0 && <div className="eh-custom-type-presets"><span>أنواع أنشأتها سابقاً</span><div>{customTypePresets.map((preset) => <button key={preset.name} type="button" onClick={() => { setCustomTypeName(preset.name); setCustomTypeIcon(preset.icon); setCustomTypeColor(preset.color); setCanContainChildren(preset.canContainChildren); }}>{preset.icon} {preset.name}</button>)}<button type="button" className="new-type" onClick={() => { setCustomTypeName(''); setCustomTypeIcon('✳'); setCustomTypeColor('#4169e1'); setCanContainChildren(true); }}>+ نوع جديد</button></div></div>}
          <label>اسم النوع<input required minLength={2} maxLength={50} value={customTypeName} onChange={(event) => setCustomTypeName(event.target.value)} placeholder="مثال: سكشن / بنك مسائل / مشروع"/></label>
          <div className="form-row">
            <label>الرمز أو الإيموجي<input maxLength={5} value={customTypeIcon} onChange={(event) => setCustomTypeIcon(event.target.value)} placeholder="✳"/></label>
            <label>لون النوع<input type="color" value={customTypeColor} onChange={(event) => setCustomTypeColor(event.target.value)} /></label>
          </div>
          <label className="eh-custom-container-toggle"><input type="checkbox" checked={canContainChildren} onChange={(event) => setCanContainChildren(event.target.checked)}/><span><b>اجعل هذا النوع مجلداً قابلاً للتداخل</b><small>عند التفعيل يمكنك إضافة مجلدات ومحاضرات وملفات وفيديوهات واختبارات داخله، وعند الإلغاء يصبح عنصراً مستقلاً.</small></span></label>
        </section>}
        <div className="form-row">
          <label>القسم<select value={itemCategory} onChange={(event) => setItemCategory(event.target.value as AcademicContentCategory)}>{categories.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
          <label>حالة النشر<select value={publicationStatus} onChange={(event) => setPublicationStatus(event.target.value as 'published'|'draft')}><option value="published">منشور للطلاب</option><option value="draft">مسودة للمدير</option></select></label>
        </div>
        {(needsUrl || kind === 'custom') && <label>{kind === 'custom' ? 'رابط أو مصدر خارجي (اختياري)' : 'الرابط'}<input type="url" dir="ltr" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..."/></label>}
        {['file','video','custom'].includes(kind) && <label className="eh-content-upload"><input type="file" accept={kind === 'video' ? 'video/*' : kind === 'custom' ? 'image/*,video/*,audio/*,.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip,.txt' : '.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip,.txt,image/*'} onChange={(event) => void upload(event.target.files?.[0])}/><span>{kind === 'video' ? <Video size={18}/> : <File size={18}/>}{uploading ? 'جارٍ رفع الملف...' : url ? 'تم إرفاق المصدر — يمكنك استبداله' : kind === 'video' ? 'رفع فيديو مباشرة إلى مكتبة المادة' : kind === 'custom' ? 'إرفاق ملف أو وسائط لهذا النوع (اختياري)' : 'رفع ملف إلى مكتبة المادة'}</span></label>}
        {['video','lecture'].includes(kind) && <label>المدة (اختياري)<input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="مثال: 35 دقيقة"/></label>}
        <label>وصف أو ملاحظات<textarea rows={3} maxLength={1400} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="تفاصيل المحتوى أو تعليمات الطالب..."/></label>
        {availableLinks.length > 0 && <div className="eh-content-link-picker"><b>ربط هذا العنصر بملفات أو فيديوهات أو اختبارات أخرى</b><small>يمكن اختيار أكثر من عنصر، وتظهر الروابط في صفحة المحتوى بعد النشر.</small><div>{availableLinks.map((node) => <label key={node.id}><input type="checkbox" checked={linkedNodeIds.includes(node.id)} onChange={(event) => setLinkedNodeIds((current) => event.target.checked ? [...current, node.id] : current.filter((id) => id !== node.id))}/><span>{node.title}</span><small>{node.kind === 'custom' ? (node.customTypeName || 'نوع مخصص') : (kinds.find((item) => item.id === node.kind)?.label ?? node.kind)}</small></label>)}</div></div>}
        {error && <p className="auth-error">{error}</p>}
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose}>إلغاء</button><button type="submit" className="btn btn-primary" disabled={busy || uploading || !title.trim() || (needsUrl && !url.trim()) || (kind === 'custom' && customTypeName.trim().length < 2)}>{busy || uploading ? 'جارٍ الحفظ...' : <><Check size={15}/> {initialNode ? 'حفظ التعديلات' : 'حفظ المحتوى'}</>}</button></div>
      </form>
    </section>
  </div>;
}
