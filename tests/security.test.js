import test from "node:test";
import assert from "node:assert/strict";

import {
  SESSION_COOKIE_NAME,
  resolveAnonymousSession,
  safeSecretEqual,
  verifyTurnstileToken,
} from "../src/security.js";

const signingKey = "a-test-signing-key-that-is-long-enough";

test("issues and verifies a signed anonymous session cookie", async () => {
  const first = await resolveAnonymousSession(new Request("http://localhost/api/health"), signingKey, "localhost");
  assert.equal(first.isNew, true);
  assert.match(first.setCookie, new RegExp(`^${SESSION_COOKIE_NAME}=`));
  assert.match(first.setCookie, /HttpOnly/u);
  assert.doesNotMatch(first.setCookie, /Secure/u);

  const cookie = first.setCookie.split(";")[0];
  const second = await resolveAnonymousSession(
    new Request("http://localhost/api/health", { headers: { cookie } }),
    signingKey,
    "localhost",
  );
  assert.equal(second.id, first.id);
  assert.equal(second.isNew, false);
  assert.equal(second.setCookie, null);
});

test("accepts the signed anonymous session from an embedded-client header", async () => {
  const first = await resolveAnonymousSession(new Request("https://pc.lucasacademy.org/api/health"), signingKey, "pc.lucasacademy.org");
  const second = await resolveAnonymousSession(
    new Request("https://pc.lucasacademy.org/api/health", { headers: { "x-pc-session": first.sessionToken } }),
    signingKey,
    "pc.lucasacademy.org",
  );
  assert.equal(second.id, first.id);
  assert.equal(second.isNew, false);
  assert.equal(second.sessionToken, first.sessionToken);
});

test("replaces a tampered session and secures production cookies", async () => {
  const session = await resolveAnonymousSession(
    new Request("https://pc.lucasacademy.org/api/health", { headers: { cookie: `${SESSION_COOKIE_NAME}=fake.signature` } }),
    signingKey,
    "pc.lucasacademy.org",
  );
  assert.equal(session.isNew, true);
  assert.match(session.setCookie, /Secure/u);
});

test("compares administrator secrets without accepting empty values", async () => {
  assert.equal(await safeSecretEqual("same", "same"), true);
  assert.equal(await safeSecretEqual("same", "different"), false);
  assert.equal(await safeSecretEqual("", ""), false);
});

test("requires successful Turnstile action and hostname validation", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return Response.json({ success: true, action: "publish", hostname: "pc.lucasacademy.org" });
  };
  const result = await verifyTurnstileToken({
    token: "valid-token",
    secret: "server-secret",
    expectedAction: "publish",
    expectedHostname: "pc.lucasacademy.org",
    fetchImpl,
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.secret, "server-secret");
  assert.equal(calls[0].body.response, "valid-token");
  assert.match(calls[0].body.idempotency_key, /^[0-9a-f-]{36}$/u);
});

test("rejects Turnstile action, hostname, and duplicate failures", async () => {
  const success = body => async () => Response.json(body);
  const action = await verifyTurnstileToken({
    token: "valid-token",
    secret: "secret",
    expectedAction: "report",
    expectedHostname: "pc.lucasacademy.org",
    fetchImpl: success({ success: true, action: "publish", hostname: "pc.lucasacademy.org" }),
  });
  assert.equal(action.reason, "action_mismatch");

  const hostname = await verifyTurnstileToken({
    token: "valid-token",
    secret: "secret",
    expectedAction: "report",
    expectedHostname: "pc.lucasacademy.org",
    fetchImpl: success({ success: true, action: "report", hostname: "attacker.example" }),
  });
  assert.equal(hostname.reason, "hostname_mismatch");

  const duplicate = await verifyTurnstileToken({
    token: "valid-token",
    secret: "secret",
    expectedAction: "report",
    expectedHostname: "pc.lucasacademy.org",
    fetchImpl: success({ success: false, "error-codes": ["timeout-or-duplicate"] }),
  });
  assert.equal(duplicate.reason, "verification_failed");
  assert.deepEqual(duplicate.errors, ["timeout-or-duplicate"]);
});

test("accepts Cloudflare testing metadata only when explicitly enabled", async () => {
  const fetchImpl = async () => Response.json({
    success: true,
    hostname: "example.com",
    metadata: { result_with_testing_key: true },
  });
  const local = await verifyTurnstileToken({
    token: "XXXX.DUMMY.TOKEN.XXXX",
    secret: "test-secret",
    expectedAction: "publish",
    expectedHostname: "localhost",
    allowTestValues: true,
    fetchImpl,
  });
  assert.equal(local.ok, true);

  const production = await verifyTurnstileToken({
    token: "XXXX.DUMMY.TOKEN.XXXX",
    secret: "test-secret",
    expectedAction: "publish",
    expectedHostname: "pc.lucasacademy.org",
    allowTestValues: false,
    fetchImpl,
  });
  assert.equal(production.ok, false);
});
