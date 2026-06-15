import React from 'react';
import { useTranslation } from 'react-i18next';
import { fmtShort } from './data';

export function CashflowChart({ data }) {
  const { t } = useTranslation();
  const slice = data; // filtering dilakukan di CashflowCard sebelum di-pass ke sini

  const W = 720, H = 240, P = { t: 20, r: 16, b: 28, l: 40 };
  const innerW = W - P.l - P.r;
  const innerH = H - P.t - P.b;

  const rawMax = Math.max(...slice.map(d => Math.max(d.income, d.expense)));
  const base   = rawMax < 1_000_000 ? 500_000 : 5_000_000;
  const max    = Math.ceil((rawMax || base) / base) * base + base;
  const fmtY   = (v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(0)}jt` : `${(v/1_000).toFixed(0)}rb`;

  const x = (i) => P.l + (slice.length === 1 ? innerW/2 : (i * innerW) / (slice.length - 1));
  const y = (v) => P.t + innerH - (v / max) * innerH;

  const smoothPath = (pts) => {
    if (pts.length < 2) return "";
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
    }
    return d;
  };

  const incomePts  = slice.map((d, i) => [x(i), y(d.income)]);
  const expensePts = slice.map((d, i) => [x(i), y(d.expense)]);

  const areaPath = (pts) => smoothPath(pts) + ` L ${pts[pts.length-1][0]},${P.t + innerH} L ${pts[0][0]},${P.t + innerH} Z`;

  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => (max / yTicks) * i);

  const [hover, setHover] = React.useState(null);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bestD = Infinity;
    slice.forEach((_, i) => {
      const dx = Math.abs(x(i) - px);
      if (dx < bestD) { bestD = dx; best = i; }
    });
    setHover(best);
  };

  return (
    <svg className="cashflow-chart-svg" viewBox={`0 0 ${W} ${H}`} width="100%" height={H} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id="incomeFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stopColor="var(--sage)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--sage)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="expenseFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stopColor="var(--terra)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--terra)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {tickVals.map((v, i) => (
        <g key={i}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)}
                stroke="var(--line-soft)" strokeDasharray="2 4" />
          <text x={P.l - 10} y={y(v)} dy="4" textAnchor="end"
                fontSize="10.5" fill="var(--muted)" fontFamily="Geist, sans-serif">
            {fmtY(v)}
          </text>
        </g>
      ))}

      <path d={areaPath(incomePts)} fill="url(#incomeFill)" />
      <path d={smoothPath(incomePts)} fill="none" stroke="var(--sage)" strokeWidth="1.8" />

      <path d={areaPath(expensePts)} fill="url(#expenseFill)" />
      <path d={smoothPath(expensePts)} fill="none" stroke="var(--terra)" strokeWidth="1.8" strokeDasharray="3 3" />

      {slice.map((d, i) => {
        const showLabel = slice.length <= 12 || i % 5 === 0 || i === slice.length - 1;
        return showLabel ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5"
                fill={hover === i ? "var(--ink)" : "var(--muted)"} fontFamily="Geist, sans-serif">
            {d.m}
          </text>
        ) : null;
      })}

      {hover !== null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={P.t + innerH}
                stroke="var(--ink)" strokeOpacity="0.15" />
          <circle cx={x(hover)} cy={y(slice[hover].income)} r="4" fill="var(--cream)" stroke="var(--sage)" strokeWidth="2" />
          <circle cx={x(hover)} cy={y(slice[hover].expense)} r="4" fill="var(--cream)" stroke="var(--terra)" strokeWidth="2" />
          {(() => {
            const tx = Math.min(W - 160, Math.max(P.l, x(hover) - 75));
            return (
              <g transform={`translate(${tx}, ${P.t + 6})`}>
                <rect width="152" height="56" rx="8" fill="var(--paper)" stroke="var(--line-soft)" />
                <text x="10" y="16" fontSize="10.5" fill="var(--muted)" fontFamily="Geist, sans-serif">
                  {slice[hover].m}{slice[hover].year ? ` ${slice[hover].year}` : ""}
                </text>
                <circle cx="14" cy="30" r="3" fill="var(--sage)" />
                <text x="22" y="33" fontSize="11" fill="var(--ink)" fontFamily="Geist, sans-serif">
                  {t('transaksi.masuk')} <tspan fontWeight="600">{fmtShort(slice[hover].income)}</tspan>
                </text>
                <circle cx="14" cy="46" r="3" fill="var(--terra)" />
                <text x="22" y="49" fontSize="11" fill="var(--ink)" fontFamily="Geist, sans-serif">
                  {t('transaksi.keluar')} <tspan fontWeight="600">{fmtShort(slice[hover].expense)}</tspan>
                </text>
              </g>
            );
          })()}
        </g>
      )}
    </svg>
  );
}

export function SpendingDonut({ data, active, onHover, fmtFn = fmtShort }) {
  const { t } = useTranslation();
  const total = data.reduce((s, d) => s + d.amount, 0);
  const R = 78, r = 56, cx = 100, cy = 100;
  let acc = 0;
  const arcs = data.map((d, i) => {
    const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += d.amount;
    const end   = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x0 = cx + R * Math.cos(start), y0 = cy + R * Math.sin(start);
    const x1 = cx + R * Math.cos(end),   y1 = cy + R * Math.sin(end);
    const x2 = cx + r * Math.cos(end),   y2 = cy + r * Math.sin(end);
    const x3 = cx + r * Math.cos(start), y3 = cy + r * Math.sin(start);
    const path = `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`;
    return { ...d, path, key: d.id };
  });

  const top = active !== null ? data[active] : null;

  return (
    <svg viewBox="0 0 200 200" width="100%" height="220">
      {arcs.map((a, i) => (
        <path key={a.key} d={a.path}
              fill={a.color}
              opacity={active === null || active === i ? 1 : 0.32}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              style={{ transition: "opacity .2s ease", cursor: "pointer" }} />
      ))}
      <circle cx={cx} cy={cy} r={r - 1} fill="var(--ivory)" pointerEvents="none" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="10.5" fill="var(--muted)" fontFamily="Geist, sans-serif" letterSpacing="0.05em">
        {top ? top.label.toUpperCase() : t('beranda.bulanIni').toUpperCase()}
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontFamily="'Instrument Serif', serif" fontSize="24" fill="var(--ink)">
        {fmtFn(top ? top.amount : total)}
      </text>
      {!top && (
        <text x={cx} y={cy + 34} textAnchor="middle" fontSize="10.5" fill="var(--muted)" fontFamily="Geist, sans-serif">
          {t('beranda.dariNKategori', { count: data.length })}
        </text>
      )}
    </svg>
  );
}

export function Spark({ values, color = "var(--ink)" }) {
  const W = 92, H = 28;
  if (!values || values.length < 2) {
    return <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} />;
  }
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - ((v - min) / span) * (H - 4) - 2,
  ]);
  const d = pts.reduce((acc, p, i) => acc + (i ? ` L ${p[0]},${p[1]}` : `M ${p[0]},${p[1]}`), "");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.2" fill={color} />
    </svg>
  );
}

export function Ring({ pct, size = 64, stroke = 5, color = "var(--sage)" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} stroke="var(--line-soft)" strokeWidth={stroke} fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
              strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
              transform={`rotate(-90 ${size/2} ${size/2})`}
              style={{ transition: "stroke-dashoffset .6s ease" }} />
      <text x={size/2} y={size/2} dy="4" textAnchor="middle" fontSize="11"
            fontFamily="Geist, sans-serif" fontWeight="600" fill="var(--ink)">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}
