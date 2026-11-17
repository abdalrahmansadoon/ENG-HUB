import type { AppNotification, Exam, Lecture, LibraryFile, StudyTask, Subject } from '../types';

export const demoSubjects: Subject[] = [
  { id: 'calculus', name: 'Calculus 1', code: 'MTH 101', instructor: 'د. أحمد سمير', color: '#8b7cff', icon: '∫', lectures: 12, progress: 72, nextClass: 'الأحد، 10:00 ص' },
  { id: 'physics', name: 'Physics 1', code: 'PHY 101', instructor: 'د. محمد عادل', color: '#41c8ad', icon: 'Φ', lectures: 10, progress: 48, nextClass: 'الاثنين، 12:00 م' },
  { id: 'cs', name: 'Computer Science', code: 'CSE 101', instructor: 'م. كريم خالد', color: '#f0ad62', icon: '</>', lectures: 9, progress: 84, nextClass: 'الثلاثاء، 09:00 ص' },
  { id: 'statics', name: 'Statics', code: 'MEC 101', instructor: 'د. محمود شريف', color: '#5d9eff', icon: '⚙', lectures: 11, progress: 36, nextClass: 'الأربعاء، 11:00 ص' },
  { id: 'algebra', name: 'Algebra', code: 'MTH 102', instructor: 'د. سارة علي', color: '#ec82ad', icon: 'Σ', lectures: 8, progress: 60 },
  { id: 'critical', name: 'Critical Thinking', code: 'HUM 101', instructor: 'د. منى حسن', color: '#9aabbd', icon: '✳', lectures: 6, progress: 90 },
  { id: 'drawing', name: 'Technical Drawing', code: 'ENG 101', instructor: 'م. يوسف إبراهيم', color: '#d1a25b', icon: '⌁', lectures: 7, progress: 42 },
];

export const demoTasks: StudyTask[] = [
  { id: 't1', title: 'حل ورقة التمارين رقم 03', description: 'حل المسائل من 1 إلى 12 وتسليم ملف PDF.', subjectId: 'calculus', subjectName: 'Calculus 1', priority: 'urgent', status: 'in-progress', dueAt: '2026-11-19T23:59:00', assignedTo: ['demo-student'], createdBy: 'م. أحمد', createdAt: '2026-11-14' },
  { id: 't2', title: 'تقرير تجربة الحركة', description: 'كتابة التقرير وإرفاق الرسوم البيانية.', subjectId: 'physics', subjectName: 'Physics 1', priority: 'high', status: 'not-started', dueAt: '2026-11-21T20:00:00', assignedTo: ['demo-student'], createdBy: 'د. محمد', createdAt: '2026-11-15' },
  { id: 't3', title: 'مراجعة محاضرة Data Types', description: 'مشاهدة الجزء الثاني وحل أسئلة المراجعة.', subjectId: 'cs', subjectName: 'Computer Science', priority: 'normal', status: 'completed', dueAt: '2026-11-16T23:59:00', assignedTo: ['demo-student'], createdBy: 'م. كريم', createdAt: '2026-11-12' },
  { id: 't4', title: 'رسم Free Body Diagrams', description: 'تسليم الرسومات على ورقة A4.', subjectId: 'statics', subjectName: 'Statics', priority: 'high', status: 'under-review', dueAt: '2026-11-18T18:00:00', assignedTo: ['demo-student'], createdBy: 'د. محمود', createdAt: '2026-11-13' },
  { id: 't5', title: 'قراءة Chapter 2', description: 'تلخيص أهم الأفكار في صفحة واحدة.', subjectId: 'critical', subjectName: 'Critical Thinking', priority: 'low', status: 'not-started', dueAt: '2026-11-24T23:59:00', assignedTo: ['demo-student'], createdBy: 'د. منى', createdAt: '2026-11-16' },
];

export const demoLectures: Lecture[] = [
  { id: 'l1', title: 'Limits & Continuity', subjectId: 'calculus', subjectName: 'Calculus 1', instructor: 'د. أحمد سمير', duration: '48 دقيقة', parts: 3, progress: 100, date: '12 نوفمبر 2026' },
  { id: 'l2', title: 'Differentiation Rules', subjectId: 'calculus', subjectName: 'Calculus 1', instructor: 'د. أحمد سمير', duration: '56 دقيقة', parts: 2, progress: 64, date: '15 نوفمبر 2026' },
  { id: 'l3', title: 'Newton Laws', subjectId: 'physics', subjectName: 'Physics 1', instructor: 'د. محمد عادل', duration: '1 ساعة 12 دقيقة', parts: 3, progress: 25, date: '14 نوفمبر 2026' },
  { id: 'l4', title: 'Introduction to C++', subjectId: 'cs', subjectName: 'Computer Science', instructor: 'م. كريم خالد', duration: '42 دقيقة', parts: 2, progress: 0, date: '16 نوفمبر 2026' },
];

export const demoExams: Exam[] = [
  { id: 'e1', title: 'Quiz 02 — Derivatives', subjectName: 'Calculus 1', date: '2026-11-20T10:00:00', duration: '30 دقيقة', questions: 15, status: 'upcoming' },
  { id: 'e2', title: 'Practice Test — Mechanics', subjectName: 'Physics 1', date: '2026-11-22T12:00:00', duration: '45 دقيقة', questions: 20, status: 'available' },
  { id: 'e3', title: 'Weekly Assessment 01', subjectName: 'Computer Science', date: '2026-11-14T10:00:00', duration: '25 دقيقة', questions: 10, status: 'completed' },
];

export const demoFiles: LibraryFile[] = [
  { id: 'f1', name: 'Calculus — Lecture 04 Notes.pdf', type: 'PDF', subjectName: 'Calculus 1', size: '2.4 MB', updatedAt: 'منذ ساعتين' },
  { id: 'f2', name: 'Physics Lab — Experiment 02.pdf', type: 'PDF', subjectName: 'Physics 1', size: '1.8 MB', updatedAt: 'أمس' },
  { id: 'f3', name: 'C++ Basics — Slides.pptx', type: 'PPT', subjectName: 'Computer Science', size: '5.1 MB', updatedAt: 'منذ يومين' },
  { id: 'f4', name: 'Technical Drawing — Sheet 01.pdf', type: 'PDF', subjectName: 'Technical Drawing', size: '3.2 MB', updatedAt: 'منذ 3 أيام' },
];

export const demoNotifications: AppNotification[] = [
  { id: 'n1', title: 'موعد تسليم قريب', body: 'متبقي يومان على تسليم ورقة التمارين — Calculus 1.', time: 'منذ 15 دقيقة', read: false, kind: 'task' },
  { id: 'n2', title: 'محاضرة جديدة', body: 'تمت إضافة Introduction to C++ إلى Computer Science.', time: 'منذ 3 ساعات', read: false, kind: 'lecture' },
  { id: 'n3', title: 'اختبار قادم', body: 'Quiz 02 — Derivatives يوم 20 نوفمبر.', time: 'أمس', read: true, kind: 'exam' },
];
