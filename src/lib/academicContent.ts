import {
  addDoc, arrayRemove, arrayUnion, collection, doc, onSnapshot, query, serverTimestamp,
  updateDoc, where, writeBatch, setDoc, type Unsubscribe,
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
        customTypeName: typeof data.customTypeName === 'string' ? data.customTypeName : undefined,
        customTypeIcon: typeof data.customTypeIcon === 'string' ? data.customTypeIcon : undefined,
        iconName: typeof data.iconName === 'string' ? data.iconName : undefined,
        customTypeColor: typeof data.customTypeColor === 'string' ? data.customTypeColor : undefined,
        canContainChildren: typeof data.canContainChildren === 'boolean' ? data.canContainChildren : undefined,
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
  if (!['folder', 'lecturer', 'lecture', 'note', 'custom'].includes(input.kind) && !input.url?.trim()) {
    throw new Error('أضف رابط أو ملفاً لهذا النوع من المحتوى.');
  }
  if (input.kind === 'custom' && !input.customTypeName?.trim()) {
    throw new Error('اكتب اسم النوع المخصص الذي تريد إنشاءه.');
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
    customTypeName: input.kind === 'custom' ? input.customTypeName?.trim() ?? 'نوع مخصص' : null,
    customTypeIcon: input.kind === 'custom' ? input.customTypeIcon?.trim() ?? '✳' : null,
    iconName: input.iconName?.trim() || null,
    customTypeColor: input.kind === 'custom' ? input.customTypeColor ?? '#4169e1' : null,
    canContainChildren: input.kind === 'custom' ? input.canContainChildren === true : null,
    publicationStatus: input.publicationStatus ?? 'published',
    sortOrder: input.sortOrder ?? Date.now(),
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (input.linkedNodeIds?.length) {
    const batch = writeBatch(requireDb());
    input.linkedNodeIds.forEach((linkedId) => {
      batch.update(doc(requireDb(), 'subjects', subjectId, 'contentNodes', linkedId), { linkedNodeIds: arrayUnion(ref.id), updatedAt: serverTimestamp() });
    });
    await batch.commit();
  }
  return ref.id;
}

export async function updateAcademicContentNode(
  subjectId: string,
  nodeId: string,
  patch: Partial<Pick<AcademicContentNode, 'kind' | 'title' | 'description' | 'url' | 'mimeType' | 'duration' | 'parentId' | 'category' | 'linkedNodeIds' | 'customTypeName' | 'customTypeIcon' | 'iconName' | 'customTypeColor' | 'canContainChildren' | 'publicationStatus' | 'sortOrder'>>,
) {
  const allowed: Record<string, any> = { ...patch, updatedAt: serverTimestamp() };
  if (typeof patch.title === 'string') allowed.title = patch.title.trim();
  if (Array.isArray(patch.linkedNodeIds)) {
    const firestore = requireDb();
    const currentRef = doc(firestore, 'subjects', subjectId, 'contentNodes', nodeId);
    const current = await (await import('firebase/firestore')).getDoc(currentRef);
    const previousIds: string[] = Array.isArray(current.data()?.linkedNodeIds) ? (current.data()!.linkedNodeIds as unknown[]).filter((id: unknown): id is string => typeof id === 'string') : [];
    const nextIds: string[] = [...new Set(patch.linkedNodeIds as string[])].filter((id: string) => id !== nodeId);
    const batch = writeBatch(firestore);
    batch.update(currentRef, { ...allowed, linkedNodeIds: nextIds });
    previousIds.filter((id) => !nextIds.includes(id)).forEach((id) => batch.update(doc(firestore, 'subjects', subjectId, 'contentNodes', id), { linkedNodeIds: arrayRemove(nodeId), updatedAt: serverTimestamp() }));
    nextIds.filter((id) => !previousIds.includes(id)).forEach((id) => batch.update(doc(firestore, 'subjects', subjectId, 'contentNodes', id), { linkedNodeIds: arrayUnion(nodeId), updatedAt: serverTimestamp() }));
    await batch.commit();
    return;
  }
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
  const removedIds = new Set(ids);
  const survivors = snapshot.docs.filter((entry) => !removedIds.has(entry.id) && Array.isArray(entry.data().linkedNodeIds) && entry.data().linkedNodeIds.some((id: unknown) => typeof id === 'string' && removedIds.has(id)));
  const operations = [
    ...ids.map((id) => ({ type: 'delete' as const, id })),
    ...survivors.map((entry) => ({ type: 'unlink' as const, id: entry.id, linked: (entry.data().linkedNodeIds as string[]).filter((id) => !removedIds.has(id)) })),
  ];
  for (let offset = 0; offset < operations.length; offset += 400) {
    const batch = writeBatch(firestore);
    operations.slice(offset, offset + 400).forEach((operation) => {
      const ref = doc(firestore, 'subjects', subjectId, 'contentNodes', operation.id);
      if (operation.type === 'delete') batch.delete(ref);
      else batch.update(ref, { linkedNodeIds: operation.linked, updatedAt: serverTimestamp() });
    });
    await batch.commit();
  }
  return ids.length;
}

export async function saveAcademicContentLinks(subjectId: string, nodeId: string, linkedNodeIds: string[]) {
  await updateAcademicContentNode(subjectId, nodeId, { linkedNodeIds });
}

export function subscribeCompletedAcademicContent(uid: string, onData: (ids: Set<string>) => void, onError: (error: Error) => void): Unsubscribe | undefined {
  if (!db || !uid) return;
  return onSnapshot(collection(db, 'users', uid, 'completedContent'), (snapshot) => {
    onData(new Set(snapshot.docs.map((entry) => entry.id)));
  }, onError);
}
export async function setAcademicContentCompleted(uid: string, nodeId: string, completed: boolean) {
  const firestore = requireDb();
  const ref = doc(firestore, 'users', uid, 'completedContent', nodeId);
  if (completed) await setDoc(ref, { nodeId, completedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  else {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(ref);
  }
}
