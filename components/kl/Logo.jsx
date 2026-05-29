export function KLLogo({ size = 22, withWordmark = false, color }) {
  const c = color || "currentColor";

  return (
    <div
      style={{ display: "inline-flex", alignItems: "center", gap: 8, color: c }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-label="K8Lens logo"
      >
        <rect
          x="1.5"
          y="1.5"
          width="21"
          height="21"
          rx="5"
          stroke={c}
          strokeWidth="1.6"
        />
        <path
          d="M12 5 L18.5 8.5 L18.5 15.5 L12 19 L5.5 15.5 L5.5 8.5 Z"
          stroke={c}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2.4" fill={c} />
      </svg>
      {withWordmark && (
        <span
          style={{
            color: c,
            fontFamily: "var(--font-sans)",
            fontSize: size * 0.78,
            fontWeight: 600,
          }}
        >
          K8Lens
        </span>
      )}
    </div>
  );
}
