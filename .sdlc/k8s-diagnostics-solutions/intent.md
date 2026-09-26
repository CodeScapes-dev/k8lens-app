# Intent: Kubernetes Issue Diagnostics & Solutions

## Problem
k8lens-app already surfaces *that* something is wrong (status badges, health scores, recommendation banners, the events feed), but it stops short of telling a user *why* it's wrong and *what to do about it*. Today there are three separate, overlapping rule-based signal systems in the repo (`lib/k8s/health-score.js`, `components/recommendations/Recommendations.jsx`, `lib/k8s/dashboard-aggregations.js`'s `buildUnhealthyWorkloads()`), none of which perform root-cause analysis or give a concrete corrective action. A user who sees "CrashLoopBackOff" or "Pending" still has to manually cross-reference the pod spec, the node labels/taints, events, and ConfigMaps/Secrets themselves to figure out what's actually broken.

The vast majority of real-world Kubernetes failures fall into a small, well-documented set of known patterns (bad image reference, missing/misnamed ConfigMap or Secret, non-zero exit code, OOMKill, scheduling constraint mismatch, unbound PVC, failing probe, etc.). These don't require an LLM to diagnose — they require reading the right fields off objects k8lens-app is already fetching, and applying known-pattern logic.

## Proposed outcome
A deterministic, rule-based "Diagnostics" capability that, given a workload/pod already stuck in a bad state, tells the user:
1. **What's wrong** (a plain-language issue name, e.g. "Pod stuck in CrashLoopBackOff").
2. **Why** (the specific root cause found in this cluster's data — e.g. "container `app` exited with code 1; last 3 restarts all failed within 10s of start" or "no node matches nodeSelector `disktype=ssd`; 3 nodes are missing that label, 2 more are tainted `NoSchedule`").
3. **What to do about it** (a concrete corrective action grounded in the actual mismatch found, not a generic tip — e.g. "add label `disktype=ssd` to a node, or add a toleration for taint `dedicated=gpu:NoSchedule` to the pod spec").

MVP scope (per the user's own examples): 
- CrashLoopBackOff root-causing on Pods/Deployments — distinguish ConfigMap/Secret misconfiguration (missing/renamed ref) from an application-level crash (non-zero exit code / OOMKilled / signal).
- Pending-pod scheduling-mismatch diagnosis — compare pod's nodeSelector/affinity/anti-affinity/tolerations against actual cluster node labels/taints and explain precisely why no node is schedulable.

This should consolidate with, not duplicate, the three existing rule engines — ideally becoming (or feeding) their shared foundation rather than a fourth parallel system.

## Affected users / systems
- **Users**: anyone using k8lens-app to monitor a cluster (SRE/platform engineers, developers debugging their own deployments) — read-only, no cluster mutation.
- **Systems touched**: `lib/k8s/*` (new/consolidated rule engine), `app/api/k8s/**` (data the detail endpoint already returns should be sufficient — TBD in spec), pod/workload detail pages (`components/pod-detail/tabs/*`, deployment detail equivalents), possibly a new cluster-wide "Issues" view analogous to `app/cluster/events/page.jsx`. No changes to cluster write-permissions — k8lens-app remains strictly read-only, this feature only reads more cleverly.

## Constraints
- **No LLM/AI integration** — must be fully deterministic, rule-based pattern matching against known K8s failure modes. This is an explicit design constraint from the user, not just an MVP shortcut.
- Must respect the app's read-only posture — diagnostics can recommend actions (e.g. "add this label to the node") but must not execute them.
- Must work within the existing data-fetching architecture (Route Handlers + `@kubernetes/client-node`, no Server Actions) and the existing `--kl-*` / `components/kl/` UI convention rather than introducing a new design system.
- Should avoid adding a *fourth* independent rule-signal system — spec.md must address how this relates to/replaces `health-score.js`, `Recommendations.jsx`, and `dashboard-aggregations.js`.
- This version of Next.js (16.3.5) is noted in `AGENTS.md` as having breaking changes from training-data assumptions — implementation must be verified against `node_modules/next/dist/docs/` before code is written, not assumed.

## Open questions

**Resolved by reviewer (2026-09-23):**
- **UI placement**: a detail-page panel — a new "Diagnostics" tab/section on pod & workload detail pages (`components/pod-detail/tabs/*` and deployment/statefulset/daemonset detail equivalents). A cluster-wide rollup page is explicitly deferred, not in scope for this feature.
- **Consolidation**: land as one new shared rule engine now. A single new module (e.g. `lib/k8s/diagnostics.js`) becomes the deterministic source of truth for these checks; `health-score.js` and `Recommendations.jsx` should call into it for overlapping checks (crash-loop, OOMKilled, Pending) rather than keeping duplicate logic. This is in scope for this feature, not deferred — spec.md must define exactly what each existing engine keeps vs. delegates.

**Still open — carried into spec.md:**
- Beyond the two MVP rule categories (CrashLoopBackOff root-cause, Pending scheduling-mismatch), what's the priority-ordered list of "next" rule categories (ImagePullBackOff, OOMKilled as its own category vs. sub-case of CrashLoop, failing liveness/readiness probes, unbound/pending PVCs, Service-with-no-endpoints, etc.)? Full catalog belongs in spec.md but the MVP boundary needs explicit sign-off there.
- Should diagnostics run eagerly (computed whenever a pod/workload is fetched, like health-score today) or on-demand (user clicks "Diagnose" on an already-unhealthy resource)? Affects perf and API shape.
- Does the existing `app/api/k8s/detail/route.js` payload (pod/deployment + events + pdb/hpa/endpoints) already include node objects with labels/taints needed for the Pending-pod scheduling check, or does that need a new/extended endpoint? Needs verification in spec.md.

---
*Captured: 2026-09-23. Status: approved — UI placement and consolidation approach confirmed by reviewer; remaining open questions carried into spec.md.*
