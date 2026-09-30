import { unaryCall } from './client';

interface ProtoType<T> {
  create(props?: Record<string, unknown>): T;
  encode(message: T): { finish(): Uint8Array };
  decode(bytes: Uint8Array): T;
}

export interface CrudMessages {
  ListRequest: ProtoType<any>;
  ItemList: ProtoType<any>;
  Item: ProtoType<any>;
  IdRequest: ProtoType<any>;
  CreateRequest: ProtoType<any>;
  UpdateRequest: ProtoType<any>;
  DeleteResponse: ProtoType<any>;
}

/**
 * Builds the standard list/get/create/update/remove client calls for a
 * module whose proto follows the shared CRUD convention (List/Get/Create/
 * Update/Delete RPCs — see backend/src/lib/crud-grpc.ts and any *.proto
 * file using it). Every simple lookup module's frontend client is one of
 * these instead of hand-written boilerplate per module.
 */
export function createCrudClient<T>(serviceName: string, m: CrudMessages, listKey = 'items') {
  return {
    list(token: string): Promise<T[]> {
      return unaryCall({
        serviceName,
        methodName: 'List',
        request: m.ListRequest.create({}),
        RequestType: m.ListRequest,
        ResponseType: m.ItemList,
        token,
      }).then((res: any) => (res[listKey] ?? []) as T[]);
    },

    get(id: number, token: string): Promise<T> {
      return unaryCall({
        serviceName,
        methodName: 'Get',
        request: m.IdRequest.create({ id }),
        RequestType: m.IdRequest,
        ResponseType: m.Item,
        token,
      }) as Promise<T>;
    },

    create(values: Record<string, unknown>, token: string): Promise<T> {
      return unaryCall({
        serviceName,
        methodName: 'Create',
        request: m.CreateRequest.create(values),
        RequestType: m.CreateRequest,
        ResponseType: m.Item,
        token,
      }) as Promise<T>;
    },

    update(id: number, values: Record<string, unknown>, token: string): Promise<T> {
      return unaryCall({
        serviceName,
        methodName: 'Update',
        request: m.UpdateRequest.create({ id, ...values }),
        RequestType: m.UpdateRequest,
        ResponseType: m.Item,
        token,
      }) as Promise<T>;
    },

    remove(id: number, token: string): Promise<void> {
      return unaryCall({
        serviceName,
        methodName: 'Delete',
        request: m.IdRequest.create({ id }),
        RequestType: m.IdRequest,
        ResponseType: m.DeleteResponse,
        token,
      }).then(() => undefined);
    },
  };
}
