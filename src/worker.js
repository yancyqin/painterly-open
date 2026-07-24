import {
  CHALLENGE_TTL_SECONDS,
  MAX_JSON_BODY_BYTES,
  attemptFindsChallenge,
  parseChallengePath,
  unixSeconds,
  validateAttemptInput,
  validateChallengeInput,
  validateModerationActionInput,
  validateReportInput,
} from "./core.js";
import {
  TEST_TURNSTILE_SECRET_KEY,
  TEST_TURNSTILE_SITE_KEY,
  isLocalHostname,
  resolveAnonymousSession,
  safeSecretEqual,
  verifyTurnstileToken,
} from "./security.js";
import { normalizeRoomSearch } from "./roomNames.js";
import { UNLOCK_PRICE_CENTS } from "./store.js";
import { verifyStripeSignature } from "./stripe.js";

const API_VERSION = "async-art-puzzle-6";
const EXPLORE_CACHE_SECONDS = 60;
const EXPLORE_CANDIDATE_LIMIT = 60;
// Each lane returns a POOL (bigger than the ~10 shown) so the client's per-lane
// "refresh" can page through it entirely from the cached payload — no extra DB.
const EXPLORE_FEED_POOL = 30;
const EXPLORE_SURPRISE_POOL = 40;
const EXPLORE_CACHE_VERSION = "live-feed-9";
const MODERATION_AUDIT_TTL_SECONDS = 30 * 86_400;
const ACCOUNT_SESSION_COOKIE = "pc_account";
const ACCOUNT_SESSION_SECONDS = 90 * 86_400;
const OTP_TTL_SECONDS = 10 * 60;
const OTP_RESEND_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
// Van Gogh stays open for the first-play experience. Deeper houses ask for a
// lightweight account now, leaving a clean place to attach paid access later.
const ACCOUNT_REQUIRED_HOUSES = new Set(["monet-garden-house", "outdoor-masters-journey", "world-remembers-color", "luminous-tide-dreamscape", "unfinished-morning"]);
// --- Paid access -----------------------------------------------------------
// Model (docs/DECISIONS.md D-014/D-015): the first three houses are free to
// create in; every other house (current + any added later) unlocks TOGETHER
// with one one-time $2.99 purchase — web via Stripe hosted checkout, iOS later
// as a paid app (no IAP). Entitlements live in the existing `entitlements`
// table (migration 0005); the single sellable product is UNLOCK_PRODUCT.
// Seeking is always free everywhere; the gate covers hiding/creating only.
// NOTE: a house may only be *sold* once its provenance is commercial-approved
// (all six approved 2026-07-20; future houses follow
// docs/archive/RIGHTS-REVIEW.md before joining the paid set).
const FREE_HOUSES = new Set(["van-gogh-house", "monet-garden-house", "outdoor-masters-journey"]);
const UNLOCK_PRODUCT = "bundle:all-houses";
const isPaidHouse = (artHouse) => !FREE_HOUSES.has(artHouse);
/** True if the account has bought the one-time unlock (grants every paid house). */
async function accountHasUnlock(database, accountId) {
  if (!accountId) return false;
  return (await activeProducts(database, accountId)).has(UNLOCK_PRODUCT);
}
const LOCAL_SESSION_SIGNING_KEY = "painterly-chameleon-local-session-signing-key";
const LOCAL_ADMIN_TOKEN = "painterly-chameleon-local-admin";

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    const cors = apiCorsPolicy(request, env, url);
    if (!cors.allowed) return errorResponse(403, "origin_not_allowed", "This API origin is not allowed.");
    if (request.method === "OPTIONS") return corsPreflightResponse(cors.headers);

    let session = null;
    try {
      const signingKey = env.SESSION_SIGNING_KEY
        || (isLocalRuntime(env, url) ? LOCAL_SESSION_SIGNING_KEY : "");
      if (!signingKey) throw new ApiError(503, "security_unavailable", "The security service is not configured.");
      session = await resolveAnonymousSession(request, signingKey, runtimeHostname(env, url));
      return withSessionCookie(await routeApi(request, env, context, url, session), session, cors.headers);
    } catch (error) {
      if (error instanceof ApiError) {
        return withSessionCookie(errorResponse(error.status, error.code, error.message, error.headers), session, cors.headers);
      }
      console.error("Unhandled API error", error);
      return withSessionCookie(errorResponse(500, "internal_error", "The service could not complete the request."), session, cors.headers);
    }
  },

  async scheduled(controller, env, context) {
    const now = unixSeconds(controller.scheduledTime);
    context.waitUntil(deleteExpiredChallenges(env.DB, now));
    context.waitUntil(deleteExpiredModerationAudits(env.DB, now));
    context.waitUntil(deleteExpiredAuthState(env.DB, now));
  },
};

