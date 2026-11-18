import {
  addDoc, collection, doc, getDoc, getDocs, increment, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, writeBatch, where, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Exam, Lecture, LecturePart, Lecturer, LibraryFile, StudyTask, Subject, TaskStatus } from '../types';

function requireDb() {
  if (!db) throw new Error('Firebase غير متصل.');
  return db;
}

export function subscribeTasks(uid: string, isAdmin: boolean, onData: (items: StudyTask[]) => void, onError: (error: Error) => void): Unsubscribe | undefined {
  if (!db) return;
  const base = collection(db, 'tasks');
  // Keep this query to a single array-contains filter: no composite index is
  // required, and Firestore rules scope each student to assigned tasks only.
  const baseQuery = isAdmin
    ? query(base)
    : query(base, where('assignedTo', 'array-contains', uid));

  let taskDocs: StudyTask[] = [];
  const assignmentStatuses = new Map<string, TaskStatus>();
  const assignmentStops = new Map<string, Unsubscribe>();
  const publish = () => onData(taskDocs.map((task) => ({
    ...task,
    status: assignmentStatuses.get(task.id) ?? task.status ?? 'not-started',
  })));

  const stopTasks = onSnapshot(baseQuery, (snapshot) => {
    taskDocs = snapshot.docs.flatMap((entry) => {
      const data = entry.data();
      // A student query already limits documents to their UID. Filter unpublished
      // drafts locally so the query remains index-light without exposing them.
      if (!isAdmin && data.status !== 'published') return [];
      const due = data.dueAt?.toDate?.() ?? (data.dueAt ? new Date(data.dueAt) : new Date());
      const start = data.startAt?.toDate?.() ?? (data.startAt ? new Date(data.startAt) : undefined);
      const created = data.createdAt?.toDate?.() ?? (data.createdAt ? new Date(data.createdAt) : new Date());
      return [{
        id: entry.id,
        title: String(data.title ?? 'مهمة بدون عنوان'),
        description: String(data.description ?? ''),
        subjectId: String(data.subjectId ?? ''),
        subjectName: String(data.subjectName ?? ''),
        priority: data.priority ?? 'normal',
        status: data.statusByDefault ?? 'not-started',
        ...(start ? { startAt: start.toISOString() } : {}),
        dueAt: due.toISOString(),
        assignedTo: Array.isArray(data.assignedTo) ? data.assignedTo : [],
        createdBy: String(data.createdBy ?? ''),
        createdAt: created.toISOString(),
      } as StudyTask];
    }).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

    const currentIds = new Set(taskDocs.map((task) => task.id));
    for (const [taskId, stop] of assignmentStops) {
      if (!currentIds.has(taskId)) {
        stop();
        assignmentStops.delete(taskId);
        assignmentStatuses.delete(taskId);
      }
    }
    for (const task of taskDocs) {
      if (assignmentStops.has(task.id)) continue;
      const assignmentRef = doc(db!, 'tasks', task.id, 'assignments', uid);
      const stop = onSnapshot(assignmentRef, (assignment) => {
        const status = assignment.exists() ? assignment.data().status as TaskStatus | undefined : undefined;
        if (status) assignmentStatuses.set(task.id, status);
        else assignmentStatuses.delete(task.id);
        publish();
      }, onError);
      assignmentStops.set(task.id, stop);
    }
    publish();
  }, onError);

  return () => {
    stopTasks();
    assignmentStops.forEach((stop) => stop());
    assignmentStops.clear();
    assignmentStatuses.clear();
  };
}

export function subscribeSubjects(isAdmin: boolean, onData: (items: Subject[]) => void, onError: (error: Error) => void): Unsubscribe | undefined {
  if (!db) return;
  const ref = collection(db, 'subjects');
  // A single equality filter is enough for students; sort locally to avoid a composite index.
  const subjectsQuery = isAdmin ? query(ref) : query(ref, where('isPublished', '==', true));
  return onSnapshot(subjectsQuery, (snapshot) => {
    const items = snapshot.docs
      .map((entry) => ({ id: entry.id, ...entry.data() } as Subject & { isPublished?: boolean }))
      .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
    onData(items);
  }, onError);
}

