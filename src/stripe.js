import { unixSeconds } from "./core.js";

// Verify a Stripe webhook signature (Web Crypto — runs in the Worker and in Node
// tests). Scheme: the Stripe-Signature header is "t=<unix>,v1=<hex>[,v1=...]";
// the signed payload is `${t}.${rawBody}` and the signature is
// HMAC-SHA256(signedPayload, endpointSecret) as hex. Timestamps older than
// `toleranceSeconds` are rejected to blunt replay. Returns a boolean; never throws.
export async function verifyStripeSignature(payload, header, secret, toleranceSeconds = 300) {
  if (typeof header !== "string" || typeof secret !== "string" || !secret) return false;
  const parts = {};
  for (const kv of header.split(",")) {
    const i = kv.indexOf("=");
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const age = Math.abs(unixSeconds() - Number(t));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  // Constant-time-ish compare over equal-length hex strings.
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}
