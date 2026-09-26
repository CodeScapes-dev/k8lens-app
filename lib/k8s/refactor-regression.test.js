import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeHealthScore } from "./health-score.js";
import { aggregatePodRestarts, buildUnhealthyWorkloads } from "./dashboard-aggregations.js";
import { collect } from "./__fixtures__/regression-cases.js";

const golden = JSON.parse(readFileSync(new URL("./__fixtures__/golden.json", import.meta.url), "utf8"));
const actual = JSON.parse(
  JSON.stringify(collect({ computeHealthScore, aggregatePodRestarts, buildUnhealthyWorkloads })),
);

test("computeHealthScore pod output is unchanged", () => {
  assert.deepEqual(actual.health, golden.health);
});

test("aggregatePodRestarts output is unchanged", () => {
  assert.deepEqual(actual.restarts, golden.restarts);
});

test("buildUnhealthyWorkloads output is unchanged", () => {
  assert.deepEqual(actual.unhealthy, golden.unhealthy);
});
