export const SESSION_COOKIE_NAME = "pc_session";
export const SESSION_MAX_AGE_SECONDS = 86_400;
export const TEST_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
export const TEST_TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{32,80}$/;
const TOKEN_PATTERN = /^.{1,2048}$/su;

export function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

export async function resolveAnonymousSession(request, signingKey, hostname) {
  if (!signingKey) throw new Error("A session signing key is required.");
  // Embedded HTML5 games cannot depend on third-party cookies: modern browser
  // privacy settings commonly discard them inside an iframe. The same signed
  // anonymous token can therefore arrive through a CORS-safe request header.
  // It identifies only a rate-limit bucket, never an account or entitlement.
  const stored = request.headers.get("x-pc-session")
    || readCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE_NAME);
  if (stored) {
    const separator = stored.lastIndexOf(".");
    const id = separator > 0 ? stored.slice(0, separator) : "";
    const signature = separator > 0 ? stored.slice(separator + 1) : "";
    if (SESSION_ID_PATTERN.test(id) && signature && safeEqual(signature, await signSessionId(id, signingKey))) {
      return { id, sessionToken: stored, setCookie: null, isNew: false };
    }
  }

  const id = randomToken(24);
  const signature = await signSessionId(id, signingKey);
  const secure = !isLocalHostname(hostname);
  const attributes = [
    `${SESSION_COOKIE_NAME}=${id}.${signature}`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) attributes.push("Secure");
  return { id, sessionToken: `${id}.${signature}`, setCookie: attributes.join("; "), isNew: true };
}

export async function safeSecretEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || !left || !right) return false;
  return safeEqual(await sha256Hex(left), await sha256Hex(right));
}

export async function verifyTurnstileToken({
  token,
  secret,
  expectedAction,
  expectedHostname,
  allowTestValues = false,
  fetchImpl = fetch,
}) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
    return { ok: false, reason: "missing_or_invalid_token" };
  }
  if (!secret) return { ok: false, reason: "missing_secret" };

  let response;
  try {
    response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        idempotency_key: crypto.randomUUID(),
      }),
    });
  } catch {
    return { ok: false, reason: "siteverify_unavailable" };
  }

  if (!response.ok) return { ok: false, reason: "siteverify_unavailable" };
  const result = await response.json().catch(() => null);
  if (!result?.success) {
    return { ok: false, reason: "verification_failed", errors: normalizedErrors(result?.["error-codes"]) };
  }

  if (allowTestValues && result.metadata?.result_with_testing_key === true) {
    return { ok: true, hostname: result.hostname, action: result.action ?? "test" };
  }

  const actionMatches = result.action === expectedAction
    || (allowTestValues && result.action === "test");
  if (!actionMatches) {
    return { ok: false, reason: "action_mismatch", receivedAction: String(result.action ?? "") };
  }

  const hostnameMatches = result.hostname === expectedHostname
    || (allowTestValues && isLocalHostname(String(result.hostname ?? "")));
  if (!hostnameMatches) {
    return { ok: false, reason: "hostname_mismatch", receivedHostname: String(result.hostname ?? "") };
  }

  return { ok: true, hostname: result.hostname, action: result.action };
}

function readCookie(header, name) {
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

async function signSessionId(id, signingKey) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id)));
  return base64Url(signature);
}

function randomToken(byteLength) {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function sha256Hex(value) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}

function normalizedErrors(value) {
  return Array.isArray(value) ? value.filter(error => typeof error === "string").slice(0, 5) : [];
}
