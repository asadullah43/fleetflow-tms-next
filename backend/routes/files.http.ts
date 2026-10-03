/**
 * The plain-HTTP side of the API: file upload and download, which gRPC
 * (unary, protobuf) does not carry well. Envoy routes /files/ here (see
 * envoy/envoy.yaml), so the browser reaches it at the same base URL as
 * the gRPC-web API. The same middlewares guard it as every rpc:
 *
 *   POST /files?purpose=EMPLOYEE_DOCUMENT   rate limit → authenticate → authorize upload → read multipart → store
 *   POST /files/:id/link                    rate limit → authenticate → (view permission) → signed link
 *   GET  /files/:id?token=…[&download=1]    rate limit → valid signed link → stream the file
 *   GET  /files/:id   (Authorization / x-api-key, for integrations)  rate limit → authenticate → (view) → stream
 *
 * JSON answers use the same envelope as the gRPC API (STATUS, ERROR_CODE,
 * ERROR_FILTER, ERROR_DESCRIPTION), with the result in DATA.
 */
import crypto from 'node:crypto';
import http, { IncomingMessage, ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import * as grpc from '@grpc/grpc-js';
import { trackRequestWrites } from '../_core_app_connectivities/cache.js';
import { openStoredBytes } from '../_core_app_connectivities/file-storage.js';
import { AppError } from '../classes/app-error.js';
import { filesController, FileIdInput } from '../controllers/files.controller.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { config } from '../global_config/index.js';
import { authenticate } from '../middlewares/authentication.js';
import { OperationKind, toAppError } from '../middlewares/error-handler.js';
import { rateLimitByIp } from '../middlewares/rate-limit.js';
import { compose, Controller, Middleware, RequestContext } from '../middlewares/request-context.js';
import { authorizeUpload, readUpload } from '../middlewares/upload.js';
import { contentDisposition } from '../utils/file-type.js';
import { logger } from '../utils/logger.js';
import { serialize } from '../utils/serialize.js';
import { logRequest } from './router.js';

interface FileRoute {
  name: string;
  op: OperationKind;
  chain: Middleware[];
  controller: Controller;
  /** Streams the returned StoredFile instead of answering JSON. */
  stream?: boolean;
}

/** Which route a request is, and its input from the URL. */
function match(method: string, url: URL): { route: FileRoute; input: Record<string, unknown> } | null {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] !== 'files') return null;
  const id = Number(segments[1]);
  const validId = Number.isInteger(id) && id > 0 && String(id) === segments[1];

  if (method === 'POST' && segments.length === 1) {
    return {
      route: { name: 'Upload', op: 'write', chain: [authenticate, authorizeUpload, readUpload], controller: filesController.upload },
      input: { purpose: url.searchParams.get('purpose') ?? '' },
    };
  }
  if (method === 'POST' && segments.length === 3 && validId && segments[2] === 'link') {
    return { route: { name: 'Link', op: 'read', chain: [authenticate], controller: filesController.link }, input: { id } };
  }
  if (method === 'GET' && segments.length === 2 && validId) {
    const token = url.searchParams.get('token') ?? undefined;
    const input: FileIdInput = { id, token, download: url.searchParams.get('download') === '1' };
    // With a signed link, the link is the permission; without one, normal credentials are required.
    return { route: { name: 'Download', op: 'read', chain: token ? [] : [authenticate], controller: filesController.serve, stream: true }, input: input as unknown as Record<string, unknown> };
  }
  return null;
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** The same RequestContext the gRPC router builds, from HTTP headers. */
function contextFor(rpc: string, req: IncomingMessage, input: Record<string, unknown>): RequestContext {
  const metadata = new grpc.Metadata();
  for (const name of ['authorization', config.auth.apiKeyHeader, 'x-request-id']) {
    const value = headerValue(req, name);
    if (value) metadata.set(name, value);
  }
  const forwarded = headerValue(req, 'x-real-ip')?.trim() || headerValue(req, 'x-forwarded-for')?.split(',').pop()?.trim();
  return {
    rpc,
    requestId: headerValue(req, 'x-request-id') ?? crypto.randomUUID(),
    startedAt: Date.now(),
    ip: forwarded || req.socket.remoteAddress || 'unknown',
    metadata,
    request: req,
    input,
    principal: null,
  };
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store' });
  res.end(text);
}

