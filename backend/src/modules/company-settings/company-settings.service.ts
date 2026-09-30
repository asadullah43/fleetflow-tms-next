import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

/**
 * Direct port of the legacy CompanySettingsService: a singleton row
 * (id = 1), get-or-create on first read, no list/delete. ZATCA onboarding
 * fields live on this same row in the schema but aren't exposed here —
 * see modules/invoices for what's implemented of the ZATCA flow.
 */
export const companySettingsService = {
  async getOrCreate() {
    try {
      const existing = await prisma.companySettings.findFirst({ orderBy: { id: 'asc' } });
      if (existing) return existing;
      return await prisma.companySettings.create({
        data: { companyName: 'My Company', country: 'SA' },
      });
    } catch (error) {
      throw new AppError({
        errorCode: ErrorCode.SET_FETCH_FAILED.code,
        errorFilter: ErrorCode.SET_FETCH_FAILED.filter,
        errorDescription: ErrorCode.SET_FETCH_FAILED.description,
        statusCode: 500,
        cause: error as Error,
      });
    }
  },

  async update(dto: Record<string, unknown>) {
    try {
      const existing = await this.getOrCreate();
      return await prisma.companySettings.update({ where: { id: existing.id }, data: dto });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError({
        errorCode: ErrorCode.SET_UPDATE_FAILED.code,
        errorFilter: ErrorCode.SET_UPDATE_FAILED.filter,
        errorDescription: ErrorCode.SET_UPDATE_FAILED.description,
        statusCode: 500,
        cause: error as Error,
      });
    }
  },
};
