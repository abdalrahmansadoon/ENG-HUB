import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type MouseEvent } from 'react';
import {
  Activity, AlarmClock, AlertCircle, ArrowDownLeft, ArrowLeft, ArrowUpLeft, Bell, BookOpen, EyeOff,
  BookOpenCheck, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  CircleHelp, Clock3, CloudUpload, Code2, Command, Download, File, FileImage, FileText,
  Filter, FolderOpen, GraduationCap, Grid2X2, Headphones, Home, Layers3, Link2, Lock, LogOut, Menu,
  MessageCircle, Megaphone, MoreHorizontal, Paperclip, Pause, Play, Plus, Search, Send, Settings, ShieldCheck,
  SlidersHorizontal, Sparkles, Sun, Moon, Target, Timer, TrendingUp, Upload, Users,
  Video, X, Zap, ClipboardList, CalendarClock, BookMarked, ListChecks, ChartNoAxesCombined,
  ImagePlus, Volume2, VolumeX, Maximize, Trash2, Pencil, Monitor, Smartphone, Unlock,
  Copy, Pin, Smile, CheckCheck, Flag, Minus, Info, RotateCcw,
} from 'lucide-react';
import { useAuth, registerAccount } from './AuthContext';
import { defaultCloudinarySettings, isCloudinaryConfigured, saveCloudinarySettings, subscribeCloudinarySettings, type CloudinarySettings } from '../lib/cloudinary';
import { uploadFile } from '../lib/uploads';
import { enablePushNotifications, listenForForegroundMessages } from '../lib/messaging';
import { isFirebaseConfigured } from '../lib/firebase';
import { readLocal, writeLocal } from '../lib/storage';
import { createExamCloud, createLectureCloud, createLecturePartCloud, createLecturerCloud, createSubjectCloud, createTaskCloud, deleteTaskCloud, saveFileMetadataCloud, subscribeExams, subscribeFiles, subscribeLectureParts, subscribeLecturers, subscribeLectures, subscribeSubjects, subscribeTasks, updateTaskStatusCloud, subscribeAcademicCalendar, saveAcademicCalendar, defaultAcademicCalendar, type AcademicCalendarSettings } from '../lib/cloudData';
import type { AppNotification, AppUser, Exam, Lecture, LecturePart, Lecturer, LibraryFile, Priority, StudyTask, Subject, TaskStatus } from '../types';
import { AppShell } from './layout/AppShell';
import { ChatPage } from './chat/ChatPage';
import { readEngHubRoute, buildEngHubHash, type SubjectCategory } from '../lib/routes';
import { subscribeAcademicContent, createAcademicContentNode, updateAcademicContentNode, deleteAcademicContentNode, subscribeCompletedAcademicContent } from '../lib/academicContent';
import { AcademicContentArea } from './academic/AcademicContentArea';
import { PublicStudentProfilePage } from './profile/PublicStudentProfilePage';
import type { AcademicContentCategory, AcademicContentNode, CreateAcademicContentInput } from '../types/academicContent';

