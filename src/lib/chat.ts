import {
  addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot,
  orderBy, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where,
  writeBatch, type Unsubscribe,
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
  deleted?: boolean;
  deletedAt?: Date | null;
  deletedBy?: string | null;
}
export interface ChatMuteStatus { muted: boolean; mutedUntil: Date | null; reason: string; }
export interface ChatSlowModeStatus { enabled: boolean; seconds: number; }
export interface ChatLockStatus {
  locked: boolean;
  startAt: Date | null;
  endAt: Date | null;
  reason: string;
  autoExpire: boolean;
}
export interface ChatWarning {
  id: string;
  userId: string;
  reason: string;
  createdAt: Date | null;
  createdBy: string;
  messageId?: string;
}
export interface ChatRoomInfo {
  id: string;
  title: string;
  type: 'global' | 'course';
  courseId?: string;
}
export interface ChatAnnouncement {
  id: string;
  text: string;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}
export const GENERAL_CHAT_ID = 'general';
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '👏'];

function requireDb() {
  if (!db) throw new Error('Firebase غير متصل.');
  return db;
}
function normalizeRoomId(roomId?: string) { return roomId?.trim() || GENERAL_CHAT_ID; }
function conversationRef(roomId?: string) {
  return doc(requireDb(), 'conversations', normalizeRoomId(roomId));
}
function messageCollection(roomId?: string) {
  return collection(requireDb(), 'conversations', normalizeRoomId(roomId), 'messages');
}
function messageRef(messageId: string, roomId?: string) {
  return doc(requireDb(), 'conversations', normalizeRoomId(roomId), 'messages', messageId);
}
function muteRef(userId: string, roomId?: string) {
  return doc(requireDb(), 'conversations', normalizeRoomId(roomId), 'mutes', userId);
}
function chatSettingsRef(roomId?: string) {
  return doc(requireDb(), 'conversations', normalizeRoomId(roomId), 'settings', 'chat');
}
function slowModeCooldownRef(userId: string, roomId?: string) {
  return doc(requireDb(), 'users', userId, 'chatSlowModeCooldowns', normalizeRoomId(roomId));
}
function timestampToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

/* Membership is created in the room subcollection. A course room is keyed by course_<subjectId>. */
export async function joinGeneralChat(
  user: { uid: string; displayName: string; photoURL?: string | null },
  roomId = GENERAL_CHAT_ID,
  roomTitle = 'المحادثة العامة',
  courseId?: string,
) {
  const firestore = requireDb();
  const normalizedRoomId = normalizeRoomId(roomId);
  const isCourseRoom = normalizedRoomId.startsWith('course_') && Boolean(courseId);
  const ref = doc(firestore, 'conversations', normalizedRoomId);
  try {
    await setDoc(ref, {
      title: roomTitle,
      type: isCourseRoom ? 'course' : 'global',
      ...(isCourseRoom ? { courseId } : {}),
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code !== 'permission-denied') throw error;
  }
  const memberRef = doc(ref, 'members', user.uid);
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

/* Realtime messages and user-specific hidden-message IDs for the selected room. */
export function subscribeGeneralChat(
  userId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void,
  roomId = GENERAL_CHAT_ID,
): Unsubscribe {
  const firestore = requireDb();
  const normalizedRoomId = normalizeRoomId(roomId);
  const messagesQuery = query(messageCollection(normalizedRoomId), orderBy('createdAt', 'desc'), limit(200));
  const hiddenRef = doc(firestore, 'users', userId, 'hiddenChatMessages', normalizedRoomId);
  let allMessages: ChatMessage[] = [];
  let hiddenIds = new Set<string>();
  const emit = () => onMessages(allMessages.filter((message) => !hiddenIds.has(message.id)));
  const stopMessages = onSnapshot(messagesQuery, (snapshot) => {
    allMessages = snapshot.docs.map((entry) => {
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
        deleted: data.deleted === true,
        deletedAt: timestampToDate(data.deletedAt),
        deletedBy: typeof data.deletedBy === 'string' ? data.deletedBy : null,
        pinned: data.pinned === true,
        pinnedBy: typeof data.pinnedBy === 'string' ? data.pinnedBy : null,
        attachments: Array.isArray(data.attachments) ? data.attachments as ChatAttachment[] : [],
        replyTo: data.replyTo && typeof data.replyTo === 'object' ? data.replyTo : null,
        reactions: data.reactions && typeof data.reactions === 'object' ? data.reactions as ChatReactions : {},
      } as ChatMessage;
    }).reverse();
    emit();
  }, onError);
  const stopHidden = onSnapshot(hiddenRef, (snapshot) => {
    const ids = snapshot.exists() && Array.isArray(snapshot.data().messageIds)
      ? snapshot.data().messageIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];
    hiddenIds = new Set(ids);
    emit();
  }, onError);
  return () => { stopMessages(); stopHidden(); };
}

