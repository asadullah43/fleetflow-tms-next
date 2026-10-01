import { prisma } from '../_core_app_connectivities/prisma.js';
import { currentCompanyId, runUnscoped } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { ErrorCode } from '../global_config/error-codes.js';

/**
 * One settings row per company, created on first read. Holds the
 * company's identity for documents (name, logo, VAT/CR numbers, address,
 * bank details). The ZATCA onboarding columns on the same table are
 * never returned by this service — the proto message has no fields for
 * them, so secrets cannot reach the frontend.
 */
export const companySettingsService = {
  async getOrCreate() {
    try {
      const existing = await prisma.companySettings.findFirst();
      if (existing) return existing;
      const companyId = currentCompanyId();
      const company = await runUnscoped(() => prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }));
      return await prisma.companySettings.create({ data: { companyId, companyName: company?.name ?? 'FleetFlow', country: 'SA' } });
    } catch (error) {
      throw AppError.from(ErrorCode.SET_FETCH_FAILED, 500, error);
    }
  },

  /** What the sidebar, login screen, browser tab icon and printed documents show. */
  async getBranding() {
    const settings = await this.getOrCreate();
    return { companyName: settings.companyName, logoUrl: settings.logoUrl ?? undefined };
  },

  /** `input` has already been reduced by validation to the editable fields. */
  async update(input: Record<string, unknown>) {
    const existing = await this.getOrCreate();
    // Every other field may be cleared with ''; the company must keep a name.
    if (typeof input.companyName === 'string' && !input.companyName.trim()) input = { ...input, companyName: undefined };
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.companySettings.update({ where: { id: existing.id }, data: input });
        // The company's display name (login response, admin tools) follows the settings.
        if (typeof input.companyName === 'string' && input.companyName.trim()) {
          await tx.company.update({ where: { id: existing.companyId }, data: { name: input.companyName.trim() } });
        }
        return row;
      });
      return updated;
    } catch (error) {
      throw AppError.from(ErrorCode.SET_UPDATE_FAILED, 500, error);
    }
  },
};
