import test from "node:test";
import assert from "node:assert/strict";

import {
  ACTOR_HALF_HEIGHT,
  ACTOR_HALF_WIDTH,
  actorHitsAnyPolygon,
  actorHitsPolygon,
  actorHitsAnyRect,
  actorHitsRect,
  propCollisionRects,
} from "../src/game/collision.js";

const solidSpec = {
  collisionWidth: 100,
  collisionDepth: 40,
  collision: [{ x: -0.5, y: -0.5, w: 1, h: 1 }],
};

test("prop collision uses the front feet line as its anchor", () => {
  const rects = propCollisionRects({ x: 300, y: 250 }, solidSpec);
  assert.deepEqual(rects, [{ x: 250, y: 210, w: 100, h: 40 }]);
});

test("the actor feet box blocks before its center enters furniture", () => {
  const rect = { x: 250, y: 210, w: 100, h: 40 };
  assert.equal(actorHitsRect(250 - ACTOR_HALF_WIDTH, 230, rect), false, "touching is allowed");
  assert.equal(actorHitsRect(250 - ACTOR_HALF_WIDTH + 0.1, 230, rect), true);
  assert.equal(actorHitsRect(300, 210 - ACTOR_HALF_HEIGHT, rect), false, "vertical touching is allowed");
  assert.equal(actorHitsRect(300, 210 - ACTOR_HALF_HEIGHT + 0.1, rect), true);
});

test("surface props can explicitly remain walkable", () => {
  const rects = propCollisionRects({ x: 300, y: 250 }, { ...solidSpec, collision: [] });
  assert.deepEqual(rects, []);
  assert.equal(actorHitsAnyRect(300, 250, rects), false);
});

test("instance collision pads can disable or expand one prop", () => {
  const disabled = propCollisionRects({
    x: 300,
    y: 250,
    collision: { padLeft: -200, padRight: 0, padFront: 0, padBack: 0 },
  }, solidSpec);
  assert.deepEqual(disabled, []);

  const expanded = propCollisionRects({
    x: 300,
    y: 250,
    collision: { padLeft: 5, padRight: 7, padFront: 3, padBack: 2 },
  }, solidSpec);
  assert.deepEqual(expanded, [{ x: 245, y: 208, w: 112, h: 45 }]);
});

test("irregular layout polygons block the actor feet box without blocking edge contact", () => {
  const triangle = [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 100, y: 200 }];
  assert.equal(actorHitsPolygon(89, 150, triangle), false, "touching an edge stays walkable");
  assert.equal(actorHitsPolygon(90.1, 150, triangle), true);
  assert.equal(actorHitsPolygon(155, 155, triangle), true, "a corner entering a sloped barrier blocks movement");
  assert.equal(actorHitsAnyPolygon(155, 155, [triangle]), true);
  assert.equal(actorHitsAnyPolygon(260, 260, [triangle]), false);
});
