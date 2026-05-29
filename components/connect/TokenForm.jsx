import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FieldLabel } from "./FieldLabel";

export function TokenForm({
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
        {fieldErrors.apiEndpoint && (
          <p className="mt-1 text-xs text-destructive">{fieldErrors.apiEndpoint}</p>
        )}
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
        {fieldErrors.token && (
          <p className="mt-1 text-xs text-destructive">{fieldErrors.token}</p>
        )}
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
          <span
            className={cn(
              "inline-block size-3.5 rounded-full bg-background shadow transition-transform",
              skipTls ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
        <span className="kl-mono text-[10.5px] tracking-[1.4px] text-muted-foreground uppercase">
          Skip TLS verification
        </span>
      </label>
    </div>
  );
}
