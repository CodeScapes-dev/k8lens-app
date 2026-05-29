"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckIcon,
  ChevronRightIcon,
  FileIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
  ServerIcon,
  ShieldIcon,
} from "lucide-react";

import { KLLogo } from "@/components/kl/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useClusterStore } from "@/stores/clusterStore";

const METHODS = [
  { id: "kubeconfig", label: "kubeconfig", sub: "Recommended", Icon: FileIcon },
  { id: "incluster", label: "In-cluster", sub: "Service account", Icon: ServerIcon },
  { id: "token", label: "Token", sub: "Bearer token", Icon: ShieldIcon },
];

const CONNECT_STEPS = [
  { n: "01", title: "Reading kubeconfig", defaultSub: "parsing contexts, users, clusters..." },
  { n: "02", title: "Resolving API endpoint", defaultSub: "looking up server address..." },
  { n: "03", title: "Verifying TLS", defaultSub: "checking certificate chain..." },
  { n: "04", title: "Probing API server", defaultSub: "fetching server version..." },
  { n: "05", title: "Loading API resources", defaultSub: "enumerating resource types..." },
  { n: "06", title: "Building informer cache", defaultSub: "watching pods, services, deployments..." },
];

const STEP_MS = [600, 500, 500, 700, 600, 500];

function buildStepSubs(probe) {
  if (!probe) return null;

  const {
    clusterCount = 0,
    contextCount = 0,
    crdCount = 0,
    namespaceCount = 0,
    namespaces = [],
    server = "",
    serverVersion = "",
    skipTls = false,
    userCount = 0,
  } = probe;

  return [
    `${contextCount} context${contextCount !== 1 ? "s" : ""} · ${userCount} user${userCount !== 1 ? "s" : ""} · ${clusterCount} cluster${clusterCount !== 1 ? "s" : ""}`,
    server || "-",
    skipTls ? "TLS verification skipped" : "TLS verified",
    serverVersion || "version unknown",
    `${crdCount} CRDs found`,
    namespaces.length > 0
      ? `watching ${namespaces.slice(0, 3).join(", ")}${namespaces.length > 3 ? "..." : ""}`
      : `${namespaceCount} namespace${namespaceCount !== 1 ? "s" : ""} loaded`,
  ];
}

