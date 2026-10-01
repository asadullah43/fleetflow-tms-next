import type { AssignmentDto } from './grpc/assignments';

export type AssignmentState = 'active' | 'upcoming' | 'completed';

export function assignmentState(a: AssignmentDto): AssignmentState {
  const today = new Date().toISOString().slice(0, 10);
  const start = a.startDate.slice(0, 10);
  const end = a.endDate?.slice(0, 10);
  if (start > today) return 'upcoming';
  if (end && end < today) return 'completed';
  return 'active';
}

export const STATE_LABEL: Record<AssignmentState, string> = { active: 'Active', upcoming: 'Upcoming', completed: 'Completed' };
export const STATE_TONE: Record<AssignmentState, string> = { active: 'green', upcoming: 'orange', completed: 'blue' };
export const STATE_BADGE: Record<AssignmentState, string> = { active: 'success', upcoming: 'warning', completed: 'neutral' };