const navGroups = [
  { title: 'مساحة الدراسة', items: [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'tasks', label: 'المهام', icon: ListChecks },
    { id: 'courses', label: 'المواد الدراسية', icon: BookOpen },
  ] },
  { title: 'التواصل والتنظيم', items: [
    { id: 'chat', label: 'المحادثات', icon: MessageCircle },
    { id: 'focus', label: 'مساحة التركيز', icon: Timer },
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
  const isAdmin = activeUser.role === 'admin' || activeUser.role === 'super-admin';
  const initialRoute = readEngHubRoute();
  const [page, setPage] = useState(initialRoute.page);
  const [publicProfileUid, setPublicProfileUid] = useState(initialRoute.profileUid);
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState('');
  const [themePreference, setThemePreference] = useState<'system' | 'light' | 'dark'>(() => readLocal<'system' | 'light' | 'dark'>('themePreference', 'system'));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  const dark = themePreference === 'system' ? systemDark : themePreference === 'dark';
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lectures, setCloudLectures] = useState<Lecture[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(initialRoute.subjectId);
  const [selectedSubjectCategory, setSelectedSubjectCategory] = useState<SubjectCategory | ''>(initialRoute.category);
  const [selectedContentNodeId, setSelectedContentNodeId] = useState(initialRoute.contentNodeId || initialRoute.lectureId || initialRoute.lecturerId);
  const [selectedLecturerId, setSelectedLecturerId] = useState(initialRoute.lecturerId);
  const [selectedLectureId, setSelectedLectureId] = useState(initialRoute.lectureId);
  const [academicContent, setAcademicContent] = useState<AcademicContentNode[]>([]);
  const [lectureParts, setLectureParts] = useState<LecturePart[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [cloudinarySettings, setCloudinarySettings] = useState<CloudinarySettings>(defaultCloudinarySettings);
  const [academicCalendar, setAcademicCalendar] = useState<AcademicCalendarSettings>(defaultAcademicCalendar);
  const [completedVideoIds, setCompletedVideoIds] = useState<Set<string>>(new Set());
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
  useEffect(() => {
    if (!user || isDemo) { setAcademicCalendar(defaultAcademicCalendar); return; }
    return subscribeAcademicCalendar(setAcademicCalendar, (error) => setToast(`تعذر قراءة إعدادات السنة الدراسية: ${error.message}`));
  }, [user?.uid, isDemo]);
  useEffect(() => {
    if (!user || isDemo) { setCompletedVideoIds(new Set()); return; }
    return subscribeCompletedAcademicContent(activeUser.uid, setCompletedVideoIds, (error) => setToast(`تعذر مزامنة تقدم الفيديوهات: ${error.message}`));
  }, [user?.uid, isDemo, activeUser.uid]);
  useEffect(() => writeLocal('notifications', notifications), [notifications]);
  useEffect(() => { document.title = `${pageTitle(page)} | ENG HUB`; }, [page]);
  useEffect(() => {
    const applyLocation = () => {
      const route = readEngHubRoute();
      setPage(route.page);
      setPublicProfileUid(route.profileUid);
      setSelectedSubjectId(route.subjectId);
      setSelectedSubjectCategory(route.category);
      setSelectedContentNodeId(route.contentNodeId);
      setSelectedLecturerId(route.lecturerId);
      setSelectedLectureId(route.lectureId);
      setMobileNav(false);
    };
    window.addEventListener('popstate', applyLocation);
    window.addEventListener('hashchange', applyLocation);
    return () => {
      window.removeEventListener('popstate', applyLocation);
      window.removeEventListener('hashchange', applyLocation);
    };
  }, []);

  useEffect(() => {
    const nextHash = buildEngHubHash({
      page,
      subjectId: selectedSubjectId,
      category: selectedSubjectCategory,
      lecturerId: selectedLecturerId,
      lectureId: selectedLectureId,
      contentNodeId: selectedContentNodeId,
      profileUid: publicProfileUid,
    });
    if (window.location.hash !== nextHash) {
      window.history.pushState({ engHubRoute: true }, '', `${window.location.pathname}${window.location.search}${nextHash}`);
    }
  }, [page, selectedSubjectId, selectedSubjectCategory, selectedLecturerId, selectedLectureId, selectedContentNodeId, publicProfileUid]);

  useEffect(() => {
    if (!user || isDemo || !selectedSubjectId) {
      setAcademicContent([]);
      return;
    }
    return subscribeAcademicContent(selectedSubjectId, isAdmin, setAcademicContent, (error) => {
      setToast(`تعذر تحميل بنية المادة: ${error.message}`);
    });
  }, [user?.uid, isDemo, selectedSubjectId, isAdmin]);

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
  const academicContentWithLegacy = useMemo<AcademicContentNode[]>(() => {
    const combined = [...academicContent];
    const existing = new Set(combined.map((node) => node.id));
    const subject = subjects.find((item) => item.id === selectedSubjectId);
    const belongsToSubject = (name: string) => Boolean(subject && name.trim().toLocaleLowerCase() === subject.name.trim().toLocaleLowerCase());
    lecturers.filter((item) => item.subjectId === selectedSubjectId && item.status === 'active').forEach((item) => {
      if (existing.has(item.id)) return;
      combined.push({
        id: item.id, subjectId: item.subjectId, parentId: null, kind: 'lecturer', category: 'lectures',
        title: item.name, description: item.bio || item.description || 'مدرس أو معيد بالمقرر',
        linkedNodeIds: [], publicationStatus: 'published', sortOrder: 0, createdBy: 'legacy',
        createdAt: null, updatedAt: null,
      });
      existing.add(item.id);
    });
    lectures.filter((item) => item.subjectId === selectedSubjectId).forEach((item) => {
      if (existing.has(item.id)) return;
      combined.push({
        id: item.id, subjectId: item.subjectId, parentId: item.lecturerId || null, kind: 'lecture', category: 'lectures',
        title: item.title, description: item.description || item.lecturerName || '',
        ...(item.videoUrl ? { url: item.videoUrl } : {}),
        duration: item.duration || '', linkedNodeIds: [], publicationStatus: 'published',
        sortOrder: Number(item.lectureNumber || 0), createdBy: 'legacy', createdAt: null, updatedAt: null,
      });
      existing.add(item.id);
    });
    lectureParts.filter((item) => item.lectureId === selectedLectureId).forEach((item) => {
      if (existing.has(item.id)) return;
      combined.push({
        id: item.id, subjectId: selectedSubjectId, parentId: item.lectureId, kind: 'video', category: 'lectures',
        title: item.title, description: '', url: item.videoUrl, duration: item.duration || '',
        linkedNodeIds: [], publicationStatus: 'published', sortOrder: item.order || 0,
        createdBy: 'legacy', createdAt: null, updatedAt: null,
      });
      existing.add(item.id);
    });
    files.filter((item) => belongsToSubject(item.subjectName)).forEach((item) => {
      const id = 'legacy-file-' + item.id;
      if (existing.has(id)) return;
      const extension = item.name.split('.').pop()?.toLowerCase() || '';
      const mimeType = extension === 'pdf' ? 'application/pdf'
        : ['jpg','jpeg','png','webp','gif'].includes(extension) ? 'image/' + (extension === 'jpg' ? 'jpeg' : extension)
        : ['mp4','webm','mov'].includes(extension) ? 'video/' + extension
        : 'application/octet-stream';
      combined.push({
        id, subjectId: selectedSubjectId, parentId: null, kind: 'file', category: 'files',
        title: item.name, description: item.size + ' · ' + item.updatedAt,
        url: item.url, mimeType, linkedNodeIds: [], publicationStatus: 'published',
        sortOrder: 0, createdBy: 'legacy', createdAt: null, updatedAt: null,
      });
      existing.add(id);
    });
    exams.filter((item) => belongsToSubject(item.subjectName)).forEach((item) => {
      const id = 'legacy-exam-' + item.id;
      if (existing.has(id)) return;
      combined.push({
        id, subjectId: selectedSubjectId, parentId: null, kind: 'exam', category: 'exams',
        title: item.title,
        description: `موعد الاختبار: ${new Date(item.date).toLocaleString('ar-EG')} · المدة: ${item.duration} · عدد الأسئلة: ${item.questions} · الحالة: ${item.status}`,
        linkedNodeIds: [], publicationStatus: 'published', sortOrder: new Date(item.date).getTime() || 0,
        createdBy: 'legacy', createdAt: null, updatedAt: null,
      });
      existing.add(id);
    });
    tasks.filter((item) => item.subjectId === selectedSubjectId).forEach((item) => {
      const id = 'legacy-task-' + item.id;
      if (existing.has(id)) return;
      combined.push({
        id, subjectId: selectedSubjectId, parentId: null, kind: 'assignment', category: 'assignments',
        title: item.title,
        description: [item.description, 'موعد التسليم: ' + new Date(item.dueAt).toLocaleString('ar-EG'), 'الحالة: ' + item.status].filter(Boolean).join(' · '),
        linkedNodeIds: [], publicationStatus: 'published', sortOrder: new Date(item.dueAt).getTime() || 0,
        createdBy: 'legacy', createdAt: null, updatedAt: null,
      });
      existing.add(id);
    });
    return combined;
  }, [academicContent, lecturers, lectures, lectureParts, files, exams, tasks, subjects, selectedSubjectId, selectedLectureId]);
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

  const addLecture = async (data: { title: string; description?: string; lecturerId?: string; duration?: string }) => {
    const lecturer = data.lecturerId ? lecturers.find((item) => item.id === data.lecturerId) : undefined;
    const subject = subjects.find((item) => item.id === selectedSubjectId);
    const subjectId = lecturer?.subjectId || subject?.id;
    const subjectName = lecturer?.subjectName || subject?.name;
    if (!subjectId || !subjectName) {
      setToast('اختر المادة التي ستُضاف إليها المحاضرة أولاً.');
      return;
    }
    try {
      await createLectureCloud({
        ...data,
        lecturerId: lecturer?.id ?? '',
        lecturerName: lecturer?.name ?? '',
        subjectId,
        subjectName,
      });
      setLectureModal(false);
      setSelectedSubjectId(subjectId);
      setSelectedSubjectCategory('lectures');
      setSelectedLecturerId(lecturer?.id ?? '');
      setSelectedLectureId('');
      setToast(lecturer ? 'تم إنشاء المحاضرة للمدرس المحدد.' : 'تم إنشاء المحاضرة مباشرة داخل المادة دون ربطها بمدرس.');
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


  const addAcademicContent = async (input: CreateAcademicContentInput) => {
    if (!selectedSubjectId) throw new Error('اختر المادة قبل إضافة المحتوى.');
    if (isDemo) {
      const next: AcademicContentNode = {
        id: crypto.randomUUID(), subjectId: selectedSubjectId, parentId: input.parentId ?? null,
        kind: input.kind, category: input.category, title: input.title.trim(), description: input.description ?? '',
        url: input.url, mimeType: input.mimeType, duration: input.duration, linkedNodeIds: input.linkedNodeIds ?? [],
        customTypeName: input.customTypeName, customTypeIcon: input.customTypeIcon, customTypeColor: input.customTypeColor,
        canContainChildren: input.canContainChildren,
        publicationStatus: input.publicationStatus ?? 'published', sortOrder: input.sortOrder ?? Date.now(),
        createdBy: activeUser.uid, createdAt: new Date(), updatedAt: new Date(),
      };
      setAcademicContent((items) => [...items, next]);
      return;
    }
    await createAcademicContentNode(selectedSubjectId, activeUser.uid, input);
    setToast('تم حفظ المحتوى داخل المادة.');
  };

  const updateAcademicContent = async (nodeId: string, patch: Partial<CreateAcademicContentInput>) => {
    if (!selectedSubjectId) throw new Error('اختر المادة قبل تعديل المحتوى.');
    if (isDemo) {
      setAcademicContent((items) => items.map((node) => node.id === nodeId ? {
        ...node,
        ...patch,
        title: patch.title?.trim() ?? node.title,
        linkedNodeIds: patch.linkedNodeIds ? [...new Set(patch.linkedNodeIds)] : node.linkedNodeIds,
        updatedAt: new Date(),
      } : node));
      return;
    }
    await updateAcademicContentNode(selectedSubjectId, nodeId, patch);
    setToast('تم تحديث العنصر وروابطه داخل المادة.');
  };

  const removeAcademicContent = async (node: AcademicContentNode) => {
    if (!selectedSubjectId) return;
    if (isDemo) {
      const removeIds = new Set<string>([node.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const item of academicContent) {
          if (item.parentId && removeIds.has(item.parentId) && !removeIds.has(item.id)) {
            removeIds.add(item.id); changed = true;
          }
        }
      }
      setAcademicContent((items) => items.filter((item) => !removeIds.has(item.id)));
      setSelectedContentNodeId('');
      return;
    }
    const deleted = await deleteAcademicContentNode(selectedSubjectId, node.id);
    setSelectedContentNodeId('');
    setToast(`تم حذف العنصر و${Math.max(0, deleted - 1)} من العناصر التابعة له.`);
  };

  const uploadAcademicAsset = async (file: File) => {
    if (isDemo || !isCloudinaryConfigured(cloudinarySettings)) {
      throw new Error('رفع الملفات يحتاج إلى ربط Cloudinary في لوحة الإدارة.');
    }
    const url = await uploadFile(file, cloudinarySettings);
    return { url, mimeType: file.type || 'application/octet-stream' };
  };

  const changeAcademicRoute = (category: SubjectCategory, nodeId?: string) => {
    const matchingLecture = nodeId ? lectures.find((item) => item.id === nodeId) : undefined;
    const matchingPart = nodeId ? lectureParts.find((item) => item.id === nodeId) : undefined;
    setSelectedSubjectCategory(category);
    setSelectedContentNodeId(nodeId || '');
    setSelectedLecturerId(nodeId && lecturers.some((item) => item.id === nodeId) ? nodeId : '');
    setSelectedLectureId(matchingLecture?.id || matchingPart?.lectureId || (category !== 'lectures' ? selectedLectureId : ''));
    setPage(category === 'chat' ? 'chat' : 'courses');
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
    if (!isAdmin) { setToast('رفع الملفات متاح للإدارة فقط.'); return; }
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

  if (loading) return <div className="boot-screen"><div className="brand-mark"><img src={`${import.meta.env.BASE_URL}brand/enghub-mark.svg`} alt="ENG HUB"/></div><span>جاري تجهيز ENG HUB...</span></div>;
  const themeClass = dark ? 'theme-dark' : 'theme-light';
  if (!user) return <AuthScreen themeClass={themeClass} onLogin={login} onGoogle={loginWithGoogle} />;
  if (!profileComplete) return <ProfileCompletionScreen themeClass={themeClass} user={user} cloudinarySettings={defaultCloudinarySettings} onComplete={completeProfile} />;

  if (page === 'chat') return (
    <div className={`eh-app ${dark ? 'eh-dark theme-dark' : 'eh-light theme-light'} eh-focus-chat`} dir="rtl">
      <ChatPage user={activeUser} cloudinarySettings={cloudinarySettings} isDemo={isDemo} isAdmin={isAdmin}
        roomId={selectedSubjectId ? `course_${selectedSubjectId}` : 'general'}
        roomTitle={selectedSubjectId ? `مناقشات ${subjects.find((item) => item.id === selectedSubjectId)?.name ?? 'المادة'}` : 'المحادثة العامة'}
        courseId={selectedSubjectId || undefined}
        onBack={() => { setPage('home'); setSelectedSubjectId(''); setSelectedSubjectCategory(''); setSelectedContentNodeId(''); }}
        onOpenProfile={(uid) => { setPublicProfileUid(uid); setPage('student-profile'); }} />
    </div>
  );

  return (
    <AppShell
      user={{ ...activeUser, academicYear: academicCalendar.activeYear, term: academicCalendar.activeTerm }}
      page={page}
      pageTitle={page === 'chat' && selectedSubjectId ? `مناقشات ${subjects.find((item) => item.id === selectedSubjectId)?.name ?? 'المادة'}` : pageTitle(page)}
      navGroups={navGroups}
      isAdmin={isAdmin}
      dark={dark}
      search={search}
      searchResults={quickResults}
      unreadCount={unreadCount}
      mobileNav={mobileNav}
      onSearch={setSearch}
      onNavigate={(target) => {
        if (target === 'chat' || target === 'courses') {
          setSelectedSubjectId('');
          setSelectedSubjectCategory('');
          setSelectedContentNodeId('');
          setSelectedLecturerId('');
          setSelectedLectureId('');
        }
        setPage(target); setMobileNav(false);
      }}
      onToggleTheme={() => setThemePreference(dark ? 'light' : 'dark')}
      onOpenMobileNav={() => setMobileNav(true)}
      onCloseMobileNav={() => setMobileNav(false)}
    >
      <div className={`eh-page-view ${page === 'chat' ? 'eh-chat-page' : ''}`}>
        {page === 'home' && <Dashboard userName={activeUser.displayName} tasks={tasks} subjects={subjects} exams={exams} lectures={lectures} onGo={setPage} onNewTask={() => setTaskModal(true)} onStatus={changeTaskStatus} canCreateTask={isAdmin}/>}
        {page === 'tasks' && <TasksPage tasks={tasks} onNew={() => setTaskModal(true)} onStatus={changeTaskStatus} onDelete={(id) => void removeTask(id)} canEdit={isAdmin}/>}
        {(page === 'courses' || page === 'lectures') && selectedSubjectId && selectedSubjectCategory && selectedSubjectCategory !== 'chat' && subjects.find((item) => item.id === selectedSubjectId) && <AcademicContentArea
          subject={subjects.find((item) => item.id === selectedSubjectId)!}
          currentUserId={activeUser.uid}
          nodes={academicContentWithLegacy}
          category={selectedSubjectCategory as AcademicContentCategory}
          activeNodeId={selectedContentNodeId || selectedLectureId || selectedLecturerId}
          isAdmin={isAdmin}
          onNavigate={(category, nodeId) => changeAcademicRoute(category, nodeId)}
          onBackToSubject={() => {
            setSelectedSubjectCategory('');
            setSelectedContentNodeId('');
            setSelectedLecturerId('');
            setSelectedLectureId('');
            setPage('courses');
          }}
          onCreate={addAcademicContent}
          onDelete={removeAcademicContent}
          onUpdate={updateAcademicContent}
          onUpload={uploadAcademicAsset}
        />}
        {(page === 'courses' || page === 'lectures') && (!selectedSubjectId || !selectedSubjectCategory) && <AcademicHubPage
          subjects={subjects} lecturers={lecturers} lectures={lectures} parts={lectureParts} files={files} exams={exams} tasks={tasks} contentNodes={academicContentWithLegacy}
          selectedSubjectId={selectedSubjectId} selectedLecturerId={selectedLecturerId} selectedLectureId={selectedLectureId}
          subjectCategory={selectedSubjectCategory}
          canEdit={isAdmin}
          onSelectSubject={(id) => { setSelectedSubjectId(id); setSelectedSubjectCategory(''); setSelectedContentNodeId(''); setSelectedLecturerId(''); setSelectedLectureId(''); }}
          onSelectCategory={(category) => changeAcademicRoute(category)}
          onSelectLecturer={(id) => { setSelectedSubjectCategory('lectures'); setSelectedLecturerId(id); setSelectedLectureId(''); }}
          onSelectLecture={setSelectedLectureId}
          onBack={() => {
            if (selectedLectureId) setSelectedLectureId('');
            else if (selectedLecturerId) setSelectedLecturerId('');
            else if (selectedSubjectCategory) { setSelectedSubjectCategory(''); setSelectedContentNodeId(''); }
            else setSelectedSubjectId('');
          }}
          onAddSubject={() => setSubjectModal(true)}
          onAddLecturer={() => setLecturerModal(true)}
          onAddLecture={() => setLectureModal(true)}
          onAddPart={() => setLecturePartModal(true)}
        />}
        {page === 'exams' && <ExamsPage exams={exams} setExams={setExams} canEdit={isAdmin} onAdd={() => setExamModal(true)}/>}
        {page === 'files' && <FilesPage files={files} onUpload={addFile} cloudinaryReady={isCloudinaryConfigured(cloudinarySettings)} isDemo={isDemo} canUpload={isAdmin}/>}
                {page === 'chat' && <ChatPage
          user={activeUser}
          cloudinarySettings={cloudinarySettings}
          isDemo={isDemo}
          isAdmin={isAdmin}
          roomId={selectedSubjectId ? `course_${selectedSubjectId}` : 'general'}
          roomTitle={selectedSubjectId ? `مناقشات ${subjects.find((item) => item.id === selectedSubjectId)?.name ?? 'المادة'}` : 'المحادثة العامة'}
          courseId={selectedSubjectId || undefined}
          onBack={() => {
            if (selectedSubjectId) { setPage('courses'); setSelectedSubjectCategory(''); setSelectedContentNodeId(''); }
            else setPage('home');
          }}
          onOpenProfile={(uid) => { setPublicProfileUid(uid); setPage('student-profile'); }}
        />}
        {page === 'student-profile' && <PublicStudentProfilePage uid={publicProfileUid} currentUid={activeUser.uid} onBack={() => setPage('chat')}/>}
        {page === 'planner' && <PlannerPage tasks={tasks} userId={activeUser.uid}/>}
        {page === 'focus' && <FocusModePage userId={activeUser.uid}/>}
        {page === 'analytics' && <AnalyticsPage tasks={tasks} subjects={subjects} lectures={lectures} exams={exams} completedVideos={completedVideoIds.size}/>}
        {page === 'notifications' && <NotificationsPage items={notifications} setItems={setNotifications}/>}
        {page === 'admin' && <AdminPage tasks={tasks} subjects={subjects} lecturers={lecturers} lectures={lectures} exams={exams} files={files} currentUser={activeUser} cloudinarySettings={cloudinarySettings} academicCalendar={academicCalendar} onSaveAcademicCalendar={async (settings) => { await saveAcademicCalendar(settings, activeUser.uid); setAcademicCalendar(settings); setToast('تم حفظ السنة والفصل الدراسي الحاليين لجميع الطلاب.'); }} onNewTask={() => setTaskModal(true)} onAddSubject={() => setSubjectModal(true)} onAddLecturer={() => { setPage('courses'); setSelectedSubjectId(''); setSelectedLecturerId(''); setSelectedLectureId(''); }} onAddLecture={() => setLectureModal(true)} onAddExam={() => setExamModal(true)} onSaved={() => setToast('تم حفظ إعدادات Cloudinary في Firestore')} onError={(message) => setToast(message)}/>}
        {page === 'profile' && <ProfilePage user={activeUser} isDemo={isDemo} onToggleRole={toggleDemoRole} onLogout={logout} onDeleteAccount={deleteAccount} onSaveProfile={saveProfile} themePreference={themePreference} onThemeChange={setThemePreference} cloudinarySettings={cloudinarySettings} onToggleTheme={() => setThemePreference(dark ? 'light' : 'dark')} dark={dark}/>}
      </div>
      {taskModal && <TaskModal subjects={subjects} userId={activeUser.uid} onClose={() => setTaskModal(false)} onSave={addTask}/>}
      {subjectModal && <SubjectModal onClose={() => setSubjectModal(false)} onSave={addSubject}/>}
      {lecturerModal && <LecturerModal subject={subjects.find((item) => item.id === selectedSubjectId) ?? null} onClose={() => setLecturerModal(false)} onSave={addLecturer}/>}
      {lectureModal && <LectureModal lecturers={lecturers} selectedLecturerId={selectedLecturerId} onClose={() => setLectureModal(false)} onSave={addLecture}/>}
      {lecturePartModal && <LecturePartModal nextOrder={lectureParts.length + 1} onClose={() => setLecturePartModal(false)} onSave={addLecturePart}/>}
      {examModal && <ExamModal subjects={subjects} onClose={() => setExamModal(false)} onSave={addExam}/>}
      {toast && <div className="eh-toast"><CheckCircle2 size={17}/>{toast}</div>}
    </AppShell>
  );
}

function AuthScreen({ onLogin, onGoogle, themeClass }: { onLogin: (email: string, password: string, name?: string) => Promise<void>; onGoogle: () => Promise<void>; themeClass: 'theme-dark' | 'theme-light' }) {
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
  return <div className={'auth-screen ' + themeClass} dir="rtl"><div className="auth-visual"><div className="auth-brand"><div className="brand-mark"><img src={`${import.meta.env.BASE_URL}brand/enghub-mark.svg`} alt="ENG HUB"/></div><div><b>ENG HUB</b><span>CAIRO UNIVERSITY · FACULTY OF ENGINEERING</span></div></div><div className="auth-visual-copy"><div className="eyebrow">YOUR ENGINEERING JOURNEY</div><h1>كل أدوات دراستك،<br/><span>في مساحة واحدة.</span></h1><p>نظّم محاضراتك، تابع مهامك، وذاكر بتركيز أكبر مع مجتمع هندسة القاهرة.</p><div className="auth-feature-list"><span><CheckCircle2 size={15}/> تنظيم المواد والمحاضرات</span><span><CheckCircle2 size={15}/> متابعة المهام والتسليمات</span><span><CheckCircle2 size={15}/> تعاون ومشاركة مع زملائك</span></div></div><div className="auth-orbit"/><div className="auth-foot">ENG HUB · STUDY SMARTER, BUILD BETTER</div></div><div className="auth-form-side"><form className="auth-form" onSubmit={submit}><div className="auth-mobile-brand"><div className="brand-mark"><img src={`${import.meta.env.BASE_URL}brand/enghub-mark.svg`} alt="ENG HUB"/></div><b>ENG HUB</b></div><div className="eyebrow">WELCOME TO ENG HUB</div><h2>{mode === 'login' ? 'مرحباً بعودتك' : 'أنشئ حسابك'}</h2><p>{mode === 'login' ? 'سجل دخولك للوصول إلى مساحة دراستك.' : 'انضم إلى مساحة طلاب هندسة القاهرة.'}</p>{mode === 'register' && <label>الاسم بالكامل<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك كما تحب أن يظهر"/></label>}<label>البريد الإلكتروني<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com"/></label><label>كلمة المرور<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 أحرف على الأقل"/></label>{error && <div className="auth-error"><AlertCircle size={15}/>{error}</div>}<button type="submit" className="btn btn-primary auth-submit" disabled={busy}>{busy ? <span className="spinner"/> : null}{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'} <ArrowLeft size={16}/></button><div className="auth-divider"><span>أو</span></div><button type="button" className="btn btn-outline google-btn" onClick={() => void continueWithGoogle()} disabled={busy}><span className="google-g">G</span> المتابعة باستخدام Google</button><div className="auth-switch">{mode === 'login' ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'إنشاء حساب' : 'تسجيل الدخول'}</button></div><div className="auth-foot-mobile">بالاستمرار، أنت توافق على شروط الاستخدام وسياسة الخصوصية.</div></form></div></div>;
}

function ProfileCompletionScreen({ user, cloudinarySettings, onComplete, themeClass }: {
  user: AppUser;
  themeClass: 'theme-dark' | 'theme-light';
  cloudinarySettings: CloudinarySettings;
  onComplete: (profile: { displayName: string; photoURL?: string | null; phone?: string; bio?: string }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [bio, setBio] = useState(user.bio || '');
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'private'>(user.profileVisibility ?? 'public');
  const [showBioOnPublicProfile, setShowBioOnPublicProfile] = useState(user.showBioOnPublicProfile !== false);
  const [showAcademicInfoOnPublicProfile, setShowAcademicInfoOnPublicProfile] = useState(user.showAcademicInfoOnPublicProfile !== false);
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const profileProgress = Math.round(([displayName.trim().length >= 2, Boolean(photoFile || photoURL), Boolean(phone.trim() || bio.trim())].filter(Boolean).length / 3) * 100);

  useEffect(() => {
    if (!photoFile) { setPhotoPreview(''); return; }
    const objectUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photoFile]);

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

  return <div className={'profile-onboarding ' + themeClass} dir="rtl">
    <div className="profile-onboarding-card panel">
      <div className="brand-row onboarding-brand"><div className="brand-mark"><img src={`${import.meta.env.BASE_URL}brand/enghub-mark.svg`} alt="ENG HUB"/></div><div className="brand-copy"><strong>ENG HUB</strong><span>CAIRO UNIVERSITY</span></div></div>
      <div className="eyebrow">COMPLETE YOUR ACCOUNT</div>
      <h1>أكمل إعداد حسابك</h1>
      <p className="onboarding-subtitle">هذه الخطوة مطلوبة قبل الدخول إلى مساحة الدراسة. اختر الاسم والصورة التي سيراها زملاؤك.</p>
      <div className="eh-onboarding-progress"><div><span>تجهيز ملفك الشخصي</span><b>{profileProgress}%</b></div><div className="eh-onboarding-progress-track"><span style={{width:profileProgress+'%'}}/></div><small>يمكنك إضافة الصورة والنبذة الآن أو تعديلهما لاحقاً.</small></div>
      <form className="form-stack" onSubmit={submit}>
        <div className="onboarding-photo-row">
          <div className="onboarding-avatar">{photoPreview || photoURL ? <img src={photoPreview || photoURL} alt="صورتك الشخصية"/> : displayName.trim().slice(0, 1) || <Users size={26}/>}</div>
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
  const titles: Record<string, string> = { 'student-profile': 'الملف الشخصي للطالب', home: 'الرئيسية', tasks: 'المهام', courses: 'المواد الدراسية', lectures: 'المحاضرات', exams: 'الاختبارات', files: 'مكتبة الملفات', chat: 'المحادثات', planner: 'مخطط المذاكرة', analytics: 'إحصائياتي', notifications: 'الإشعارات', admin: 'لوحة الإدارة', profile: 'الملف الشخصي' };
  return titles[page] ?? page;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="eh-page-heading">
    <div>{eyebrow && <div className="eh-eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
    {action && <div className="eh-page-heading-action">{action}</div>}
  </header>;
}

function Dashboard({ userName, tasks, subjects, exams, lectures, onGo, onNewTask, onStatus, canCreateTask }: {
  userName: string; tasks: StudyTask[]; subjects: Subject[]; exams: Exam[]; lectures: Lecture[];
  onGo: (page: string) => void; onNewTask: () => void; onStatus: (id: string, status: TaskStatus) => void; canCreateTask: boolean;
}) {
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const pending = tasks.filter((task) => task.status !== 'completed' && task.status !== 'under-review').length;
  const currentExams = exams.filter((exam) => exam.status !== 'completed').length;
  const upcomingTasks = [...tasks].filter((task) => task.status !== 'completed')
    .sort((a,b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()).slice(0,4);
  const upcoming = [
    ...tasks.filter((task) => task.status !== 'completed').map((task) => ({id:'task-'+task.id,title:task.title,subject:task.subjectName,date:new Date(task.dueAt),kind:'مهمة'})),
    ...exams.filter((exam) => exam.status !== 'completed').map((exam) => ({id:'exam-'+exam.title,title:exam.title,subject:exam.subjectName,date:new Date(exam.date),kind:'اختبار'})),
  ].filter((item) => !Number.isNaN(item.date.getTime())).sort((a,b)=>a.date.getTime()-b.date.getTime()).slice(0,4);
  const rate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const today = new Date().toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'});
  return <div className="eh-home">
    <section className="eh-welcome">
      <div className="eh-welcome-copy">
        <span className="eh-welcome-kicker"><Sparkles size={15}/> مساحة دراستك · {today}</span>
        <h1>أهلاً بعودتك، <strong>{userName}</strong></h1>
        <p>مساحتك الأكاديمية جاهزة. تابع مهامك ومحاضراتك ونظّم وقت دراستك من مكان واحد.</p>
        <div className="eh-welcome-actions">
          {canCreateTask && <button type="button" className="eh-button primary" onClick={onNewTask}><Plus size={17}/> إضافة مهمة</button>}
          <button type="button" className="eh-button glass" onClick={() => onGo('planner')}><CalendarDays size={17}/> مخطط المذاكرة</button>
          <button type="button" className="eh-button glass" onClick={() => onGo('chat')}><MessageCircle size={17}/> اذهب إلى الدردشة</button>
        </div>
      </div>
      <div className="eh-welcome-visual" aria-hidden="true">
        <div className="eh-visual-orbit orbit-a"/><div className="eh-visual-orbit orbit-b"/>
        <div className="eh-visual-core"><GraduationCap size={48}/></div>
        <div className="eh-visual-chip"><BookOpenCheck size={15}/> Study smarter</div>
      </div>
    </section>

    <div className="eh-section-heading">
      <div><span className="eh-eyebrow">نظرة عامة</span><h2>ملخص دراستك</h2><p>مؤشرات محسوبة من بياناتك الفعلية</p></div>
      <button type="button" className="eh-text-button" onClick={() => onGo('analytics')}>عرض التحليلات <ArrowLeft size={15}/></button>
    </div>

    <section className="eh-stat-grid">
      <StatCard label="المهام المتبقية" value={pending.toString()} detail="تحتاج إلى متابعة" icon={<ListChecks size={20}/>} tone="purple"/>
      <StatCard label="المهام المكتملة" value={completed.toString()} detail={tasks.length ? `من أصل ${tasks.length} مهمة` : 'لا توجد مهام بعد'} icon={<CheckCircle2 size={20}/>} tone="green"/>
      <StatCard label="المحاضرات المنشورة" value={lectures.length.toString()} detail="في مكتبتك الأكاديمية" icon={<Play size={20}/>} tone="blue"/>
      <StatCard label="الاختبارات القادمة" value={currentExams.toString()} detail="اختبارات لم تنته بعد" icon={<ClipboardList size={20}/>} tone="amber"/>
    </section>

    <section className="eh-home-grid">
      <div className="eh-surface-card eh-progress-card">
        <div className="eh-card-heading"><div><span className="eh-eyebrow">MY PROGRESS</span><h2>إنجاز المهام</h2><p>نسبة إنجاز المهام المسجلة</p></div><span className="eh-progress-badge" style={{'--progress-degree':rate*3.6+'deg'} as React.CSSProperties}>{rate}%</span></div>
        <div className="eh-progress-line"><span style={{width:rate+'%'}}/></div>
        <div className="eh-progress-meta"><span><i className="eh-dot green"/> مكتملة <b>{completed}</b></span><span><i className="eh-dot purple"/> متبقية <b>{pending}</b></span></div>
        <div className="eh-progress-footer"><span>تقدمك يظهر هنا مع تحديث المهام</span><button type="button" onClick={() => onGo('tasks')}>إدارة المهام <ArrowLeft size={14}/></button></div>
      </div>

      <div className="eh-surface-card eh-subject-overview">
        <div className="eh-card-heading"><div><span className="eh-eyebrow">ACADEMIC LIBRARY</span><h2>المواد الدراسية</h2><p>{subjects.length} مواد متاحة لك</p></div><button type="button" className="eh-round-link" onClick={() => onGo('courses')} aria-label="عرض المواد"><ArrowLeft size={17}/></button></div>
        {subjects.slice(0,4).map((subject) => <button type="button" className="eh-subject-line" key={subject.id} onClick={() => onGo('courses')}>
          <span className="eh-subject-symbol" style={{'--subject-color':subject.color} as React.CSSProperties}>{subject.icon || '∑'}</span>
          <span><b>{subject.name}</b><small>{subject.code}</small></span>
          <span className="eh-subject-line-meta">{lectures.filter((item)=>item.subjectId===subject.id).length} محاضرة</span>
          <ChevronLeft size={16}/>
        </button>)}
        {subjects.length === 0 && <EmptyState title="لا توجد مواد منشورة" body="عندما يضيف مدير المنصة المقررات ستظهر هنا."/>}
      </div>
    </section>

    <section className="eh-home-grid eh-home-grid-bottom">
      <div className="eh-surface-card eh-task-preview">
        <div className="eh-card-heading"><div><span className="eh-eyebrow">UP NEXT</span><h2>المهام التي تحتاج انتباهك</h2><p>مرتبة حسب أقرب موعد انتهاء</p></div><button type="button" className="eh-text-button" onClick={() => onGo('tasks')}>كل المهام <ArrowLeft size={15}/></button></div>
        <div className="eh-task-list">
          {upcomingTasks.map((task) => <TaskRow key={task.id} task={task} onStatus={onStatus}/>)}
          {upcomingTasks.length===0 && <EmptyState title="أنت على ما يرام" body="لا توجد مهام مفتوحة حالياً."/>}
        </div>
      </div>
      <div className="eh-surface-card eh-agenda-card">
        <div className="eh-card-heading"><div><span className="eh-eyebrow">UPCOMING</span><h2>المواعيد القادمة</h2><p>المهام والاختبارات</p></div><button type="button" className="eh-round-link" onClick={() => onGo('planner')} aria-label="فتح المخطط"><CalendarDays size={17}/></button></div>
        <div className="eh-agenda-list">
          {upcoming.map((item) => <div className="eh-agenda-item" key={item.id}>
            <div className="eh-agenda-date"><b>{item.date.toLocaleDateString('ar-EG',{day:'numeric'})}</b><small>{item.date.toLocaleDateString('ar-EG',{month:'short'})}</small></div>
            <div><b>{item.title}</b><small>{item.subject} · {item.kind}</small></div>
            <span>{item.date.toLocaleDateString('ar-EG',{weekday:'short'})}</span>
          </div>)}
          {upcoming.length===0 && <EmptyState title="لا توجد مواعيد قادمة" body="ستظهر مواعيد المهام والاختبارات هنا."/>}
        </div>
      </div>
    </section>

    <div className="eh-quick-access">
      <button type="button" onClick={() => onGo('courses')}><span className="qa-icon purple"><BookOpen size={18}/></span><span><b>المواد الدراسية</b><small>المقررات والمدرسون</small></span><ArrowLeft size={16}/></button>
      <button type="button" onClick={() => onGo('files')}><span className="qa-icon blue"><FolderOpen size={18}/></span><span><b>مكتبة الملفات</b><small>المذكرات والمرفقات</small></span><ArrowLeft size={16}/></button>
      <button type="button" onClick={() => onGo('exams')}><span className="qa-icon amber"><ClipboardList size={18}/></span><span><b>الاختبارات</b><small>مواعيد واختباراتك</small></span><ArrowLeft size={16}/></button>
    </div>
  </div>;
}

function StatCard({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: ReactNode; tone: string }) {
  return <article className={`eh-stat-card tone-${tone}`}>
    <div className="eh-stat-top"><span>{label}</span><span className="eh-stat-icon">{icon}</span></div>
    <strong>{value}</strong><small>{detail}</small>
  </article>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="eh-empty-state"><span><Layers3 size={22}/></span><b>{title}</b><p>{body}</p></div>;
}

function TaskRow({ task, onStatus }: { task: StudyTask; onStatus: (id: string, status: TaskStatus) => void }) {
  const due = new Date(task.dueAt);
  const completed = task.status === 'completed';
  const start = task.startAt ? new Date(task.startAt) : null;
  return <article className={`eh-task-row ${completed?'is-completed':''}`}>
    <button type="button" className={`eh-task-complete ${completed?'checked':''}`} onClick={() => onStatus(task.id,completed?'in-progress':'completed')} aria-label={completed?'إلغاء إكمال المهمة':'تحديد المهمة كمكتملة'} aria-pressed={completed}>{completed?<Check size={15}/>:null}</button>
    <div className="eh-task-row-main"><b>{task.title}</b><span>{task.subjectName || 'مهمة عامة'}{start ? ` · تبدأ ${start.toLocaleDateString('ar-EG',{day:'numeric',month:'short'})}` : ''}</span></div>
    <div className="eh-task-row-date"><small>موعد الانتهاء</small><b>{due.toLocaleDateString('ar-EG',{day:'numeric',month:'short'})}</b></div>
  </article>;
}

function TasksPage({ tasks, onNew, onStatus, onDelete, canEdit }: {
  tasks: StudyTask[]; onNew: () => void; onStatus: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void; canEdit: boolean;
}) {
  const [filter,setFilter]=useState<'all'|'pending'|'completed'|'in-progress'>('all');
  const [query,setQuery]=useState('');
  const counts = {
    all:tasks.length,
    pending:tasks.filter((task)=>!['completed','under-review'].includes(task.status)).length,
    completed:tasks.filter((task)=>task.status==='completed').length,
    'in-progress':tasks.filter((task)=>task.status==='in-progress').length,
  };
  const filtered = tasks.filter((task) => {
    const stateMatch = filter==='all' || (filter==='pending' ? !['completed','under-review'].includes(task.status) : task.status===filter);
    const textMatch = `${task.title} ${task.subjectName} ${task.description}`.toLowerCase().includes(query.toLowerCase());
    return stateMatch && textMatch;
  }).sort((a,b)=>new Date(a.dueAt).getTime()-new Date(b.dueAt).getTime());
  return <div className="eh-tasks-page">
    <PageHeader eyebrow="TASK CENTER" title="المهام" description="نظّم أولوياتك وتابع تقدمك ومواعيد التسليم." action={canEdit?<button type="button" className="eh-button primary" onClick={onNew}><Plus size={17}/> إنشاء مهمة</button>:null}/>
    <div className="eh-task-metrics">
      <div><span>كل المهام</span><b>{counts.all}</b><small>إجمالي المسند إليك</small></div>
      <div><span>بانتظار التنفيذ</span><b>{counts.pending}</b><small>تحتاج إلى بدء أو متابعة</small></div>
      <div><span>قيد التنفيذ</span><b>{counts['in-progress']}</b><small>تعمل عليها الآن</small></div>
      <div><span>مكتملة</span><b>{counts.completed}</b><small>أنجزتها بنجاح</small></div>
    </div>
    <section className="eh-surface-card eh-task-manager">
      <div className="eh-task-toolbar">
        <div className="eh-task-filters">
          {([{id:'all',label:'الكل'},{id:'pending',label:'بانتظار التنفيذ'},{id:'in-progress',label:'قيد التنفيذ'},{id:'completed',label:'مكتملة'}] as const).map((item)=><button key={item.id} type="button" className={filter===item.id?'active':''} onClick={()=>setFilter(item.id)}>{item.label}<small>{counts[item.id]}</small></button>)}
        </div>
        <label className="eh-inline-search"><Search size={16}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="ابحث عن مهمة..."/></label>
      </div>
      <div className="eh-task-board">
        {filtered.map((task)=> {
          const completed=task.status==='completed';
          const overdue=!completed&&new Date(task.dueAt).getTime()<Date.now();
          return <article className={`eh-task-card ${completed?'is-completed':''}`} key={task.id}>
            <button type="button" className={`eh-task-complete ${completed?'checked':''}`} onClick={()=>onStatus(task.id,completed?'in-progress':'completed')} aria-label={completed?'إلغاء الإكمال':'إكمال المهمة'} aria-pressed={completed}>{completed?<Check size={15}/>:null}</button>
            <div className="eh-task-card-body">
              <div className="eh-task-card-title"><h3>{task.title}</h3><span className={`eh-status-tag ${completed?'complete':overdue?'overdue':task.status==='in-progress'?'progress':'pending'}`}>{completed?'مكتملة':overdue?'متأخرة':statusText[task.status]}</span></div>
              {task.description && <p>{task.description}</p>}
              <div className="eh-task-card-meta">
                <span><BookOpen size={13}/>{task.subjectName||'مهمة عامة'}</span>
                <span><FlagIcon priority={task.priority}/>{priorityText[task.priority]}</span>
                <span><CalendarClock size={13}/>{task.startAt?new Date(task.startAt).toLocaleDateString('ar-EG',{day:'numeric',month:'short'}):'بداية غير محددة'} — {new Date(task.dueAt).toLocaleDateString('ar-EG',{day:'numeric',month:'short'})}</span>
              </div>
            </div>
            <TaskActionsMenu task={task} onStatus={onStatus} onDelete={onDelete} canEdit={canEdit}/>
          </article>;
        })}
        {filtered.length===0&&<EmptyState title={tasks.length===0?'لم تُسند إليك مهام بعد':'لا توجد نتائج مطابقة'} body={tasks.length===0?'ستظهر المهام هنا عندما ينشرها مدير المنصة.':'جرّب تغيير البحث أو حالة المهمة.'}/>}
      </div>
    </section>
  </div>;
}

function FlagIcon({ priority }: { priority: Priority }) {
  return <Flag size={13} className={`eh-priority-icon priority-${priority}`}/>;
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

function AcademicHubPage({ subjects, lecturers, lectures, parts, files, exams, tasks, contentNodes, selectedSubjectId, selectedLecturerId, selectedLectureId, subjectCategory, canEdit, onSelectSubject, onSelectCategory, onSelectLecturer, onSelectLecture, onBack, onAddSubject, onAddLecturer, onAddLecture, onAddPart }: {
  subjects: Subject[]; lecturers: Lecturer[]; lectures: Lecture[]; parts: LecturePart[]; files: LibraryFile[]; exams: Exam[]; tasks: StudyTask[]; contentNodes: AcademicContentNode[];
  selectedSubjectId: string; selectedLecturerId: string; selectedLectureId: string; subjectCategory: SubjectCategory | ''; canEdit: boolean;
  onSelectSubject: (id: string) => void; onSelectCategory: (category: SubjectCategory) => void; onSelectLecturer: (id: string) => void; onSelectLecture: (id: string) => void; onBack: () => void;
  onAddSubject: () => void; onAddLecturer: () => void; onAddLecture: () => void; onAddPart: () => void;
}) {
  const [playingPart, setPlayingPart] = useState<LecturePart | null>(null);
  const subject = subjects.find((item) => item.id === selectedSubjectId);
  const lecturer = lecturers.find((item) => item.id === selectedLecturerId);
  const lecture = lectures.find((item) => item.id === selectedLectureId);
  const subjectLecturers = lecturers.filter((item) => item.subjectId === selectedSubjectId && item.status === 'active');
  const lecturerLectures = lectures.filter((item) => item.lecturerId === selectedLecturerId);
  const legacyLectures = lectures.filter((item) => item.subjectId === selectedSubjectId && !item.lecturerId);
  const legacyPart: LecturePart[] = lecture?.videoUrl ? [{
    id:'legacy-video',lectureId:lecture.id,title:'الفيديو الرئيسي',videoUrl:lecture.videoUrl,
    duration:lecture.duration||'',order:1,sourceType:'external',createdAt:'',
  }] : [];
  const currentParts = parts.length ? parts : legacyPart;
  const stageTitle = lecture ? lecture.title : lecturer ? lecturer.name : subject ? subject.name : 'المواد الدراسية';
  const stageDescription = lecture ? 'اختر جزءاً من المحاضرة لمشاهدة الفيديو.' : lecturer ? 'المحاضرات المنشورة لهذا المدرس.' : subject && subjectCategory === 'lectures' ? 'اختر مدرساً أو ابدأ بإضافة المحاضرات مباشرة.' : subject ? 'اختر القسم الذي تريد استكشافه داخل المادة.' : 'تصفح المواد ثم افتح أقسام المقرر ومحتواه.';
  const action = !canEdit ? undefined : lecture
    ? <button type="button" className="eh-button primary" onClick={onAddPart}><Plus size={16}/> إضافة جزء</button>
    : lecturer
      ? <button type="button" className="eh-button primary" onClick={onAddLecture}><Plus size={16}/> إضافة محاضرة</button>
      : subject && subjectCategory === 'lectures'
        ? <div className="eh-academic-actions"><button type="button" className="eh-button" onClick={onAddLecturer}><Plus size={16}/> إضافة مدرس</button><button type="button" className="eh-button primary" onClick={onAddLecture}><Plus size={16}/> محاضرة بدون مدرس</button></div>
      : subject ? undefined
        : <button type="button" className="eh-button primary" onClick={onAddSubject}><Plus size={16}/> إضافة مادة</button>;

  const subjectCategoryCards: Array<{ id: SubjectCategory; title: string; description: string; icon: typeof Video; count: number | string }> = [
    { id: 'lectures', title: 'المحاضرات', description: 'المدرسون والمحاضرات وأجزاء الفيديو', icon: Video, count: lectures.filter((item) => item.subjectId === subject?.id).length },
    { id: 'files', title: 'الملفات والمراجع', description: 'المذكرات والشرائح والملفات المرتبطة بالمادة', icon: FileText, count: contentNodes.filter((item) => item.category === 'files' && !item.parentId).length },
    { id: 'exams', title: 'الاختبارات', description: 'الاختبارات والتقييمات المرتبطة بالمقرر', icon: ClipboardList, count: contentNodes.filter((item) => item.category === 'exams' && !item.parentId).length },
    { id: 'assignments', title: 'الواجبات والتكليفات', description: 'التكليفات والأنشطة المطلوبة للمادة', icon: BookOpenCheck, count: contentNodes.filter((item) => item.category === 'assignments' && !item.parentId).length },
    { id: 'resources', title: 'المصادر الإضافية', description: 'روابط ومراجع ومصادر خارجية مساندة', icon: Link2, count: contentNodes.filter((item) => item.category === 'resources' && !item.parentId).length },
    { id: 'custom', title: 'مجلدات وأقسام مخصصة', description: 'أنشئ أي تنظيم إضافي يناسب طبيعة المادة', icon: FolderOpen, count: contentNodes.filter((item) => item.category === 'custom' && !item.parentId).length },
    { id: 'chat', title: 'مناقشات المادة', description: 'غرفة نقاش خاصة بطلاب هذا المقرر', icon: MessageCircle, count: 'مباشر' },
  ];

  return <div className="eh-academic-page">
    <PageHeader eyebrow="ACADEMIC LIBRARY" title={stageTitle} description={stageDescription} action={action}/>
    <nav className="eh-academic-crumbs" aria-label="مسار التصفح">
      <button type="button" className={!subject?'active':''} onClick={() => { onSelectSubject('');onSelectLecturer('');onSelectLecture(''); }}><BookOpen size={14}/> المواد الدراسية</button>
      {subject && <><ChevronLeft size={14}/><button type="button" className={!subjectCategory?'active':''} onClick={() => {onSelectCategory('lectures');onSelectLecturer('');onSelectLecture('');}}>{subject.name}</button></>}
      {subject && subjectCategory && <><ChevronLeft size={14}/><span>{({lectures:'المحاضرات',files:'الملفات',exams:'الاختبارات',assignments:'الواجبات',resources:'المصادر الإضافية',custom:'المجلدات المخصصة'} as Record<SubjectCategory,string>)[subjectCategory]}</span></>}
      {lecturer && <><ChevronLeft size={14}/><button type="button" className={!lecture?'active':''} onClick={() => onSelectLecture('')}>{lecturer.name}</button></>}
      {lecture && <><ChevronLeft size={14}/><span>{lecture.title}</span></>}
      {(subject || lecturer || lecture) && <button type="button" className="eh-crumb-back" onClick={onBack}><ArrowLeft size={14}/> رجوع</button>}
    </nav>

    {!subject && <>
      <section className="eh-academic-hero">
        <div className="eh-academic-hero-copy"><span className="eh-eyebrow">CAIRO UNIVERSITY · FACULTY OF ENGINEERING</span><h2>مكتبتك الأكاديمية</h2><p>كل مقرر في مكانه، وكل مدرس ومحاضرة ومصدر تعليمي مرتبط به.</p></div>
        <div className="eh-academic-stats">
          <div><b>{subjects.length}</b><span>مادة</span></div>
          <div><b>{lecturers.length}</b><span>مدرس</span></div>
          <div><b>{lectures.length}</b><span>محاضرة</span></div>
        </div>
        <div className="eh-academic-hero-symbol"><GraduationCap size={53}/></div>
      </section>
      <div className="eh-section-heading"><div><span className="eh-eyebrow">YOUR COURSES</span><h2>المواد الدراسية</h2><p>اختر مادة لعرض المدرسين التابعين لها</p></div><span className="eh-result-count">{subjects.length} مقررات</span></div>
      <div className="eh-academic-subject-grid">
        {subjects.map((item,index) => <button type="button" className="eh-academic-subject-card" key={item.id} onClick={() => onSelectSubject(item.id)}>
          <div className="eh-academic-card-top"><span className="eh-academic-subject-icon" style={{'--subject-color':item.color} as React.CSSProperties}>{item.icon||'∑'}</span><span className="eh-course-index">{String(index+1).padStart(2,'0')}</span></div>
          <span className="eh-course-code">{item.code}</span><h3>{item.name}</h3><p>{item.description||'المحتوى التعليمي والمحاضرات الخاصة بهذا المقرر.'}</p>
          <div className="eh-course-card-footer"><span><Users size={14}/>{lecturers.filter((x)=>x.subjectId===item.id).length} مدرس</span><span><Video size={14}/>{lectures.filter((x)=>x.subjectId===item.id).length} محاضرة</span><ChevronLeft size={16}/></div>
        </button>)}
      </div>
      {subjects.length===0 && <div className="eh-surface-card"><EmptyState title="لا توجد مواد دراسية حتى الآن" body={canEdit?'أنشئ أول مادة، ثم أضف المدرسين والمحاضرات وأجزاء الفيديو.':'ستظهر المواد هنا عند نشرها من لوحة الإدارة.'}/>{canEdit&&<div className="eh-empty-action"><button type="button" className="eh-button primary" onClick={onAddSubject}><Plus size={16}/> إضافة أول مادة</button></div>}</div>}
    </>}

    {subject && !lecturer && !subjectCategory && <>
      <section className="eh-academic-level">
        <span className="eh-academic-subject-icon large" style={{'--subject-color':subject.color} as React.CSSProperties}>{subject.icon || '∑'}</span>
        <div className="eh-academic-level-copy">
          <span className="eh-eyebrow">SUBJECT WORKSPACE · {subject.code}</span>
          <h2>{subject.name}</h2>
          <p>{subject.description || 'اختر نوع المحتوى الذي تريد استكشافه داخل هذه المادة.'}</p>
        </div>
        <div className="eh-academic-level-count"><b>{subjectLecturers.length}</b><span>مدرسون</span></div>
        <div className="eh-academic-level-count"><b>{lectures.filter((item) => item.subjectId === subject.id).length}</b><span>محاضرات</span></div>
      </section>
      <div className="eh-section-heading">
        <div><span className="eh-eyebrow">SUBJECT CONTENT</span><h2>محتويات المادة</h2><p>لكل مادة هيكلها الخاص. اختر قسماً للدخول إلى محتوياته ومجلداته.</p></div>
      </div>
      <div className="eh-subject-category-grid">
        {subjectCategoryCards.map((item) => {
          const Icon = item.icon;
          return (
            <button type="button" key={item.id} className="eh-subject-category-card" onClick={() => onSelectCategory(item.id)}>
              <span className="eh-subject-category-icon"><Icon size={23}/></span>
              <span className="eh-subject-category-copy"><b>{item.title}</b><small>{item.description}</small></span>
              <span className="eh-subject-category-count">{item.count}</span>
              <ChevronLeft size={18}/>
            </button>
          );
        })}
      </div>
      {canEdit&&<p className="eh-academic-tip">يمكنك إنشاء محاضرات مباشرة أو إضافة مدرسين، وإضافة مجلدات وعناصر مخصصة داخل كل قسم من أقسام المادة.</p>}
    </>}

    {lecturer && !lecture && <>
      <section className="eh-academic-level">
        <span className="eh-lecturer-avatar large">{lecturer.photoURL?<img src={lecturer.photoURL} alt=""/>:<GraduationCap size={25}/>}</span>
        <div className="eh-academic-level-copy"><span className="eh-eyebrow">{subject?.name||lecturer.subjectName}</span><h2>{lecturer.name}</h2><p>{lecturer.bio||lecturer.description||'جميع المحاضرات المنشورة لهذا المدرس.'}</p></div>
        <div className="eh-academic-level-count"><b>{lecturerLectures.length}</b><span>محاضرة</span></div>
      </section>
      <div className="eh-section-heading"><div><span className="eh-eyebrow">LECTURE LIBRARY</span><h2>محاضرات المدرس</h2><p>اختر المحاضرة لعرض أجزائها ومشغل الفيديو</p></div></div>
      <div className="eh-lecture-grid">
        {lecturerLectures.map((item,index)=><button type="button" className="eh-lecture-card" key={item.id} onClick={()=>onSelectLecture(item.id)}>
          <span className={'eh-lecture-art art-'+(index%4)}><span className="eh-lecture-number">LECTURE {item.lectureNumber||index+1}</span><span className="eh-lecture-play"><Play size={22} fill="currentColor"/></span><span className="eh-lecture-part-count"><Layers3 size={13}/>{item.partsCount??item.parts??0} أجزاء</span></span>
          <span className="eh-lecture-card-copy"><small>{item.date} · {item.duration||'مدة غير محددة'}</small><b>{item.title}</b><span>عرض محتويات المحاضرة <ArrowLeft size={14}/></span></span>
        </button>)}
      </div>
      {lecturerLectures.length===0&&<div className="eh-surface-card"><EmptyState title="لا توجد محاضرات بعد" body={canEdit?'أنشئ أول محاضرة لهذا المدرس، ثم أضف روابط الفيديو كأجزاء مستقلة.':'ستظهر المحاضرات هنا بعد نشرها.'}/></div>}
    </>}

    {lecture && <>
      <section className="eh-academic-level lecture-level">
        <span className="eh-lecture-level-icon"><Video size={24}/></span>
        <div className="eh-academic-level-copy"><span className="eh-eyebrow">{lecture.subjectName} · {lecture.lecturerName||lecturer?.name||'محاضرة'}</span><h2>{lecture.title}</h2><p>{lecture.description||'قائمة الأجزاء المسجلة لهذه المحاضرة.'}</p></div>
        <div className="eh-academic-level-count"><b>{currentParts.length}</b><span>أجزاء فيديو</span></div>
      </section>
      <div className="eh-section-heading"><div><span className="eh-eyebrow">VIDEO CHAPTERS</span><h2>أجزاء المحاضرة</h2><p>اختر الجزء المطلوب لتشغيل الفيديو</p></div></div>
      <div className="eh-parts-list">
        {currentParts.map((part,index)=><article className="eh-part-card" key={part.id}>
          <span className="eh-part-number">{String(index+1).padStart(2,'0')}</span>
          <span className="eh-part-main"><b>{part.title}</b><small>{part.duration||'المدة غير محددة'} · {part.sourceType==='youtube'?'YouTube':part.sourceType==='vimeo'?'Vimeo':part.sourceType==='direct'?'فيديو مباشر':'رابط خارجي'}</small></span>
          <button type="button" className="eh-button primary" onClick={()=>setPlayingPart(part)}><Play size={15} fill="currentColor"/> تشغيل</button>
        </article>)}
        {currentParts.length===0&&<div className="eh-surface-card"><EmptyState title="لم تتم إضافة أجزاء للمحاضرة" body={canEdit?'أضف جزء فيديو واحداً أو أكثر لهذه المحاضرة.':'سيظهر المحتوى هنا عندما يضيفه المدرس أو مدير المنصة.'}/></div>}
      </div>
    </>}

    {playingPart && <div className="video-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setPlayingPart(null);}}>
      <section className="video-modal-card" role="dialog" aria-modal="true" aria-label={playingPart.title}>
        <header className="video-modal-header"><div><b>{playingPart.title}</b><span>{lecture?.title||''}</span></div><button type="button" className="icon-button" onClick={()=>setPlayingPart(null)} aria-label="إغلاق المشغل"><X size={20}/></button></header>
        <VideoPlayer source={playingPart.videoUrl} title={playingPart.title}/>
      </section>
    </div>}
  </div>;
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
  exams: Exam[]; setExams: (fn: (items: Exam[]) => Exam[]) => void; canEdit: boolean; onAdd: () => void;
}) {
  const [filter,setFilter]=useState<'all'|'upcoming'|'available'|'completed'>('all');
  const ordered=[...exams].sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime());
  const upcoming=ordered.filter((exam)=>exam.status==='upcoming');
  const available=ordered.filter((exam)=>exam.status==='available');
  const completed=ordered.filter((exam)=>exam.status==='completed');
  const filtered=ordered.filter((exam)=>filter==='all'||exam.status===filter);
  const next=upcoming[0]||available[0];
  return <div className="eh-exams-page">
    <PageHeader eyebrow="ASSESSMENT CENTER" title="الاختبارات والامتحانات" description="تابع مواعيد التقييمات والاستعداد لاختباراتك." action={canEdit?<button type="button" className="eh-button primary" onClick={onAdd}><Plus size={17}/> إضافة اختبار</button>:null}/>
    <section className="eh-next-exam">
      <div className="eh-next-exam-copy"><span className="eh-eyebrow">NEXT ASSESSMENT</span><h2>{next?.title||'لا يوجد اختبار قادم'}</h2><p>{next?next.subjectName+' · '+new Date(next.date).toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'}):'ستظهر هنا أقرب مواعيد الاختبارات التي ينشرها مدير المنصة.'}</p></div>
      <div className="eh-next-exam-symbol"><CalendarClock size={27}/></div>
      <div className="eh-next-exam-count"><b>{upcoming.length}</b><span>اختبارات قادمة</span></div>
    </section>
    <section className="eh-exam-metrics">
      <div><span>كل الاختبارات</span><b>{exams.length}</b></div>
      <div><span>قادمة</span><b>{upcoming.length}</b></div>
      <div><span>متاحة الآن</span><b>{available.length}</b></div>
      <div><span>مكتملة</span><b>{completed.length}</b></div>
    </section>
    <section className="eh-surface-card eh-exam-list">
      <div className="eh-exam-toolbar">
        <div><span className="eh-eyebrow">EXAM SCHEDULE</span><h2>جدول الاختبارات</h2><p>المواعيد المسجلة في حسابك</p></div>
        <div className="eh-exam-filters">{([{id:'all',label:'الكل'},{id:'upcoming',label:'قادم'},{id:'available',label:'متاح'},{id:'completed',label:'مكتمل'}] as const).map(item=><button type="button" key={item.id} className={filter===item.id?'active':''} onClick={()=>setFilter(item.id)}>{item.label}</button>)}</div>
      </div>
      {filtered.map((exam,index)=><article className="eh-exam-card" key={exam.id}>
        <span className={'eh-exam-icon '+exam.status}><ClipboardList size={20}/></span>
        <div className="eh-exam-card-copy"><small>{exam.subjectName} · {exam.questions} سؤال</small><b>{exam.title}</b><span><Clock3 size={13}/>{exam.duration}</span></div>
        <div className="eh-exam-date"><b>{new Date(exam.date).toLocaleDateString('ar-EG',{day:'numeric',month:'short'})}</b><small>{new Date(exam.date).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</small></div>
        <span className={'eh-exam-status '+exam.status}>{exam.status==='upcoming'?'قادم':exam.status==='available'?'متاح الآن':'مكتمل'}</span>
      </article>)}
      {filtered.length===0&&<EmptyState title={exams.length===0?'لا توجد اختبارات منشورة':'لا توجد اختبارات بهذه الحالة'} body={exams.length===0?'سيضيف مدير المنصة مواعيد الاختبارات إلى هذه الصفحة.':'اختر حالة أخرى لعرض الاختبارات.'}/>}
    </section>
  </div>;
}

function FilesPage({ files, onUpload, cloudinaryReady, isDemo, canUpload }: { files: LibraryFile[]; onUpload: (file: File) => Promise<void>; cloudinaryReady: boolean; isDemo: boolean; canUpload: boolean }) {
  const inputRef=useRef<HTMLInputElement>(null);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<'all'|'PDF'|'DOC'|'PPT'|'IMAGE'|'VIDEO'>('all');
  const [uploading,setUploading]=useState(false);
  const filtered=files.filter(file=>(filter==='all'||file.type===filter)&&(file.name+' '+file.subjectName).toLowerCase().includes(query.toLowerCase()));
  const counts=(type:string)=>files.filter(file=>type==='all'||file.type===type).length;
  const handleFile=async(file?:File)=>{
    if(!file)return;
    setUploading(true);
    try{await onUpload(file);}finally{setUploading(false);if(inputRef.current)inputRef.current.value='';}
  };
  return <div className="eh-files-page">
    <PageHeader eyebrow="RESOURCE LIBRARY" title="مكتبة الملفات" description="كل المذكرات والملفات والصور ومقاطع الفيديو في مكتبة واحدة." action={canUpload ? <><input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.zip,.png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm" className="visually-hidden" onChange={(event)=>void handleFile(event.target.files?.[0])}/><button type="button" className="eh-button primary" onClick={()=>inputRef.current?.click()} disabled={uploading||(!isDemo&&!cloudinaryReady)}>{uploading?<span className="spinner"/>:<Upload size={16}/>} رفع ملف جديد</button></> : undefined}/>
    <section className="eh-files-overview"><div className="eh-files-overview-main"><span className="eh-files-icon"><FolderOpen size={25}/></span><div><span className="eh-eyebrow">YOUR STUDY LIBRARY</span><h2>{files.length} ملف في مكتبتك</h2><p>{isDemo?'وضع تجريبي — الملفات لا تُحفظ على الخادم.':cloudinaryReady?'تُرفع الملفات إلى Cloudinary، وتُحفظ بياناتها في Firestore.':'يلزم إعداد Cloudinary قبل رفع الملفات.'}</p></div></div><div className="eh-files-breakdown"><div><b>{counts('PDF')}</b><span>PDF</span></div><div><b>{counts('DOC')}</b><span>مستندات</span></div><div><b>{counts('VIDEO')}</b><span>فيديو</span></div><div><b>{counts('IMAGE')}</b><span>صور</span></div></div></section>
    <section className="eh-surface-card eh-files-board">
      <div className="eh-files-toolbar"><div><span className="eh-eyebrow">ALL RESOURCES</span><h2>الملفات المحفوظة</h2></div><label className="eh-inline-search"><Search size={15}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="ابحث باسم الملف أو المادة"/></label></div>
      <div className="eh-files-filters">{([{id:'all',label:'الكل'},{id:'PDF',label:'PDF'},{id:'DOC',label:'مستندات'},{id:'PPT',label:'عروض'},{id:'IMAGE',label:'صور'},{id:'VIDEO',label:'فيديو'}] as const).map(item=><button type="button" key={item.id} className={filter===item.id?'active':''} onClick={()=>setFilter(item.id)}>{item.label}<small>{counts(item.id)}</small></button>)}</div>
      <div className="eh-files-grid">{filtered.map(file=><article className="eh-file-card" key={file.id}>
        <div className={'eh-file-kind kind-'+file.type.toLowerCase()}>{file.type==='IMAGE'?<FileImage size={23}/>:file.type==='VIDEO'?<Video size={23}/>:file.type==='PPT'?<Grid2X2 size={23}/>:<FileText size={23}/>}<small>{file.type}</small></div>
        <div className="eh-file-copy"><b title={file.name}>{file.name}</b><span>{file.subjectName}</span><small>{file.size} · {file.updatedAt}</small></div>
        <button type="button" className="eh-file-open" onClick={()=>file.url?window.open(file.url,'_blank','noopener,noreferrer'):undefined} disabled={!file.url} aria-label="فتح الملف"><Download size={17}/></button>
      </article>)}</div>
      {filtered.length===0&&<EmptyState title={files.length===0?'المكتبة فارغة حالياً':'لا توجد نتائج مطابقة'} body={files.length===0?'ارفع أول ملف لتجميع مادتك الدراسية في مكان واحد.':'جرّب تغيير البحث أو نوع الملف.'}/>}
    </section>
  </div>;
}


function FocusModePage({ userId }: { userId: string }) {
  const presets = [15, 25, 45, 60, 90];
  const [minutes, setMinutes] = useState(() => {
    try { return Math.max(1, Math.min(240, Number(window.localStorage.getItem('enghub-focus-minutes:' + userId)) || 25)); } catch { return 25; }
  });
  const [seconds, setSeconds] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [selectedTask, setSelectedTask] = useState('');
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((value) => {
      if (value <= 1) { setRunning(false); setSessionDone(true); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const setDuration = (value: number) => {
    const next = Math.max(1, Math.min(240, Math.round(value)));
    setMinutes(next); setSeconds(next * 60); setRunning(false); setSessionDone(false); setMode('focus');
    try { window.localStorage.setItem('enghub-focus-minutes:' + userId, String(next)); } catch { /* optional preference */ }
  };
  const switchBreak = () => { setMode('break'); setRunning(false); setSessionDone(false); setSeconds(5 * 60); };
  const reset = () => { setRunning(false); setSessionDone(false); setSeconds((mode === 'break' ? 5 : minutes) * 60); };
  const total = (mode === 'break' ? 5 : minutes) * 60;
  const progress = total > 0 ? Math.max(0, Math.min(1, (total - seconds) / total)) : 0;
  const time = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  return <div className="eh-focus-workspace">
    <div className="eh-focus-workspace-glow" aria-hidden="true"/>
    <header className="eh-focus-heading">
      <div><span className="eh-focus-kicker"><Sparkles size={14}/> ENG HUB · FOCUS SPACE</span><h1>مساحة التركيز</h1><p>مساحة هادئة لتنجز مهمة واحدة في كل مرة، دون تشتيت.</p></div>
      <div className="eh-focus-status"><span className={running ? 'is-running' : ''}/>{running ? 'جلسة نشطة' : sessionDone ? 'اكتملت الجلسة' : 'جاهز للبدء'}</div>
    </header>
    <div className="eh-focus-layout">
      <section className="eh-focus-main-card">
        <div className="eh-focus-mode-switch">
          <button type="button" className={mode === 'focus' ? 'active' : ''} onClick={() => { setMode('focus'); setRunning(false); setSessionDone(false); setSeconds(minutes * 60); }}>تركيز</button>
          <button type="button" className={mode === 'break' ? 'active' : ''} onClick={switchBreak}>استراحة قصيرة</button>
        </div>
        <div className="eh-focus-ring" style={{'--eh-focus-angle': (progress * 360) + 'deg'} as React.CSSProperties}>
          <div className="eh-focus-ring-inner"><span>{mode === 'focus' ? 'وقت التركيز' : 'وقت الاستراحة'}</span><strong>{time}</strong><small>{running ? 'استمر… أنت تقوم بعمل رائع' : sessionDone ? 'أحسنت! أنهيت جلستك' : 'خذ نفساً عميقاً وابدأ'}</small></div>
        </div>
        <div className="eh-focus-controls-pro">
          <button type="button" className="eh-focus-start" onClick={() => { if (seconds === 0) { setSeconds(total); setSessionDone(false); } setRunning((value) => !value); }}>{running ? <><Pause size={18}/> إيقاف مؤقت</> : <><Play size={18} fill="currentColor"/> {sessionDone ? 'ابدأ جلسة جديدة' : 'ابدأ التركيز'}</>}</button>
          <button type="button" className="eh-focus-reset" onClick={reset} aria-label="إعادة ضبط المؤقت"><RotateCcw size={18}/></button>
        </div>
        <div className="eh-focus-quote"><span>✦</span> التقدم الصغير كل يوم يصنع فرقاً كبيراً.</div>
      </section>
      <aside className="eh-focus-settings-card">
        <div className="eh-focus-settings-title"><span className="eh-focus-settings-icon"><Timer size={18}/></span><div><b>إعداد الجلسة</b><small>خصص وقتك بالطريقة التي تناسبك</small></div></div>
        <div className="eh-focus-presets"><label>المدد المقترحة</label><div>{presets.map((value) => <button type="button" key={value} className={mode === 'focus' && minutes === value ? 'active' : ''} onClick={() => setDuration(value)}>{value}<small>دقيقة</small></button>)}</div></div>
        <div className="eh-focus-range"><div><label htmlFor="eh-focus-range">مدة مخصصة</label><strong>{minutes} دقيقة</strong></div><input id="eh-focus-range" type="range" min="5" max="180" step="5" value={minutes} onChange={(event) => setDuration(Number(event.target.value))}/><div className="eh-focus-range-labels"><span>5 دقائق</span><span>3 ساعات</span></div></div>
        <div className="eh-focus-custom-number"><label htmlFor="eh-focus-minutes">إدخال المدة بالدقائق</label><div><input id="eh-focus-minutes" type="number" min="1" max="240" value={minutes} onChange={(event) => setDuration(Number(event.target.value) || 1)}/><span>دقيقة</span></div><small>يمكنك ضبط مدة من دقيقة واحدة حتى 4 ساعات.</small></div>
        <div className="eh-focus-task-field"><label htmlFor="eh-focus-task">ما المهمة التي ستعمل عليها؟</label><input id="eh-focus-task" value={selectedTask} onChange={(event) => setSelectedTask(event.target.value)} placeholder="مثال: حل مسائل التفاضل"/></div>
        <div className="eh-focus-tip"><Sparkles size={16}/><span><b>نصيحة بسيطة</b> أغلق الإشعارات، جهّز أدواتك، وابدأ بمهمة واحدة فقط.</span></div>
      </aside>
    </div>
  </div>;
}


function PlannerPage({ tasks, userId }: { tasks: StudyTask[]; userId: string }) {
  const [seconds,setSeconds]=useState(25*60);
  const [running,setRunning]=useState(false);
  const [mode,setMode]=useState<'focus'|'break'>('focus');
  const [customMinutes,setCustomMinutes]=useState('40');
  const [sessionLength,setSessionLength]=useState(25*60);
  const [completedSessions,setCompletedSessions]=useState(0);
  const [taskOrder,setTaskOrder]=useState<string[]>(()=>{
    try{return JSON.parse(window.localStorage.getItem('enghub-task-priority-order:'+userId)||'[]') as string[];}catch{return [];}
  });
  useEffect(()=>{ try { setTaskOrder(JSON.parse(window.localStorage.getItem('enghub-task-priority-order:'+userId)||'[]') as string[]); } catch { setTaskOrder([]); } },[userId]);
  useEffect(()=>{
    if(!running)return;
    const timer=window.setInterval(()=>setSeconds(value=>{
      if(value<=1){setRunning(false);if(mode==='focus')setCompletedSessions(count=>count+1);return 0;}
      return value-1;
    }),1000);
    return ()=>window.clearInterval(timer);
  },[running,mode]);
  const switchMode=(next:'focus'|'break')=>{setMode(next);const length=next==='focus'?25*60:5*60;setSessionLength(length);setSeconds(length);setRunning(false);};
  const reset=()=>{setRunning(false);setSeconds(sessionLength);};
  const applyCustomTime=()=>{
    const minutes=Math.max(1,Math.min(240,Number(customMinutes)||25));
    const length=minutes*60;
    setRunning(false);setMode('focus');setSessionLength(length);setSeconds(length);setCustomMinutes(String(minutes));
  };
  const moveTask=(id:string,direction:-1|1)=>{
    const current=[...orderedUpcoming.map(task=>task.id)];
    const index=current.indexOf(id);const next=index+direction;
    if(index<0||next<0||next>=current.length)return;
    [current[index],current[next]]=[current[next],current[index]];
    setTaskOrder(current);window.localStorage.setItem('enghub-task-priority-order:'+userId,JSON.stringify(current));
  };
  const timeLabel=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  const today=new Date();
  const upcoming=[...tasks].filter(task=>task.status!=='completed').sort((a,b)=>new Date(a.dueAt).getTime()-new Date(b.dueAt).getTime());
  const orderMap=new Map(taskOrder.map((id,index)=>[id,index]));
  const orderedUpcoming=[...upcoming].sort((a,b)=>{
    const ai=orderMap.get(a.id),bi=orderMap.get(b.id);
    if(ai!==undefined&&bi!==undefined)return ai-bi;
    if(ai!==undefined)return -1;if(bi!==undefined)return 1;
    return new Date(a.dueAt).getTime()-new Date(b.dueAt).getTime();
  });
  const todayTasks=upcoming.filter(task=>new Date(task.dueAt).toDateString()===today.toDateString());
  const percent=Math.max(0,Math.min(100,Math.round(((sessionLength-seconds)/sessionLength)*100)));
  return <div className="eh-planner-page">
    <PageHeader eyebrow="STUDY PLANNER" title="مخطط المذاكرة" description="قسّم وقتك، رتّب أولوياتك، وركّز على مهمة واحدة في كل مرة."/>
    <section className="eh-planner-summary">
      <div><span className="eh-eyebrow">TODAY</span><h2>{today.toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'})}</h2><p>لديك {todayTasks.length} مهمة بموعد انتهاء اليوم.</p></div>
      <div className="eh-planner-summary-count"><b>{completedSessions}</b><span>جلسات تركيز مكتملة في هذه الزيارة</span></div>
    </section>
    <div className="eh-planner-grid">
      <section className="eh-surface-card eh-focus-card">
        <div className="eh-card-heading"><div><span className="eh-eyebrow">FOCUS MODE</span><h2>مؤقت التركيز</h2><p>اختر جلسة جاهزة أو حدّد المدة التي تناسبك.</p></div><span className="eh-focus-icon"><Timer size={20}/></span></div>
        <button type="button" className="eh-focus-open-link" onClick={()=>window.location.hash="#/focus"}><span>افتح مساحة التركيز الكاملة</span><ArrowLeft size={15}/></button>
        <div className="eh-focus-tabs"><button type="button" className={mode==='focus'?'active':''} onClick={()=>switchMode('focus')}>جلسة تركيز · 25 دقيقة</button><button type="button" className={mode==='break'?'active':''} onClick={()=>switchMode('break')}>استراحة · 5 دقائق</button></div>
        <div className="eh-custom-timer"><label htmlFor="eh-custom-minutes">تحديد وقت يدوي (بالدقائق)</label><div><input id="eh-custom-minutes" type="number" min="1" max="240" value={customMinutes} onChange={event=>setCustomMinutes(event.target.value)}/><button type="button" className="eh-button" onClick={applyCustomTime}>تطبيق الوقت</button></div><small>يمكنك اختيار مدة من دقيقة واحدة حتى 4 ساعات.</small></div>
        <div className="eh-focus-clock" style={{'--focus-progress':percent*3.6+'deg'} as React.CSSProperties}>
          <div><small>{mode==='focus'?'FOCUS SESSION':'SHORT BREAK'}</small><b>{timeLabel}</b><span>{running?'أنت في جلسة تركيز':seconds===0?'انتهت الجلسة — أحسنت!':'جاهز عندما تكون مستعداً'}</span></div>
        </div>
        <div className="eh-focus-controls">
          <button type="button" className="eh-button primary" onClick={()=>{if(seconds===0)setSeconds(sessionLength);setRunning(value=>!value);}}>{running?<Pause size={16}/>:<Play size={16} fill="currentColor"/>}{running?'إيقاف مؤقت':seconds===0?'ابدأ من جديد':'ابدأ التركيز'}</button>
          <button type="button" className="eh-button" onClick={reset}><RotateCcw size={16}/> إعادة ضبط</button>
        </div>
        <div className="eh-focus-note"><Sparkles size={14}/> أبعد المشتتات وابدأ بمهمة واحدة فقط.</div>
      </section>
      <section className="eh-surface-card eh-planner-agenda">
        <div className="eh-card-heading"><div><span className="eh-eyebrow">YOUR PRIORITIES</span><h2>ترتيب المهام</h2><p>حرّك المهام لأعلى أو لأسفل حسب أولويتك.</p></div><span className="eh-agenda-count">{orderedUpcoming.length} مهام</span></div>
        <div className="eh-planner-timeline">
          {orderedUpcoming.map((task,index)=><article className="eh-planner-task eh-priority-task" key={task.id}>
            <div className="eh-priority-controls"><button type="button" onClick={()=>moveTask(task.id,-1)} disabled={index===0} aria-label="رفع أولوية المهمة"><ChevronUp size={15}/></button><button type="button" onClick={()=>moveTask(task.id,1)} disabled={index===orderedUpcoming.length-1} aria-label="خفض أولوية المهمة"><ChevronDown size={15}/></button></div>
            <div className="eh-planner-task-copy"><b>{task.title}</b><small>{task.subjectName||'مهمة عامة'} · موعد التسليم {new Date(task.dueAt).toLocaleDateString('ar-EG',{day:'numeric',month:'short'})}</small></div>
            <span className={'eh-planner-priority '+task.priority}>{priorityText[task.priority]}</span>
          </article>)}
          {orderedUpcoming.length===0&&<EmptyState title="لا توجد مهام مجدولة" body="عندما تُسند إليك مهام ستظهر هنا ويمكنك ترتيب أولوياتها."/>}
        </div>
      </section>
    </div>
  </div>;
}

function AnalyticsPage({ tasks, subjects, lectures, exams, completedVideos }: { tasks: StudyTask[]; subjects: Subject[]; lectures: Lecture[]; exams: Exam[]; completedVideos: number }) {
  const completed=tasks.filter(task=>task.status==='completed').length;
  const inProgress=tasks.filter(task=>task.status==='in-progress').length;
  const notStarted=tasks.filter(task=>task.status==='not-started').length;
  const completion=tasks.length?Math.round(completed/tasks.length*100):0;
  const late=tasks.filter(task=>task.status!=='completed'&&new Date(task.dueAt).getTime()<Date.now()).length;
  const completedExams=exams.filter(exam=>exam.status==='completed').length;
  const upcomingExams=exams.filter(exam=>exam.status==='upcoming').length;
  const availableExams=exams.filter(exam=>exam.status==='available').length;
  return <div className="eh-analytics-page">
    <PageHeader eyebrow="STUDY INSIGHTS" title="إحصائياتي" description="قراءة واضحة لتقدمك الأكاديمي من البيانات المسجلة في حسابك."/>
    <section className="eh-analytics-hero">
      <div className="eh-analytics-overall">
        <span className="eh-eyebrow">OVERALL TASK COMPLETION</span><h2>تقدمك الدراسي</h2><p>{tasks.length?'تُحسب النسبة من المهام المسجلة فعلياً.':'ستظهر مؤشراتك بمجرد تسجيل المهام ومتابعة حالتها.'}</p>
        <div className="eh-analytics-progress"><span style={{width:completion+'%'}}/></div>
        <div className="eh-analytics-progress-label"><b>{completion}%</b><small>{completed} من {tasks.length} مهمة مكتملة</small></div>
      </div>
      <div className="eh-analytics-ring" style={{'--analytics-degree':completion*3.6+'deg'} as React.CSSProperties}><div><b>{completion}%</b><span>نسبة الإنجاز</span></div></div>
    </section>
    <section className="eh-analytics-kpis">
      <div><span className="eh-kpi-icon green"><CheckCircle2 size={19}/></span><small>مهام مكتملة</small><b>{completed}</b><em>من إجمالي {tasks.length}</em></div>
      <div><span className="eh-kpi-icon blue"><Activity size={19}/></span><small>قيد التنفيذ</small><b>{inProgress}</b><em>مهام تعمل عليها</em></div>
      <div><span className="eh-kpi-icon purple"><Clock3 size={19}/></span><small>لم تبدأ</small><b>{notStarted}</b><em>بانتظار البدء</em></div>
      <div><span className="eh-kpi-icon amber"><AlertCircle size={19}/></span><small>متأخرة</small><b>{late}</b><em>تجاوزت موعد الانتهاء</em></div>
    </section>
    <div className="eh-analytics-grid">
      <section className="eh-surface-card">
        <div className="eh-card-heading"><div><span className="eh-eyebrow">SUBJECT PROGRESS</span><h2>التقدم حسب المادة</h2><p>نسب التقدم التي سجلها النظام للمقررات</p></div></div>
        <div className="eh-analytics-subject-list">
          {subjects.map(subject=>{
            const subjectTasks=tasks.filter(task=>task.subjectId===subject.id || (!task.subjectId && task.subjectName.trim()===subject.name.trim()));
            const subjectDone=subjectTasks.filter(task=>task.status==='completed').length;
            const subjectProgress=subjectTasks.length?Math.round(subjectDone/subjectTasks.length*100):0;
            const subjectLectures=lectures.filter(lecture=>lecture.subjectId===subject.id).length;
            return <div className="eh-analytics-subject" key={subject.id}>
              <span className="eh-analytics-subject-mark" style={{'--subject-color':subject.color} as React.CSSProperties}>{subject.icon||'∑'}</span>
              <span className="eh-analytics-subject-copy"><b>{subject.name}</b><small>{subject.code} · {subjectDone}/{subjectTasks.length} مهام · {subjectLectures} محاضرات</small><i><span style={{width:subjectProgress+'%',background:subject.color}}/></i></span>
              <strong>{subjectProgress}%</strong>
            </div>;
          })}
          {subjects.length===0&&<EmptyState title="لا توجد مواد لتحليلها" body="ستظهر المواد هنا بعد نشرها وإضافة بيانات التقدم."/>}
        </div>
      </section>
      <section className="eh-surface-card">
        <div className="eh-card-heading"><div><span className="eh-eyebrow">ASSESSMENTS</span><h2>الاختبارات والتقييمات</h2><p>ملخص حالة الاختبارات المسجلة</p></div></div>
        <div className="eh-content-insights">
          <div><span><ClipboardList size={17}/></span><b>{exams.length}</b><small>اختبار منشور</small></div>
          <div><span><Clock3 size={17}/></span><b>{upcomingExams+availableExams}</b><small>قادم أو متاح</small></div>
          <div><span><CheckCircle2 size={17}/></span><b>{completedExams}</b><small>اختبار مكتمل</small></div>
        </div>
        <div className="eh-analytics-disclaimer"><Info size={15}/> درجات المحاولات ستظهر عند ربط الاختبارات بمحرك حل وتسجيل نتائج فعلي؛ لا نعرض درجات افتراضية.</div>
      </section>
      <section className="eh-surface-card">
        <div className="eh-card-heading"><div><span className="eh-eyebrow">LEARNING CONTENT</span><h2>المحتوى الدراسي</h2><p>المحاضرات والمقررات المتاحة</p></div></div>
        <div className="eh-content-insights">
          <div><span><BookOpen size={17}/></span><b>{subjects.length}</b><small>مادة منشورة</small></div>
          <div><span><Video size={17}/></span><b>{lectures.length}</b><small>محاضرة منشورة</small></div>
          <div><span><CheckCircle2 size={17}/></span><b>{completedVideos}</b><small>فيديو مكتمل</small></div>
        </div>
        <div className="eh-analytics-disclaimer"><Info size={15}/> لا نحسب ساعات مذاكرة تقديرية؛ ستظهر الساعات فقط عند توفر سجل جلسات فعلي.</div>
      </section>
    </div>
  </div>;
}

function NotificationsPage({ items, setItems }: { items: AppNotification[]; setItems: (fn: (items: AppNotification[]) => AppNotification[]) => void }) {
  const [filter,setFilter]=useState<'all'|'unread'>('all');
  const visible=items.filter(item=>filter==='all'||!item.read);
  const unread=items.filter(item=>!item.read).length;
  return <div className="eh-notifications-page">
    <PageHeader eyebrow="NOTIFICATION CENTER" title="الإشعارات" description="كل التحديثات والتنبيهات المتعلقة بمساحتك الدراسية." action={unread>0?<button type="button" className="eh-button" onClick={()=>setItems(all=>all.map(item=>({...item,read:true})))}><CheckCheck size={16}/> تحديد الكل كمقروء</button>:null}/>
    <section className="eh-surface-card eh-notifications-board">
      <div className="eh-notifications-toolbar"><div><span className="eh-eyebrow">YOUR UPDATES</span><h2>مركز التنبيهات</h2><p>لديك {unread} إشعارات غير مقروءة</p></div><div className="eh-notifications-tabs"><button type="button" className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>الكل <small>{items.length}</small></button><button type="button" className={filter==='unread'?'active':''} onClick={()=>setFilter('unread')}>غير مقروء <small>{unread}</small></button></div></div>
      {visible.map(item=>{const Icon=iconForKind[item.kind];return <article className={'eh-notification-item '+(!item.read?'unread':'')} key={item.id}>
        <span className={'eh-notification-icon '+item.kind}><Icon size={19}/></span>
        <div className="eh-notification-copy"><b>{item.title}</b><p>{item.body}</p><small>{item.time}</small></div>
        <button type="button" className="eh-notification-toggle" onClick={()=>setItems(all=>all.map(current=>current.id===item.id?{...current,read:!current.read}:current))} aria-label={item.read?'تحديد كغير مقروء':'تحديد كمقروء'}>{item.read?<Check size={16}/>:<span/>}</button>
      </article>;})}
      {visible.length===0&&<EmptyState title={filter==='unread'?'لا توجد تنبيهات غير مقروءة':'لا توجد إشعارات حتى الآن'} body={filter==='unread'?'لقد راجعت جميع الإشعارات.':'ستظهر هنا الإشعارات المتعلقة بمهامك ومحاضراتك.'}/>}
    </section>
  </div>;
}

function AdminPage({ tasks, subjects, lecturers, lectures, exams, files, currentUser, cloudinarySettings, academicCalendar, onSaveAcademicCalendar, onNewTask, onAddSubject, onAddLecturer, onAddLecture, onAddExam, onSaved, onError }: {
  tasks: StudyTask[];
  subjects: Subject[];
  lecturers: Lecturer[];
  lectures: Lecture[];
  exams: Exam[];
  files: LibraryFile[];
  currentUser: AppUser;
  cloudinarySettings: CloudinarySettings;
  academicCalendar: AcademicCalendarSettings;
  onSaveAcademicCalendar: (settings: AcademicCalendarSettings) => Promise<void>;
  onNewTask: () => void;
  onAddSubject: () => void;
  onAddLecturer: () => void;
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
  const [academicYearDraft, setAcademicYearDraft] = useState('');
  const [termDraft, setTermDraft] = useState('');
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [calendarDraft, setCalendarDraft] = useState<AcademicCalendarSettings>(academicCalendar);
  useEffect(() => setCalendarDraft(academicCalendar), [academicCalendar]);
  const addCalendarValue = (kind: 'years' | 'terms') => {
    const value = (kind === 'years' ? academicYearDraft : termDraft).trim();
    if (!value) return;
    setCalendarDraft(current => ({...current,[kind]:Array.from(new Set([...current[kind],value]))}));
    if (kind === 'years') setAcademicYearDraft(''); else setTermDraft('');
  };
  const saveCalendar = async () => {
    if (!calendarDraft.years.length || !calendarDraft.terms.length) { onError('أضف سنة دراسية وفصلاً دراسياً واحداً على الأقل.'); return; }
    setCalendarSaving(true);
    try { await onSaveAcademicCalendar(calendarDraft); }
    catch (error) { onError(error instanceof Error ? error.message : 'تعذر حفظ التقويم الدراسي.'); }
    finally { setCalendarSaving(false); }
  };

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
    <div className="admin-tabs">{[{ id: 'overview', label: 'نظرة عامة' }, { id: 'academic', label: 'المحتوى الأكاديمي' }, { id: 'tasks', label: 'إدارة المهام' }, { id: 'users', label: 'المستخدمون والصلاحيات' }, { id: 'academic-calendar', label: 'السنوات والفصول' }, { id: 'cloudinary', label: 'إعدادات Cloudinary' }].map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={tab === item.id ? 'active' : ''}>{item.label}</button>)}</div>
    {tab === 'academic-calendar' && <section className="panel admin-content-list eh-calendar-admin">
      <div className="panel-head"><div><h3>إدارة السنوات والفصول الدراسية</h3><span>تظهر الاختيارات الحالية لجميع الطلاب في القائمة الجانبية.</span></div><span className="admin-status"><i/> إعدادات عامة</span></div>
      <div className="eh-calendar-current">
        <label>السنة الدراسية الحالية<select value={calendarDraft.activeYear} onChange={event=>setCalendarDraft(current=>({...current,activeYear:event.target.value}))}>{calendarDraft.years.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
        <label>الفصل الدراسي الحالي<select value={calendarDraft.activeTerm} onChange={event=>setCalendarDraft(current=>({...current,activeTerm:event.target.value}))}>{calendarDraft.terms.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      </div>
      <div className="eh-calendar-columns">
        <div><h4>السنوات الدراسية</h4><div className="eh-calendar-add"><input value={academicYearDraft} onChange={event=>setAcademicYearDraft(event.target.value)} placeholder="مثال: السنة الأولى"/><button type="button" className="btn btn-primary btn-small" onClick={()=>addCalendarValue('years')}><Plus size={14}/> إضافة</button></div>
          {calendarDraft.years.map(value=><div className="eh-calendar-item" key={value}><span>{value}</span>{calendarDraft.activeYear===value?<b>الحالية</b>:<button type="button" onClick={()=>setCalendarDraft(current=>({...current,years:current.years.filter(item=>item!==value)}))}>حذف</button>}</div>)}
        </div>
        <div><h4>الفصول الدراسية</h4><div className="eh-calendar-add"><input value={termDraft} onChange={event=>setTermDraft(event.target.value)} placeholder="مثال: الترم الصيفي"/><button type="button" className="btn btn-primary btn-small" onClick={()=>addCalendarValue('terms')}><Plus size={14}/> إضافة</button></div>
          {calendarDraft.terms.map(value=><div className="eh-calendar-item" key={value}><span>{value}</span>{calendarDraft.activeTerm===value?<b>الحالي</b>:<button type="button" onClick={()=>setCalendarDraft(current=>({...current,terms:current.terms.filter(item=>item!==value)}))}>حذف</button>}</div>)}
        </div>
      </div>
      <div className="eh-calendar-save"><button type="button" className="btn btn-primary" onClick={()=>void saveCalendar()} disabled={calendarSaving}>{calendarSaving?<span className="spinner"/>:<Check size={16}/>} حفظ وتطبيق على المنصة</button></div>
      <p className="eh-calendar-note"><Info size={14}/> تغيير الفصل الحالي يحدّث عنوان الفصل الظاهر للطلاب. لا يتم حذف محتوى الفصول السابقة عند التغيير.</p>
    </section>}
    {tab === 'overview' && <>
      <div className="admin-stats">
        <StatCard label="المواد الدراسية" value={subjects.length.toString()} detail="مواد منشورة" icon={<BookOpen size={18}/>} tone="blue"/>
        <StatCard label="المهام" value={tasks.length.toString()} detail="مهام مسجلة" icon={<ListChecks size={18}/>} tone="green"/>
        <StatCard label="المحاضرات" value={lectures.length.toString()} detail="محاضرات منشورة" icon={<Video size={18}/>} tone="purple"/>
        <StatCard label="الاختبارات" value={exams.length.toString()} detail="اختبارات منشورة" icon={<ClipboardList size={18}/>} tone="amber"/>
      </div>
      <div className="admin-quick-grid">
        <button onClick={onAddSubject}><div><BookOpen size={19}/></div><b>إضافة مادة</b><span>إنشاء مقرر دراسي</span></button>
        <button onClick={onNewTask}><div><ListChecks size={19}/></div><b>إنشاء مهمة</b><span>نشر تكليف للطلاب</span></button>
        <button onClick={onAddLecturer} disabled={subjects.length === 0}><div><GraduationCap size={19}/></div><b>إضافة مدرس</b><span>ربط مدرس بمادة دراسية</span></button>
        <button onClick={onAddLecture} disabled={lecturers.length === 0}><div><Video size={19}/></div><b>إضافة محاضرة</b><span>إنشاء محاضرة تحت مدرس</span></button>
        <button onClick={onAddExam}><div><ClipboardList size={19}/></div><b>إضافة اختبار</b><span>حدد المادة والموعد والمدة</span></button>
      </div>
      <div className="panel admin-content-list admin-storage-summary"><div className="panel-head"><div><h3>حالة المكتبة</h3><span>أرقام فعلية من المحتوى المسجل</span></div></div><div className="admin-summary-numbers"><div><b>{files.length}</b><span>ملف</span></div><div><b>{subjects.reduce((sum, subject) => sum + subject.lectures, 0)}</b><span>عدد المحاضرات المرتبطة بالمواد</span></div></div></div>
    </>}
    {tab === 'academic' && <>
      <div className="panel admin-content-list">
        <div className="panel-head"><div><h3>المواد الدراسية</h3><span>الترم الأول — أضف المواد الفعلية للطلاب</span></div><button className="btn btn-primary btn-small" onClick={onAddSubject}><Plus size={14}/> إضافة مادة</button></div>
        {subjects.map((subject) => <div className="admin-list-row" key={subject.id}><div className="subject-mini-icon" style={{ background: subject.color + '18', color: subject.color }}>{subject.icon}</div><div><b>{subject.name}</b><span>{subject.code} · {subject.description || 'مقرر دراسي'}</span></div><span>{subject.lectures} محاضرة</span><span className="status-chip status-completed">منشورة</span></div>)}
        {subjects.length === 0 && <EmptyState title="لا توجد مواد بعد" body="ابدأ بإضافة أول مادة دراسية."/ >}
      </div>
      <div className="panel admin-content-list">
        <div className="panel-head"><div><h3>المدرسون</h3><span>كل مدرس مرتبط بمادة مستقلة</span></div><button className="btn btn-primary btn-small" onClick={onAddLecturer} disabled={subjects.length === 0}><Plus size={14}/> إضافة مدرس</button></div>
        {lecturers.map((lecturer) => <div className="admin-list-row" key={lecturer.id}><div className="admin-task-symbol"><GraduationCap size={17}/></div><div><b>{lecturer.name}</b><span>{lecturer.subjectName}</span></div><span>{lectures.filter((item) => item.lecturerId === lecturer.id).length} محاضرة</span></div>)}
        {lecturers.length === 0 && <EmptyState title="لا يوجد مدرسون بعد" body="أضف مدرساً داخل صفحة المادة الدراسية."/ >}
      </div>
      <div className="panel admin-content-list">
        <div className="panel-head"><div><h3>المحاضرات</h3><span>أجزاء الفيديو تضاف داخل المحاضرة نفسها</span></div><button className="btn btn-primary btn-small" onClick={onAddLecture} disabled={lecturers.length === 0}><Plus size={14}/> إضافة محاضرة</button></div>
        {lectures.map((lecture) => <div className="admin-list-row" key={lecture.id}><div className="admin-task-symbol"><Video size={17}/></div><div><b>{lecture.title}</b><span>{lecture.subjectName} · {lecture.lecturerName || lecture.instructor || 'بدون مدرس'}</span></div><span>{lecture.partsCount ?? lecture.parts ?? 0} أجزاء</span></div>)}
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
  onSaveProfile: (profile: { displayName: string; photoURL?: string | null; phone?: string; bio?: string; profileVisibility?: 'public' | 'private'; showBioOnPublicProfile?: boolean; showAcademicInfoOnPublicProfile?: boolean }) => Promise<void>;
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
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'private'>(user.profileVisibility ?? 'public');
  const [showBioOnPublicProfile, setShowBioOnPublicProfile] = useState(user.showBioOnPublicProfile !== false);
  const [showAcademicInfoOnPublicProfile, setShowAcademicInfoOnPublicProfile] = useState(user.showAcademicInfoOnPublicProfile !== false);
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileLinkCopied, setProfileLinkCopied] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(user.displayName);
    setPhone(user.phone || '');
    setBio(user.bio || '');
    setProfileVisibility(user.profileVisibility ?? 'public');
    setShowBioOnPublicProfile(user.showBioOnPublicProfile !== false);
    setShowAcademicInfoOnPublicProfile(user.showAcademicInfoOnPublicProfile !== false);
    setPhotoURL(user.photoURL || '');
  }, [user.displayName, user.phone, user.bio, user.photoURL, user.profileVisibility, user.showBioOnPublicProfile, user.showAcademicInfoOnPublicProfile]);

  useEffect(() => {
    if (!photoFile) { setPhotoPreview(''); return; }
    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile]);

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
      await onSaveProfile({ displayName: name, photoURL: nextPhoto || null, phone, bio, profileVisibility, showBioOnPublicProfile, showAcademicInfoOnPublicProfile });
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

  const copyPublicProfileLink = async () => {
    const link = window.location.origin + window.location.pathname + '#/students/' + encodeURIComponent(user.uid);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(link);
      else {
        const field = document.createElement('textarea');
        field.value = link; field.setAttribute('readonly', '');
        field.style.position = 'fixed'; field.style.opacity = '0';
        document.body.appendChild(field); field.select();
        const copied = document.execCommand('copy'); field.remove();
        if (!copied) throw new Error('clipboard-unavailable');
      }
      setProfileLinkCopied(true);
      window.setTimeout(() => setProfileLinkCopied(false), 1800);
    } catch {
      setProfileMessage('تعذر نسخ الرابط. تحقق من صلاحية الحافظة في المتصفح.');
    }
  };

  return <div className="eh-profile-page">
    <PageHeader eyebrow="YOUR ACCOUNT" title="الملف الشخصي والإعدادات" description="تحكم في بياناتك وخصوصيتك وطريقة ظهور منصة ENG HUB."/>
    <section className="eh-profile-hero">
      <div className="eh-profile-cover"/>
      <div className="eh-profile-identity">
        <div className="eh-profile-avatar">{photoPreview||photoURL?<img src={photoPreview||photoURL} alt={user.displayName}/>:user.displayName.slice(0,1)}</div>
        <div className="eh-profile-name"><span className="eh-eyebrow">STUDENT PROFILE</span><h2>{user.displayName}</h2><p>{user.email}</p><span className="eh-profile-role">{user.role==='admin'||user.role==='super-admin'?'مدير المنصة':'طالب هندسة'}</span></div>
        <div className="eh-profile-academic-facts"><div><small>الفرقة</small><b>{user.academicYear}</b></div><div><small>الفصل الدراسي</small><b>{user.term}</b></div></div>
      </div>
    </section>

    <div className="eh-profile-grid">
      <section className="eh-surface-card eh-profile-editor">
        <div className="eh-card-heading"><div><span className="eh-eyebrow">PERSONAL DETAILS</span><h2>بياناتك الشخصية</h2><p>هذه البيانات التي تظهر في ملفك ورسائلك داخل المنصة.</p></div></div>
        <form className="eh-profile-form" onSubmit={(event)=>void saveProfile(event)}>
          <div className="eh-profile-photo-picker">
            <div className="eh-profile-photo-preview">{photoPreview||photoURL?<img src={photoPreview||photoURL} alt=""/>:name.slice(0,1)}</div>
            <div><b>الصورة الشخصية</b><span>اختر صورة واضحة ليتعرف عليك زملاؤك.</span></div>
            <label className="eh-button"><ImagePlus size={15}/> تغيير الصورة<input type="file" accept="image/*" className="visually-hidden" onChange={(event)=>setPhotoFile(event.target.files?.[0]??null)}/></label>
          </div>
          <label>الاسم الظاهر<input required minLength={2} maxLength={80} value={name} onChange={(event)=>setName(event.target.value)} placeholder="اسمك الكامل"/></label>
          <label>رقم الهاتف أو واتساب<input type="tel" maxLength={24} value={phone} onChange={(event)=>setPhone(event.target.value)} placeholder="+20 1xxxxxxxxx" dir="ltr"/></label>
          <label>نبذة مختصرة<textarea rows={4} maxLength={240} value={bio} onChange={(event)=>setBio(event.target.value)} placeholder="اكتب نبذة قصيرة عنك واهتماماتك الدراسية..."/></label>
          <section className="eh-profile-privacy" aria-label="خصوصية الملف الشخصي">
            <h3>خصوصية ملفك الشخصي</h3>
            <p>اختر ما إذا كان الطلاب الآخرون يستطيعون فتح ملفك ورؤية بياناته. تبقى صلاحيات الإدارة متاحة للمشرفين. الاسم والصورة يظلان ظاهرين في الرسائل للتعرّف على المرسل.</p>
            <div className="eh-profile-privacy-options">
              <button type="button" className={profileVisibility === 'public' ? 'selected' : ''} aria-pressed={profileVisibility === 'public'} onClick={() => setProfileVisibility('public')}><Users size={15}/> ملف عام</button>
              <button type="button" className={profileVisibility === 'private' ? 'selected' : ''} aria-pressed={profileVisibility === 'private'} onClick={() => setProfileVisibility('private')}><Lock size={15}/> ملف خاص</button>
            </div>
            <div className="eh-profile-privacy-extra">
              <label><span><b>إظهار النبذة في الملف العام</b><small>يمكنك إخفاء النبذة دون جعل الملف خاصاً.</small></span><input type="checkbox" checked={showBioOnPublicProfile} onChange={(event) => setShowBioOnPublicProfile(event.target.checked)} disabled={profileVisibility === 'private'}/></label>
              <label><span><b>إظهار الفرقة والفصل الدراسي</b><small>تحكم في ظهور المعلومات الدراسية داخل الملف العام.</small></span><input type="checkbox" checked={showAcademicInfoOnPublicProfile} onChange={(event) => setShowAcademicInfoOnPublicProfile(event.target.checked)} disabled={profileVisibility === 'private'}/></label>
            </div>
            {profileVisibility === 'public' && <button type="button" className="eh-button eh-profile-share-link" onClick={() => void copyPublicProfileLink()}>
              {profileLinkCopied ? <Check size={15}/> : <Copy size={15}/>}
              {profileLinkCopied ? 'تم نسخ رابط ملفك العام' : 'نسخ رابط ملفك العام'}
            </button>}
          </section>
          {profileMessage&&<div className="eh-inline-feedback" role="status">{profileMessage}</div>}
          <div className="eh-profile-form-footer"><small>آخر البيانات المحفوظة تظهر في ملفك مباشرة.</small><button type="submit" className="eh-button primary" disabled={savingProfile||name.trim().length<2}>{savingProfile?<span className="spinner"/>:<Check size={16}/>} حفظ التغييرات</button></div>
        </form>
      </section>

      <aside className="eh-profile-settings-column">
        <section className="eh-surface-card eh-profile-settings">
          <div className="eh-card-heading"><div><span className="eh-eyebrow">APPEARANCE</span><h2>مظهر المنصة</h2><p>اختر المظهر الأنسب لك.</p></div><span className="eh-setting-symbol"><Sun size={18}/></span></div>
          <div className="eh-theme-options">
            <button type="button" className={themePreference==='system'?'selected':''} onClick={()=>onThemeChange('system')} aria-pressed={themePreference==='system'}><Monitor size={17}/><span>حسب الجهاز</span></button>
            <button type="button" className={themePreference==='light'?'selected':''} onClick={()=>onThemeChange('light')} aria-pressed={themePreference==='light'}><Sun size={17}/><span>فاتح</span></button>
            <button type="button" className={themePreference==='dark'?'selected':''} onClick={()=>onThemeChange('dark')} aria-pressed={themePreference==='dark'}><Moon size={17}/><span>داكن</span></button>
          </div>
          <p className="eh-settings-caption">{themePreference==='system'?'يتغير المظهر تلقائياً حسب جهازك.':themePreference==='light'?'المظهر الفاتح مفعل حالياً.':'المظهر الداكن مفعل حالياً.'}</p>
        </section>

        <section className="eh-surface-card eh-profile-settings">
          <div className="eh-card-heading"><div><span className="eh-eyebrow">NOTIFICATIONS</span><h2>الإشعارات</h2><p>إدارة تنبيهات المتصفح.</p></div><span className="eh-setting-symbol"><Bell size={18}/></span></div>
          <div className="eh-setting-entry"><span className="eh-setting-entry-icon"><Bell size={16}/></span><div><b>إشعارات هذا المتصفح</b><small>{isDemo?'متاحة بعد ربط Firebase.':pushGranted?'إذن الإشعارات مفعل.':'لم يتم السماح بالإشعارات بعد.'}</small></div><button type="button" className="eh-button small" onClick={()=>void activatePush()} disabled={isDemo||pushBusy}>{pushBusy?<span className="spinner"/>:pushGranted?'تحديث':'تفعيل'}</button></div>
          {pushMessage&&<p className="eh-settings-caption">{pushMessage}</p>}
        </section>

        <section className="eh-surface-card eh-profile-settings">
          <div className="eh-card-heading"><div><span className="eh-eyebrow">SECURITY & SESSION</span><h2>الحساب والجلسة</h2><p>معلومات الاتصال وإدارة الجلسة الحالية.</p></div><span className="eh-setting-symbol"><ShieldCheck size={18}/></span></div>
          <div className="eh-setting-entry"><span className="eh-setting-entry-icon"><ShieldCheck size={16}/></span><div><b>حالة الاتصال</b><small>{isDemo?'وضع تجريبي':'متصل بخدمات Firebase'}</small></div><span className={'eh-online-status '+(isDemo?'offline':'')}>{isDemo?'Demo':'Online'}</span></div>
          {isDemo&&<div className="eh-setting-entry"><span className="eh-setting-entry-icon"><Users size={16}/></span><div><b>تجربة دور المدير</b><small>للعرض التجريبي فقط</small></div><button type="button" className="eh-button small" onClick={onToggleRole}>تبديل الدور</button></div>}
          <div className="eh-setting-entry"><span className="eh-setting-entry-icon"><LogOut size={16}/></span><div><b>تسجيل الخروج</b><small>إنهاء جلستك الحالية على هذا الجهاز.</small></div><button type="button" className="eh-button small" onClick={()=>void onLogout()}>تسجيل الخروج</button></div>
        </section>

        <section className="eh-surface-card eh-profile-danger">
          <div><span className="eh-eyebrow">DANGER ZONE</span><h2>حذف الحساب</h2><p>سيتم حذف بيانات الحساب الشخصية من Firebase. ملفات Cloudinary الفعلية لا تُحذف تلقائياً من المتصفح.</p></div>
          <button type="button" className="eh-button danger" onClick={()=>{setShowDelete(true);setDeleteError('');}} disabled={isDemo||user.role==='admin'||user.role==='super-admin'}><Trash2 size={15}/> حذف الحساب</button>
        </section>
      </aside>
    </div>

    {showDelete&&<div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setShowDelete(false);}}>
      <section className="modal-card delete-account-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
        <div className="modal-head"><div><h2 id="delete-account-title">تأكيد حذف الحساب</h2><p>هذا الإجراء نهائي ولا يمكن التراجع عنه.</p></div><button type="button" className="icon-button" onClick={()=>setShowDelete(false)} aria-label="إغلاق"><X size={18}/></button></div>
        <form className="form-stack" onSubmit={(event)=>void confirmDelete(event)}>
          <div className="delete-warning"><AlertCircle size={18}/><span>سيتم حذف حساب تسجيل الدخول وملف المستخدم والبيانات الشخصية المرتبطة به من Firestore.</span></div>
          {!isDemo&&user.providerId==='password'&&<label>أدخل كلمة المرور لتأكيد هويتك<input type="password" required autoComplete="current-password" value={deletePassword} onChange={(event)=>setDeletePassword(event.target.value)}/></label>}
          {(user.role==='admin'||user.role==='super-admin')&&<p className="auth-error">لا يمكن حذف حساب مدير قبل تعطيل صلاحياته في مجموعة admins.</p>}
          {deleteError&&<p className="auth-error">{deleteError}</p>}
          <div className="modal-actions"><button type="button" className="eh-button" onClick={()=>setShowDelete(false)}>إلغاء</button><button type="submit" className="eh-button danger" disabled={deleting||isDemo||user.role==='admin'||user.role==='super-admin'}>{deleting?<span className="spinner"/>:<Trash2 size={15}/>} حذف نهائي</button></div>
        </form>
      </section>
    </div>}
  </div>;

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
  const [startAt, setStartAt] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
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
      startAt: new Date(startAt).toISOString(),
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
          <div className="form-row">
            <label>موعد بدء المهمة
              <input required type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} max={dueAt}/>
            </label>
            <label>موعد الانتهاء والتسليم
              <input required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} min={startAt}/>
            </label>
          </div>
          {new Date(dueAt) < new Date(startAt) && <p className="auth-error">يجب أن يكون موعد الانتهاء بعد موعد البداية.</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>إلغاء</button>
            <button type="submit" className="btn btn-primary" disabled={!title.trim() || !subjectId || new Date(dueAt) < new Date(startAt)}><Plus size={15}/> إنشاء المهمة</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function LecturerModal({ subject, onClose, onSave }: {
  subject: Subject | null; onClose: () => void;
  onSave: (data: { name: string; subjectId: string; subjectName: string; bio?: string; description?: string }) => void;
}) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [description, setDescription] = useState('');
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="lecturer-modal-title">
      <div className="modal-head"><div><h2 id="lecturer-modal-title">إضافة مدرس للمادة</h2><p>{subject?.name || 'اختر مادة أولاً من صفحة المواد.'}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={18}/></button></div>
      {!subject ? <EmptyState title="لم يتم اختيار مادة" body="افتح المادة المطلوبة ثم أضف المدرس من داخلها."/> : <form className="form-stack" onSubmit={(event) => { event.preventDefault(); onSave({ name: name.trim(), subjectId: subject.id, subjectName: subject.name, bio: bio.trim(), description: description.trim() }); }}>
        <label>اسم المدرس أو المعيد<input autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="اسم المدرس"/></label>
        <label>نبذة قصيرة<input maxLength={180} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="مثال: مدرس مادة التفاضل"/></label>
        <label>تفاصيل إضافية<textarea rows={3} maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="معلومات إضافية عن المدرس أو القسم..."/></label>
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose}>إلغاء</button><button type="submit" className="btn btn-primary" disabled={!name.trim()}><Plus size={15}/> إضافة المدرس</button></div>
      </form>}
    </section>
  </div>;
}

function LectureModal({ lecturers, selectedLecturerId, onClose, onSave }: {
  lecturers: Lecturer[]; selectedLecturerId: string; onClose: () => void;
  onSave: (data: { title: string; description?: string; lecturerId?: string; duration?: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [lecturerId, setLecturerId] = useState(selectedLecturerId || '');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const availableLecturers = lecturers.filter((item) => item.status === 'active');
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="lecture-modal-title">
      <div className="modal-head"><div><h2 id="lecture-modal-title">إنشاء محاضرة</h2><p>يمكنك ربطها بمدرس أو إنشاؤها مباشرة داخل المادة.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={18}/></button></div>
      <form className="form-stack" onSubmit={(event) => { event.preventDefault(); onSave({ title: title.trim(), ...(lecturerId ? { lecturerId } : {}), description: description.trim(), duration: duration.trim() }); }}>
        <label>المدرس (اختياري)<select value={lecturerId} onChange={(event) => setLecturerId(event.target.value)}><option value="">بدون مدرس — إنشاء مباشر داخل المادة</option>{availableLecturers.map((item) => <option key={item.id} value={item.id}>{item.subjectName} — {item.name}</option>)}</select></label>
        <label>عنوان المحاضرة<input autoFocus required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: مقدمة في المتجهات"/></label>
        <div className="form-row"><label>المدة الإجمالية (اختياري)<input maxLength={40} value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="مثال: 90 دقيقة"/></label><label>وصف المحاضرة<input maxLength={180} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="موضوعات المحاضرة"/></label></div>
        <p className="settings-hint">بعد الحفظ ستتمكن من إضافة أي عدد من أجزاء الفيديو والملفات والاختبارات المرتبطة بالمحاضرة.</p>
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose}>إلغاء</button><button type="submit" className="btn btn-primary" disabled={!title.trim()}><Plus size={15}/> إنشاء المحاضرة</button></div>
      </form>
    </section>
  </div>;
}

function LecturePartModal({ nextOrder, onClose, onSave }: {
  nextOrder: number; onClose: () => void;
  onSave: (data: { title: string; videoUrl: string; duration: string; order: number }) => void;
}) {
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [duration, setDuration] = useState('');
  const [order, setOrder] = useState(String(nextOrder));
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="part-modal-title">
      <div className="modal-head"><div><h2 id="part-modal-title">إضافة جزء للمحاضرة</h2><p>أضف رابط فيديو واحداً لهذا الجزء.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={18}/></button></div>
      <form className="form-stack" onSubmit={(event) => { event.preventDefault(); onSave({ title: title.trim(), videoUrl: videoUrl.trim(), duration: duration.trim(), order: Math.max(1, Number(order) || nextOrder) }); }}>
        <label>عنوان الجزء<input autoFocus required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: الجزء الأول — شرح المفاهيم"/></label>
        <label>رابط الفيديو<input required type="url" dir="ltr" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="YouTube / Vimeo / MP4 / WEBM"/></label>
        <div className="form-row"><label>المدة<input value={duration} maxLength={40} onChange={(event) => setDuration(event.target.value)} placeholder="مثال: 25 دقيقة"/></label><label>ترتيب الجزء<input type="number" min="1" value={order} onChange={(event) => setOrder(event.target.value)}/></label></div>
        <p className="settings-hint">يدعم المشغل YouTube وVimeo وروابط الفيديو المباشرة. الروابط الخارجية الأخرى ستفتح حسب دعم المصدر.</p>
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose}>إلغاء</button><button type="submit" className="btn btn-primary" disabled={!title.trim() || !videoUrl.trim()}><Plus size={15}/> حفظ الجزء</button></div>
      </form>
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
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('∫');
  const [color, setColor] = useState('#8b7cff');
  const colors = ['#8b7cff', '#41c8ad', '#f0ad62', '#5d9eff', '#ec82ad', '#9aabbd', '#d1a25b'];

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({ name: name.trim(), code: code.trim().toUpperCase(), description: description.trim(), icon: icon.trim() || '✳', color });
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
            <label>وصف المادة (اختياري)
              <input maxLength={180} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="نبذة قصيرة عن المقرر"/>
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
            <button type="submit" className="btn btn-primary" disabled={!name.trim() || !code.trim()}><Plus size={15}/> إضافة المادة</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default App;