/**
 * Lets the rest of an unread request body arrive (and be discarded)
 * before answering — browsers report an answer sent mid-upload as a
 * network error — but never more than a bounded amount.
 */
function discardBody(req: IncomingMessage): Promise<void> {
  if (req.readableEnded || req.destroyed) return Promise.resolve();
  const cap = config.files.maxBytes * 2 + 1024 * 1024;
  let seen = 0;
  return new Promise((resolve) => {
    req.on('data', (chunk: Buffer) => {
      seen += chunk.length;
      if (seen > cap) {
        req.destroy();
        resolve();
      }
    });
    req.once('end', resolve);
    req.once('close', resolve);
    req.once('error', () => resolve());
    req.resume();
  });
}

async function streamFile(res: ServerResponse, file: { storageKey: string; contentType: string; size: number; originalName: string }, download: boolean): Promise<void> {
  const bytes = await openStoredBytes(file.storageKey).catch((error) => {
    throw AppError.from(ErrorCode.FIL_READ_FAILED, 500, error);
  });
  const image = file.contentType.startsWith('image/');
  res.writeHead(200, {
    'Content-Type': file.contentType,
    'Content-Length': file.size,
    'Content-Disposition': contentDisposition(download ? 'attachment' : 'inline', file.originalName),
    'X-Content-Type-Options': 'nosniff',
    // HR documents: never kept by shared caches or the browser cache; a signed link must not leak through Referer.
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
    // Images can't run anything, but nothing on this origin should be scriptable from an upload. (A CSP sandbox
    // would also stop the browser's built-in PDF viewer, so PDFs rely on the viewer's own sandbox.)
    ...(image ? { 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" } : {}),
  });
  await pipeline(bytes, res);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://files.local');
  const found = match(req.method ?? 'GET', url);
  const ctx = contextFor(`files/${found?.route.name ?? 'Unknown'}`, req, found?.input ?? {});
  // A browser that opened a signed link gets readable text, not a JSON envelope.
  const browserLink = !!url.searchParams.get('token');

  try {
    if (!found) throw AppError.from(ErrorCode.FIL_ENDPOINT_NOT_FOUND, 404);
    const { route } = found;
    const result = await trackRequestWrites(() => compose([rateLimitByIp, ...route.chain], route.controller)(ctx));
    if (route.stream) await streamFile(res, result as Parameters<typeof streamFile>[1], (ctx.input as FileIdInput).download === true);
    else sendJson(res, 200, { STATUS: 'SUCCESSFUL', ERROR_CODE: '', ERROR_FILTER: '', ERROR_DESCRIPTION: '', DATA: serialize(result) });
    logRequest(ctx, { status: 'SUCCESSFUL' });
  } catch (error) {
    const appError = toAppError(error, found?.route.op ?? 'read');
    logRequest(ctx, { status: 'ERROR', errorCode: appError.errorCode, statusCode: appError.statusCode, cause: appError.cause ?? error });
    if (res.headersSent) {
      res.destroy(); // failed mid-stream: the client sees a broken download, never a truncated "success"
      return;
    }
    await discardBody(req);
    if (browserLink) {
      res.writeHead(appError.statusCode, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(appError.errorDescription);
    } else {
      sendJson(res, appError.statusCode, appError.toResponse());
    }
  }
}

/** Starts the file endpoint. Returns the server so app.ts can close it on shutdown. */
export function startFilesHttpServer(): http.Server {
  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      logger.error('file request crashed', { error });
      if (!res.headersSent) sendJson(res, 500, AppError.from(ErrorCode.SYS_UNEXPECTED, 500).toResponse());
      else res.destroy();
    });
  });
  // Uploads of up to FILE_UPLOAD_MAX_BYTES over a slow link must not be cut off.
  server.requestTimeout = 5 * 60 * 1000;
  server.listen(config.files.httpPort, '0.0.0.0', () =>
    logger.info(`FleetFlow file endpoint listening on 0.0.0.0:${config.files.httpPort}`, { uploadsDir: config.files.dir, maxBytes: config.files.maxBytes }),
  );
  server.on('error', (error) => {
    logger.error('failed to start the file endpoint', { error });
    process.exit(1);
  });
  return server;
}
