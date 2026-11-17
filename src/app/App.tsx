import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, AlarmClock, AlertCircle, ArrowDownLeft, ArrowLeft, ArrowUpLeft, Bell, BookOpen,
  BookOpenCheck, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Clock3, CloudUpload, Code2, Command, Download, File, FileImage, FileText,
  Filter, FolderOpen, GraduationCap, Grid2X2, Headphones, Home, Layers3, LogOut, Menu,
  MessageCircle, MoreHorizontal, Paperclip, Play, Plus, Search, Send, Settings, ShieldCheck,
  SlidersHorizontal, Sparkles, Sun, Moon, Target, Timer, TrendingUp, Upload, Users,
  Video, X, Zap, ClipboardList, CalendarClock, BookMarked, ListChecks, ChartNoAxesCombined,
} from 'lucide-react';
import { useAuth, registerAccount } from './AuthContext';
import { demoExams, demoFiles, demoLectures, demoNotifications, demoSubjects, demoTasks } from '../data/demo';
import { defaultCloudinarySettings, isCloudinaryConfigured, saveCloudinarySettings, subscribeCloudinarySettings, type CloudinarySettings } from '../lib/cloudinary';
import { uploadFile } from '../lib/uploads';
import { enablePushNotifications, listenForForegroundMessages } from '../lib/messaging';
import { isFirebaseConfigured } from '../lib/firebase';
import { readLocal, writeLocal } from '../lib/storage';
import { createSubjectCloud, createTaskCloud, saveFileMetadataCloud, subscribeExams, subscribeFiles, subscribeLectures, subscribeSubjects, subscribeTasks, updateTaskStatusCloud } from '../lib/cloudData';
import type { AppNotification, AppUser, Exam, Lecture, LibraryFile, Priority, StudyTask, Subject, TaskStatus } from '../types';

const navGroups = [
  { title: 'مساحة الدراسة', items: [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'tasks', label: 'المهام', icon: ListChecks, count: '3' },
    { id: 'courses', label: 'المواد الدراسية', icon: BookOpen },
    { id: 'lectures', label: 'المحاضرات', icon: Video },
    { id: 'exams', label: 'الاختبارات', icon: ClipboardList },
    { id: 'files', label: 'مكتبة الملفات', icon: FolderOpen },
  ] },
  { title: 'التواصل والتنظيم', items: [
    { id: 'chat', label: 'المحادثات', icon: MessageCircle, count: '2' },
    { id: 'planner', label: 'مخطط المذاكرة', icon: CalendarDays },
    { id: 'analytics', label: 'إحصائياتي', icon: ChartNoAxesCombined },
  ] },
];

const priorityText: Record<Priority, string> = { low: 'منخفضة', normal: 'عادية', high: 'عالية', urgent: 'عاجلة' };
const statusText: Record<TaskStatus, string> = {
  'not-started': 'لم تبدأ', 'in-progress': 'قيد التنفيذ', submitted: 'تم التسليم', 'under-review': 'قيد المراجعة',
  completed: 'مكتملة', rejected: 'مرفوضة', overdue: 'متأخرة',
};
const iconForKind = { task: ClipboardList, lecture: Video, exam: BookOpenCheck, system: Bell };

