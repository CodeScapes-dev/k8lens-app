"use client";

export function LivePulse({ color = "var(--kl-ok)" }) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        width: 8,
        height: 8,
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          background: color,
          opacity: 0.4,
          animation: "klPulse 1.6s ease-out infinite",
        }}
      />
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          background: color,
        }}
      />
    </span>
  );
}