async function routeApi(request, env, context, url, session) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    const database = await env.DB.prepare("SELECT 1 AS ok").first();
    return jsonResponse({
      ok: database?.ok === 1,
      service: "painterly-chameleon",
      version: API_VERSION,
      challengeTtlSeconds: CHALLENGE_TTL_SECONDS,
      now: new Date().toISOString(),
    });
  }

  if (request.method === "GET" && url.pathname === "/api/config") {
    const settings = turnstileSettings(env, url);
    return jsonResponse({
      turnstile: {
        enabled: Boolean(settings.siteKey && settings.secret),
        siteKey: settings.siteKey || null,
      },
      // Store catalog (single source of truth for the client). The first three
      // houses are free; everything else unlocks with one purchase. `checkout`
      // stays false until real checkout is wired (the client shows a lock, no
      // price, while false).
      products: {
        freeHouses: [...FREE_HOUSES],
        unlockProduct: UNLOCK_PRODUCT,
        unlockPriceCents: UNLOCK_PRICE_CENTS,
        // Real checkout is live once BOTH Stripe secrets are configured on the
        // worker (secret key to create sessions + webhook secret to verify the
        // grant). Until then the client shows a lock and falls back to dev-grant.
        checkout: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
        devGrant: isLocalRuntime(env, url),
      },
    });
  }

  if (request.method === "GET" && url.pathname === "/api/explore") {
    return url.searchParams.has("q")
      ? searchExplore(env.DB, url.searchParams.get("q"), context, url.origin)
      : getExplore(env.DB, context, url.origin);
  }

  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    return getAuthState(request, env.DB);
  }
  if (url.pathname === "/api/account/challenges" && request.method === "GET") {
    return getAccountChallenges(request, env, url);
  }
  if (url.pathname === "/api/account/entitlements" && request.method === "GET") {
    return getAccountEntitlements(request, env.DB);
  }
  if (url.pathname === "/api/dev/grant-entitlement" && request.method === "POST") {
    if (!isLocalRuntime(env, url)) throw new ApiError(404, "not_found", "Not found.");
    return devGrantEntitlement(request, env.DB);
  }
  if (url.pathname === "/api/checkout" && request.method === "POST") {
    return createCheckoutSession(request, env, url);
  }
  if (url.pathname === "/api/webhooks/stripe" && request.method === "POST") {
    return handleStripeWebhook(request, env);
  }
  if (url.pathname === "/api/auth/request-otp" && request.method === "POST") {
    await enforceRateLimit(env.AUTH_LIMITER, "auth", session.id);
    await enforceTurnstile(request, env, url, "auth");
    return requestOtp(request, env, url);
  }
  if (url.pathname === "/api/auth/verify-otp" && request.method === "POST") {
    await enforceRateLimit(env.AUTH_LIMITER, "auth", session.id);
    return verifyOtp(request, env, url);
  }
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    return logoutAccount(request, env.DB, env, url);
  }

  if (request.method === "POST" && url.pathname === "/api/challenges") {
    await enforceRateLimit(env.PUBLISH_LIMITER, "publish", session.id);
    await enforceTurnstile(request, env, url, "publish");
    return createChallenge(request, env, context, url);
  }

  const adminRoute = parseAdminPath(url.pathname);
  if (adminRoute) {
    await requireAdmin(request, env, url);
    if (request.method === "GET" && adminRoute.action === "list") {
      return getModerationQueue(env.DB, url.origin);
    }
    if (request.method === "POST" && adminRoute.action === "action") {
      return moderateChallenge(adminRoute.challengeId, request, env.DB, url.origin);
    }
    return errorResponse(405, "method_not_allowed", "Method not allowed for this route.", {
      Allow: adminRoute.action === "list" ? "GET" : "POST",
    });
  }

  const route = parseChallengePath(url.pathname);
  if (!route) return errorResponse(404, "not_found", "API route not found.");

  if (request.method === "GET" && route.action === "challenge") {
    return getChallenge(route.token, env.DB, context);
  }
  if (request.method === "POST" && route.action === "attempts") {
    await enforceRateLimit(env.ATTEMPT_LIMITER, "attempt", session.id);
    return recordAttempt(route.token, request, env.DB, context);
  }
  if (request.method === "POST" && route.action === "reports") {
    await enforceRateLimit(env.REPORT_LIMITER, "report", session.id);
    await enforceTurnstile(request, env, url, "report");
    return reportChallenge(route.token, request, env.DB, context, url.origin);
  }
  if (request.method === "GET" && route.action === "results") {
    return getResults(route.token, request, env.DB, context);
  }
  if (request.method === "DELETE" && route.action === "publication") {
    return removeFromExplore(route.token, request, env.DB, context, url.origin);
  }
  if (request.method === "POST" && route.action === "publication") {
    return restoreToExplore(route.token, request, env.DB, context, url.origin);
  }
  if (request.method === "DELETE" && route.action === "challenge") {
    return deleteChallenge(route.token, request, env.DB, context, url.origin);
  }

  return errorResponse(405, "method_not_allowed", "Method not allowed for this route.", {
    Allow: allowedMethods(route.action),
  });
}

async function createChallenge(request, env, context, url) {
  const database = env.DB;
  const input = validateChallengeInput(await readJson(request));
  if (!input.ok) throw new ApiError(400, "invalid_challenge", input.error);
  // Keep accepting previewImage for older clients, but current clients use
  // authored room art in the Lobby and keep their clear share capture local.
  // The nullable column remains for backwards compatibility only.
  const { isPublic, roomName, previewImage, ...payload } = input.value;
  const account = await currentAccount(request, database);
  if (ACCOUNT_REQUIRED_HOUSES.has(payload.artHouse) && !account) {
    throw new ApiError(401, "login_required", "Sign in before creating in this art house.");
  }
  // Paid houses need the one-time unlock. The free three and received invites
  // stay free.
  if (isPaidHouse(payload.artHouse) && !(await accountHasUnlock(database, account?.id))) {
    throw new ApiError(402, "payment_required", "Unlock the full collection to hide here.");
  }

  const token = randomToken(18);
  const hiderKey = randomToken(24);
  const createdAt = unixSeconds();
  const expiresAt = createdAt + CHALLENGE_TTL_SECONDS;

  await database
    .prepare(
      `INSERT INTO challenges
        (id, token_hash, hider_key_hash, payload_json, created_at, expires_at, public_token, art_house, creator_account_id, room_name, room_name_search, preview_image, is_live)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      await sha256Hex(token),
      await sha256Hex(hiderKey),
      JSON.stringify(payload),
      createdAt,
      expiresAt,
      isPublic ? token : null,
      payload.artHouse,
      account?.id ?? null,
      roomName,
      roomName.toLowerCase(),
      previewImage ?? null,
      payload.livePainting ? 1 : 0,
    )
    .run();

  if (isPublic) context.waitUntil(invalidateExploreCache(url.origin));

  const manageBase = manageOrigin(env, url);
  return jsonResponse(
    {
      token,
      hiderKey,
      // The shareable play link — configurable per platform (see buildPlayUrl),
      // so the QR/link can point elsewhere in the future without a code change.
      playUrl: buildPlayUrl(env, url, token),
      manageUrl: `${manageBase}/?c=${encodeURIComponent(token)}&manage=1`,
      createdAt,
      expiresAt,
      isPublic,
      roomName,
      isLive: Boolean(payload.livePainting),
    },
    { status: 201 },
  );
}

async function getExplore(database, context, origin) {
  const cache = globalThis.caches?.default;
  const cacheKey = exploreCacheKey(origin);
  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return withCacheStatus(cached, "HIT");
  }

  const generatedAt = unixSeconds();
  const query = await database
    .prepare(
      `WITH public_candidates AS (
         SELECT id, public_token, art_house, room_name, created_at, expires_at, is_live
         FROM challenges
         WHERE public_token IS NOT NULL AND moderation_status = 'visible' AND expires_at > ?
         ORDER BY created_at DESC
         LIMIT ?
       )
       SELECT
         c.public_token AS token,
         c.art_house,
         c.room_name,
         c.created_at,
         c.expires_at,
         c.is_live,
         COUNT(a.id) AS attempt_count,
         COALESCE(SUM(a.found), 0) AS found_count,
         COALESCE(CAST(AVG(CASE WHEN a.found = 1 THEN a.elapsed_ms END) AS INTEGER), 0) AS average_find_ms
       FROM public_candidates c
       LEFT JOIN attempts a ON a.challenge_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
    )
    .bind(generatedAt, EXPLORE_CANDIDATE_LIMIT)
    .all();

  const candidates = (query.results ?? []).map(row => ({
    token: String(row.token),
    artHouse: String(row.art_house || "van-gogh-house"),
    roomName: String(row.room_name || "Sunny Garden"),
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
    attemptCount: Number(row.attempt_count ?? 0),
    foundCount: Number(row.found_count ?? 0),
    averageFindMs: Number(row.average_find_ms ?? 0),
    isLive: Boolean(row.is_live),
  }));
  // Return POOLS (deeper than the ~10 the client shows) so each lane's refresh
  // pages through this one cached payload without touching the database again.
  const fresh = candidates.slice(0, EXPLORE_FEED_POOL);
  const tricky = candidates
    .filter(challenge => challenge.attemptCount >= 1)
    .sort((left, right) => findRate(left) - findRate(right) || right.attemptCount - left.attemptCount)
    .slice(0, EXPLORE_FEED_POOL);
  // One shuffled pool, deep enough for several distinct random "refresh" pages.
  const surprise = shuffled(candidates).slice(0, EXPLORE_SURPRISE_POOL);

  const response = jsonResponse(
    {
      feeds: { tricky, fresh, surprise },
      generatedAt,
      cacheTtlSeconds: EXPLORE_CACHE_SECONDS,
    },
    {
      headers: {
        "Cache-Control": `public, max-age=${EXPLORE_CACHE_SECONDS}, must-revalidate`,
      },
    },
  );
  if (cache) {
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return withCacheStatus(response, "MISS");
  }
  return withCacheStatus(response, "BYPASS");
}

