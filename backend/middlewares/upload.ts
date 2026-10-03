/**
 * Middlewares of the file-upload HTTP endpoint (routes/files.http.ts):
 * who may upload for a purpose, and reading the multipart body — after
 * authentication, so an anonymous caller never gets 10 MB read.
 */
import type { IncomingMessage } from 'node:http';
import { AppError } from '../classes/app-error.js';
import { config } from '../global_config/index.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { canUpload, isFilePurpose, tooLarge } from '../services/files.service.js';
import type { Middleware } from './request-context.js';

/** Room for the multipart framing around the file itself. */
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

export interface UploadInput {
  purpose: string;
  file?: { name: string; bytes: Uint8Array };
}

/** The purpose must be known and the caller must hold add or edit on its module. */
export const authorizeUpload: Middleware = async (ctx, next) => {
  const { purpose } = ctx.input as UploadInput;
  if (!isFilePurpose(purpose)) throw AppError.from(ErrorCode.FIL_INVALID_PURPOSE, 400);
  if (!ctx.principal) throw AppError.from(ErrorCode.AUTH_TOKEN_MISSING, 401);
  if (!canUpload(ctx.principal, purpose)) throw AppError.from(ErrorCode.AUTH_PERMISSION_DENIED, 403);
  return next();
};

/** Reads the request body, stopping (and failing) as soon as it exceeds the limit. */
function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        req.off('data', onData);
        reject(tooLarge());
        return;
      }
      chunks.push(chunk);
    };
    req.on('data', onData);
    req.once('end', () => resolve(Buffer.concat(chunks)));
    req.once('error', reject);
  });
}

/** Parses multipart/form-data and puts its "file" part on ctx.input.file. */
export const readUpload: Middleware = async (ctx, next) => {
  const req = ctx.request as IncomingMessage;
  const contentType = req.headers['content-type'] ?? '';
  if (!/^multipart\/form-data\b/i.test(contentType)) throw AppError.from(ErrorCode.FIL_NOT_MULTIPART, 400);
  const limit = config.files.maxBytes + MULTIPART_OVERHEAD_BYTES;
  if (Number(req.headers['content-length'] ?? 0) > limit) throw tooLarge();

  const body = await readBody(req, limit);
  let form: FormData;
  try {
    form = await new Request('http://upload.local/', { method: 'POST', headers: { 'content-type': contentType }, body: new Uint8Array(body) }).formData();
  } catch {
    throw AppError.from(ErrorCode.FIL_NOT_MULTIPART, 400);
  }
  const part = form.get('file');
  if (!part || typeof part === 'string') throw AppError.from(ErrorCode.FIL_MISSING, 400);
  if (part.size > config.files.maxBytes) throw tooLarge();
  (ctx.input as UploadInput).file = { name: part.name, bytes: new Uint8Array(await part.arrayBuffer()) };
  return next();
};
