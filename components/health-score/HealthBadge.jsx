"use client";

import React from "react";
import { computeHealthScore, scoreLabel, scoreColor } from "@/lib/k8s/health-score";
import { KLBadge } from "@/components/kl/Badge";
import { HealthPanel } from "./HealthPanel";

export function HealthBadge({ resourceType, data }) {
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState(null);
  const btnRef = React.useRef(null);

  const { score, signals } = React.useMemo(
    () => computeHealthScore(resourceType, data),
    [resourceType, data],
  );

  const label = scoreLabel(score);
  const tone = score >= 80 ? "ok" : score >= 50 ? "warn" : "err";
  const isHealthy = score === 100;

  const handleOpen = () => {
    if (isHealthy) return;
    const rect = btnRef.current?.getBoundingClientRect();
    setAnchor(rect ?? null);
    setOpen(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        title={isHealthy ? "Healthy" : `${signals.length} issue${signals.length !== 1 ? "s" : ""} — click for details`}
        style={{ background: "none", border: "none", padding: 0, cursor: isHealthy ? "default" : "pointer" }}
      >
        <KLBadge tone={tone}>{score} · {label}</KLBadge>
      </button>

      {open && <HealthPanel score={score} signals={signals} anchor={anchor} onClose={() => setOpen(false)} />}
    </>
  );
}