export function ConnectPage() {
  const router = useRouter();
  const { connectViaAutoDetect, connectViaToken, connectViaUpload } = useClusterStore();

  useEffect(() => {
    useClusterStore.persist.rehydrate();
  }, []);

  const [method, setMethod] = useState("kubeconfig");
  const [status, setStatus] = useState("idle");
  const [activeStep, setActiveStep] = useState(-1);
  const [errorMessage, setErrorMessage] = useState("");
  const [probeData, setProbeData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [token, setToken] = useState("");
  const [caData, setCaData] = useState("");
  const [skipTls, setSkipTls] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const fileInputRef = useRef(null);

  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    if (file.size > 256 * 1024) {
      setFieldErrors({ file: "File too large (max 256 KB)." });
      return;
    }

    setSelectedFile(file);
    setFieldErrors({});
  }, []);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragOver(false);
      handleFileSelect(event.dataTransfer.files?.[0]);
    },
    [handleFileSelect]
  );

  const runWithSteps = useCallback(
    async (actionFn) => {
      setStatus("connecting");
      setErrorMessage("");
      setProbeData(null);

      const actionPromise = actionFn();

      for (let i = 0; i < CONNECT_STEPS.length; i += 1) {
        setActiveStep(i);
        await new Promise((resolve) => setTimeout(resolve, STEP_MS[i]));
      }

      try {
        const { commit, probe } = await actionPromise;
        if (probe) setProbeData(probe);
        setActiveStep(CONNECT_STEPS.length);
        setStatus("success");
        await new Promise((resolve) => setTimeout(resolve, 800));
        commit();
        router.push("/dashboard");
      } catch (error) {
        const message = error.message || "Connection failed.";
        setErrorMessage(message);
        toast.error(message);
        setStatus("error");
        setActiveStep(-1);
      }
    },
    [router]
  );

  const handleConnect = () => {
    if (method === "kubeconfig") {
      if (!selectedFile) {
        setFieldErrors({ file: "Please select a kubeconfig file." });
        return;
      }
      runWithSteps(() => connectViaUpload(selectedFile));
      return;
    }

    if (method === "incluster") {
      runWithSteps(() => connectViaAutoDetect());
      return;
    }

    const errors = {};
    if (!apiEndpoint.trim()) {
      errors.apiEndpoint = "API endpoint is required.";
    } else {
      try {
        new URL(apiEndpoint.trim());
      } catch {
        errors.apiEndpoint = "Must be a valid URL.";
      }
    }
    if (!token.trim()) errors.token = "Token is required.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    runWithSteps(() =>
      connectViaToken({
        apiEndpoint: apiEndpoint.trim(),
        token: token.trim(),
        caData: caData.trim() || undefined,
        skipTls,
      })
    );
  };

  const isConnecting = status === "connecting";
  const stepSubs = buildStepSubs(probeData);
  const connectLabel =
    method === "kubeconfig"
      ? "Connect via kubeconfig"
      : method === "incluster"
        ? "Auto-detect clusters"
        : "Connect cluster";

  return (
    <div className="fixed inset-0 grid grid-cols-1 overflow-hidden bg-background lg:grid-cols-[1.05fr_1fr]">
      <div className="flex flex-col overflow-y-auto px-6 py-8 sm:px-10 lg:px-16 lg:py-14">
        <div className="mb-10 flex items-center gap-2 lg:mb-14">
          <KLLogo size={22} withWordmark />
        </div>

        <div className="w-full max-w-[460px]">
          <p className="kl-mono mb-3 text-[11px] tracking-[1.4px] text-muted-foreground uppercase">
            Connect a cluster
          </p>
          <h1 className="mb-2 text-[38px] leading-[1.1] font-semibold">
            Point KuLens at
            <br />
            Kubernetes.
          </h1>
          <p className="mb-7 text-[14px] leading-[1.55] text-muted-foreground">
            Pick how you want to authenticate. Your credentials stay on this machine.
          </p>

          <div className="mb-6 grid grid-cols-3 gap-2">
            {METHODS.map(({ id, label, sub, Icon }) => {
              const active = method === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setMethod(id);
                    setFieldErrors({});
                  }}
                  disabled={isConnecting}
                  className={cn(
                    "relative cursor-pointer rounded-lg border p-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    active
                      ? "border-foreground bg-background"
                      : "border-border bg-transparent hover:bg-muted/40"
                  )}
                >
                  {active && <div className="absolute top-0 right-0 h-2 w-2 rounded-bl-lg bg-foreground" />}
                  <Icon className={cn("mb-2", active ? "text-foreground" : "text-muted-foreground")} size={14} />
                  <div className={cn("text-[13px] font-semibold", active ? "text-foreground" : "text-foreground/70")}>
                    {label}
                  </div>
                  <div className="kl-mono mt-0.5 text-[10.5px] text-muted-foreground">{sub}</div>
                </button>
              );
            })}
          </div>

          {method === "kubeconfig" && (
            <KubeconfigForm
              selectedFile={selectedFile}
              dragOver={dragOver}
              fileInputRef={fileInputRef}
              fieldErrors={fieldErrors}
              disabled={isConnecting}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onFileSelect={handleFileSelect}
            />
          )}
          {method === "incluster" && <InClusterForm />}
          {method === "token" && (
            <TokenForm
              apiEndpoint={apiEndpoint}
              setApiEndpoint={setApiEndpoint}
              token={token}
              setToken={setToken}
              caData={caData}
              setCaData={setCaData}
              skipTls={skipTls}
              setSkipTls={setSkipTls}
              fieldErrors={fieldErrors}
              disabled={isConnecting}
            />
          )}

          {status === "error" && <p className="mb-4 text-xs text-destructive">{errorMessage}</p>}

          <div className="mt-1 flex items-center gap-2">
            <Button size="default" onClick={handleConnect} disabled={isConnecting} className="gap-2">
              {isConnecting ? <LoaderCircleIcon size={14} className="animate-spin" /> : <ChevronRightIcon size={14} />}
              {isConnecting ? "Connecting..." : connectLabel}
            </Button>
            <Button
              variant="outline"
              size="default"
              disabled={isConnecting}
              onClick={() => {
                setStatus("idle");
                setActiveStep(-1);
                setErrorMessage("");
                setProbeData(null);
              }}
            >
              Reset
            </Button>
          </div>

          <p className="kl-mono mt-7 border-t border-dashed border-border pt-5 text-[11px] text-muted-foreground/50">
            {"// Your kubeconfig is read locally. KuLens runs on your machine."}
          </p>
        </div>
      </div>

      <div className="relative hidden flex-col overflow-hidden p-10 text-background lg:flex lg:p-14" style={{ background: "var(--foreground)" }}>
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
                status === "error" ? "0 0 0 4px rgba(248,113,113,.2)" : "0 0 0 4px rgba(52,211,153,.2)",
            }}
          />
          <span className="kl-mono text-[11px] tracking-[1.4px] uppercase" style={{ color: "rgba(255,255,255,.6)" }}>
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
              <div className="kl-mono text-[10px] tracking-[1.4px] uppercase" style={{ color: "rgba(255,255,255,.5)" }}>
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
    </div>
  );
}

