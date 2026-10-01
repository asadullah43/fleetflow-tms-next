import { z } from 'zod';
import { dateString, id, optionalDateString, optionalId } from './common.validation.js';

export const createAssignmentRequest = z.object({
  truckId: id,
  driverId: id,
  startDate: dateString,
  endDate: optionalDateString,
});

export const updateAssignmentRequest = z.object({
  id: id,
  truckId: optionalId,
  driverId: optionalId,
  startDate: optionalDateString,
  endDate: optionalDateString,
});
