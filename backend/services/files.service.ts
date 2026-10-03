/**
 * Uploaded files: an upload is stored first (POST /files) and then
 * attached to the record it belongs to by its id (fileId on an employee
 * document, documentFileId on a contract). A file is attached to at most
 * one record; replacing or removing it — or deleting the record —
 * deletes the old file. One never attached (the form was abandoned) is
 * deleted by a background job after config.files.orphanTtlHours.
 *
 * Who may upload or read a file follows the module of what it is for
 * (its purpose): an HR document needs the `hr` permissions.
 */
import crypto from 'node:crypto';
import { deleteStoredBytes, newStorageKey, writeStoredBytes } from '../_core_app_connectivities/file-storage.js';
import { prisma } from '../_core_app_connectivities/prisma.js';
import { currentCompanyId, runUnscoped } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { config } from '../global_config/index.js';
import { ErrorCode } from '../global_config/error-codes.js';
import type { Principal } from '../models/auth-context.js';
import { cleanFileName, detectFileType } from '../utils/file-type.js';
import { logger } from '../utils/logger.js';
import { PermissionAction, PermissionModule, principalCan } from '../utils/permissions.js';

/** What a file may be uploaded for, and the permission module that guards it. */
export const FILE_PURPOSES = { EMPLOYEE_DOCUMENT: { module: 'hr' }, CONTRACT_DOCUMENT: { module: 'hr' } } as const satisfies Record<string, { module: PermissionModule }>;
export type FilePurpose = keyof typeof FILE_PURPOSES;

export function isFilePurpose(value: unknown): value is FilePurpose {
  return typeof value === 'string' && Object.hasOwn(FILE_PURPOSES, value);
}

/** The columns shown with a record's attached file. */
export const FILE_SELECT = { id: true, originalName: true, contentType: true, size: true, createdAt: true, uploadedByName: true } as const;

/** A file as the API shows it (proto fleetflow.common.FileInfo). */
export interface FileInfo {
  id: number;
  name: string;
  contentType: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
}

export function toFileInfo(row: { id: number; originalName: string; contentType: string; size: number; createdAt: Date; uploadedByName: string } | null | undefined): FileInfo | undefined {
  if (!row) return undefined;
  return { id: row.id, name: row.originalName, contentType: row.contentType, size: row.size, uploadedAt: row.createdAt, uploadedBy: row.uploadedByName };
}

/** The API path a stored file is served at (behind the same base URL as the gRPC-web API). */
export const filePath = (id: number) => `/files/${id}`;

/** Upload needs "add" or "edit" on the purpose's module (a file is only ever uploaded to add a record or change one). */
export function canUpload(principal: Principal, purpose: FilePurpose): boolean {
  const { module } = FILE_PURPOSES[purpose];
  return (['add', 'edit'] as PermissionAction[]).some((action) => principalCan(principal, module, action));
}

function requireView(principal: Principal, purpose: string): void {
  const module = isFilePurpose(purpose) ? FILE_PURPOSES[purpose].module : null;
  if (!module || !principalCan(principal, module, 'view')) throw AppError.from(ErrorCode.AUTH_PERMISSION_DENIED, 403);
}

/** Whoever uploads, as recorded on the file (and shown as a contract's "uploaded by"). */
async function uploaderOf(principal: Principal): Promise<{ id: number | null; name: string }> {
  if (principal.userId !== null) {
    const user = await prisma.user.findUnique({ where: { id: principal.userId }, select: { name: true, username: true } });
    return { id: principal.userId, name: user?.name || user?.username || `User #${principal.userId}` };
  }
  const key = principal.apiKeyId !== null ? await prisma.apiKey.findUnique({ where: { id: principal.apiKeyId }, select: { name: true } }) : null;
  return { id: null, name: key ? `API key: ${key.name}` : 'API key' };
}

// ── Signed links: open / download in a new tab, where no Authorization header can be sent ──

const linkKey = () => crypto.createHmac('sha256', config.auth.jwtSecret).update('fleetflow:file-links').digest();
const sign = (id: number, expires: number) => crypto.createHmac('sha256', linkKey()).update(`${id}.${expires}`).digest('base64url');

function linkToken(id: number, now = Date.now()): { token: string; expiresAt: Date } {
  const expires = Math.floor(now / 1000) + config.files.linkTtlSeconds;
  return { token: `${expires}.${sign(id, expires)}`, expiresAt: new Date(expires * 1000) };
}