async function searchExplore(database, rawQuery, context, origin) {
  const query = normalizeRoomSearch(rawQuery);
  if (!query) {
    throw new ApiError(400, "invalid_room_search", "Search with one or two English words.");
  }

  const cache = globalThis.caches?.default;
  const cacheKey = exploreSearchCacheKey(origin, query);
  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return withCacheStatus(cached, "HIT");
  }

  const now = unixSeconds();
  const result = await database
    .prepare(
      `SELECT
         c.public_token AS token,
         c.art_house,
         c.room_name,
         c.created_at,
         c.expires_at,
         c.is_live,
         COUNT(a.id) AS attempt_count,
         COALESCE(SUM(a.found), 0) AS found_count,
         COALESCE(CAST(AVG(CASE WHEN a.found = 1 THEN a.elapsed_ms END) AS INTEGER), 0) AS average_find_ms
       FROM challenges c
       LEFT JOIN attempts a ON a.challenge_id = c.id
       WHERE c.public_token IS NOT NULL
         AND c.moderation_status = 'visible'
         AND c.expires_at > ?
         AND c.room_name_search >= ?
         AND c.room_name_search < ?
       GROUP BY c.id
       ORDER BY c.room_name_search, c.created_at DESC
       LIMIT 12`,
    )
    .bind(now, query, `${query}\uffff`)
    .all();

  const challenges = (result.results ?? []).map(row => ({
    token: String(row.token),
    artHouse: String(row.art_house || "van-gogh-house"),
    roomName: String(row.room_name || "Sunny Garden"),
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
    attemptCount: Number(row.attempt_count ?? 0),
    foundCount: Number(row.found_count ?? 0),
    averageFindMs: Number(row.average_find_ms ?? 0),
    isLive: Boolean(row.is_live),
  }));
  const response = jsonResponse(
    { query, challenges },
    { headers: { "Cache-Control": `public, max-age=${EXPLORE_CACHE_SECONDS}, must-revalidate` } },
  );
  if (cache) {
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return withCacheStatus(response, "MISS");
  }
  return withCacheStatus(response, "BYPASS");
}

async function getAuthState(request, database) {
  const account = await currentAccount(request, database);
  return jsonResponse({ account: account ? publicAccount(account) : null });
}

// The signed-in account's own (non-expired) hides, with stats and the latest
// found screenshot — powers the "my rooms" modal. Session-authed, no Hider key.
async function getAccountChallenges(request, env, url) {
  const account = await currentAccount(request, env.DB);
  if (!account) throw new ApiError(401, "login_required", "Sign in to see your rooms.");
  const now = unixSeconds();
  const query = await env.DB
    .prepare(
      `SELECT
         c.room_name, c.art_house, c.created_at, c.expires_at, c.public_token, c.moderation_status, c.last_found_image, c.is_live,
         COUNT(a.id) AS attempt_count,
         COALESCE(SUM(a.found), 0) AS found_count,
         COALESCE(CAST(AVG(CASE WHEN a.found = 1 THEN a.elapsed_ms END) AS INTEGER), 0) AS average_find_ms
       FROM challenges c
       LEFT JOIN attempts a ON a.challenge_id = c.id
       WHERE c.creator_account_id = ? AND c.expires_at > ?
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT 50`,
    )
    .bind(account.id, now)
    .all();
  const rooms = (query.results ?? []).map(row => ({
    playUrl: row.public_token ? buildPlayUrl(env, url, String(row.public_token)) : null,
    roomName: String(row.room_name || "Sunny Garden"),
    artHouse: String(row.art_house || "van-gogh-house"),
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
    listingStatus: listingStatus({ public_token: row.public_token, moderation_status: row.moderation_status }),
    attemptCount: Number(row.attempt_count ?? 0),
    foundCount: Number(row.found_count ?? 0),
    averageFindMs: Number(row.average_find_ms ?? 0),
    lastFoundImage: row.last_found_image ?? null,
    isLive: Boolean(row.is_live),
  }));
  return jsonResponse({ rooms });
}

// --- Entitlements (paid access) -------------------------------------------

/** Active product_ids the account owns (from the 0005 entitlements table). */
async function activeProducts(database, accountId) {
  if (!accountId) return new Set();
  const rows = await database
    .prepare("SELECT product_id FROM entitlements WHERE account_id = ? AND status = 'active'")
    .bind(accountId)
    .all();
  return new Set((rows.results ?? []).map((row) => String(row.product_id)));
}

async function getAccountEntitlements(request, database) {
  const account = await currentAccount(request, database);
  if (!account) throw new ApiError(401, "login_required", "Sign in to see your purchases.");
  const unlocked = await accountHasUnlock(database, account.id);
  return jsonResponse({ unlocked, unlockProduct: UNLOCK_PRODUCT });
}

// Write an active one-time-unlock entitlement. Idempotent on
// (source_provider, source_reference): a re-delivered webhook or re-run grant
// just re-activates the same row instead of duplicating.
async function grantUnlockEntitlement(database, accountId, provider, sourceReference) {
  const now = unixSeconds();
  await database
    .prepare(
      `INSERT INTO entitlements (id, account_id, product_id, source_provider, source_reference, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
       ON CONFLICT(source_provider, source_reference) DO UPDATE SET status='active', updated_at=excluded.updated_at`,
    )
    .bind(crypto.randomUUID(), accountId, UNLOCK_PRODUCT, provider, sourceReference, now, now)
    .run();
}

