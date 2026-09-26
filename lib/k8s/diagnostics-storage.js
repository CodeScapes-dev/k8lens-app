// Diagnostics for Storage resources: PersistentVolumeClaim, PersistentVolume, StorageClass.
import { PENDING_THRESHOLD_MS, ageMs, condition, eventMessage, latestEvent, plural } from "./diagnostics-common.js";

const NO_PROVISIONER = "kubernetes.io/no-provisioner";
const isStuck = (obj, now) => (ageMs(obj, now) ?? 0) > PENDING_THRESHOLD_MS;
const key = (obj) => `${obj?.metadata?.namespace}/${obj?.metadata?.name}`;

// ---------- PersistentVolumeClaim ----------

export function diagnosePvc(data, now = Date.now()) {
  const pvc = data?.pvc;
  if (!pvc) return [];
  const events = data?.events ?? [];
  const classes = Array.isArray(data?.storageClasses) ? data.storageClasses : null;
  const phase = pvc.status?.phase;
  const out = [];

  if (phase === "Lost") {
    out.push({
      id: "pvc:lost",
      issue: "The volume behind this claim is gone",
      technicalName: "Lost",
      severity: "Critical",
      rootCause: `This claim was bound to the volume "${pvc.spec?.volumeName ?? "unknown"}", but that volume no longer exists, so pods that use the claim can't get their data.`,
      evidence: [`Claim phase: Lost`, `Volume: ${pvc.spec?.volumeName ?? "unknown"}`],
      remediation: [
        "Find out why the volume was removed (someone deleted the PersistentVolume, or the storage behind it was lost).",
        "Restore the data from a backup into a new volume, then delete and recreate this claim.",
      ],
    });
  }

  if (phase === "Pending") {
    const className = pvc.spec?.storageClassName;
    const cls = classes && className ? classes.find((c) => c.name === className) : null;
    const provisionFailure = latestEvent(events, (e) => e?.type === "Warning" && e.reason === "ProvisioningFailed");
    const waitsForConsumer =
      events.some((e) => e.reason === "WaitForFirstConsumer") || cls?.volumeBindingMode === "WaitForFirstConsumer";
    const pods = data?.pods ?? [];
    const base = { id: "pvc:pending", technicalName: "Pending" };

    if (classes && className && !cls) {
      out.push({
        ...base,
        issue: "Storage class doesn't exist",
        severity: "Critical",
        rootCause: `This claim asks for the storage class "${className}", but the cluster has no such class, so no volume will ever be created for it.`,
        evidence: [`Requested class: ${className}`, `Classes in the cluster: ${classes.map((c) => c.name).join(", ") || "none"}`],
        remediation: ["Change the claim's storageClassName to a class that exists, or create the class (or install the storage driver that provides it)."],
      });
    } else if (classes && (className === undefined || className === null) && !classes.some((c) => c.isDefault)) {
      out.push({
        ...base,
        issue: "No storage class, and the cluster has no default",
        severity: "Critical",
        rootCause: "This claim doesn't name a storage class and the cluster has no default one, so nothing will create a volume for it.",
        evidence: [`Classes in the cluster: ${classes.map((c) => c.name).join(", ") || "none"}`],
        remediation: ["Set storageClassName on the claim, or mark one StorageClass as the default."],
      });
    } else if (provisionFailure) {
      out.push({
        ...base,
        issue: "Couldn't create the volume",
        severity: "Critical",
        rootCause: "The storage system was asked to create a volume for this claim and failed.",
        evidence: [`Kubernetes reported: ${eventMessage(provisionFailure)}`, ...(className ? [`Storage class: ${className}`] : [])],
        remediation: [
          "Read the message above for the storage system's reason (quota, permissions, an unsupported size or setting).",
          "Check the storage driver's pods, usually in kube-system, for errors.",
        ],
      });
    } else if (cls?.provisioner === NO_PROVISIONER) {
      if (isStuck(pvc, now)) {
        out.push({
          ...base,
          issue: "Waiting for a volume to be created by hand",
          severity: "Warning",
          rootCause: `The storage class "${className}" doesn't create volumes automatically, so this claim waits until someone creates a matching PersistentVolume.`,
          evidence: [`Provisioner: ${NO_PROVISIONER}`],
          remediation: ["Create a PersistentVolume with enough capacity, the same access mode and this storage class, and Kubernetes binds it automatically."],
        });
      }
    } else if (waitsForConsumer) {
      if (pods.length > 0 && isStuck(pvc, now)) {
        out.push({
          ...base,
          issue: "Waiting for its pod to be placed",
          severity: "Warning",
          rootCause: "This claim only gets a volume once a pod that uses it is placed on a machine, and that hasn't happened yet.",
          evidence: [`Pods using it: ${pods.slice(0, 5).map((p) => p.metadata?.name).join(", ")}`, "Binding mode: WaitForFirstConsumer"],
          remediation: ["Open those pods (Workloads → Pods). Their Diagnostics tab explains why they can't be placed."],
        });
      }
    } else if (isStuck(pvc, now)) {
      const latest = latestEvent(events, (e) => e?.type === "Warning");
      out.push({
        ...base,
        issue: "Still waiting for a volume",
        severity: "Warning",
        rootCause: "This claim has been waiting for over 5 minutes and no volume has been assigned.",
        evidence: [...(latest ? [`Kubernetes reported: ${eventMessage(latest)}`] : ["No warning events found (Kubernetes only keeps them for about an hour)"]), ...(className ? [`Storage class: ${className}`] : [])],
        remediation: [
          "Check the storage class's provisioner (the driver's pods, usually in kube-system) is running.",
          "If you expected an existing volume, make sure its size, access mode and storage class match this claim.",
        ],
      });
    }
  }

  const resizeFailure = latestEvent(events, (e) => e?.type === "Warning" && /resize/i.test(e.reason ?? ""));
  if (resizeFailure) {
    out.push({
      id: "pvc:resize-failed",
      issue: "Growing the volume failed",
      technicalName: resizeFailure.reason,
      severity: "Warning",
      rootCause: "A request to make this volume bigger didn't work, so it is still at its old size.",
      evidence: [`Kubernetes reported: ${eventMessage(resizeFailure)}`],
      remediation: ["Read the message above for the reason. The storage class must allow expansion (allowVolumeExpansion: true), and the storage backend must have room."],
    });
  } else if (condition(pvc, "FileSystemResizePending")?.status === "True" && isStuck(pvc, now)) {
    out.push({
      id: "pvc:resize-pending",
      issue: "Volume grown, waiting for a pod to use it",
      technicalName: "FileSystemResizePending",
      severity: "Warning",
      rootCause: "The volume itself has grown, but its file system only expands when a pod that uses it is running.",
      evidence: [condition(pvc, "FileSystemResizePending")?.message ?? "FileSystemResizePending is True"],
      remediation: ["Start (or restart) a pod that mounts this claim so the file system can finish growing."],
    });
  }
  return out;
}