export function subscribeLectures(onData: (items: Lecture[]) => void, onError: (error: Error) => void): Unsubscribe | undefined {
  if (!db) return;
  const q = query(collection(db, 'lectures'), where('publicationStatus', '==', 'published'));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((entry) => {
      const data = entry.data();
      const created = data.createdAt?.toDate?.() ?? new Date();
      return {
        id: entry.id,
        ...data,
        parts: Number(data.partsCount ?? data.parts ?? 0),
        partsCount: Number(data.partsCount ?? data.parts ?? 0),
        lecturerName: String(data.lecturerName ?? data.instructor ?? ''),
        date: created.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }),
        __sortAt: created.getTime(),
      } as Lecture & { __sortAt: number };
    }).sort((a, b) => b.__sortAt - a.__sortAt);
    onData(items.map(({ __sortAt, ...item }) => item));
  }, onError);
}

export function subscribeExams(onData: (items: Exam[]) => void, onError: (error: Error) => void): Unsubscribe | undefined {
  if (!db) return;
  const q = query(collection(db, 'exams'), where('publicationStatus', '==', 'published'));
  return onSnapshot(q, (snapshot) => onData(snapshot.docs.map((entry) => {
    const data = entry.data();
    const start = data.startAt?.toDate?.() ?? (data.startAt ? new Date(data.startAt) : new Date());
    return { id: entry.id, ...data, date: start.toISOString(), status: data.examStatus ?? 'upcoming' } as Exam;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())), onError);
}


type IndexedLibraryFile = LibraryFile & { __sortAt: number };

function mapLibraryFile(entry: { id: string; data: () => Record<string, any> }): IndexedLibraryFile {
  const data = entry.data();
  const updated = data.updatedAt?.toDate?.() ?? data.createdAt?.toDate?.() ?? new Date(0);
  return {
    id: entry.id,
    name: String(data.name ?? 'ملف بدون اسم'),
    type: data.type ?? 'PDF',
    subjectName: String(data.subjectName ?? ''),
    size: String(data.size ?? ''),
    updatedAt: updated.toLocaleDateString('ar-EG'),
    url: typeof data.url === 'string' ? data.url : undefined,
    __sortAt: updated.getTime(),
  } as IndexedLibraryFile;
}

export function subscribeFiles(uid: string, isAdmin: boolean, onData: (items: LibraryFile[]) => void, onError: (error: Error) => void): Unsubscribe | undefined {
  if (!db) return;
  const base = collection(db, 'files');

  if (isAdmin) {
    return onSnapshot(query(base, orderBy('createdAt', 'desc')), (snapshot) => {
      onData(snapshot.docs.map((entry) => {
        const { __sortAt, ...file } = mapLibraryFile(entry);
        return file;
      }));
    }, onError);
  }

  let publicFiles: IndexedLibraryFile[] = [];
  let ownFiles: IndexedLibraryFile[] = [];
  const publish = () => {
    const merged = new Map<string, IndexedLibraryFile>();
    for (const file of [...publicFiles, ...ownFiles]) merged.set(file.id, file);
    onData([...merged.values()]
      .sort((a, b) => b.__sortAt - a.__sortAt)
      .map(({ __sortAt, ...file }) => file));
  };
  const stopPublic = onSnapshot(query(base, where('visibility', '==', 'public')), (snapshot) => {
    publicFiles = snapshot.docs.map(mapLibraryFile);
    publish();
  }, onError);
  const stopOwn = onSnapshot(query(base, where('ownerId', '==', uid)), (snapshot) => {
    ownFiles = snapshot.docs.map(mapLibraryFile);
    publish();
  }, onError);
  return () => { stopPublic(); stopOwn(); };
}


export async function createTaskCloud(task: Omit<StudyTask, 'id' | 'createdAt' | 'createdBy'>, uid: string, displayName: string, isAdmin: boolean) {
  const firestore = requireDb();
  let assigned = task.assignedTo.length ? [...new Set(task.assignedTo)] : [uid];

  // General tasks must contain the actual student UIDs on the parent record;
  // otherwise student queries and Firestore read rules would hide the task.
  if (isAdmin) {
    const students = await getDocs(query(collection(firestore, 'users'), where('status', '==', 'active')));
    assigned = students.docs
      .filter((student) => student.data().role === 'student')
      .map((student) => student.id);
  }

  const taskRef = doc(collection(firestore, 'tasks'));
  await setDoc(taskRef, {
    title: task.title,
    description: task.description,
    subjectId: task.subjectId,
    subjectName: task.subjectName,
    type: isAdmin ? 'general' : 'personal',
    priority: task.priority,
    createdBy: uid,
    createdByName: displayName,
    startAt: task.startAt ? new Date(task.startAt) : serverTimestamp(),
    dueAt: new Date(task.dueAt),
    status: 'published',
    statusByDefault: 'not-started',
    assignedTo: assigned,
    reviewRequired: true,
    allowComments: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Firestore batches are limited to 500 writes; keep a safety margin.
  for (let offset = 0; offset < assigned.length; offset += 450) {
    const batch = writeBatch(firestore);
    for (const userId of assigned.slice(offset, offset + 450)) {
      batch.set(doc(firestore, 'tasks', taskRef.id, 'assignments', userId), {
        userId,
        status: 'not-started',
        assignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return taskRef.id;
}

export async function updateTaskStatusCloud(taskId: string, uid: string, status: TaskStatus) {
  await setDoc(doc(requireDb(), 'tasks', taskId, 'assignments', uid), { userId: uid, status, updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteTaskCloud(taskId: string) {
  const firestore = requireDb();
  const taskRef = doc(firestore, 'tasks', taskId);
  for (const childName of ['assignments', 'submissions', 'comments']) {
    const snapshot = await getDocs(collection(taskRef, childName));
    for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
      const batch = writeBatch(firestore);
      snapshot.docs.slice(offset, offset + 400).forEach((entry) => batch.delete(entry.ref));
      await batch.commit();
    }
  }
  const activity = await getDocs(collection(taskRef, 'activity'));
  if (!activity.empty) {
    for (let offset = 0; offset < activity.docs.length; offset += 400) {
      const batch = writeBatch(firestore);
      activity.docs.slice(offset, offset + 400).forEach((entry) => batch.delete(entry.ref));
      await batch.commit();
    }
  }
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(taskRef);
}

export function subscribeLecturers(onData: (items: Lecturer[]) => void, onError: (error: Error) => void): Unsubscribe | undefined {
  if (!db) return;
  return onSnapshot(query(collection(db, 'lecturers')), (snapshot) => {
    const items = snapshot.docs.map((entry) => {
      const data = entry.data();
      return {
        id: entry.id,
        name: String(data.name ?? 'مدرس'),
        subjectId: String(data.subjectId ?? ''),
        subjectName: String(data.subjectName ?? ''),
        photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
        bio: String(data.bio ?? ''),
        description: String(data.description ?? ''),
        displayOrder: Number(data.displayOrder ?? 0),
        status: data.status === 'inactive' ? 'inactive' : 'active',
      } as Lecturer;
    }).sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'ar'));
    onData(items);
  }, onError);
}

export function subscribeLectureParts(lectureId: string, onData: (items: LecturePart[]) => void, onError: (error: Error) => void): Unsubscribe | undefined {
  if (!db || !lectureId) { onData([]); return; }
  return onSnapshot(query(collection(db, 'lectures', lectureId, 'parts')), (snapshot) => {
    const items = snapshot.docs.map((entry) => {
      const data = entry.data();
      const created = data.createdAt?.toDate?.() ?? new Date();
      return {
        id: entry.id,
        lectureId,
        title: String(data.title ?? 'جزء بدون عنوان'),
        videoUrl: String(data.videoUrl ?? data.sourceUrl ?? ''),
        duration: String(data.duration ?? ''),
        order: Number(data.order ?? 0),
        sourceType: data.sourceType ?? 'external',
        createdAt: created.toISOString(),
      } as LecturePart;
    }).sort((a, b) => a.order - b.order);
    onData(items);
  }, onError);
}

export async function createLecturerCloud(input: {
  name: string; subjectId: string; subjectName: string; photoURL?: string | null; bio?: string; description?: string;
}) {
  const firestore = requireDb();
  const existing = await getDocs(query(collection(firestore, 'lecturers'), where('subjectId', '==', input.subjectId)));
  const displayOrder = existing.size;
  return addDoc(collection(firestore, 'lecturers'), {
    ...input,
    name: input.name.trim(),
    bio: input.bio?.trim() ?? '',
    description: input.description?.trim() ?? '',
    displayOrder,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createLectureCloud(input: {
  title: string; description?: string; subjectId: string; subjectName: string;
  lecturerId?: string; lecturerName?: string; duration?: string; lectureNumber?: number;
}) {
  const firestore = requireDb();
  const lectureRef = await addDoc(collection(firestore, 'lectures'), {
    ...input,
    lecturerId: input.lecturerId ?? '',
    lecturerName: input.lecturerName ?? '',
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    duration: input.duration?.trim() ?? '',
    partsCount: 0,
    parts: 0,
    progress: 0,
    publicationStatus: 'published',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(firestore, 'subjects', input.subjectId), {
    lectures: increment(1),
    updatedAt: serverTimestamp(),
  });
  return lectureRef;
}

function classifyVideoSource(url: string): LecturePart['sourceType'] {
  if (/youtu\.be|youtube\.com/i.test(url)) return 'youtube';
  if (/vimeo\.com/i.test(url)) return 'vimeo';
  if (/\.(mp4|webm|mov)(?:[?#]|$)/i.test(url)) return 'direct';
  return 'external';
}

export async function createLecturePartCloud(input: {
  lectureId: string; title: string; videoUrl: string; duration: string; order: number;
}) {
  const firestore = requireDb();
  const partRef = await addDoc(collection(firestore, 'lectures', input.lectureId, 'parts'), {
    title: input.title.trim(),
    videoUrl: input.videoUrl.trim(),
    duration: input.duration.trim(),
    order: input.order,
    sourceType: classifyVideoSource(input.videoUrl),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(firestore, 'lectures', input.lectureId), {
    partsCount: increment(1),
    parts: increment(1),
    updatedAt: serverTimestamp(),
  });
  return partRef;
}

export async function createExamCloud(input: {
  title: string; subjectName: string; date: string; duration: string; questions: number;
}) {
  return addDoc(collection(requireDb(), 'exams'), {
    title: input.title.trim(),
    subjectName: input.subjectName,
    startAt: new Date(input.date),
    duration: input.duration,
    questions: input.questions,
    examStatus: 'upcoming',
    publicationStatus: 'published',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createSubjectCloud(subject: Omit<Subject, 'id' | 'lectures' | 'progress'>) {
  return addDoc(collection(requireDb(), 'subjects'), {
    ...subject, academicYearId: 'prep', termId: 'term1', isPublished: true,
    sortOrder: Date.now(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export async function saveFileMetadataCloud(file: LibraryFile, ownerId: string, visibility: 'private' | 'public' = 'private') {
  await addDoc(collection(requireDb(), 'files'), {
    name: file.name, type: file.type, subjectName: file.subjectName, size: file.size,
    url: file.url ?? null, ownerId, visibility, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export interface AcademicCalendarSettings {
  years: string[];
  terms: string[];
  activeYear: string;
  activeTerm: string;
}
export const defaultAcademicCalendar: AcademicCalendarSettings = {
  years: ['السنة الإعدادية'],
  terms: ['الترم الأول', 'الترم الثاني'],
  activeYear: 'السنة الإعدادية',
  activeTerm: 'الترم الأول',
};
export function subscribeAcademicCalendar(onData: (settings: AcademicCalendarSettings) => void, onError: (error: Error) => void): Unsubscribe | undefined {
  if (!db) return;
  return onSnapshot(doc(db, 'systemSettings', 'academicCalendar'), (snapshot) => {
    const data = snapshot.exists() ? snapshot.data() : {};
    const years = Array.isArray(data.years) ? data.years.filter((item): item is string => typeof item === 'string') : defaultAcademicCalendar.years;
    const terms = Array.isArray(data.terms) ? data.terms.filter((item): item is string => typeof item === 'string') : defaultAcademicCalendar.terms;
    onData({
      years: years.length ? years : defaultAcademicCalendar.years,
      terms: terms.length ? terms : defaultAcademicCalendar.terms,
      activeYear: typeof data.activeYear === 'string' ? data.activeYear : defaultAcademicCalendar.activeYear,
      activeTerm: typeof data.activeTerm === 'string' ? data.activeTerm : defaultAcademicCalendar.activeTerm,
    });
  }, onError);
}
export async function saveAcademicCalendar(settings: AcademicCalendarSettings, uid: string) {
  const firestore = requireDb();
  if (!settings.years.includes(settings.activeYear) || !settings.terms.includes(settings.activeTerm)) {
    throw new Error('اختر سنة وفصلاً دراسياً من القوائم قبل الحفظ.');
  }
  await setDoc(doc(firestore, 'systemSettings', 'academicCalendar'), {
    ...settings, updatedBy: uid, updatedAt: serverTimestamp(),
  }, { merge: true });
}
