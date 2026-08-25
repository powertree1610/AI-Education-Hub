import assert from "node:assert/strict";
import { test } from "node:test";
import { decideSafetyAction, isOpenStatus } from "./safety-policy.js";

test("severity 1-2 is allowed and never escalates", () => {
  assert.deepEqual(decideSafetyAction("off_topic_adult", 1), { action: "allowed", escalate: false });
  assert.deepEqual(decideSafetyAction("off_topic_adult", 2), { action: "allowed", escalate: false });
});

test("severity 3 redirects without escalating", () => {
  assert.deepEqual(decideSafetyAction("violence", 3), { action: "redirected", escalate: false });
  assert.deepEqual(decideSafetyAction("prompt_injection", 3), { action: "redirected", escalate: false });
});

test("severity >=4 escalates for any category — and 'escalated' is what gets persisted", () => {
  assert.deepEqual(decideSafetyAction("sexual_content", 4), { action: "escalated", escalate: true });
  assert.deepEqual(decideSafetyAction("hate", 5), { action: "escalated", escalate: true });
  assert.deepEqual(decideSafetyAction("off_topic_adult", 4), { action: "escalated", escalate: true });
});

test("self_harm and disclosure escalate a step early, at severity 3", () => {
  assert.deepEqual(decideSafetyAction("self_harm", 3), { action: "escalated", escalate: true });
  assert.deepEqual(decideSafetyAction("disclosure", 3), { action: "escalated", escalate: true });
});

test("self_harm and disclosure below 3 follow the normal ladder", () => {
  assert.deepEqual(decideSafetyAction("disclosure", 2), { action: "allowed", escalate: false });
  assert.deepEqual(decideSafetyAction("self_harm", 1), { action: "allowed", escalate: false });
});

test("open-status predicate matches the triage set", () => {
  assert.equal(isOpenStatus("open"), true);
  assert.equal(isOpenStatus("under_review"), true);
  assert.equal(isOpenStatus("escalated"), true);
  assert.equal(isOpenStatus("actioned"), false);
  assert.equal(isOpenStatus("closed"), false);
});
