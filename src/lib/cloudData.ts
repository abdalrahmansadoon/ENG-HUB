import {
  addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, writeBatch, where, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Exam, Lecture, LibraryFile, StudyTask, Subject, TaskStatus } from '../types';

function requireDb() {
  if (!db) throw new Error('Firebase غير متصل.');
  return db;
}

export function subscribeTasks(uid: string, isAdmin: boolean, onData: (items: StudyTask[]) => void, onError: (error: Error) => void): Unsubscribe | undefined {
  if (!db) return;
  const base = collection(db, 'tasks');
  const baseQuery = isAdmin
    ? query(base, orderBy('createdAt', 'desc'))
    : query(base, where('status', '==', 'published'), where('assignedTo', 'array-contains', uid), orderBy('dueAt', 'asc'));

  let taskDocs: StudyTask[] = [];
  const assignmentStatuses = new Map<string, TaskStatus>();
  const assignmentStops = new Map<string, Unsubscribe>();
  const publish = () => onData(taskDocs.map((task) => ({
    ...task,
    status: assignmentStatuses.get(task.id) ?? task.status ?? 'not-started',
  })));

  const stopTasks = onSnapshot(baseQuery, (snapshot) => {
    taskDocs = snapshot.docs.map((entry) => {
      const data = entry.data();
      const due = data.dueAt?.toDate?.() ?? (data.dueAt ? new Date(data.dueAt) : new Date());
      const created = data.createdAt?.toDate?.() ?? (data.createdAt ? new Date(data.createdAt) : new Date());
      return {
        id: entry.id,
        title: String(data.title ?? 'مهمة بدون عنوان'),
        description: String(data.description ?? ''),
        subjectId: String(data.subjectId ?? ''),
        subjectName: String(data.subjectName ?? ''),
        priority: data.priority ?? 'normal',
        status: data.statusByDefault ?? 'not-started',
        dueAt: due.toISOString(),
        assignedTo: Array.isArray(data.assignedTo) ? data.assignedTo : [],
        createdBy: String(data.createdBy ?? ''),
        createdAt: created.toISOString(),
      } as StudyTask;
    });

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
  const q = isAdmin ? query(ref, orderBy('sortOrder', 'asc')) : query(ref, where('isPublished', '==', true), orderBy('sortOrder', 'asc'));
  return onSnapshot(q, (snapshot) => onData(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as Subject))), onError);
}

export function subscribeLectures(onData: (items: Lecture[]) => void, onError: (error: Error) => void): Unsubscribe | undefined {
  if (!db) return;
  const q = query(collection(db, 'lectures'), where('publicationStatus', '==', 'published'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => onData(snapshot.docs.map((entry) => { const data = entry.data(); const date = data.createdAt?.toDate?.() ?? new Date(); return { id: entry.id, ...data, date: date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }) } as Lecture; })), onError);
}

export function subscribeExams(onData: (items: Exam[]) => void, onError: (error: Error) => void): Unsubscribe | undefined {
  if (!db) return;
  const q = query(collection(db, 'exams'), where('publicationStatus', '==', 'published'), orderBy('startAt', 'asc'));
  return onSnapshot(q, (snapshot) => onData(snapshot.docs.map((entry) => { const data = entry.data(); const start = data.startAt?.toDate?.() ?? new Date(); return { id: entry.id, ...data, date: start.toISOString(), status: data.examStatus ?? 'upcoming' } as Exam; })), onError);
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
    const students = await getDocs(query(
      collection(firestore, 'users'),
      where('role', '==', 'student'),
      where('status', '==', 'active'),
    ));
    assigned = students.docs.map((student) => student.id);
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
    startAt: serverTimestamp(),
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

export async function createLectureCloud(input: {
  title: string; subjectId: string; subjectName: string; instructor: string; duration: string; videoUrl: string;
}) {
  return addDoc(collection(requireDb(), 'lectures'), {
    ...input,
    parts: 1,
    progress: 0,
    publicationStatus: 'published',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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
