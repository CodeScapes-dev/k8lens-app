import { CONNECT_STEPS, buildStepSubs } from "@/lib/connect-data";
import { ConnectStepRow } from "./ConnectStepRow";

export function ConnectionPreviewPanel({ status, probeData, activeStep }) {
  const isConnecting = status === "connecting";
  const stepSubs = buildStepSubs(probeData);

  return (
    <div
      className="relative hidden flex-col overflow-hidden p-10 text-background lg:flex lg:p-14"
      style={{ background: "var(--foreground)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,.05) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative mb-8 flex items-center gap-2.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{
            background: status === "error" ? "#f87171" : "#34d399",
            boxShadow:
              status === "error"
                ? "0 0 0 4px rgba(248,113,113,.2)"
                : "0 0 0 4px rgba(52,211,153,.2)",
          }}
        />
        <span
          className="kl-mono text-[11px] tracking-[1.4px] uppercase"
          style={{ color: "rgba(255,255,255,.6)" }}
        >
          {status === "connecting"
            ? `Connecting · ${probeData?.contextName ?? "..."}`
            : status === "success"
              ? `Connected · ${probeData?.contextName ?? ""}`
              : status === "error"
                ? "Connection failed"
                : "Connection preview"}
        </span>
      </div>

      <div className="relative flex flex-col gap-[18px]">
        {CONNECT_STEPS.map((step, index) => (
          <ConnectStepRow
            key={step.n}
            n={step.n}
            title={step.title}
            sub={stepSubs ? stepSubs[index] : step.defaultSub}
            done={activeStep > index || status === "success"}
            active={activeStep === index && isConnecting}
            pending={activeStep < index}
          />
        ))}
      </div>

      <div className="relative mt-auto flex gap-2 pt-8">
        {[
          { label: "Latency", value: probeData ? String(probeData.latencyMs) : "-", unit: probeData ? "ms" : "" },
          { label: "Version", value: probeData ? probeData.serverVersion || "-" : "-", unit: "" },
          {
            label: "Namespaces",
            value: probeData ? String(probeData.namespaceCount) : "-",
            unit: probeData && probeData.crdCount > 0 ? `+${probeData.crdCount} CRDs` : "",
          },
        ].map(({ label, unit, value }) => (
          <div
            key={label}
            className="flex-1 rounded-lg p-3.5"
            style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
          >
            <div
              className="kl-mono text-[10px] tracking-[1.4px] uppercase"
              style={{ color: "rgba(255,255,255,.5)" }}
            >
              {label}
            </div>
            <div className="mt-1 text-[22px] font-semibold">
              {value}
              {unit && (
                <span className="ml-1 text-[12px] font-normal" style={{ color: "rgba(255,255,255,.5)" }}>
                  {unit}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {probeData?.localAddressWarning && (
        <div
          className="mt-4 rounded-lg px-3.5 py-2.5 text-[12px]"
          style={{
            background: "rgba(251,191,36,.07)",
            border: "1px solid rgba(251,191,36,.2)",
            color: "rgba(251,191,36,.85)",
          }}
        >
          {probeData.localAddressWarning}
        </div>
      )}
    </div>
  );
}
