import type { AssignmentDto } from '../../lib/api/assignments.api';
import { AssignmentPeriodState, periodState } from '../../lib/date';

export type AssignmentState = AssignmentPeriodState;

export function assignmentState(assignment: AssignmentDto): AssignmentState {
  return periodState(assignment.startDate, assignment.endDate);
}

/** Status code per state, rendered through StatusBadge (label + colour). */
export const STATE_STATUS: Record<AssignmentState, string> = { active: 'ACTIVE', upcoming: 'UPCOMING', completed: 'COMPLETED' };
export const STATE_COLOR: Record<AssignmentState, string> = { active: 'teal', upcoming: 'orange', completed: 'blue' };
