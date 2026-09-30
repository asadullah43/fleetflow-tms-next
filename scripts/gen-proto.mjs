#!/usr/bin/env node
// Cross-platform (Windows/Mac/Linux) generator for JS + TypeScript message
// code from proto/*.proto, using protobufjs-cli's programmatic API directly
// (pbjs.main / pbts.main) rather than spawning the pbjs/pbts CLI binaries.
//
// Spawning .cmd binaries via child_process on Windows is unreliable when
// the path contains spaces (a long-standing Node issue) — calling the
// library functions in-process sidesteps that entirely, and works
// identically on Windows, macOS, and Linux.
//
// Run from repo root: npm run proto:gen
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pbjs = require('protobufjs-cli/pbjs.js');
const pbts = require('protobufjs-cli/pbts.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PROTO_DIR = path.join(ROOT_DIR, 'proto');

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

function run(fn, args, label) {
  return new Promise((resolve, reject) => {
    fn(args, (err, output) => {
      if (err) {
        reject(err);
        return;
      }
      console.log(`${label} done.`);
      resolve(output);
    });
  });
}

async function main() {
  for (const outDir of OUT_DIRS) {
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    const messagesJs = path.join(outDir, 'messages.js');
    const messagesDts = path.join(outDir, 'messages.d.ts');

    console.log(`Generating ${messagesJs} ...`);
    await run(pbjs.main, ['-t', 'static-module', '-w', 'commonjs', '-o', messagesJs, ...protoFiles], 'pbjs');

    console.log(`Generating ${messagesDts} ...`);
    await run(pbts.main, ['-o', messagesDts, messagesJs], 'pbts');
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
