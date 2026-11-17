import { uploadToCloudinary, type CloudinarySettings } from './cloudinary';

/** Every binary asset is stored in Cloudinary; Firebase stores only its metadata and URL. */
export async function uploadFile(file: File, settings: CloudinarySettings): Promise<string> {
  const result = await uploadToCloudinary(file, settings);
  return result.secure_url;
}
