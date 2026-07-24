import type { Point, PropInstance } from "./types";

export interface CollisionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CollisionSpec {
  collisionWidth: number;
  collisionDepth: number;
  collision: readonly CollisionRect[];
}

export const ACTOR_HALF_WIDTH: number;
export const ACTOR_HALF_HEIGHT: number;

export function propCollisionRects(instance: PropInstance, spec: CollisionSpec): CollisionRect[];
export function actorHitsRect(
  x: number,
  y: number,
  rect: CollisionRect,
  halfWidth?: number,
  halfHeight?: number,
): boolean;
export function actorHitsAnyRect(
  x: number,
  y: number,
  rects: readonly CollisionRect[],
  halfWidth?: number,
  halfHeight?: number,
): boolean;
export function actorHitsPolygon(
  x: number,
  y: number,
  polygon: readonly Point[],
  halfWidth?: number,
  halfHeight?: number,
): boolean;
export function actorHitsAnyPolygon(
  x: number,
  y: number,
  polygons: readonly (readonly Point[])[],
  halfWidth?: number,
  halfHeight?: number,
): boolean;