// LOCAL-ONLY: grant the unlock so the paid flow is testable before real checkout
// is wired. Gated by isLocalRuntime; never a real purchase path.
async function devGrantEntitlement(request, database) {
  const account = await currentAccount(request, database);
  if (!account) throw new ApiError(401, "login_required", "Sign in first.");
  await grantUnlockEntitlement(database, account.id, "grant", `dev:${account.id}:${UNLOCK_PRODUCT}`);
  return getAccountEntitlements(request, database);
}

// Start a Stripe Checkout Session for the one-time unlock. Uses raw fetch to the
// Stripe API (no SDK — keeps the Worker light). This only OPENS hosted checkout;
// the webhook is what actually grants the entitlement on payment.
async function createCheckoutSession(request, env, url) {
  const account = await currentAccount(request, env.DB);
  if (!account) throw new ApiError(401, "login_required", "Sign in before unlocking.");
  const secret = env.STRIPE_SECRET_KEY;
  if (!secret) throw new ApiError(503, "checkout_unavailable", "Checkout is not configured yet.");
  if (await accountHasUnlock(env.DB, account.id)) return jsonResponse({ alreadyUnlocked: true });
  const body = await readJson(request).catch(() => ({}));
  const returnArt = typeof body.artHouse === "string" ? body.artHouse : "";
  const successUrl = `${url.origin}/?unlocked=1${returnArt ? `&art=${encodeURIComponent(returnArt)}` : ""}`;
  // Item name + description shown on the Stripe checkout page. The client sends
  // them already localized; fall back to clear English. This IS the "payment
  // prompt" the buyer reads, so keep it explicit: paid = hiding, seeking is free.
  const clip = (value, fallback) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, 140) : fallback;
  const itemName = clip(body.name, "Painterly Chameleon — unlock all rooms to hide in");
  const itemNote = clip(body.note, "One-time unlock. Hide in every room. Seeking a friend's room is always free.");
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("locale", "auto");
  form.set("success_url", successUrl);
  form.set("cancel_url", `${url.origin}/`);
  form.set("client_reference_id", account.id);
  form.set("metadata[account_id]", account.id);
  form.set("metadata[product]", UNLOCK_PRODUCT);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][unit_amount]", String(UNLOCK_PRICE_CENTS));
  form.set("line_items[0][price_data][product_data][name]", itemName);
  form.set("line_items[0][price_data][product_data][description]", itemNote);
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    console.error("Stripe checkout session failed", res.status, data?.error?.message);
    throw new ApiError(502, "checkout_failed", "Could not start checkout. Please try again.");
  }
  return jsonResponse({ url: data.url });
}

// Stripe webhook — the ONLY place a real purchase grants the unlock. Verifies the
// endpoint signature, then on a paid one-time checkout writes an active bundle
// entitlement keyed by the payment_intent (so a later charge.refunded can revoke
// the same row). Always 200s on handled events so Stripe doesn't retry forever.
async function handleStripeWebhook(request, env) {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new ApiError(503, "webhook_unavailable", "Webhook is not configured.");
  const payload = await request.text();
  const signature = request.headers.get("Stripe-Signature") || "";
  if (!(await verifyStripeSignature(payload, signature, secret))) {
    throw new ApiError(400, "bad_signature", "Invalid webhook signature.");
  }
  let event;
  try { event = JSON.parse(payload); } catch { throw new ApiError(400, "bad_payload", "Invalid JSON."); }
  const type = event?.type;
  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
    const s = event.data?.object ?? {};
    const paid = s.payment_status === "paid" || type === "checkout.session.async_payment_succeeded";
    const accountId = s.client_reference_id || s.metadata?.account_id || "";
    const sourceRef = s.payment_intent || s.id || event.id;
    if (paid && accountId && sourceRef) {
      await grantUnlockEntitlement(env.DB, accountId, "stripe", String(sourceRef));
    }
  } else if (type === "charge.refunded") {
    const ch = event.data?.object ?? {};
    const ref = ch.payment_intent || ch.id;
    if (ref) {
      await env.DB
        .prepare("UPDATE entitlements SET status='refunded', updated_at=? WHERE source_provider='stripe' AND source_reference=?")
        .bind(unixSeconds(), String(ref))
        .run();
    }
  }
  return jsonResponse({ received: true });
}

async function requestOtp(request, env, url) {
  const input = await readJson(request);
  const email = normalizeEmail(input.email);
  if (!email) throw new ApiError(400, "invalid_email", "Enter a valid email address.");

  const local = isLocalRuntime(env, url);
  if (!local && !env.EMAIL) {
    throw new ApiError(503, "email_unavailable", "Email sign-in is temporarily unavailable.");
  }
  const signingKey = env.SESSION_SIGNING_KEY || (local ? LOCAL_SESSION_SIGNING_KEY : "");
  if (!signingKey) {
    throw new ApiError(503, "security_unavailable", "The security service is not configured.");
  }

  const now = unixSeconds();
  const existing = await env.DB
    .prepare("SELECT created_at, expires_at FROM auth_otp_codes WHERE email = ?")
    .bind(email)
    .first();
  if (!local && existing?.expires_at > now && existing.created_at > now - OTP_RESEND_SECONDS) {
    return jsonResponse({ ok: true, expiresInSeconds: Math.max(1, existing.expires_at - now), resent: false });
  }

  const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const codeHash = await otpHash(email, otp, signingKey);
  const expiresAt = now + OTP_TTL_SECONDS;
  await env.DB
    .prepare(
      `INSERT INTO auth_otp_codes (email, code_hash, attempts, created_at, expires_at)
       VALUES (?, ?, 0, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         code_hash = excluded.code_hash,
         attempts = 0,
         created_at = excluded.created_at,
         expires_at = excluded.expires_at`,
    )
    .bind(email, codeHash, now, expiresAt)
    .run();

  if (local) {
    return jsonResponse({ ok: true, expiresInSeconds: OTP_TTL_SECONDS, devOtp: otp });
  }

  try {
    await env.EMAIL.send({
      to: email,
      from: { email: env.OTP_FROM_ADDRESS || "noreply@lucasacademy.org", name: "Painterly Chameleon" },
      subject: `${otp} is your Painterly Chameleon code`,
      text: `Your Painterly Chameleon sign-in code is ${otp}. It expires in 10 minutes. If you did not request it, you can ignore this email.`,
      html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#171827"><p style="margin:0 0 16px">Your Painterly Chameleon sign-in code:</p><p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:0 0 16px;color:#9b742c">${otp}</p><p style="font-size:13px;color:#666;margin:0">It expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
    });
  } catch (error) {
    console.error("OTP email could not be sent", error);
    await env.DB.prepare("DELETE FROM auth_otp_codes WHERE email = ?").bind(email).run();
    throw new ApiError(502, "email_send_failed", "The code could not be sent. Try again in a moment.");
  }

  return jsonResponse({ ok: true, expiresInSeconds: OTP_TTL_SECONDS });
}

