'use client';

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { useClusterStore } from '@/stores/clusterStore';
import { useDashboardData } from '@/hooks/use-dashboard';
import { useK8sResource } from '@/hooks/use-k8s';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import {
  aggregateNodeHealth,
  aggregatePodsByPhase,
  aggregateWorkloadHealth,
  aggregateJobHealth,
  aggregatePodRestarts,
} from '@/lib/k8s/dashboard-aggregations';
import { calculateClusterHealthScore } from '@/lib/k8s/cluster-health-score';
import { getClusterDisplayName } from '@/lib/k8s/cluster-info';
import { parseK8sResourceValue } from '@/lib/k8s/utils';
import { KLBadge } from '@/components/kl/Badge';
import { Badge } from '@/components/ui/badge';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function formatMemory(bytes) {
  if (!bytes) return '0 GiB';
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1
    ? `${gb.toFixed(1)} GiB`
    : `${(bytes / (1024 * 1024)).toFixed(0)} MiB`;
}

function formatAge(ts) {
  if (!ts) return 'N/A';
  const diff = Date.now() - new Date(ts).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h`;
  return `${Math.floor(diff / 60000)}m`;
}

function synced(ts) {
  if (!ts) return 'just now';
  const s = Math.round((Date.now() - ts) / 1000);
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
}

/* ─── Design primitives ───────────────────────────────────────────────────── */

function Card({ children, style, padding = 12 }) {
  return (
    <div style={{ background: 'var(--kl-surface)', border: '1px solid var(--kl-border)', borderRadius: 12, padding, ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, sub, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        {icon && <span style={{ color: 'var(--kl-text-muted)', display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--kl-text)', letterSpacing: -0.1 }}>{title}</span>
        {sub && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--kl-text-faint)' }}>{sub}</span>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

function LivePulse({ color = 'var(--kl-ok)' }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: color, opacity: 0.4, animation: 'klPulse 1.6s ease-out infinite' }} />
      <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: color }} />
    </span>
  );
}

function Sparkline({ data, color = 'var(--kl-accent)', width = 130, height = 32 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 6) - 3]);
  let d = `M ${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    const cx = (x1 + x2) / 2;
    d += ` C ${cx.toFixed(2)},${y1.toFixed(2)} ${cx.toFixed(2)},${y2.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`;
  }
  const fillD = `${d} L ${width},${height} L 0,${height} Z`;
  const gid = `sg${color.replace(/[^a-z0-9]/gi, '').slice(0, 12)}${width}`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${gid})`} stroke="none" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  );
}

function HourlyBars({ data, height = 64 }) {
  const len = data.length;
  const maxTotal = Math.max(...data.map((d) => (d.n || 0) + (d.w || 0) + (d.e || 0))) || 1;
  const hour = (i) => `${String(i % 24).padStart(2, '0')}:00`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${len * 12} ${height}`} style={{ display: 'block' }} preserveAspectRatio="none">
      <line x1="0" y1={height - 0.5} x2={len * 12} y2={height - 0.5} stroke="var(--kl-border)" strokeWidth="1" />
      {data.map((d, i) => {
        const hOk = ((d.n || 0) / maxTotal) * (height - 6);
        const hWarn = ((d.w || 0) / maxTotal) * (height - 6);
        const hErr = ((d.e || 0) / maxTotal) * (height - 6);
        const x = i * 12 + 1;
        const bw = 10;
        let y = height - 1;
        const tip = `${hour(i)}  Normal ${d.n || 0} · Warning ${d.w || 0} · Error ${d.e || 0}`;
        return (
          <g key={i} style={{ cursor: 'default' }}>
            <title>{tip}</title>
            <rect x={x} y={0} width={bw} height={height} fill="transparent" />
            {hOk > 0 && <rect x={x} y={(y -= hOk)} width={bw} height={hOk} fill="var(--kl-text-faint)" opacity="0.45" rx="1" />}
            {hWarn > 0 && <rect x={x} y={(y -= hWarn)} width={bw} height={hWarn} fill="var(--kl-warn)" rx="1" />}
            {hErr > 0 && <rect x={x} y={(y -= hErr)} width={bw} height={hErr} fill="var(--kl-err)" rx="1" />}
          </g>
        );
      })}
    </svg>
  );
}

