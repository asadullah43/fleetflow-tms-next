import { prisma } from '../../lib/prisma.js';
import { AppError } from '../errors/app-error.js';
import { ErrorFilter } from '../errors/error-response.interface.js';
import { buildLocalizedWriteData } from '../localization/language.util.js';

export interface CrudErrorCode {
  code: string;
  filter: ErrorFilter;
  description: string;
}

export interface CrudErrorSet {
  notFound: CrudErrorCode;
  inUse: CrudErrorCode;
  createFailed: CrudErrorCode;
  fetchFailed: CrudErrorCode;
  updateFailed: CrudErrorCode;
  deleteFailed: CrudErrorCode;
}

interface CrudDelegate {
  create(args: { data: any }): Promise<any>;
  findMany(args: { orderBy: { id: 'desc' } }): Promise<any[]>;
  findUnique(args: { where: { id: number } }): Promise<any>;
  update(args: { where: { id: number }; data: any }): Promise<any>;
  delete(args: { where: { id: number } }): Promise<any>;
}

function fail(error: unknown, code: CrudErrorCode, statusCode: number): never {
  if (error instanceof AppError) throw error;
  throw new AppError({
    errorCode: code.code,
    errorFilter: code.filter,
    errorDescription: code.description,
    statusCode,
    cause: error as Error,
  });
}

/**
 * Shared CRUD implementation for bilingual master-data entities (Locations,
 * Cargo Types, Customers, Suppliers, ...) — functional port of the legacy
 * backend's abstract CrudService, adapted from NestJS DI to a plain
 * factory function. Each entity supplies its Prisma model name and error
 * codes and gets create/findAll/findOne/update/remove for free, with the
 * same "record in use, can't delete" (Prisma P2003/P2039) handling.
 */
export function createCrudService(modelName: string, errors: CrudErrorSet) {
  const delegate = (prisma as unknown as Record<string, CrudDelegate>)[modelName];

  return {
    async create(dto: Record<string, unknown>) {
      try {
        return await delegate.create({ data: buildLocalizedWriteData(dto, true) });
      } catch (error) {
        fail(error, errors.createFailed, 500);
      }
    },

    async findAll() {
      try {
        return await delegate.findMany({ orderBy: { id: 'desc' } });
      } catch (error) {
        fail(error, errors.fetchFailed, 500);
      }
    },

    async findOne(id: number) {
      const record = await delegate.findUnique({ where: { id } });
      if (!record) {
        throw new AppError({
          errorCode: errors.notFound.code,
          errorFilter: errors.notFound.filter,
          errorDescription: errors.notFound.description,
          statusCode: 404,
        });
      }
      return record;
    },

    async update(id: number, dto: Record<string, unknown>) {
      try {
        await this.findOne(id);
        return await delegate.update({ where: { id }, data: buildLocalizedWriteData(dto, false) });
      } catch (error) {
        fail(error, errors.updateFailed, 500);
      }
    },

    async remove(id: number) {
      try {
        await this.findOne(id);
        return await delegate.delete({ where: { id } });
      } catch (error) {
        if (error instanceof AppError) throw error;
        const code = (error as { code?: string })?.code;
        if (code === 'P2003' || code === 'P2039') {
          throw new AppError({
            errorCode: errors.inUse.code,
            errorFilter: errors.inUse.filter,
            errorDescription: errors.inUse.description,
            statusCode: 400,
          });
        }
        fail(error, errors.deleteFailed, 500);
      }
    },
  };
}
