export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { sendTelemetry } = await import("./lib/telemetry/sender.js");
    sendTelemetry().catch(() => {});
  }
}
