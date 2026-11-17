import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type MouseEvent } from 'react';
import {
  Activity, AlarmClock, AlertCircle, ArrowDownLeft, ArrowLeft, ArrowUpLeft, Bell, BookOpen,
  BookOpenCheck, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Clock3, CloudUpload, Code2, Command, Download, File, FileImage, FileText,
  Filter, FolderOpen, GraduationCap, Grid2X2, Headphones, Home, Layers3, LogOut, Menu,
  MessageCircle, MoreHorizontal, Paperclip, Pause, Play, Plus, Search, Send, Settings, ShieldCheck,
  SlidersHorizontal, Sparkles, Sun, Moon, Target, Timer, TrendingUp, Upload, Users,
  Video, X, Zap, ClipboardList, CalendarClock, BookMarked, ListChecks, ChartNoAxesCombined,
  ImagePlus, Volume2, VolumeX, Maximize, Trash2, Pencil, Monitor, Smartphone,
} from 'lucide-react';
import { useAuth, registerAccount } from './AuthContext';
import { defaultCloudinarySettings, isCloudinaryConfigured, saveCloudinarySettings, subscribeCloudinarySettings, type CloudinarySettings } from '../lib/cloudinary';
import { uploadFile } from '../lib/uploads';
import { enablePushNotifications, listenForForegroundMessages } from '../lib/messaging';
import { isFirebaseConfigured } from '../lib/firebase';
import { readLocal, writeLocal } from '../lib/storage';
import { createExamCloud, createLectureCloud, createLecturePartCloud, createLecturerCloud, createSubjectCloud, createTaskCloud, deleteTaskCloud, saveFileMetadataCloud, subscribeExams, subscribeFiles, subscribeLectureParts, subscribeLecturers, subscribeLectures, subscribeSubjects, subscribeTasks, updateTaskStatusCloud } from '../lib/cloudData';
import { deleteGeneralChatMessage, joinGeneralChat, sendGeneralChatMessage, subscribeGeneralChat, type ChatAttachment, type ChatMessage } from '../lib/chat';
import type { AppNotification, AppUser, Exam, Lecture, LecturePart, Lecturer, LibraryFile, Priority, StudyTask, Subject, TaskStatus } from '../types';

