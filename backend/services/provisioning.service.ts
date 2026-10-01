/**
 * Setting up companies (tenants). Not reachable through the API: used by
 * the operator CLI (admin_app.ts) and the database seed. Runs outside any
 * request, so it uses the unscoped client deliberately.
 */
import crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { prisma } from '../_core_app_connectivities/prisma.js';
import { runUnscoped } from '../_core_app_connectivities/tenant-context.js';
import { config } from '../global_config/index.js';
import { generateApiKey } from '../utils/api-key.js';
import { ADMIN_ROLE_NAME, isPermissionModule } from '../utils/permissions.js';

export interface NewCompany {
  companyName: string;
  adminName?: string;
  adminEmail: string;
  adminUsername: string;
  /** Omit to have a random one generated and returned once. */
  adminPassword?: string;
}

export const provisioningService = {
  /** Creates a company with its settings row, its ADMIN role and a first admin user — all or nothing. */
  async createCompany(input: NewCompany) {
    const generated = !input.adminPassword;
    const password = input.adminPassword ?? crypto.randomBytes(12).toString('base64url');
    if (password.length < config.auth.minPasswordLength) throw new Error(`Password must be at least ${config.auth.minPasswordLength} characters`);
    const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);

    return runUnscoped(() =>
      prisma.$transaction(async (tx) => {
        const company = await tx.company.create({ data: { name: input.companyName } });
        await tx.companySettings.create({ data: { companyId: company.id, companyName: input.companyName, country: 'SA' } });
        const role = await tx.role.create({ data: { companyId: company.id, name: ADMIN_ROLE_NAME, description: 'Full system access' } });
        const user = await tx.user.create({
          data: {
            companyId: company.id,
            name: input.adminName ?? 'Admin',
            email: input.adminEmail,
            username: input.adminUsername,
            passwordHash,
            role: ADMIN_ROLE_NAME,
            roleId: role.id,
          },
        });
        return { companyId: company.id, userId: user.id, username: input.adminUsername, generatedPassword: generated ? password : undefined };
      }),
    );
  },

  /**
   * First-run setup: if the database has no users at all, make sure
   * company #1 exists and give it an admin. Does nothing otherwise, so it
   * is safe to run on every start.
   */
  async ensureInitialAdmin(): Promise<{ created: boolean; username?: string; generatedPassword?: string }> {
    return runUnscoped(async () => {
      if ((await prisma.user.count()) > 0) return { created: false };
      const password = config.seed.adminPassword ?? crypto.randomBytes(12).toString('base64url');
      const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);
      await prisma.$transaction(async (tx) => {
        const company = (await tx.company.findFirst({ orderBy: { id: 'asc' } })) ?? (await tx.company.create({ data: { name: 'FleetFlow' } }));
        const role =
          (await tx.role.findFirst({ where: { companyId: company.id, name: ADMIN_ROLE_NAME } })) ??
          (await tx.role.create({ data: { companyId: company.id, name: ADMIN_ROLE_NAME, description: 'Full system access' } }));
        await tx.user.create({
          data: { companyId: company.id, name: 'Admin', email: 'admin@fleetflow.local', username: 'admin', passwordHash, role: ADMIN_ROLE_NAME, roleId: role.id },
        });
      });
      return { created: true, username: 'admin', generatedPassword: config.seed.adminPassword ? undefined : password };
    });
  },

  /** `grants`: e.g. { trips: ['view', 'add'], trucks: ['view'] }. Returns the key once. */
  async createApiKey(companyId: number, name: string, grants: Record<string, string[]>) {
    const scopes = Object.entries(grants).map(([module, actions]) => {
      if (!isPermissionModule(module) || ['users', 'roles', 'apiKeys'].includes(module)) throw new Error(`Module "${module}" cannot be granted to an API key`);
      return { module, canView: actions.includes('view'), canAdd: actions.includes('add'), canEdit: actions.includes('edit'), canDelete: actions.includes('delete') };
    });
    if (scopes.length === 0) throw new Error('Grant at least one permission');
    const { plaintext, keyPrefix, keyHash } = generateApiKey();
    return runUnscoped(async () => {
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) throw new Error(`Company ${companyId} does not exist`);
      const row = await prisma.apiKey.create({ data: { companyId, name, keyPrefix, keyHash, scopes } });
      return { id: row.id, keyPrefix, plaintextKey: plaintext };
    });
  },

  async listCompanies() {
    return runUnscoped(() => prisma.company.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, status: true, _count: { select: { users: true } } } }));
  },

  /** SUSPENDED blocks every sign-in and API key of the company at the next request. */
  async setCompanyStatus(companyId: number, status: 'ACTIVE' | 'SUSPENDED') {
    return runUnscoped(() => prisma.company.update({ where: { id: companyId }, data: { status }, select: { id: true, name: true, status: true } }));
  },
};
