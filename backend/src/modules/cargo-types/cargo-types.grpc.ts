import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { cargoTypesService } from './cargo-types.service.js';

export const cargoTypesGrpcImpl = createCrudGrpcHandlers(cargoTypesService, { module: 'cargoTypes', readAccess: 'authenticated' });
