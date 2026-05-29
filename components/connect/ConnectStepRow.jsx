import { CheckIcon } from "lucide-react";

export function ConnectStepRow({ n, title, sub, done, active, pending }) {
  return (
    <div className="flex items-center gap-3.5">
      <div
        className="kl-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[11px] font-semibold"
        style={{
          background: done ? "#34d399" : active ? "rgba(79,141,247,.15)" : "rgba(255,255,255,.04)",
          border: done ? "none" : active ? "1px solid #4f8df7" : "1px solid rgba(255,255,255,.1)",
          color: done ? "#0b0c0e" : "rgba(255,255,255,.7)",
        }}
      >
        {done ? <CheckIcon size={12} /> : n}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-[14px] font-semibold"
            style={{ color: pending ? "rgba(255,255,255,.4)" : "#f4f4f5" }}
          >
            {title}
          </span>
          {active && (
            <span className="flex gap-0.5">
              <span className="h-1 w-1 animate-pulse rounded-full" style={{ background: "#4f8df7" }} />
              <span className="h-1 w-1 animate-pulse rounded-full delay-100" style={{ background: "#4f8df7" }} />
              <span className="h-1 w-1 animate-pulse rounded-full delay-200" style={{ background: "#4f8df7" }} />
            </span>
          )}
        </div>
        <div className="kl-mono mt-0.5 truncate text-[11.5px]" style={{ color: "rgba(255,255,255,.45)" }}>
          {sub}
        </div>
      </div>
    </div>
  );
}
