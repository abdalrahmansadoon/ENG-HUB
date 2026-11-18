import {
  addDoc, collection, doc, onSnapshot, query, serverTimestamp,
  updateDoc, where, writeBatch, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { AcademicContentNode, CreateAcademicContentInput } from '../types/academicContent';

function requireDb() {
  if (!db) throw new Error('Firebase غير متصل.');
  return db;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

const nodeCollection = (subjectId: string) =>
  collection(requireDb(), 'subjects', subjectId, 'contentNodes');

export function subscribeAcademicContent(
  subjectId: string,
  isAdmin: boolean,
  onData: (nodes: AcademicContentNode[]) => void,
  onError: (error: Error) => void,
): Unsubscribe | undefined {
  if (!db || !subjectId) { onData([]); return; }
  const base = nodeCollection(subjectId);
  const contentQuery = isAdmin
    ? query(base)
    : query(base, where('publicationStatus', '==', 'published'));
  return onSnapshot(contentQuery, (snapshot) => {
    const nodes = snapshot.docs.map((entry) => {
      const data = entry.data();
      return {
        id: entry.id,
        subjectId,
        parentId: typeof data.parentId === 'string' ? data.parentId : null,
        kind: data.kind ?? 'folder',
        category: data.category ?? 'custom',
        title: String(data.title ?? 'عنصر بدون عنوان'),
        description: String(data.description ?? ''),
        url: typeof data.url === 'string' ? data.url : undefined,
        mimeType: typeof data.mimeType === 'string' ? data.mimeType : undefined,
        duration: typeof data.duration === 'string' ? data.duration : undefined,
        linkedNodeIds: Array.isArray(data.linkedNodeIds) ? data.linkedNodeIds.filter((id): id is string => typeof id === 'string') : [],
        publicationStatus: data.publicationStatus === 'draft' ? 'draft' : 'published',
        sortOrder: Number(data.sortOrder ?? 0),
        createdBy: String(data.createdBy ?? ''),
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      } as AcademicContentNode;
    }).sort((a, b) => a.sortOrder - b.sortOrder || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
    onData(nodes);
  }, onError);
}

export async function createAcademicContentNode(
  subjectId: string,
  createdBy: string,
  input: CreateAcademicContentInput,
): Promise<string> {
  const title = input.title.trim();
  if (!subjectId) throw new Error('اختر المادة أولاً.');
  if (title.length < 2) throw new Error('اكتب عنواناً واضحاً من حرفين على الأقل.');
  if (!['folder', 'lecturer', 'lecture', 'note'].includes(input.kind) && !input.url?.trim()) {
    throw new Error('أضف رابط أو ملفاً لهذا النوع من المحتوى.');
  }
  const ref = await addDoc(nodeCollection(subjectId), {
    parentId: input.parentId ?? null,
    kind: input.kind,
    category: input.category,
    title,
    description: input.description?.trim() ?? '',
    url: input.url?.trim() ?? null,
    mimeType: input.mimeType ?? null,
    duration: input.duration?.trim() ?? '',
    linkedNodeIds: [...new Set(input.linkedNodeIds ?? [])],
    publicationStatus: input.publicationStatus ?? 'published',
    sortOrder: input.sortOrder ?? Date.now(),
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateAcademicContentNode(
  subjectId: string,
  nodeId: string,
  patch: Partial<Pick<AcademicContentNode, 'title' | 'description' | 'url' | 'duration' | 'parentId' | 'category' | 'linkedNodeIds' | 'publicationStatus' | 'sortOrder'>>,
) {
  const allowed: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() };
  if (typeof patch.title === 'string') allowed.title = patch.title.trim();
  if (Array.isArray(patch.linkedNodeIds)) allowed.linkedNodeIds = [...new Set(patch.linkedNodeIds)];
  await updateDoc(doc(requireDb(), 'subjects', subjectId, 'contentNodes', nodeId), allowed);
}

export async function deleteAcademicContentNode(subjectId: string, nodeId: string) {
  const firestore = requireDb();
  const all = await import('firebase/firestore');
  const ref = collection(firestore, 'subjects', subjectId, 'contentNodes');
  const snapshot = await all.getDocs(ref);
  const children = new Map<string, string[]>();
  snapshot.docs.forEach((entry) => {
    const parentId = entry.data().parentId;
    if (typeof parentId === 'string') {
      const list = children.get(parentId) ?? [];
      list.push(entry.id);
      children.set(parentId, list);
    }
  });
  const remove = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const child of children.get(current) ?? []) {
      if (!remove.has(child)) { remove.add(child); queue.push(child); }
    }
  }
  const ids = [...remove];
  for (let offset = 0; offset < ids.length; offset += 400) {
    const batch = writeBatch(firestore);
    ids.slice(offset, offset + 400).forEach((id) => batch.delete(doc(firestore, 'subjects', subjectId, 'contentNodes', id)));
    await batch.commit();
  }
  return ids.length;
}

export async function saveAcademicContentLinks(subjectId: string, nodeId: string, linkedNodeIds: string[]) {
  await updateAcademicContentNode(subjectId, nodeId, { linkedNodeIds });
}
