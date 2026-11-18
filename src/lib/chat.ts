import {
  addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, setDoc, updateDoc, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

export interface ChatAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string | null;
  createdAt: Date | null;
  edited?: boolean;
  editedAt?: Date | null;
  attachments: ChatAttachment[];
  replyTo?: { id: string; text: string; senderName: string } | null;
  reactions?: Record<string, string[]>;
}

const GENERAL_CHAT_ID = 'general';

function requireDb() {
  if (!db) throw new Error('Firebase غير متصل.');
  return db;
}

function messageRef(messageId: string) {
  return doc(requireDb(), 'conversations', GENERAL_CHAT_ID, 'messages', messageId);
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
    limit(150),
  );
  return onSnapshot(messagesQuery, (snapshot) => {
    onMessages(snapshot.docs.map((entry) => {
      const data = entry.data();
      const timestamp = data.createdAt?.toDate?.() as Date | undefined;
      const editedAt = data.editedAt?.toDate?.() as Date | undefined;
      const rawReactions = data.reactions && typeof data.reactions === 'object' ? data.reactions as Record<string, unknown> : {};
      const reactions = Object.fromEntries(
        Object.entries(rawReactions).map(([emoji, ids]) => [emoji, Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []]),
      );
      return {
        id: entry.id,
        text: String(data.text ?? ''),
        senderId: String(data.senderId ?? ''),
        senderName: String(data.senderName ?? 'طالب'),
        senderPhotoURL: typeof data.senderPhotoURL === 'string' ? data.senderPhotoURL : null,
        createdAt: timestamp ?? null,
        edited: data.edited === true,
        editedAt: editedAt ?? null,
        attachments: Array.isArray(data.attachments) ? data.attachments as ChatAttachment[] : [],
        replyTo: data.replyTo ?? null,
        reactions,
      };
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
  await addDoc(collection(firestore, 'conversations', GENERAL_CHAT_ID, 'messages'), {
    text: input.text.trim(),
    senderId: input.senderId,
    senderName: input.senderName,
    senderPhotoURL: input.senderPhotoURL ?? null,
    attachments: input.attachments ?? [],
    replyTo: input.replyTo ?? null,
    reactions: {},
    createdAt: serverTimestamp(),
  });
}

export async function updateGeneralChatMessage(messageId: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('لا يمكن حفظ رسالة فارغة.');
  await updateDoc(messageRef(messageId), {
    text: trimmed,
    edited: true,
    editedAt: serverTimestamp(),
  });
}

export async function toggleGeneralChatReaction(messageId: string, emoji: string, userId: string) {
  const ref = messageRef(messageId);
  await runTransaction(requireDb(), async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('هذه الرسالة لم تعد موجودة.');
    const data = snapshot.data();
    const raw = data.reactions && typeof data.reactions === 'object' ? data.reactions as Record<string, unknown> : {};
    const reactions: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(raw)) {
      reactions[key] = Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
    }
    const users = reactions[emoji] ?? [];
    reactions[emoji] = users.includes(userId) ? users.filter((id) => id !== userId) : [...users, userId];
    transaction.update(ref, { reactions });
  });
}

export async function deleteGeneralChatMessage(messageId: string) {
  await deleteDoc(messageRef(messageId));
}

export async function deleteGeneralChatRoomMessages() {
  const firestore = requireDb();
  const snapshot = await import('firebase/firestore').then(({ getDocs }) =>
    getDocs(collection(firestore, 'conversations', GENERAL_CHAT_ID, 'messages')),
  );
  for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(firestore);
    snapshot.docs.slice(offset, offset + 400).forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
  }
}
