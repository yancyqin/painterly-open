import test from "node:test";
import assert from "node:assert/strict";

import {
  BASE_MOVE_SPEED,
  MOBILE_MOVE_SPEED,
  moveSpeedFor,
  inspectionSource,
  inspectionCardHit,
} from "../src/game/interaction.js";

test("touch devices walk slower than a fine pointer", () => {
  assert.equal(moveSpeedFor({ coarsePointer: false }), BASE_MOVE_SPEED);
  assert.equal(moveSpeedFor({ coarsePointer: true }), MOBILE_MOVE_SPEED);
  assert.equal(moveSpeedFor(), BASE_MOVE_SPEED, "defaults to the desktop speed");
  assert.ok(MOBILE_MOVE_SPEED < BASE_MOVE_SPEED, "the mobile speed is genuinely slower");
});

test("the inspection crop centers on the point and clamps to the view", () => {
  assert.deepEqual(inspectionSource(400, 300, 960, 640), { x: 304, y: 246 });
  // Top-left corner cannot show a crop starting off-canvas.
  assert.deepEqual(inspectionSource(0, 0, 960, 640), { x: 0, y: 0 });
  // Bottom-right clamps to view - crop size (960-192, 640-108).
  assert.deepEqual(inspectionSource(960, 640, 960, 640), { x: 768, y: 532 });
});

// A card crop spanning world x[304,496] y[208,316], drawn into a 320x180 card.
const card = { cardWidth: 320, cardHeight: 180, sourceX: 304, sourceY: 208 };
const hider = { x: 400, y: 300 }; // ellipse center is (400, 300-38) = (400, 262)

test("tapping the hider shown in the card scores a hit", () => {
  // (160,90) maps to world (400,262) — dead center of the hider ellipse.
  const result = inspectionCardHit({ ...card, tapX: 160, tapY: 90, hider, sameRoom: true });
  assert.equal(result.x, 400);
  assert.equal(result.y, 262);
  assert.equal(result.hit, true);
});

test("tapping empty space in the card is a miss", () => {
  // Top-left corner of the card is world (312,212), well outside the ellipse.
  const result = inspectionCardHit({ ...card, tapX: 0, tapY: 0, hider, sameRoom: true });
  assert.equal(result.hit, false);
});

test("a hit never counts when the hider is in another room", () => {
  const result = inspectionCardHit({ ...card, tapX: 160, tapY: 90, hider, sameRoom: false });
  assert.equal(result.hit, false, "same geometry, but a different room can never hit");
});

test("a zero-sized card cannot divide by zero", () => {
  const result = inspectionCardHit({
    ...card,
    cardWidth: 0,
    cardHeight: 0,
    tapX: 10,
    tapY: 10,
    hider,
    sameRoom: true,
  });
  assert.equal(result.hit, false);
  assert.ok(Number.isFinite(result.x) && Number.isFinite(result.y));
});