export async function sendGeneralChatMessage(input: {
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string | null;
  attachments?: ChatAttachment[];
  replyTo?: { id: string; text: string; senderName: string } | null;
  isModerator?: boolean;
}, roomId = GENERAL_CHAT_ID) {
  const firestore = requireDb();
  const normalizedRoomId = normalizeRoomId(roomId);
  if (!input.text.trim() && !input.attachments?.length) return;
  if (input.text.length > 5000) throw new Error('الرسالة طويلة جداً. الحد الأقصى 5000 حرف.');

  const settingsRef = chatSettingsRef(normalizedRoomId);
  const cooldownRef = slowModeCooldownRef(input.senderId, normalizedRoomId);
  const messageRef = doc(messageCollection(normalizedRoomId));

  await runTransaction(firestore, async (transaction) => {
    const settingsSnapshot = await transaction.get(settingsRef);
    const settings = settingsSnapshot.exists() ? settingsSnapshot.data() : {};
    const slowEnabled = settings.slowModeEnabled === true && Number(settings.slowModeSeconds) >= 5;
    const seconds = Math.min(300, Math.max(5, Math.floor(Number(settings.slowModeSeconds) || 5)));

    if (slowEnabled && input.isModerator !== true) {
      const cooldownSnapshot = await transaction.get(cooldownRef);
      const cooldownUntil = cooldownSnapshot.exists() ? timestampToDate(cooldownSnapshot.data().until) : null;
      if (cooldownUntil && cooldownUntil.getTime() > Date.now()) {
        const remaining = Math.ceil((cooldownUntil.getTime() - Date.now()) / 1000);
        throw new Error(`الوضع البطيء مفعّل. انتظر ${remaining} ثانية قبل إرسال الرسالة التالية.`);
      }
      transaction.set(cooldownRef, {
        until: Timestamp.fromDate(new Date(Date.now() + seconds * 1000)),
        seconds,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    transaction.set(messageRef, {
      text: input.text.trim(),
      senderId: input.senderId,
      senderName: input.senderName,
      senderPhotoURL: input.senderPhotoURL ?? null,
      attachments: input.attachments ?? [],
      replyTo: input.replyTo ?? null,
      reactions: {},
      pinned: false,
      deleted: false,
      createdAt: serverTimestamp(),
    });
  });
}

export async function editGeneralChatMessage(messageId: string, senderId: string, text: string, roomId = GENERAL_CHAT_ID) {
  const nextText = text.trim();
  if (!nextText) throw new Error('لا يمكن حفظ رسالة فارغة.');
  if (nextText.length > 5000) throw new Error('الرسالة طويلة جداً. الحد الأقصى 5000 حرف.');
  const ref = messageRef(messageId, roomId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('هذه الرسالة لم تعد موجودة.');
  const data = snapshot.data();
  if (data.senderId !== senderId || data.deleted === true) throw new Error('يمكنك تعديل رسائلك غير المحذوفة فقط.');
  const createdAt = timestampToDate(data.createdAt);
  if (!createdAt || Date.now() - createdAt.getTime() > EDIT_WINDOW_MS) {
    throw new Error('انتهت مهلة تعديل الرسالة (15 دقيقة).');
  }
  await updateDoc(ref, { text: nextText, edited: true, editedAt: serverTimestamp() });
}

export async function toggleGeneralChatReaction(messageId: string, userId: string, emoji: string, roomId = GENERAL_CHAT_ID) {
  if (!ALLOWED_REACTIONS.includes(emoji)) throw new Error('رمز التفاعل غير مدعوم.');
  const firestore = requireDb();
  await runTransaction(firestore, async (transaction) => {
    const ref = doc(firestore, 'conversations', normalizeRoomId(roomId), 'messages', messageId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists() || snapshot.data().deleted === true) throw new Error('هذه الرسالة لم تعد متاحة.');
    const reactions = (snapshot.data().reactions ?? {}) as ChatReactions;
    const current = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
    const next = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    const updated = { ...reactions };
    if (next.length) updated[emoji] = next;
    else delete updated[emoji];
    transaction.update(ref, { reactions: updated });
  });
}

export async function toggleGeneralChatPin(messageId: string, adminId: string, pinned: boolean, roomId = GENERAL_CHAT_ID) {
  await updateDoc(messageRef(messageId, roomId), {
    pinned, pinnedBy: pinned ? adminId : null, pinnedAt: pinned ? serverTimestamp() : null,
  });
}

export async function softDeleteGeneralChatMessage(messageId: string, senderId: string, roomId = GENERAL_CHAT_ID) {
  const ref = messageRef(messageId, roomId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('هذه الرسالة لم تعد موجودة.');
  if (snapshot.data().senderId !== senderId) throw new Error('يمكنك حذف رسائلك فقط.');
  await updateDoc(ref, { deleted: true, deletedAt: serverTimestamp(), deletedBy: senderId, text: '', attachments: [] });
}

export async function adminSoftDeleteGeneralChatMessage(messageId: string, adminId: string, roomId = GENERAL_CHAT_ID) {
  const ref = messageRef(messageId, roomId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('هذه الرسالة لم تعد موجودة.');
  await updateDoc(ref, { deleted: true, deletedAt: serverTimestamp(), deletedBy: adminId, text: '', attachments: [] });
}

export async function hideGeneralChatMessageForUser(userId: string, messageId: string, roomId = GENERAL_CHAT_ID) {
  if (!userId) throw new Error('يجب تسجيل الدخول لإخفاء الرسالة من حسابك.');
  const ref = doc(requireDb(), 'users', userId, 'hiddenChatMessages', normalizeRoomId(roomId));
  await setDoc(ref, { messageIds: arrayUnion(messageId), updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteGeneralChatMessage(messageId: string, roomId = GENERAL_CHAT_ID) {
  await deleteDoc(messageRef(messageId, roomId));
}

export async function deleteGeneralChatRoomMessages(roomId = GENERAL_CHAT_ID) {
  const firestore = requireDb();
  const snapshot = await getDocs(messageCollection(roomId));
  for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
    const batch = writeBatch(firestore);
    snapshot.docs.slice(offset, offset + 400).forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
  }
}

/* Moderation state and schedules are stored per room, not globally. */
export function subscribeGeneralChatMuteStatus(
  userId: string,
  onStatus: (status: ChatMuteStatus) => void,
  onError: (error: Error) => void,
  roomId = GENERAL_CHAT_ID,
 ): Unsubscribe {
  return onSnapshot(muteRef(userId, roomId), (snapshot) => {
    const data = snapshot.exists() ? snapshot.data() : {};
    const until = timestampToDate(data.mutedUntil);
    onStatus({ muted: data.muted === true && (!until || until.getTime() > Date.now()), mutedUntil: until, reason: String(data.reason ?? '') });
  }, onError);
}

export async function getGeneralChatMuteStatus(userId: string, roomId = GENERAL_CHAT_ID): Promise<ChatMuteStatus> {
  const snapshot = await getDoc(muteRef(userId, roomId));
  if (!snapshot.exists()) return { muted: false, mutedUntil: null, reason: '' };
  const data = snapshot.data();
  const until = timestampToDate(data.mutedUntil);
  return { muted: data.muted === true && (!until || until.getTime() > Date.now()), mutedUntil: until, reason: String(data.reason ?? '') };
}

export async function toggleGeneralChatMute(userId: string, adminId: string, minutes = 60, roomId = GENERAL_CHAT_ID) {
  const ref = muteRef(userId, roomId);
  const current = await getGeneralChatMuteStatus(userId, roomId);
  const muted = !current.muted;
  await setDoc(ref, {
    userId, muted,
    mutedUntil: muted ? Timestamp.fromDate(new Date(Date.now() + minutes * 60 * 1000)) : null,
    updatedAt: serverTimestamp(), updatedBy: adminId,
  }, { merge: true });
  return muted;
}

export async function setGeneralChatMute(
  userId: string,
  adminId: string,
  duration: number | Date | null,
  roomId = GENERAL_CHAT_ID,
  reason = '',
) {
  const until = duration instanceof Date
    ? Timestamp.fromDate(duration)
    : duration && duration > 0
      ? Timestamp.fromDate(new Date(Date.now() + duration * 60 * 1000))
      : null;
  if (until && until.toDate().getTime() <= Date.now()) throw new Error('وقت انتهاء الكتم يجب أن يكون في المستقبل.');
  await setDoc(muteRef(userId, roomId), {
    userId,
    muted: true,
    mutedUntil: until,
    reason: reason.trim().slice(0, 500),
    updatedAt: serverTimestamp(),
    updatedBy: adminId,
  }, { merge: true });
}

export async function unmuteGeneralChatUser(userId: string, adminId: string, roomId = GENERAL_CHAT_ID) {
  await setDoc(muteRef(userId, roomId), {
    userId, muted: false, mutedUntil: null, updatedAt: serverTimestamp(), updatedBy: adminId,
  }, { merge: true });
}

export function subscribeGeneralChatSlowMode(
  onStatus: (status: ChatSlowModeStatus) => void,
  onError: (error: Error) => void,
  roomId = GENERAL_CHAT_ID,
): Unsubscribe {
  return onSnapshot(chatSettingsRef(roomId), (snapshot) => {
    const data = snapshot.exists() ? snapshot.data() : {};
    const seconds = Math.min(300, Math.max(0, Math.floor(Number(data.slowModeSeconds) || 0)));
    onStatus({ enabled: data.slowModeEnabled === true && seconds >= 5, seconds });
  }, onError);
}

export function subscribeGeneralChatSlowModeCooldown(
  userId: string,
  onUntil: (until: Date | null) => void,
  onError: (error: Error) => void,
  roomId = GENERAL_CHAT_ID,
): Unsubscribe {
  return onSnapshot(slowModeCooldownRef(userId, roomId), (snapshot) => {
    onUntil(snapshot.exists() ? timestampToDate(snapshot.data().until) : null);
  }, onError);
}

export async function setGeneralChatSlowMode(
  roomId: string,
  adminId: string,
  enabled: boolean,
  seconds: number,
) {
  const duration = Math.floor(Number(seconds));
  if (enabled && (!Number.isFinite(duration) || duration < 5 || duration > 300)) {
    throw new Error('حدد مدة بين 5 و300 ثانية.');
  }
  await setDoc(chatSettingsRef(roomId), {
    slowModeEnabled: enabled,
    slowModeSeconds: enabled ? duration : 0,
    slowModeUpdatedAt: serverTimestamp(),
    slowModeUpdatedBy: adminId,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function subscribeGeneralChatLockStatus(
  onStatus: (status: ChatLockStatus) => void,
  onError: (error: Error) => void,
  roomId = GENERAL_CHAT_ID,
): Unsubscribe {
  return onSnapshot(chatSettingsRef(roomId), (snapshot) => {
    const data = snapshot.exists() ? snapshot.data() : {};
    const startAt = timestampToDate(data.startAt);
    const endAt = timestampToDate(data.endAt);
    const started = !startAt || startAt.getTime() <= Date.now();
    const notEnded = !endAt || endAt.getTime() > Date.now();
    onStatus({
      locked: data.locked === true && started && notEnded,
      startAt, endAt, reason: String(data.reason ?? ''), autoExpire: data.autoExpire === true,
    });
  }, onError);
}

export async function setGeneralChatLock(
  adminId: string,
  input: { startAt: Date; endAt?: Date | null; reason?: string; autoExpire?: boolean },
  roomId = GENERAL_CHAT_ID,
) {
  if (input.endAt && input.endAt.getTime() <= input.startAt.getTime()) {
    throw new Error('وقت فتح الدردشة يجب أن يكون بعد وقت بداية القفل.');
  }
  await setDoc(chatSettingsRef(roomId), {
    locked: true,
    startAt: Timestamp.fromDate(input.startAt),
    endAt: input.autoExpire ? (input.endAt ? Timestamp.fromDate(input.endAt) : null) : null,
    autoExpire: input.autoExpire === true,
    reason: input.reason?.trim() ?? '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    updatedAt: serverTimestamp(), updatedBy: adminId,
  }, { merge: true });
}

export async function clearGeneralChatLock(adminId: string, roomId = GENERAL_CHAT_ID) {
  await setDoc(chatSettingsRef(roomId), {
    locked: false, startAt: null, endAt: null, autoExpire: false,
    reason: '', updatedAt: serverTimestamp(), updatedBy: adminId,
  }, { merge: true });
}

export function subscribeGeneralChatWarnings(
  userId: string,
  onWarnings: (warnings: ChatWarning[]) => void,
  onError: (error: Error) => void,
  roomId = GENERAL_CHAT_ID,
): Unsubscribe {
  const warningsQuery = query(collection(requireDb(), 'conversations', normalizeRoomId(roomId), 'warnings'), where('userId', '==', userId));
  return onSnapshot(warningsQuery, (snapshot) => {
    const warnings = snapshot.docs.map((entry) => {
      const data = entry.data();
      return {
        id: entry.id, userId: String(data.userId ?? ''), reason: String(data.reason ?? ''),
        createdAt: timestampToDate(data.createdAt), createdBy: String(data.createdBy ?? ''),
        messageId: typeof data.messageId === 'string' ? data.messageId : undefined,
      } as ChatWarning;
    }).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    onWarnings(warnings);
  }, onError);
}

export async function createGeneralChatWarning(userId: string, adminId: string, reason: string, roomId = GENERAL_CHAT_ID, messageId?: string) {
  const text = reason.trim();
  if (!text) throw new Error('اكتب سبب التحذير أولاً.');
  await addDoc(collection(requireDb(), 'conversations', normalizeRoomId(roomId), 'warnings'), {
    userId, reason: text.slice(0, 500), createdBy: adminId, messageId: messageId ?? null, createdAt: serverTimestamp(),
  });
}


/* Announcements are moderated room-wide content, separate from ordinary messages. */
export function subscribeChatAnnouncements(
  roomId: string,
  onData: (items: ChatAnnouncement[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const announcementsQuery = query(
    collection(requireDb(), 'conversations', normalizeRoomId(roomId), 'announcements'),
    orderBy('createdAt', 'desc'),
    limit(30),
  );
  return onSnapshot(announcementsQuery, (snapshot) => {
    onData(snapshot.docs.map((entry) => {
      const data = entry.data();
      return {
        id: entry.id,
        text: String(data.text ?? ''),
        createdBy: String(data.createdBy ?? ''),
        createdAt: timestampToDate(data.createdAt),
        updatedAt: timestampToDate(data.updatedAt),
      };
    }));
  }, onError);
}

export async function createChatAnnouncement(roomId: string, adminId: string, text: string) {
  const message = text.trim();
  if (message.length < 4) throw new Error('اكتب تعميماً واضحاً من أربعة أحرف على الأقل.');
  if (message.length > 2500) throw new Error('التعميم طويل جداً. الحد الأقصى 2500 حرف.');
  await addDoc(collection(requireDb(), 'conversations', normalizeRoomId(roomId), 'announcements'), {
    text: message,
    createdBy: adminId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateChatAnnouncement(roomId: string, announcementId: string, text: string) {
  const message = text.trim();
  if (message.length < 4) throw new Error('اكتب تعميماً واضحاً من أربعة أحرف على الأقل.');
  if (message.length > 2500) throw new Error('التعميم طويل جداً. الحد الأقصى 2500 حرف.');
  await updateDoc(doc(requireDb(), 'conversations', normalizeRoomId(roomId), 'announcements', announcementId), {
    text: message,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteChatAnnouncement(roomId: string, announcementId: string) {
  await deleteDoc(doc(requireDb(), 'conversations', normalizeRoomId(roomId), 'announcements', announcementId));
}

/* Each user can keep a different image background in every room. */
const chatBackgroundRef = (userId: string, roomId: string) =>
  doc(requireDb(), 'users', userId, 'chatBackgrounds', normalizeRoomId(roomId));

export function subscribeChatBackground(
  userId: string,
  roomId: string,
  onUrl: (url: string) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(chatBackgroundRef(userId, roomId), (snapshot) => {
    const url = snapshot.exists() && typeof snapshot.data().url === 'string' ? snapshot.data().url : '';
    onUrl(url);
  }, onError);
}

export async function saveChatBackground(userId: string, roomId: string, url: string) {
  await setDoc(chatBackgroundRef(userId, roomId), {
    url,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function clearChatBackground(userId: string, roomId: string) {
  await deleteDoc(chatBackgroundRef(userId, roomId));
}
