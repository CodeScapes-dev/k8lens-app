import { ActivityIcon } from "lucide-react";
import { ConditionsTimeline } from "@/components/detail/helpers";

const CONDITION_DESCRIPTIONS = {
  ScalingActive: "Indicates whether the HPA controller is able to scale and whether it has current metrics to base its decisions on.",
  AbleToScale: "Indicates whether or not the HPA controller is able to fetch and update the scale for the target.",
  ScalingLimited: "Indicates that the desired scale was clamped to the min or max of the HPA.",
};

function getStatus(c) {
  const isTrue = c.status === "True";
  const isBad = (c.type === "ScalingLimited" && isTrue) || (c.type !== "ScalingLimited" && !isTrue);
  return { tone: isBad ? "warn" : "ok", dotColor: isBad ? "var(--kl-warn)" : "var(--kl-ok)" };
}

export function ConditionsTab({ hpa }) {
  const conditions = hpa?.status?.conditions ?? [];
  if (conditions.length === 0) return (
    <div className="flex flex-col items-center gap-2 py-16">
      <ActivityIcon size={28} style={{ color: "var(--kl-text-faint)" }} />
      <span style={{ fontSize: 13, color: "var(--kl-text-muted)" }}>No conditions reported</span>
    </div>
  );
  return <ConditionsTimeline conditions={conditions} getStatus={getStatus} descriptions={CONDITION_DESCRIPTIONS} />;
}
