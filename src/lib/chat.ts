import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

export interface ChatAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export type ChatReactions = Record<string, string[]>;

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string | null;
  createdAt: Date | null;
  editedAt?: Date | null;
  edited?: boolean;
  pinned?: boolean;
  pinnedBy?: string | null;
  attachments: ChatAttachment[];
  replyTo?: { id: string; text: string; senderName: string } | null;
  reactions: ChatReactions;
}

const GENERAL_CHAT_ID = 'general';
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '👏'];

function requireDb() {
  if (!db) throw new Error('Firebase غير متصل.');
  return db;
}

function messageRef(messageId: string) {
  return doc(requireDb(), 'conversations', GENERAL_CHAT_ID, 'messages', messageId);
}

function timestampToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export async function joinGeneralChat(user: { uid: string; displayName: string; photoURL?: string | null }) {
  const firestore = requireDb();
  const conversationRef = doc(firestore, 'conversations', GENERAL_CHAT_ID);

  try {
    await setDoc(conversationRef, {
      title: 'المحادثة العامة',
      type: 'global',
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code !== 'permission-denied') throw error;
  }

  const memberRef = doc(conversationRef, 'members', user.uid);
  const memberSnapshot = await getDoc(memberRef);
  if (memberSnapshot.exists()) {
    await updateDoc(memberRef, {
      displayName: user.displayName,
      photoURL: user.photoURL ?? null,
      lastSeenAt: serverTimestamp(),
    });
  } else {
    await setDoc(memberRef, {
      userId: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL ?? null,
      joinedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    });
  }
}

export function subscribeGeneralChat(
  onMessages: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const firestore = requireDb();
  const messagesQuery = query(
    collection(firestore, 'conversations', GENERAL_CHAT_ID, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(200),
  );
  return onSnapshot(messagesQuery, (snapshot) => {
    onMessages(snapshot.docs.map((entry) => {
      const data = entry.data();
      return {
        id: entry.id,
        text: String(data.text ?? ''),
        senderId: String(data.senderId ?? ''),
        senderName: String(data.senderName ?? 'طالب'),
        senderPhotoURL: typeof data.senderPhotoURL === 'string' ? data.senderPhotoURL : null,
        createdAt: timestampToDate(data.createdAt),
        editedAt: timestampToDate(data.editedAt),
        edited: data.edited === true,
        pinned: data.pinned === true,
        pinnedBy: typeof data.pinnedBy === 'string' ? data.pinnedBy : null,
        attachments: Array.isArray(data.attachments) ? data.attachments as ChatAttachment[] : [],
        replyTo: data.replyTo && typeof data.replyTo === 'object' ? data.replyTo : null,
        reactions: data.reactions && typeof data.reactions === 'object' ? data.reactions as ChatReactions : {},
      } as ChatMessage;
    }).reverse());
  }, onError);
}

export async function sendGeneralChatMessage(input: {
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string | null;
  attachments?: ChatAttachment[];
  replyTo?: { id: string; text: string; senderName: string } | null;
}) {
  const firestore = requireDb();
  if (!input.text.trim() && !input.attachments?.length) return;
  if (input.text.length > 5000) throw new Error('الرسالة طويلة جداً. الحد الأقصى 5000 حرف.');
  await addDoc(collection(firestore, 'conversations', GENERAL_CHAT_ID, 'messages'), {
    text: input.text.trim(),
    senderId: input.senderId,
    senderName: input.senderName,
    senderPhotoURL: input.senderPhotoURL ?? null,
    attachments: input.attachments ?? [],
    replyTo: input.replyTo ?? null,
    reactions: {},
    pinned: false,
    createdAt: serverTimestamp(),
  });
}

export async function editGeneralChatMessage(messageId: string, senderId: string, text: string) {
  const nextText = text.trim();
  if (!nextText) throw new Error('لا يمكن حفظ رسالة فارغة.');
  if (nextText.length > 5000) throw new Error('الرسالة طويلة جداً. الحد الأقصى 5000 حرف.');
  const ref = messageRef(messageId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('هذه الرسالة لم تعد موجودة.');
  const data = snapshot.data();
  if (data.senderId !== senderId) throw new Error('يمكنك تعديل رسائلك فقط.');
  const createdAt = timestampToDate(data.createdAt);
  if (!createdAt || Date.now() - createdAt.getTime() > EDIT_WINDOW_MS) {
    throw new Error('انتهت مهلة تعديل الرسالة (15 دقيقة).');
  }
  await updateDoc(ref, {
    text: nextText,
    edited: true,
    editedAt: serverTimestamp(),
  });
}

export async function toggleGeneralChatReaction(messageId: string, userId: string, emoji: string) {
  if (!ALLOWED_REACTIONS.includes(emoji)) throw new Error('رمز التفاعل غير مدعوم.');
  const firestore = requireDb();
  await runTransaction(firestore, async (transaction) => {
    const ref = doc(firestore, 'conversations', GENERAL_CHAT_ID, 'messages', messageId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('هذه الرسالة لم تعد موجودة.');
    const reactions = (snapshot.data().reactions ?? {}) as ChatReactions;
    const current = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
    const next = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    const updated = { ...reactions };
    if (next.length) updated[emoji] = next;
    else delete updated[emoji];
    transaction.update(ref, { reactions: updated });
  });
}

export async function toggleGeneralChatPin(messageId: string, adminId: string, pinned: boolean) {
  await updateDoc(messageRef(messageId), {
    pinned,
    pinnedBy: pinned ? adminId : null,
    pinnedAt: pinned ? serverTimestamp() : null,
  });
}

export async function deleteGeneralChatMessage(messageId: string) {
  await deleteDoc(messageRef(messageId));
}

export async function deleteGeneralChatRoomMessages() {
  const firestore = requireDb();
  const snapshot = await getDocs(collection(firestore, 'conversations', GENERAL_CHAT_ID, 'messages'));
  for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
    const batch = writeBatch(firestore);
    snapshot.docs.slice(offset, offset + 400).forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
  }
}
