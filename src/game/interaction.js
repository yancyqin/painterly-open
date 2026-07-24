// Pure input-interaction model for the game canvas. Framework-free and
// DOM-free so it can be unit tested with `node --test` (like collision.js).

/** Base walking speed in pixels per second (desktop / fine pointer). */
export const BASE_MOVE_SPEED = 176;

/** Slower speed for touch devices. A fingertip on a small screen oversteers at
 * the desktop rate, so coarse-pointer devices walk at roughly 0.64x. */
export const MOBILE_MOVE_SPEED = 112;

/**
 * Choose the walking speed for the current input device. Pure on purpose: the
 * caller decides how it detected a coarse pointer (matchMedia / maxTouchPoints).
 */
export function moveSpeedFor({ coarsePointer = false } = {}) {
  return coarsePointer ? MOBILE_MOVE_SPEED : BASE_MOVE_SPEED;
}

// The seeker inspection card is a zoomed crop of the room around the aim
// reticle. These mirror GameCanvas so a tap on the card maps back to the exact
// world pixels the card displays. 16:9 to match the 320×180 card exactly (no
// stretch); sized so the detection ellipse (96×108) fills the card height —
// the Close Look focuses on the inspect region, nothing more.
export const INSPECTION_SOURCE_WIDTH = 192;
export const INSPECTION_SOURCE_HEIGHT = 108;

// Detection ellipse around the hider (matches the reticle inspection so both
// inspection paths score identically). Never widen without owner sign-off — it
// is the seeker detection contract.
export const HIDER_RADIUS_X = 48;
export const HIDER_RADIUS_Y = 54;
export const HIDER_BODY_OFFSET_Y = 38;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Top-left of the room crop the inspection card shows, clamped to the view. */
export function inspectionSource(pointX, pointY, viewWidth, viewHeight) {
  return {
    x: clamp(pointX - INSPECTION_SOURCE_WIDTH / 2, 0, viewWidth - INSPECTION_SOURCE_WIDTH),
    y: clamp(pointY - INSPECTION_SOURCE_HEIGHT / 2, 0, viewHeight - INSPECTION_SOURCE_HEIGHT),
  };
}

/**
 * Map a tap inside the inspection card to world coordinates and test whether it
 * lands on the hider. Uses the same ellipse the reticle inspection uses, so
 * tapping the hider shown in the card scores exactly like aiming at it.
 */
export function inspectionCardHit(params) {
  const {
    tapX,
    tapY,
    cardWidth,
    cardHeight,
    sourceX,
    sourceY,
    sourceWidth = INSPECTION_SOURCE_WIDTH,
    sourceHeight = INSPECTION_SOURCE_HEIGHT,
    hider,
    sameRoom,
    radiusX = HIDER_RADIUS_X,
    radiusY = HIDER_RADIUS_Y,
    yOffset = HIDER_BODY_OFFSET_Y,
  } = params;
  if (!(cardWidth > 0) || !(cardHeight > 0)) {
    return { x: sourceX, y: sourceY, hit: false };
  }
  const x = sourceX + (tapX / cardWidth) * sourceWidth;
  const y = sourceY + (tapY / cardHeight) * sourceHeight;
  const dx = (x - hider.x) / radiusX;
  const dy = (y - (hider.y - yOffset)) / radiusY;
  const hit = Boolean(sameRoom) && dx * dx + dy * dy <= 1;
  return { x, y, hit };
}
