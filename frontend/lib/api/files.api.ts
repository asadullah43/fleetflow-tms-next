import { ApiError } from './errors';
import { backendUrl, httpCall } from './client';

/** An uploaded file attached to a record (proto fleetflow.common.FileInfo). */
export interface FileInfoDto {
  id: number;
  name: string;
  contentType: string;
  size: number;
  uploadedAt?: string;
  uploadedBy?: string;
}

/** What a file is uploaded for; decides who may upload and open it (backend FILE_PURPOSES). */
export type FilePurpose = 'EMPLOYEE_DOCUMENT' | 'CONTRACT_DOCUMENT';

/** Mirrors the backend's checks, so a wrong file is caught before it is sent. The backend checks again (it decides). */
export const UPLOAD_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp';
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const ACCEPTED_EXTENSIONS = /\.(pdf|jpe?g|png|webp)$/i;

/** The reason a file will be refused, or null. */
export function uploadProblem(file: { name: string; size: number; type: string }): string | null {
  if (file.size === 0) return 'This file is empty.';
  if (file.size > UPLOAD_MAX_BYTES) return 'The file is too large. The largest file you can upload is 10 MB.';
  if (!ACCEPTED_TYPES.has(file.type) && !ACCEPTED_EXTENSIONS.test(file.name)) return 'Only PDF files and images (JPEG, PNG or WebP) can be uploaded.';
  return null;
}

/** "2.4 MB", "830 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** A short-lived address that opens (or downloads) the file — the token in it is the permission, so a new tab can use it. */
async function signedUrl(id: number, download: boolean): Promise<string> {
  const { url } = await httpCall<{ url: string }>('POST', `/files/${id}/link`);
  return backendUrl(download ? `${url}&download=1` : url);
}

export const filesApi = {
  upload(purpose: FilePurpose, file: File): Promise<FileInfoDto> {
    const problem = uploadProblem(file);
    if (problem) return Promise.reject(new ApiError({ code: 'CLIENT-FILE', filter: 'INVALID_REQUEST', message: problem }));
    const form = new FormData();
    form.append('file', file, file.name);
    return httpCall<FileInfoDto>('POST', `/files?purpose=${purpose}`, form);
  },

  /**
   * Opens the file in a new tab (the browser's PDF / image viewer). The tab
   * is opened at once — inside the click — so popup blockers allow it, and
   * pointed at the file when its link arrives.
   */
  async open(id: number): Promise<void> {
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null; // the file's tab cannot reach back into the app
    try {
      const url = await signedUrl(id, false);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (error) {
      tab?.close();
      throw error;
    }
  },

  /** Downloads the file (saved under its original name). */
  async download(id: number): Promise<void> {
    window.location.assign(await signedUrl(id, true));
  },
};
