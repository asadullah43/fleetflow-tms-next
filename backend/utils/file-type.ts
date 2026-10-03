/**
 * What an uploaded file really is, from its first bytes ("magic numbers")
 * — never from its name or the Content-Type the browser sent, both of
 * which the uploader controls. Only these types are accepted: they are
 * what scans and contracts come as, and what a browser can show inline.
 */
export const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedFileType = (typeof ALLOWED_FILE_TYPES)[number];

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/** The detected type, or null when it is none of the allowed ones. */
export function detectFileType(bytes: Uint8Array): AllowedFileType | null {
  // "%PDF-" — at the very start, or after a little leading junk some scanners write (readers accept up to 1 KB).
  const pdf = ascii('%PDF-');
  for (let offset = 0; offset <= Math.min(1024, bytes.length - pdf.length); offset++) {
    if (startsWith(bytes, pdf, offset)) return 'application/pdf';
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp';
  return null;
}

/**
 * A display / download name that is safe to echo back: no directory
 * parts, no control characters, bounded length. It is never used as a
 * path on disk (files are stored under a random key).
 */
export function cleanFileName(name: string | undefined): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  if (!cleaned) return 'file';
  if (cleaned.length <= 150) return cleaned;
  const dot = cleaned.lastIndexOf('.');
  const extension = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : '';
  return cleaned.slice(0, 150 - extension.length) + extension;
}

/** Content-Disposition with an ASCII fallback and the exact (UTF-8, e.g. Arabic) name for browsers that read filename*. */
export function contentDisposition(kind: 'inline' | 'attachment', name: string): string {
  const fallback = name.replace(/[^\x20-\x7e]/g, '_').replace(/[\\%]/g, '_');
  return `${kind}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
