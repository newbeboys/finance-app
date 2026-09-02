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

    // ── 25 icon tambahan khusus icon picker kategori KUSTOM (src/assets/icons/LOGO/),
    // ditambahkan supaya pilihan tidak terbatas ke 15 kind umum di atas.
    // Sumber 16x16 (Streamline Iconoir) di-scale ke viewBox 24x24 lewat <g transform>;
    // sumber 24x24 (Feather) dipakai langsung. Semua warna ikut currentColor (tema kategori).
    apple_mac:    <g transform="translate(.5 .5) scale(1.5)">
                    <path d="M10.21 0.68c0.25 1.53 -1.34 2.68 -2.23 3.2 -0.26 0.15 -0.56 -0.04 -0.51 -0.34 0.15 -1.01 0.71 -2.86 2.74 -2.86Z" />
                    <path d="M5.31 3.83c0.63 0 1.18 0.14 1.61 0.29 0.53 0.19 1.15 0.19 1.69 0 0.42 -0.15 0.98 -0.29 1.61 -0.29 0.76 0 1.73 0.41 2.45 1.24 -2.45 1.91 -1.75 5.06 0.54 5.9 -0.73 2.01 -2.12 3.37 -3.34 3.37 -1.05 0 -1.05 -0.49 -2.1 -0.49 -1.05 0 -1.05 0.49 -2.1 0.49 -1.75 0 -3.85 -2.8 -3.85 -6.3 0 -2.8 2.1 -4.2 3.5 -4.2Z" />
                  </g>,
    bathroom:     <g transform="translate(.5 .5) scale(1.5)">
                    <path d="M13.95 7.86v2.15c0 1.58 -1.28 2.87 -2.87 2.87H3.91c-1.58 0 -2.87 -1.28 -2.87 -2.87V8.29c0 -0.24 0.19 -0.43 0.43 -0.43h12.48Z" />
                    <path d="m10.37 12.88 0.72 1.43" />
                    <path d="m4.63 12.88 -0.72 1.43" />
                    <path d="M13.95 7.86V3.56c0 -1.58 -1.28 -2.87 -2.87 -2.87H7.5" />
                    <path d="M9.94 4.27H5.06c-0.24 0 -0.43 -0.19 -0.4 -0.43C4.77 2.89 5.25 0.69 7.5 0.69c2.25 0 2.73 2.21 2.84 3.16 0.03 0.24 -0.16 0.43 -0.4 0.43Z" />
                  </g>,
    bicycle:      <g transform="translate(.5 .5) scale(1.5)">
                    <path d="M3.13 11.88c1.38 0 2.5 -1.12 2.5 -2.5 0 -1.38 -1.12 -2.5 -2.5 -2.5s-2.5 1.12 -2.5 2.5c0 1.38 1.12 2.5 2.5 2.5Z" />
                    <path d="m5.31 4.69 3.75 0M11.88 9.38l-2.5 -4.69 -0.31 0m0 0 1.25 -1.88m0 0 -1.56 0m1.56 0 1.25 0" />
                    <path d="m3.13 9.38 2.19 -4.69L7.5 8.75l1.88 0" />
                    <path d="M5.31 4.69c-0.21 -0.63 -0.94 -1.88 -2.19 -1.88" />
                    <path d="M11.88 11.88c1.38 0 2.5 -1.12 2.5 -2.5 0 -1.38 -1.12 -2.5 -2.5 -2.5 -1.38 0 -2.5 1.12 -2.5 2.5 0 1.38 1.12 2.5 2.5 2.5Z" />
                  </g>,
    birthday_cake:<g transform="translate(.5 .5) scale(1.5)">
                    <path d="M2.03 10.58v2.39c0 0.76 0.61 1.37 1.37 1.37h8.2c0.76 0 1.37 -0.61 1.37 -1.37v-2.39" />
                    <path d="M1.35 8.87V8.18c0 -0.76 0.61 -1.37 1.37 -1.37h9.57c0.76 0 1.37 0.61 1.37 1.37v0.68" />
                    <path d="M7.5 4.77v2.05" />
                    <path d="M7.5 4.77c0.86 0 1.37 -0.66 1.37 -1.79S7.5 0.66 7.5 0.66 6.13 1.84 6.13 2.97s0.5 1.8 1.37 1.8Z" />
                    <path d="M5.45 8.87c0 1.13 -0.92 2.05 -2.05 2.05s-2.05 -0.92 -2.05 -2.05" />
                    <path d="M9.55 8.87c0 1.13 -0.92 2.05 -2.05 2.05s-2.05 -0.92 -2.05 -2.05" />
                    <path d="M13.65 8.87c0 1.13 -0.92 2.05 -2.05 2.05s-2.05 -0.92 -2.05 -2.05" />
                  </g>,
    car:          <g transform="translate(.5 .5) scale(1.5)">
                    <path d="M4.48 5.62h6.03" />
                    <path d="M3.73 8.63h0.75" />
                    <path d="M10.52 8.63h0.75" />
                    <path d="M0.72 11.65v-4.97c0 -0.2 0.04 -0.41 0.12 -0.59l1.75 -4.08c0.24 -0.55 0.78 -0.91 1.39 -0.91h7.06c0.6 0 1.15 0.36 1.39 0.91l1.75 4.08c0.08 0.19 0.12 0.39 0.12 0.59v4.97m-13.57 0v1.81c0 0.25 0.2 0.45 0.45 0.45h2.11c0.25 0 0.45 -0.2 0.45 -0.45v-1.81m-3.02 0h3.02m10.55 0v1.81c0 0.25 -0.2 0.45 -0.45 0.45h-2.11c-0.25 0 -0.45 -0.2 -0.45 -0.45v-1.81m3.02 0h-3.02m-7.54 0h7.54" />
                  </g>,
    cart_alt:     <g transform="translate(.5 .5) scale(1.5)">
                    <path d="M12.63 14.34c0.57 0 1.03 -0.46 1.03 -1.03s-0.46 -1.03 -1.03 -1.03 -1.03 0.46 -1.03 1.03 0.46 1.03 1.03 1.03Z" fill="currentColor" stroke="none" />
                    <path d="M5.79 14.34c0.57 0 1.03 -0.46 1.03 -1.03s-0.46 -1.03 -1.03 -1.03 -1.03 0.46 -1.03 1.03 0.46 1.03 1.03 1.03Z" fill="currentColor" stroke="none" />
                    <path d="M10.58 2.03h3.76l-1.37 7.52h-3.08m0.68 -7.52 -0.68 7.52m0.68 -7.52h-3.93m3.25 7.52H7.16m-0.51 -7.52H2.71l1.37 7.52h3.08m-0.51 -7.52 0.51 7.52" />
                    <path d="M2.71 2.03C2.6 1.57 2.03 0.66 0.66 0.66" />
                    <path d="M12.97 9.55H2.87c-1.22 0 -1.87 0.53 -1.87 1.37s0.65 1.37 1.87 1.37h9.76" />
                  </g>,
    home_hospital:<g transform="translate(.5 .5) scale(1.5)">
                    <path d="M0.72 5.62 7.5 1.47l6.78 4.15" />
                    <path d="M12.78 8.25v4.82c0 0.25 -0.2 0.45 -0.45 0.45H2.68c-0.25 0 -0.45 -0.2 -0.45 -0.45v-4.82" />
                    <path d="M8.76 11.27H6.24v-1.76H4.48v-2.51h1.76V5.24h2.51v1.76h1.76v2.51h-1.76v1.76Z" />
                  </g>,
    shorts:       <g transform="translate(.5 .5) scale(1.5)">
                    <path d="M0.72 2.69c-0.02 -0.27 0.19 -0.5 0.45 -0.5h12.65c0.27 0 0.48 0.23 0.45 0.5l-0.89 9.71c-0.02 0.23 -0.22 0.41 -0.45 0.41h-3.15c-0.2 0 -0.38 -0.13 -0.44 -0.32l-1.42 -4.63c-0.13 -0.43 -0.74 -0.43 -0.87 0l-1.42 4.63c-0.06 0.19 -0.24 0.32 -0.44 0.32H2.07c-0.24 0 -0.43 -0.18 -0.45 -0.41L1.16 7.5l-0.44 -4.81Z" />
                    <path d="M1.43 5.6h1.14c0.84 0 1.52 -0.68 1.52 -1.52V2.19" />
                    <path d="M13.95 5.6h-1.52c-0.84 0 -1.52 -0.68 -1.52 -1.52V2.19" />
                  </g>,
    sleeper_chair:<g transform="translate(.5 .5) scale(1.5)">
                    <path d="M2.03 11.6v2.05" />
                    <path d="M2.71 6.13V2.71c0 -0.76 0.61 -1.37 1.37 -1.37h6.84c0.76 0 1.37 0.61 1.37 1.37v3.42" />
                    <path d="M12.63 6.13c-0.94 0 -1.71 0.77 -1.71 1.71v1.03H4.08V7.84c0 -0.94 -0.77 -1.71 -1.71 -1.71s-1.71 0.77 -1.71 1.71c0 0.83 0.59 1.52 1.37 1.68v2.09h10.94V9.52c0.78 -0.16 1.37 -0.85 1.37 -1.68 0 -0.94 -0.77 -1.71 -1.71 -1.71Z" />
                    <path d="M12.97 11.6v2.05" />
                  </g>,
    soccer_ball:  <g transform="translate(.5 .5) scale(1.5)">
                    <path d="m7.5 4.77 2.6 1.89M7.5 4.77l-2.6 1.89M7.5 4.77V2.71m2.6 3.94 -0.99 3.06m0.99 -3.06 1.84 -0.86m-2.84 3.92H5.89m3.22 0 1.13 1.55M5.89 9.71l-0.99 -3.06m0.99 3.06 -1.13 1.55m0.13 -4.61L3.06 5.79m0 0L0.7 8.18m2.36 -2.39L2.37 2.98m9.57 2.81 2.36 2.39m-2.36 -2.39 0.68 -2.81M7.5 2.71 5.19 1.06M7.5 2.71l2.31 -1.65M4.77 11.26l-3.19 -0.34m3.19 0.34 1.71 3m3.76 -3 3.19 -0.34m-3.19 0.34 -1.71 3M14.34 7.5c0 3.78 -3.06 6.84 -6.84 6.84 -3.78 0 -6.84 -3.06 -6.84 -6.84C0.66 3.72 3.72 0.66 7.5 0.66c3.78 0 6.84 3.06 6.84 6.84Z" />
                  </g>,
    sofa:         <g transform="translate(.5 .5) scale(1.5)">
                    <path d="M0.66 10.23v2.05" />
                    <path d="M2.03 5.45V4.08c0 -0.76 0.61 -1.37 1.37 -1.37h8.2c0.76 0 1.37 0.61 1.37 1.37v1.37" />
                    <path d="M12.97 5.45c-0.76 0 -1.37 0.61 -1.37 1.37v1.37H3.4V6.82c0 -0.76 -0.61 -1.37 -1.37 -1.37s-1.37 0.61 -1.37 1.37v4.1h13.67V6.82c0 -0.76 -0.61 -1.37 -1.37 -1.37Z" />
                    <path d="M14.34 10.23v2.05" />
                  </g>,
    stroller:     <g transform="translate(.5 .5) scale(1.5)">
                    <path d="M6.63 1.2c-3.29 0 -5.95 2.66 -5.95 5.95 0 1.16 0.33 2.24 0.9 3.15" />
                    <path d="M11.67 10.3c0.57 -0.91 0.9 -1.99 0.9 -3.15V5.75h1.75" />
                    <path d="M4.18 13.8c-0.77 0 -1.4 -0.63 -1.4 -1.4s0.63 -1.4 1.4 -1.4 1.4 0.63 1.4 1.4 -0.63 1.4 -1.4 1.4Z" />
                    <path d="M9.08 13.8c-0.77 0 -1.4 -0.63 -1.4 -1.4s0.63 -1.4 1.4 -1.4 1.4 0.63 1.4 1.4 -0.63 1.4 -1.4 1.4Z" />
                    <path d="M6.63 1.2V7.5" />
                    <path d="M1.03 7.5h11.2" />
                  </g>,
    train:        <g transform="translate(.5 .5) scale(1.5)">
                    <path d="M5.74 3.64h3.52c1.06 0 1.92 0.86 1.92 1.92 0 0.16 -0.13 0.29 -0.29 0.29H4.11c-0.16 0 -0.29 -0.13 -0.29 -0.29 0 -1.06 0.86 -1.92 1.92 -1.92Z" />
                    <path d="M5.3 0.7h4.41c2.44 0 4.41 1.97 4.41 4.41v2.94c0 2.44 -1.97 4.41 -4.41 4.41H5.3c-2.44 0 -4.41 -1.97 -4.41 -4.41V5.11c0 -2.44 1.97 -4.41 4.41 -4.41Z" />
                    <path d="m10.44 9.53 0.01 -0.01" />
                    <path d="m4.56 9.53 0.01 -0.01" />
                    <path d="m6.4 12.46 -1.47 1.84" />
                    <path d="m8.6 12.46 1.47 1.84" />
                    <path d="m10.81 12.46 1.47 1.84" />
                    <path d="m4.19 12.46 -1.47 1.84" />
                  </g>,
    umbrella:     <g transform="translate(.5 .5) scale(1.5)">
                    <path d="M12.36 2.53C11.06 1.3 9.34 0.63 7.5 0.63S3.94 1.3 2.64 2.53C1.34 3.75 0.63 5.38 0.63 7.12c0 0.21 0.18 0.38 0.4 0.38 0.22 0 0.4 -0.17 0.4 -0.38 0 -0.63 0.55 -1.15 1.22 -1.15C3.83 5.97 3.39 7.5 4.26 7.5c0.87 0 0.44 -1.53 1.62 -1.53C7.06 5.97 7.5 7.5 7.5 7.5s0.44 -1.53 1.62 -1.53c1.18 0 0.87 1.53 1.62 1.53 0.74 0 0.44 -1.53 1.62 -1.53 0.67 0 1.22 0.52 1.22 1.15 0 0.21 0.18 0.38 0.4 0.38 0.22 0 0.4 -0.17 0.4 -0.38 0 -1.73 -0.72 -3.37 -2.01 -4.59Z" />
                    <path d="m7.5 7.5 0 5c0 2.5 -3.75 2.5 -3.75 0" />
                  </g>,

    book:         <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
    coffee:       <><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></>,
    film:         <><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="17" x2="22" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /></>,
    gift:         <><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></>,
    headphones:   <><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></>,
    home:         <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
    monitor:      <><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>,
    music:        <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
    shopping_cart:<><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>,
    smartphone:   <><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></>,
    watch:        <><circle cx="12" cy="12" r="7" /><polyline points="12 9 12 12 13.5 13.5" /><path d="M16.51 17.35l-.35 3.83a2 2 0 0 1-2 1.82H9.83a2 2 0 0 1-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 2 1.82l.35 3.83" /></>,
  };
  return <svg {...props}>{shapes[kind] || shapes.other}</svg>;
}

