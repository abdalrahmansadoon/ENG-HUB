import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import {
  AlertCircle, ArrowDown, ArrowDownLeft, ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3,
  Copy, Download, EyeOff, File, FileText, ImagePlus, Lock, Maximize, Megaphone,
  MessageCircle, Minus, MoreHorizontal, Paperclip, Pencil, Pin, Plus, Search, Send,
  ShieldCheck, Smile, Timer, Trash2, Unlock, Upload, Video, X,
} from 'lucide-react';
import type { AppUser } from '../../types';
import { isCloudinaryConfigured, type CloudinarySettings } from '../../lib/cloudinary';
import { uploadFile } from '../../lib/uploads';
import {
  adminSoftDeleteGeneralChatMessage, clearChatBackground, clearGeneralChatHistoryForUser, clearGeneralChatLock, markChatRoomRead,
  createChatAnnouncement, createGeneralChatWarning, deleteChatAnnouncement,
  deleteGeneralChatMessage, deleteGeneralChatRoomMessages, editGeneralChatMessage, getGeneralChatMuteStatus,
  hideGeneralChatMessageForUser, joinGeneralChat, saveChatBackground,
  sendGeneralChatMessage, setGeneralChatLock, setGeneralChatMute, setGeneralChatSlowMode,
  softDeleteGeneralChatMessage, subscribeChatAnnouncements, subscribeChatBackground,
  subscribeChatReadState, subscribeGeneralChat, subscribeGeneralChatLockStatus, subscribeGeneralChatMuteStatus, subscribeGeneralChatSlowMode, subscribeGeneralChatSlowModeCooldown,
  subscribeGeneralChatWarnings, toggleGeneralChatPin, toggleGeneralChatReaction,
  unmuteGeneralChatUser, updateChatAnnouncement, type ChatAnnouncement, type ChatAttachment,
  type ChatLockStatus, type ChatMessage, type ChatMuteStatus, type ChatSlowModeStatus, type ChatWarning,
} from '../../lib/chat';
import { ChatLockModal } from './ChatLockModal';
import { ChatMuteModal } from './ChatMuteModal';
import { ChatWarningModal } from './ChatWarningModal';
import { ChatAnnouncementModal } from './ChatAnnouncementModal';
import { ChatSlowModeModal } from './ChatSlowModeModal';

