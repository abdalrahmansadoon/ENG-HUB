import {
  doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

export interface CloudinarySettings {
  enabled: boolean;
  cloudName: string;
  uploadPreset: string;
  maxImageMB: number;
  maxVideoMB: number;
  maxDocumentMB: number;
}

export const defaultCloudinarySettings: CloudinarySettings = {
  // Public client-side Cloudinary settings supplied for ENG HUB.
  // The upload preset must remain unsigned and restricted in Cloudinary.
  enabled: true,
  cloudName: 'bkryyc0o',
  uploadPreset: 'eng_hub_unsigned',
  maxImageMB: 20,
  maxVideoMB: 100,
  maxDocumentMB: 25,
};

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  resource_type: string;
  bytes: number;
  original_filename?: string;
  error?: { message?: string };
}

const cloudinaryDocument = () => {
  if (!db) throw new Error('Firebase غير متصل.');
  return doc(db, 'systemSettings', 'cloudinary');
};

export function isCloudinaryConfigured(settings: CloudinarySettings): boolean {
  return settings.enabled && Boolean(settings.cloudName.trim() && settings.uploadPreset.trim());
}

export function subscribeCloudinarySettings(
  onSettings: (settings: CloudinarySettings) => void,
  onError: (error: Error) => void,
): Unsubscribe | undefined {
  if (!db) return;
  return onSnapshot(cloudinaryDocument(), (snapshot) => {
    if (!snapshot.exists()) {
      onSettings(defaultCloudinarySettings);
      return;
    }
    const data = snapshot.data();
    onSettings({
      enabled: data.enabled === true,
      cloudName: typeof data.cloudName === 'string' && data.cloudName.trim() ? data.cloudName : defaultCloudinarySettings.cloudName,
      uploadPreset: typeof data.uploadPreset === 'string' && data.uploadPreset.trim() ? data.uploadPreset : defaultCloudinarySettings.uploadPreset,
      maxImageMB: Number(data.maxImageMB) > 0 ? Number(data.maxImageMB) : defaultCloudinarySettings.maxImageMB,
      maxVideoMB: Number(data.maxVideoMB) > 0 ? Number(data.maxVideoMB) : defaultCloudinarySettings.maxVideoMB,
      maxDocumentMB: Number(data.maxDocumentMB) > 0 ? Number(data.maxDocumentMB) : defaultCloudinarySettings.maxDocumentMB,
    });
  }, onError);
}

export async function saveCloudinarySettings(settings: CloudinarySettings, updatedBy: string): Promise<void> {
  await setDoc(cloudinaryDocument(), {
    ...settings,
    cloudName: settings.cloudName.trim(),
    uploadPreset: settings.uploadPreset.trim(),
    updatedBy,
    updatedAt: serverTimestamp(),
  });
}

const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const videoExtensions = new Set(['mp4', 'mov', 'webm']);
const allowedExtensions = new Set([
  ...imageExtensions, ...videoExtensions,
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt', 'zip',
]);

function fileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

/** Uploads through a restricted unsigned preset. No Cloudinary API secret is used in the browser. */
export async function uploadToCloudinary(file: File, settings: CloudinarySettings): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured(settings)) {
    throw new Error('إعدادات Cloudinary غير مكتملة. أدخل Cloud Name وUnsigned Upload Preset من لوحة الإدارة.');
  }

  const extension = fileExtension(file.name);
  if (!allowedExtensions.has(extension)) {
    throw new Error('الامتداد غير مدعوم. الأنواع المتاحة: PDF وOffice وCSV وTXT وZIP والصور والفيديو.');
  }

  const isImage = imageExtensions.has(extension);
  const isVideo = videoExtensions.has(extension);
  const maxMB = isImage ? settings.maxImageMB : isVideo ? settings.maxVideoMB : settings.maxDocumentMB;
  if (file.size > maxMB * 1024 * 1024) {
    throw new Error(`حجم الملف يتجاوز الحد المحدد (${maxMB} MB).`);
  }

  const resourceType = isImage ? 'image' : isVideo ? 'video' : 'raw';
  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', settings.uploadPreset.trim());
  body.append('folder', 'eng-hub');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(settings.cloudName.trim())}/${resourceType}/upload`,
    { method: 'POST', body },
  );
  const result = await response.json() as CloudinaryUploadResult;
  if (!response.ok) throw new Error(result.error?.message ?? 'فشل رفع الملف إلى Cloudinary.');
  if (!result.secure_url) throw new Error('لم يُرجع Cloudinary رابط الملف.');
  return result;
}
