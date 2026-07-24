import { normalizeRoomName } from "./roomNames.js";

export const CHALLENGE_TTL_SECONDS = 86_400;
// Roomy enough for an avatar (≤80k), a found screenshot (≤60k), and the tiny
// obscured preview (≤14k), with headroom for the JSON envelope.
export const MAX_JSON_BODY_BYTES = 160_000;
export const MAX_ELAPSED_MS = 600_000;
export const MAX_AVATAR_DATA_LENGTH = 80_000;
// Per-challenge screenshots, stored in D1, so keep them as small as the game
// actually displays. The preview is the one public-safe, obscured image shown
// everywhere (Lobby thumbnail + share view) and rides the Explore feed once per
// challenge, so it's tiny; the found shot is shown larger and only once.
export const MAX_PREVIEW_DATA_LENGTH = 14_000;
export const MAX_FOUND_DATA_LENGTH = 60_000;

const ATTEMPT_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const REPORT_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const AVATAR_DATA_PATTERN = /^data:image\/(?:webp|png);base64,[A-Za-z0-9+/]+={0,2}$/;
const SNAPSHOT_DATA_PATTERN = /^data:image\/(?:jpeg|webp|png);base64,[A-Za-z0-9+/]+={0,2}$/;
const POSES = Object.freeze(["stand", "curl", "flat"]);
const ART_HOUSES = Object.freeze(["van-gogh-house", "monet-garden-house", "outdoor-masters-journey", "world-remembers-color", "luminous-tide-dreamscape", "unfinished-morning"]);
const LIVE_ART_HOUSES = Object.freeze(["van-gogh-house", "unfinished-morning"]);
// Released ids stay accepted across both Live houses for backwards
// compatibility. Each Studio exposes only its owner-selected room menu.
const LIVE_BRUSHES = Object.freeze([
  "blue-current",
  "liquid-color",
  "graphite-whisper",
  "firefly",
  "growth",
  "color-liquify-splash",
]);
const MAX_LIVE_PAINT_MARKS = 320;
const REPORT_REASONS = Object.freeze(["not_okay", "broken", "other"]);
const MODERATION_ACTIONS = Object.freeze(["restore", "confirm_hidden"]);

export function validateChallengeInput(value) {
  if (!isRecord(value)) return invalid("Request body must be a JSON object.");

  const { version, artHouse, surface, artSeed, roomIndex, x, y, pose, avatarData } = value;
  const roomName = normalizeRoomName(value.roomName);
  const isPublic = value.isPublic === true;

  if (version !== 1) return invalid("version must be 1.");
  if (!ART_HOUSES.includes(artHouse)) return invalid(`artHouse must be one of: ${ART_HOUSES.join(", ")}.`);
  if (!Number.isInteger(surface) || surface < 0 || surface > 2) return invalid("surface must be 0, 1 or 2.");
  if (!Number.isInteger(artSeed) || artSeed < 0 || artSeed > 2_147_483_647) {
    return invalid("artSeed must be an integer from 0 to 2147483647.");
  }
  if (!Number.isInteger(roomIndex) || roomIndex < 0 || roomIndex > 2) return invalid("roomIndex must be 0, 1 or 2.");
  if (!Number.isInteger(x) || x < 0 || x > 960) return invalid("x must be an integer from 0 to 960.");
  if (!Number.isInteger(y) || y < 0 || y > 640) return invalid("y must be an integer from 0 to 640.");
  if (!POSES.includes(pose)) return invalid(`pose must be one of: ${POSES.join(", ")}.`);
  if (typeof avatarData !== "string" || avatarData.length > MAX_AVATAR_DATA_LENGTH || !AVATAR_DATA_PATTERN.test(avatarData)) {
    return invalid("avatarData must be a small base64 WebP or PNG image.");
  }
  if (value.isPublic !== undefined && typeof value.isPublic !== "boolean") {
    return invalid("isPublic must be a boolean when present.");
  }
  if (!roomName) return invalid("roomName must be two words from the kid-safe room vocabulary.");

  const preview = normalizeSnapshot(value.previewImage, MAX_PREVIEW_DATA_LENGTH, "preview");
  if (preview.error) return invalid(preview.error);

  const live = normalizeLivePainting(value.livePainting, artHouse);
  if (live.error) return invalid(live.error);

  const result = { version, artHouse, surface, artSeed, roomIndex, x, y, pose, avatarData, roomName, isPublic };
  // Only attach when present so callers with no screenshot keep the exact
  // legacy value shape.
  if (preview.value) result.previewImage = preview.value;
  if (live.value) result.livePainting = live.value;
  return { ok: true, value: result };
}

