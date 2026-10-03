import type { Controller } from '../middlewares/request-context.js';
import type { UploadInput } from '../middlewares/upload.js';
import { filesService, FilePurpose } from '../services/files.service.js';

export interface FileIdInput {
  id: number;
  /** A signed link's token (GET only): when present it is the permission, and no credentials are needed. */
  token?: string;
  download?: boolean;
}

export const filesController = {
  upload: ((ctx) => filesService.upload(ctx.principal!, ctx.input.purpose as FilePurpose, ctx.input.file!.name, ctx.input.file!.bytes)) as Controller<UploadInput>,
  link: ((ctx) => filesService.link(ctx.principal!, ctx.input.id)) as Controller<FileIdInput>,
  /** The stored file to stream back (the route writes it out). */
  serve: ((ctx) => (ctx.principal ? filesService.forCaller(ctx.principal, ctx.input.id) : filesService.forLink(ctx.input.id, ctx.input.token ?? ''))) as Controller<FileIdInput>,
};
