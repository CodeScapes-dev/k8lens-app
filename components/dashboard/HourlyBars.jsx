"use client";

export function HourlyBars({ data, height = 64 }) {
  const len = data.length;
  const maxTotal =
    Math.max(...data.map((d) => (d.n || 0) + (d.w || 0) + (d.e || 0))) || 1;
  const hour = (i) => `${String(i % 24).padStart(2, "0")}:00`;
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${len * 12} ${height}`}
      style={{ display: "block" }}
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        y1={height - 0.5}
        x2={len * 12}
        y2={height - 0.5}
        stroke="var(--kl-border)"
        strokeWidth="1"
      />
      {data.map((d, i) => {
        const hOk = ((d.n || 0) / maxTotal) * (height - 6);
        const hWarn = ((d.w || 0) / maxTotal) * (height - 6);
        const hErr = ((d.e || 0) / maxTotal) * (height - 6);
        const x = i * 12 + 1;
        const bw = 10;
        let y = height - 1;
        const tip = `${hour(i)}  Normal ${d.n || 0} · Warning ${d.w || 0} · Error ${d.e || 0}`;
        return (
          <g key={i} style={{ cursor: "default" }}>
            <title>{tip}</title>
            <rect x={x} y={0} width={bw} height={height} fill="transparent" />
            {hOk > 0 && (
              <rect
                x={x}
                y={(y -= hOk)}
                width={bw}
                height={hOk}
                fill="var(--kl-text-faint)"
                opacity="0.45"
                rx="1"
              />
            )}
            {hWarn > 0 && (
              <rect
                x={x}
                y={(y -= hWarn)}
                width={bw}
                height={hWarn}
                fill="var(--kl-warn)"
                rx="1"
              />
            )}
            {hErr > 0 && (
              <rect
                x={x}
                y={(y -= hErr)}
                width={bw}
                height={hErr}
                fill="var(--kl-err)"
                rx="1"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