// Icon yang bisa dipilih user di icon picker kategori KUSTOM (lihat
// category-field.jsx & EditCategoryModal.jsx). 15 kind pertama = kind umum
// yang sudah dipakai kategori bawaan (reuse, bukan set baru) — 4 kind
// hutang/piutang tetap dikeluarkan karena auto-assigned sistem, tidak pernah
// dipilih manual (persis seperti DEBT_TX_CATEGORIES yang sengaja dikeluarkan
// dari CATEGORIES/INCOME_CATEGORIES di data.jsx). 25 kind berikutnya berasal
// dari src/assets/icons/LOGO/ — icon umum lain yang tidak terikat kategori
// bawaan manapun, ditambahkan supaya pilihan tidak terbatas ke 15 icon di atas.
// Total 40 → grid picker 5 kolom x 8 baris pas tanpa sisa.
// Index 0 = default universal (cocok dgn DEFAULT kolom custom_categories.icon).
export const CUSTOM_CATEGORY_ICONS = [
  'other', 'food', 'transport', 'shopping', 'bills', 'entertainment',
  'healthcare', 'education', 'crypto', 'laundry', 'snacking',
  'cigarette', 'salary', 'freelance', 'investment',
  'apple_mac', 'bathroom', 'bicycle', 'birthday_cake', 'car',
  'cart_alt', 'home_hospital', 'shorts', 'sleeper_chair', 'soccer_ball',
  'sofa', 'stroller', 'train', 'umbrella', 'book',
  'coffee', 'film', 'gift', 'headphones', 'home',
  'monitor', 'music', 'shopping_cart', 'smartphone', 'watch',
];
export const DEFAULT_CATEGORY_ICON = CUSTOM_CATEGORY_ICONS[0]; // 'other'
