import {
  addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, type Unsubscribe,
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
  attachments: ChatAttachment[];
  replyTo?: { id: string; text: string; senderName: string } | null;
}

const GENERAL_CHAT_ID = 'general';

function requireDb() {
  if (!db) throw new Error('Firebase غير متصل.');
  return db;
}

export async function joinGeneralChat(user: { uid: string; displayName: string; photoURL?: string | null }) {
  const firestore = requireDb();
  const conversationRef = doc(firestore, 'conversations', GENERAL_CHAT_ID);

  // Only the first user creates the fixed public room. For later users this
  // create-only write is denied as an update; they then create their own member row.
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

  await setDoc(doc(conversationRef, 'members', user.uid), {
    userId: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL ?? null,
    joinedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  }, { merge: true });
}

export function subscribeGeneralChat(
  onMessages: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const firestore = requireDb();
  const messagesQuery = query(
    collection(firestore, 'conversations', GENERAL_CHAT_ID, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(150),
  );
  return onSnapshot(messagesQuery, (snapshot) => {
    onMessages(snapshot.docs.map((entry) => {
      const data = entry.data();
      const timestamp = data.createdAt?.toDate?.() as Date | undefined;
      return {
        id: entry.id,
        text: String(data.text ?? ''),
        senderId: String(data.senderId ?? ''),
        senderName: String(data.senderName ?? 'طالب'),
        senderPhotoURL: typeof data.senderPhotoURL === 'string' ? data.senderPhotoURL : null,
        createdAt: timestamp ?? null,
        attachments: Array.isArray(data.attachments) ? data.attachments as ChatAttachment[] : [],
        replyTo: data.replyTo ?? null,
      };
    }));
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
    createdAt: serverTimestamp(),
  });
}

export async function deleteGeneralChatMessage(messageId: string) {
  await deleteDoc(doc(requireDb(), 'conversations', GENERAL_CHAT_ID, 'messages', messageId));
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
