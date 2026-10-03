/**
 * PROTECTED CORE CONNECTIVITY — the one place uploaded file bytes are
 * written, read and deleted. Files sit under config.files.dir (a Docker
 * volume in production) at a key the server chose: <companyId>/<random>,
 * with no extension and nothing from the uploader's file name, so a
 * stored file can never be reached by guessing or by a crafted name.
 * Which file belongs to whom is recorded in the StoredFile table.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../global_config/index.js';

/** Absolute path of a storage key — refusing anything that would land outside the uploads directory. */
function locate(key: string): string {
  const root = path.resolve(config.files.dir);
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error(`Storage key escapes the uploads directory: ${key}`);
  return full;
}

/** A fresh key for a new file of this company. */
export function newStorageKey(companyId: number): string {
  return `${companyId}/${crypto.randomUUID()}`;
}

/** Writes the bytes under `key`: to a temporary name first, then renamed, so a half-written file is never visible. */
export async function writeStoredBytes(key: string, bytes: Uint8Array): Promise<void> {
  const target = locate(key);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.part`;
  try {
    await fsp.writeFile(temporary, bytes, { flag: 'wx' });
    await fsp.rename(temporary, target);
  } catch (error) {
    await fsp.rm(temporary, { force: true });
    throw error;
  }
}

/** Opens the stored bytes for streaming; rejects (ENOENT) when they are missing. */
export async function openStoredBytes(key: string): Promise<fs.ReadStream> {
  const full = locate(key);
  await fsp.access(full, fs.constants.R_OK);
  return fs.createReadStream(full);
}

/** Deletes the stored bytes; already gone is fine. */
export async function deleteStoredBytes(key: string): Promise<void> {
  await fsp.rm(locate(key), { force: true });
}
