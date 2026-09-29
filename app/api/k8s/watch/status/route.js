import { NextResponse } from "next/server";

import { getClusterCacheFromRequest, watchCacheEnabled } from "@/lib/k8s/watch/hub";

// Diagnostics for the caller's own watch cache (never other users' caches):
// which reflectors are running, their sync state, object counts and reconnect stats.
export async function GET(request) {
  if (!watchCacheEnabled()) return NextResponse.json({ enabled: false, reflectors: [] });
  try {
    const cache = getClusterCacheFromRequest(request);
    return NextResponse.json({ enabled: true, reflectors: cache.status() });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
