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
  providerId?: string;
  role: UserRole;
  academicYear: string;
  term: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  instructor: string;
  color: string;
  icon: string;
  lectures: number;
  progress: number;
  nextClass?: string;
}

export interface StudyTask {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  subjectName: string;
  priority: Priority;
  status: TaskStatus;
  dueAt: string;
  assignedTo: string[];
  createdBy: string;
  createdAt: string;
}

export interface Lecture {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  instructor: string;
  duration: string;
  parts: number;
  progress: number;
  date: string;
  videoUrl?: string;
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
