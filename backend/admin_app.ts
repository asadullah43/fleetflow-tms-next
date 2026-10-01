/**
 * FleetFlow operator CLI — the things that must not be reachable through
 * the public API: preparing the database, creating companies (tenants)
 * and issuing integration keys from the server itself.
 *
 *   node dist/admin_app.js <command> [--option value ...]
 *   npm run admin -- <command> [--option value ...]        (development)
 *
 * Commands
 *   db:prepare                      apply pending migrations, then create the first admin if the database has no users
 *   company:list
 *   company:create  --name "Acme Transport" --admin-username acme --admin-email admin@acme.sa [--admin-name "Acme Admin"]
 *                   (password: env ADMIN_PASSWORD, or one is generated and printed once)
 *   company:suspend --id 2          /  company:activate --id 2
 *   apikey:create   --company 1 --name "ERP sync" --grant trips:view,add --grant trucks:view
 *   idempotency:cleanup
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { disconnectDatabase, prisma } from './_core_app_connectivities/prisma.js';
import { purgeExpiredIdempotencyRecords } from './_bg_services/idempotency-cleanup.js';
import { provisioningService } from './services/provisioning.service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = '0_init';

function parseOptions(args: string[]): Record<string, string[]> {
  const options: Record<string, string[]> = {};
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) throw new Error(`Unexpected argument "${args[i]}"`);
    const name = args[i].slice(2);
    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Option --${name} needs a value`);
    (options[name] ??= []).push(value);
    i++;
  }
  return options;
}

function one(options: Record<string, string[]>, name: string): string {
  const value = options[name]?.[0];
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function positiveInt(text: string, name: string): number {
  const value = Number(text);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`--${name} must be a positive whole number`);
  return value;
}

/** The backend root (where prisma/ and node_modules/ live), whether running from source or from dist/. */
function backendRoot(): string {
  return [here, path.resolve(here, '..')].find((dir) => fs.existsSync(path.join(dir, 'prisma', 'schema.prisma'))) ?? here;
}

function prismaCli(...args: string[]): void {
  const root = backendRoot();
  execFileSync(process.execPath, [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), ...args], { cwd: root, stdio: 'inherit' });
}

/**
 * Databases that already contain the tables of the first migration —
 * created with `prisma db push`, or with a locally generated migration
 * under another name — must not run it again. It is recorded as applied
 * instead. Nothing is dropped or reset.
 */
async function markBaselineIfNeeded(): Promise<void> {
  const [{ has_history, has_tables }] = await prisma.$queryRaw<{ has_history: boolean; has_tables: boolean }[]>`
    SELECT to_regclass('"_prisma_migrations"') IS NOT NULL AS has_history,
           to_regclass('"Truck"') IS NOT NULL AS has_tables`;
  if (!has_tables) return; // empty database: every migration runs normally
  if (has_history) {
    const recorded = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name = ${BASELINE}`;
    if (recorded[0].n > 0) return;
  }
  console.log(`Existing tables without the ${BASELINE} baseline in the migration history: recording it as already applied.`);
  prismaCli('migrate', 'resolve', '--applied', BASELINE);
}

const commands: Record<string, (options: Record<string, string[]>) => Promise<void>> = {
  'db:prepare': async () => {
    await markBaselineIfNeeded();
    prismaCli('migrate', 'deploy');
    const admin = await provisioningService.ensureInitialAdmin();
    if (admin.created) {
      console.log(`Created the first admin user -> username: ${admin.username}`);
      if (admin.generatedPassword) console.log(`  one-time password (change it after signing in): ${admin.generatedPassword}`);
    }
  },

  'company:list': async () => {
    for (const company of await provisioningService.listCompanies()) {
      console.log(`${company.id}\t${company.status}\t${company._count.users} users\t${company.name}`);
    }
  },

  'company:create': async (options) => {
    const result = await provisioningService.createCompany({
      companyName: one(options, 'name'),
      adminName: options['admin-name']?.[0],
      adminEmail: one(options, 'admin-email'),
      adminUsername: one(options, 'admin-username'),
      adminPassword: process.env.ADMIN_PASSWORD || undefined,
    });
    console.log(`Created company ${result.companyId} with admin "${result.username}".`);
    if (result.generatedPassword) console.log(`  one-time password (change it after signing in): ${result.generatedPassword}`);
  },

  'company:suspend': async (options) => {
    console.log(await provisioningService.setCompanyStatus(positiveInt(one(options, 'id'), 'id'), 'SUSPENDED'));
  },

  'company:activate': async (options) => {
    console.log(await provisioningService.setCompanyStatus(positiveInt(one(options, 'id'), 'id'), 'ACTIVE'));
  },

  'apikey:create': async (options) => {
    const grants: Record<string, string[]> = {};
    for (const grant of options.grant ?? []) {
      const [module, actions = 'view'] = grant.split(':');
      grants[module] = actions.split(',');
    }
    const key = await provisioningService.createApiKey(positiveInt(one(options, 'company'), 'company'), one(options, 'name'), grants);
    console.log(`Created API key ${key.id} (${key.keyPrefix}…). Store it now — it is not shown again:`);
    console.log(key.plaintextKey);
  },

  'idempotency:cleanup': async () => {
    console.log(`Deleted ${await purgeExpiredIdempotencyRecords()} expired idempotency records.`);
  },
};

async function main(): Promise<void> {
  const [name, ...rest] = process.argv.slice(2);
  const command = commands[name ?? ''];
  if (!command) {
    console.error(`Usage: admin_app <command> [options]\nCommands: ${Object.keys(commands).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  await command(parseOptions(rest));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
