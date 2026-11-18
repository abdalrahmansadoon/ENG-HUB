import type { Timestamp } from 'firebase/firestore';

export type AcademicContentKind =
  | 'folder'
  | 'lecture'
  | 'video'
  | 'file'
  | 'exam'
  | 'assignment'
  | 'link'
  | 'note';

export type AcademicContentCategory =
  | 'lectures'
  | 'files'
  | 'exams'
  | 'assignments'
  | 'resources'
  | 'custom';

export type AcademicPublicationStatus = 'draft' | 'published';

export interface AcademicContentNode {
  id: string;
  subjectId: string;
  parentId: string | null;
  kind: AcademicContentKind;
  category: AcademicContentCategory;
  title: string;
  description: string;
  url?: string;
  mimeType?: string;
  duration?: string;
  linkedNodeIds: string[];
  publicationStatus: AcademicPublicationStatus;
  sortOrder: number;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateAcademicContentInput {
  parentId?: string | null;
  kind: AcademicContentKind;
  category: AcademicContentCategory;
  title: string;
  description?: string;
  url?: string;
  mimeType?: string;
  duration?: string;
  linkedNodeIds?: string[];
  publicationStatus?: AcademicPublicationStatus;
  sortOrder?: number;
}
