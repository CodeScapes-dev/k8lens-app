import { ActivityIcon } from "lucide-react";
import { ConditionsTimeline } from "@/components/detail/helpers";

const CRD_CONDITION_DESCRIPTIONS = {
  Established: "The CRD is active and available for use. New instances can be created.",
  NamesAccepted: "The names for the CRD have been accepted and are not conflicting with other resources.",
  NonStructuralSchema: "The CRD has a schema that is not fully structural. This may limit some features like pruning and defaulting.",
  Terminating: "The CRD is being deleted. Instances of this resource may still exist.",
};

function getStatus(c) {
  const isGood = (c.type === "Established" || c.type === "NamesAccepted") ? c.status === "True" : c.status !== "True";
  return { tone: isGood ? "ok" : "warn", dotColor: isGood ? "var(--kl-ok)" : "var(--kl-warn)" };
}

export function ConditionsTab({ crd }) {
  const conditions = crd?.status?.conditions ?? [];
  if (conditions.length === 0) return (
    <div className="flex flex-col items-center gap-2 py-16">
      <ActivityIcon size={28} style={{ color: "var(--kl-text-faint)" }} />
      <span style={{ fontSize: 13, color: "var(--kl-text-muted)" }}>No conditions reported</span>
    </div>
  );
  return <ConditionsTimeline conditions={conditions} getStatus={getStatus} descriptions={CRD_CONDITION_DESCRIPTIONS} />;
}
