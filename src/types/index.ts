export type UserRole = 'student' | 'admin' | 'moderator' | 'super-admin';
export type TaskStatus = 'not-started' | 'in-progress' | 'submitted' | 'under-review' | 'completed' | 'rejected' | 'overdue';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
  phone?: string;
  bio?: string;
  profileVisibility?: 'public' | 'private';
  providerId?: string;
  role: UserRole;
  academicYear: string;
  term: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  /** Kept optional only for legacy subject documents; new subjects do not store a lecturer. */
  instructor?: string;
  description?: string;
  coverImage?: string | null;
  color: string;
  icon: string;
  lectures: number;
  progress: number;
  nextClass?: string;
  sortOrder?: number;
}

export interface Lecturer {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  photoURL?: string | null;
  bio?: string;
  description?: string;
  displayOrder: number;
  status: 'active' | 'inactive';
}

export interface StudyTask {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  subjectName: string;
  priority: Priority;
  status: TaskStatus;
  /** Optional for legacy tasks created before start dates were introduced. */
  startAt?: string;
  dueAt: string;
  assignedTo: string[];
  createdBy: string;
  createdAt: string;
}

export interface Lecture {
  id: string;
  title: string;
  description?: string;
  subjectId: string;
  subjectName: string;
  lecturerId?: string;
  lecturerName?: string;
  /** Legacy field retained so previously created lecture cards remain readable. */
  instructor?: string;
  duration: string;
  parts?: number;
  partsCount?: number;
  progress: number;
  date: string;
  /** Legacy single-video field; new lectures use the parts subcollection. */
  videoUrl?: string;
  lectureNumber?: number;
}

export interface LecturePart {
  id: string;
  lectureId: string;
  title: string;
  videoUrl: string;
  duration: string;
  order: number;
  sourceType: 'youtube' | 'vimeo' | 'direct' | 'external';
  createdAt: string;
}

export interface Exam {
  id: string;
  title: string;
  subjectName: string;
  date: string;
  duration: string;
  questions: number;
  status: 'upcoming' | 'available' | 'completed';
}

export interface LibraryFile {
  id: string;
  name: string;
  type: 'PDF' | 'PPT' | 'DOC' | 'IMAGE' | 'VIDEO';
  subjectName: string;
  size: string;
  updatedAt: string;
  url?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  kind: 'task' | 'lecture' | 'exam' | 'system';
}