/** True when `token` was issued by this server for file `id` and has not expired. */
export function isValidLinkToken(id: number, token: string, now = Date.now()): boolean {
  const [expiresText, signature] = token.split('.');
  const expires = Number(expiresText);
  if (!Number.isInteger(expires) || !signature || expires * 1000 < now) return false;
  const expected = Buffer.from(sign(id, expires));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export const filesService = {
  /** Stores an upload after checking its size and real type. Runs in the caller's tenant. */
  async upload(principal: Principal, purpose: FilePurpose, originalName: string | undefined, bytes: Uint8Array): Promise<FileInfo> {
    if (bytes.length === 0) throw AppError.from(ErrorCode.FIL_MISSING, 400);
    if (bytes.length > config.files.maxBytes) throw tooLarge();
    const contentType = detectFileType(bytes);
    if (!contentType) throw AppError.from(ErrorCode.FIL_TYPE_NOT_ALLOWED, 400);

    const companyId = currentCompanyId();
    const storageKey = newStorageKey(companyId);
    const uploader = await uploaderOf(principal);
    try {
      await writeStoredBytes(storageKey, bytes);
    } catch (error) {
      throw AppError.from(ErrorCode.FIL_UPLOAD_FAILED, 500, error);
    }
    try {
      const row = await prisma.storedFile.create({
        data: {
          companyId,
          purpose,
          originalName: cleanFileName(originalName),
          contentType,
          size: bytes.length,
          sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
          storageKey,
          uploadedById: uploader.id,
          uploadedByName: uploader.name,
        },
        select: FILE_SELECT,
      });
      return toFileInfo(row)!;
    } catch (error) {
      await deleteStoredBytes(storageKey).catch(() => undefined);
      throw AppError.from(ErrorCode.FIL_UPLOAD_FAILED, 500, error);
    }
  },

  /** A short-lived link to open (or download) a file the caller may view. */
  async link(principal: Principal, id: number): Promise<{ url: string; expiresAt: Date }> {
    const file = await prisma.storedFile.findUnique({ where: { id }, select: { id: true, purpose: true } });
    if (!file) throw AppError.from(ErrorCode.FIL_NOT_FOUND, 404);
    requireView(principal, file.purpose);
    const { token, expiresAt } = linkToken(file.id);
    return { url: `${filePath(file.id)}?token=${token}`, expiresAt };
  },

  /** The stored file for serving to an authenticated caller (permission checked here). */
  async forCaller(principal: Principal, id: number) {
    const file = await prisma.storedFile.findUnique({ where: { id } });
    if (!file) throw AppError.from(ErrorCode.FIL_NOT_FOUND, 404);
    requireView(principal, file.purpose);
    return file;
  },

  /** The stored file for a signed link (the link itself is the permission). */
  async forLink(id: number, token: string) {
    if (!isValidLinkToken(id, token)) throw AppError.from(ErrorCode.FIL_LINK_INVALID, 403);
    const file = await runUnscoped(() => prisma.storedFile.findUnique({ where: { id } }));
    if (!file) throw AppError.from(ErrorCode.FIL_NOT_FOUND, 404);
    return file;
  },

  /**
   * For a record's create / update: checks that `fileId` may be attached
   * (this company's, uploaded for this purpose, not on another record)
   * and returns it. `currentId` is the record's file now — keeping it is
   * always fine.
   */
  async claim(fileId: number, purpose: FilePurpose, currentId: number | null = null) {
    const file = await prisma.storedFile.findUnique({
      where: { id: fileId },
      select: { ...FILE_SELECT, purpose: true, employeeDocument: { select: { id: true } }, employmentContract: { select: { id: true } } },
    });
    if (!file) throw AppError.from(ErrorCode.FIL_NOT_FOUND, 400);
    if (file.id === currentId) return file;
    if (file.purpose !== purpose) throw AppError.from(ErrorCode.FIL_WRONG_PURPOSE, 400);
    if (file.employeeDocument || file.employmentContract) throw AppError.from(ErrorCode.FIL_ALREADY_ATTACHED, 409);
    return file;
  },

  /**
   * Deletes a file that no record uses any more (after the record let go
   * of it). Never fails the request that triggered it: a file left behind
   * is picked up by the background cleanup.
   */
  async release(fileId: number | null | undefined): Promise<void> {
    if (!fileId) return;
    try {
      const file = await prisma.storedFile.findUnique({ where: { id: fileId }, select: { storageKey: true } });
      if (file && (await deleteIfUnattached(fileId))) await deleteStoredBytes(file.storageKey);
    } catch (error) {
      logger.warn('could not delete a released file (the cleanup job will retry)', { fileId, error });
    }
  },
};

/** The row is only deleted when nothing references it — checked in the same statement, so a concurrent attach wins. */
async function deleteIfUnattached(id: number): Promise<boolean> {
  const { count } = await prisma.storedFile.deleteMany({ where: { id, employeeDocument: { is: null }, employmentContract: { is: null } } });
  return count > 0;
}

export function tooLarge(): AppError {
  const megabytes = Math.round((config.files.maxBytes / (1024 * 1024)) * 10) / 10;
  return AppError.from(ErrorCode.FIL_TOO_LARGE, 413, undefined, `The file is too large. The largest file you can upload is ${megabytes} MB.`);
}

/**
 * Background housekeeping across all companies: deletes uploads that
 * were never attached to a record and are older than the orphan TTL.
 */
export async function purgeOrphanFiles(now = Date.now()): Promise<number> {
  const cutoff = new Date(now - config.files.orphanTtlHours * 60 * 60 * 1000);
  return runUnscoped(async () => {
    const orphans = await prisma.storedFile.findMany({
      where: { createdAt: { lt: cutoff }, employeeDocument: { is: null }, employmentContract: { is: null } },
      select: { id: true, storageKey: true },
      take: 500,
    });
    let deleted = 0;
    for (const orphan of orphans) {
      if (await deleteIfUnattached(orphan.id)) {
        await deleteStoredBytes(orphan.storageKey).catch((error) => logger.warn('orphan file bytes not deleted', { fileId: orphan.id, error }));
        deleted++;
      }
    }
    return deleted;
  });
}