function App() {
  const { user, isDemo, loading, logout, toggleDemoRole, login, loginWithGoogle } = useAuth();
  const activeUser = user ?? { uid: '', displayName: 'طالب هندسة', email: '', photoURL: null, role: 'student' as const, academicYear: 'السنة الإعدادية', term: 'الترم الأول' };
  const [page, setPage] = useState('home');
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState('');
  const [dark, setDark] = useState(() => readLocal('theme', true));
  const [tasks, setTasks] = useState<StudyTask[]>(() => readLocal('tasks', demoTasks));
  const [subjects, setSubjects] = useState<Subject[]>(() => readLocal('subjects', demoSubjects));
  const [lectures, setCloudLectures] = useState<Lecture[]>(() => readLocal('lectures', demoLectures));
  const [exams, setExams] = useState<Exam[]>(() => readLocal('exams', demoExams));
  const [files, setFiles] = useState<LibraryFile[]>(() => readLocal('files', demoFiles));
  const [cloudinarySettings, setCloudinarySettings] = useState<CloudinarySettings>(defaultCloudinarySettings);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => readLocal('notifications', demoNotifications));
  const [taskModal, setTaskModal] = useState(false);
  const [subjectModal, setSubjectModal] = useState(false);
  const [toast, setToast] = useState('');
  const [chatMessages, setChatMessages] = useState(() => readLocal('chatMessages', [
    { id: 'm1', name: 'كريم خالد', text: 'يا شباب، حد رفع حل Sheet 2؟', time: '10:42 ص', mine: false },
    { id: 'm2', name: 'أنت', text: 'لسه براجع آخر مسألتين وهرفعه.', time: '10:45 ص', mine: true },
    { id: 'm3', name: 'سارة علي', text: 'رفعت ملف المراجعة في مكتبة الملفات 🙌', time: '11:02 ص', mine: false },
  ]));

  useEffect(() => writeLocal('tasks', tasks), [tasks]);
  useEffect(() => writeLocal('subjects', subjects), [subjects]);
  useEffect(() => writeLocal('exams', exams), [exams]);
  useEffect(() => writeLocal('files', files), [files]);
  useEffect(() => {
    if (!user || isDemo) { setCloudinarySettings(defaultCloudinarySettings); return; }
    return subscribeCloudinarySettings(setCloudinarySettings, (error) => setToast(`تعذر قراءة إعدادات Cloudinary: ${error.message}`));
  }, [user?.uid, isDemo]);
  useEffect(() => writeLocal('notifications', notifications), [notifications]);
  useEffect(() => writeLocal('chatMessages', chatMessages), [chatMessages]);
  useEffect(() => writeLocal('theme', dark), [dark]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const pendingCount = tasks.filter((task) => task.status !== 'completed').length;
  const unreadCount = notifications.filter((item) => !item.read).length;
  const isAdmin = activeUser.role === 'admin' || activeUser.role === 'super-admin';
  const quickResults = search.trim() ? [
    ...tasks.filter((item) => `${item.title} ${item.subjectName}`.toLowerCase().includes(search.toLowerCase())).slice(0, 3).map((item) => ({ id: item.id, title: item.title, sub: item.subjectName, page: 'tasks' })),
    ...subjects.filter((item) => `${item.name} ${item.code}`.toLowerCase().includes(search.toLowerCase())).slice(0, 2).map((item) => ({ id: item.id, title: item.name, sub: 'مادة دراسية', page: 'courses' })),
    ...lectures.filter((item) => `${item.title} ${item.subjectName}`.toLowerCase().includes(search.toLowerCase())).slice(0, 2).map((item) => ({ id: item.id, title: item.title, sub: item.subjectName, page: 'lectures' })),
  ].slice(0, 6) : [];

  useEffect(() => {
    if (!user || isDemo) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    void listenForForegroundMessages((payload) => {
      const title = payload.notification?.title || payload.data?.title || 'ENG HUB';
      const body = payload.notification?.body || payload.data?.body || 'لديك إشعار جديد.';
      setNotifications((items) => [{
        id: crypto.randomUUID(), title, body, time: 'الآن', read: false, kind: 'system',
      }, ...items]);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body, icon: `${import.meta.env.BASE_URL}icons/icon.svg` });
      }
    }).then((unsubscribe) => {
      if (cancelled) unsubscribe();
      else stop = unsubscribe;
    }).catch((error: unknown) => {
      console.warn('ENG HUB foreground messaging could not start.', error);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [user?.uid, isDemo]);

  useEffect(() => {
    if (!user || isDemo || !isFirebaseConfigured) return;
    const onError = (error: Error) => setToast(`مشكلة في المزامنة: ${error.message}`);
    const stops = [
      subscribeTasks(activeUser.uid, isAdmin, setTasks, onError),
      subscribeSubjects(isAdmin, setSubjects, onError),
      subscribeLectures(setCloudLectures, onError),
      subscribeExams(setExams, onError),
      subscribeFiles(activeUser.uid, setFiles, onError),
    ].filter(Boolean) as Array<() => void>;
    return () => stops.forEach((stop) => stop());
  }, [user?.uid, isDemo, activeUser.uid, isAdmin]);

  const addTask = (data: Omit<StudyTask, 'id' | 'createdAt' | 'createdBy'>) => {
    const next: StudyTask = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), createdBy: activeUser.displayName };
    setTasks((items) => [next, ...items]);
    setNotifications((items) => [{ id: crypto.randomUUID(), title: 'تم إنشاء مهمة جديدة', body: next.title, time: 'الآن', read: false, kind: 'task' }, ...items]);
    setTaskModal(false);
    if (!isDemo) void createTaskCloud(data, activeUser.uid, activeUser.displayName, isAdmin).then(() => setToast('تم حفظ المهمة في Firebase')).catch((error: unknown) => setToast(error instanceof Error ? error.message : 'تعذر حفظ المهمة سحابياً'));
    else setToast('تم إنشاء المهمة بنجاح');
  };

  const changeTaskStatus = (taskId: string, status: TaskStatus) => {
    setTasks((items) => items.map((task) => task.id === taskId ? { ...task, status } : task));
    if (!isDemo) void updateTaskStatusCloud(taskId, activeUser.uid, status).then(() => setToast('تمت مزامنة الحالة')).catch((error: unknown) => setToast(error instanceof Error ? error.message : 'تعذرت مزامنة الحالة'));
    else setToast('تم تحديث حالة المهمة');
  };

  const addSubject = (data: Omit<Subject, 'id' | 'lectures' | 'progress'>) => {
    setSubjects((items) => [...items, { ...data, id: crypto.randomUUID(), lectures: 0, progress: 0 }]);
    setSubjectModal(false);
    if (!isDemo) void createSubjectCloud(data).then(() => setToast('تم حفظ المادة في Firebase')).catch((error: unknown) => setToast(error instanceof Error ? error.message : 'تعذرت إضافة المادة سحابياً'));
    else setToast('تمت إضافة المادة');
  };

  const addFile = async (file: File) => {
    let remoteUrl: string | undefined;
    if (!isDemo) {
      if (!isCloudinaryConfigured(cloudinarySettings)) {
        setToast('لم يتم إعداد Cloudinary بعد. افتح لوحة الإدارة ثم إعدادات Cloudinary.');
        return;
      }
      try {
        remoteUrl = await uploadFile(file, cloudinarySettings);
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'تعذر رفع الملف');
        return;
      }
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const type: LibraryFile['type'] = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? 'IMAGE' : ['mp4', 'mov', 'webm'].includes(ext) ? 'VIDEO' : ['ppt', 'pptx'].includes(ext) ? 'PPT' : ['doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'zip'].includes(ext) ? 'DOC' : 'PDF';
    const next: LibraryFile = { id: crypto.randomUUID(), name: file.name, type, subjectName: 'ملفات شخصية', size: `${(file.size / 1024 / 1024).toFixed(1)} MB`, updatedAt: 'الآن', url: remoteUrl };
    setFiles((items) => [next, ...items]);
    if (!isDemo && remoteUrl) void saveFileMetadataCloud(next, activeUser.uid).then(() => setToast('تم رفع الملف وحفظ بياناته')).catch((error: unknown) => setToast(error instanceof Error ? error.message : 'تم رفع الملف لكن تعذر حفظ بياناته'));
    else setToast(remoteUrl ? 'تم رفع الملف إلى Cloudinary' : 'أضيف الملف للقائمة التجريبية محلياً فقط');
  };

  if (loading) return <div className="boot-screen"><div className="brand-mark">EH</div><span>جاري تجهيز ENG HUB...</span></div>;
  if (!user) return <AuthScreen onLogin={login} onGoogle={loginWithGoogle} />;

  return (
    <div className={dark ? 'app-shell theme-dark' : 'app-shell theme-light'} dir="rtl">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark">EH</div>
          <div className="brand-copy"><strong>ENG HUB</strong><span>CAIRO UNIVERSITY</span></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileNav(false)} aria-label="إغلاق القائمة"><X size={18}/></button>
        </div>
        <div className="semester-chip"><span className="live-dot"/> <span>السنة الإعدادية</span><ChevronDown size={14}/></div>
        <nav className="side-nav">
          {navGroups.map((group) => <div className="nav-group" key={group.title}>
            <div className="nav-caption">{group.title}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              return <button key={item.id} onClick={() => { setPage(item.id); setMobileNav(false); }} className={`nav-item ${page === item.id ? 'active' : ''}`}>
                <Icon size={18}/><span>{item.label}</span>{'count' in item && <small>{item.count}</small>}
              </button>;
            })}
          </div>)}
          {isAdmin && <div className="nav-group"><div className="nav-caption">إدارة المنصة</div><button onClick={() => { setPage('admin'); setMobileNav(false); }} className={`nav-item ${page === 'admin' ? 'active' : ''}`}><ShieldCheck size={18}/><span>لوحة الإدارة</span><span className="admin-dot"/></button></div>}
        </nav>
        <div className="sidebar-spacer"/>
        <div className="sidebar-help"><div className="help-icon"><CircleHelp size={18}/></div><div><b>تحتاج إلى مساعدة؟</b><span>مركز المساعدة والدعم</span></div><ChevronLeft size={15}/></div>
        <div className="sidebar-profile">
          <div className="avatar avatar-purple">{activeUser.displayName.slice(0, 1)}</div>
          <div className="profile-copy"><b>{activeUser.displayName}</b><span>{isAdmin ? 'مدير المنصة' : 'طالب هندسة'}</span></div>
          <button className="icon-button" onClick={() => setPage('profile')} aria-label="إعدادات الملف الشخصي"><MoreHorizontal size={19}/></button>
        </div>
      </aside>
      {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="إغلاق القائمة"/>}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-start">
            <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="فتح القائمة"><Menu size={20}/></button>
            <div className="breadcrumb"><span>ENG HUB</span><ChevronLeft size={13}/><b>{pageTitle(page)}</b></div>
          </div>
          <div className="topbar-actions">
            <div className="global-search-wrap"><div className="global-search"><Search size={17}/><input placeholder="ابحث عن مادة، محاضرة، مهمة..." value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></div>{search.trim() && <div className="global-search-results">{quickResults.length ? quickResults.map((result) => <button key={`${result.page}-${result.id}`} onClick={() => { setPage(result.page); setSearch(''); }}><Search size={13}/><span><b>{result.title}</b><small>{result.sub}</small></span><ArrowLeft size={13}/></button>) : <div className="search-empty">لا توجد نتائج مطابقة</div>}</div>}</div>
            <button className="icon-button theme-toggle" onClick={() => setDark(!dark)} aria-label="تغيير المظهر">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
            <button className="icon-button notification-button" onClick={() => setPage('notifications')} aria-label="الإشعارات"><Bell size={18}/>{unreadCount > 0 && <i/>}</button>
            <button className="top-avatar" onClick={() => setPage('profile')}>{activeUser.displayName.slice(0, 1)}</button>
          </div>
        </header>

        <div className="page-wrap">
          {page === 'home' && <Dashboard userName={activeUser.displayName} tasks={tasks} subjects={subjects} exams={exams} lectures={lectures} onGo={setPage} onNewTask={() => setTaskModal(true)} onStatus={changeTaskStatus}/>}
          {page === 'tasks' && <TasksPage tasks={tasks} onNew={() => setTaskModal(true)} onStatus={changeTaskStatus} />}
          {page === 'courses' && <CoursesPage subjects={subjects} onAdd={() => setSubjectModal(true)} canEdit={isAdmin} onOpen={() => setPage('lectures')} />}
          {page === 'lectures' && <LecturesPage lectures={lectures} subjects={subjects} />}
          {page === 'exams' && <ExamsPage exams={exams} setExams={setExams} />}
          {page === 'files' && <FilesPage files={files} onUpload={addFile} cloudinaryReady={isCloudinaryConfigured(cloudinarySettings)} isDemo={isDemo} />}
          {page === 'chat' && <ChatPage messages={chatMessages} setMessages={setChatMessages} />}
          {page === 'planner' && <PlannerPage tasks={tasks} />}
          {page === 'analytics' && <AnalyticsPage tasks={tasks} subjects={subjects} lectures={lectures} />}
          {page === 'notifications' && <NotificationsPage items={notifications} setItems={setNotifications} />}
          {page === 'admin' && <AdminPage tasks={tasks} subjects={subjects} files={files} currentUser={activeUser} cloudinarySettings={cloudinarySettings} onNewTask={() => setTaskModal(true)} onAddSubject={() => setSubjectModal(true)} onSaved={() => setToast('تم حفظ إعدادات Cloudinary في Firestore')} onError={(message) => setToast(message)} />}
          {page === 'profile' && <ProfilePage user={activeUser} isDemo={isDemo} onToggleRole={toggleDemoRole} onLogout={logout} onToggleTheme={() => setDark(!dark)} dark={dark} />}
        </div>
      </main>

      {taskModal && <TaskModal subjects={subjects} userId={activeUser.uid} onClose={() => setTaskModal(false)} onSave={addTask}/>}
      {subjectModal && <SubjectModal onClose={() => setSubjectModal(false)} onSave={addSubject}/>}
      {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
    </div>
  );
}

