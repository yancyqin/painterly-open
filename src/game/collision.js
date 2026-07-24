export const ACTOR_HALF_WIDTH = 10;
export const ACTOR_HALF_HEIGHT = 7;

/**
 * Convert a prop's normalized ground-plane collision contract into world
 * rectangles. The instance y coordinate is the visible front feet line.
 */
export function propCollisionRects(instance, spec) {
  const override = instance.collision;
  if (override) {
    const width = spec.collisionWidth + override.padLeft + override.padRight;
    const depth = spec.collisionDepth + override.padBack + override.padFront;
    if (width <= 0 || depth <= 0) return [];
    return [{
      x: instance.x - spec.collisionWidth / 2 - override.padLeft,
      y: instance.y - spec.collisionDepth - override.padBack,
      w: width,
      h: depth,
    }];
  }

  const baseY = instance.y - spec.collisionDepth / 2;
  return spec.collision.map(rect => ({
    x: instance.x + rect.x * spec.collisionWidth,
    y: baseY + rect.y * spec.collisionDepth,
    w: rect.w * spec.collisionWidth,
    h: rect.h * spec.collisionDepth,
  }));
}

export function actorHitsRect(
  x,
  y,
  rect,
  halfWidth = ACTOR_HALF_WIDTH,
  halfHeight = ACTOR_HALF_HEIGHT,
) {
  return x + halfWidth > rect.x
    && x - halfWidth < rect.x + rect.w
    && y + halfHeight > rect.y
    && y - halfHeight < rect.y + rect.h;
}

export function actorHitsAnyRect(
  x,
  y,
  rects,
  halfWidth = ACTOR_HALF_WIDTH,
  halfHeight = ACTOR_HALF_HEIGHT,
) {
  return rects.some(rect => actorHitsRect(x, y, rect, halfWidth, halfHeight));
}

// A layout barrier can follow an irregular painted shoreline, a stone bridge,
// or another shape that a rectangle cannot describe. Collision remains against
// the actor's small feet box (rather than its visible sprite) so it behaves the
// same way as furniture and rectangular editor barriers.
export function actorHitsPolygon(
  x,
  y,
  polygon,
  halfWidth = ACTOR_HALF_WIDTH,
  halfHeight = ACTOR_HALF_HEIGHT,
) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;

  const actorCorners = [
    { x: x - halfWidth, y: y - halfHeight },
    { x: x + halfWidth, y: y - halfHeight },
    { x: x + halfWidth, y: y + halfHeight },
    { x: x - halfWidth, y: y + halfHeight },
  ];

  // One shape fully contains the other.
  if (actorCorners.some(corner => pointInPolygon(corner, polygon))) return true;
  if (polygon.some(point => pointInActorBox(point, x, y, halfWidth, halfHeight))) return true;

  // Or their borders cross. Strict intersections deliberately preserve the
  // rectangle collision contract: merely touching a barrier is still walkable.
  for (let index = 0; index < polygon.length; index += 1) {
    const from = polygon[index];
    const to = polygon[(index + 1) % polygon.length];
    if (!from || !to) continue;
    for (let edge = 0; edge < actorCorners.length; edge += 1) {
      const actorFrom = actorCorners[edge];
      const actorTo = actorCorners[(edge + 1) % actorCorners.length];
      if (actorFrom && actorTo && segmentsStrictlyIntersect(from, to, actorFrom, actorTo)) return true;
    }
  }
  return false;
}

export function actorHitsAnyPolygon(
  x,
  y,
  polygons,
  halfWidth = ACTOR_HALF_WIDTH,
  halfHeight = ACTOR_HALF_HEIGHT,
) {
  return polygons.some(polygon => actorHitsPolygon(x, y, polygon, halfWidth, halfHeight));
}

function pointInActorBox(point, x, y, halfWidth, halfHeight) {
  return point.x > x - halfWidth
    && point.x < x + halfWidth
    && point.y > y - halfHeight
    && point.y < y + halfHeight;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
    const a = polygon[current];
    const b = polygon[previous];
    if (!a || !b || pointOnSegment(point, a, b)) return false;
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointOnSegment(point, from, to) {
  const cross = (point.y - from.y) * (to.x - from.x) - (point.x - from.x) * (to.y - from.y);
  if (Math.abs(cross) > 1e-9) return false;
  return point.x >= Math.min(from.x, to.x)
    && point.x <= Math.max(from.x, to.x)
    && point.y >= Math.min(from.y, to.y)
    && point.y <= Math.max(from.y, to.y);
}

function segmentsStrictlyIntersect(a, b, c, d) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return ((abC > 0 && abD < 0) || (abC < 0 && abD > 0))
    && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0));
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
