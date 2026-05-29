"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRightIcon, LoaderCircleIcon } from "lucide-react";

import { KLLogo } from "@/components/kl/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useClusterStore } from "@/stores/clusterStore";
import { METHODS, CONNECT_STEPS, STEP_MS } from "@/lib/connect-data";

import { ConnectionPreviewPanel } from "./ConnectionPreviewPanel";
import { KubeconfigForm } from "./KubeconfigForm";
import { InClusterForm } from "./InClusterForm";
import { TokenForm } from "./TokenForm";

export function ConnectPage() {
  const router = useRouter();
  const { connectViaAutoDetect, connectViaToken, connectViaUpload } =
    useClusterStore();

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
    [handleFileSelect],
  );

  const runWithSteps = useCallback(
    async (actionFn) => {
      setStatus("connecting");
      setErrorMessage("");
      setProbeData(null);

      const actionPromise = actionFn();
      // Suppress unhandled-rejection overlay when the fetch rejects before the
      // animation finishes — the try/catch below is the real error handler.
      actionPromise.catch(() => {});

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
    [router],
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
      }),
    );
  };

  const isConnecting = status === "connecting";
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
            Point K8Lens at
            <br />
            Kubernetes.
          </h1>
          <p className="mb-7 text-[14px] leading-[1.55] text-muted-foreground">
            Pick how you want to authenticate. Your credentials stay on this
            machine.
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
                      : "border-border bg-transparent hover:bg-muted/40",
                  )}
                >
                  {active && (
                    <div className="absolute top-0 right-0 h-2 w-2 rounded-bl-lg bg-foreground" />
                  )}
                  <Icon
                    className={cn(
                      "mb-2",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                    size={14}
                  />
                  <div
                    className={cn(
                      "text-[13px] font-semibold",
                      active ? "text-foreground" : "text-foreground/70",
                    )}
                  >
                    {label}
                  </div>
                  <div className="kl-mono mt-0.5 text-[10.5px] text-muted-foreground">
                    {sub}
                  </div>
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

          {status === "error" && (
            <p className="mb-4 text-xs text-destructive">{errorMessage}</p>
          )}

          <div className="mt-1 flex items-center gap-2">
            <Button
              size="default"
              onClick={handleConnect}
              disabled={isConnecting}
              className="gap-2"
            >
              {isConnecting ? (
                <LoaderCircleIcon size={14} className="animate-spin" />
              ) : (
                <ChevronRightIcon size={14} />
              )}
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
            {"// Your kubeconfig is read locally. K8Lens runs on your machine."}
          </p>
        </div>
      </div>

      <ConnectionPreviewPanel
        status={status}
        probeData={probeData}
        activeStep={activeStep}
      />
    </div>
  );
}