export function ChatPage({ user, cloudinarySettings, isDemo, isAdmin, roomId, roomTitle, courseId, onBack, onOpenProfile }: {
  user: AppUser;
  cloudinarySettings: CloudinarySettings;
  isDemo: boolean;
  isAdmin: boolean;
  roomId: string;
  roomTitle: string;
  courseId?: string;
  onBack: () => void;
  onOpenProfile: (uid: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesReady, setMessagesReady] = useState(false);
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [contextMessage, setContextMessage] = useState<ChatMessage | null>(null);
  const [contextPosition, setContextPosition] = useState({ x: 0, y: 0 });
  const [lightboxItems, setLightboxItems] = useState<ChatAttachment[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxScale, setLightboxScale] = useState(1);
  const lightbox = lightboxItems[lightboxIndex] ?? null;
  const [muteState, setMuteState] = useState<ChatMuteStatus>({ muted: false, mutedUntil: null, reason: '' });
  const [slowMode, setSlowMode] = useState<ChatSlowModeStatus>({ enabled: false, seconds: 0 });
  const [slowCooldownUntil, setSlowCooldownUntil] = useState<Date | null>(null);
  const [slowNow, setSlowNow] = useState(Date.now());
  const [slowModeSettingsOpen, setSlowModeSettingsOpen] = useState(false);
  const slowRemainingSeconds = slowMode.enabled && !isAdmin && slowCooldownUntil
    ? Math.max(0, Math.ceil((slowCooldownUntil.getTime() - slowNow) / 1000)) : 0;
  const [lockState, setLockState] = useState<ChatLockStatus>({ locked: false, startAt: null, endAt: null, reason: '', autoExpire: false });
  const [warnings, setWarnings] = useState<ChatWarning[]>([]);
  const [announcements, setAnnouncements] = useState<ChatAnnouncement[]>([]);
  const [announcementTarget, setAnnouncementTarget] = useState<ChatAnnouncement | null>(null);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [chatBackgroundUrl, setChatBackgroundUrl] = useState('');
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const [lockSettingsOpen, setLockSettingsOpen] = useState(false);
  const [muteTarget, setMuteTarget] = useState<ChatMessage | null>(null);
  const [warningTarget, setWarningTarget] = useState<ChatMessage | null>(null);
  const [moderationBusy, setModerationBusy] = useState(false);
  const [contextMuted, setContextMuted] = useState(false);
  const [notice, setNotice] = useState('');
  const [chatReadAt, setChatReadAt] = useState<Date | null>(null);
  const [chatReadReady, setChatReadReady] = useState(false);
  const [showUnreadJump, setShowUnreadJump] = useState(false);
  const [filePreviews, setFilePreviews] = useState<Array<{ key: string; url: string }>>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const backgroundFileInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesListRef = useRef<HTMLElement>(null);
  const initialReadPositioned = useRef(false);
  const stickToBottom = useRef(true);
  const lastReadMessageId = useRef('');
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStart = useRef<{ x: number; y: number; startedAt: number } | null>(null);
  const longPressTriggered = useRef(false);

  useEffect(() => {
    setMessages([]);
    setMessagesReady(false);
    setLoading(true);
    if (isDemo) {
      setLoading(false);
      setMessagesReady(true);
      setError('الدردشة المباشرة تحتاج إلى الاتصال بقاعدة Firebase.');
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const start = async () => {
      setLoading(true);
      setError('');
      try {
        await joinGeneralChat({ uid: user.uid, displayName: user.displayName, photoURL: user.photoURL }, roomId, roomTitle, courseId);
        if (cancelled) return;
        unsubscribe = subscribeGeneralChat(user.uid, setMessages, (reason) => setError(reason.message), roomId, () => setMessagesReady(true));
      } catch (reason) {
        setError(reason instanceof Error && ((reason as { code?: string }).code === 'permission-denied' || reason.message.toLowerCase().includes('permission')) ? 'لا تسمح قواعد Firestore بفتح دردشة هذه المادة. تأكد من أن المادة منشورة وأن المستخدم عضو نشط، ثم انشر قواعد Firestore المحدّثة.' : reason instanceof Error ? reason.message : 'تعذر فتح المحادثة.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void start();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user.uid, user.displayName, user.photoURL, isDemo, roomId, roomTitle, courseId]);

  useEffect(() => {
    initialReadPositioned.current = false;
    stickToBottom.current = true;
    lastReadMessageId.current = '';
    setChatReadReady(false);
    setShowUnreadJump(false);
    if (isDemo) {
      setChatReadAt(new Date());
      setChatReadReady(true);
      return;
    }
    return subscribeChatReadState(user.uid, roomId, (date) => {
      setChatReadAt(date);
      setChatReadReady(true);
    }, (reason) => setError(reason.message));
  }, [user.uid, isDemo, roomId]);

  useEffect(() => {
    if (isDemo) { setMuteState({ muted: false, mutedUntil: null, reason: '' }); return; }
    return subscribeGeneralChatMuteStatus(user.uid, setMuteState, (reason) => setError(reason.message), roomId);
  }, [user.uid, isDemo, roomId]);

  useEffect(() => {
    if (isDemo) { setSlowMode({ enabled: false, seconds: 0 }); return; }
    return subscribeGeneralChatSlowMode(setSlowMode, (reason) => setError(reason.message), roomId);
  }, [isDemo, roomId]);

  useEffect(() => {
    if (isDemo || !slowMode.enabled || isAdmin) { setSlowCooldownUntil(null); return; }
    return subscribeGeneralChatSlowModeCooldown(user.uid, setSlowCooldownUntil, (reason) => setError(reason.message), roomId);
  }, [isDemo, isAdmin, slowMode.enabled, user.uid, roomId]);

  useEffect(() => {
    if (!slowCooldownUntil) { setSlowNow(Date.now()); return; }
    const timer = window.setInterval(() => setSlowNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [slowCooldownUntil]);



  useEffect(() => {
    if (isDemo) {
      setLockState({ locked: false, startAt: null, endAt: null, reason: '', autoExpire: false });
      setWarnings([]);
      return;
    }
    const stopLock = subscribeGeneralChatLockStatus(setLockState, (reason) => setError(reason.message), roomId);
    const stopWarnings = subscribeGeneralChatWarnings(user.uid, setWarnings, (reason) => setError(reason.message), roomId);
    return () => { stopLock(); stopWarnings(); };
  }, [user.uid, isDemo, roomId]);

  useEffect(() => {
    if (isDemo) { setAnnouncements([]); return; }
    return subscribeChatAnnouncements(roomId, setAnnouncements, (reason) => setError(reason.message));
  }, [roomId, isDemo]);

  useEffect(() => {
    if (isDemo) { setChatBackgroundUrl(''); return; }
    return subscribeChatBackground(user.uid, roomId, setChatBackgroundUrl, (reason) => setError(reason.message));
  }, [user.uid, roomId, isDemo]);

  useEffect(() => {
    if (!lockState.locked || !lockState.endAt) return;
    const delay = lockState.endAt.getTime() - Date.now();
    if (delay <= 0) {
      setLockState((current) => ({ ...current, locked: false }));
      return;
    }
    const timer = window.setTimeout(() => setLockState((current) => ({ ...current, locked: false })), delay + 100);
    return () => window.clearTimeout(timer);
  }, [lockState.locked, lockState.endAt]);

  useEffect(() => {
    if (!muteState.muted || !muteState.mutedUntil) return;
    const delay = muteState.mutedUntil.getTime() - Date.now();
    if (delay <= 0) { setMuteState({ muted: false, mutedUntil: null, reason: '' }); return; }
    const timer = window.setTimeout(() => setMuteState({ muted: false, mutedUntil: null, reason: '' }), delay + 50);
    return () => window.clearTimeout(timer);
  }, [muteState.muted, muteState.mutedUntil]);

  useEffect(() => {
    if (!contextMessage || !isAdmin || contextMessage.senderId === user.uid) { setContextMuted(false); return; }
    let cancelled = false;
    void getGeneralChatMuteStatus(contextMessage.senderId, roomId).then((status) => {
      if (!cancelled) setContextMuted(status.muted);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'تعذر قراءة حالة كتم الطالب.');
    });
    return () => { cancelled = true; };
  }, [contextMessage?.id, contextMessage?.senderId, isAdmin, user.uid, roomId]);

  useEffect(() => {
    const next = files.map((file, index) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      url: URL.createObjectURL(file),
    }));
    setFilePreviews(next);
    return () => next.forEach((item) => URL.revokeObjectURL(item.url));
  }, [files]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMessage(null);
        setLightboxItems([]); setLightboxIndex(0); setLightboxScale(1);
        setEmojiOpen(false);
      } else if (lightboxItems.length > 1 && event.key === 'ArrowLeft') {
        setLightboxIndex((index) => (index + 1) % lightboxItems.length);
        setLightboxScale(1);
      } else if (lightboxItems.length > 1 && event.key === 'ArrowRight') {
        setLightboxIndex((index) => (index - 1 + lightboxItems.length) % lightboxItems.length);
        setLightboxScale(1);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [lightboxItems.length]);

  const openMessageGallery = (attachments: ChatAttachment[], selected: ChatAttachment) => {
    const images = attachments.filter((item) => item.mimeType.startsWith('image/'));
    const index = images.findIndex((item) => item.url === selected.url);
    setLightboxItems(images.length ? images : [selected]);
    setLightboxIndex(Math.max(0, index));
    setLightboxScale(1);
  };
  const closeMessageGallery = () => {
    setLightboxItems([]);
    setLightboxIndex(0);
    setLightboxScale(1);
  };

  const visibleMessages = messages.filter((message) =>
    (message.text + ' ' + message.senderName + ' ' + message.attachments.map((item) => item.name).join(' '))
      .toLowerCase().includes(search.trim().toLowerCase()),
  );
  const pinnedMessages = messages.filter((message) => message.pinned);
  const unreadMessages = useMemo(() => {
    if (!chatReadReady || !chatReadAt) return [];
    return messages.filter((message) =>
      message.senderId !== user.uid
      && !message.deleted
      && message.createdAt !== null
      && message.createdAt.getTime() > chatReadAt.getTime(),
    );
  }, [messages, chatReadReady, chatReadAt, user.uid]);
  const visibleUnreadMessages = visibleMessages.filter((message) => unreadMessages.some((unread) => unread.id === message.id));
  const firstVisibleUnreadId = visibleUnreadMessages[0]?.id ?? '';

  const markRoomAsRead = () => {
    const latest = messages[messages.length - 1];
    if (!latest) {
      if (lastReadMessageId.current === '__empty__') return;
      lastReadMessageId.current = '__empty__';
      void markChatRoomRead(user.uid, roomId).catch((reason) => {
        lastReadMessageId.current = '';
        setError(reason instanceof Error ? reason.message : 'تعذر حفظ حالة القراءة.');
      });
      return;
    }
    if (lastReadMessageId.current === latest.id) return;
    lastReadMessageId.current = latest.id;
    void markChatRoomRead(user.uid, roomId).then(() => {
      setChatReadAt(latest.createdAt ?? new Date());
      setShowUnreadJump(false);
    }).catch((reason) => {
      lastReadMessageId.current = '';
      setError(reason instanceof Error ? reason.message : 'تعذر حفظ حالة القراءة.');
    });
  };

  const handleMessagesScroll = () => {
    const viewport = messagesListRef.current;
    if (!viewport) return;
    const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 96;
    stickToBottom.current = atBottom;
    if (atBottom) markRoomAsRead();
    else setShowUnreadJump(unreadMessages.length > 0);
  };

  const jumpToLatest = () => {
    stickToBottom.current = true;
    setShowUnreadJump(false);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    markRoomAsRead();
  };

  useEffect(() => {
    if (!chatReadReady || !messagesReady || loading) return;
    const frame = window.requestAnimationFrame(() => {
      if (!initialReadPositioned.current) {
        initialReadPositioned.current = true;
        if (chatReadAt && unreadMessages.length > 0) {
          stickToBottom.current = false;
          setShowUnreadJump(true);
          document.getElementById('chat-message-' + unreadMessages[0].id)?.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else {
          stickToBottom.current = true;
          bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
          markRoomAsRead();
        }
        return;
      }
      if (stickToBottom.current) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        markRoomAsRead();
      } else {
        setShowUnreadJump(unreadMessages.length > 0);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, messagesReady, chatReadReady, chatReadAt, loading, roomId, unreadMessages.length]);

  const editAllowed = (message: ChatMessage) => Boolean(
    message.createdAt && message.senderId === user.uid && Date.now() - message.createdAt.getTime() <= 15 * 60 * 1000,
  );
  const emojis = ['👍', '❤️', '😂', '😮', '🙏', '👏'];

  const focusComposer = () => window.setTimeout(() => composerRef.current?.focus(), 40);
  const beginReply = (message: ChatMessage) => {
    setEditingMessage(null);
    setReplyTo(message);
    setContextMessage(null);
    focusComposer();
  };
  const beginEdit = (message: ChatMessage) => {
    if (!editAllowed(message)) {
      setError('انتهت مهلة تعديل الرسالة. التعديل متاح خلال أول 15 دقيقة.');
      setContextMessage(null);
      return;
    }
    setEditingMessage(message);
    setReplyTo(null);
    setDraft(message.text);
    setFiles([]);
    setContextMessage(null);
    focusComposer();
  };
  const cancelComposerMode = () => {
    setReplyTo(null);
    setEditingMessage(null);
    setDraft('');
    setFiles([]);
    if (fileInput.current) fileInput.current.value = '';
  };

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (sending) return;
    if (slowRemainingSeconds > 0) {
      setError(`الوضع البطيء مفعّل. يمكنك الإرسال بعد ${slowRemainingSeconds} ثانية.`);
      return;
    }
    if (lockState.locked && !isAdmin) {
      setError('المحادثة مغلقة مؤقتاً من الإدارة. يمكنك قراءة الرسائل لكن لا يمكنك الإرسال الآن.');
      return;
    }
    if (muteState.muted) {
      setError('تم كتمك مؤقتاً من المحادثة العامة. يمكنك الإرسال بعد انتهاء مدة الكتم.');
      return;
    }
    if (editingMessage) {
      if (!draft.trim()) return;
      setSending(true);
      setError('');
      try {
        await editGeneralChatMessage(editingMessage.id, user.uid, draft, roomId);
        cancelComposerMode();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'تعذر تعديل الرسالة.');
      } finally {
        setSending(false);
      }
      return;
    }
    if (!draft.trim() && files.length === 0) return;
    setSending(true);
    setError('');
    try {
      const attachments: ChatAttachment[] = [];
      for (const file of files) {
        if (file.size > 40 * 1024 * 1024) throw new Error(`الملف ${file.name} أكبر من الحد المسموح (40 MB).`);
        const url = await uploadFile(file, cloudinarySettings);
        attachments.push({ name: file.name, url, mimeType: file.type || 'application/octet-stream', size: file.size });
      }
      await sendGeneralChatMessage({
        text: draft,
        senderId: user.uid,
        senderName: user.displayName,
        senderPhotoURL: user.photoURL,
        isModerator: isAdmin,
        attachments,
        replyTo: replyTo ? {
          id: replyTo.id,
          text: replyTo.text || (replyTo.attachments[0]?.name ?? 'مرفق'),
          senderName: replyTo.senderName,
        } : null,
      }, roomId);
      cancelComposerMode();
      setEmojiOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر إرسال الرسالة.');
    } finally {
      setSending(false);
    }
  };

  const removeMessage = async (message: ChatMessage) => {
    if (message.senderId !== user.uid) return;
    const confirmed = window.confirm('سيظهر للآخرين أن الرسالة حُذفت، ولن يبقى محتواها أو مرفقاتها. هل تريد المتابعة؟');
    if (!confirmed) return;
    setContextMessage(null);
    setError('');
    try {
      await softDeleteGeneralChatMessage(message.id, user.uid, roomId);
      if (replyTo?.id === message.id) setReplyTo(null);
      setNotice('تم حذف رسالتك لدى جميع المشاركين.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر حذف الرسالة.');
    }
  };

  const hideMessageForMe = async (message: ChatMessage) => {
    setContextMessage(null);
    try {
      await hideGeneralChatMessageForUser(user.uid, message.id, roomId);
      setNotice('تم إخفاء الرسالة من حسابك فقط.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر إخفاء الرسالة من حسابك.');
    }
  };

  const adminDeleteMessage = async (message: ChatMessage) => {
    if (!isAdmin || message.deleted) return;
    if (!window.confirm('سيتم حذف محتوى الرسالة لدى جميع المشاركين مع الاحتفاظ بعلامة توضح أنها حُذفت. هل تريد المتابعة؟')) return;
    setContextMessage(null);
    try {
      await adminSoftDeleteGeneralChatMessage(message.id, user.uid, roomId);
      setNotice('تم حذف الرسالة لدى جميع المشاركين.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر حذف الرسالة.');
    }
  };

  const permanentlyDeleteMessage = async (message: ChatMessage) => {
    if (!isAdmin) return;
    const confirmed = window.confirm('سيتم حذف الرسالة نهائياً من المحادثة لجميع المشاركين. لا يمكن التراجع. هل تريد المتابعة؟');
    if (!confirmed) return;
    setContextMessage(null);
    try {
      await deleteGeneralChatMessage(message.id, roomId);
      setNotice('تم حذف الرسالة نهائياً من المحادثة.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر حذف الرسالة نهائياً.');
    }
  };

  const handleReaction = async (message: ChatMessage, emoji: string) => {
    setContextMessage(null);
    try {
      await toggleGeneralChatReaction(message.id, user.uid, emoji, roomId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تسجيل التفاعل.');
    }
  };

  const handlePin = async (message: ChatMessage) => {
    setContextMessage(null);
    try {
      await toggleGeneralChatPin(message.id, user.uid, !message.pinned, roomId);
      setNotice(message.pinned ? 'تم إلغاء تثبيت الرسالة.' : 'تم تثبيت الرسالة أعلى المحادثة.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تثبيت الرسالة.');
    }
  };

  const handleMute = async (message: ChatMessage) => {
    if (!isAdmin || message.senderId === user.uid) return;
    setContextMessage(null);
    if (contextMuted) {
      try {
        await unmuteGeneralChatUser(message.senderId, user.uid, roomId);
        setNotice(`تم إلغاء كتم ${message.senderName}.`);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'تعذر إلغاء كتم الطالب.');
      }
    } else {
      setMuteTarget(message);
    }
  };

  const saveMuteDuration = async (duration: number | Date | null, reason: string) => {
    if (!isAdmin || !muteTarget) return;
    setModerationBusy(true);
    try {
      await setGeneralChatMute(muteTarget.senderId, user.uid, duration, roomId, reason);
      const label = duration instanceof Date
        ? `حتى ${duration.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`
        : duration === null
          ? 'حتى إلغاء الكتم يدوياً'
          : duration >= 43200 ? 'لمدة 30 يوماً'
            : duration >= 10080 ? 'لمدة 7 أيام'
              : duration >= 4320 ? 'لمدة 3 أيام'
                : duration >= 1440 ? 'لمدة يوم واحد'
                  : duration >= 60 ? 'لمدة ساعة واحدة' : `لمدة ${duration} دقيقة`;
      setNotice(`تم كتم ${muteTarget.senderName} ${label}.`);
      setMuteTarget(null);
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : 'تعذر كتم الطالب.');
    } finally {
      setModerationBusy(false);
    }
  };

  const saveSlowMode = async (enabled: boolean, seconds: number) => {
    setModerationBusy(true);
    setError('');
    try {
      await setGeneralChatSlowMode(roomId, user.uid, enabled, seconds);
      setSlowModeSettingsOpen(false);
      setNotice(enabled ? `تم تفعيل الوضع البطيء: رسالة كل ${seconds} ثانية.` : 'تم إيقاف الوضع البطيء.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر حفظ إعدادات الوضع البطيء.');
    } finally {
      setModerationBusy(false);
    }
  };

  const saveChatLock = async (startAt: Date, endAt: Date | null, reason: string, autoExpire: boolean) => {
    if (!isAdmin) return;
    setModerationBusy(true);
    try {
      await setGeneralChatLock(user.uid, { startAt, endAt, reason, autoExpire }, roomId);
      setLockSettingsOpen(false);
      setNotice(autoExpire && endAt ? 'تم جدولة قفل المحادثة وفتحها تلقائياً في الموعد المحدد.' : 'تم إعداد قفل المحادثة حتى يفتحه المدير يدوياً.');
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : 'تعذر حفظ إعدادات قفل المحادثة.');
    } finally {
      setModerationBusy(false);
    }
  };

  const unlockChat = async () => {
    if (!isAdmin || !window.confirm('هل تريد فتح المحادثة للطلاب الآن؟')) return;
    setModerationBusy(true);
    try {
      await clearGeneralChatLock(user.uid, roomId);
      setNotice('تم فتح المحادثة للطلاب.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر فتح المحادثة.');
    } finally {
      setModerationBusy(false);
    }
  };

  const handleWarning = async (message: ChatMessage) => {
    if (!isAdmin || message.senderId === user.uid) return;
    setContextMessage(null);
    setWarningTarget(message);
  };

  const saveWarning = async (reason: string) => {
    if (!isAdmin || !warningTarget) return;
    setModerationBusy(true);
    try {
      await createGeneralChatWarning(warningTarget.senderId, user.uid, reason, roomId, warningTarget.id);
      setNotice(`تم تسجيل تحذير إداري لـ ${warningTarget.senderName}.`);
      setWarningTarget(null);
    } catch (errorReason) {
      setError(errorReason instanceof Error ? errorReason.message : 'تعذر حفظ التحذير.');
    } finally {
      setModerationBusy(false);
    }
  };

  const clearPersonalHistory = async () => {
    if (isAdmin || isDemo) return;
    const confirmed = window.confirm('سيتم إخفاء سجل هذه المحادثة من حسابك على أجهزتك فقط. لن تُحذف الرسائل من حسابات بقية المشاركين. هل تريد المتابعة؟');
    if (!confirmed) return;
    setError('');
    try {
      await clearGeneralChatHistoryForUser(user.uid, roomId);
      await markChatRoomRead(user.uid, roomId);
      setReplyTo(null);
      setContextMessage(null);
      setNotice('تم إخفاء سجل المحادثة من حسابك فقط.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر إخفاء سجل المحادثة من حسابك.');
    }
  };

  const clearRoom = async () => {
    if (!isAdmin || !window.confirm(`سيتم حذف جميع رسائل ${roomTitle} نهائياً. هل تريد المتابعة؟`)) return;
    try {
      await deleteGeneralChatRoomMessages(roomId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تفريغ المحادثة.');
    }
  };

  const saveAnnouncement = async (text: string) => {
    if (!isAdmin) return;
    setModerationBusy(true);
    try {
      if (announcementTarget) {
        await updateChatAnnouncement(roomId, announcementTarget.id, text);
        setNotice('تم تحديث التعميم.');
      } else {
        await createChatAnnouncement(roomId, user.uid, text);
        setNotice('تم نشر التعميم لجميع أعضاء الغرفة.');
      }
      setAnnouncementTarget(null);
      setAnnouncementModalOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر حفظ التعميم.');
    } finally {
      setModerationBusy(false);
    }
  };

  const removeAnnouncement = async (item: ChatAnnouncement) => {
    if (!isAdmin || !window.confirm('سيتم حذف هذا التعميم من جميع أعضاء الغرفة. هل تريد المتابعة؟')) return;
    try {
      await deleteChatAnnouncement(roomId, item.id);
      setNotice('تم حذف التعميم.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر حذف التعميم.');
    }
  };

  const changeChatBackground = async (file?: File) => {
    if (!file) return;
    if (isDemo) { setError('تخصيص خلفية المحادثة يحتاج إلى حساب Firebase فعلي.'); return; }
    if (!file.type.startsWith('image/')) { setError('اختر صورة صالحة لخلفية المحادثة.'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('حجم صورة الخلفية يجب ألا يتجاوز 8 MB.'); return; }
    if (!isCloudinaryConfigured(cloudinarySettings)) { setError('إعدادات Cloudinary غير مكتملة لرفع الخلفية.'); return; }
    setBackgroundBusy(true);
    setError('');
    try {
      const url = await uploadFile(file, cloudinarySettings);
      await saveChatBackground(user.uid, roomId, url);
      setNotice('تم حفظ خلفية المحادثة لهذا الحساب وهذه الغرفة.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر رفع خلفية المحادثة.');
    } finally {
      setBackgroundBusy(false);
      if (backgroundFileInput.current) backgroundFileInput.current.value = '';
    }
  };

  const resetChatBackground = async () => {
    if (!chatBackgroundUrl) return;
    try {
      await clearChatBackground(user.uid, roomId);
      setNotice('تمت إعادة خلفية المحادثة إلى الشكل الافتراضي.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر إزالة خلفية المحادثة.');
    }
  };

  const openContextMenu = (message: ChatMessage, x: number, y: number) => {
    const width = 236;
    const height = isAdmin ? 385 : 280;
    setContextPosition({
      x: Math.max(10, Math.min(x, window.innerWidth - width - 10)),
      y: Math.max(10, Math.min(y, window.innerHeight - height - 10)),
    });
    setContextMessage(message);
  };
  const onMessageContextMenu = (event: MouseEvent<HTMLElement>, message: ChatMessage) => {
    event.preventDefault();
    openContextMenu(message, event.clientX, event.clientY);
  };

  const copyMessage = async (message: ChatMessage) => {
    const value = message.text || message.attachments.map((item) => item.url).join('\n');
    try {
      await navigator.clipboard.writeText(value);
      setContextMessage(null);
      setNotice('تم نسخ محتوى الرسالة.');
    } catch {
      setError('تعذر نسخ الرسالة. تحقق من صلاحية الحافظة في المتصفح.');
    }
  };
  const appendEmoji = (emoji: string) => {
    setDraft((value) => value + emoji);
    setEmojiOpen(false);
    focusComposer();
  };
  const jumpToMessage = (messageId: string) => {
    document.getElementById('chat-message-' + messageId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const formatMessageTime = (date: Date | null) => date
    ? date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    : 'الآن';
  const formatDay = (date: Date | null) => {
    if (!date) return 'اليوم';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
    if (diff === 0) return 'اليوم';
    if (diff === 1) return 'أمس';
    return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return <section className="chat-reference-page">
    <div className="chat-reference-shell">
      <header className="chat-topbar">
        <button type="button" className="chat-topbar-btn" onClick={onBack} aria-label="العودة للرئيسية"><ArrowDownLeft size={18}/></button>
        <div className="chat-topbar-room">
          <div className="chat-topbar-avatar"><MessageCircle size={20}/></div>
          <div><b>{roomTitle}</b><span><i className="live-dot"/> {courseId ? 'طلاب هذا المقرر · نقاش ومشاركة' : 'المجتمع العام لطلاب ENG HUB'}</span></div>
        </div>
        <div className="chat-topbar-actions">
          <button type="button" className="chat-topbar-btn chat-profile-link" onClick={() => onOpenProfile(user.uid)} aria-label="الملف الشخصي" title="الملف الشخصي">{user.photoURL ? <img src={user.photoURL} alt="" /> : <span>{user.displayName.trim().slice(0,1) || "ط"}</span>}</button>
          <div className="chat-topbar-search"><Search size={15}/><input placeholder="ابحث داخل المحادثة" value={search} onChange={(event) => setSearch(event.target.value)}/></div>
          <button type="button" className="chat-topbar-btn" onClick={() => backgroundFileInput.current?.click()} disabled={backgroundBusy} title="اختيار خلفية المحادثة">{backgroundBusy ? <span className="spinner"/> : <ImagePlus size={16}/>}</button>
          {chatBackgroundUrl && <button type="button" className="chat-topbar-btn" onClick={() => void resetChatBackground()} title="إزالة الخلفية"><X size={15}/></button>}
          {!isAdmin && !isDemo && <details className="chat-student-tools">
            <summary className="chat-topbar-btn" aria-label="إعدادات المحادثة الشخصية" title="إعدادات المحادثة"><MoreHorizontal size={18}/></summary>
            <div role="menu">
              <button type="button" className="danger" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); void clearPersonalHistory(); }}><EyeOff size={15}/> إخفاء سجل المحادثة لدي فقط</button>
            </div>
          </details>}
          {isAdmin && <details className="chat-admin-tools">
            <summary className="chat-topbar-btn" aria-label="أدوات إدارة المحادثة" title="أدوات الإدارة"><MoreHorizontal size={18}/></summary>
            <div role="menu">
              <button type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); setAnnouncementTarget(null); setAnnouncementModalOpen(true); }}><Megaphone size={15}/> نشر تعميم</button>
              <button type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); lockState.locked ? void unlockChat() : setLockSettingsOpen(true); }} disabled={moderationBusy}>{lockState.locked ? <Unlock size={15}/> : <Lock size={15}/>} {lockState.locked ? 'فتح المحادثة' : 'قفل / جدولة القفل'}</button>
              <button type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); setSlowModeSettingsOpen(true); }} disabled={moderationBusy}><Timer size={15}/> {slowMode.enabled ? 'تعديل الوضع البطيء' : 'تفعيل الوضع البطيء'}</button>
              <button type="button" className="danger" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); void clearRoom(); }}><Trash2 size={15}/> تفريغ رسائل الغرفة</button>
            </div>
          </details>}
        </div>
      </header>
      <input ref={backgroundFileInput} type="file" accept="image/*" className="visually-hidden" onChange={(event) => void changeChatBackground(event.target.files?.[0])}/>

      {notice && <div className="chat-inline-notice" role="status"><CheckCircle2 size={15}/><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="إغلاق"><X size={14}/></button></div>}
      {slowMode.enabled && <div className="chat-slow-mode-banner"><Timer size={15}/><span>الوضع البطيء مفعّل: يمكن للطالب إرسال رسالة كل {slowMode.seconds} ثانية.</span></div>}
      {slowRemainingSeconds > 0 && <div className="chat-slow-mode-countdown"><Clock3 size={15}/><span>يمكنك إرسال الرسالة التالية بعد <b>{slowRemainingSeconds}</b> ثانية.</span></div>}
      {lockState.locked && <div className="chat-lock-banner"><Lock size={16}/><span><b>المحادثة مقفلة مؤقتاً.</b> {lockState.reason || 'تم إيقاف إرسال الطلاب بقرار من الإدارة.'} {lockState.endAt ? `موعد الفتح: ${lockState.endAt.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}` : 'سيتم فتحها يدوياً من الإدارة.'}</span>{isAdmin && <small>المدير يستطيع الإرسال</small>}</div>}
      {muteState.muted && <div className="chat-lock-banner"><ShieldCheck size={16}/><span><b>تم كتم حسابك في هذه الغرفة.</b> {muteState.reason ? muteState.reason + ' · ' : ''}{muteState.mutedUntil ? `حتى ${muteState.mutedUntil.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}` : 'حتى إلغاء الكتم من الإدارة'}.</span></div>}
      {warnings.length > 0 && <div className="chat-warning-strip"><ShieldCheck size={15}/><span><b>تنبيه من إدارة المحادثة:</b> {warnings[0].reason}</span><small>{warnings[0].createdAt?.toLocaleDateString('ar-EG') || ''}</small>{warnings[0].messageId && messages.some((item) => item.id === warnings[0].messageId) && <button type="button" onClick={() => jumpToMessage(warnings[0].messageId!)}>الانتقال للرسالة</button>}</div>}

      {announcements.length > 0 && <section className="chat-announcement-stack" aria-label="التعاميم الإدارية">
        {announcements.slice(0,5).map((item) => <article className="chat-announcement-card" key={item.id}>
          <div className="chat-announcement-head"><span className="chat-announcement-icon"><Megaphone size={17}/></span><div><b>تعميم إداري</b><small>{item.createdAt?.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) || 'حديثاً'}{item.updatedAt && item.createdAt && item.updatedAt.getTime() - item.createdAt.getTime() > 1000 ? ' · تم التعديل' : ''}</small></div>
            {isAdmin && <details className="chat-announcement-actions"><summary aria-label="خيارات التعميم"><MoreHorizontal size={17}/></summary><div><button type="button" onClick={() => { setAnnouncementTarget(item); setAnnouncementModalOpen(true); }}><Pencil size={14}/> تعديل التعميم</button><button type="button" className="danger" onClick={() => void removeAnnouncement(item)}><Trash2 size={14}/> حذف التعميم</button></div></details>}
          </div>
          <p>{item.text}</p>
        </article>)}
      </section>}

      {pinnedMessages.length > 0 && <div className="chat-pinned-strip"><div className="chat-pinned-strip-label"><Pin size={15}/><span>الرسائل المثبتة</span></div><div className="chat-pinned-strip-list">{pinnedMessages.slice(0,3).map((message) => <button type="button" key={message.id} onClick={() => jumpToMessage(message.id)}><b>{message.senderName}</b><span>{message.text || message.attachments[0]?.name || "مرفق"}</span></button>)}</div></div>}

      {showUnreadJump && unreadMessages.length > 0 && <button type="button" className="chat-unread-jump" onClick={jumpToLatest}>
        <span>{unreadMessages.length} {unreadMessages.length === 1 ? 'رسالة جديدة' : 'رسائل جديدة'}</span><ArrowDown size={15}/>
      </button>}
      <main
        ref={messagesListRef}
        onScroll={handleMessagesScroll}
        className="chat-messages-rebuilt"
        aria-live="polite"
        style={chatBackgroundUrl ? {
          backgroundImage: `linear-gradient(rgba(7, 16, 31, .42), rgba(7, 16, 31, .42)), url("${chatBackgroundUrl.replace(/"/g, '%22')}")`,
          backgroundPosition: 'center', backgroundSize: 'cover', backgroundAttachment: 'local',
        } : undefined}
      >
        {loading && <div className="chat-reference-state"><span className="spinner"/><b>جارٍ تحميل المحادثة</b><small>يتم الاتصال بغرفة الدردشة المباشرة.</small></div>}
        {!loading && visibleMessages.length === 0 && <div className="chat-reference-state"><div className="chat-reference-empty-icon"><MessageCircle size={27}/></div><b>{messages.length === 0 ? 'لا توجد رسائل حتى الآن' : 'لا توجد نتائج مطابقة'}</b><small>{messages.length === 0 ? 'ابدأ المحادثة وشارك زملاءك ما يفيدهم.' : 'جرّب البحث باسم أو كلمة مختلفة.'}</small></div>}
        {visibleMessages.map((message, index) => {
          const mine = message.senderId === user.uid;
          const previous = visibleMessages[index - 1];
          const currentDay = message.createdAt?.toDateString() ?? 'today';
          const previousDay = previous?.createdAt?.toDateString() ?? 'today';
          const showDay = !previous || currentDay !== previousDay;
          const grouped = !mine && previous?.senderId === message.senderId && !showDay;
          const senderInitial = message.senderName.trim().slice(0, 1) || '؟';
          const messageText = message.text || message.attachments[0]?.name || 'مرفق';
          return <Fragment key={message.id}>
            {showDay && <div className="chat-date-divider"><span>{formatDay(message.createdAt)}</span></div>}
            {firstVisibleUnreadId === message.id && <div className="chat-unread-divider"><span>{visibleUnreadMessages.length} رسالة غير مقروءة</span></div>}
            <article
              id={'chat-message-' + message.id}
              className={'chat-msg ' + (mine ? 'sent' : 'received') + (grouped ? ' chat-msg-grouped' : '') + (message.pinned ? ' chat-msg-pinned' : '')}
              onContextMenu={(event) => onMessageContextMenu(event, message)}
              onPointerDown={(event) => {
                if (event.pointerType !== 'touch' || (event.target as HTMLElement).closest('button,a,input,textarea')) return;
                if (pressTimer.current) clearTimeout(pressTimer.current);
                longPressTriggered.current = false;
                swipeStart.current = { x: event.clientX, y: event.clientY, startedAt: Date.now() };
                pressTimer.current = setTimeout(() => {
                  longPressTriggered.current = true;
                  swipeStart.current = null;
                  openContextMenu(message, event.clientX, event.clientY);
                }, 520);
              }}
              onPointerMove={(event) => {
                const start = swipeStart.current;
                if (!start || event.pointerType !== 'touch') return;
                const dx = event.clientX - start.x;
                const dy = event.clientY - start.y;
                const isRtl = getComputedStyle(event.currentTarget).direction === 'rtl';
                const replyDirection = isRtl ? dx <= -18 : dx >= 18;
                const indicator = event.currentTarget.querySelector('.chat-swipe-reply-indicator');
                indicator?.classList.toggle('is-visible', replyDirection && Math.abs(dx) > Math.abs(dy) * 1.1);
                if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                  if (pressTimer.current) clearTimeout(pressTimer.current);
                  const visualOffset = Math.max(-44, Math.min(44, dx * 0.24));
                  event.currentTarget.style.transform = `translateX(${visualOffset}px)`;
                } else if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx) * 1.2) {
                  if (pressTimer.current) clearTimeout(pressTimer.current);
                  event.currentTarget.style.transform = '';
                  indicator?.classList.remove('is-visible');
                  swipeStart.current = null;
                }
              }}
              onPointerUp={(event) => {
                if (pressTimer.current) clearTimeout(pressTimer.current);
                const start = swipeStart.current;
                event.currentTarget.style.transform = '';
                event.currentTarget.querySelector('.chat-swipe-reply-indicator')?.classList.remove('is-visible');
                swipeStart.current = null;
                if (!start || longPressTriggered.current || event.pointerType !== 'touch') return;
                const dx = event.clientX - start.x;
                const dy = event.clientY - start.y;
                const elapsed = Date.now() - start.startedAt;
                const isRtl = getComputedStyle(event.currentTarget).direction === 'rtl';
                const swipeReplies = isRtl ? dx <= -64 : dx >= 64;
                if (swipeReplies && Math.abs(dx) > Math.abs(dy) * 1.25 && elapsed < 900) {
                  beginReply(message);
                  setNotice(`الرد على ${message.senderName}`);
                }
              }}
              onPointerCancel={(event) => {
                if (pressTimer.current) clearTimeout(pressTimer.current);
                swipeStart.current = null;
                event.currentTarget.style.transform = '';
                event.currentTarget.querySelector('.chat-swipe-reply-indicator')?.classList.remove('is-visible');
              }}
            >
              <div className="chat-swipe-reply-indicator" aria-hidden="true"><ArrowDownLeft size={16}/></div>
              {!grouped && <button type="button" className="chat-profile-avatar chat-profile-avatar-outside chat-profile-open" onClick={() => onOpenProfile(message.senderId)} aria-label={`فتح ملف ${message.senderName}`} title="عرض الملف الشخصي">
                {message.senderPhotoURL ? <img src={message.senderPhotoURL} alt=""/> : senderInitial}
              </button>}
              {!grouped && <div className="msg-header"><button type="button" className="chat-profile-name-link" onClick={() => onOpenProfile(message.senderId)} title={`عرض ملف ${message.senderName}`}>{message.senderName}{mine ? ' · أنت' : ''}</button>{message.pinned && <Pin size={11}/>}</div>}
              {!message.deleted && message.replyTo && <button type="button" className="reply-block" onClick={() => jumpToMessage(message.replyTo!.id)}>
                <span className="ru">{message.replyTo.senderName}</span><span className="rt">{messages.find((item) => item.id === message.replyTo!.id)?.deleted ? 'هذه الرسالة محذوفة' : message.replyTo.text}</span>
              </button>}
              {message.deleted ? <div className="chat-deleted-message"><Trash2 size={13}/> تم حذف هذه الرسالة</div> : null}
              {!message.deleted && message.text && <div className="t">{message.text}</div>}
              {!message.deleted && message.attachments.length > 0 && <div className="message-gallery" data-image-count={message.attachments.filter((item) => item.mimeType.startsWith('image/')).length}>
                {message.attachments.map((attachment, attachmentIndex) => {
                  const imageFile = attachment.mimeType.startsWith('image/');
                  const videoFile = attachment.mimeType.startsWith('video/');
                  return imageFile
                    ? <figure className="chat-media-item" key={attachment.url + attachmentIndex}>
                        <button type="button" className="chat-media-frame" onClick={() => openMessageGallery(message.attachments, attachment)} aria-label={'عرض ' + attachment.name}>
                          <img src={attachment.url} alt={attachment.name} loading="lazy" decoding="async"/>
                        </button>
                        <figcaption>{attachment.name}</figcaption>
                      </figure>
                    : <a className="chat-document-attachment" key={attachment.url + attachmentIndex} href={attachment.url} target="_blank" rel="noreferrer">
                        {videoFile ? <Video size={20}/> : <FileText size={20}/>}
                        <span><b>{attachment.name}</b><small>{videoFile ? 'ملف فيديو' : 'ملف مرفق'} · {(attachment.size / 1024 / 1024).toFixed(1)} MB</small></span>
                        <Download size={15}/>
                      </a>;
                })}
              </div>}
              {!message.deleted && message.edited && <small className="chat-message-edited">تم التعديل</small>}
              <div className="msg-time">{formatMessageTime(message.createdAt)}</div>
              
              {Object.entries(message.reactions ?? {}).some(([, users]) => users.length > 0) && <div className="chat-message-reactions">{Object.entries(message.reactions ?? {}).map(([emoji, users]) => users.length > 0 && <button type="button" key={emoji} className={users.includes(user.uid) ? 'mine' : ''} onClick={() => void handleReaction(message, emoji)}><span>{emoji}</span><small>{users.length}</small></button>)}</div>}
            </article>
          </Fragment>;
        })}
        <div ref={bottomRef}/>
      </main>

      <section className="chat-composer-shell" aria-label="إرسال رسالة">
        {(replyTo || editingMessage) && <div className="reply-indicator-enhanced active">
          <div className="reply-indicator-copy">
            <strong>{editingMessage ? 'تعديل رسالتك' : 'الرد على ' + replyTo?.senderName}</strong>
            <div>{editingMessage ? 'تعديل الرسالة خلال 15 دقيقة من إرسالها.' : replyTo?.text || replyTo?.attachments[0]?.name || 'مرفق'}</div>
          </div>
          <button className="close-reply" type="button" onClick={cancelComposerMode} aria-label="إلغاء"><X size={16}/></button>
        </div>}
        {files.length > 0 && <div className="chat-image-preview" id="chatImagePreviewPage">
          {files.map((file,index) => {
            const key = `${file.name}-${file.size}-${file.lastModified}-${index}`;
            const preview = filePreviews.find((item) => item.key === key);
            return <div className="chat-preview-item" key={key}>
              {file.type.startsWith('image/') && preview ? <img src={preview.url} alt=""/> : <span className="chat-preview-file-icon"><FileText size={18}/></span>}
              <span><b>{file.name}</b><small>{(file.size/1024/1024).toFixed(1)} MB</small></span>
              <button type="button" onClick={() => setFiles((items) => items.filter((_,i) => i !== index))} aria-label="إزالة المرفق"><X size={14}/></button>
            </div>;
          })}
        </div>}
        {emojiOpen && <div className="chat-reference-emoji-panel">{emojis.concat(['🎉','🔥','✅','🤝','📚','💡','✨','💯']).map((emoji) => <button type="button" key={emoji} onClick={() => appendEmoji(emoji)}>{emoji}</button>)}</div>}
        <form className="chat-input-group" onSubmit={(event) => void send(event)}>
          <button type="button" className="chat-composer-btn" onClick={() => setEmojiOpen((value) => !value)} disabled={muteState.muted || (lockState.locked && !isAdmin) || sending} aria-label="اختيار رمز تعبيري" title="رموز تعبيرية"><Smile size={20}/></button>
          <button type="button" className="chat-composer-btn" onClick={() => fileInput.current?.click()} disabled={muteState.muted || (lockState.locked && !isAdmin) || sending} aria-label="إرفاق ملف أو صورة" title="إرفاق ملف"><Paperclip size={20}/></button>
          <input ref={fileInput} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt" className="visually-hidden" onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            setFiles((current) => {
              const combined = [...current, ...picked];
              if (combined.length > 8) setError('يمكن إرفاق 8 ملفات كحد أقصى في الرسالة الواحدة.');
              return combined.slice(0,8);
            });
            if (fileInput.current) fileInput.current.value = '';
          }}/>
          <div className="chat-input-wrap">
            <textarea ref={composerRef} rows={1} maxLength={5000} value={draft} disabled={muteState.muted || (lockState.locked && !isAdmin) || sending} onChange={(event) => setDraft(event.target.value)} placeholder={muteState.muted ? 'تم إيقاف الإرسال مؤقتاً' : lockState.locked && !isAdmin ? 'المحادثة مقفلة مؤقتاً' : editingMessage ? 'عدّل نص الرسالة...' : 'اكتب رسالتك هنا...'} aria-label="نص الرسالة" onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}/>
            <span className="chat-composer-counter">{draft.length}/5000</span>
          </div>
          <button type="submit" className="chat-send-btn" disabled={muteState.muted || (lockState.locked && !isAdmin) || sending || (!draft.trim() && files.length === 0)} aria-label={editingMessage ? 'حفظ التعديل' : 'إرسال'}>
            {sending ? <span className="spinner"/> : editingMessage ? <Check size={19}/> : <Send size={18}/>}
          </button>
        </form>
        {error && <div className="chat-error" role="alert"><AlertCircle size={14}/><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="إغلاق"><X size={14}/></button></div>}
        <div className="chat-composer-note"><span>Enter للإرسال</span><span>Shift + Enter لسطر جديد</span></div>
      </section>
    </div>

    {contextMessage && <div className="chat-context-overlay" onMouseDown={() => setContextMessage(null)}>
      <div className="chat-context-menu" style={{ left: contextPosition.x, top: contextPosition.y }} onMouseDown={(event) => event.stopPropagation()}>
        <div className="chat-context-heading">إجراءات الرسالة</div>
        {!contextMessage.deleted && <button type="button" onClick={() => void copyMessage(contextMessage)}><Copy size={16}/> نسخ الرسالة</button>}
        {!contextMessage.deleted && <button type="button" onClick={() => beginReply(contextMessage)}><ArrowDownLeft size={16}/> الرد على الرسالة</button>}
        {contextMessage.senderId === user.uid && !contextMessage.deleted && editAllowed(contextMessage) && <button type="button" onClick={() => beginEdit(contextMessage)}><Pencil size={16}/> تعديل الرسالة</button>}
        {contextMessage.senderId === user.uid && !contextMessage.deleted && <button type="button" className="danger" onClick={() => void removeMessage(contextMessage)}><Trash2 size={16}/> حذف لدى الجميع</button>}
        {!contextMessage.deleted && <button type="button" onClick={() => void hideMessageForMe(contextMessage)}><EyeOff size={16}/> إخفاء لدي فقط</button>}
        {isAdmin && contextMessage.senderId !== user.uid && !contextMessage.deleted && <button type="button" className="danger" onClick={() => void adminDeleteMessage(contextMessage)}><Trash2 size={16}/> حذف الرسالة للطلاب</button>}
        {isAdmin && contextMessage.deleted && <button type="button" className="danger" onClick={() => void permanentlyDeleteMessage(contextMessage)}><Trash2 size={16}/> حذف نهائي للجميع</button>}
        {isAdmin && <button type="button" onClick={() => void handlePin(contextMessage)}><Pin size={16}/> {contextMessage.pinned ? 'إلغاء التثبيت' : 'تثبيت الرسالة'}</button>}
        {isAdmin && contextMessage.senderId !== user.uid && <button type="button" onClick={() => void handleMute(contextMessage)}><ShieldCheck size={16}/> {contextMuted ? 'إلغاء الكتم' : 'كتم لمدة ساعة'}</button>}
        {isAdmin && contextMessage.senderId !== user.uid && <button type="button" onClick={() => void handleWarning(contextMessage)}><AlertCircle size={16}/> إرسال تحذير إداري</button>}
        <div className="chat-context-reactions">{emojis.map((emoji) => <button type="button" key={emoji} onClick={() => void handleReaction(contextMessage, emoji)}>{emoji}</button>)}</div>
      </div>
    </div>}

    {lightbox && <div className="chat-image-lightbox" role="dialog" aria-modal="true" aria-label={lightbox.name} onClick={closeMessageGallery}>
      <div className="chat-lightbox-topbar" onClick={(event) => event.stopPropagation()}>
        <div><b>{lightbox.name}</b><small>{lightboxIndex + 1} / {lightboxItems.length}</small></div>
        <div className="chat-lightbox-tools">
          <button type="button" onClick={() => setLightboxScale((value) => Math.max(1, Math.min(3, value - .25)))} aria-label="تصغير الصورة"><Minus size={17}/></button>
          <span>{Math.round(lightboxScale * 100)}%</span>
          <button type="button" onClick={() => setLightboxScale((value) => Math.min(3, value + .25))} aria-label="تكبير الصورة"><Plus size={17}/></button>
          <button type="button" onClick={() => setLightboxScale(1)} aria-label="الحجم الطبيعي"><Maximize size={17}/></button>
          <button type="button" onClick={closeMessageGallery} aria-label="إغلاق الصورة"><X size={20}/></button>
        </div>
      </div>
      <div className="chat-lightbox-stage" onClick={(event) => event.stopPropagation()}>
        {lightboxItems.length > 1 && <button type="button" className="chat-lightbox-prev" onClick={() => { setLightboxIndex((index) => (index - 1 + lightboxItems.length) % lightboxItems.length); setLightboxScale(1); }} aria-label="الصورة السابقة"><ChevronRight size={22}/></button>}
        <img src={lightbox.url} alt={lightbox.name} style={{transform:`scale(${lightboxScale})`}} onDoubleClick={() => setLightboxScale((value) => value === 1 ? 2 : 1)} onWheel={(event) => { event.preventDefault(); setLightboxScale((value) => Math.max(1, Math.min(3, value + (event.deltaY < 0 ? .12 : -.12)))); }}/>
        {lightboxItems.length > 1 && <button type="button" className="chat-lightbox-next" onClick={() => { setLightboxIndex((index) => (index + 1) % lightboxItems.length); setLightboxScale(1); }} aria-label="الصورة التالية"><ChevronLeft size={22}/></button>}
      </div>
      {lightboxItems.length > 1 && <div className="chat-lightbox-thumbs" onClick={(event) => event.stopPropagation()}>{lightboxItems.map((item,index) => <button type="button" key={item.url} className={index===lightboxIndex?'active':''} onClick={() => { setLightboxIndex(index); setLightboxScale(1); }}><img src={item.url} alt=""/></button>)}</div>}
    </div>}
    {lockSettingsOpen && <ChatLockModal onClose={() => setLockSettingsOpen(false)} onSave={saveChatLock} busy={moderationBusy}/>}
    {muteTarget && <ChatMuteModal userName={muteTarget.senderName} onClose={() => setMuteTarget(null)} onSave={saveMuteDuration} busy={moderationBusy}/>}
    {warningTarget && <ChatWarningModal userName={warningTarget.senderName} onClose={() => setWarningTarget(null)} onSave={saveWarning} busy={moderationBusy}/>}
    {announcementModalOpen && <ChatAnnouncementModal initialText={announcementTarget?.text ?? ''} onClose={() => { if (!moderationBusy) { setAnnouncementModalOpen(false); setAnnouncementTarget(null); } }} onSave={saveAnnouncement} busy={moderationBusy}/>}
    {slowModeSettingsOpen && <ChatSlowModeModal initial={slowMode} onClose={() => { if (!moderationBusy) setSlowModeSettingsOpen(false); }} onSave={saveSlowMode} busy={moderationBusy}/>}
  </section>;
}
