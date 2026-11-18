export type AcademicContentKind =
  | 'folder'
  | 'lecturer'
  | 'lecture'
  | 'video'
  | 'file'
  | 'exam'
  | 'assignment'
  | 'link'
  | 'note'
  | 'custom';

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
  /** Display label for administrator-defined content types. */
  customTypeName?: string;
  /** Optional emoji or short text symbol for an administrator-defined type. */
  customTypeIcon?: string;
  /** Hex color selected for an administrator-defined type. */
  customTypeColor?: string;
  /** Custom nodes can be folders or standalone items. */
  canContainChildren?: boolean;
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
  customTypeName?: string;
  customTypeIcon?: string;
  customTypeColor?: string;
  canContainChildren?: boolean;
  publicationStatus?: AcademicPublicationStatus;
  sortOrder?: number;
}

export function isAcademicContentContainer(
  node: Pick<AcademicContentNode, 'kind' | 'canContainChildren'>,
): boolean {
  if (node.kind === 'folder' || node.kind === 'lecturer' || node.kind === 'lecture') return true;
  return node.kind === 'custom' && node.canContainChildren === true;
}
