const Ic = (paths, vb = "0 0 24 24") => ({ size = 18, stroke = 1.4, className = "", ...rest }) => (
  <svg viewBox={vb} width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke}
       strokeLinecap="round" strokeLinejoin="round" className={className} {...rest}>
    {paths}
  </svg>
);

export const IconDashboard = Ic(<>
  <rect x="3" y="3" width="7" height="9" rx="1.5" />
  <rect x="14" y="3" width="7" height="5" rx="1.5" />
  <rect x="14" y="12" width="7" height="9" rx="1.5" />
  <rect x="3" y="16" width="7" height="5" rx="1.5" />
</>);
export const IconTx = Ic(<>
  <path d="M4 7h13l-3-3" />
  <path d="M20 17H7l3 3" />
</>);
export const IconChart = Ic(<>
  <path d="M4 19V5" />
  <path d="M4 19h16" />
  <path d="M8 15V10" />
  <path d="M12 15V7" />
  <path d="M16 15v-5" />
</>);
export const IconBudget = Ic(<>
  <circle cx="12" cy="12" r="9" />
  <path d="M12 3a9 9 0 0 1 9 9h-9z" />
</>);
export const IconSave = Ic(<>
  <path d="M12 3v18" />
  <path d="M5 8c0-2 2-4 4-4s4 1.5 4 4-2 4-4 4-4 1.5-4 4 2 4 4 4 4-2 4-4" />
</>);
export const IconReport = Ic(<>
  <path d="M7 3h8l4 4v14H7z" />
  <path d="M15 3v4h4" />
  <path d="M10 12h6M10 16h4" />
</>);
export const IconSettings = Ic(<>
  <circle cx="12" cy="12" r="3" />
  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
</>);

export const IconSearch = Ic(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const IconBell   = Ic(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></>);
export const IconSun    = Ic(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>);
export const IconMoon   = Ic(<><path d="M21 12.8A8 8 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z" /></>);
export const IconPlus   = Ic(<><path d="M12 5v14M5 12h14" /></>);
export const IconArrowUp    = Ic(<><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></>);
export const IconArrowDown  = Ic(<><path d="M12 5v14" /><path d="m6 13 6 6 6-6" /></>);
export const IconArrowRight = Ic(<><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></>);
export const IconSpark  = Ic(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></>);
export const IconCheck  = Ic(<><path d="m5 12 5 5 9-12" /></>);
export const IconClose  = Ic(<><path d="M6 6l12 12M18 6 6 18" /></>);
export const IconFilter = Ic(<><path d="M3 5h18M6 12h12M10 19h4" /></>);
export const IconChev   = Ic(<><path d="m6 9 6 6 6-6" /></>);
export const IconWallet = Ic(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M16 12h.01" /><path d="M3 9h13a2 2 0 0 1 2 2v0" /></>);
export const IconCalendar = Ic(<><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></>);
export const IconEdit   = Ic(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>);
export const IconEye    = Ic(<><path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8-10-8-10-8z" /><circle cx="12" cy="12" r="3" /></>);
export const IconEyeOff = Ic(<><path d="M17.9 17.9A10.5 10.5 0 0 1 12 20C5.5 20 2 12 2 12a18 18 0 0 1 5.1-6" /><path d="M9.9 4.2A9.4 9.4 0 0 1 12 4c6.5 0 10 8 10 8a18 18 0 0 1-2.2 3.2" /><path d="m3 3 18 18" /><path d="M14.1 14.1A3 3 0 0 1 9.9 9.9" /></>);

export function CatIcon({ kind, size = 14 }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  const shapes = {
    food:         <><path d="M4 4v8a4 4 0 0 0 8 0V4" /><path d="M8 4v16" /><path d="M16 4c2 2 2 6 0 8v12" /></>,
    transport:    <><rect x="3" y="11" width="18" height="7" rx="2" /><circle cx="7" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M5 11l2-5h10l2 5" /></>,
    shopping:     <><path d="M6 7h12l-1 13H7z" /><path d="M9 7a3 3 0 0 1 6 0" /></>,
    bills:        <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    entertainment:<><path d="M4 6h16v12H4z" /><path d="M9 9l6 3-6 3z" fill="currentColor" stroke="none" /></>,
    healthcare:   <><path d="M12 4v16M4 12h16" /></>,
    education:    <><path d="m3 9 9-4 9 4-9 4z" /><path d="M7 11v5c3 2 7 2 10 0v-5" /></>,
    crypto:       <><circle cx="12" cy="12" r="9" /><path d="M9 8h5a2 2 0 0 1 0 4H9zM9 12h5.5a2 2 0 0 1 0 4H9zM10 6v2M10 16v2M13 6v2M13 16v2" /></>,
    laundry:      <><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="14" r="4" /><circle cx="8" cy="6" r=".7" fill="currentColor" /><circle cx="11" cy="6" r=".7" fill="currentColor" /></>,
    snacking:     <><path d="M5 7l14 1-1 13H6z" /><path d="M9 11v6M12 11v6M15 11v6" /></>,
    cigarette:    <><rect x="3" y="13" width="16" height="3" /><path d="M18 13v-2a2 2 0 0 1 2-2" /></>,
    salary:       <><circle cx="12" cy="12" r="7" /><path d="M12 8v8M9 10h5a1.5 1.5 0 0 1 0 3H9h6" /></>,
    freelance:    <><path d="M4 20l8-16 8 16" /><path d="M8 14h8" /></>,
    investment:   <><path d="M4 17l5-5 4 3 7-9" /><path d="M14 6h6v6" /></>,
    // Hutang/Piutang — panah mencerminkan arah uang
    piutang:       <><line x1="7" y1="17" x2="16" y2="8" /><polyline points="9 8 16 8 16 15" /></>,       // uang keluar dipinjamkan
    piutang_bayar: <><line x1="16" y1="8" x2="7" y2="17" /><polyline points="7 10 7 17 14 17" /></>,       // cicilan diterima (masuk)
    hutang:        <><path d="M12 4v11" /><polyline points="8 11 12 15 16 11" /><path d="M5 20h14" /></>,  // pinjaman diterima (masuk)
    hutang_bayar:  <><path d="M12 20V9" /><polyline points="8 13 12 9 16 13" /><path d="M5 4h14" /></>,     // bayar cicilan (keluar)
    other:        <><circle cx="12" cy="12" r="9" /><path d="M9 10a3 3 0 1 1 4.5 2.5c-1 .5-1.5 1-1.5 2.5M12 18h0" /></>,
  };
  return <svg {...props}>{shapes[kind] || shapes.other}</svg>;
}