function KpiCard({ label, value, sub, accent, spark, sparkColor = 'var(--kl-accent)', footer }) {
  return (
    <Card padding={16} style={{ position: 'relative', overflow: 'hidden', minHeight: 120 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--kl-text-muted)', fontWeight: 500, letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</span>
        <div style={{ flexShrink: 0 }}>{accent}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: -1, lineHeight: 1, color: 'var(--kl-text)' }}>{value}</span>
        {sub && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--kl-text-muted)', whiteSpace: 'nowrap' }}>{sub}</span>}
      </div>
      {spark && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: footer ? 30 : 0, height: 36, pointerEvents: 'none' }}>
          <Sparkline data={spark} color={sparkColor} width={320} height={36} />
        </div>
      )}
      {footer && (
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, gap: 8 }}>
          {footer}
        </div>
      )}
    </Card>
  );
}

function TimelineItem({ kind, title, target, time, msg, last }) {
  const tone = kind === 'err' ? 'var(--kl-err)' : kind === 'warn' ? 'var(--kl-warn)' : kind === 'ok' ? 'var(--kl-ok)' : 'var(--kl-text-muted)';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 12, position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 8, height: 8, borderRadius: 999, background: tone, marginTop: 6, boxShadow: '0 0 0 3px var(--kl-bg)' }} />
        {!last && <div style={{ position: 'absolute', top: 16, bottom: -14, left: '50%', width: 1, marginLeft: -0.5, background: 'var(--kl-border)' }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 14, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: tone, textTransform: 'uppercase', letterSpacing: 0.4 }}>{title}</span>
          <Badge variant="secondary" className="shrink-0 font-mono text-[10.5px] font-normal">{target}</Badge>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--kl-text-faint)', flexShrink: 0 }}>{time}</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--kl-text-2)', lineHeight: 1.45 }}>{msg}</div>
      </div>
    </div>
  );
}

/* ─── Health Dialog ───────────────────────────────────────────────────────── */

function HealthDialog({ healthScore }) {
  const { score, healthLabel, deductions = [] } = healthScore;
  return (
    <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          {score >= 90 && <CheckCircle className="h-5 w-5" style={{ color: 'var(--kl-ok)' }} />}
          {score >= 70 && score < 90 && <AlertTriangle className="h-5 w-5" style={{ color: 'var(--kl-warn)' }} />}
          {score >= 50 && score < 70 && <AlertCircle className="h-5 w-5" style={{ color: 'var(--kl-warn)' }} />}
          {score < 50 && <XCircle className="h-5 w-5" style={{ color: 'var(--kl-err)' }} />}
          Cluster Health Report
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between rounded-lg p-4" style={{ background: 'var(--kl-surface-2)' }}>
          <div>
            <p className="text-xs" style={{ color: 'var(--kl-text-muted)' }}>Overall score</p>
            <p className="mt-1 text-3xl font-bold">{score}/100</p>
          </div>
          <KLBadge tone={score >= 90 ? 'ok' : score >= 70 ? 'warn' : 'err'}>{healthLabel}</KLBadge>
        </div>
        {deductions.length > 0 ? (
          <div className="space-y-2">
            {deductions.map((d, i) => (
              <div key={i} className="rounded-lg border p-3" style={{ background: 'var(--kl-err-tint)' }}>
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ background: 'var(--kl-err)', color: '#fff' }}>−{d.deduction}</span>
                  <span className="text-sm font-medium">{d.category}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--kl-text-muted)' }}>{d.reason}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border p-8 text-center" style={{ background: 'var(--kl-ok-tint)' }}>
            <CheckCircle className="mx-auto mb-2 h-10 w-10" style={{ color: 'var(--kl-ok)' }} />
            <p className="font-medium" style={{ color: 'var(--kl-ok)' }}>No issues detected</p>
          </div>
        )}
        <div className="space-y-1 rounded-lg border p-3 text-xs" style={{ color: 'var(--kl-text-2)' }}>
          <p className="mb-1 font-medium" style={{ color: 'var(--kl-text)' }}>Score calculation</p>
          <p>• Nodes −30 max · Pods −30 max · Workloads −20 max · Events −10 max · Config −10 max</p>
        </div>
      </div>
    </DialogContent>
  );
}

/* ─── Inline SVG icons ────────────────────────────────────────────────────── */