// A challenge may store a bounded list of spatial marks made with game-shipped
// brushes. It never uploads Function Brush code, masks or an editor project.
function normalizeLivePainting(raw, artHouse) {
  if (raw === undefined) return {};
  if (!isRecord(raw)) return { error: "livePainting must be an object when present." };
  if (!LIVE_ART_HOUSES.includes(artHouse)) {
    return { error: "livePainting is not available for this art house." };
  }
  if (!Array.isArray(raw.marks) || raw.marks.length > MAX_LIVE_PAINT_MARKS) {
    return { error: `livePainting.marks must be an array of at most ${MAX_LIVE_PAINT_MARKS} marks.` };
  }
  if (Object.keys(raw).some(key => key !== "marks" && key !== "strength")) {
    return { error: "livePainting may contain only marks and strength." };
  }
  // The Hider's quiet→live dial: the challenge's rate of change (animation
  // speed). 68 is exactly the reviewed cadence; the client maps 10→~0.35x
  // and 100→~2x. It never changes reach, density or opacity.
  if (raw.strength !== undefined
    && (!Number.isInteger(raw.strength) || raw.strength < 10 || raw.strength > 100)) {
    return { error: "livePainting.strength must be an integer from 10 to 100." };
  }
  const marks = [];
  for (const mark of raw.marks) {
    if (!isRecord(mark) || Object.keys(mark).length !== 7
      || Object.keys(mark).some(key => !["brush", "x", "y", "size", "flow", "seed", "angle"].includes(key))) {
      return { error: "Each live mark must contain only brush, x, y, size, flow, seed and angle." };
    }
    if (!LIVE_BRUSHES.includes(mark.brush)) {
      return { error: `live mark brush must be one of: ${LIVE_BRUSHES.join(", ")}.` };
    }
    if (!Number.isInteger(mark.x) || mark.x < 0 || mark.x > 256
      || !Number.isInteger(mark.y) || mark.y < 0 || mark.y > 256) {
      return { error: "live mark x and y must be integers from 0 to 256." };
    }
    if (!Number.isInteger(mark.size) || mark.size < 8 || mark.size > 96) {
      return { error: "live mark size must be an integer from 8 to 96." };
    }
    if (!Number.isInteger(mark.flow) || mark.flow < 10 || mark.flow > 100) {
      return { error: "live mark flow must be an integer from 10 to 100." };
    }
    if (!Number.isInteger(mark.seed) || mark.seed < 0 || mark.seed > 65_535) {
      return { error: "live mark seed must be an integer from 0 to 65535." };
    }
    if (!Number.isFinite(mark.angle) || mark.angle < -Math.PI || mark.angle > Math.PI) {
      return { error: "live mark angle must be a finite number from -pi to pi." };
    }
    marks.push({
      brush: mark.brush,
      x: mark.x,
      y: mark.y,
      size: mark.size,
      flow: mark.flow,
      seed: mark.seed,
      angle: mark.angle,
    });
  }
  return { value: raw.strength === undefined ? { marks } : { marks, strength: raw.strength } };
}

export function validateAttemptInput(value) {
  if (!isRecord(value)) return invalid("Request body must be a JSON object.");

  const { attemptId, roomIndex, x, y, elapsedMs } = value;
  const gaveUp = value.gaveUp === true;
  if (typeof attemptId !== "string" || !ATTEMPT_ID_PATTERN.test(attemptId)) {
    return invalid("attemptId must be an 8-80 character URL-safe identifier.");
  }
  if (!Number.isInteger(roomIndex) || roomIndex < 0 || roomIndex > 2) return invalid("roomIndex must be 0, 1 or 2.");
  if (!Number.isFinite(x) || x < 0 || x > 960) return invalid("x must be from 0 to 960.");
  if (!Number.isFinite(y) || y < 0 || y > 640) return invalid("y must be from 0 to 640.");
  if (!Number.isInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > MAX_ELAPSED_MS) {
    return invalid(`elapsedMs must be an integer from 0 to ${MAX_ELAPSED_MS}.`);
  }
  if (value.gaveUp !== undefined && typeof value.gaveUp !== "boolean") {
    return invalid("gaveUp must be a boolean when present.");
  }

  const found = normalizeSnapshot(value.foundImage, MAX_FOUND_DATA_LENGTH, "found screenshot");
  if (found.error) return invalid(found.error);

  const result = { attemptId, roomIndex, x, y, elapsedMs, gaveUp };
  if (found.value) result.foundImage = found.value;
  return { ok: true, value: result };
}

// Optional per-challenge screenshot: a small base64 JPEG/WebP/PNG data URL, or
// nothing. Returns { value } when present and valid, { error } when malformed,
// or {} when omitted.
function normalizeSnapshot(raw, maxLength = MAX_PREVIEW_DATA_LENGTH, label = "screenshot") {
  if (raw === undefined || raw === null || raw === "") return {};
  if (typeof raw !== "string" || raw.length > maxLength || !SNAPSHOT_DATA_PATTERN.test(raw)) {
    return { error: `${label} must be a small base64 JPEG, WebP, or PNG data URL.` };
  }
  return { value: raw };
}

export function validateReportInput(value) {
  if (!isRecord(value)) return invalid("Request body must be a JSON object.");
  const { reportId, reason } = value;
  if (typeof reportId !== "string" || !REPORT_ID_PATTERN.test(reportId)) {
    return invalid("reportId must be an 8-80 character URL-safe identifier.");
  }
  if (!REPORT_REASONS.includes(reason)) {
    return invalid(`reason must be one of: ${REPORT_REASONS.join(", ")}.`);
  }
  return { ok: true, value: { reportId, reason } };
}

export function validateModerationActionInput(value) {
  if (!isRecord(value)) return invalid("Request body must be a JSON object.");
  if (!MODERATION_ACTIONS.includes(value.action)) {
    return invalid(`action must be one of: ${MODERATION_ACTIONS.join(", ")}.`);
  }
  return { ok: true, value: { action: value.action } };
}

export function attemptFindsChallenge(payload, attempt) {
  if (!isRecord(payload) || !isRecord(attempt)) return false;
  if (payload.version !== 1 || attempt.roomIndex !== payload.roomIndex) return false;
  const dx = (attempt.x - payload.x) / 48;
  const dy = (attempt.y - (payload.y - 38)) / 54;
  return dx * dx + dy * dy <= 1;
}

export function parseChallengePath(pathname) {
  const match = pathname.match(
    /^\/api\/challenges\/([A-Za-z0-9_-]{16,80})(?:\/(attempts|results|reports|publication))?$/,
  );
  if (!match) return null;
  return { token: match[1], action: match[2] ?? "challenge" };
}

export function unixSeconds(milliseconds = Date.now()) {
  return Math.floor(milliseconds / 1_000);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function invalid(error) {
  return { ok: false, error };
}
