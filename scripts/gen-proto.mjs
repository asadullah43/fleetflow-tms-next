#!/usr/bin/env node
// Cross-platform (Windows/Mac/Linux) replacement for the old bash script:
// generates JS + TypeScript message code from proto/*.proto using
// protobufjs (pure-JS, no protoc/native binary, no shell dependency).
//
// Run from repo root: npm run proto:gen
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PROTO_DIR = path.join(ROOT_DIR, 'proto');

const binExt = process.platform === 'win32' ? '.cmd' : '';
const PBJS = path.join(ROOT_DIR, 'node_modules', '.bin', `pbjs${binExt}`);
const PBTS = path.join(ROOT_DIR, 'node_modules', '.bin', `pbts${binExt}`);

const OUT_DIRS = [
  path.join(ROOT_DIR, 'backend', 'src', 'generated', 'proto'),
  path.join(ROOT_DIR, 'frontend', 'lib', 'generated', 'proto'),
];

const protoFiles = readdirSync(PROTO_DIR)
  .filter((f) => f.endsWith('.proto'))
  .map((f) => path.join(PROTO_DIR, f));

if (protoFiles.length === 0) {
  console.error(`No .proto files found in ${PROTO_DIR}`);
  process.exit(1);
}

for (const outDir of OUT_DIRS) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const messagesJs = path.join(outDir, 'messages.js');
  const messagesDts = path.join(outDir, 'messages.d.ts');

  console.log(`Generating ${messagesJs} ...`);
  execFileSync(PBJS, ['-t', 'static-module', '-w', 'commonjs', '-o', messagesJs, ...protoFiles], {
    stdio: 'inherit',
  });

  console.log(`Generating ${messagesDts} ...`);
  execFileSync(PBTS, ['-o', messagesDts, messagesJs], { stdio: 'inherit' });
}

console.log('Done.');
