// Small inline icon set (stroke icons inherit currentColor).
type P = { size?: number; className?: string };

const Svg = ({ size = 24, className, children, fill }: P & { children: React.ReactNode; fill?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    fill={fill ? "currentColor" : "none"}
    stroke={fill ? "none" : "currentColor"}
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
);

export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Svg>
);
export const IconChart = (p: P) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);
export const IconLibrary = (p: P) => (
  <Svg {...p}>
    <path d="M4 4v16M9 4v16M14 5l5 14.5" />
  </Svg>
);
export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);
export const IconPlay = (p: P) => (
  <Svg {...p} fill>
    <path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8z" />
  </Svg>
);
export const IconPause = (p: P) => (
  <Svg {...p} fill>
    <rect x="6" y="4" width="4.2" height="16" rx="1.2" />
    <rect x="13.8" y="4" width="4.2" height="16" rx="1.2" />
  </Svg>
);
export const IconNext = (p: P) => (
  <Svg {...p} fill>
    <path d="M3 5.6v12.8a.9.9 0 0 0 1.4.75L13 13.1V18.4a.9.9 0 0 0 1.4.75l9-6.4a.9.9 0 0 0 0-1.5l-9-6.4A.9.9 0 0 0 13 5.6v5.3L4.4 4.85A.9.9 0 0 0 3 5.6z" />
  </Svg>
);
export const IconPrev = (p: P) => (
  <Svg {...p} fill>
    <path d="M21 5.6v12.8a.9.9 0 0 1-1.4.75L11 13.1V18.4a.9.9 0 0 1-1.4.75l-9-6.4a.9.9 0 0 1 0-1.5l9-6.4A.9.9 0 0 1 11 5.6v5.3l8.6-6.05A.9.9 0 0 1 21 5.6z" />
  </Svg>
);
export const IconShuffle = (p: P) => (
  <Svg {...p}>
    <path d="M16 4h4v4M20 4l-6.5 6.5M4 20l5.5-5.5M16 20h4v-4M20 20 4 4" />
  </Svg>
);
export const IconRepeat = (p: P) => (
  <Svg {...p}>
    <path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4" />
  </Svg>
);
export const IconDown = (p: P) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const IconBack = (p: P) => (
  <Svg {...p}>
    <path d="m15 18-6-6 6-6" />
  </Svg>
);
export const IconChevron = (p: P) => (
  <Svg {...p}>
    <path d="m9 18 6-6-6-6" />
  </Svg>
);
export const IconDownload = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 7.5v8M8.5 12.5 12 16l3.5-3.5" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const IconList = (p: P) => (
  <Svg {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </Svg>
);
export const IconMore = (p: P) => (
  <Svg {...p} fill>
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </Svg>
);
export const IconMusic = (p: P) => (
  <Svg {...p}>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </Svg>
);
export const IconLyrics = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" />
    <path d="M9 8.5h.01M9 11.5h0M9.5 8c-.8 0-1.2.6-1.2 1.3s.5 1.2 1.1 1.2c-.1.9-.6 1.4-1.2 1.6M14 8c-.8 0-1.2.6-1.2 1.3s.5 1.2 1.1 1.2c-.1.9-.6 1.4-1.2 1.6" />
  </Svg>
);
export const IconSort = (p: P) => (
  <Svg {...p}>
    <path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconLogout = (p: P) => (
  <Svg {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
  </Svg>
);
/** Saved on this device: a filled circle with an arrow pointing down (Apple Music style). */
export const IconSaved = (p: P) => (
  <svg width={p.size ?? 24} height={p.size ?? 24} viewBox="0 0 24 24" className={p.className} aria-hidden>
    <circle cx="12" cy="12" r="11" fill="currentColor" />
    <path d="M12 6.5v9M8 11.8l4 4 4-4" fill="none" stroke="#0c0809" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
/** Add to the server: a plus in a circle (same outline as the download arrow). */
export const IconAddCircle = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 7.5v9M7.5 12h9" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);