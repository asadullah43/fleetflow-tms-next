import { rpc } from '../../lib/grpc-handler.js';
import { dashboardService } from './dashboard.service.js';

export const dashboardGrpcImpl = {
  getSummary: rpc({ module: 'dashboard', action: 'view' }, () => dashboardService.getSummary(), 'read'),
};
