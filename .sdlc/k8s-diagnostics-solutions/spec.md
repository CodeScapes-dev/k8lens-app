# Spec: Kubernetes Issue Diagnostics & Solutions

## Requirements

**R1. Diagnostics module.** A new deterministic module, `lib/k8s/diagnostics.js`, exporting a single entry point:
```js
diagnoseResource(resourceType, data) // resourceType: "pod" | "deployment" | "statefulset" | "daemonset"
// → Diagnosis[] (empty array if nothing wrong)
// Diagnosis = { id, issue, severity: "Critical"|"Warning", rootCause, evidence: string[], remediation: string[] }
```
No network/LLM calls anywhere in this module or its call path — pure functions over already-fetched Kubernetes objects.

**R2. Rule category 1 — CrashLoopBackOff root-causing.** For a pod (or a workload's pods) with a container in `waiting.reason === "CrashLoopBackOff"` or with `restartCount` climbing on a recently-created pod:
- Inspect `lastState.terminated` (`reason`, `exitCode`, `message`) on each container/init-container status.
- Inspect Warning events on the pod for kubelet config-resolution failures (`reason` of `Failed`/`FailedMount`/`FailedCreatePodContainer`, or messages naming a ConfigMap/Secret/key).
- Classify into one of: **OOMKilled** (`terminated.reason === "OOMKilled"`), **ConfigMap/Secret misconfiguration** (event or termination message references a missing ConfigMap/Secret/key, or the pod spec's `envFrom`/`env[].valueFrom`/volume references a ConfigMap or Secret name not resolvable from the message), or **application-level crash** (non-zero exit code with no config-related signal — report the exit code/signal and defer to logs, do not guess an app-code cause).
- Init containers are included, not just the main containers (a stuck init container is a common cause of an apparently "Pending-looking" pod that's actually crash-looping).

**R3. Rule category 2 — Pending-pod scheduling-mismatch diagnosis.** For a pod with `status.phase === "Pending"` and no `spec.nodeName` assigned:
- Fetch the cluster's node list (new data requirement — see R4) and cross-reference the pod's `spec.nodeSelector`, `spec.affinity.nodeAffinity`, and `spec.tolerations` **structurally** against each node's `metadata.labels` and `spec.taints`.
- Produce a per-constraint breakdown: for each `nodeSelector`/`matchExpressions` term, how many of N nodes satisfy it; for each node taint with no matching pod toleration, how many nodes are excluded and by which taint (key/value/effect).
- Use the pod's own `FailedScheduling` Warning event (if present and not yet TTL'd out) as corroborating evidence text only — not as the source of truth for the logic (see "Design decisions" on why).
- Where the shortfall isn't a selector/taint mismatch at all (e.g. insufficient CPU/memory reported by the scheduler), surface the scheduler's own `FailedScheduling` message verbatim rather than fabricating a structural explanation the module can't compute from labels/taints alone.

**R4. Data availability.** `app/api/k8s/detail/route.jsx`'s `pod` handler must additionally fetch the node list via `clients.core.listNode()` **only when** the pod is `Pending` with no `nodeName` (avoid the extra cluster-wide call on the common healthy-pod path). Same conditional applies to the `deployment`/`statefulset`/`daemonset` handlers: fetch nodes only if any pod in the already-fetched `pods` array is Pending. The node fetch uses `Promise.allSettled` (existing pattern in this file) and degrades gracefully (diagnostics falls back to event-message-only reporting) if the credentials lack cluster-scoped `nodes` list permission — this must not break the rest of the detail payload.

**R5. UI — detail-page panel.** A new `Diagnostics` section, following the `Panel`/`KLBadge`/`KLStatus` convention from `components/kl/*` (per the codebase's dominant styling convention — not shadcn `Alert`/`Card`), inserted into `components/pod-detail/tabs/OverviewTab.jsx` (pod detail) and the equivalent Overview tabs for Deployment/StatefulSet/DaemonSet detail pages. It renders only when `diagnoseResource(...)` returns a non-empty array; each `Diagnosis` renders as: issue title + severity badge, root cause line, evidence (collapsible list of the raw signals used), and a remediation list. No "healthy" empty-state clutter — the panel simply doesn't render when there's nothing to report (distinct from `HealthPanel`, which always shows a score).

**R6. Consolidation with existing rule engines.** `lib/k8s/health-score.js`'s `HighRestartCount`/`OOMKilled`/`StuckInPending` signal detection and `dashboard-aggregations.js`'s `aggregatePodRestarts`/`buildUnhealthyWorkloads` CrashLoopBackOff detection must be refactored to call shared evidence-extraction helpers exported from `diagnostics.js` (e.g. `isOomKilled(containerStatuses, events)`, `classifyCrashLoop(pod, events)`) instead of re-implementing the same checks inline. `Recommendations.jsx` is **not** touched — its `RULES` are proactive best-practice hygiene checks (missing limits/probes/PDB, stale secrets, RBAC wildcards), a genuinely different concern from reactive root-cause diagnosis of an already-broken resource, and has near-zero logic overlap with R2/R3 on inspection. See Non-goals.

## Design decisions

- **Structural cross-reference over event-message parsing, for Pending diagnosis.** The scheduler's `FailedScheduling` event message is human-readable prose that varies across Kubernetes/scheduler-plugin versions and isn't a stable contract to parse for *logic*. Comparing `nodeSelector`/`affinity`/`tolerations` directly against fetched node objects is version-independent and testable with fixtures. The event message is still shown to the user as corroborating evidence (kubelet/scheduler's own words carry credibility), just not relied on for correctness.
- **Two severities only** (`Critical`, `Warning`) rather than importing `health-score.js`'s penalty-point model — diagnostics answers "what's wrong and what do I do", not "what's my score", so it deliberately doesn't reuse that model's numeric scoring.
- **Conditional node fetch, not unconditional.** Fetching all cluster nodes on every pod-detail page view would be wasteful (and, on large clusters, slow) for the common case of a healthy/Running pod. Gating on `Pending` keeps the cost paid only when relevant.
- **Consolidation is at the evidence-extraction layer, not the output-shape layer.** `health-score.js` returns `{score, signals}` for a numeric badge; `diagnostics.js` returns `{issue, rootCause, evidence, remediation}` for a human-readable panel. Unifying these into one shape would be a larger, riskier UI change (touching `HealthPanel`, `HealthBadge`, and every page that renders a health score) that isn't needed to satisfy the user's actual ask. Sharing the *detection* functions (does this pod look OOMKilled? is it crash-looping?) removes the duplication risk without that blast radius.
- **JS, not TypeScript**, matching the rest of the repo (no `.ts`/`.tsx` in this codebase, `components.json` has `"tsx": false"`). Diagnosis/evidence shapes are documented via a JSDoc `@typedef` comment in `diagnostics.js`, not enforced by a type system.
- **Eager computation, not on-demand.** `diagnoseResource()` runs synchronously on data the detail page already has in memory (no separate "Diagnose" button/API round-trip) — it's cheap (no I/O of its own; the one new I/O cost is the conditional node fetch in R4, already inside the existing detail-fetch waterfall). This matches how `health-score.js` and `Recommendations.jsx` already work today.

## Non-goals

- **No LLM/AI integration** of any kind, anywhere in this feature — hard constraint carried from intent.md.
- **No cluster-wide "Issues" rollup page.** Explicitly deferred per reviewer decision on intent.md; this spec covers only the per-resource detail-page panel.
- **No auto-remediation / "Apply fix" actions.** Remediation is textual guidance only. k8lens-app is read-only; this feature must not add its first write path.
- **No merging of `health-score.js` / `Recommendations.jsx` output shapes or UI** into the new Diagnostics panel — only their overlapping *detection logic* is shared (R6).
- **No rule categories beyond CrashLoopBackOff root-cause and Pending scheduling-mismatch in this pass.** ImagePullBackOff-specific messaging, failing (as opposed to missing) probes, unbound PVCs, and Service-with-no-endpoints root-causing are real, valuable follow-ups but out of scope for this spec — `diagnostics.js`'s module shape (an array of independent rule functions dispatched by resource type) should make adding them straightforward later, but none are built now.
- **No Service, Node, or PVC diagnostics** in this pass — scope is Pod + the three ReplicaSet-owning workload kinds (Deployment/StatefulSet/DaemonSet), matching the two MVP examples.

## Edge cases

- **Multi-container pods where only one container crash-loops**: report per-container, not pod-wide — the panel must name which container.
- **Init container crash-looping**: covered by R2 (init container statuses inspected); the remediation text should note it's an init container, since the fix location differs (init container spec, not the main container).
- **Kubernetes event TTL** (default ~1h in most clusters): a pod Pending for hours may have no surviving `FailedScheduling` event. Diagnosis must still work from the structural node cross-reference alone (R2/R3 design decision) — the "evidence" list simply omits the event line rather than failing.
- **RBAC-limited credentials**: if the connected cluster's credentials can't `list nodes` (namespace-scoped viewer), the node fetch fails; diagnostics for Pending pods falls back to whatever it can say from the pod spec + any surviving event, rather than crashing the detail page or silently returning nothing with no explanation. The panel should say "couldn't verify against live node state" in that case rather than pretending the check ran clean.
- **No nodes at all fail the check** (pod is Pending for a totally different reason, e.g. PVC not bound, insufficient resources cluster-wide): don't force a nodeSelector/affinity narrative when none of the constraints actually exclude any nodes — fall through to surfacing the scheduler's own message (per R3's last bullet) rather than outputting a false "no mismatch found" panel that looks broken.
- **Pod not yet scheduled but very young** (a few seconds old, normal scheduling latency): must not fire prematurely — reuse `health-score.js`'s existing "≥5 minutes" age threshold convention for Pending rather than firing instantly, so a normal deployment rollout doesn't get flagged as broken while pods are still catching up.
- **CrashLoopBackOff with no Warning events at all and exit code 0**: contradictory-looking signal (a clean-exit container shouldn't crash-loop, but ephemeral race conditions exist) — report exit code 0 plainly and note it's unusual rather than mis-inferring a cause.

## Flagged concerns

- **RBAC/permission surface**: this feature is the first thing in the detail-fetch path that needs a *cluster-scoped* `list nodes` call from a page that's otherwise namespace-scoped (pod detail). Needs sign-off that this doesn't regress the experience for RBAC-restricted viewers (must degrade, not error — see Edge cases).
- **Kubelet/scheduler message-string dependency for evidence display** (not logic — see Design decisions): the *displayed* evidence text still quotes kubelet/scheduler event messages, which aren't a versioned API contract and could shift wording across Kubernetes versions. Low risk since it's evidence, not the driver of remediation text, but worth a reviewer's awareness.
- **No secret/configmap *values* are ever surfaced** — CrashLoop diagnosis names ConfigMap/Secret/key *names* only, never contents, consistent with the app's existing read-only, non-sensitive-data posture (worth an explicit security-review confirmation given Secrets are directly implicated by R2).
- **Performance on very large clusters** (many nodes): the conditional node fetch (R4) is bounded by "only when Pending," but a cluster with thousands of nodes could make that one fetch itself slow. Not blocking for MVP but worth noting for future pagination/field-selector optimization.

## Acceptance criteria

1. A pod in CrashLoopBackOff due to a missing ConfigMap key shows: issue "CrashLoopBackOff", root cause naming the specific ConfigMap and key, remediation instructing the user to add the key to the ConfigMap or fix the pod's reference.
2. A pod in CrashLoopBackOff due to the app exiting non-zero with no config-related event shows the exit code/termination reason and points to the Logs tab, without asserting a specific unverifiable app-code cause.
3. A pod OOMKilled shows "OOMKilled" distinctly from generic CrashLoopBackOff, with remediation suggesting a memory limit increase or investigating the memory leak.
4. A pod stuck Pending due to an unmatched `nodeSelector` names the exact key/value and how many of N nodes lack it; remediation offers both options (label a node, or relax the selector).
5. A pod stuck Pending due to a taint with no matching toleration names the taint (key/value/effect) and how many nodes carry it; remediation offers both options (add a toleration, or remove/adjust the taint).
6. A healthy pod (Running, no crash-loop, not Pending) renders no Diagnostics panel content.
7. `diagnostics.js` and its call path make zero network requests other than the Kubernetes API calls already part of the existing detail-fetch flow — verifiable by code review (no `fetch` to any external/inference endpoint).
8. After refactor, `health-score.js`'s existing signals (`HighRestartCount`, `OOMKilled`, `StuckInPending`, etc.) and `dashboard-aggregations.js`'s `buildUnhealthyWorkloads()` produce the same output shape and equivalent results as before the refactor (no behavior regression) — verified by comparing before/after output against the same fixture pod/event data.
9. A credentials set without cluster-scoped `list nodes` permission does not break the pod detail page; the Pending-diagnosis portion degrades to a "couldn't verify against live node state" message instead of throwing or silently omitting explanation.

---
*Derived from intent.md (2026-09-23). Status: draft — pending review.*