const navGroups = [
  { title: 'مساحة الدراسة', items: [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'tasks', label: 'المهام', icon: ListChecks },
    { id: 'courses', label: 'المواد الدراسية', icon: BookOpen },
    { id: 'lectures', label: 'المحاضرات', icon: Video },
    { id: 'exams', label: 'الاختبارات', icon: ClipboardList },
    { id: 'files', label: 'مكتبة الملفات', icon: FolderOpen },
  ] },
  { title: 'التواصل والتنظيم', items: [
    { id: 'chat', label: 'المحادثات', icon: MessageCircle },
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
  const { user, isDemo, loading, profileComplete, completeProfile, saveProfile, deleteAccount, logout, toggleDemoRole, login, loginWithGoogle } = useAuth();
  const activeUser = user ?? { uid: '', displayName: 'طالب هندسة', email: '', photoURL: null, role: 'student' as const, academicYear: 'السنة الإعدادية', term: 'الترم الأول' };
  const [page, setPage] = useState('home');
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState('');
  const [themePreference, setThemePreference] = useState<'system' | 'light' | 'dark'>(() => readLocal<'system' | 'light' | 'dark'>('themePreference', 'system'));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  const dark = themePreference === 'system' ? systemDark : themePreference === 'dark';
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lectures, setCloudLectures] = useState<Lecture[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedLecturerId, setSelectedLecturerId] = useState('');
  const [selectedLectureId, setSelectedLectureId] = useState('');
  const [lectureParts, setLectureParts] = useState<LecturePart[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [cloudinarySettings, setCloudinarySettings] = useState<CloudinarySettings>(defaultCloudinarySettings);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [taskModal, setTaskModal] = useState(false);
  const [subjectModal, setSubjectModal] = useState(false);
  const [lectureModal, setLectureModal] = useState(false);
  const [lecturerModal, setLecturerModal] = useState(false);
  const [lecturePartModal, setLecturePartModal] = useState(false);
  const [examModal, setExamModal] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => writeLocal('tasks', tasks), [tasks]);
  useEffect(() => writeLocal('subjects', subjects), [subjects]);
  useEffect(() => writeLocal('exams', exams), [exams]);
  useEffect(() => writeLocal('files', files), [files]);
  useEffect(() => {
    if (!user || isDemo) { setCloudinarySettings(defaultCloudinarySettings); return; }
    return subscribeCloudinarySettings(setCloudinarySettings, (error) => setToast(`تعذر قراءة إعدادات Cloudinary: ${error.message}`));
  }, [user?.uid, isDemo]);
  useEffect(() => writeLocal('notifications', notifications), [notifications]);
  useEffect(() => writeLocal('themePreference', themePreference), [themePreference]);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
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
      subscribeLecturers(setLecturers, onError),
      subscribeExams(setExams, onError),
      subscribeFiles(activeUser.uid, isAdmin, setFiles, onError),
    ].filter(Boolean) as Array<() => void>;
    return () => stops.forEach((stop) => stop());
  }, [user?.uid, isDemo, activeUser.uid, isAdmin]);

  useEffect(() => {
    if (!user || isDemo || !selectedLectureId) {
      setLectureParts([]);
      return;
    }
    return subscribeLectureParts(selectedLectureId, setLectureParts, (error) => {
      setToast(`تعذر تحميل أجزاء المحاضرة: ${error.message}`);
    });
  }, [user?.uid, isDemo, selectedLectureId]);

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

  const addLecturer = async (data: { name: string; subjectId: string; subjectName: string; bio?: string; description?: string; photoURL?: string | null }) => {
    try {
      await createLecturerCloud(data);
      setLecturerModal(false);
      setToast('تمت إضافة المدرس إلى المادة');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'تعذرت إضافة المدرس');
    }
  };

  const addLecture = async (data: { title: string; description?: string; lecturerId: string; duration?: string }) => {
    const lecturer = lecturers.find((item) => item.id === data.lecturerId);
    if (!lecturer) {
      setToast('اختر مدرساً صحيحاً تابعاً للمادة أولاً.');
      return;
    }
    try {
      await createLectureCloud({
        ...data,
        subjectId: lecturer.subjectId,
        subjectName: lecturer.subjectName,
        lecturerName: lecturer.name,
      });
      setLectureModal(false);
      setSelectedSubjectId(lecturer.subjectId);
      setSelectedLecturerId(lecturer.id);
      setToast('تم إنشاء المحاضرة. أضف الآن أجزاء الفيديو الخاصة بها.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'تعذر إنشاء المحاضرة');
    }
  };

  const addLecturePart = async (data: { title: string; videoUrl: string; duration: string; order: number }) => {
    if (!selectedLectureId) return;
    try {
      await createLecturePartCloud({ ...data, lectureId: selectedLectureId });
      setLecturePartModal(false);
      setToast('تمت إضافة جزء الفيديو إلى المحاضرة');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'تعذرت إضافة جزء المحاضرة');
    }
  };

  const addExam = async (data: { title: string; subjectName: string; date: string; duration: string; questions: number }) => {
    setExamModal(false);
    try {
      await createExamCloud(data);
      setToast('تم نشر الاختبار بنجاح');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'تعذر إنشاء الاختبار');
    }
  };

  const removeTask = async (taskId: string) => {
    if (!isAdmin) return;
    try {
      if (!isDemo) await deleteTaskCloud(taskId);
      setTasks((items) => items.filter((task) => task.id !== taskId));
      setToast('تم حذف المهمة');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'تعذر حذف المهمة');
    }
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
    if (!isDemo && remoteUrl) void saveFileMetadataCloud(next, activeUser.uid, isAdmin ? 'public' : 'private').then(() => setToast('تم رفع الملف وحفظ بياناته')).catch((error: unknown) => setToast(error instanceof Error ? error.message : 'تم رفع الملف لكن تعذر حفظ بياناته'));
    else setToast(remoteUrl ? 'تم رفع الملف إلى Cloudinary' : 'أضيف الملف للقائمة التجريبية محلياً فقط');
  };

  if (loading) return <div className="boot-screen"><div className="brand-mark">EH</div><span>جاري تجهيز ENG HUB...</span></div>;
  if (!user) return <AuthScreen onLogin={login} onGoogle={loginWithGoogle} />;
  if (!profileComplete) return <ProfileCompletionScreen user={user} cloudinarySettings={defaultCloudinarySettings} onComplete={completeProfile} />;

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
                <Icon size={18}/><span>{item.label}</span>
              </button>;
            })}
          </div>)}
          {isAdmin && <div className="nav-group"><div className="nav-caption">إدارة المنصة</div><button onClick={() => { setPage('admin'); setMobileNav(false); }} className={`nav-item ${page === 'admin' ? 'active' : ''}`}><ShieldCheck size={18}/><span>لوحة الإدارة</span><span className="admin-dot"/></button></div>}
        </nav>
        <div className="sidebar-spacer"/>
        <div className="sidebar-help"><div className="help-icon"><CircleHelp size={18}/></div><div><b>تحتاج إلى مساعدة؟</b><span>مركز المساعدة والدعم</span></div><ChevronLeft size={15}/></div>
        <div className="sidebar-profile">
          <div className="avatar avatar-purple">{activeUser.photoURL ? <img src={activeUser.photoURL} alt="" /> : activeUser.displayName.slice(0, 1)}</div>
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
            <button className="icon-button theme-toggle" onClick={() => setThemePreference(dark ? 'light' : 'dark')} aria-label="تغيير المظهر">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
            <button className="icon-button notification-button" onClick={() => setPage('notifications')} aria-label="الإشعارات"><Bell size={18}/>{unreadCount > 0 && <i/>}</button>
            <button className="top-avatar" onClick={() => setPage('profile')}>{activeUser.photoURL ? <img src={activeUser.photoURL} alt="" /> : activeUser.displayName.slice(0, 1)}</button>
          </div>
        </header>

        <div className="page-wrap">
          {page === 'home' && <Dashboard userName={activeUser.displayName} tasks={tasks} subjects={subjects} exams={exams} lectures={lectures} onGo={setPage} onNewTask={() => setTaskModal(true)} onStatus={changeTaskStatus} canCreateTask={isAdmin}/>}
          {page === 'tasks' && <TasksPage tasks={tasks} onNew={() => setTaskModal(true)} onStatus={changeTaskStatus} onDelete={(id) => void removeTask(id)} canEdit={isAdmin}/>}
          {(page === 'courses' || page === 'lectures') && <AcademicHubPage
            subjects={subjects} lecturers={lecturers} lectures={lectures} parts={lectureParts}
            selectedSubjectId={selectedSubjectId} selectedLecturerId={selectedLecturerId} selectedLectureId={selectedLectureId}
            canEdit={isAdmin}
            onSelectSubject={(id) => { setSelectedSubjectId(id); setSelectedLecturerId(''); setSelectedLectureId(''); }}
            onSelectLecturer={(id) => { setSelectedLecturerId(id); setSelectedLectureId(''); }}
            onSelectLecture={setSelectedLectureId}
            onBack={() => { if (selectedLectureId) setSelectedLectureId(''); else if (selectedLecturerId) setSelectedLecturerId(''); else setSelectedSubjectId(''); }}
            onAddSubject={() => setSubjectModal(true)}
            onAddLecturer={() => setLecturerModal(true)}
            onAddLecture={() => setLectureModal(true)}
            onAddPart={() => setLecturePartModal(true)}
          />}
          {page === 'exams' && <ExamsPage exams={exams} setExams={setExams} canEdit={isAdmin} onAdd={() => setExamModal(true)}/>}
          {page === 'files' && <FilesPage files={files} onUpload={addFile} cloudinaryReady={isCloudinaryConfigured(cloudinarySettings)} isDemo={isDemo} />}
          {page === 'chat' && <ChatPage user={activeUser} cloudinarySettings={cloudinarySettings} isDemo={isDemo} isAdmin={isAdmin}/>}
          {page === 'planner' && <PlannerPage tasks={tasks} />}
          {page === 'analytics' && <AnalyticsPage tasks={tasks} subjects={subjects} lectures={lectures} />}
          {page === 'notifications' && <NotificationsPage items={notifications} setItems={setNotifications} />}
          {page === 'admin' && <AdminPage tasks={tasks} subjects={subjects} lecturers={lecturers} lectures={lectures} exams={exams} files={files} currentUser={activeUser} cloudinarySettings={cloudinarySettings} onNewTask={() => setTaskModal(true)} onAddSubject={() => setSubjectModal(true)} onAddLecturer={() => { setPage('courses'); setSelectedSubjectId(subjects[0]?.id ?? ''); setSelectedLecturerId(''); setSelectedLectureId(''); setLecturerModal(true); }} onAddLecture={() => setLectureModal(true)} onAddExam={() => setExamModal(true)} onSaved={() => setToast('تم حفظ إعدادات Cloudinary في Firestore')} onError={(message) => setToast(message)} />}
          {page === 'profile' && <ProfilePage user={activeUser} isDemo={isDemo} onToggleRole={toggleDemoRole} onLogout={logout} onDeleteAccount={deleteAccount} onSaveProfile={saveProfile} themePreference={themePreference} onThemeChange={setThemePreference} cloudinarySettings={cloudinarySettings} onToggleTheme={() => setThemePreference(dark ? 'light' : 'dark')} dark={dark} />}
        </div>
      </main>

      {taskModal && <TaskModal subjects={subjects} userId={activeUser.uid} onClose={() => setTaskModal(false)} onSave={addTask}/>}
      {subjectModal && <SubjectModal onClose={() => setSubjectModal(false)} onSave={addSubject}/>}
      {lecturerModal && <LecturerModal subject={subjects.find((item) => item.id === selectedSubjectId) ?? null} onClose={() => setLecturerModal(false)} onSave={addLecturer}/>}
      {lectureModal && <LectureModal lecturers={lecturers} selectedLecturerId={selectedLecturerId} onClose={() => setLectureModal(false)} onSave={addLecture}/>}
      {lecturePartModal && <LecturePartModal nextOrder={lectureParts.length + 1} onClose={() => setLecturePartModal(false)} onSave={addLecturePart}/>}
      {examModal && <ExamModal subjects={subjects} onClose={() => setExamModal(false)} onSave={addExam}/>}
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
  const continueWithGoogle = async () => {
    setError(''); setBusy(true);
    try {
      await onGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تسجيل الدخول باستخدام Google. تحقق من إعدادات Firebase وحاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };
  return <div className="auth-screen" dir="rtl"><div className="auth-visual"><div className="auth-brand"><div className="brand-mark">EH</div><div><b>ENG HUB</b><span>CAIRO UNIVERSITY · FACULTY OF ENGINEERING</span></div></div><div className="auth-visual-copy"><div className="eyebrow">YOUR ENGINEERING JOURNEY</div><h1>كل أدوات دراستك،<br/><span>في مساحة واحدة.</span></h1><p>نظّم محاضراتك، تابع مهامك، وذاكر بتركيز أكبر مع مجتمع هندسة القاهرة.</p><div className="auth-feature-list"><span><CheckCircle2 size={15}/> تنظيم المواد والمحاضرات</span><span><CheckCircle2 size={15}/> متابعة المهام والتسليمات</span><span><CheckCircle2 size={15}/> تعاون ومشاركة مع زملائك</span></div></div><div className="auth-orbit"/><div className="auth-foot">ENG HUB · STUDY SMARTER, BUILD BETTER</div></div><div className="auth-form-side"><form className="auth-form" onSubmit={submit}><div className="auth-mobile-brand"><div className="brand-mark">EH</div><b>ENG HUB</b></div><div className="eyebrow">WELCOME TO ENG HUB</div><h2>{mode === 'login' ? 'مرحباً بعودتك' : 'أنشئ حسابك'}</h2><p>{mode === 'login' ? 'سجل دخولك للوصول إلى مساحة دراستك.' : 'انضم إلى مساحة طلاب هندسة القاهرة.'}</p>{mode === 'register' && <label>الاسم بالكامل<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك كما تحب أن يظهر"/></label>}<label>البريد الإلكتروني<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com"/></label><label>كلمة المرور<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 أحرف على الأقل"/></label>{error && <div className="auth-error"><AlertCircle size={15}/>{error}</div>}<button type="submit" className="btn btn-primary auth-submit" disabled={busy}>{busy ? <span className="spinner"/> : null}{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'} <ArrowLeft size={16}/></button><div className="auth-divider"><span>أو</span></div><button type="button" className="btn btn-outline google-btn" onClick={() => void continueWithGoogle()} disabled={busy}><span className="google-g">G</span> المتابعة باستخدام Google</button><div className="auth-switch">{mode === 'login' ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'إنشاء حساب' : 'تسجيل الدخول'}</button></div><div className="auth-foot-mobile">بالاستمرار، أنت توافق على شروط الاستخدام وسياسة الخصوصية.</div></form></div></div>;
}

function ProfileCompletionScreen({ user, cloudinarySettings, onComplete }: {
  user: AppUser;
  cloudinarySettings: CloudinarySettings;
  onComplete: (profile: { displayName: string; photoURL?: string | null; phone?: string; bio?: string }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [bio, setBio] = useState(user.bio || '');
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (displayName.trim().length < 2) {
      setError('اكتب اسمك كما تريد أن يظهر للطلاب.');
      return;
    }
    setBusy(true);
    try {
      let nextPhoto = photoURL;
      if (photoFile) {
        nextPhoto = await uploadFile(photoFile, cloudinarySettings);
      }
      await onComplete({ displayName: displayName.trim(), photoURL: nextPhoto || null, phone: phone.trim(), bio: bio.trim() });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر حفظ بيانات حسابك. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="profile-onboarding" dir="rtl">
    <div className="profile-onboarding-card panel">
      <div className="brand-row onboarding-brand"><div className="brand-mark">EH</div><div className="brand-copy"><strong>ENG HUB</strong><span>CAIRO UNIVERSITY</span></div></div>
      <div className="eyebrow">COMPLETE YOUR ACCOUNT</div>
      <h1>أكمل إعداد حسابك</h1>
      <p className="onboarding-subtitle">هذه الخطوة مطلوبة قبل الدخول إلى مساحة الدراسة. اختر الاسم والصورة التي سيراها زملاؤك.</p>
      <form className="form-stack" onSubmit={submit}>
        <div className="onboarding-photo-row">
          <div className="onboarding-avatar">{photoFile ? <span>{photoFile.name.slice(0, 1).toUpperCase()}</span> : photoURL ? <img src={photoURL} alt="صورتك الشخصية"/> : displayName.trim().slice(0, 1) || <Users size={26}/>}</div>
          <div className="onboarding-photo-copy"><b>الصورة الشخصية</b><span>اختيارية — يمكنك إضافتها أو تغييرها لاحقاً</span><label className="btn btn-outline btn-small photo-pick-button"><ImagePlus size={14}/> اختيار صورة<input type="file" accept="image/*" className="visually-hidden" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}/></label></div>
        </div>
        <label>الاسم الذي سيظهر في المنصة<input required minLength={2} maxLength={80} autoFocus value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="اكتب اسمك الكامل"/></label>
        <label>رقم الهاتف أو واتساب (اختياري)<input type="tel" maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+20 1xxxxxxxxx" dir="ltr"/></label>
        <label>نبذة قصيرة عنك (اختياري)<textarea rows={3} maxLength={240} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="اكتب نبذة مختصرة تظهر في ملفك الشخصي..."/></label>
        <div className="onboarding-account-email"><b>الحساب المسجل</b><span dir="ltr">{user.email}</span></div>
        {error && <div className="auth-error"><AlertCircle size={15}/>{error}</div>}
        <button className="btn btn-primary onboarding-submit" type="submit" disabled={busy || displayName.trim().length < 2}>{busy ? <span className="spinner"/> : <Check size={16}/>} حفظ وإكمال الحساب</button>
      </form>
    </div>
  </div>;
}

function pageTitle(page: string) {
  const titles: Record<string, string> = { home: 'الرئيسية', tasks: 'المهام', courses: 'المواد الدراسية', lectures: 'المحاضرات', exams: 'الاختبارات', files: 'مكتبة الملفات', chat: 'المحادثات', planner: 'مخطط المذاكرة', analytics: 'إحصائياتي', notifications: 'الإشعارات', admin: 'لوحة الإدارة', profile: 'الملف الشخصي' };
  return titles[page] ?? page;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

function Dashboard({ userName, tasks, subjects, exams, lectures, onGo, onNewTask, onStatus, canCreateTask }: {
  userName: string; tasks: StudyTask[]; subjects: Subject[]; exams: Exam[]; lectures: Lecture[];
  onGo: (page: string) => void; onNewTask: () => void; onStatus: (id: string, status: TaskStatus) => void; canCreateTask: boolean;
}) {
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const todo = tasks.filter((task) => task.status !== 'completed' && task.status !== 'under-review').length;
  const currentExams = exams.filter((exam) => exam.status !== 'completed').length;
  const upcomingTasks = tasks.filter((task) => task.status !== 'completed').slice(0, 4);
  const deadlines = [
    ...tasks.filter((task) => task.status !== 'completed').map((task) => ({ id: 'task-' + task.id, title: task.title, sub: task.subjectName, date: new Date(task.dueAt), kind: 'مهمة' })),
    ...exams.filter((exam) => exam.status !== 'completed').map((exam) => ({ id: 'exam-' + exam.id, title: exam.title, sub: exam.subjectName, date: new Date(exam.date), kind: 'اختبار' })),
  ].filter((item) => !Number.isNaN(item.date.getTime())).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 4);

  return <>
    <section className="welcome-banner">
      <div className="welcome-content">
        <div className="welcome-kicker"><Sparkles size={14}/> مساحة دراستك في مكان واحد</div>
        <h1>أهلاً بعودتك، {userName} <span>👋</span></h1>
        <p>كل ما تضيفه إلى مساحتك الدراسية سيظهر هنا تلقائياً.</p>
        <div className="welcome-actions">
          {canCreateTask && <button className="btn btn-primary" onClick={onNewTask}><Plus size={16}/> أضف مهمة جديدة</button>}
          <button className="btn btn-glass" onClick={() => onGo('planner')}><CalendarDays size={16}/> مخطط المذاكرة</button>
        </div>
      </div>
      <div className="welcome-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-core"><GraduationCap size={43}/></div></div>
      <div className="banner-noise"/>
    </section>

    <div className="section-title-row"><div><div className="eyebrow">نظرة سريعة</div><h2>ملخص مساحتك الدراسية</h2></div><span className="muted-label">الأرقام من بيانات حسابك الفعلية</span></div>
    <div className="stats-grid">
      <StatCard label="المهام المتبقية" value={todo.toString()} meta="مهام غير مكتملة" icon={<ListChecks size={19}/>} tone="violet"/>
      <StatCard label="المهام المكتملة" value={completed.toString()} meta="مهام أنجزتها" icon={<CheckCircle2 size={19}/>} tone="green"/>
      <StatCard label="المحاضرات" value={lectures.length.toString()} meta="محاضرات منشورة" icon={<Video size={19}/>} tone="blue"/>
      <StatCard label="الاختبارات القادمة" value={currentExams.toString()} meta="اختبارات لم تنتهِ بعد" icon={<AlarmClock size={19}/>} tone="amber"/>
    </div>

    <div className="dashboard-grid">
      <section className="panel tasks-panel">
        <div className="panel-head"><div><h3>مهامك</h3><span>المهام المنشورة أو المسندة إليك</span></div><button className="text-link" onClick={() => onGo('tasks')}>كل المهام <ArrowLeft size={15}/></button></div>
        <div className="task-list">{upcomingTasks.map((task) => <TaskRow key={task.id} task={task} onStatus={onStatus}/>)}</div>
        {upcomingTasks.length === 0 && <EmptyState title="لا توجد مهام بعد" body="ستظهر هنا المهام التي يضيفها مدير المنصة."/>}
      </section>
      <section className="panel progress-panel">
        <div className="panel-head"><div><h3>المواد الدراسية</h3><span>المواد التي ينشرها مدير المنصة</span></div><button className="icon-button" onClick={() => onGo('courses')}><MoreHorizontal size={19}/></button></div>
        <div className="subject-progress-list">{subjects.slice(0, 5).map((subject) => <div className="subject-progress" key={subject.id}><div className="subject-mini-icon" style={{ background: subject.color + '18', color: subject.color }}>{subject.icon}</div><div className="subject-progress-main"><div><b>{subject.name}</b><span>{subject.progress}%</span></div><div className="progress-track"><div style={{ width: subject.progress + '%', background: subject.color }}/></div></div></div>)}</div>
        {subjects.length === 0 && <EmptyState title="لم تتم إضافة مواد بعد" body="ستظهر المواد هنا بعد نشرها من لوحة الإدارة."/>}
        <button className="panel-footer-link" onClick={() => onGo('courses')}>عرض المواد <ArrowLeft size={14}/></button>
      </section>
    </div>

    <div className="lower-grid">
      <section className="panel schedule-panel"><div className="panel-head"><div><h3>نشاط المذاكرة</h3><span>سجل جلسات المذاكرة الفعلية</span></div></div><EmptyState title="لا توجد جلسات مسجلة بعد" body="عند توفر سجل جلسات المذاكرة ستظهر إحصائيات النشاط هنا."/></section>
      <section className="panel deadline-panel"><div className="panel-head"><div><h3>المواعيد القادمة</h3><span>المواعيد من مهامك واختباراتك</span></div><button className="icon-button" onClick={() => onGo('planner')}><CalendarDays size={17}/></button></div>
        {deadlines.map((item) => <div className="deadline-item" key={item.id}><div className="date-tile"><b>{item.date.toLocaleDateString('ar-EG', { day: 'numeric' })}</b><span>{item.date.toLocaleDateString('ar-EG', { month: 'short' })}</span></div><div className="deadline-copy"><b>{item.title}</b><span>{item.sub} · {item.kind}</span></div><span className="deadline-pill">{item.date.toLocaleDateString('ar-EG', { weekday: 'short' })}</span></div>)}
        {deadlines.length === 0 && <EmptyState title="لا توجد مواعيد قادمة" body="ستظهر هنا مواعيد المهام والاختبارات المنشورة."/>}
      </section>
    </div>
    <div className="bottom-note"><Sparkles size={15}/><span>ستتحدث هذه المساحة تلقائياً عند إضافة محتوى جديد.</span><span className="note-decoration">ENG HUB · STUDY SMARTER</span></div>
  </>;
}

function StatCard({ label, value, meta, icon, tone, trend }: { label: string; value: string; meta: string; icon: ReactNode; tone: string; trend?: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className={`stat-icon ${tone}`}>{icon}</div></div><div className="stat-value">{value}</div><div className="stat-meta">{meta}</div>{trend ? <div className="stat-trend">{trend}</div> : null}</div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="empty-state"><div className="empty-icon"><Layers3 size={22}/></div><b>{title}</b><span>{body}</span></div>;
}

function TaskRow({ task, onStatus }: { task: StudyTask; onStatus: (id: string, status: TaskStatus) => void }) {
  const [open, setOpen] = useState(false);
  const due = new Date(task.dueAt);
  return <div className="task-row"><div className={`task-subject-dot dot-${task.subjectId}`}/><div className="task-row-copy"><b>{task.title}</b><span>{task.subjectName} <i>•</i> {due.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</span></div><span className={`priority-badge priority-${task.priority}`}>{priorityText[task.priority]}</span><div className="task-status-control"><button className={`status-chip status-${task.status}`} onClick={() => setOpen(!open)}>{statusText[task.status]} <ChevronDown size={12}/></button>{open && <div className="status-menu">{(['not-started', 'in-progress', 'submitted', 'completed'] as TaskStatus[]).map((status) => <button key={status} onClick={() => { onStatus(task.id, status); setOpen(false); }}>{statusText[status]}</button>)}</div>}</div></div>;
}

function TasksPage({ tasks, onNew, onStatus, onDelete, canEdit }: {
  tasks: StudyTask[];
  onNew: () => void;
  onStatus: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
}) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const filtered = tasks.filter((task) => (filter === 'all' || (filter === 'pending' ? task.status !== 'completed' : task.status === filter)) && (task.title + ' ' + task.subjectName).toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHeader eyebrow="TASK MANAGEMENT" title="إدارة المهام" description="المهام التي نشرها مدير المنصة أو أضفتها إلى خطتك." action={canEdit ? <button className="btn btn-primary" onClick={onNew}><Plus size={16}/> إنشاء مهمة</button> : undefined}/>
    <div className="task-overview-strip"><div><b>{tasks.length}</b><span>إجمالي المهام</span></div><div><b>{tasks.filter((t) => t.status === 'completed').length}</b><span>مكتملة</span></div><div><b>{tasks.filter((t) => t.status === 'in-progress').length}</b><span>قيد التنفيذ</span></div><div><b>{tasks.filter((t) => t.status === 'under-review').length}</b><span>قيد المراجعة</span></div><div><b>{tasks.filter((t) => new Date(t.dueAt) < new Date() && t.status !== 'completed').length}</b><span>متأخرة</span></div></div>
    <div className="panel table-panel"><div className="table-toolbar"><div className="filter-tabs">{[{ id: 'all', label: 'الكل' }, { id: 'pending', label: 'غير مكتملة' }, { id: 'completed', label: 'مكتملة' }, { id: 'under-review', label: 'قيد المراجعة' }].map((tab) => <button key={tab.id} className={filter === tab.id ? 'filter-tab active' : 'filter-tab'} onClick={() => setFilter(tab.id)}>{tab.label}</button>)}</div><div className="table-tools"><div className="inline-search"><Search size={15}/><input placeholder="ابحث في المهام" value={query} onChange={(e) => setQuery(e.target.value)}/></div></div></div>
      <div className="tasks-table"><div className="table-head"><span>المهمة</span><span>المادة</span><span>الأولوية</span><span>موعد التسليم</span><span>الحالة</span><span/></div>{filtered.map((task) => <div className="table-row" key={task.id}><div className="table-task"><button type="button" className="task-check" onClick={() => onStatus(task.id, task.status === 'completed' ? 'in-progress' : 'completed')} aria-label="تغيير حالة المهمة"><Check size={13}/></button><div><b>{task.title}</b><span>أُضيفت {new Date(task.createdAt).toLocaleDateString('ar-EG')}</span></div></div><span className="table-secondary">{task.subjectName}</span><span><i className={'priority-dot priority-dot-' + task.priority}/>{priorityText[task.priority]}</span><span className="table-secondary">{new Date(task.dueAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</span><span><span className={'status-chip status-' + task.status}>{statusText[task.status]}</span></span><TaskActionsMenu task={task} onStatus={onStatus} onDelete={onDelete} canEdit={canEdit}/></div>)}{filtered.length === 0 && <EmptyState title={tasks.length === 0 ? 'لا توجد مهام بعد' : 'لا توجد نتائج'} body={tasks.length === 0 ? 'ستظهر هنا المهام التي ينشرها مدير المنصة.' : 'جرّب تغيير عبارة البحث أو الفلتر.'}/>}</div>
      <div className="table-footer"><span>عرض {filtered.length} من {tasks.length} مهمة</span><div><button className="pagination-button" disabled><ChevronRight size={14}/></button><button className="pagination-button active">1</button><button className="pagination-button" disabled><ChevronLeft size={14}/></button></div></div>
    </div>
  </>;
}

function TaskActionsMenu({ task, onStatus, onDelete, canEdit }: {
  task: StudyTask;
  onStatus: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
}) {
  const choose = (action: () => void, event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.closest('details')?.removeAttribute('open');
    action();
  };
  return <details className="task-actions-wrap">
    <summary className="icon-button" aria-label="إجراءات المهمة"><MoreHorizontal size={18}/></summary>
    <div className="task-actions-menu">
      <b>تغيير الحالة</b>
      {(['not-started', 'in-progress', 'submitted', 'completed'] as TaskStatus[]).map((status) => <button type="button" key={status} onClick={(event) => choose(() => onStatus(task.id, status), event)}>{statusText[status]}{task.status === status ? <Check size={13}/> : null}</button>)}
      {canEdit && <><span className="task-menu-divider"/><button type="button" className="danger-action" onClick={(event) => choose(() => onDelete(task.id), event)}><Trash2 size={14}/> حذف المهمة</button></>}
    </div>
  </details>;
}

function CoursesPage({ subjects, onAdd, canEdit, onOpen }: { subjects: Subject[]; onAdd: () => void; canEdit: boolean; onOpen: () => void }) {
  return <>
    <PageHeader eyebrow="ACADEMIC SPACE" title="المواد الدراسية" description="تظهر هنا المقررات التي ينشرها مدير المنصة." action={canEdit ? <button className="btn btn-primary" onClick={onAdd}><Plus size={16}/> إضافة مادة</button> : undefined}/>
    <div className="course-hero panel"><div><div className="eyebrow">CURRENT SEMESTER</div><h2>السنة الإعدادية <span>·</span> الترم الأول</h2><p>ستظهر تفاصيل المقررات والمحاضرات هنا بعد نشرها.</p></div><div className="course-hero-stats"><div><b>{subjects.length}</b><span>مادة منشورة</span></div><div><b>{subjects.reduce((sum, subject) => sum + subject.lectures, 0)}</b><span>محاضرة</span></div></div></div>
    <div className="course-grid">{subjects.map((subject) => <button className="course-card" key={subject.id} onClick={onOpen}><div className="course-card-top"><div className="course-icon" style={{ background: subject.color + '18', color: subject.color }}>{subject.icon}</div><span className="course-code">{subject.code}</span></div><h3>{subject.name}</h3><p>{subject.instructor}</p><div className="course-card-bottom"><div><span>التقدم في المادة</span><b>{subject.progress}%</b></div><div className="progress-track"><div style={{ width: subject.progress + '%', background: subject.color }}/></div><div className="course-meta"><span><Video size={14}/>{subject.lectures} محاضرة</span><span><BookOpen size={14}/>الترم الأول</span></div></div></button>)}</div>
    {subjects.length === 0 && <div className="panel courses-empty-panel"><EmptyState title="لا توجد مواد دراسية بعد" body={canEdit ? 'أضف المواد الدراسية من لوحة الإدارة لتظهر هنا للطلاب.' : 'سيضيف مدير المنصة المقررات الدراسية عند تجهيز محتوى الفصل.'}/>{canEdit && <button className="btn btn-primary" onClick={onAdd}><Plus size={15}/> إضافة أول مادة</button>}</div>}
  </>;
}

function LecturesPage({ lectures, subjects, canEdit, onAdd }: {
  lectures: Lecture[];
  subjects: Subject[];
  canEdit: boolean;
  onAdd: () => void;
}) {
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const filtered = lectures.filter((lecture) => subjectFilter === 'all' || lecture.subjectId === subjectFilter);
  return <>
    <PageHeader eyebrow="LECTURE LIBRARY" title="المحاضرات" description="المحتوى المسجل الذي ينشره مدير المنصة." action={canEdit ? <button className="btn btn-primary" onClick={onAdd}><Plus size={16}/> إضافة محاضرة</button> : undefined}/>
    <div className="filter-tabs lecture-filters"><button className={subjectFilter === 'all' ? 'filter-tab active' : 'filter-tab'} onClick={() => setSubjectFilter('all')}>كل المواد</button>{subjects.map((subject) => <button className={subjectFilter === subject.id ? 'filter-tab active' : 'filter-tab'} key={subject.id} onClick={() => setSubjectFilter(subject.id)}>{subject.name}</button>)}</div>
    <div className="lecture-grid">{filtered.map((lecture, index) => <article className="lecture-card" key={lecture.id}><div className={'lecture-cover cover-' + (index % 4)}><div className="cover-grid"/><span className="lecture-subject-tag">{lecture.subjectName}</span><button className="play-button" onClick={() => setSelectedLecture(lecture)} aria-label={'تشغيل ' + lecture.title}><Play size={23} fill="currentColor"/></button><span className="cover-duration"><Clock3 size={12}/>{lecture.duration}</span></div><div className="lecture-card-body"><div className="lecture-meta"><span>{lecture.instructor}</span><span>{lecture.date}</span></div><h3>{lecture.title}</h3><div className="lecture-progress-head"><span>{lecture.parts} أجزاء · {lecture.progress === 100 ? 'مكتملة' : 'لم تسجل مشاهدة'}</span><b>{lecture.progress}%</b></div><div className="progress-track"><div style={{ width: lecture.progress + '%' }}/></div></div></article>)}</div>
    {filtered.length === 0 && <EmptyState title={lectures.length === 0 ? 'لا توجد محاضرات بعد' : 'لا توجد محاضرات لهذه المادة'} body={lectures.length === 0 ? (canEdit ? 'أضف أول محاضرة من لوحة الإدارة أو من هذا القسم.' : 'سيضيف مدير المنصة المحاضرات هنا عند تجهيز المحتوى.') : 'اختر مادة أخرى لعرض محاضراتها.'}/>}
    {selectedLecture && <div className="video-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedLecture(null); }}>
      <section className="video-modal-card" role="dialog" aria-modal="true" aria-label={selectedLecture.title}>
        <header className="video-modal-header"><div><b>{selectedLecture.title}</b><span>{selectedLecture.subjectName} · {selectedLecture.instructor}</span></div><button type="button" className="icon-button" onClick={() => setSelectedLecture(null)} aria-label="إغلاق المشغل"><X size={20}/></button></header>
        {selectedLecture.videoUrl ? <VideoPlayer source={selectedLecture.videoUrl} title={selectedLecture.title}/> : <div className="video-unavailable"><EmptyState title="لم تتم إضافة رابط الفيديو بعد" body={canEdit ? 'حرر المحاضرة أو أضف رابط الفيديو من لوحة الإدارة.' : 'سيظهر الفيديو هنا بمجرد أن يضيف المدير رابط المحاضرة.'}/></div>}
      </section>
    </div>}
  </>;
}

function VideoPlayer({ source, title }: { source: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [showSpeeds, setShowSpeeds] = useState(false);

  const getEmbedUrl = (value: string) => {
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0];
        return id ? 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&controls=1' : '';
      }
      if (host.endsWith('youtube.com') || host === 'youtube-nocookie.com') {
        const id = url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop();
        return id ? 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&controls=1' : '';
      }
      if (host.endsWith('vimeo.com')) {
        const id = url.pathname.split('/').filter(Boolean).pop();
        return id ? 'https://player.vimeo.com/video/' + id + '?dnt=1' : '';
      }
      return '';
    } catch {
      return '';
    }
  };
  const embedUrl = getEmbedUrl(source);
  const isDirectVideo = !embedUrl && /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(source);
  const time = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '00:00';
    const value = Math.max(0, Math.floor(seconds));
    return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
  };
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try { await video.play(); setPlaying(true); } catch { setPlaying(false); }
    } else {
      video.pause();
      setPlaying(false);
    }
  };
  const seek = (offset: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration || video.duration || 0, video.currentTime + offset));
  };
  const toggleFullscreen = () => {
    const wrapper = videoRef.current?.parentElement;
    if (!wrapper) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapper.requestFullscreen?.();
  };

  if (embedUrl) return <div className="video-player-frame"><iframe src={embedUrl} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div>;
  if (!isDirectVideo) return <div className="video-unavailable"><EmptyState title="صيغة رابط الفيديو غير مدعومة" body="استخدم رابط YouTube أو Vimeo أو رابط MP4 / WEBM / MOV مباشر."/></div>;

  return <div className="video-player-frame native-video-player">
    <video ref={videoRef} src={source} playsInline preload="metadata" onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)} onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}/>
    <div className="video-control-layer">
      <input aria-label="تقدم الفيديو" className="video-progress" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(current, duration || 0)} onChange={(event) => { const next = Number(event.target.value); if (videoRef.current) videoRef.current.currentTime = next; setCurrent(next); }}/>
      <div className="video-controls-row">
        <div className="video-controls-group">
          <button type="button" onClick={() => seek(-10)} title="رجوع 10 ثوانٍ"><ArrowDownLeft size={16}/><small>10</small></button>
          <button type="button" onClick={() => seek(10)} title="تقديم 10 ثوانٍ"><ArrowUpLeft size={16}/><small>10</small></button>
          <button type="button" onClick={() => void togglePlay()} title={playing ? 'إيقاف مؤقت' : 'تشغيل'}>{playing ? <Pause size={18}/> : <Play size={18}/>}</button>
          <button type="button" onClick={() => { const next = !muted; setMuted(next); if (videoRef.current) videoRef.current.muted = next; }} title="كتم الصوت">{muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button>
          <input aria-label="مستوى الصوت" className="video-volume" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={(event) => { const next = Number(event.target.value); setVolume(next); setMuted(next === 0); if (videoRef.current) { videoRef.current.volume = next; videoRef.current.muted = next === 0; } }}/>
        </div>
        <span className="video-clock">{time(current)} / {time(duration)}</span>
        <div className="video-controls-group">
          <div className="video-speed-wrap"><button type="button" onClick={() => setShowSpeeds((value) => !value)}>{speed}x <ChevronDown size={13}/></button>{showSpeeds && <div className="video-speed-menu">{[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => <button type="button" className={speed === value ? 'active' : ''} key={value} onClick={() => { setSpeed(value); setShowSpeeds(false); }}>{value}x</button>)}</div>}</div>
          <button type="button" onClick={toggleFullscreen} title="ملء الشاشة"><Maximize size={17}/></button>
        </div>
      </div>
    </div>
  </div>;
}