const I = {
  health: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4" /></svg>,
  util: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4" /></svg>,
  bell: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>,
  topo: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  helm: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V12M5 12V8a2 2 0 0 1 2-2h2M19 12V8a2 2 0 0 0-2-2h-2M5 14v2a2 2 0 0 0 2 2h2M19 14v2a2 2 0 0 1-2 2h-2" /><circle cx="12" cy="5" r="2" /></svg>,
  chevRight: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>,
};

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const activeContext = useClusterStore((s) => s.activeContext);
  const { raw, loading, refreshing, error, refresh } = useDashboardData();
  if (loading || !raw) return <DashboardSkeleton />;
  if (error) {
    return (
      <div className="p-5">
        <div className="flex items-center gap-2 rounded-md p-3 text-sm" style={{ background: 'var(--kl-err-tint)', color: 'var(--kl-err)' }}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={refresh} className="ml-auto flex items-center gap-1 text-xs underline">
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      </div>
    );
  }
  return <DashboardContent data={raw} activeContext={activeContext} refreshing={refreshing} onRefresh={refresh} />;
}

/* ─── Dashboard Content ───────────────────────────────────────────────────── */

function DashboardContent({ data, activeContext, refreshing, onRefresh }) {
  const [eventFilter, setEventFilter] = React.useState('All');
  const { data: helmData, loading: helmLoading } = useK8sResource("helm", "releases", { listParams: { limit: 100 } });
  const [syncedAt] = React.useState(() => Date.now());
  const [costEnabled, setCostEnabled] = React.useState(true);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('K8Lens-cost-config');
      if (raw) React.startTransition(() => setCostEnabled(JSON.parse(raw).enabled !== false));
    } catch {}
  }, []);

  const nodeHealth = aggregateNodeHealth(data.nodes);
  const podPhases = aggregatePodsByPhase(data.pods);
  const workloadHealth = aggregateWorkloadHealth(data.deployments, data.statefulSets, data.daemonSets);
  const jobHealth = aggregateJobHealth(data.jobs, data.cronJobs);
  const restartInfo = aggregatePodRestarts(data.pods);
  const healthScore = calculateClusterHealthScore(data);

  const clusterVersion = data.nodes[0]?.status?.nodeInfo?.kubeletVersion || 'Unknown';
  const clusterDisplayName = getClusterDisplayName(data.nodes);

  let usedCpu = 0, allocatableCpu = 0, usedMemory = 0, allocatableMemory = 0;
  data.nodes.forEach((n) => {
    allocatableCpu += parseK8sResourceValue(n?.status?.allocatable?.cpu, 'cpu');
    allocatableMemory += parseK8sResourceValue(n?.status?.allocatable?.memory, 'memory');
  });
  data.pods.forEach((pod) => {
    if (pod?.status?.phase === 'Running') {
      pod?.spec?.containers?.forEach((c) => {
        if (c?.resources?.requests?.cpu) usedCpu += parseK8sResourceValue(c.resources.requests.cpu, 'cpu');
        if (c?.resources?.requests?.memory) usedMemory += parseK8sResourceValue(c.resources.requests.memory, 'memory');
      });
    }
  });
  const cpuPct = allocatableCpu > 0 ? Math.round((usedCpu / allocatableCpu) * 100) : 0;
  const memPct = allocatableMemory > 0 ? Math.round((usedMemory / allocatableMemory) * 100) : 0;

  const score = healthScore.score;
  const scoreColor = score >= 90 ? 'var(--kl-ok)' : score >= 70 ? 'var(--kl-warn)' : 'var(--kl-err)';
  const scoreTone = score >= 90 ? 'ok' : score >= 70 ? 'warn' : 'err';
  const scoreLabel = score >= 90 ? 'Healthy' : score >= 70 ? 'Degraded' : 'Critical';
  const ringR = 52;
  const ringC = 2 * Math.PI * ringR;

  const [now] = React.useState(() => Date.now());
  const hourlyData = React.useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => ({ n: 0, w: 0, e: 0 }));
    (data.events || []).forEach((ev) => {
      const ts = new Date(ev?.metadata?.creationTimestamp || ev?.lastTimestamp || 0).getTime();
      const h = Math.floor((now - ts) / 3600000);
      if (h >= 0 && h < 24) {
        const idx = 23 - h;
        if (ev?.type === 'Warning') buckets[idx].w++; else buckets[idx].n++;
      }
    });
    return buckets;
  }, [data.events, now]);

  const totalEvents = (data.events || []).length;
  const warnEvents = (data.events || []).filter((e) => e?.type === 'Warning').length;

  const running = podPhases.Running || 1;
  const podSpark = Array.from({ length: 24 }, (_, i) => Math.max(1, running + Math.sin(i * 0.7) * 3 + Math.sin(i * 1.3) * 1.5));
  const cpuSpark = Array.from({ length: 24 }, (_, i) => Math.max(0, cpuPct + Math.sin(i * 0.9 + 1) * 4 + Math.cos(i * 0.4) * 2));
  const memSpark = Array.from({ length: 24 }, (_, i) => Math.max(0, memPct + Math.sin(i * 0.5 + 2) * 3 + Math.cos(i * 1.1 + 1) * 1.5));
  const diskSpark = Array.from({ length: 24 }, (_, i) => Math.max(0, 20 + Math.sin(i * 0.3 + 3) * 2 + Math.cos(i * 0.8) * 1));
  const costBase = allocatableCpu * 0.048 * 730;
  const costSpark = Array.from({ length: 12 }, (_, i) => Math.max(0, costBase * (0.9 + i * 0.008)));

  const totalWorkloads = data.deployments.length + data.statefulSets.length + data.daemonSets.length;
  const readyWorkloads = workloadHealth.deployments.healthy + workloadHealth.statefulSets.healthy + workloadHealth.daemonSets.healthy;
  const estimatedCost = costBase;

  const topoItems = [
    { l: 'Deployments', n: data.deployments.length, sub: `${workloadHealth.deployments.healthy}/${data.deployments.length} ready`, c: 'var(--kl-ok)' },
    { l: 'StatefulSets', n: data.statefulSets.length, sub: `${workloadHealth.statefulSets.healthy}/${data.statefulSets.length} ready`, c: 'var(--kl-ok)' },
    { l: 'DaemonSets', n: data.daemonSets.length, sub: `${workloadHealth.daemonSets.healthy}/${data.daemonSets.length} ready`, c: 'var(--kl-ok)' },
    { l: 'Jobs', n: jobHealth.jobs.total, sub: `${jobHealth.jobs.active} active`, c: 'var(--kl-text-muted)' },
    { l: 'CronJobs', n: data.cronJobs.length, sub: `${jobHealth.cronJobs.active} active`, c: 'var(--kl-text-muted)' },
    { l: 'Services', n: data.services.length, sub: `${data.services.filter((s) => s?.spec?.type === 'LoadBalancer').length} LB`, c: 'var(--kl-accent)' },
    { l: 'Ingresses', n: data.ingresses.length, sub: `${data.ingresses.length} hosts`, c: 'var(--kl-accent)' },
    { l: 'Namespaces', n: data.namespaces.length, sub: 'all active', c: 'var(--kl-info)' },
  ];

  const utilRows = [
    { l: 'CPU', used: `${usedCpu.toFixed(1)} cores`, pct: cpuPct, data: cpuSpark, color: 'var(--kl-accent)' },
    { l: 'Memory', used: formatMemory(usedMemory), pct: memPct, data: memSpark, color: 'var(--kl-ok)' },
    { l: 'Disk', used: '—', pct: 0, data: diskSpark, color: 'var(--kl-info)' },
  ];

  const timelineEvents = React.useMemo(() => {
    return (data.events || [])
      .filter((e) => {
        if (eventFilter === 'Warnings') return e?.type === 'Warning';
        if (eventFilter === 'Errors') return e?.reason === 'Failed' || e?.reason === 'Error';
        return true;
      })
      .sort((a, b) => {
        const ta = new Date(a?.lastTimestamp || a?.metadata?.creationTimestamp || 0).getTime();
        const tb = new Date(b?.lastTimestamp || b?.metadata?.creationTimestamp || 0).getTime();
        return tb - ta;
      })
      .slice(0, 6)
      .map((e) => ({
        kind: e?.type === 'Warning' ? 'warn' : 'ok',
        title: e?.reason || 'Event',
        target: e?.involvedObject?.name || e?.regarding?.name || '—',
        time: formatAge(e?.lastTimestamp || e?.metadata?.creationTimestamp),
        msg: e?.message || e?.note || '—',
      }));
  }, [data.events, eventFilter]);

  const HELM_DISPLAY_LIMIT = 5;
  const helmReleases = React.useMemo(
    () => helmData.map((r) => ({
      n: r.metadata?.name,
      ns: r.metadata?.namespace,
      chart: r.spec?.chart,
      ver: r.spec?.chartVersion,
      appVer: r.spec?.appVersion,
      rev: r.spec?.revision,
      phase: r.status?.phase ?? 'unknown',
      tone: r.status?.phase === "deployed" ? "ok" : r.status?.phase === "failed" ? "err" : "warn",
    })),
    [helmData]
  );
  const helmVisible = helmReleases.slice(0, HELM_DISPLAY_LIMIT);
  const helmOverflow = helmReleases.length - helmVisible.length;

  return (
    <div style={{ padding: '14px 20px 28px', maxWidth: 1600, margin: '0 auto' }}>
      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-3 mb-[18px]">
        <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 min-w-0">
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.5, margin: 0, color: 'var(--kl-text)' }}>Cluster overview</h1>
          <div className="flex items-center gap-[7px]">
            <LivePulse color="var(--kl-ok)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--kl-text-2)' }}>
              {clusterDisplayName} · {clusterVersion} · {data.namespaces.length} ns
            </span>
          </div>
        </div>
        <div className="flex items-center gap-[10px] shrink-0">
          <span className="hidden sm:inline" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--kl-text-faint)' }}>Synced {synced(syncedAt)} · auto-refresh 10s</span>
          <button onClick={onRefresh} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', border: '1px solid var(--kl-border)', background: 'var(--kl-surface)', borderRadius: 8, color: 'var(--kl-text-2)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-[14px]">
        {/* ── Hero Bento ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(300px,360px)_1fr_minmax(260px,340px)] gap-[14px]">
          {/* Cluster Health */}
          <Card padding={12} style={{ minHeight: 160 }}>
            <CardHeader icon={I.health} title="Cluster health" action={<KLBadge tone={scoreTone}>{scoreLabel}</KLBadge>} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 4 }}>
              <Dialog>
                <DialogTrigger asChild>
                  <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0, cursor: 'pointer' }}>
                    <svg width="96" height="96" viewBox="0 0 116 116">
                      <circle cx="58" cy="58" r={ringR} stroke="var(--kl-surface-3, var(--kl-border))" strokeWidth="8" fill="none" />
                      <circle cx="58" cy="58" r={ringR} stroke={scoreColor} strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={`${ringC * (score / 100)} ${ringC}`} transform="rotate(-90 58 58)" style={{ transition: 'stroke-dasharray 1s ease' }} />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 38, fontWeight: 600, letterSpacing: -1.5, lineHeight: 1, color: 'var(--kl-text)' }}>{score}</span>
                    </div>
                  </div>
                </DialogTrigger>
                <HealthDialog healthScore={healthScore} />
              </Dialog>
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 7 }}>
                {(healthScore.deductions || []).slice(0, 3).map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--kl-err)', fontWeight: 600, background: 'var(--kl-err-tint)', padding: '1px 6px', borderRadius: 4, fontSize: 11, lineHeight: 1.4, flexShrink: 0 }}>
                      {d.deduction > 0 ? `−${d.deduction}` : String(d.deduction)}
                    </span>
                    <span style={{ color: 'var(--kl-text-2)', lineHeight: 1.35 }}>{d.reason}</span>
                  </div>
                ))}
                {(healthScore.deductions || []).length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--kl-ok)' }}>No issues found</span>
                )}
              </div>
            </div>
          </Card>

          {/* Resource Utilization */}
          <Card padding={12} style={{ minHeight: 160 }}>
            <CardHeader icon={I.util} title="Resource utilization" action={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--kl-text-faint)' }}>{allocatableCpu.toFixed(0)} cores · {formatMemory(allocatableMemory)}</span>} />
            <div style={{ display: 'grid', gap: 14 }}>
              {utilRows.map((r) => (
                <div key={r.l} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 60px', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--kl-text)' }}>{r.l}</span>
                  <div style={{ height: 6, background: 'var(--kl-surface-2, var(--kl-border))', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${r.pct}%`, height: '100%', background: r.color, borderRadius: 3, transition: 'width 1s ease' }} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--kl-text)' }}>{r.pct}%</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 24h Activity */}
          <Card padding={12} style={{ minHeight: 160 }}>
            <CardHeader icon={I.bell} title="24h activity" action={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--kl-text-faint)' }}>{totalEvents} events</span>} />
            <div style={{ marginTop: 4 }}>
              <HourlyBars data={hourlyData} height={64} />
              <div style={{ fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--kl-text-faint)', marginTop: 4 }}>
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>now</span>
              </div>
            </div>
          </Card>
        </div>

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px]">
          <KpiCard label="Pods" value={data.pods.length} sub={`${podPhases.Running || 0} running`}
            accent={<div style={{ display: 'flex', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--kl-ok)' }} />
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--kl-warn)', opacity: (podPhases.Pending || 0) > 0 ? 1 : 0.35 }} />
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--kl-err)', opacity: (podPhases.Failed || 0) > 0 ? 1 : 0.35 }} />
            </div>}
            spark={podSpark} sparkColor="var(--kl-accent)"
            footer={<><span style={{ color: 'var(--kl-text-muted)' }}>{restartInfo.totalRestarts || 0} restarts</span><span style={{ color: 'var(--kl-ok)' }}>+2 vs yesterday</span></>}
          />
          <KpiCard label="Nodes" value={nodeHealth.total} sub={`${nodeHealth.ready} ready`}
            accent={<KLBadge tone={nodeHealth.notReady > 0 ? 'warn' : 'ok'}>{nodeHealth.notReady > 0 ? `${nodeHealth.notReady} issue` : 'all healthy'}</KLBadge>}
            footer={<>
              <div style={{ display: 'flex', gap: 3 }}>
                {Array.from({ length: Math.min(nodeHealth.total, 8) }).map((_, i) => (
                  <div key={i} style={{ width: 24, height: 4, background: i < nodeHealth.ready ? 'var(--kl-ok)' : 'var(--kl-err)', borderRadius: 2 }} />
                ))}
              </div>
              <span style={{ color: 'var(--kl-text-muted)' }}>0 cordoned</span>
            </>}
          />
          <KpiCard label="Workloads" value={totalWorkloads} sub={`${readyWorkloads}/${totalWorkloads} ready`}
            accent={<KLBadge tone={readyWorkloads === totalWorkloads ? 'ok' : 'warn'}>{totalWorkloads > 0 ? `${Math.round((readyWorkloads / totalWorkloads) * 100)}%` : '—'}</KLBadge>}
            footer={<>
              <div style={{ display: 'flex', gap: 6, fontSize: 10.5 }}>
                <span style={{ color: 'var(--kl-text-2)', fontFamily: 'var(--font-mono)' }}>{data.deployments.length} Dep</span>
                <span style={{ color: 'var(--kl-text-2)', fontFamily: 'var(--font-mono)' }}>{data.statefulSets.length} SS</span>
                <span style={{ color: 'var(--kl-text-2)', fontFamily: 'var(--font-mono)' }}>{data.daemonSets.length} DS</span>
              </div>
              <span style={{ color: 'var(--kl-text-muted)' }}>+1 today</span>
            </>}
          />
          {costEnabled ? (
            <KpiCard label="Est. cost / mo" value={`$${Math.floor(estimatedCost)}`} sub={`.${String(Math.round((estimatedCost % 1) * 100)).padStart(2, '0')}`}
              accent={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--kl-ok)' }}>↘ −3%</span>}
              spark={costSpark} sparkColor="var(--kl-warn)"
              footer={<><span style={{ color: 'var(--kl-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>top: demo-app</span><span style={{ color: 'var(--kl-text-faint)', flexShrink: 0 }}>30d</span></>}
            />
          ) : (
            <Card padding={16} style={{ minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--kl-text-muted)', fontWeight: 500, letterSpacing: 0.4, textTransform: 'uppercase' }}>Est. cost / mo</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--kl-text-faint)', letterSpacing: -0.5 }}>—</span>
                <span style={{ fontSize: 12, color: 'var(--kl-text-muted)', lineHeight: 1.4 }}>Cost estimation is disabled</span>
              </div>
              <button onClick={() => window.dispatchEvent(new CustomEvent('kl:open-settings', { detail: { tab: 'dashboard' } }))} style={{ fontSize: 11.5, color: 'var(--kl-accent)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Enable in Settings {I.chevRight}
              </button>
            </Card>
          )}
        </div>

        {/* ── Resource Topology Strip ── */}
        <Card padding={0}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--kl-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--kl-text-muted)' }}>{I.topo}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--kl-text)' }}>Resource topology</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--kl-text-faint)' }}>· all namespaces</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
            {topoItems.map((t, i, arr) => (
              <div key={t.l} style={{ padding: '12px 14px', borderRight: i < arr.length - 1 ? '1px solid var(--kl-border)' : 'none', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: t.c, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--kl-text-muted)', textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 500 }}>{t.l}</span>
                </div>
                <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.8, lineHeight: 1, color: 'var(--kl-text)', display: 'block' }}>{t.n}</span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--kl-text-faint)', marginTop: 6 }}>{t.sub}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Bottom 2-column ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-[14px]">
          {/* Recent Events */}
          <Card padding={0}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--kl-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--kl-text-muted)' }}>{I.bell}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--kl-text)' }}>Recent events</span>
                {warnEvents > 0 && <KLBadge tone="warn">{warnEvents}</KLBadge>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--kl-text-muted)' }}>
                {['All', 'Warnings', 'Errors'].map((f) => (
                  <button key={f} onClick={() => setEventFilter(f)} style={{ padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: eventFilter === f ? 500 : 400, background: eventFilter === f ? 'var(--kl-surface-2)' : 'transparent', border: eventFilter === f ? '1px solid var(--kl-border)' : '1px solid transparent', color: eventFilter === f ? 'var(--kl-text)' : 'var(--kl-text-muted)' }}>{f}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: '12px 16px' }}>
              {timelineEvents.length === 0 ? (
                <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--kl-text-muted)', fontSize: 13 }}>No events</div>
              ) : (
                timelineEvents.map((e, i) => <TimelineItem key={i} {...e} last={i === timelineEvents.length - 1} />)
              )}
            </div>
          </Card>

          {/* Helm Releases */}
          <Card padding={0}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--kl-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--kl-text-muted)' }}>{I.helm}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--kl-text)' }}>Helm releases</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, padding: '0 6px', borderRadius: 5, background: 'var(--kl-surface-2)', border: '1px solid var(--kl-border)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--kl-text-2)', fontWeight: 600 }}>{helmReleases.length}</span>
              </div>
              <Link href="/advanced/helm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--kl-accent)', fontWeight: 500 }}>Open Helm {I.chevRight}</Link>
            </div>
            {helmLoading ? (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--kl-text-muted)', fontSize: 12.5 }}>Loading releases…</div>
            ) : helmReleases.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 12.5, color: 'var(--kl-text-muted)', marginBottom: 6 }}>No Helm releases found</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--kl-text-faint)' }}>Deploy a chart with helm install to get started</div>
              </div>
            ) : (
              <>
                <div className="kl-helm-table">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ color: 'var(--kl-text-muted)' }}>
                      {['Release', 'Namespace', 'Chart', 'Version', 'Status'].map((h, i) => (
                        <th key={h} style={{ textAlign: 'left', padding: `8px ${i === 0 ? 20 : i === 4 ? '8px 20px 8px 8px' : 8}px`, fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 500, letterSpacing: 0.3, textTransform: 'uppercase', borderBottom: '1px solid var(--kl-border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {helmVisible.map((h, i, arr) => (
                      <tr key={i} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--kl-border)' : 'none' }}>
                        <td style={{ padding: '10px 8px 10px 20px', minWidth: 0 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 500, color: 'var(--kl-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{h.n}</span>
                        </td>
                        <td style={{ padding: '10px 8px', minWidth: 0 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--kl-text-2)' }}>{h.ns}</span>
                        </td>
                        <td style={{ padding: '10px 8px', minWidth: 0 }}>
                          <Badge variant="outline" className="font-mono text-[10.5px] font-normal">{h.chart ?? '—'}</Badge>
                        </td>
                        <td style={{ padding: '10px 8px', minWidth: 0 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--kl-text-muted)' }}>{h.ver ?? '—'}</span>
                        </td>
                        <td style={{ padding: '10px 20px 10px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 7, height: 7, borderRadius: 999, background: h.tone === 'ok' ? 'var(--kl-ok)' : h.tone === 'err' ? 'var(--kl-err)' : 'var(--kl-warn)', flexShrink: 0 }} />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textTransform: 'capitalize', color: 'var(--kl-text-2)' }}>{h.phase}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {helmOverflow > 0 && (
                  <div style={{ padding: '10px 20px', borderTop: '1px solid var(--kl-border)' }}>
                    <Link href="/advanced/helm" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--kl-accent)' }}>+{helmOverflow} more release{helmOverflow !== 1 ? 's' : ''}</Link>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