async function verifyOtp(request, env, url) {
  const input = await readJson(request);
  const email = normalizeEmail(input.email);
  const code = String(input.otp ?? "").trim();
  const preferredLocale = normalizeLocale(input.locale);
  if (!email || !/^\d{6}$/u.test(code)) {
    throw new ApiError(400, "invalid_otp", "Enter the six-digit code from the email.");
  }
  const signingKey = env.SESSION_SIGNING_KEY || (isLocalRuntime(env, url) ? LOCAL_SESSION_SIGNING_KEY : "");
  if (!signingKey) {
    throw new ApiError(503, "security_unavailable", "The security service is not configured.");
  }

  const now = unixSeconds();
  const stored = await env.DB
    .prepare("SELECT code_hash, attempts, expires_at FROM auth_otp_codes WHERE email = ?")
    .bind(email)
    .first();
  if (!stored || stored.expires_at <= now) {
    if (stored) await env.DB.prepare("DELETE FROM auth_otp_codes WHERE email = ?").bind(email).run();
    throw new ApiError(400, "otp_expired", "That code expired. Ask for a new one.");
  }
  if (stored.attempts >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, "too_many_attempts", "Too many guesses. Ask for a new code.");
  }

  const candidate = await otpHash(email, code, signingKey);
  if (!await safeSecretEqual(candidate, stored.code_hash)) {
    await env.DB
      .prepare("UPDATE auth_otp_codes SET attempts = MIN(attempts + 1, ?) WHERE email = ?")
      .bind(OTP_MAX_ATTEMPTS, email)
      .run();
    throw new ApiError(400, "otp_mismatch", "That code does not match.");
  }

  let identity = await env.DB
    .prepare("SELECT account_id FROM auth_identities WHERE provider = 'email' AND provider_subject = ?")
    .bind(email)
    .first();
  let accountId = identity?.account_id;
  if (!accountId) {
    accountId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO accounts (id, preferred_locale, created_at, updated_at) VALUES (?, ?, ?, ?)",
      ).bind(accountId, preferredLocale, now, now),
      env.DB.prepare(
        `INSERT INTO auth_identities (account_id, provider, provider_subject, verified_at, created_at)
         VALUES (?, 'email', ?, ?, ?)`,
      ).bind(accountId, email, now, now),
    ]);
  } else {
    await env.DB
      .prepare("UPDATE accounts SET preferred_locale = COALESCE(?, preferred_locale), updated_at = ? WHERE id = ?")
      .bind(preferredLocale, now, accountId)
      .run();
  }

  const sessionToken = randomToken(32);
  const expiresAt = now + ACCOUNT_SESSION_SECONDS;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_otp_codes WHERE email = ?").bind(email),
    env.DB.prepare(
      "INSERT INTO account_sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    ).bind(await sha256Hex(sessionToken), accountId, now, expiresAt),
  ]);

  const headers = new Headers();
  headers.append("Set-Cookie", accountSessionCookie(sessionToken, runtimeHostname(env, url), ACCOUNT_SESSION_SECONDS));
  return jsonResponse({ account: { id: accountId, email, providers: ["email"], preferredLocale } }, { headers });
}

