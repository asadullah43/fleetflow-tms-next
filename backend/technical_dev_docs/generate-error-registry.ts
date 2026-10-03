/**
 * Builds the error-code registry documents from the code itself:
 *
 *   npm run docs:errors
 *
 * writes error_codes_data.json and error_codes_data.md next to this
 * file. Source of truth: global_config/error-codes.ts (code, filter,
 * description) plus a scan of the backend for where each code is raised
 * (file, function). test/error-registry.test.ts fails when the committed
 * documents no longer match, so they cannot drift from the code.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { ErrorCode } from '../global_config/error-codes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');

export interface RegistryEntry {
  error_code: string;
  error_filter: string;
  error_description: string;
  module_name: string;
  file: string;
  function: string;
}

const SOURCE_DIRS = ['services', 'middlewares', 'data_repositories', 'utils', '_core_app_connectivities', 'controllers', 'routes', '_bg_services'];

/** Code prefix (FLEET-<PREFIX>nnn) -> module name. */
const MODULES: Record<string, string> = {
  AUTH: 'Authentication',
  USR: 'Users',
  ROL: 'Roles & Permissions',
  APK: 'API Keys',
  TRK: 'Trucks & Assignments',
  DRV: 'Drivers',
  CUS: 'Customers',
  SUP: 'Suppliers',
  SPP: 'Supplier Payments',
  LOC: 'Locations',
  CGO: 'Cargo Types',
  TRP: 'Trips',
  RLC: 'Rate Contracts',
  LDO: 'Loading Orders',
  INV: 'Invoices',
  ZATCA: 'ZATCA E-Invoicing',
  WKS: 'Workshop',
  STK: 'Inventory',
  HR: 'Human Resources',
  DSH: 'Dashboard',
  SET: 'Company Settings',
  SYS: 'System',
  RATE: 'Rate Limiting',
};

/** In a CRUD error set, which repository operation raises each slot. */
const CRUD_SLOT_OPERATION: Record<string, string> = {
  notFound: 'findOne',
  inUse: 'remove',
  createFailed: 'create',
  fetchFailed: 'list',
  updateFailed: 'update',
  deleteFailed: 'remove',
  duplicate: 'create / update',
};

function moduleOf(code: string): string {
  const prefix = code.startsWith('RATE-') ? 'RATE' : (/^FLEET-([A-Z]+)\d+$/.exec(code)?.[1] ?? '');
  const name = MODULES[prefix];
  if (!name) throw new Error(`No module name registered for error code ${code}`);
  return name;
}

function sourceFiles(): string[] {
  return SOURCE_DIRS.flatMap((dir) =>
    fs
      .readdirSync(path.join(backendRoot, dir))
      .filter((file) => file.endsWith('.ts'))
      .sort()
      .map((file) => `${dir}/${file}`),
  );
}

/** The name a function-like node goes by: its own, or the variable / property it is assigned to. */
function nameOf(node: ts.Node): string | undefined {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) return node.name.getText();
  if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && node.parent) {
    let holder: ts.Node = node.parent;
    while (ts.isParenthesizedExpression(holder) || ts.isAsExpression(holder)) holder = holder.parent;
    if ((ts.isVariableDeclaration(holder) || ts.isPropertyAssignment(holder)) && holder.name) return holder.name.getText();
  }
  return undefined;
}

/** Where a reference to an ErrorCode sits: "<top-level name>.<method>", "<function>", or "<service>.<crud operation>". */
function locate(reference: ts.Node): string {
  let fn: string | undefined;
  let owner: string | undefined;
  const crudSlot = ts.isPropertyAssignment(reference.parent) ? CRUD_SLOT_OPERATION[reference.parent.name.getText()] : undefined;

  for (let node: ts.Node | undefined = reference.parent; node; node = node.parent) {
    if (!fn && !crudSlot) fn = nameOf(node);
    if (ts.isSourceFile(node.parent ?? node)) {
      // the top-level statement: a function, or `const x = ...`
      if (ts.isFunctionDeclaration(node)) owner = node.name?.getText();
      else if (ts.isVariableStatement(node)) owner = node.declarationList.declarations[0]?.name.getText();
      break;
    }
  }
  if (crudSlot) return `${owner}.${crudSlot}`;
  if (!fn || fn === owner) return owner ?? '';
  return owner ? `${owner}.${fn}` : fn;
}

