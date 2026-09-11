import assert from "node:assert/strict";
import test from "node:test";

import {
  isSupportedProviderStatus,
  shouldApplyProviderStatus,
} from "../supabase/functions/twilio-message-status/provider-status.ts";

test("supports Twilio delivery lifecycle statuses", () => {
  for (const status of [
    "accepted",
    "scheduled",
    "queued",
    "sending",
    "sent",
    "delivered",
    "read",
    "undelivered",
    "failed",
    "canceled",
  ]) {
    assert.equal(isSupportedProviderStatus(status), true);
  }
  assert.equal(isSupportedProviderStatus("mystery"), false);
});

test("late accepted, queued, or sent callbacks cannot downgrade delivery", () => {
  assert.equal(shouldApplyProviderStatus("delivered", "sent"), false);
  assert.equal(shouldApplyProviderStatus("delivered", "queued"), false);
  assert.equal(shouldApplyProviderStatus("read", "accepted"), false);
});

test("late failure cannot overwrite carrier-confirmed delivery", () => {
  assert.equal(shouldApplyProviderStatus("delivered", "undelivered"), false);
  assert.equal(shouldApplyProviderStatus("read", "failed"), false);
});

test("carrier-final status advances accepted or sent status", () => {
  assert.equal(shouldApplyProviderStatus("sent", "delivered"), true);
  assert.equal(shouldApplyProviderStatus("sent", "failed"), true);
  assert.equal(shouldApplyProviderStatus("undelivered", "delivered"), true);
});

test("duplicate callbacks are no-op state transitions", () => {
  assert.equal(shouldApplyProviderStatus("delivered", "delivered"), false);
  assert.equal(shouldApplyProviderStatus("failed", "failed"), false);
});
