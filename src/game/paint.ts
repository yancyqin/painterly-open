import {
  AVATAR_SIZE,
  MAX_CUSTOM_PAINT_COLORS,
  MAX_PAINT_COLORS,
  MAX_PAINT_MARKS,
} from "./config";

export const PAINT_SHAPES = ["dot", "streak", "square", "ring"] as const;
export type PaintShape = typeof PAINT_SHAPES[number];

export interface PaintMark {
  x: number;
  y: number;
  size: number;
  angle: number;
  alpha: number;
  soft: number;
  colorIndex: number;
  shape: PaintShape;
}

export interface PaintSnapshot {
  raster: Uint8Array;
}

// The network carries the final composited avatar, not its stroke history.
// RGBA4444 keeps arbitrary translucent color blends in two bytes per pixel.
// 128² is already above the avatar's 100 px in-room display size and produces
// one constant 32 KiB payload regardless of how long the Hider paints.
export const PAINT_RASTER_SIZE = 128;
export const PAINT_RASTER_BYTES = PAINT_RASTER_SIZE * PAINT_RASTER_SIZE * 2;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function wireBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return null;
}

export function sanitizePaintMarks(value: unknown, paletteSize: number): PaintMark[] {
  if (!Array.isArray(value)) return [];
  const marks: PaintMark[] = [];
  for (const raw of value.slice(0, MAX_PAINT_MARKS)) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as Record<string, unknown>;
    const numbers = [m.x, m.y, m.size, m.angle, m.alpha, m.soft, m.colorIndex];
    if (!numbers.every(Number.isFinite)) continue;
    if (!PAINT_SHAPES.includes(m.shape as PaintShape)) continue;
    marks.push({
      x: clamp(Number(m.x), 0, AVATAR_SIZE),
      y: clamp(Number(m.y), 0, AVATAR_SIZE),
      size: clamp(Number(m.size), 2, 120),
      angle: clamp(Number(m.angle), -Math.PI * 8, Math.PI * 8),
      alpha: clamp(Number(m.alpha), 0.05, 1),
      soft: clamp(Number(m.soft), 0, 1),
      colorIndex: Math.floor(clamp(Number(m.colorIndex), 0, Math.max(0, paletteSize - 1))),
      shape: m.shape as PaintShape,
    });
  }
  return marks;
}

export function sanitizeCustomPaintColors(value: unknown, basePalette: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  const roomColors = new Set(basePalette.map(color => color.toLowerCase()));
  const custom: string[] = [];
  const capacity = Math.min(MAX_CUSTOM_PAINT_COLORS, Math.max(0, MAX_PAINT_COLORS - basePalette.length));
  for (const raw of value) {
    if (custom.length >= capacity || typeof raw !== "string" || !HEX_COLOR.test(raw)) continue;
    const color = raw.toLowerCase();
    if (roomColors.has(color) || custom.includes(color)) continue;
    custom.push(color);
  }
  return custom;
}

export function paintPalette(basePalette: readonly string[], customColors: unknown): string[] {
  return [...basePalette, ...sanitizeCustomPaintColors(customColors, basePalette)];
}

export function sanitizePaintRaster(value: unknown): Uint8Array | null {
  const packed = wireBytes(value);
  if (!packed || packed.byteLength !== PAINT_RASTER_BYTES) return null;
  return new Uint8Array(packed);
}

export function packPaintRaster(rgba: Uint8Array | Uint8ClampedArray): Uint8Array {
  const expected = PAINT_RASTER_SIZE * PAINT_RASTER_SIZE * 4;
  if (rgba.byteLength !== expected) throw new RangeError(`paint raster needs ${expected} RGBA bytes`);
  const packed = new Uint8Array(PAINT_RASTER_BYTES);
  for (let pixel = 0; pixel < PAINT_RASTER_SIZE * PAINT_RASTER_SIZE; pixel++) {
    const source = pixel * 4;
    const target = pixel * 2;
    packed[target] = (rgba[source] & 0xf0) | (rgba[source + 1] >> 4);
    packed[target + 1] = (rgba[source + 2] & 0xf0) | (rgba[source + 3] >> 4);
  }
  return packed;
}

export function unpackPaintRaster(value: unknown): Uint8ClampedArray | null {
  const packed = sanitizePaintRaster(value);
  if (!packed) return null;
  const rgba = new Uint8ClampedArray(PAINT_RASTER_SIZE * PAINT_RASTER_SIZE * 4);
  for (let pixel = 0; pixel < PAINT_RASTER_SIZE * PAINT_RASTER_SIZE; pixel++) {
    const source = pixel * 2;
    const target = pixel * 4;
    rgba[target] = (packed[source] >> 4) * 17;
    rgba[target + 1] = (packed[source] & 0x0f) * 17;
    rgba[target + 2] = (packed[source + 1] >> 4) * 17;
    rgba[target + 3] = (packed[source + 1] & 0x0f) * 17;
  }
  return rgba;
}
