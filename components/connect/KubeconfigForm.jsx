import { FileIcon, FolderOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FieldLabel } from "./FieldLabel";

export function KubeconfigForm({
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
          <span className="flex-1 truncate text-foreground">
            {selectedFile ? selectedFile.name : "~/.kube/config"}
          </span>
          {selectedFile && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 gap-1.5"
        >
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
