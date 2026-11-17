import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage, type MessagePayload } from 'firebase/messaging';
import { app, db, isFirebaseConfigured } from './firebase';

/** Requests browser permission and saves this browser's FCM token in Firestore. */
export async function enablePushNotifications(userId: string): Promise<void> {
  if (!isFirebaseConfigured || !app || !db) {
    throw new Error('Firebase غير مهيأ. تحقق من إعدادات المشروع أولاً.');
  }
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('هذا المتصفح لا يدعم إشعارات الويب.');
  }
  if (!userId) throw new Error('يجب تسجيل الدخول قبل تفعيل الإشعارات.');

  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'تم منع الإشعارات من إعدادات المتصفح. اسمح بها للموقع ثم أعد المحاولة.'
      : 'لم يتم منح إذن الإشعارات.');
  }

  if (!(await isSupported())) {
    throw new Error('خدمة Firebase Cloud Messaging غير مدعومة في هذا المتصفح.');
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
  if (!vapidKey) throw new Error('مفتاح VAPID العام غير مضبوط في إعدادات النشر.');

  const baseUrl = import.meta.env.BASE_URL;
  const serviceWorkerRegistration = await navigator.serviceWorker.register(
    `${baseUrl}fcm/firebase-messaging-sw.js`,
    { scope: `${baseUrl}fcm/` },
  );
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
  if (!token) throw new Error('لم يتمكن Firebase من إنشاء رمز الإشعارات لهذا المتصفح.');

  // Keep one Firestore record per browser token; no server key or private VAPID key is stored.
  const deviceId = encodeURIComponent(token);
  await setDoc(doc(collection(db, 'devices'), deviceId), {
    userId,
    token,
    platform: 'web',
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    userAgent: navigator.userAgent,
  }, { merge: true });
}


/** Attaches a foreground message listener after Firebase Messaging reports browser support. */
export async function listenForForegroundMessages(
  callback: (payload: MessagePayload) => void,
): Promise<() => void> {
  if (!app || !(await isSupported())) return () => undefined;
  return onMessage(getMessaging(app), callback);
}
