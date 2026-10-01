'use client';

import type { AssignmentDto } from '../lib/grpc/assignments';
import { assignmentState, STATE_BADGE, STATE_LABEL } from '../lib/assignment-state';
import { useT, useLanguage } from '../lib/language-context';
import { localizedJoinedName } from '../lib/localized-name';

/**
 * Read-only dot-and-line timeline of assignment history — the same visual
 * pattern as the "Assignment history" panel on a truck's detail page, but
 * without the edit/remove actions, for places (Truck-Driver Assignments'
 * "view" action) that just need to show the history, not manage it.
 */
export function AssignmentHistoryTimeline({ history, subjectLabel = 'driver' }: { history: AssignmentDto[]; subjectLabel?: 'driver' | 'truck' }) {
  const t = useT();
  const { language } = useLanguage();
  if (history.length === 0) {
    return <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>{t('No assignment history yet.')}</div>;
  }

  return (
    <div>
      {history.map((a, i) => {
        const state = assignmentState(a);
        const subject =
          subjectLabel === 'truck' ? (a.truckNumber ?? `Truck #${a.truckId}`) : (localizedJoinedName(a.driverName, a.driverNameAr, language) ?? `Driver #${a.driverId}`);
        return (
          <div key={a.id} style={{ display: 'flex', gap: 14 }}>
            <div style={{ width: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  marginTop: 6,
                  background: `var(--tile-${state === 'active' ? 'green' : state === 'upcoming' ? 'orange' : 'blue'}-fg)`,
                  boxShadow: `0 0 0 3px var(--tile-${state === 'active' ? 'green' : state === 'upcoming' ? 'orange' : 'blue'}-bg)`,
                  flexShrink: 0,
                }}
              />
              {i < history.length - 1 && <span style={{ flex: 1, width: 2, background: 'var(--border-subtle)', marginTop: 2 }} />}
            </div>
            <div style={{ paddingBottom: 20, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{subject}</div>
                <span className={`badge badge-${STATE_BADGE[state]}`}>{t(STATE_LABEL[state])}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {a.startDate.slice(0, 10)} &rarr; {a.endDate ? a.endDate.slice(0, 10) : t('Ongoing')}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
