import {
  SunIcon,
  MoonIcon,
  MonitorIcon,
  PanelLeftIcon,
  PanelTopIcon,
} from "lucide-react";

// ── Connect flow ──────────────────────────────────────────────────────────────

export const CONNECT_STEPS = [
  { n: "01", title: "Reading kubeconfig", defaultSub: "parsing contexts, users, clusters..." },
  { n: "02", title: "Resolving API endpoint", defaultSub: "looking up server address..." },
  { n: "03", title: "Verifying TLS", defaultSub: "checking certificate chain..." },
  { n: "04", title: "Probing API server", defaultSub: "fetching server version..." },
  { n: "05", title: "Loading API resources", defaultSub: "enumerating resource types..." },
  { n: "06", title: "Building informer cache", defaultSub: "watching pods, services, deployments..." },
];

export const STEP_MS = [600, 500, 500, 700, 600, 500];

// ── Settings — General tab ────────────────────────────────────────────────────

export const REFRESH_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 15, label: "Every 15s" },
  { value: 30, label: "Every 30s" },
  { value: 60, label: "Every 60s" },
];

export const DATE_OPTIONS = [
  { value: "relative", label: "Relative (2 minutes ago)" },
  { value: "absolute", label: "Absolute (Mar 29, 2026 14:30)" },
];

export const TIMEZONES = [
  { value: "UTC", label: "UTC (GMT+0:00)" },
  { value: "America/New_York", label: "America/New_York (GMT-5:00)" },
  { value: "America/Chicago", label: "America/Chicago (GMT-6:00)" },
  { value: "America/Denver", label: "America/Denver (GMT-7:00)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (GMT-8:00)" },
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (GMT-3:00)" },
  { value: "Europe/London", label: "Europe/London (GMT+0:00)" },
  { value: "Europe/Paris", label: "Europe/Paris (GMT+1:00)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (GMT+1:00)" },
  { value: "Europe/Moscow", label: "Europe/Moscow (GMT+3:00)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GMT+4:00)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (GMT+5:30)" },
  { value: "Asia/Dhaka", label: "Asia/Dhaka (GMT+6:00)" },
  { value: "Asia/Bangkok", label: "Asia/Bangkok (GMT+7:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (GMT+8:00)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (GMT+8:00)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (GMT+9:00)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (GMT+11:00)" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland (GMT+13:00)" },
];

// ── Settings — Appearance tab ─────────────────────────────────────────────────

export const THEMES = [
  {
    value: "light",
    label: "Light",
    icon: SunIcon,
    tooltip: "Always use light theme regardless of system preference",
  },
  {
    value: "dark",
    label: "Dark",
    icon: MoonIcon,
    tooltip: "Always use dark theme regardless of system preference",
  },
  {
    value: "system",
    label: "System",
    icon: MonitorIcon,
    tooltip: "Follow your OS light/dark setting automatically",
  },
];

export const NAV_STYLES = [
  {
    value: "vertical",
    label: "Vertical",
    icon: PanelLeftIcon,
    tooltip: "Collapsible sidebar on the left — more vertical space for content",
  },
  {
    value: "horizontal",
    label: "Horizontal",
    icon: PanelTopIcon,
    tooltip: "Top navigation bar — maximises horizontal and vertical space",
  },
];

export const DENSITIES = [
  {
    value: "comfortable",
    label: "Comfortable",
    tooltip: "Standard row height — easier to read at a glance",
  },
  {
    value: "compact",
    label: "Compact",
    tooltip: "Reduced row height — fits more resources on screen",
  },
];

// ── Settings — Dashboard tab ──────────────────────────────────────────────────

export const COST_DEFAULT_CONFIG = {
  enabled: false,
  cpuPerCoreHour: 0.048,
  memPerGbHour: 0.006,
  currency: "USD",
};

export const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "JPY", "INR"];

// ── Settings — dialog nav groups ──────────────────────────────────────────────

export const SETTINGS_GROUPS = [
  {
    label: "Workspace",
    items: [
      { id: "general", label: "General", icon: "Settings2" },
      { id: "appearance", label: "Appearance", icon: "Palette" },
    ],
  },
  {
    label: "Clusters",
    items: [
      { id: "clusters", label: "Connected Clusters", icon: "Server" },
      { id: "namespaces", label: "Namespaces", icon: "Folder" },
    ],
  },
  {
    label: "Display",
    items: [
      { id: "visibility", label: "Resource Visibility", icon: "Eye" },
      { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    ],
  },
  {
    label: "About",
    items: [{ id: "about", label: "About", icon: "Info" }],
  },
];

// ── App metadata ──────────────────────────────────────────────────────────────

export const APP_VERSION = "0.1.0";