function ExamsPage({ exams, setExams, canEdit, onAdd }: {
  exams: Exam[];
  setExams: (fn: (items: Exam[]) => Exam[]) => void;
  canEdit: boolean;
  onAdd: () => void;
}) {
  const upcoming = exams.filter((exam) => exam.status === 'upcoming').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return <>
    <PageHeader eyebrow="ASSESSMENTS" title="الاختبارات والامتحانات" description="مواعيد الاختبارات التي ينشرها مدير المنصة." action={canEdit ? <button className="btn btn-primary" onClick={onAdd}><Plus size={16}/> إضافة اختبار</button> : undefined}/>
    <div className="exam-highlight"><div className="exam-highlight-icon"><AlarmClock size={23}/></div><div><span>الاختبار القادم</span><h2>{upcoming[0]?.title ?? 'لا يوجد اختبار قادم'}</h2><p>{upcoming[0] ? upcoming[0].subjectName + ' · ' + new Date(upcoming[0].date).toLocaleDateString('ar-EG') : 'ستظهر المواعيد هنا عند نشر الاختبارات.'}</p></div><div className="exam-countdown"><b>{upcoming.length}</b><span>اختبارات قادمة</span></div></div>
    <div className="section-title-row exam-list-title"><div><h2>كل الاختبارات</h2><p>الاختبارات المنشورة في حسابك</p></div></div>
    <div className="exam-list">{exams.map((exam) => <div className="exam-row" key={exam.id}><div className={'exam-type-icon ' + exam.status}><ClipboardList size={20}/></div><div className="exam-row-copy"><b>{exam.title}</b><span>{exam.subjectName} <i>•</i> {exam.questions} سؤال <i>•</i> {exam.duration}</span></div><div className="exam-date"><b>{new Date(exam.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</b><span>{new Date(exam.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span></div><span className={'exam-status ' + exam.status}>{exam.status === 'upcoming' ? 'قادم' : exam.status === 'available' ? 'متاح الآن' : 'مكتمل'}</span></div>)}</div>
    {exams.length === 0 && <EmptyState title="لا توجد اختبارات بعد" body={canEdit ? 'انشر أول اختبار من زر إضافة اختبار.' : 'سيضيف مدير المنصة مواعيد الاختبارات هنا.'}/>}
  </>;
}

function FilesPage({ files, onUpload, cloudinaryReady, isDemo }: { files: LibraryFile[]; onUpload: (file: File) => Promise<void>; cloudinaryReady: boolean; isDemo: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const filtered = files.filter((file) => file.name.toLowerCase().includes(query.toLowerCase()) || file.subjectName.toLowerCase().includes(query.toLowerCase()));
  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try { await onUpload(file); } finally { setUploading(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  return <>
    <PageHeader eyebrow="RESOURCE CENTER" title="مكتبة الملفات" description="الملفات التي ترفعها أو ينشرها مدير المنصة." action={<><input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.zip,.png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm" className="visually-hidden" onChange={(event) => void handleFile(event.target.files?.[0])}/><button className="btn btn-primary" onClick={() => inputRef.current?.click()} disabled={uploading || (!isDemo && !cloudinaryReady)}>{uploading ? <span className="spinner"/> : <Upload size={16}/>} رفع ملف</button></>}/>
    <div className="file-storage-banner"><div className="storage-icon"><CloudUpload size={23}/></div><div><b>{files.length} ملف</b><span>{isDemo ? 'وضع تجريبي — لن يتم حفظ الملفات على الخادم.' : cloudinaryReady ? 'تُرفع الملفات إلى Cloudinary وتُحفظ روابطها وبياناتها في Firestore.' : 'Cloudinary غير مهيأ. افتح إعدادات Cloudinary في لوحة الإدارة قبل رفع الملفات.'}</span></div></div>
    <div className="panel file-panel"><div className="file-toolbar"><div className="file-count-label">{files.length} ملف</div><div className="inline-search"><Search size={15}/><input placeholder="ابحث عن ملف..." value={query} onChange={(event) => setQuery(event.target.value)}/></div></div>
      <div className="file-grid">{filtered.map((file) => <div className="file-card" key={file.id}><div className={'file-type-icon type-' + file.type.toLowerCase()}>{file.type === 'IMAGE' ? <FileImage size={22}/> : file.type === 'VIDEO' ? <Video size={22}/> : <FileText size={22}/>}<span>{file.type}</span></div><div className="file-card-copy"><b>{file.name}</b><span>{file.subjectName}</span><small>{file.size} <i>•</i> {file.updatedAt}</small></div><button className="icon-button" onClick={() => file.url ? window.open(file.url, '_blank', 'noopener,noreferrer') : undefined} aria-label="فتح الملف"><Download size={16}/></button></div>)}</div>
      {filtered.length === 0 && <EmptyState title={files.length === 0 ? 'لا توجد ملفات بعد' : 'لا توجد نتائج مطابقة'} body={files.length === 0 ? 'ستظهر الملفات هنا بعد رفعها إلى مكتبة المنصة.' : 'جرّب تغيير كلمة البحث.'}/>}
    </div>
  </>;
}

function ChatPage({ user, cloudinarySettings, isDemo, isAdmin }: {
  user: AppUser;
  cloudinarySettings: CloudinarySettings;
  isDemo: boolean;
  isAdmin: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDemo) {
      setLoading(false);
      setError('الدردشة المشتركة تحتاج إلى الاتصال بقاعدة Firebase.');
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const start = async () => {
      setLoading(true);
      setError('');
      try {
        await joinGeneralChat({ uid: user.uid, displayName: user.displayName, photoURL: user.photoURL });
        if (cancelled) return;
        unsubscribe = subscribeGeneralChat(setMessages, (reason) => setError(reason.message));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'تعذر فتح المحادثة العامة.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void start();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user.uid, user.displayName, user.photoURL, isDemo]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const visibleMessages = messages.filter((message) =>
    (message.text + ' ' + message.senderName + ' ' + message.attachments.map((item) => item.name).join(' '))
      .toLowerCase().includes(search.trim().toLowerCase()),
  );

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if ((!draft.trim() && files.length === 0) || sending) return;
    setSending(true);
    setError('');
    try {
      const attachments: ChatAttachment[] = [];
      for (const file of files) {
        const url = await uploadFile(file, cloudinarySettings);
        attachments.push({ name: file.name, url, mimeType: file.type || 'application/octet-stream', size: file.size });
      }
      await sendGeneralChatMessage({
        text: draft,
        senderId: user.uid,
        senderName: user.displayName,
        senderPhotoURL: user.photoURL,
        attachments,
        replyTo: replyTo ? {
          id: replyTo.id,
          text: replyTo.text || (replyTo.attachments[0]?.name ?? 'مرفق'),
          senderName: replyTo.senderName,
        } : null,
      });
      setDraft('');
      setFiles([]);
      setReplyTo(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر إرسال الرسالة.');
    } finally {
      setSending(false);
    }
  };

  const removeMessage = async (messageId: string) => {
    try {
      await deleteGeneralChatMessage(messageId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر حذف الرسالة.');
    }
  };

  const clearRoom = async () => {
    if (!isAdmin || !window.confirm('سيتم حذف جميع رسائل المحادثة العامة. هل تريد المتابعة؟')) return;
    try {
      const { deleteGeneralChatRoomMessages } = await import('../lib/chat');
      await deleteGeneralChatRoomMessages();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تفريغ المحادثة.');
    }
  };

  return <>
    <PageHeader eyebrow="STUDY TOGETHER" title="المحادثات" description="تواصل مع زملائك في مساحة مشتركة، وأرسل الرسائل والمرفقات الدراسية."/>
    <div className="chat-layout panel chat-layout-live">
      <aside className="chat-list">
        <div className="chat-list-header"><b>المحادثات</b><span className="chat-room-count">غرفة واحدة</span></div>
        <div className="chat-search"><Search size={15}/><input placeholder="ابحث في الرسائل" value={search} onChange={(event) => setSearch(event.target.value)}/></div>
        <div className="chat-contact active">
          <div className="avatar avatar-cyan"><MessageCircle size={17}/></div>
          <div><b>المحادثة العامة</b><span>غرفة طلاب ENG HUB</span></div>
          <span className="live-dot"/>
        </div>
        <div className="chat-list-note"><Users size={15}/><span>كل مستخدم مسجل في المنصة يستطيع الانضمام إلى هذه الغرفة.</span></div>
      </aside>
      <section className="chat-conversation chat-conversation-live">
        <div className="chat-top">
          <div className="avatar avatar-cyan"><MessageCircle size={17}/></div>
          <div className="chat-top-copy"><b>المحادثة العامة</b><span><i className="live-dot"/> رسائل مباشرة عبر Firestore</span></div>
          {isAdmin && <button className="btn btn-outline btn-small" type="button" onClick={() => void clearRoom()}><Trash2 size={14}/> تفريغ المحادثة</button>}
        </div>
        <div className="chat-messages chat-messages-live" aria-live="polite">
          {loading && <EmptyState title="جاري فتح المحادثة" body="يتم الاتصال بغرفة الدردشة المشتركة."/>}
          {!loading && visibleMessages.length === 0 && <EmptyState title={messages.length === 0 ? 'لا توجد رسائل بعد' : 'لا توجد نتائج مطابقة'} body={messages.length === 0 ? 'ابدأ المحادثة بإرسال أول رسالة إلى زملائك.' : 'جرّب كلمة بحث أخرى.'}/>}
          {visibleMessages.map((message) => {
            const mine = message.senderId === user.uid;
            return <article className={'chat-msg ' + (mine ? 'sent' : 'received')} key={message.id}>
              <div className="msg-header">
                <span className="chat-sender">{mine ? 'أنت' : message.senderName}</span>
                <time className="msg-time">{message.createdAt ? message.createdAt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'الآن'}</time>
              </div>
              {message.replyTo && <div className="reply-block"><span className="ru">{message.replyTo.senderName}</span><span className="rt">{message.replyTo.text}</span></div>}
              {message.text && <p className="chat-message-text">{message.text}</p>}
              {message.attachments.length > 0 && <div className="chat-attachments">
                {message.attachments.map((attachment, index) => attachment.mimeType.startsWith('image/')
                  ? <a href={attachment.url} target="_blank" rel="noreferrer" className="chat-image-attachment" key={attachment.url + index}><img src={attachment.url} alt={attachment.name}/><span>{attachment.name}</span></a>
                  : <a href={attachment.url} target="_blank" rel="noreferrer" className="chat-file-attachment" key={attachment.url + index}><FileText size={18}/><span><b>{attachment.name}</b><small>{(attachment.size / 1024 / 1024).toFixed(1)} MB</small></span><Download size={15}/></a>)}
              </div>}
              <div className="msg-actions">
                <button type="button" onClick={() => setReplyTo(message)} title="الرد على الرسالة"><ArrowDownLeft size={14}/> رد</button>
                {mine && <button type="button" onClick={() => void removeMessage(message.id)} title="حذف الرسالة"><Trash2 size={14}/> حذف</button>}
              </div>
            </article>;
          })}
          <div ref={bottomRef}/>
        </div>
        {error && <div className="chat-error" role="alert"><AlertCircle size={14}/>{error}</div>}
        <form className="chat-composer chat-composer-live" onSubmit={send}>
          {replyTo && <div className="reply-indicator active"><div className="ri-text"><strong>الرد على {replyTo.senderName}</strong><span>{replyTo.text || replyTo.attachments[0]?.name || 'مرفق'}</span></div><button type="button" className="ri-close" onClick={() => setReplyTo(null)} aria-label="إلغاء الرد"><X size={15}/></button></div>}
          {files.length > 0 && <div className="chat-selected-files">{files.map((file, index) => <span key={file.name + index}><Paperclip size={13}/>{file.name}<button type="button" onClick={() => setFiles((all) => all.filter((_, i) => i !== index))} aria-label="إزالة المرفق"><X size={12}/></button></span>)}</div>}
          <button type="button" className="icon-button chat-attach-button" onClick={() => fileInput.current?.click()} aria-label="إرفاق ملف"><Paperclip size={18}/></button>
          <input ref={fileInput} type="file" multiple accept="image/*,video/mp4,video/webm,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt" className="visually-hidden" onChange={(event) => setFiles((all) => [...all, ...Array.from(event.target.files ?? [])])}/>
          <textarea rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="اكتب رسالتك هنا..." aria-label="نص الرسالة" onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(event as unknown as FormEvent); } }}/>
          <button type="submit" className="send-button" aria-label="إرسال الرسالة" disabled={sending || (!draft.trim() && files.length === 0)}>{sending ? <span className="spinner"/> : <Send size={17}/>}</button>
        </form>
      </section>
    </div>
  </>;
}

function PlannerPage({ tasks }: { tasks: StudyTask[] }) {
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((value) => {
      if (value <= 1) { setRunning(false); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const switchMode = (next: 'focus' | 'break') => {
    setMode(next);
    setSeconds(next === 'focus' ? 25 * 60 : 5 * 60);
    setRunning(false);
  };
  const timeLabel = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  const upcoming = tasks.filter((task) => task.status !== 'completed').sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  return <>
    <PageHeader eyebrow="PLAN YOUR DAY" title="مخطط المذاكرة" description="استخدم المؤقت لتنظيم وقت التركيز، وتابع مواعيد مهامك الفعلية."/>
    <div className="planner-grid">
      <section className="panel pomodoro-panel">
        <div className="panel-head"><div><h3>مؤقت التركيز</h3><span>تقنية بومودورو — ركز ثم استرح</span></div><div className="pomodoro-spark"><Sparkles size={17}/></div></div>
        <div className="pomodoro-tabs"><button className={mode === 'focus' ? 'active' : ''} onClick={() => switchMode('focus')}>وقت التركيز</button><button className={mode === 'break' ? 'active' : ''} onClick={() => switchMode('break')}>استراحة قصيرة</button></div>
        <div className="timer-ring"><div className="timer-inner"><span>{mode === 'focus' ? 'FOCUS SESSION' : 'SHORT BREAK'}</span><b>{timeLabel}</b><small>{running ? 'المؤقت يعمل' : 'جاهز للبدء'}</small></div></div>
        <button className="btn btn-primary timer-action" onClick={() => { if (seconds === 0) setSeconds(mode === 'focus' ? 25 * 60 : 5 * 60); setRunning(!running); }}>{running ? 'إيقاف مؤقت' : seconds === 0 ? 'ابدأ من جديد' : 'ابدأ التركيز'} <Play size={15}/></button>
      </section>
      <section className="panel today-plan">
        <div className="panel-head"><div><h3>المهام المرتبطة بموعد</h3><span>{new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div><button className="icon-button"><CalendarDays size={17}/></button></div>
        {upcoming.length ? <div className="timeline">{upcoming.slice(0, 8).map((task) => <div className="timeline-row" key={task.id}><time>{new Date(task.dueAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</time><i/><div><b>{task.title}</b><span>{task.subjectName} · {new Date(task.dueAt).toLocaleDateString('ar-EG')}</span></div><span className={'priority-badge priority-' + task.priority}>{priorityText[task.priority]}</span></div>)}</div> : <EmptyState title="لا توجد مهام في خطتك بعد" body="ستظهر هنا المهام المنشورة التي لم تنتهِ بعد."/>}
      </section>
    </div>
  </>;
}

function AnalyticsPage({ tasks, subjects, lectures }: { tasks: StudyTask[]; subjects: Subject[]; lectures: Lecture[] }) {
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const completion = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const inProgress = tasks.filter((task) => task.status === 'in-progress').length;
  const notStarted = tasks.filter((task) => task.status === 'not-started').length;
  return <>
    <PageHeader eyebrow="YOUR PERFORMANCE" title="إحصائياتك الدراسية" description="تعرض هذه الصفحة أرقاماً مستندة إلى نشاطك المسجل فقط."/>
    <div className="analytics-summary">
      <div className="analytics-score"><div className="score-ring"><div><b>{completion}%</b><span>إنجاز المهام</span></div></div><div><div className="eyebrow">YOUR PRODUCTIVITY</div><h2>ملخص تقدمك</h2><p>{tasks.length ? 'يتم حساب النسبة من المهام المسجلة في حسابك.' : 'ستظهر المؤشرات عند إضافة المهام والمحتوى الدراسي.'}</p></div></div>
      <div className="analytics-kpis">
        <div><span>ساعات المذاكرة</span><b>—</b><i>لا توجد جلسات مسجلة</i></div>
        <div><span>محاضرات مكتملة</span><b>{lectures.filter((lecture) => lecture.progress === 100).length}</b><i>من أصل {lectures.length}</i></div>
        <div><span>المهام المكتملة</span><b>{completed}</b><i>من أصل {tasks.length}</i></div>
      </div>
    </div>
    <div className="analytics-grid">
      <section className="panel"><div className="panel-head"><div><h3>تقدمك حسب المادة</h3><span>نسبة استكمال المحتوى المنشور</span></div></div>
        <div className="analytics-subjects">{subjects.map((subject) => <div key={subject.id}><span className="analytics-subject-name"><i style={{ background: subject.color }}/>{subject.name}</span><div className="progress-track"><div style={{ width: subject.progress + '%', background: subject.color }}/></div><b>{subject.progress}%</b></div>)}
        {subjects.length === 0 && <EmptyState title="لا توجد مواد لتحليلها" body="ستظهر إحصائيات المواد بعد إضافتها من لوحة الإدارة."/>}</div>
      </section>
      <section className="panel"><div className="panel-head"><div><h3>إنجاز المهام</h3><span>توزيع الحالات الحالية</span></div></div>
        {tasks.length ? <div className="task-donut-wrap"><div className="task-donut"><div><b>{tasks.length}</b><span>مهمة</span></div></div><div className="donut-legend"><span><i className="legend-green"/> مكتملة <b>{completed}</b></span><span><i className="legend-purple"/> قيد التنفيذ <b>{inProgress}</b></span><span><i className="legend-gray"/> لم تبدأ <b>{notStarted}</b></span></div></div> : <EmptyState title="لا توجد مهام لتحليلها" body="ستظهر الإحصائيات بعد نشر المهام وتحديث حالتها."/>}
      </section>
    </div>
  </>;
}

function NotificationsPage({ items, setItems }: { items: AppNotification[]; setItems: (fn: (items: AppNotification[]) => AppNotification[]) => void }) {
  return <><PageHeader eyebrow="UPDATES" title="الإشعارات" description="آخر التحديثات والتنبيهات الخاصة بموادك ومهامك." action={<button className="btn btn-outline" onClick={() => setItems((all) => all.map((item) => ({ ...item, read: true })))}><Check size={15}/> تحديد الكل كمقروء</button>}/><div className="panel notifications-panel">{items.map((item) => { const Icon = iconForKind[item.kind]; return <div className={`notification-row ${item.read ? '' : 'unread'}`} key={item.id}><div className={`notification-kind kind-${item.kind}`}><Icon size={18}/></div><div><b>{item.title}</b><p>{item.body}</p><span>{item.time}</span></div><div className="notification-actions">{!item.read && <i/>}<button className="icon-button" onClick={() => setItems((all) => all.map((n) => n.id === item.id ? { ...n, read: !n.read } : n))}>{item.read ? <Check size={15}/> : <MoreHorizontal size={18}/>}</button></div></div>; })}{items.length === 0 && <EmptyState title="لا توجد إشعارات" body="ستظهر هنا التحديثات الجديدة."/>}</div></>;
}

function AdminPage({ tasks, subjects, lectures, exams, files, currentUser, cloudinarySettings, onNewTask, onAddSubject, onAddLecture, onAddExam, onSaved, onError }: {
  tasks: StudyTask[];
  subjects: Subject[];
  lectures: Lecture[];
  exams: Exam[];
  files: LibraryFile[];
  currentUser: AppUser;
  cloudinarySettings: CloudinarySettings;
  onNewTask: () => void;
  onAddSubject: () => void;
  onAddLecture: () => void;
  onAddExam: () => void;
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

  return <>
    <PageHeader eyebrow="MANAGEMENT CENTER" title="لوحة إدارة المنصة" description="انشر المحتوى الأكاديمي واضبط خدمات المنصة من مكان واحد." action={<span className="admin-status"><i/> وضع الإدارة</span>}/>
    <div className="admin-tabs">{[{ id: 'overview', label: 'نظرة عامة' }, { id: 'academic', label: 'المحتوى الأكاديمي' }, { id: 'tasks', label: 'إدارة المهام' }, { id: 'users', label: 'المستخدمون والصلاحيات' }, { id: 'cloudinary', label: 'إعدادات Cloudinary' }].map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={tab === item.id ? 'active' : ''}>{item.label}</button>)}</div>
    {tab === 'overview' && <>
      <div className="admin-stats">
        <StatCard label="المواد الدراسية" value={subjects.length.toString()} meta="مواد منشورة" icon={<BookOpen size={18}/>} tone="blue"/>
        <StatCard label="المهام" value={tasks.length.toString()} meta="مهام مسجلة" icon={<ListChecks size={18}/>} tone="green"/>
        <StatCard label="المحاضرات" value={lectures.length.toString()} meta="محاضرات منشورة" icon={<Video size={18}/>} tone="violet"/>
        <StatCard label="الاختبارات" value={exams.length.toString()} meta="اختبارات منشورة" icon={<ClipboardList size={18}/>} tone="amber"/>
      </div>
      <div className="admin-quick-grid">
        <button onClick={onAddSubject}><div><BookOpen size={19}/></div><b>إضافة مادة</b><span>إنشاء مقرر دراسي</span></button>
        <button onClick={onNewTask}><div><ListChecks size={19}/></div><b>إنشاء مهمة</b><span>نشر تكليف للطلاب</span></button>
        <button onClick={onAddLecture}><div><Video size={19}/></div><b>إضافة محاضرة</b><span>رابط فيديو من YouTube أو Vimeo أو ملف فيديو</span></button>
        <button onClick={onAddExam}><div><ClipboardList size={19}/></div><b>إضافة اختبار</b><span>حدد المادة والموعد والمدة</span></button>
      </div>
      <div className="panel admin-content-list admin-storage-summary"><div className="panel-head"><div><h3>حالة المكتبة</h3><span>أرقام فعلية من المحتوى المسجل</span></div></div><div className="admin-summary-numbers"><div><b>{files.length}</b><span>ملف</span></div><div><b>{subjects.reduce((sum, subject) => sum + subject.lectures, 0)}</b><span>عدد المحاضرات المرتبطة بالمواد</span></div></div></div>
    </>}
    {tab === 'academic' && <>
      <div className="panel admin-content-list">
        <div className="panel-head"><div><h3>المواد الدراسية</h3><span>الترم الأول — أضف المواد الفعلية للطلاب</span></div><button className="btn btn-primary btn-small" onClick={onAddSubject}><Plus size={14}/> إضافة مادة</button></div>
        {subjects.map((subject) => <div className="admin-list-row" key={subject.id}><div className="subject-mini-icon" style={{ background: subject.color + '18', color: subject.color }}>{subject.icon}</div><div><b>{subject.name}</b><span>{subject.code} · {subject.instructor}</span></div><span>{subject.lectures} محاضرة</span><span className="status-chip status-completed">منشورة</span></div>)}
        {subjects.length === 0 && <EmptyState title="لا توجد مواد بعد" body="ابدأ بإضافة أول مادة دراسية."/ >}
      </div>
      <div className="panel admin-content-list">
        <div className="panel-head"><div><h3>المحاضرات</h3><span>أضف روابط الفيديو داخل المقررات</span></div><button className="btn btn-primary btn-small" onClick={onAddLecture} disabled={subjects.length === 0}><Plus size={14}/> إضافة محاضرة</button></div>
        {lectures.map((lecture) => <div className="admin-list-row" key={lecture.id}><div className="admin-task-symbol"><Video size={17}/></div><div><b>{lecture.title}</b><span>{lecture.subjectName} · {lecture.instructor}</span></div><span>{lecture.duration}</span><a className="admin-external-link" href={lecture.videoUrl} target="_blank" rel="noreferrer">فتح الرابط</a></div>)}
        {lectures.length === 0 && <EmptyState title="لا توجد محاضرات بعد" body="أضف محاضرة واربطها برابط فيديو."/ >}
      </div>
      <div className="panel admin-content-list">
        <div className="panel-head"><div><h3>الاختبارات</h3><span>أضف مواعيد التقييمات والامتحانات</span></div><button className="btn btn-primary btn-small" onClick={onAddExam}><Plus size={14}/> إضافة اختبار</button></div>
        {exams.map((exam) => <div className="admin-list-row" key={exam.id}><div className="admin-task-symbol"><ClipboardList size={17}/></div><div><b>{exam.title}</b><span>{exam.subjectName}</span></div><span>{new Date(exam.date).toLocaleString('ar-EG')}</span><span>{exam.duration}</span></div>)}
        {exams.length === 0 && <EmptyState title="لا توجد اختبارات بعد" body="أضف الاختبار القادم ليظهر للطلاب."/ >}
      </div>
    </>}
    {tab === 'tasks' && <div className="panel admin-content-list">
      <div className="panel-head"><div><h3>المهام المنشورة</h3><span>راجع المهام المسجلة حالياً</span></div><button className="btn btn-primary btn-small" onClick={onNewTask} disabled={subjects.length === 0}><Plus size={14}/> مهمة جديدة</button></div>
      {tasks.map((task) => <div className="admin-list-row" key={task.id}><div className="admin-task-symbol"><ClipboardList size={17}/></div><div><b>{task.title}</b><span>{task.subjectName}</span></div><span className={'priority-badge priority-' + task.priority}>{priorityText[task.priority]}</span><span className={'status-chip status-' + task.status}>{statusText[task.status]}</span></div>)}
      {tasks.length === 0 && <EmptyState title="لا توجد مهام بعد" body="أنشئ المهام بعد إضافة المواد الدراسية."/ >}
    </div>}
    {tab === 'users' && <div className="panel users-placeholder">
      <Users size={32}/><h3>إدارة حسابات المديرين</h3>
      <p>يتم منح صلاحية الإدارة من Firebase Console، وليس من ملف الطالب. أنشئ حساب المستخدم أولاً في Authentication، ثم أضف مستنداً في مجموعة <b dir="ltr">admins</b> يكون معرّفه هو بريده الإلكتروني المطابق تماماً.</p>
      <div className="admin-permission-example"><b>أول مدير أعلى</b><code dir="ltr">admins/your-email@example.com</code><pre>{JSON.stringify({ email: 'your-email@example.com', role: 'super-admin', active: true }, null, 2)}</pre><span>استبدل البريد التجريبي ببريدك الفعلي، واجعل active من النوع Boolean.</span></div>
      <p>لمدير عادي استخدم <code>role: "admin"</code>. لتعطيل مدير استخدم <code>active: false</code>. بعد ذلك سجّل الخروج والدخول مجدداً.</p>
      <a className="admin-external-link" href="https://console.firebase.google.com/project/eng-hub-5c30a/firestore" target="_blank" rel="noreferrer">فتح Firestore Console</a>
      <span className="admin-status"><i/> تُقرأ الصلاحيات من Firestore مع قواعد حماية تمنع المستخدم من ترقية نفسه.</span>
    </div>}
    {tab === 'cloudinary' && <form className="panel admin-content-list form-stack" onSubmit={(event) => void saveCloudinary(event)}>
      <div className="panel-head"><div><h3>ربط Cloudinary</h3><span>تُرفع الملفات والصور والفيديوهات إلى Cloudinary، ويحتفظ Firestore بالروابط والبيانات الوصفية.</span></div><span className={'connection-state ' + (isCloudinaryConfigured(cloudinarySettings) ? '' : 'demo')}><i/>{isCloudinaryConfigured(cloudinarySettings) ? 'متصل' : 'غير مهيأ'}</span></div>
      <label>Cloud Name<input dir="ltr" autoComplete="off" value={cloudName} onChange={(event) => setCloudName(event.target.value)} placeholder="your-cloud-name"/></label>
      <label>Unsigned Upload Preset<input dir="ltr" autoComplete="off" value={uploadPreset} onChange={(event) => setUploadPreset(event.target.value)} placeholder="eng_hub_unsigned"/></label>
      <div className="setting-row"><div><b>تفعيل الرفع</b><span>عند إيقافه لن يتم رفع الملفات من المنصة.</span></div><button type="button" className={'toggle-switch ' + (enabled ? 'on' : '')} onClick={() => setEnabled((value) => !value)} aria-pressed={enabled}><i/></button></div>
      <div className="admin-cloudinary-limits"><label>حد الصورة (MB)<input type="number" min="1" max="100" value={maxImageMB} onChange={(event) => setMaxImageMB(event.target.value)}/></label><label>حد الفيديو (MB)<input type="number" min="1" max="500" value={maxVideoMB} onChange={(event) => setMaxVideoMB(event.target.value)}/></label><label>حد المستند (MB)<input type="number" min="1" max="100" value={maxDocumentMB} onChange={(event) => setMaxDocumentMB(event.target.value)}/></label></div>
      <div className="inline-info"><AlertCircle size={16}/> استخدم Unsigned Upload Preset مقيّداً بالأنواع والأحجام والمجلد من لوحة Cloudinary. لا تضع API Secret هنا ولا في الموقع.</div>
      <p className="settings-hint">الصيغ المدعومة: PDF وDOC/DOCX وPPT/PPTX وXLS/XLSX وCSV وTXT وZIP والصور والفيديو.</p>
      <div><button className="btn btn-primary" type="submit" disabled={savingCloudinary}>{savingCloudinary ? <span className="spinner"/> : <Check size={15}/>} حفظ إعدادات Cloudinary</button></div>
    </form>}
  </>;
}

function ProfilePage({ user, isDemo, onToggleRole, onLogout, onDeleteAccount, onSaveProfile, themePreference, onThemeChange, cloudinarySettings, dark }: {
  user: AppUser;
  isDemo: boolean;
  onToggleRole: () => void;
  onLogout: () => Promise<void>;
  onDeleteAccount: (password?: string) => Promise<void>;
  onSaveProfile: (profile: { displayName: string; photoURL?: string | null; phone?: string; bio?: string }) => Promise<void>;
  themePreference: 'system' | 'light' | 'dark';
  onThemeChange: (preference: 'system' | 'light' | 'dark') => void;
  cloudinarySettings: CloudinarySettings;
  onToggleTheme: () => void;
  dark: boolean;
}) {
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [pushGranted, setPushGranted] = useState(() =>
    typeof Notification !== 'undefined' && Notification.permission === 'granted',
  );
  const [name, setName] = useState(user.displayName);
  const [phone, setPhone] = useState(user.phone || '');
  const [bio, setBio] = useState(user.bio || '');
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(user.displayName);
    setPhone(user.phone || '');
    setBio(user.bio || '');
    setPhotoURL(user.photoURL || '');
  }, [user.displayName, user.phone, user.bio, user.photoURL]);

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

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage('');
    try {
      const nextPhoto = photoFile ? await uploadFile(photoFile, cloudinarySettings) : photoURL;
      await onSaveProfile({ displayName: name, photoURL: nextPhoto || null, phone, bio });
      setPhotoFile(null);
      setPhotoURL(nextPhoto || '');
      setProfileMessage('تم حفظ بيانات الملف الشخصي.');
    } catch (reason) {
      setProfileMessage(reason instanceof Error ? reason.message : 'تعذر حفظ بيانات الملف الشخصي.');
    } finally {
      setSavingProfile(false);
    }
  };

  const confirmDelete = async (event: FormEvent) => {
    event.preventDefault();
    setDeleting(true);
    setDeleteError('');
    try {
      await onDeleteAccount(deletePassword || undefined);
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : 'تعذر حذف الحساب.');
    } finally {
      setDeleting(false);
    }
  };

  return <>
    <PageHeader eyebrow="ACCOUNT SETTINGS" title="الملف الشخصي والإعدادات" description="حدّث بياناتك، واختر مظهر المنصة، وتحكم في حسابك."/>
    <div className="profile-layout">
      <section className="panel profile-card">
        <div className="profile-cover"/>
        <div className="profile-details">
          <div className="profile-avatar-large">{photoFile ? photoFile.name.slice(0, 1).toUpperCase() : photoURL ? <img src={photoURL} alt={user.displayName}/> : user.displayName.slice(0, 1)}</div>
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
        <form className="settings-section profile-edit-form" onSubmit={(event) => void saveProfile(event)}>
          <h3>بيانات الملف الشخصي</h3>
          <div className="profile-edit-photo">
            <div className="avatar avatar-purple">{photoFile ? photoFile.name.slice(0, 1).toUpperCase() : photoURL ? <img src={photoURL} alt=""/> : name.slice(0, 1)}</div>
            <div><b>الصورة الشخصية</b><span>ارفع صورة جديدة من جهازك</span></div>
            <label className="btn btn-outline btn-small"><ImagePlus size={14}/> تغيير الصورة<input type="file" accept="image/*" className="visually-hidden" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}/></label>
          </div>
          <label>الاسم الظاهر<input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)}/></label>
          <label>رقم الهاتف أو واتساب<input type="tel" maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+20 1xxxxxxxxx" dir="ltr"/></label>
          <label>نبذة عنك<textarea rows={3} maxLength={240} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="نبذة قصيرة عنك..."/></label>
          {profileMessage && <p className="settings-hint" role="status">{profileMessage}</p>}
          <button className="btn btn-primary btn-small" type="submit" disabled={savingProfile || name.trim().length < 2}>{savingProfile ? <span className="spinner"/> : <Check size={14}/>} حفظ بيانات الملف</button>
        </form>
        <div className="settings-section">
          <h3>المظهر</h3>
          <div className="theme-choice-group" role="group" aria-label="تفضيل المظهر">
            <button type="button" className={themePreference === 'system' ? 'selected' : ''} onClick={() => onThemeChange('system')} aria-pressed={themePreference === 'system'}><Monitor size={17}/><span>حسب الجهاز</span></button>
            <button type="button" className={themePreference === 'light' ? 'selected' : ''} onClick={() => onThemeChange('light')} aria-pressed={themePreference === 'light'}><Sun size={17}/><span>فاتح</span></button>
            <button type="button" className={themePreference === 'dark' ? 'selected' : ''} onClick={() => onThemeChange('dark')} aria-pressed={themePreference === 'dark'}><Moon size={17}/><span>داكن</span></button>
          </div>
          <p className="settings-hint">{themePreference === 'system' ? 'يتغير المظهر تلقائياً حسب إعدادات جهازك.' : themePreference === 'light' ? 'المظهر الفاتح مفعل.' : 'المظهر الداكن مفعل.'}</p>
        </div>
        <div className="settings-section">
          <h3>الإشعارات</h3>
          <div className="setting-row">
            <div className="setting-icon"><Bell size={18}/></div>
            <div><b>إشعارات المتصفح</b><span>{isDemo ? 'تفعيلها متاح بعد ربط Firebase بالموقع.' : pushGranted ? 'إذن الإشعارات ممنوح لهذا المتصفح.' : 'اسمح للموقع بإرسال تنبيهات المنصة.'}</span></div>
            <button className="btn btn-outline btn-small" onClick={() => void activatePush()} disabled={isDemo || pushBusy}>{pushBusy ? <span className="spinner"/> : null}{pushGranted ? 'تحديث التسجيل' : 'تفعيل الإشعارات'}</button>
          </div>
          {pushMessage && <p className="settings-hint" role="status">{pushMessage}</p>}
        </div>
        <div className="settings-section">
          <h3>الحساب</h3>
          <div className="setting-row">
            <div className="setting-icon"><ShieldCheck size={18}/></div>
            <div><b>حالة الاتصال</b><span>{isDemo ? 'وضع تجريبي — لا يوجد اتصال بقاعدة البيانات' : 'متصل بخدمات Firebase'}</span></div>
            <span className={'connection-state ' + (isDemo ? 'demo' : '')}><i/>{isDemo ? 'Demo' : 'Online'}</span>
          </div>
          {isDemo && <div className="setting-row"><div className="setting-icon"><Users size={18}/></div><div><b>تجربة صلاحيات المدير</b><span>للعرض التجريبي فقط</span></div><button className="btn btn-outline btn-small" onClick={onToggleRole}>تبديل الدور</button></div>}
        </div>
        <div className="settings-section">
          <h3>الجلسة</h3>
          <div className="setting-row">
            <div className="setting-icon"><LogOut size={18}/></div>
            <div><b>تسجيل الخروج</b><span>إنهاء جلستك الحالية</span></div>
            <button className="btn btn-outline btn-small" onClick={() => void onLogout()}>تسجيل الخروج</button>
          </div>
        </div>
        <div className="settings-section danger-zone">
          <h3>منطقة الخطر</h3>
          <div className="setting-row">
            <div className="setting-icon danger-setting"><Trash2 size={18}/></div>
            <div><b>حذف الحساب نهائياً</b><span>حذف حساب Firebase وملفك والبيانات الشخصية القابلة للحذف.</span></div>
            <button className="btn btn-danger btn-small" onClick={() => { setShowDelete(true); setDeleteError(''); }}>حذف الحساب</button>
          </div>
          <p className="settings-hint">{isDemo ? 'حذف الحساب متاح للحسابات المسجلة في Firebase فقط.' : 'لن تُحذف ملفات Cloudinary الثنائية تلقائياً من المتصفح؛ ستُزال بيانات ربطها بحسابك من Firestore. احتفظ بنسخة من ملفاتك قبل المتابعة.'}</p>
        </div>
      </section>
    </div>
    {showDelete && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDelete(false); }}>
      <section className="modal-card delete-account-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
        <div className="modal-head"><div><h2 id="delete-account-title">تأكيد حذف الحساب</h2><p>هذا الإجراء نهائي ولا يمكن التراجع عنه.</p></div><button className="icon-button" type="button" onClick={() => setShowDelete(false)} aria-label="إغلاق"><X size={18}/></button></div>
        <form className="form-stack" onSubmit={(event) => void confirmDelete(event)}>
          <div className="delete-warning"><AlertCircle size={18}/><span>سيتم حذف حساب تسجيل الدخول وملف المستخدم والبيانات الشخصية المرتبطة به من Firestore.</span></div>
          {!isDemo && user.providerId === 'password' && <label>أدخل كلمة المرور لتأكيد هويتك<input type="password" required autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)}/></label>}
          {user.role === 'admin' || user.role === 'super-admin' ? <p className="auth-error">لا يمكن حذف حساب مدير ما دامت له صلاحية إدارة. عطّل سجله في admins من Firebase Console أولاً ثم سجّل الدخول مجدداً.</p> : null}
          {deleteError && <p className="auth-error">{deleteError}</p>}
          <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setShowDelete(false)}>إلغاء</button><button type="submit" className="btn btn-danger" disabled={deleting || isDemo || user.role === 'admin' || user.role === 'super-admin'}>{deleting ? <span className="spinner"/> : <Trash2 size={15}/>} حذف الحساب نهائياً</button></div>
        </form>
      </section>
    </div>}
  </>;
}

function TaskModal({ subjects, userId, onClose, onSave }: {
  subjects: Subject[];
  userId: string;
  onClose: () => void;
  onSave: (data: Omit<StudyTask, 'id' | 'createdAt' | 'createdBy'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [priority, setPriority] = useState<Priority>('normal');
  const [dueAt, setDueAt] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    date.setHours(23, 59, 0, 0);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const subject = subjects.find((item) => item.id === subjectId);
    onSave({
      title: title.trim(),
      description: description.trim(),
      subjectId,
      subjectName: subject?.name ?? 'بدون مادة',
      priority,
      status: 'not-started',
      dueAt: new Date(dueAt).toISOString(),
      assignedTo: userId ? [userId] : [],
    });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <div className="modal-head">
          <div><h2 id="task-modal-title">إنشاء مهمة جديدة</h2><p>أدخل تفاصيل المهمة وموعد التسليم.</p></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={18}/></button>
        </div>
        {subjects.length === 0 && <div className="inline-info"><AlertCircle size={16}/> أضف مادة دراسية أولاً من لوحة الإدارة قبل إنشاء مهمة مرتبطة بها.</div>}
        <form className="form-stack" onSubmit={submit}>
          <label>عنوان المهمة
            <input required maxLength={120} autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: حل ورقة التمارين رقم 04"/>
          </label>
          <label>الوصف والتعليمات
            <textarea rows={3} maxLength={1200} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="اكتب تفاصيل المهمة أو ملاحظات التسليم..."/>
          </label>
          <div className="form-row">
            <label>المادة الدراسية
              <select required value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                {subjects.length === 0 && <option value="">لا توجد مواد بعد</option>}
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </label>
            <label>الأولوية
              <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                <option value="low">منخفضة</option>
                <option value="normal">عادية</option>
                <option value="high">عالية</option>
                <option value="urgent">عاجلة</option>
              </select>
            </label>
          </div>
          <label>موعد التسليم
            <input required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} min={new Date().toISOString().slice(0, 16)}/>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>إلغاء</button>
            <button type="submit" className="btn btn-primary" disabled={!title.trim() || !subjectId}><Plus size={15}/> إنشاء المهمة</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function LectureModal({ subjects, onClose, onSave }: {
  subjects: Subject[];
  onClose: () => void;
  onSave: (data: { title: string; subjectId: string; subjectName: string; instructor: string; duration: string; videoUrl: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [instructor, setInstructor] = useState('');
  const [duration, setDuration] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const subject = subjects.find((item) => item.id === subjectId);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!subject) return;
    onSave({ title: title.trim(), subjectId, subjectName: subject.name, instructor: instructor.trim(), duration: duration.trim(), videoUrl: videoUrl.trim() });
  };

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="lecture-modal-title">
      <div className="modal-head"><div><h2 id="lecture-modal-title">إضافة محاضرة</h2><p>أدخل بيانات المحاضرة ورابط الفيديو المراد عرضه.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={18}/></button></div>
      {subjects.length === 0 ? <EmptyState title="أضف مادة أولاً" body="يجب إنشاء مادة دراسية قبل إضافة محاضرات إليها."/> : <form className="form-stack" onSubmit={submit}>
        <label>عنوان المحاضرة<input autoFocus required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عنوان المحاضرة"/></label>
        <label>المادة الدراسية<select required value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="form-row"><label>المحاضر<input required value={instructor} maxLength={100} onChange={(event) => setInstructor(event.target.value)} placeholder="اسم المحاضر"/></label><label>المدة<input required value={duration} maxLength={40} onChange={(event) => setDuration(event.target.value)} placeholder="مثال: 45 دقيقة"/></label></div>
        <label>رابط الفيديو<input required type="url" dir="ltr" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="YouTube / Vimeo / MP4 URL"/></label>
        <p className="settings-hint">يدعم المشغل روابط YouTube وVimeo وروابط MP4 أو WEBM أو MOV المباشرة.</p>
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose}>إلغاء</button><button type="submit" className="btn btn-primary" disabled={!title.trim() || !subject || !instructor.trim() || !duration.trim() || !videoUrl.trim()}><Plus size={15}/> نشر المحاضرة</button></div>
      </form>}
    </section>
  </div>;
}

function ExamModal({ subjects, onClose, onSave }: {
  subjects: Subject[];
  onClose: () => void;
  onSave: (data: { title: string; subjectName: string; date: string; duration: string; questions: number }) => void;
}) {
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState('');
  const [questions, setQuestions] = useState('10');
  const subject = subjects.find((item) => item.id === subjectId);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({ title: title.trim(), subjectName: subject?.name || 'عام', date: new Date(date).toISOString(), duration: duration.trim(), questions: Math.max(1, Number(questions) || 1) });
  };

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="exam-modal-title">
      <div className="modal-head"><div><h2 id="exam-modal-title">إضافة اختبار</h2><p>حدد المادة وموعد الاختبار والوقت المخصص له.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={18}/></button></div>
      <form className="form-stack" onSubmit={submit}>
        <label>عنوان الاختبار<input autoFocus required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="اسم الاختبار"/></label>
        <label>المادة الدراسية<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">اختبار عام</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>موعد الاختبار<input required type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} min={new Date().toISOString().slice(0, 16)}/></label>
        <div className="form-row"><label>المدة<input required value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="مثال: 60 دقيقة"/></label><label>عدد الأسئلة<input required type="number" min="1" max="500" value={questions} onChange={(event) => setQuestions(event.target.value)}/></label></div>
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose}>إلغاء</button><button type="submit" className="btn btn-primary" disabled={!title.trim() || !date || !duration.trim()}><Plus size={15}/> نشر الاختبار</button></div>
      </form>
    </section>
  </div>;
}

function SubjectModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (data: Omit<Subject, 'id' | 'lectures' | 'progress'>) => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [instructor, setInstructor] = useState('');
  const [icon, setIcon] = useState('∫');
  const [color, setColor] = useState('#8b7cff');
  const colors = ['#8b7cff', '#41c8ad', '#f0ad62', '#5d9eff', '#ec82ad', '#9aabbd', '#d1a25b'];

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({ name: name.trim(), code: code.trim().toUpperCase(), instructor: instructor.trim(), icon: icon.trim() || '✳', color });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="subject-modal-title">
        <div className="modal-head">
          <div><h2 id="subject-modal-title">إضافة مادة دراسية</h2><p>أضف بيانات المقرر ليظهر في مساحة الدراسة.</p></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={18}/></button>
        </div>
        <form className="form-stack" onSubmit={submit}>
          <label>اسم المادة
            <input required maxLength={100} autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: Calculus 1"/>
          </label>
          <div className="form-row">
            <label>كود المادة
              <input required maxLength={20} value={code} onChange={(event) => setCode(event.target.value)} placeholder="MTH 101" dir="ltr"/>
            </label>
            <label>المحاضر أو المعيد
              <input required maxLength={100} value={instructor} onChange={(event) => setInstructor(event.target.value)} placeholder="اسم المحاضر"/>
            </label>
          </div>
          <div className="form-row">
            <label>رمز المادة
              <input value={icon} onChange={(event) => setIcon(event.target.value)} maxLength={4} placeholder="∫"/>
            </label>
            <label>لون المادة
              <span className="color-picker"><div>{colors.map((item) => <button key={item} type="button" className={color === item ? 'selected' : ''} style={{ background: item }} onClick={() => setColor(item)} aria-label={`اختيار اللون ${item}`} aria-pressed={color === item}/>)}</div></span>
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>إلغاء</button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim() || !code.trim() || !instructor.trim()}><Plus size={15}/> إضافة المادة</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default App;