async function logoutAccount(request, database, env, url) {
  const token = accountSessionToken(request);
  if (token) {
    await database
      .prepare("UPDATE account_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
      .bind(unixSeconds(), await sha256Hex(token))
      .run();
  }
  const headers = new Headers();
  headers.append("Set-Cookie", accountSessionCookie("", runtimeHostname(env, url), 0));
  return jsonResponse({ ok: true }, { headers });
}

async function currentAccount(request, database) {
  const token = accountSessionToken(request);
  if (!token) return null;
  return database
    .prepare(
      `SELECT
         a.id,
         a.status,
         a.preferred_locale,
         (SELECT provider_subject FROM auth_identities
          WHERE account_id = a.id AND provider = 'email' LIMIT 1) AS email
       FROM account_sessions s
       JOIN accounts a ON a.id = s.account_id
       WHERE s.token_hash = ?
         AND s.revoked_at IS NULL
         AND s.expires_at > ?
         AND a.status = 'active'
       LIMIT 1`,
    )
    .bind(await sha256Hex(token), unixSeconds())
    .first();
}

function publicAccount(account) {
  return {
    id: account.id,
    email: account.email,
    providers: account.email ? ["email"] : [],
    preferredLocale: account.preferred_locale || null,
  };
}

async function getChallenge(token, database, context) {
  const challenge = await findChallenge(token, database);
  if (!challenge) return errorResponse(404, "challenge_not_found", "Challenge not found.");
  if (isExpired(challenge)) {
    context.waitUntil(deleteChallengeById(database, challenge.id));
    return errorResponse(410, "challenge_expired", "This challenge has expired.");
  }

  // Public aggregate stats, shown on the seeker page under Close Look. These
  // are the same non-sensitive numbers the Lobby feed already exposes.
  const stats = await database
    .prepare(
      `SELECT
         COUNT(*) AS attempt_count,
         COALESCE(SUM(found), 0) AS found_count,
         COALESCE(CAST(AVG(CASE WHEN found = 1 THEN elapsed_ms END) AS INTEGER), 0) AS average_find_ms
       FROM attempts
       WHERE challenge_id = ?`,
    )
    .bind(challenge.id)
    .first();

  return jsonResponse({
    challenge: {
      payload: safeJsonParse(challenge.payload_json),
      roomName: challenge.room_name,
      isLive: Boolean(challenge.is_live),
      createdAt: challenge.created_at,
      expiresAt: challenge.expires_at,
      attemptCount: Number(stats?.attempt_count ?? 0),
      foundCount: Number(stats?.found_count ?? 0),
      averageFindMs: Number(stats?.average_find_ms ?? 0),
    },
  });
}

async function recordAttempt(token, request, database, context) {
  const input = validateAttemptInput(await readJson(request));
  if (!input.ok) throw new ApiError(400, "invalid_attempt", input.error);

  const challenge = await findChallenge(token, database);
  if (!challenge) return errorResponse(404, "challenge_not_found", "Challenge not found.");
  if (isExpired(challenge)) {
    context.waitUntil(deleteChallengeById(database, challenge.id));
    return errorResponse(410, "challenge_expired", "This challenge has expired.");
  }

  const payload = safeJsonParse(challenge.payload_json);
  const found = !input.value.gaveUp && attemptFindsChallenge(payload, input.value);
  const now = unixSeconds();
  const result = await database
    .prepare(
      `INSERT OR IGNORE INTO attempts
        (id, challenge_id, found, elapsed_ms, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      input.value.attemptId,
      challenge.id,
      found ? 1 : 0,
      input.value.elapsedMs,
      now,
    )
    .run();
  const accepted = result.meta.changes === 1;

  // Keep only the newest successful find's screenshot, and only for a genuinely
  // new attempt (INSERT OR IGNORE dedupes retries by attemptId).
  if (accepted && found && input.value.foundImage) {
    await database
      .prepare("UPDATE challenges SET last_found_image = ?, last_found_at = ? WHERE id = ?")
      .bind(input.value.foundImage, now, challenge.id)
      .run();
  }

  return jsonResponse(
    { accepted, found },
    { status: accepted ? 201 : 200 },
  );
}

async function reportChallenge(token, request, database, context, cacheOrigin) {
  const input = validateReportInput(await readJson(request));
  if (!input.ok) throw new ApiError(400, "invalid_report", input.error);

  const challenge = await findChallenge(token, database);
  if (!challenge) return errorResponse(404, "challenge_not_found", "Challenge not found.");
  if (isExpired(challenge)) {
    context.waitUntil(deleteChallengeById(database, challenge.id));
    return errorResponse(410, "challenge_expired", "This challenge has expired.");
  }

  const result = await database
    .prepare(
      `INSERT OR IGNORE INTO challenge_reports
        (id, challenge_id, reason, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(input.value.reportId, challenge.id, input.value.reason, unixSeconds())
    .run();
  const accepted = result.meta.changes === 1;

  if (accepted && challenge.moderation_status !== "hidden") {
    await database
      .prepare("UPDATE challenges SET moderation_status = 'hidden', moderation_reviewed_at = NULL WHERE id = ?")
      .bind(challenge.id)
      .run();
    if (challenge.public_token) await invalidateExploreCache(cacheOrigin);
  }

  return jsonResponse(
    {
      accepted,
      hiddenFromExplore: Boolean(challenge.public_token),
    },
    { status: accepted ? 201 : 200 },
  );
}

async function getModerationQueue(database, origin) {
  const now = unixSeconds();
  const query = await database
    .prepare(
      `WITH queue AS (
         SELECT c.id, c.public_token, c.created_at, c.expires_at, MAX(r.created_at) AS last_report_at
         FROM challenges c
         JOIN challenge_reports r ON r.challenge_id = c.id
         WHERE c.public_token IS NOT NULL
           AND c.moderation_status = 'hidden'
           AND c.moderation_reviewed_at IS NULL
           AND c.expires_at > ?
         GROUP BY c.id
         ORDER BY last_report_at DESC
         LIMIT 50
       )
       SELECT q.id, q.public_token, q.created_at, q.expires_at, q.last_report_at, r.reason
       FROM queue q
       JOIN challenge_reports r ON r.challenge_id = q.id
       ORDER BY q.last_report_at DESC, r.created_at DESC`,
    )
    .bind(now)
    .all();

  const queue = [];
  const byId = new Map();
  for (const row of query.results ?? []) {
    let item = byId.get(row.id);
    if (!item) {
      item = {
        challengeId: String(row.id),
        playUrl: `${origin}/?c=${encodeURIComponent(String(row.public_token))}`,
        createdAt: Number(row.created_at),
        expiresAt: Number(row.expires_at),
        lastReportAt: Number(row.last_report_at),
        reportCount: 0,
        reasons: { not_okay: 0, broken: 0, other: 0 },
      };
      byId.set(row.id, item);
      queue.push(item);
    }
    const reason = String(row.reason);
    if (Object.hasOwn(item.reasons, reason)) item.reasons[reason] += 1;
    item.reportCount += 1;
  }

  const audits = await database
    .prepare(
      `SELECT challenge_id, action, report_count, reasons_json, created_at
       FROM moderation_audit
       ORDER BY created_at DESC, rowid DESC
       LIMIT 25`,
    )
    .all();

  return jsonResponse({
    queue,
    recentActions: (audits.results ?? []).map(row => ({
      challengeId: String(row.challenge_id),
      action: String(row.action),
      reportCount: Number(row.report_count),
      reasons: safeJsonParse(row.reasons_json),
      createdAt: Number(row.created_at),
    })),
  });
}

async function moderateChallenge(challengeId, request, database, cacheOrigin) {
  const input = validateModerationActionInput(await readJson(request));
  if (!input.ok) throw new ApiError(400, "invalid_moderation_action", input.error);
  const now = unixSeconds();
  const challenge = await database
    .prepare(
      `SELECT id, public_token, expires_at
       FROM challenges
       WHERE id = ?
         AND public_token IS NOT NULL
         AND moderation_status = 'hidden'
         AND moderation_reviewed_at IS NULL
       LIMIT 1`,
    )
    .bind(challengeId)
    .first();
  if (!challenge) return errorResponse(404, "moderation_item_not_found", "That moderation item is no longer pending.");
  if (challenge.expires_at <= now) {
    await deleteChallengeById(database, challenge.id);
    return errorResponse(410, "challenge_expired", "That challenge has expired.");
  }

  const reports = await database
    .prepare("SELECT reason FROM challenge_reports WHERE challenge_id = ?")
    .bind(challenge.id)
    .all();
  const reasons = { not_okay: 0, broken: 0, other: 0 };
  for (const row of reports.results ?? []) {
    const reason = String(row.reason);
    if (Object.hasOwn(reasons, reason)) reasons[reason] += 1;
  }
  const audit = database
    .prepare(
      `INSERT INTO moderation_audit
        (id, challenge_id, action, report_count, reasons_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      challenge.id,
      input.value.action,
      reports.results?.length ?? 0,
      JSON.stringify(reasons),
      now,
    );
  const update = input.value.action === "restore"
    ? database.prepare(
      "UPDATE challenges SET moderation_status = 'visible', moderation_reviewed_at = ? WHERE id = ?",
    ).bind(now, challenge.id)
    : database.prepare(
      "UPDATE challenges SET moderation_reviewed_at = ? WHERE id = ?",
    ).bind(now, challenge.id);
  await database.batch([update, audit]);
  if (input.value.action === "restore") await invalidateExploreCache(cacheOrigin);

  return jsonResponse({
    action: input.value.action,
    listingStatus: input.value.action === "restore" ? "listed" : "hidden",
  });
}

async function getResults(token, request, database, context) {
  const challenge = await findOwnedChallenge(token, bearerToken(request), database);
  if (!challenge) return errorResponse(403, "forbidden", "The Hider key is missing or invalid.");
  if (isExpired(challenge)) {
    context.waitUntil(deleteChallengeById(database, challenge.id));
    return errorResponse(410, "challenge_expired", "This challenge has expired.");
  }

  const results = await database
    .prepare(
      `SELECT
         COUNT(*) AS attempt_count,
         COALESCE(SUM(found), 0) AS found_count,
         COALESCE(CAST(AVG(CASE WHEN found = 1 THEN elapsed_ms END) AS INTEGER), 0) AS average_find_ms
       FROM attempts
       WHERE challenge_id = ?`,
    )
    .bind(challenge.id)
    .first();

  return jsonResponse({
    results: {
      attemptCount: Number(results?.attempt_count ?? 0),
      foundCount: Number(results?.found_count ?? 0),
      averageFindMs: Number(results?.average_find_ms ?? 0),
      expiresAt: challenge.expires_at,
      isPublic: listingStatus(challenge) === "listed",
      listingStatus: listingStatus(challenge),
      roomName: challenge.room_name,
      isLive: Boolean(challenge.is_live),
      lastFoundImage: challenge.last_found_image ?? null,
    },
  });
}

async function removeFromExplore(token, request, database, context, cacheOrigin) {
  const challenge = await findOwnedChallenge(token, bearerToken(request), database);
  if (!challenge) return errorResponse(403, "forbidden", "The Hider key is missing or invalid.");
  if (isExpired(challenge)) {
    context.waitUntil(deleteChallengeById(database, challenge.id));
    return errorResponse(410, "challenge_expired", "This challenge has expired.");
  }

  if (challenge.public_token) {
    await database.prepare("UPDATE challenges SET public_token = NULL WHERE id = ?").bind(challenge.id).run();
    await invalidateExploreCache(cacheOrigin);
  }
  return new Response(null, { status: 204, headers: apiHeaders() });
}

// Put a hide back on the Lobby (the share modal's toggle flipping ON). The
// public token IS the invitation token (same as at create), so relisting simply
// restores it. Moderation-hidden hides can't relist themselves.
async function restoreToExplore(token, request, database, context, cacheOrigin) {
  const challenge = await findOwnedChallenge(token, bearerToken(request), database);
  if (!challenge) return errorResponse(403, "forbidden", "The Hider key is missing or invalid.");
  if (isExpired(challenge)) {
    context.waitUntil(deleteChallengeById(database, challenge.id));
    return errorResponse(410, "challenge_expired", "This challenge has expired.");
  }
  if (challenge.moderation_status !== "visible") {
    return errorResponse(409, "hidden_by_moderation", "This hide was reported and can't rejoin the lobby.");
  }

  if (!challenge.public_token) {
    await database.prepare("UPDATE challenges SET public_token = ? WHERE id = ?").bind(token, challenge.id).run();
    await invalidateExploreCache(cacheOrigin);
  }
  return new Response(null, { status: 204, headers: apiHeaders() });
}

async function deleteChallenge(token, request, database, context, cacheOrigin) {
  const challenge = await findOwnedChallenge(token, bearerToken(request), database);
  if (!challenge) return errorResponse(403, "forbidden", "The Hider key is missing or invalid.");
  await deleteChallengeById(database, challenge.id);
  if (challenge.public_token) context.waitUntil(invalidateExploreCache(cacheOrigin));
  return new Response(null, { status: 204, headers: apiHeaders() });
}

async function findChallenge(token, database) {
  return database
    .prepare(
      `SELECT id, payload_json, room_name, created_at, expires_at, public_token, moderation_status, is_live
       FROM challenges
       WHERE token_hash = ?
       LIMIT 1`,
    )
    .bind(await sha256Hex(token))
    .first();
}

async function findOwnedChallenge(token, hiderKey, database) {
  if (!hiderKey) return null;
  return database
    .prepare(
      `SELECT id, room_name, created_at, expires_at, public_token, moderation_status, last_found_image, is_live
       FROM challenges
       WHERE token_hash = ? AND hider_key_hash = ?
       LIMIT 1`,
    )
    .bind(await sha256Hex(token), await sha256Hex(hiderKey))
    .first();
}

async function deleteExpiredChallenges(database, now) {
  let deleted = 0;
  for (let batch = 0; batch < 10; batch += 1) {
    const result = await database
      .prepare(
        `DELETE FROM challenges
         WHERE id IN (
           SELECT id FROM challenges
           WHERE expires_at <= ?
           ORDER BY expires_at
           LIMIT 500
         )`,
      )
      .bind(now)
      .run();
    deleted += result.meta.changes;
    if (result.meta.changes < 500) break;
  }
  console.log(JSON.stringify({ event: "challenge_cleanup", deleted, at: now }));
}

async function deleteExpiredModerationAudits(database, now) {
  const result = await database
    .prepare("DELETE FROM moderation_audit WHERE created_at <= ?")
    .bind(now - MODERATION_AUDIT_TTL_SECONDS)
    .run();
  console.log(JSON.stringify({ event: "moderation_audit_cleanup", deleted: result.meta.changes, at: now }));
}

async function deleteExpiredAuthState(database, now) {
  const results = await database.batch([
    database.prepare("DELETE FROM auth_otp_codes WHERE expires_at <= ?").bind(now),
    database.prepare("DELETE FROM account_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL").bind(now),
  ]);
  console.log(JSON.stringify({
    event: "auth_cleanup",
    otpDeleted: results[0]?.meta?.changes ?? 0,
    sessionsDeleted: results[1]?.meta?.changes ?? 0,
    at: now,
  }));
}

function deleteChallengeById(database, id) {
  return database.prepare("DELETE FROM challenges WHERE id = ?").bind(id).run();
}

function exploreCacheKey(origin) {
  return new Request(`${origin}/api/explore?cache-version=${encodeURIComponent(EXPLORE_CACHE_VERSION)}`);
}

function exploreSearchCacheKey(origin, query) {
  const url = new URL("/api/explore", origin);
  url.searchParams.set("q", query);
  url.searchParams.set("cache-version", EXPLORE_CACHE_VERSION);
  return new Request(url);
}

async function invalidateExploreCache(origin) {
  const cache = globalThis.caches?.default;
  if (cache) await cache.delete(exploreCacheKey(origin));
}

function findRate(challenge) {
  return challenge.attemptCount ? challenge.foundCount / challenge.attemptCount : 1;
}

function shuffled(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 0x1_0000_0000;
    const swap = Math.floor(random * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function withCacheStatus(response, status) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-PC-Cache", status);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function readJson(request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, "body_too_large", "Request body is too large.");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, "body_too_large", "Request body is too large.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

function bearerToken(request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

function accountSessionToken(request) {
  const cookie = readCookie(request.headers.get("cookie") ?? "", ACCOUNT_SESSION_COOKIE);
  return cookie || bearerToken(request);
}

function accountSessionCookie(token, hostname, maxAge) {
  const attributes = [
    `${ACCOUNT_SESSION_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (!isLocalHostname(hostname)) attributes.push("Secure");
  return attributes.join("; ");
}

function readCookie(header, name) {
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return "";
}

function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  return email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email) ? email : "";
}

function normalizeLocale(value) {
  const locale = String(value ?? "").trim();
  return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/u.test(locale) ? locale.slice(0, 16) : null;
}

function otpHash(email, otp, signingKey) {
  return sha256Hex(`${email}:${otp}:${signingKey}:painterly-otp-v1`);
}

function randomToken(byteLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    throw new ApiError(500, "invalid_stored_challenge", "Stored challenge data is invalid.");
  }
}

function isExpired(challenge) {
  return challenge.expires_at <= unixSeconds();
}

function listingStatus(challenge) {
  if (!challenge.public_token) return "private";
  return challenge.moderation_status === "hidden" ? "hidden" : "listed";
}

function allowedMethods(action) {
  if (action === "attempts") return "POST";
  if (action === "reports") return "POST";
  if (action === "results") return "GET";
  if (action === "publication") return "POST, DELETE";
  return "GET, DELETE";
}

async function enforceRateLimit(limiter, scope, sessionId) {
  if (!limiter?.limit) return;
  const result = await limiter.limit({ key: `${scope}:session:${sessionId}` });
  if (!result.success) {
    throw new ApiError(
      429,
      "rate_limited",
      "That was a lot at once. Give it a minute, then try again.",
      { "Retry-After": "60" },
    );
  }
}

function parseAdminPath(pathname) {
  if (pathname === "/api/admin/moderation") return { action: "list", challengeId: null };
  const match = pathname.match(/^\/api\/admin\/moderation\/([A-Za-z0-9-]{8,80})\/actions$/u);
  return match ? { action: "action", challengeId: match[1] } : null;
}

async function requireAdmin(request, env, url) {
  const expected = env.ADMIN_TOKEN || (isLocalRuntime(env, url) ? LOCAL_ADMIN_TOKEN : "");
  if (!expected || !await safeSecretEqual(bearerToken(request), expected)) {
    throw new ApiError(403, "forbidden", "The administrator token is missing or invalid.");
  }
}

function turnstileSettings(env, url) {
  const local = isLocalRuntime(env, url);
  const useLocalTestKeys = local && !env.TURNSTILE_SECRET_KEY;
  return {
    siteKey: useLocalTestKeys ? TEST_TURNSTILE_SITE_KEY : (env.TURNSTILE_SITE_KEY || ""),
    secret: useLocalTestKeys ? TEST_TURNSTILE_SECRET_KEY : (env.TURNSTILE_SECRET_KEY || ""),
    expectedHostname: useLocalTestKeys ? runtimeHostname(env, url) : (env.TURNSTILE_ALLOWED_HOSTNAME || ""),
    allowTestValues: useLocalTestKeys,
  };
}

function isLocalRuntime(env, url) {
  return env.LOCAL_DEV === "true" || isLocalHostname(url.hostname);
}

function runtimeHostname(env, url) {
  return isLocalRuntime(env, url) ? "localhost" : url.hostname;
}

// Web origin the Hider manages on (always web; localhost in local dev).
function manageOrigin(env, url) {
  return isLocalRuntime(env, url) ? url.origin : (env.PUBLIC_ORIGIN ?? url.origin);
}

// The shareable play link (also what the QR encodes). Configurable per platform
// via SHARE_LINK_TEMPLATE (a full URL with a `{token}` placeholder) so a future
// platform can point the QR at a deep link / different URL shape. Local dev
// always uses the runtime origin so the link/QR work against the dev server.
function buildPlayUrl(env, url, token) {
  const encoded = encodeURIComponent(token);
  if (isLocalRuntime(env, url)) return `${url.origin}/?c=${encoded}`;
  const template = env.SHARE_LINK_TEMPLATE;
  if (template && template.includes("{token}")) return template.replaceAll("{token}", encoded);
  return `${env.PUBLIC_ORIGIN ?? url.origin}/?c=${encoded}`;
}

async function enforceTurnstile(request, env, url, expectedAction) {
  const settings = turnstileSettings(env, url);
  if (!settings.siteKey || !settings.secret || !settings.expectedHostname) {
    throw new ApiError(503, "security_unavailable", "The security check is not configured.");
  }
  const verification = await verifyTurnstileToken({
    token: request.headers.get("x-turnstile-token") ?? "",
    secret: settings.secret,
    expectedAction,
    expectedHostname: settings.expectedHostname,
    allowTestValues: settings.allowTestValues,
  });
  if (!verification.ok) {
    console.warn(JSON.stringify({
      event: "turnstile_rejected",
      reason: verification.reason,
      expectedAction,
      receivedAction: verification.receivedAction ?? null,
      receivedHostname: verification.receivedHostname ?? null,
      errors: verification.errors ?? [],
    }));
    const unavailable = verification.reason === "siteverify_unavailable" || verification.reason === "missing_secret";
    throw new ApiError(
      unavailable ? 503 : 403,
      unavailable ? "security_unavailable" : "turnstile_failed",
      unavailable
        ? "The security check is temporarily unavailable. Try again in a moment."
        : "The security check expired or did not pass. Please try again.",
    );
  }
}

function withSessionCookie(response, session, corsHeaders = {}) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);
  if (session?.setCookie) headers.append("Set-Cookie", session.setCookie);
  // Exposed only on an explicitly allowed cross-origin request. It is a
  // signed anonymous rate-limit token, not an account session.
  if (corsHeaders["Access-Control-Allow-Origin"] && session?.sessionToken) {
    headers.set("X-PC-Session", session.sessionToken);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function apiCorsPolicy(request, env, url) {
  const origin = request.headers.get("Origin");
  if (!origin || origin === url.origin) return { allowed: true, headers: {} };

  const allowedOrigins = String(env.ITCH_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  if (!allowedOrigins.includes(origin)) return { allowed: false, headers: {} };

  return {
    allowed: true,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type, X-PC-Session, X-Turnstile-Token",
      "Access-Control-Expose-Headers": "X-PC-Session",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  };
}

function corsPreflightResponse(headers) {
  return new Response(null, { status: 204, headers });
}

function jsonResponse(body, init = {}) {
  const headers = new Headers(apiHeaders());
  for (const [name, value] of new Headers(init.headers)) headers.set(name, value);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function errorResponse(status, code, message, extraHeaders = {}) {
  return jsonResponse({ error: { code, message } }, { status, headers: extraHeaders });
}

function apiHeaders() {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

class ApiError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}
