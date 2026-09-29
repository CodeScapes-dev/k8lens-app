import { test } from "node:test";
import assert from "node:assert/strict";
import { _kindRegistryKeys, _watchKindKeys, isKnownKind } from "./watch-manager.js";
import { WATCH_KINDS, DETAIL_TYPE_TO_KIND } from "./watch-kinds.js";

test("KIND_REGISTRY (server informer definitions) and WATCH_KINDS (shared client-safe data) name exactly the same kinds", () => {
  assert.deepEqual([..._kindRegistryKeys()].sort(), [..._watchKindKeys()].sort());
});

test("isKnownKind agrees with WATCH_KINDS", () => {
  for (const kind of Object.keys(WATCH_KINDS)) assert.equal(isKnownKind(kind), true, kind);
  assert.equal(isKnownKind("not-a-real-kind"), false);
});

test("every DETAIL_TYPE_TO_KIND value is a real WATCH_KINDS entry", () => {
  for (const [type, kind] of Object.entries(DETAIL_TYPE_TO_KIND)) {
    assert.ok(Object.hasOwn(WATCH_KINDS, kind), `${type} -> ${kind}`);
  }
});
