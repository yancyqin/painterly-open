import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { verifyStripeSignature } from "../src/stripe.js";

const nowSeconds = () => Math.floor(Date.now() / 1000);

function signature(payload, secret, t) {
  const mac = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${mac}`;
}

test("verifyStripeSignature accepts a correctly-signed recent payload", async () => {
  const secret = "whsec_test_abc";
  const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const header = signature(payload, secret, nowSeconds());
  assert.equal(await verifyStripeSignature(payload, header, secret), true);
});

test("verifyStripeSignature rejects a tampered payload", async () => {
  const secret = "whsec_test_abc";
  const header = signature("original body", secret, nowSeconds());
  assert.equal(await verifyStripeSignature("tampered body", header, secret), false);
});

test("verifyStripeSignature rejects a wrong secret", async () => {
  const payload = "body";
  const header = signature(payload, "whsec_right", nowSeconds());
  assert.equal(await verifyStripeSignature(payload, header, "whsec_wrong"), false);
});

test("verifyStripeSignature rejects a stale timestamp (replay defense)", async () => {
  const secret = "whsec_test_abc";
  const payload = "body";
  // Correctly signed, but the timestamp is an hour old → outside tolerance.
  const header = signature(payload, secret, nowSeconds() - 3600);
  assert.equal(await verifyStripeSignature(payload, header, secret), false);
});

test("verifyStripeSignature rejects malformed or missing signature headers", async () => {
  const secret = "whsec_test_abc";
  assert.equal(await verifyStripeSignature("body", "garbage", secret), false);
  assert.equal(await verifyStripeSignature("body", "t=" + nowSeconds(), secret), false); // no v1
  assert.equal(await verifyStripeSignature("body", "", secret), false);
});