export function buildRegistry(): RegistryEntry[] {
  const usage = new Map<string, { file: string; function: string }>();
  for (const file of sourceFiles()) {
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(backendRoot, file), 'utf8'), ts.ScriptTarget.ES2022, true);
    const visit = (node: ts.Node): void => {
      if (ts.isPropertyAccessExpression(node) && node.expression.getText() === 'ErrorCode') {
        const key = node.name.getText();
        if (!usage.has(key)) usage.set(key, { file, function: locate(node) });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return Object.entries(ErrorCode)
    .map(([key, entry]) => {
      const raisedAt = usage.get(key);
      if (!raisedAt) throw new Error(`Error code ${key} (${entry.code}) is registered but never raised — remove it or use it.`);
      return {
        error_code: entry.code,
        error_filter: entry.filter,
        error_description: entry.description,
        module_name: moduleOf(entry.code),
        file: raisedAt.file,
        function: raisedAt.function,
      };
    })
    .sort((a, b) => a.error_code.localeCompare(b.error_code, 'en', { numeric: true }));
}

export function renderJson(entries: RegistryEntry[]): string {
  return `${JSON.stringify(entries, null, 2)}\n`;
}

export function renderMarkdown(entries: RegistryEntry[]): string {
  const cell = (text: string) => text.replace(/\|/g, '\\|');
  const out = [
    '# FleetFlow error code registry',
    '',
    'Generated by `npm run docs:errors` from `global_config/error-codes.ts` — do not edit by hand.',
    'The same data, machine-readable: `error_codes_data.json`.',
    '',
    'Every API response is the standard envelope. On failure `STATUS` is `ERROR`, `ERROR_CODE` is one of the',
    'codes below, `ERROR_FILTER` is its category and `ERROR_DESCRIPTION` is the user-safe message.',
    '',
    '| ERROR_FILTER | Meaning | What a client should do |',
    '| --- | --- | --- |',
    '| `USER_NOT_AUTHENTICATED` | No valid session or API key | Sign in again / check the key |',
    '| `USER_NOT_AUTHORIZED` | Signed in, but not allowed to do this | Do not retry; ask an administrator |',
    '| `INVALID_REQUEST` | The request itself is wrong (validation, duplicate, unknown record) | Fix the input |',
    '| `USER_END_VIOLATION` | A business rule forbids it (record in use, invoice locked, …) | Show the message |',
    '| `RATE_LIMIT_EXCEEDED` | Too many requests; `RATE_LIMIT` says how long to wait | Retry after `retry_after_seconds` |',
    '| `TECHNICAL_ISSUE` | A server-side fault; details are in the server log only | Retry later |',
    '',
    `${entries.length} codes.`,
  ];
  let currentModule = '';
  for (const entry of [...entries].sort((a, b) => a.module_name.localeCompare(b.module_name) || a.error_code.localeCompare(b.error_code, 'en', { numeric: true }))) {
    if (entry.module_name !== currentModule) {
      currentModule = entry.module_name;
      out.push('', `## ${currentModule}`, '', '| error_code | error_filter | error_description | file | function |', '| --- | --- | --- | --- | --- |');
    }
    out.push(`| \`${entry.error_code}\` | \`${entry.error_filter}\` | ${cell(entry.error_description)} | \`${entry.file}\` | \`${entry.function}\` |`);
  }
  return `${out.join('\n')}\n`;
}

export const REGISTRY_JSON = path.join(here, 'error_codes_data.json');
export const REGISTRY_MD = path.join(here, 'error_codes_data.md');

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entries = buildRegistry();
  fs.writeFileSync(REGISTRY_JSON, renderJson(entries));
  fs.writeFileSync(REGISTRY_MD, renderMarkdown(entries));
  console.log(`Wrote ${entries.length} error codes to technical_dev_docs/error_codes_data.{json,md}`);
}
