/**
 * Small hand-rolled icon set (no icon-library dependency — keeps the
 * Docker build light). Stroke-based, 20x20, one per nav item / stat tile.
 */
type IconProps = { size?: number };

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function svg(size: number, children: React.ReactNode) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      {children}
    </svg>
  );
}

export const Icon = {
  dashboard: ({ size = 18 }: IconProps) =>
    svg(size, <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>),
  truck: ({ size = 18 }: IconProps) =>
    svg(size, <><rect x="2" y="7" width="12" height="9" rx="1" /><path d="M14 10h4l4 3.5V16h-8z" /><circle cx="7" cy="18.5" r="1.8" /><circle cx="17" cy="18.5" r="1.8" /></>),
  driver: ({ size = 18 }: IconProps) =>
    svg(size, <><circle cx="12" cy="7.5" r="3.5" /><path d="M4.5 20c1-3.8 4-6 7.5-6s6.5 2.2 7.5 6" /></>),
  link: ({ size = 18 }: IconProps) =>
    svg(size, <><path d="M9 15 15 9" /><path d="M8 13 4.6 16.4a3 3 0 0 0 4.2 4.2L12.5 17" /><path d="M16 11l3.4-3.4a3 3 0 0 0-4.2-4.2L11.5 7" /></>),
  mapPin: ({ size = 18 }: IconProps) =>
    svg(size, <><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.3" /></>),
  route: ({ size = 18 }: IconProps) =>
    svg(size, <><circle cx="5.5" cy="18.5" r="2" /><circle cx="18.5" cy="5.5" r="2" /><path d="M7.3 17 15 9.5" /><path d="M17 7l1.5-1.5" /></>),
  clipboard: ({ size = 18 }: IconProps) =>
    svg(size, <><rect x="5" y="4" width="14" height="17" rx="1.5" /><rect x="8.5" y="2.5" width="7" height="3" rx="1" /><path d="M8.5 11h7M8.5 15h7" /></>),
  package: ({ size = 18 }: IconProps) =>
    svg(size, <><path d="M3.5 7.5 12 3l8.5 4.5L12 12 3.5 7.5z" /><path d="M3.5 7.5V16l8.5 4.5V12" /><path d="M20.5 7.5V16L12 20.5" /></>),
  fileText: ({ size = 18 }: IconProps) =>
    svg(size, <><path d="M6 2.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z" /><path d="M14 2.5V7h4" /><path d="M8.5 12.5h7M8.5 16h7" /></>),
  building: ({ size = 18 }: IconProps) =>
    svg(size, <><rect x="4" y="3" width="11" height="18" rx="1" /><path d="M8 7.5h3M8 11h3M8 14.5h3" /><path d="M15 9.5h5v11.5h-5" /></>),
  users: ({ size = 18 }: IconProps) =>
    svg(size, <><circle cx="9" cy="8" r="3" /><path d="M2.8 20c0.8-3.2 3-5 6.2-5s5.4 1.8 6.2 5" /><circle cx="17" cy="8.5" r="2.5" /><path d="M16 15c2.4 0.2 4 1.6 4.6 4.3" /></>),
  creditCard: ({ size = 18 }: IconProps) =>
    svg(size, <><rect x="2.5" y="5.5" width="19" height="13" rx="1.5" /><path d="M2.5 9.5h19" /><path d="M6 14.5h4" /></>),
  wrench: ({ size = 18 }: IconProps) =>
    svg(size, <><path d="M14.5 6.5a4 4 0 0 0-5.3 4.6L4 16.3l2.7 2.7L12 13.8a4 4 0 0 0 4.6-5.3l-2.8 2.8-2.1-2.1 2.8-2.7z" /></>),
  userCog: ({ size = 18 }: IconProps) =>
    svg(size, <><circle cx="9" cy="7.5" r="3.2" /><path d="M2.8 20c0.8-3.3 3-5 6.2-5" /><circle cx="18" cy="16" r="2.4" /><path d="M18 12.3v1M18 18.7v1M21.2 14.4l-.9.5M15.7 17.1l-.9.5M21.2 17.6l-.9-.5M15.7 14.9l-.9-.5" /></>),
  shield: ({ size = 18 }: IconProps) =>
    svg(size, <><path d="M12 2.5 19.5 5.5v6c0 5-3.2 8.3-7.5 10-4.3-1.7-7.5-5-7.5-10v-6L12 2.5z" /><path d="M8.5 12l2.3 2.3L16 9.2" /></>),
  settings: ({ size = 18 }: IconProps) =>
    svg(size, <><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.8 1.8 0 0 0 .4 2l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.6v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.8 1.8 0 0 0-1.1-1.6 1.8 1.8 0 0 0-2 .4l-.1.1A1.9 1.9 0 1 1 4.3 15.8l.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.6-1.1H3a1.9 1.9 0 1 1 0-3.8h.1a1.8 1.8 0 0 0 1.6-1.1 1.8 1.8 0 0 0-.4-2l-.1-.1A1.9 1.9 0 1 1 7 3 .9l.1.1a1.8 1.8 0 0 0 2 .4h.1a1.8 1.8 0 0 0 1.1-1.6V2a1.9 1.9 0 1 1 3.8 0v.1a1.8 1.8 0 0 0 1.1 1.6 1.8 1.8 0 0 0 2-.4l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.8 1.8 0 0 0-.4 2v.1a1.8 1.8 0 0 0 1.6 1.1h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.8 1.8 0 0 0-1.6 1.1z" /></>),
  fileCheck: ({ size = 18 }: IconProps) =>
    svg(size, <><path d="M6 2.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z" /><path d="M14 2.5V7h4" /><path d="M8.5 14.5l2 2 4.5-4.5" /></>),
  gauge: ({ size = 18 }: IconProps) =>
    svg(size, <><path d="M4 16a8 8 0 1 1 16 0" /><path d="M12 16l4-5" /><path d="M12 16a1.6 1.6 0 1 1 0 .01" /></>),
  box: ({ size = 18 }: IconProps) =>
    svg(size, <><path d="M12 2.5l8 4.5v10L12 21.5l-8-4.5v-10z" /><path d="M4 7l8 4.5 8-4.5M12 11.5V21.5" /></>),
  invoice: ({ size = 18 }: IconProps) =>
    svg(size, <><path d="M5 2.5h11l3 3V21a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z" /><path d="M8 8.5h8M8 12h8M8 15.5h5" /></>),
  alert: ({ size = 18 }: IconProps) =>
    svg(size, <><path d="M12 3 2.5 20h19L12 3z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.3" r="0.2" fill="currentColor" /></>),
  calendar: ({ size = 18 }: IconProps) =>
    svg(size, <><rect x="3" y="4.5" width="18" height="16" rx="1.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></>),
  menu: ({ size = 18 }: IconProps) =>
    svg(size, <><path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" /></>),
  chevronDown: ({ size = 18 }: IconProps) =>
    svg(size, <path d="M5.5 8.5 12 15l6.5-6.5" />),
  gridLayers: ({ size = 18 }: IconProps) =>
    svg(size, <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></>),
};

export type IconName = keyof typeof Icon;