// ---------- PersistentVolume ----------

export function diagnosePv(data) {
  const pv = data?.pv;
  if (!pv) return [];
  const phase = pv.status?.phase;
  const events = data?.events ?? [];

  if (phase === "Failed") {
    const latest = latestEvent(events, (e) => e?.type === "Warning");
    return [
      {
        id: "pv:failed",
        issue: "Volume cleanup failed",
        technicalName: "Failed",
        severity: "Critical",
        rootCause: "Kubernetes tried to clean up or delete this volume after its claim was removed, and couldn't.",
        evidence: [...(pv.status?.message ? [`Kubernetes reported: ${pv.status.message}`] : []), ...(latest ? [`Latest warning: ${eventMessage(latest)}`] : []), `Reclaim policy: ${pv.spec?.persistentVolumeReclaimPolicy ?? "unknown"}`],
        remediation: [
          "Clean up the underlying storage by hand (for example the disk or directory behind this volume).",
          `Then delete this volume object: kubectl delete pv ${pv.metadata?.name}`,
        ],
      },
    ];
  }

  if (phase === "Released") {
    return [
      {
        id: "pv:released",
        issue: "Released, but not available for reuse",
        technicalName: "Released",
        severity: "Warning",
        rootCause: "The claim that used this volume was deleted. The volume keeps its data, and Kubernetes won't hand it to a new claim until someone clears the old claim reference.",
        evidence: [`Reclaim policy: ${pv.spec?.persistentVolumeReclaimPolicy ?? "unknown"}`, ...(pv.spec?.claimRef ? [`Previous claim: ${pv.spec.claimRef.namespace}/${pv.spec.claimRef.name}`] : [])],
        remediation: [
          "Back up the data first if you still need it.",
          `To make the volume available again: kubectl patch pv ${pv.metadata?.name} -p '{"spec":{"claimRef":null}}'`,
          "Or delete it if it isn't needed any more.",
        ],
      },
    ];
  }
  return [];
}

// ---------- StorageClass ----------

export function diagnoseStorageClass(data, now = Date.now()) {
  const sc = data?.storageClass;
  if (!sc) return [];
  const claims = data?.pvcs ?? [];
  const out = [];

  const lost = claims.filter((c) => c.status?.phase === "Lost");
  if (lost.length > 0) {
    out.push({
      id: "sc:lost",
      issue: "Claims lost their volumes",
      technicalName: "Lost",
      severity: "Critical",
      rootCause: `${plural(lost.length, "claim")} using this class ${lost.length === 1 ? "is" : "are"} bound to volumes that no longer exist.`,
      evidence: lost.slice(0, 10).map((c) => `${key(c)} (volume ${c.spec?.volumeName ?? "unknown"})`),
      remediation: ["Open each claim (Storage → Persistent Volume Claims) for how to recover, and restore data from backups if needed."],
    });
  }

  const waiting = claims.filter((c) => c.status?.phase === "Pending" && isStuck(c, now));
  if (waiting.length > 0) {
    const manual = sc.provisioner === NO_PROVISIONER;
    out.push({
      id: "sc:pending-claims",
      issue: "Claims are stuck waiting for storage",
      technicalName: "Pending",
      severity: "Warning",
      rootCause: manual
        ? `${plural(waiting.length, "claim")} use this class, which doesn't create volumes automatically, so they wait for someone to create matching volumes.`
        : `${plural(waiting.length, "claim")} using this class ${waiting.length === 1 ? "has" : "have"} waited over 5 minutes without being given a volume.`,
      evidence: waiting.slice(0, 10).map((c) => key(c)).concat(waiting.length > 10 ? [`…and ${waiting.length - 10} more`] : []),
      remediation: manual
        ? ["Create PersistentVolumes that match those claims (size, access mode and this storage class)."]
        : [
            `Check that the driver named by this class (${sc.provisioner ?? "provisioner"}) is running. Its pods are usually in kube-system.`,
            "Open one of the claims and read its Diagnostics tab for the specific error.",
          ],
    });
  }
  return out;
}
