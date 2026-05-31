import { Panel } from "@/components/kl/Panel";

export function RulesTab({ ingress }) {
  const rules = ingress?.spec?.rules ?? [];
  return (
    <Panel title="All Rules (raw)">
      <pre style={{ fontSize: 11.5, fontFamily: "monospace", color: "var(--kl-text-muted)", overflow: "auto", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {JSON.stringify(rules, null, 2)}
      </pre>
    </Panel>
  );
}
