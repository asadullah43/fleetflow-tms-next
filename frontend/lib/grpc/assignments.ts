import { fleetflow } from '../generated/proto/messages.js';
import { createCrudClient } from './crud-client';

const { Assignment, AssignmentList, ListRequest, IdRequest, CreateAssignmentRequest, UpdateAssignmentRequest, DeleteResponse } = fleetflow.assignments;

export interface AssignmentDto {
  id: number;
  truckId: number;
  driverId: number;
  startDate: string;
  endDate?: string;
  truckNumber?: string;
  driverName?: string;
}

export const assignmentsClient = createCrudClient<AssignmentDto>('fleetflow.assignments.AssignmentsService', {
  ListRequest,
  ItemList: AssignmentList,
  Item: Assignment,
  IdRequest,
  CreateRequest: CreateAssignmentRequest,
  UpdateRequest: UpdateAssignmentRequest,
  DeleteResponse,
});
