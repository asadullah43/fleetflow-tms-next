import { fleetflow } from '../generated/proto/messages.js';
import { createCrudApi } from './crud-api';

export interface AssignmentDto {
  id: number;
  truckId: number;
  driverId: number;
  startDate: string;
  endDate?: string;
  truckNumber?: string;
  driverName?: string;
  driverNameAr?: string;
}

export const assignmentsApi = createCrudApi<AssignmentDto>('assignments', 'fleetflow.assignments.AssignmentsService', fleetflow.assignments, 'Assignment');