function AuthScreen({ onLogin, onGoogle }: { onLogin: (email: string, password: string, name?: string) => Promise<void>; onGoogle: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (mode === 'register') await registerAccount(email, password, name);
      else await onLogin(email, password);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.'); }
    finally { setBusy(false); }
  };
  return <div className="auth-screen" dir="rtl"><div className="auth-visual"><div className="auth-brand"><div className="brand-mark">EH</div><div><b>ENG HUB</b><span>CAIRO UNIVERSITY · FACULTY OF ENGINEERING</span></div></div><div className="auth-visual-copy"><div className="eyebrow">YOUR ENGINEERING JOURNEY</div><h1>كل أدوات دراستك،<br/><span>في مساحة واحدة.</span></h1><p>نظّم محاضراتك، تابع مهامك، وذاكر بتركيز أكبر مع مجتمع هندسة القاهرة.</p><div className="auth-feature-list"><span><CheckCircle2 size={15}/> تنظيم المواد والمحاضرات</span><span><CheckCircle2 size={15}/> متابعة المهام والتسليمات</span><span><CheckCircle2 size={15}/> تعاون ومشاركة مع زملائك</span></div></div><div className="auth-orbit"/><div className="auth-foot">ENG HUB · STUDY SMARTER, BUILD BETTER</div></div><div className="auth-form-side"><form className="auth-form" onSubmit={submit}><div className="auth-mobile-brand"><div className="brand-mark">EH</div><b>ENG HUB</b></div><div className="eyebrow">WELCOME TO ENG HUB</div><h2>{mode === 'login' ? 'مرحباً بعودتك' : 'أنشئ حسابك'}</h2><p>{mode === 'login' ? 'سجل دخولك للوصول إلى مساحة دراستك.' : 'انضم إلى مساحة طلاب هندسة القاهرة.'}</p>{mode === 'register' && <label>الاسم بالكامل<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك كما تحب أن يظهر"/></label>}<label>البريد الإلكتروني<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com"/></label><label>كلمة المرور<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 أحرف على الأقل"/></label>{error && <div className="auth-error"><AlertCircle size={15}/>{error}</div>}<button type="submit" className="btn btn-primary auth-submit" disabled={busy}>{busy ? <span className="spinner"/> : null}{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'} <ArrowLeft size={16}/></button><div className="auth-divider"><span>أو</span></div><button type="button" className="btn btn-outline google-btn" onClick={() => void onGoogle()}><span className="google-g">G</span> المتابعة باستخدام Google</button><div className="auth-switch">{mode === 'login' ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'إنشاء حساب' : 'تسجيل الدخول'}</button></div><div className="auth-foot-mobile">بالاستمرار، أنت توافق على شروط الاستخدام وسياسة الخصوصية.</div></form></div></div>;
}

function pageTitle(page: string) {
  const titles: Record<string, string> = { home: 'الرئيسية', tasks: 'المهام', courses: 'المواد الدراسية', lectures: 'المحاضرات', exams: 'الاختبارات', files: 'مكتبة الملفات', chat: 'المحادثات', planner: 'مخطط المذاكرة', analytics: 'إحصائياتي', notifications: 'الإشعارات', admin: 'لوحة الإدارة', profile: 'الملف الشخصي' };
  return titles[page] ?? page;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

function Dashboard({ userName, tasks, subjects, exams, lectures, onGo, onNewTask, onStatus }: {
  userName: string; tasks: StudyTask[]; subjects: Subject[]; exams: Exam[]; lectures: Lecture[];
  onGo: (page: string) => void; onNewTask: () => void; onStatus: (id: string, status: TaskStatus) => void;
}) {
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const todo = tasks.filter((task) => task.status !== 'completed' && task.status !== 'under-review').length;
  const currentExams = exams.filter((exam) => exam.status !== 'completed').length;
  const upcoming = tasks.filter((task) => task.status !== 'completed').slice(0, 4);
  return <>
    <section className="welcome-banner">
      <div className="welcome-content"><div className="welcome-kicker"><Sparkles size={14}/> مساحة دراستك في مكان واحد</div><h1>أهلاً بعودتك، {userName} <span>👋</span></h1><p>خطوة صغيرة كل يوم تصنع فرقاً كبيراً. استعد لإنجاز مهامك اليوم.</p><div className="welcome-actions"><button className="btn btn-primary" onClick={onNewTask}><Plus size={16}/> أضف مهمة جديدة</button><button className="btn btn-glass" onClick={() => onGo('planner')}><CalendarDays size={16}/> خطط ليومك</button></div></div>
      <div className="welcome-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-core"><GraduationCap size={43}/></div><div className="float-card float-card-top"><Zap size={14}/><span>Keep going!</span></div><div className="float-card float-card-bottom"><Target size={15}/><b>72%</b><span>هذا الأسبوع</span></div></div>
      <div className="banner-noise"/>
    </section>

    <div className="section-title-row"><div><div className="eyebrow">نظرة سريعة</div><h2>ملخص تقدمك</h2></div><span className="muted-label">الترم الأول · 2026 / 2027</span></div>
    <div className="stats-grid">
      <StatCard label="المهام المتبقية" value={todo.toString().padStart(2, '0')} meta="تحتاج إلى إنجاز" icon={<ListChecks size={19}/>} tone="violet" trend="3 هذا الأسبوع" />
      <StatCard label="المهام المكتملة" value={completed.toString().padStart(2, '0')} meta="إنجاز رائع، استمر" icon={<CheckCircle2 size={19}/>} tone="green" trend="+2 عن الأسبوع الماضي" />
      <StatCard label="المحاضرات" value={`${lectures.filter((item) => item.progress === 100).length}/${lectures.length}`} meta="محاضرات تمت مشاهدتها" icon={<Video size={19}/>} tone="blue" trend="4 محاضرات جديدة" />
      <StatCard label="الاختبارات القادمة" value={currentExams.toString().padStart(2, '0')} meta="اختبارات لم تنتهِ بعد" icon={<AlarmClock size={19}/>} tone="amber" trend="أقربها خلال 3 أيام" />
    </div>

    <div className="dashboard-grid">
      <section className="panel tasks-panel"><div className="panel-head"><div><h3>مهام تحتاج انتباهك</h3><span>تابع أولوياتك ومواعيد التسليم</span></div><button className="text-link" onClick={() => onGo('tasks')}>كل المهام <ArrowLeft size={15}/></button></div>
        <div className="task-list">{upcoming.map((task) => <TaskRow key={task.id} task={task} onStatus={onStatus}/>)}</div>
        {upcoming.length === 0 && <EmptyState title="لا توجد مهام معلقة" body="أحسنت! أنجزت كل ما عليك."/>}
      </section>
      <section className="panel progress-panel"><div className="panel-head"><div><h3>تقدم المواد</h3><span>نسبة إنجاز المحاضرات والموضوعات</span></div><button className="icon-button" onClick={() => onGo('courses')}><MoreHorizontal size={19}/></button></div>
        <div className="subject-progress-list">{subjects.slice(0, 5).map((subject) => <div className="subject-progress" key={subject.id}><div className="subject-mini-icon" style={{ background: `${subject.color}18`, color: subject.color }}>{subject.icon}</div><div className="subject-progress-main"><div><b>{subject.name}</b><span>{subject.progress}%</span></div><div className="progress-track"><div style={{ width: `${subject.progress}%`, background: subject.color }}/></div></div></div>)}</div>
        <button className="panel-footer-link" onClick={() => onGo('courses')}>عرض كل المواد <ArrowLeft size={14}/></button>
      </section>
    </div>

    <div className="lower-grid">
      <section className="panel schedule-panel"><div className="panel-head"><div><h3>نظرة على الأسبوع</h3><span>نشاطك الدراسي خلال الأيام الماضية</span></div><span className="select-chip">هذا الأسبوع <ChevronDown size={13}/></span></div><WeeklyChart/></section>
      <section className="panel deadline-panel"><div className="panel-head"><div><h3>المواعيد القادمة</h3><span>لا تدع موعداً يفوتك</span></div><button className="icon-button" onClick={() => onGo('planner')}><CalendarDays size={17}/></button></div>
        <div className="deadline-item"><div className="date-tile"><b>19</b><span>نوفمبر</span></div><div className="deadline-copy"><b>Calculus — Sheet 03</b><span>11:59 مساءً · تسليم واجب</span></div><span className="deadline-pill urgent-pill">غداً</span></div>
        <div className="deadline-item"><div className="date-tile"><b>20</b><span>نوفمبر</span></div><div className="deadline-copy"><b>Quiz 02 — Derivatives</b><span>10:00 صباحاً · اختبار</span></div><span className="deadline-pill">بعد 3 أيام</span></div>
        <div className="deadline-item"><div className="date-tile"><b>21</b><span>نوفمبر</span></div><div className="deadline-copy"><b>Physics Lab Report</b><span>08:00 مساءً · تقرير</span></div><span className="deadline-pill">بعد 4 أيام</span></div>
      </section>
    </div>
    <div className="bottom-note"><Sparkles size={15}/><span>أنت تتقدم بشكل جيد. حافظ على تركيزك وخذ استراحة قصيرة كل فترة.</span><span className="note-decoration">ENG HUB · STUDY SMARTER</span></div>
  </>;
}

function StatCard({ label, value, meta, icon, tone, trend }: { label: string; value: string; meta: string; icon: ReactNode; tone: string; trend: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className={`stat-icon ${tone}`}>{icon}</div></div><div className="stat-value">{value}</div><div className="stat-meta">{meta}</div><div className="stat-trend">{trend}</div></div>;
}

function WeeklyChart() {
  const values = [36, 64, 48, 82, 56, 92, 44];
  const days = ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'];
  return <div className="weekly-chart"><div className="chart-y-labels"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div className="chart-bars">{values.map((value, i) => <div className="chart-column" key={days[i]}><div className="chart-bar-track"><div className={`chart-bar ${i === 5 ? 'highlight' : ''}`} style={{ height: `${value}%` }}/></div><span>{days[i]}</span></div>)}</div></div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="empty-state"><div className="empty-icon"><Layers3 size={22}/></div><b>{title}</b><span>{body}</span></div>;
}

function TaskRow({ task, onStatus }: { task: StudyTask; onStatus: (id: string, status: TaskStatus) => void }) {
  const [open, setOpen] = useState(false);
  const due = new Date(task.dueAt);
  return <div className="task-row"><div className={`task-subject-dot dot-${task.subjectId}`}/><div className="task-row-copy"><b>{task.title}</b><span>{task.subjectName} <i>•</i> {due.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</span></div><span className={`priority-badge priority-${task.priority}`}>{priorityText[task.priority]}</span><div className="task-status-control"><button className={`status-chip status-${task.status}`} onClick={() => setOpen(!open)}>{statusText[task.status]} <ChevronDown size={12}/></button>{open && <div className="status-menu">{(['not-started', 'in-progress', 'submitted', 'completed'] as TaskStatus[]).map((status) => <button key={status} onClick={() => { onStatus(task.id, status); setOpen(false); }}>{statusText[status]}</button>)}</div>}</div></div>;
}

function TasksPage({ tasks, onNew, onStatus }: { tasks: StudyTask[]; onNew: () => void; onStatus: (id: string, status: TaskStatus) => void }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const filtered = tasks.filter((task) => (filter === 'all' || (filter === 'pending' ? task.status !== 'completed' : task.status === filter)) && `${task.title} ${task.subjectName}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHeader eyebrow="TASK MANAGEMENT" title="إدارة المهام" description="كل واجباتك وتسليماتك في مساحة واحدة. رتب أولوياتك وتابع إنجازك." action={<button className="btn btn-primary" onClick={onNew}><Plus size={16}/> إنشاء مهمة</button>}/>
    <div className="task-overview-strip"><div><b>{tasks.length}</b><span>إجمالي المهام</span></div><div><b>{tasks.filter((t) => t.status === 'completed').length}</b><span>مكتملة</span></div><div><b>{tasks.filter((t) => t.status === 'in-progress').length}</b><span>قيد التنفيذ</span></div><div><b>{tasks.filter((t) => t.status === 'under-review').length}</b><span>قيد المراجعة</span></div><div><b>{tasks.filter((t) => new Date(t.dueAt) < new Date() && t.status !== 'completed').length}</b><span>متأخرة</span></div></div>
    <div className="panel table-panel"><div className="table-toolbar"><div className="filter-tabs">{[{ id: 'all', label: 'الكل' }, { id: 'pending', label: 'غير مكتملة' }, { id: 'completed', label: 'مكتملة' }, { id: 'under-review', label: 'قيد المراجعة' }].map((tab) => <button key={tab.id} className={filter === tab.id ? 'filter-tab active' : 'filter-tab'} onClick={() => setFilter(tab.id)}>{tab.label}</button>)}</div><div className="table-tools"><div className="inline-search"><Search size={15}/><input placeholder="ابحث في المهام" value={query} onChange={(e) => setQuery(e.target.value)}/></div><button className="filter-button"><SlidersHorizontal size={15}/> تصفية</button></div></div>
      <div className="tasks-table"><div className="table-head"><span>المهمة</span><span>المادة</span><span>الأولوية</span><span>موعد التسليم</span><span>الحالة</span><span/></div>{filtered.map((task) => <div className="table-row" key={task.id}><div className="table-task"><div className="task-check" onClick={() => onStatus(task.id, task.status === 'completed' ? 'in-progress' : 'completed')}><Check size={13}/></div><div><b>{task.title}</b><span>أُضيفت {new Date(task.createdAt).toLocaleDateString('ar-EG')}</span></div></div><span className="table-secondary">{task.subjectName}</span><span><i className={`priority-dot priority-dot-${task.priority}`}/>{priorityText[task.priority]}</span><span className="table-secondary">{new Date(task.dueAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</span><span><span className={`status-chip status-${task.status}`}>{statusText[task.status]}</span></span><button className="icon-button"><MoreHorizontal size={17}/></button></div>)}{filtered.length === 0 && <EmptyState title="لا توجد نتائج" body="جرب تغيير عبارة البحث أو الفلتر."/>}</div>
      <div className="table-footer"><span>عرض {filtered.length} من {tasks.length} مهمة</span><div><button className="pagination-button" disabled><ChevronRight size={14}/></button><button className="pagination-button active">1</button><button className="pagination-button" disabled><ChevronLeft size={14}/></button></div></div>
    </div>
  </>;
}

function CoursesPage({ subjects, onAdd, canEdit, onOpen }: { subjects: Subject[]; onAdd: () => void; canEdit: boolean; onOpen: () => void }) {
  return <><PageHeader eyebrow="ACADEMIC SPACE" title="المواد الدراسية" description="تابع مقررات الترم الأول، محاضراتك، ونسبة تقدمك في كل مادة." action={canEdit ? <button className="btn btn-primary" onClick={onAdd}><Plus size={16}/> إضافة مادة</button> : <span className="semester-chip compact-chip">7 مواد مسجلة <BookOpen size={14}/></span>}/>
    <div className="course-hero panel"><div><div className="eyebrow">CURRENT SEMESTER</div><h2>السنة الإعدادية <span>·</span> الترم الأول</h2><p>مجموعة موادك الأساسية لهذا الفصل الدراسي. تعلم بوتيرتك واحتفظ بتقدمك في مكان واحد.</p></div><div className="course-hero-stats"><div><b>{subjects.length}</b><span>مادة دراسية</span></div><div><b>{subjects.reduce((sum, s) => sum + s.lectures, 0)}</b><span>محاضرة متاحة</span></div></div></div>
    <div className="course-grid">{subjects.map((subject) => <button className="course-card" key={subject.id} onClick={onOpen}><div className="course-card-top"><div className="course-icon" style={{ background: `${subject.color}18`, color: subject.color }}>{subject.icon}</div><span className="course-code">{subject.code}</span><button className="icon-button" onClick={(e) => e.stopPropagation()} aria-label="خيارات المادة"><MoreHorizontal size={18}/></button></div><h3>{subject.name}</h3><p>{subject.instructor}</p><div className="course-card-bottom"><div><span>التقدم في المادة</span><b>{subject.progress}%</b></div><div className="progress-track"><div style={{ width: `${subject.progress}%`, background: subject.color }}/></div><div className="course-meta"><span><Video size={14}/>{subject.lectures} محاضرة</span><span><BookOpen size={14}/>الترم الأول</span></div></div></button>)}</div>
  </>;
}

function LecturesPage({ lectures, subjects }: { lectures: Lecture[]; subjects: Subject[] }) {
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [playing, setPlaying] = useState<string | null>(null);
  const filtered = lectures.filter((lecture) => subjectFilter === 'all' || lecture.subjectId === subjectFilter);
  return <><PageHeader eyebrow="LECTURE LIBRARY" title="المحاضرات" description="استكمل من حيث توقفت، وراجع الأجزاء المسجلة في أي وقت." action={<button className="filter-button"><Filter size={15}/> ترتيب حسب الأحدث</button>}/>
    <div className="filter-tabs lecture-filters"><button className={subjectFilter === 'all' ? 'filter-tab active' : 'filter-tab'} onClick={() => setSubjectFilter('all')}>كل المواد</button>{subjects.map((s) => <button className={subjectFilter === s.id ? 'filter-tab active' : 'filter-tab'} key={s.id} onClick={() => setSubjectFilter(s.id)}>{s.name}</button>)}</div>
    <div className="lecture-grid">{filtered.map((lecture, index) => <article className="lecture-card" key={lecture.id}><div className={`lecture-cover cover-${index % 4}`}><div className="cover-grid"/><span className="lecture-subject-tag">{lecture.subjectName}</span><button className="play-button" onClick={() => setPlaying(playing === lecture.id ? null : lecture.id)}>{playing === lecture.id ? <Check size={24}/> : <Play size={23} fill="currentColor"/>}</button><span className="cover-duration"><Clock3 size={12}/>{lecture.duration}</span></div><div className="lecture-card-body"><div className="lecture-meta"><span>{lecture.instructor}</span><span>{lecture.date}</span></div><h3>{lecture.title}</h3><div className="lecture-progress-head"><span>{lecture.parts} أجزاء · {lecture.progress === 100 ? 'مكتملة' : 'نسبة المشاهدة'}</span><b>{lecture.progress}%</b></div><div className="progress-track"><div style={{ width: `${lecture.progress}%` }}/></div>{playing === lecture.id && <div className="inline-player-state"><Play size={13}/> وضع المعاينة التجريبية — أضف رابط الفيديو من لوحة الإدارة</div>}</div></article>)}</div>
  </>;
}

function ExamsPage({ exams, setExams }: { exams: Exam[]; setExams: (fn: (items: Exam[]) => Exam[]) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  return <><PageHeader eyebrow="ASSESSMENTS" title="الاختبارات والامتحانات" description="استعد لاختباراتك القادمة وتابع نتائج محاولاتك السابقة." action={<button className="filter-button"><CalendarDays size={15}/> عرض التقويم</button>}/>
    <div className="exam-highlight"><div className="exam-highlight-icon"><AlarmClock size={23}/></div><div><span>الاختبار القادم</span><h2>{exams.find((exam) => exam.status === 'upcoming')?.title ?? 'لا يوجد اختبار قادم'}</h2><p>تأكد من مراجعة المحاضرات وحل نماذج التدريب قبل موعد الاختبار.</p></div><div className="exam-countdown"><b>03</b><span>أيام متبقية</span></div></div>
    <div className="section-title-row exam-list-title"><div><h2>كل الاختبارات</h2><p>اختبارات تدريبية وتقييمات المقررات</p></div><div className="filter-tabs"><button className="filter-tab active">الكل</button><button className="filter-tab">قادمة</button><button className="filter-tab">مكتملة</button></div></div>
    <div className="exam-list">{exams.map((exam) => <div className="exam-row" key={exam.id}><div className={`exam-type-icon ${exam.status}`}><ClipboardList size={20}/></div><div className="exam-row-copy"><b>{exam.title}</b><span>{exam.subjectName} <i>•</i> {exam.questions} سؤال <i>•</i> {exam.duration}</span></div><div className="exam-date"><b>{new Date(exam.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</b><span>{new Date(exam.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span></div><span className={`exam-status ${exam.status}`}>{exam.status === 'upcoming' ? 'قادم' : exam.status === 'available' ? 'متاح الآن' : 'مكتمل'}</span><button className="btn btn-outline btn-small" onClick={() => { setSelected(exam.id); if (exam.status === 'available') setExams((items) => items.map((item) => item.id === exam.id ? { ...item, status: 'completed' } : item)); }}>{exam.status === 'completed' ? 'عرض النتيجة' : exam.status === 'available' ? 'ابدأ الاختبار' : 'التفاصيل'}</button></div>)}</div>
    {selected && <div className="inline-info"><CheckCircle2 size={16}/> {exams.find((e) => e.id === selected)?.status === 'completed' ? 'تم تسجيل فتح تفاصيل الاختبار في النسخة التجريبية.' : 'تفاصيل الاختبار جاهزة.'}<button onClick={() => setSelected(null)}><X size={14}/></button></div>}
  </>;
}

function FilesPage({ files, onUpload, cloudinaryReady, isDemo }: { files: LibraryFile[]; onUpload: (file: File) => Promise<void>; cloudinaryReady: boolean; isDemo: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const filtered = files.filter((file) => file.name.toLowerCase().includes(query.toLowerCase()) || file.subjectName.toLowerCase().includes(query.toLowerCase()));
  const handleFile = async (file?: File) => { if (!file) return; setUploading(true); await onUpload(file); setUploading(false); };
  return <><PageHeader eyebrow="RESOURCE CENTER" title="مكتبة الملفات" description="كل مذكراتك وملفات المحاضرات والمواد المساعدة في مكتبة منظمة." action={<><input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.zip,.png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm" className="visually-hidden" onChange={(e) => void handleFile(e.target.files?.[0])}/><button className="btn btn-primary" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <span className="spinner"/> : <Upload size={16}/>} رفع ملف</button></>}/>
    <div className="file-storage-banner"><div className="storage-icon"><CloudUpload size={23}/></div><div><b>مكتبة ملفاتك</b><span>{isDemo ? 'وضع العرض التجريبي — تُحفظ بيانات الملفات محلياً في هذا المتصفح فقط.' : cloudinaryReady ? 'Cloudinary متصل — تُرفع إليه كل الملفات والصور والفيديوهات، بينما تُحفظ بياناتها وروابطها فقط في Firestore. روابط الرفع غير الموقّع عامة لمن يملك الرابط.' : 'Cloudinary غير مهيأ بعد. أضف Cloud Name وUnsigned Upload Preset من لوحة الإدارة قبل رفع الملفات.'}</span></div><div className="storage-meter"><div><span>مساحة العرض</span><b>{files.length} ملفات</b></div><div className="progress-track"><div style={{ width: '36%' }}/></div></div></div>
    <div className="panel file-panel"><div className="file-toolbar"><div className="filter-tabs"><button className="filter-tab active">كل الملفات</button><button className="filter-tab">PDF</button><button className="filter-tab">العروض</button><button className="filter-tab">الصور</button></div><div className="inline-search"><Search size={15}/><input placeholder="ابحث عن ملف..." value={query} onChange={(e) => setQuery(e.target.value)}/></div></div>
      <div className="file-grid">{filtered.map((file) => <div className="file-card" key={file.id}><div className={`file-type-icon type-${file.type.toLowerCase()}`}>{file.type === 'IMAGE' ? <FileImage size={22}/> : file.type === 'VIDEO' ? <Video size={22}/> : <FileText size={22}/>}<span>{file.type}</span></div><div className="file-card-copy"><b>{file.name}</b><span>{file.subjectName}</span><small>{file.size} <i>•</i> {file.updatedAt}</small></div><button className="icon-button" onClick={() => file.url ? window.open(file.url, '_blank', 'noopener,noreferrer') : undefined} aria-label="فتح الملف"><Download size={16}/></button></div>)}</div>
      {filtered.length === 0 && <EmptyState title="لم يتم العثور على ملفات" body="ارفع ملفاً جديداً أو جرّب البحث بكلمات مختلفة."/>}
    </div>
  </>;
}

function ChatPage({ messages, setMessages }: { messages: Array<{ id: string; name: string; text: string; time: string; mine: boolean }>; setMessages: (fn: (items: Array<{ id: string; name: string; text: string; time: string; mine: boolean }>) => Array<{ id: string; name: string; text: string; time: string; mine: boolean }>) => void }) {
  const [draft, setDraft] = useState('');
  const send = (event: FormEvent) => { event.preventDefault(); if (!draft.trim()) return; setMessages((items) => [...items, { id: crypto.randomUUID(), name: 'أنت', text: draft.trim(), time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }), mine: true }]); setDraft(''); };
  return <><PageHeader eyebrow="STUDY TOGETHER" title="المحادثات" description="تواصل مع زملائك وشارك الأسئلة والملفات الدراسية." action={<button className="btn btn-primary"><Plus size={16}/> محادثة جديدة</button>}/>
    <div className="chat-layout panel"><aside className="chat-list"><div className="chat-list-header"><b>محادثاتك</b><button className="icon-button"><Plus size={17}/></button></div><div className="chat-search"><Search size={15}/><input placeholder="ابحث في المحادثات"/></div><button className="chat-contact active"><div className="avatar avatar-cyan">C</div><div><b>Computer Science — Group</b><span>كريم: رفعت ملف المراجعة...</span></div><small>11:02</small></button><button className="chat-contact"><div className="avatar avatar-orange">S</div><div><b>Study Buddies</b><span>سارة: تمام، شكراً!</span></div><small>أمس</small></button><button className="chat-contact"><div className="avatar avatar-pink">A</div><div><b>أحمد سمير</b><span>تم استلام سؤالك.</span></div><small>الإثنين</small></button></aside>
      <section className="chat-conversation"><div className="chat-top"><div className="avatar avatar-cyan">C</div><div><b>Computer Science — Group</b><span><i className="live-dot"/> 18 عضواً في المجموعة</span></div><button className="icon-button"><MoreHorizontal size={19}/></button></div><div className="chat-date-separator"><span>اليوم · 17 نوفمبر 2026</span></div><div className="chat-messages">{messages.map((message) => <div className={message.mine ? 'message-line mine' : 'message-line'} key={message.id}>{!message.mine && <div className="message-avatar">{message.name.slice(0, 1)}</div>}<div className="message-bubble"><span>{message.name}</span><p>{message.text}</p><small>{message.time}</small></div></div>)}</div><form className="chat-composer" onSubmit={send}><button type="button" className="icon-button"><Paperclip size={18}/></button><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="اكتب رسالتك هنا..."/><button type="submit" className="send-button" aria-label="إرسال"><Send size={17}/></button></form></section>
    </div>
  </>;
}

function PlannerPage({ tasks }: { tasks: StudyTask[] }) {
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((value) => { if (value <= 1) { setRunning(false); return 0; } return value - 1; }), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const switchMode = (next: 'focus' | 'break') => { setMode(next); setSeconds(next === 'focus' ? 25 * 60 : 5 * 60); setRunning(false); };
  const timeLabel = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return <><PageHeader eyebrow="PLAN YOUR DAY" title="مخطط المذاكرة" description="نظّم وقتك بين المحاضرات والمهام، وخصص مساحة للتركيز والراحة." action={<button className="btn btn-outline"><Plus size={16}/> جلسة مذاكرة</button>}/>
    <div className="planner-grid"><section className="panel pomodoro-panel"><div className="panel-head"><div><h3>مؤقت التركيز</h3><span>تقنية بومودورو — ركز ثم استرح</span></div><div className="pomodoro-spark"><Sparkles size={17}/></div></div><div className="pomodoro-tabs"><button className={mode === 'focus' ? 'active' : ''} onClick={() => switchMode('focus')}>وقت التركيز</button><button className={mode === 'break' ? 'active' : ''} onClick={() => switchMode('break')}>استراحة قصيرة</button></div><div className="timer-ring"><div className="timer-inner"><span>{mode === 'focus' ? 'FOCUS SESSION' : 'SHORT BREAK'}</span><b>{timeLabel}</b><small>{running ? 'أنت في حالة تركيز' : 'جاهز للبدء'}</small></div></div><button className="btn btn-primary timer-action" onClick={() => { if (seconds === 0) setSeconds(mode === 'focus' ? 25 * 60 : 5 * 60); setRunning(!running); }}>{running ? 'إيقاف مؤقت' : seconds === 0 ? 'ابدأ من جديد' : 'ابدأ التركيز'} <Play size={15}/></button><div className="pomodoro-foot"><span><CheckCircle2 size={14}/> 4 جلسات مكتملة اليوم</span><span><Clock3 size={14}/> هدفك: ساعتان</span></div></section>
      <section className="panel today-plan"><div className="panel-head"><div><h3>خطة اليوم</h3><span>الثلاثاء، 17 نوفمبر 2026</span></div><button className="icon-button"><CalendarDays size={17}/></button></div><div className="timeline"><div className="timeline-row done"><time>09:00</time><i/><div><b>مراجعة Calculus 1</b><span>45 دقيقة · مكتملة</span></div><CheckCircle2 size={16}/></div><div className="timeline-row current"><time>11:00</time><i/><div><b>حل ورقة التمارين 03</b><span>ساعة واحدة · جاري التنفيذ</span></div><span className="now-tag">الآن</span></div><div className="timeline-row"><time>13:00</time><i/><div><b>استراحة وغداء</b><span>30 دقيقة</span></div></div><div className="timeline-row"><time>14:00</time><i/><div><b>مشاهدة محاضرة Physics</b><span>50 دقيقة</span></div></div><div className="timeline-row"><time>16:00</time><i/><div><b>حل أسئلة Computer Science</b><span>45 دقيقة</span></div></div></div></section></div>
    <div className="section-title-row"><div><h2>مهامك ضمن الخطة</h2><p>ابدأ بالأقرب موعداً والأعلى أولوية</p></div></div><div className="planner-task-strip">{tasks.filter((t) => t.status !== 'completed').slice(0, 3).map((task) => <div key={task.id}><div className="planner-task-icon"><Target size={17}/></div><div><b>{task.title}</b><span>{task.subjectName}</span></div><span className={`priority-badge priority-${task.priority}`}>{priorityText[task.priority]}</span></div>)}</div>
  </>;
}

function AnalyticsPage({ tasks, subjects, lectures }: { tasks: StudyTask[]; subjects: Subject[]; lectures: Lecture[] }) {
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const completion = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  return <><PageHeader eyebrow="YOUR PERFORMANCE" title="إحصائياتك الدراسية" description="راقب تقدمك وحدد أين تركز مجهودك خلال الأسابيع القادمة." action={<button className="filter-button"><CalendarDays size={15}/> آخر 30 يوماً <ChevronDown size={13}/></button>}/>
    <div className="analytics-summary"><div className="analytics-score"><div className="score-ring"><div><b>{completion}%</b><span>إنجاز المهام</span></div></div><div><div className="eyebrow">YOUR PRODUCTIVITY</div><h2>أداء ثابت، أحسنت!</h2><p>استمر في تقسيم مهامك الكبيرة إلى خطوات صغيرة قابلة للإنجاز.</p></div></div><div className="analytics-kpis"><div><span>ساعات المذاكرة</span><b>12.5 <small>ساعة</small></b><i>+18% هذا الأسبوع</i></div><div><span>محاضرات مكتملة</span><b>{lectures.filter((l) => l.progress === 100).length}</b><i>من أصل {lectures.length}</i></div><div><span>المهام المكتملة</span><b>{completed}</b><i>من أصل {tasks.length}</i></div></div></div>
    <div className="analytics-grid"><section className="panel"><div className="panel-head"><div><h3>تقدمك حسب المادة</h3><span>نسبة استكمال المحتوى الدراسي</span></div></div><div className="analytics-subjects">{subjects.map((s) => <div key={s.id}><span className="analytics-subject-name"><i style={{ background: s.color }}/>{s.name}</span><div className="progress-track"><div style={{ width: `${s.progress}%`, background: s.color }}/></div><b>{s.progress}%</b></div>)}</div></section><section className="panel"><div className="panel-head"><div><h3>إنجاز المهام</h3><span>توزيع الحالات الحالية</span></div></div><div className="task-donut-wrap"><div className="task-donut"><div><b>{tasks.length}</b><span>مهمة</span></div></div><div className="donut-legend"><span><i className="legend-green"/> مكتملة <b>{completed}</b></span><span><i className="legend-purple"/> قيد التنفيذ <b>{tasks.filter((t) => t.status === 'in-progress').length}</b></span><span><i className="legend-gray"/> لم تبدأ <b>{tasks.filter((t) => t.status === 'not-started').length}</b></span></div></div></section></div>
  </>;
}

function NotificationsPage({ items, setItems }: { items: AppNotification[]; setItems: (fn: (items: AppNotification[]) => AppNotification[]) => void }) {
  return <><PageHeader eyebrow="UPDATES" title="الإشعارات" description="آخر التحديثات والتنبيهات الخاصة بموادك ومهامك." action={<button className="btn btn-outline" onClick={() => setItems((all) => all.map((item) => ({ ...item, read: true })))}><Check size={15}/> تحديد الكل كمقروء</button>}/><div className="panel notifications-panel">{items.map((item) => { const Icon = iconForKind[item.kind]; return <div className={`notification-row ${item.read ? '' : 'unread'}`} key={item.id}><div className={`notification-kind kind-${item.kind}`}><Icon size={18}/></div><div><b>{item.title}</b><p>{item.body}</p><span>{item.time}</span></div><div className="notification-actions">{!item.read && <i/>}<button className="icon-button" onClick={() => setItems((all) => all.map((n) => n.id === item.id ? { ...n, read: !n.read } : n))}>{item.read ? <Check size={15}/> : <MoreHorizontal size={18}/>}</button></div></div>; })}{items.length === 0 && <EmptyState title="لا توجد إشعارات" body="ستظهر هنا التحديثات الجديدة."/>}</div></>;
}

function AdminPage({ tasks, subjects, files, currentUser, cloudinarySettings, onNewTask, onAddSubject, onSaved, onError }: {
  tasks: StudyTask[];
  subjects: Subject[];
  files: LibraryFile[];
  currentUser: AppUser;
  cloudinarySettings: CloudinarySettings;
  onNewTask: () => void;
  onAddSubject: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [tab, setTab] = useState('overview');
  const [cloudName, setCloudName] = useState(cloudinarySettings.cloudName);
  const [uploadPreset, setUploadPreset] = useState(cloudinarySettings.uploadPreset);
  const [enabled, setEnabled] = useState(cloudinarySettings.enabled);
  const [maxImageMB, setMaxImageMB] = useState(String(cloudinarySettings.maxImageMB));
  const [maxVideoMB, setMaxVideoMB] = useState(String(cloudinarySettings.maxVideoMB));
  const [maxDocumentMB, setMaxDocumentMB] = useState(String(cloudinarySettings.maxDocumentMB));
  const [savingCloudinary, setSavingCloudinary] = useState(false);

  useEffect(() => {
    setCloudName(cloudinarySettings.cloudName);
    setUploadPreset(cloudinarySettings.uploadPreset);
    setEnabled(cloudinarySettings.enabled);
    setMaxImageMB(String(cloudinarySettings.maxImageMB));
    setMaxVideoMB(String(cloudinarySettings.maxVideoMB));
    setMaxDocumentMB(String(cloudinarySettings.maxDocumentMB));
  }, [cloudinarySettings]);

  const saveCloudinary = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextSettings: CloudinarySettings = {
      enabled,
      cloudName: cloudName.trim(),
      uploadPreset: uploadPreset.trim(),
      maxImageMB: Math.max(1, Math.min(100, Number(maxImageMB) || 20)),
      maxVideoMB: Math.max(1, Math.min(500, Number(maxVideoMB) || 100)),
      maxDocumentMB: Math.max(1, Math.min(100, Number(maxDocumentMB) || 25)),
    };
    if (enabled && (!nextSettings.cloudName || !nextSettings.uploadPreset)) {
      onError('أدخل Cloud Name وUnsigned Upload Preset قبل تفعيل الرفع.');
      return;
    }
    setSavingCloudinary(true);
    try {
      await saveCloudinarySettings(nextSettings, currentUser.uid);
      onSaved();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'تعذر حفظ إعدادات Cloudinary. تأكد أن حسابك مسجل كمدير في Firebase.');
    } finally {
      setSavingCloudinary(false);
    }
  };

  return <><PageHeader eyebrow="MANAGEMENT CENTER" title="لوحة إدارة المنصة" description="إدارة المحتوى الأكاديمي وإعدادات الخدمات المرتبطة بالمنصة." action={<span className="admin-status"><i/> وضع الإدارة</span>}/>
    <div className="admin-tabs">{[{ id: 'overview', label: 'نظرة عامة' }, { id: 'academic', label: 'المحتوى الأكاديمي' }, { id: 'tasks', label: 'إدارة المهام' }, { id: 'users', label: 'المستخدمون' }, { id: 'cloudinary', label: 'إعدادات Cloudinary' }].map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={tab === item.id ? 'active' : ''}>{item.label}</button>)}</div>
    {tab === 'overview' && <><div className="admin-stats"><StatCard label="إجمالي الطلاب" value="248" meta="حساباً مسجلاً" icon={<Users size={18}/>} tone="violet" trend="حسابات المنصة"/><StatCard label="المواد الدراسية" value={subjects.length.toString()} meta="مادة نشطة" icon={<BookOpen size={18}/>} tone="blue" trend="الترم الأول"/><StatCard label="المهام المنشورة" value={tasks.length.toString()} meta="مهمة في النظام" icon={<ListChecks size={18}/>} tone="green" trend="آخر تحديث اليوم"/><StatCard label="الملفات" value={files.length.toString()} meta="ملف في المكتبة" icon={<FolderOpen size={18}/>} tone="amber" trend="Cloudinary"/></div><div className="admin-quick-grid"><button onClick={onNewTask}><div><Plus size={19}/></div><b>إنشاء مهمة</b><span>نشر تكليف للطلاب</span></button><button onClick={onAddSubject}><div><BookOpen size={19}/></div><b>إضافة مادة</b><span>تحديث الهيكل الأكاديمي</span></button><button onClick={() => setTab('users')}><div><Users size={19}/></div><b>إدارة المستخدمين</b><span>الأدوار والصلاحيات</span></button></div></>}
    {tab === 'academic' && <div className="panel admin-content-list"><div className="panel-head"><div><h3>المواد الدراسية</h3><span>السنة الإعدادية — الترم الأول</span></div><button className="btn btn-primary btn-small" onClick={onAddSubject}><Plus size={14}/> إضافة مادة</button></div>{subjects.map((s) => <div className="admin-list-row" key={s.id}><div className="subject-mini-icon" style={{ background: `${s.color}18`, color: s.color }}>{s.icon}</div><div><b>{s.name}</b><span>{s.code} · {s.instructor}</span></div><span>{s.lectures} محاضرة</span><span className="status-chip status-completed">منشورة</span></div>)}</div>}
    {tab === 'tasks' && <div className="panel admin-content-list"><div className="panel-head"><div><h3>المهام المنشورة</h3><span>راجع التسليمات وحالة تقدم الطلاب</span></div><button className="btn btn-primary btn-small" onClick={onNewTask}><Plus size={14}/> مهمة جديدة</button></div>{tasks.map((t) => <div className="admin-list-row" key={t.id}><div className="admin-task-symbol"><ClipboardList size={17}/></div><div><b>{t.title}</b><span>{t.subjectName}</span></div><span className={`priority-badge priority-${t.priority}`}>{priorityText[t.priority]}</span><span className={`status-chip status-${t.status}`}>{statusText[t.status]}</span></div>)}</div>}
    {tab === 'users' && <div className="panel users-placeholder"><Users size={32}/><h3>إدارة حسابات المديرين</h3><p>تُضاف حسابات المديرين من Firebase Console داخل مجموعة <b dir="ltr">admins</b>. أنشئ مستنداً لكل بريد إلكتروني مطابقاً لحساب Authentication. راجع دليل README للحصول على الحقول الدقيقة.</p><span className="admin-status"><i/> الصلاحيات تُقرأ من Firestore</span></div>}
    {tab === 'cloudinary' && <form className="panel admin-content-list form-stack" onSubmit={(event) => void saveCloudinary(event)}>
      <div className="panel-head"><div><h3>ربط Cloudinary</h3><span>تُرفع كل الملفات والصور والفيديوهات إلى Cloudinary، ويحتفظ Firestore بالنصوص والبيانات الوصفية فقط.</span></div><span className={`connection-state ${isCloudinaryConfigured(cloudinarySettings) ? '' : 'demo'}`}><i/>{isCloudinaryConfigured(cloudinarySettings) ? 'متصل' : 'غير مهيأ'}</span></div>
      <label>Cloud Name<input dir="ltr" autoComplete="off" value={cloudName} onChange={(event) => setCloudName(event.target.value)} placeholder="your-cloud-name"/></label>
      <label>Unsigned Upload Preset<input dir="ltr" autoComplete="off" value={uploadPreset} onChange={(event) => setUploadPreset(event.target.value)} placeholder="eng-hub-unsigned"/></label>
      <div className="setting-row"><div><b>تفعيل الرفع</b><span>عند إيقافه لن يتم رفع الملفات من المنصة.</span></div><button type="button" className={`toggle-switch ${enabled ? 'on' : ''}`} onClick={() => setEnabled((value) => !value)} aria-pressed={enabled}><i/></button></div>
      <div className="admin-cloudinary-limits"><label>حد الصورة (MB)<input type="number" min="1" max="100" value={maxImageMB} onChange={(event) => setMaxImageMB(event.target.value)}/></label><label>حد الفيديو (MB)<input type="number" min="1" max="500" value={maxVideoMB} onChange={(event) => setMaxVideoMB(event.target.value)}/></label><label>حد المستند (MB)<input type="number" min="1" max="100" value={maxDocumentMB} onChange={(event) => setMaxDocumentMB(event.target.value)}/></label></div>
      <div className="inline-info"><AlertCircle size={16}/> استخدم Unsigned Upload Preset مقيّداً بالأنواع والأحجام والمجلد من لوحة Cloudinary. لا تضع API Secret هنا ولا في الموقع.</div>
      <p className="settings-hint">الامتدادات المدعومة: PDF وDOC/DOCX وPPT/PPTX وXLS/XLSX وCSV وTXT وZIP وJPG/PNG/WEBP/GIF وMP4/MOV/WEBM.</p>
      <div><button className="btn btn-primary" type="submit" disabled={savingCloudinary}>{savingCloudinary ? <span className="spinner"/> : <Check size={15}/>} حفظ إعدادات Cloudinary</button></div>
    </form>}
  </>;
}
function ProfilePage({ user, isDemo, onToggleRole, onLogout, onToggleTheme, dark }: {
  user: { uid: string; displayName: string; email: string; role: string; academicYear: string; term: string };
  isDemo: boolean;
  onToggleRole: () => void;
  onLogout: () => Promise<void>;
  onToggleTheme: () => void;
  dark: boolean;
}) {
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [pushGranted, setPushGranted] = useState(() =>
    typeof Notification !== 'undefined' && Notification.permission === 'granted',
  );

  const activatePush = async () => {
    setPushBusy(true);
    setPushMessage('');
    try {
      await enablePushNotifications(user.uid);
      setPushGranted(true);
      setPushMessage('تم تفعيل الإشعارات لهذا المتصفح.');
    } catch (error) {
      setPushMessage(error instanceof Error ? error.message : 'تعذر تفعيل الإشعارات.');
      setPushGranted(typeof Notification !== 'undefined' && Notification.permission === 'granted');
    } finally {
      setPushBusy(false);
    }
  };

  return <>
    <PageHeader eyebrow="ACCOUNT SETTINGS" title="الملف الشخصي والإعدادات" description="تحكم في بيانات حسابك وطريقة ظهور المنصة."/>
    <div className="profile-layout">
      <section className="panel profile-card">
        <div className="profile-cover"/>
        <div className="profile-details">
          <div className="profile-avatar-large">{user.displayName.slice(0, 1)}</div>
          <h2>{user.displayName}</h2>
          <p>{user.email}</p>
          <span className="role-chip">{user.role === 'admin' || user.role === 'super-admin' ? 'مدير المنصة' : 'طالب هندسة'}</span>
          <div className="profile-academic">
            <div><span>الفرقة</span><b>{user.academicYear}</b></div>
            <div><span>الفصل الدراسي</span><b>{user.term}</b></div>
          </div>
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="settings-section">
          <h3>المظهر</h3>
          <div className="setting-row">
            <div className="setting-icon"><Sun size={18}/></div>
            <div><b>الوضع الليلي</b><span>تغيير مظهر المنصة بين الفاتح والداكن</span></div>
            <button className={`toggle-switch ${dark ? 'on' : ''}`} onClick={onToggleTheme} aria-pressed={dark}><i/></button>
          </div>
        </div>
        <div className="settings-section">
          <h3>الإشعارات</h3>
          <div className="setting-row">
            <div className="setting-icon"><Bell size={18}/></div>
            <div>
              <b>إشعارات المتصفح</b>
              <span>{isDemo ? 'تفعيلها متاح بعد ربط Firebase بالموقع.' : pushGranted ? 'إذن الإشعارات ممنوح؛ يمكنك تحديث تسجيل هذا الجهاز.' : 'اسمح للموقع بإرسال إشعارات المهام والتنبيهات.'}</span>
            </div>
            <button className="btn btn-outline btn-small" onClick={() => void activatePush()} disabled={isDemo || pushBusy}>
              {pushBusy ? <span className="spinner"/> : null}
              {pushGranted ? 'تحديث التسجيل' : 'تفعيل الإشعارات'}
            </button>
          </div>
          {pushMessage && <p className="settings-hint" role="status">{pushMessage}</p>}
        </div>
        <div className="settings-section">
          <h3>الحساب</h3>
          <div className="setting-row">
            <div className="setting-icon"><ShieldCheck size={18}/></div>
            <div><b>حالة الاتصال</b><span>{isDemo ? 'وضع تجريبي — لا يوجد اتصال بقاعدة البيانات' : 'متصل بخدمات Firebase'}</span></div>
            <span className={`connection-state ${isDemo ? 'demo' : ''}`}><i/>{isDemo ? 'Demo' : 'Online'}</span>
          </div>
          {isDemo && <div className="setting-row">
            <div className="setting-icon"><Users size={18}/></div>
            <div><b>تجربة صلاحيات الأدمن</b><span>التبديل بين حساب الطالب والمدير داخل العرض التجريبي</span></div>
            <button className="btn btn-outline btn-small" onClick={onToggleRole}>تبديل الدور</button>
          </div>}
        </div>
        <div className="settings-section">
          <h3>الجلسة</h3>
          <div className="setting-row">
            <div className="setting-icon danger-setting"><LogOut size={18}/></div>
            <div><b>تسجيل الخروج</b><span>إنهاء جلستك الحالية</span></div>
            <button className="btn btn-outline btn-small" onClick={() => void onLogout()}>تسجيل الخروج</button>
          </div>
        </div>
      </section>
    </div>
  </>;
}

export default App;
