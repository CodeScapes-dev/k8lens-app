"use client";

export function Sparkline({
  data,
  color = "var(--kl-accent)",
  width = 130,
  height = 32,
}) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => [
    i * stepX,
    height - ((v - min) / range) * (height - 6) - 3,
  ]);
  let d = `M ${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    const cx = (x1 + x2) / 2;
    d += ` C ${cx.toFixed(2)},${y1.toFixed(2)} ${cx.toFixed(2)},${y2.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`;
  }
  const fillD = `${d} L ${width},${height} L 0,${height} Z`;
  const gid = `sg${color.replace(/[^a-z0-9]/gi, "").slice(0, 12)}${width}`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${gid})`} stroke="none" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  );
}