function ConnectStepRow({ n, title, sub, done, active, pending }) {
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
          <span className="text-[14px] font-semibold" style={{ color: pending ? "rgba(255,255,255,.4)" : "#f4f4f5" }}>
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

function FieldLabel({ children, hint }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <span className="kl-mono text-[10.5px] font-medium tracking-[1.4px] text-muted-foreground uppercase">{children}</span>
      {hint && <span className="kl-mono text-[10px] text-muted-foreground/50">{hint}</span>}
    </div>
  );
}

function KubeconfigForm({
  disabled,
  dragOver,
  fieldErrors,
  fileInputRef,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileSelect,
  selectedFile,
}) {
  return (
    <div className="mb-5">
      <FieldLabel hint="~/.kube/config">Kubeconfig file</FieldLabel>
      <div className="mb-3 flex gap-2">
        <div
          className={cn(
            "flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-muted/40 px-3 font-mono text-[12px]",
            fieldErrors.file ? "border-destructive" : "border-border"
          )}
        >
          <FileIcon size={12} className="shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-foreground">{selectedFile ? selectedFile.name : "~/.kube/config"}</span>
          {selectedFile && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />}
        </div>
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => fileInputRef.current?.click()} className="shrink-0 gap-1.5">
          <FolderOpenIcon size={12} />
          Browse
        </Button>
      </div>
      {fieldErrors.file && <p className="mb-2 text-xs text-destructive">{fieldErrors.file}</p>}
      <div
        role="button"
        tabIndex={0}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => event.key === "Enter" && fileInputRef.current?.click()}
        className={cn(
          "flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors",
          dragOver ? "border-ring bg-accent" : "border-border hover:border-ring/50 hover:bg-muted/30"
        )}
      >
        <FileIcon size={12} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Drop kubeconfig here or click to select</span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml,.json,.conf,.kubeconfig"
        className="sr-only"
        onChange={(event) => onFileSelect(event.target.files?.[0])}
      />
    </div>
  );
}

function InClusterForm() {
  return (
    <div className="mb-5 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <ServerIcon size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
        <div>
          <p className="mb-1 text-sm font-medium">Detect from environment</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Reads <code className="rounded bg-muted px-1 py-0.5 font-mono">~/.kube/config</code> or{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">KUBECONFIG</code>. All contexts will be imported.
          </p>
        </div>
      </div>
    </div>
  );
}

function TokenForm({
  apiEndpoint,
  caData,
  disabled,
  fieldErrors,
  setApiEndpoint,
  setCaData,
  setSkipTls,
  setToken,
  skipTls,
  token,
}) {
  return (
    <div className="mb-5 flex flex-col gap-3.5">
      <div>
        <FieldLabel hint="Required">API endpoint URL</FieldLabel>
        <Input
          type="url"
          placeholder="https://cluster-api.example.com:6443"
          value={apiEndpoint}
          onChange={(event) => setApiEndpoint(event.target.value)}
          disabled={disabled}
          aria-invalid={!!fieldErrors.apiEndpoint}
          className="h-9 font-mono text-xs"
        />
        {fieldErrors.apiEndpoint && <p className="mt-1 text-xs text-destructive">{fieldErrors.apiEndpoint}</p>}
      </div>

      <div>
        <FieldLabel hint="Required">Service account token</FieldLabel>
        <Textarea
          placeholder="eyJhbGciOiJSUzI1NiIsImtpZCI6Ik..."
          value={token}
          onChange={(event) => setToken(event.target.value)}
          disabled={disabled}
          aria-invalid={!!fieldErrors.token}
          rows={3}
          className="resize-none font-mono text-xs"
        />
        {fieldErrors.token && <p className="mt-1 text-xs text-destructive">{fieldErrors.token}</p>}
      </div>

      <div>
        <FieldLabel hint="Optional">Certificate authority data</FieldLabel>
        <Textarea
          placeholder={"-----BEGIN CERTIFICATE-----\nMIIC+zCCAeOgAwIBAgIBADANBgkq...\n-----END CERTIFICATE-----"}
          value={caData}
          onChange={(event) => setCaData(event.target.value)}
          disabled={disabled}
          rows={3}
          className="resize-none font-mono text-xs"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 select-none">
        <button
          type="button"
          role="switch"
          aria-checked={skipTls}
          onClick={() => setSkipTls((value) => !value)}
          disabled={disabled}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
            skipTls ? "bg-foreground" : "bg-input"
          )}
        >
          <span className={cn("inline-block size-3.5 rounded-full bg-background shadow transition-transform", skipTls ? "translate-x-4" : "translate-x-0.5")} />
        </button>
        <span className="kl-mono text-[10.5px] tracking-[1.4px] text-muted-foreground uppercase">Skip TLS verification</span>
      </label>
    </div>
  );
}
