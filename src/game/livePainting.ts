import {
  LIVE_BRUSH_IDS,
  type ArtRoomDefinition,
  type LiveBrushId,
  type LivePaintMark,
  type LivePaintingConfig,
} from "./types";

/** One authored Live strength shared by the room and chameleon. */
export const LIVE_FORCE_STRENGTH = 1;
/** Authored timing shared by the room distance waves and avatar alpha brushes. */
export const LIVE_ALPHA_WAVE_SPEED_MIN = .08;
export const LIVE_ALPHA_WAVE_SPEED_RANGE = .044;
export const LIVE_CURRENT_TRAVEL_SPEED = 18;
export const LIVE_GRAPHITE_SPEED_MIN = .075;
export const LIVE_GRAPHITE_SPEED_RANGE = .055;
/** Canonical coordinate space for stored live marks (x, y and size). The
 * 192px studio canvas and every render size scale to and from this space. */
export const LIVE_MARK_SPACE = 256;
export const LIVE_BRUSH_DEFAULT: LiveBrushId = "liquid-color";
export const LIVE_SIZE_MIN = 8;
export const LIVE_SIZE_MAX = 96;
/** Studio control range mirrors the 16–120 range on the 512px 6A canvas. */
export const LIVE_TOOL_SIZE_MAX = 60;
export const LIVE_SIZE_DEFAULT = 26;
export const LIVE_FLOW_MIN = 10;
export const LIVE_FLOW_MAX = 100;
export const LIVE_FLOW_DEFAULT = 68;
/** Studio "quiet → live" force dial = the challenge's RATE OF CHANGE (an
 * animation-clock multiplier — see liveForceSpeedScale). The default sits at
 * exactly the reviewed room cadence (1×). */
export const LIVE_STRENGTH_MIN = 10;
export const LIVE_STRENGTH_MAX = 100;
export const LIVE_STRENGTH_DEFAULT = 68;
export const MAX_LIVE_PAINT_MARKS = 320;

/** Diagnostic-only split used by the 6A additive benchmark. Production
 * renderers keep the default "full" pass and never change it. */
export type LiveLiquidDiagnosticPass =
  | "full"
  | "legacy-full"
  | "erosion"
  | "relay-tint"
  | "relay"
  | "batch-erosion"
  | "batch-tint"
  | "off";

/** "white-mist" was retired 2026-07-21; old stored marks fall back to the
 * default liquid-color via normalizeLivePaintMark. */
export const LIVE_BRUSH_LABELS: Readonly<Record<LiveBrushId, string>> = {
  "blue-current": "blue current",
  "liquid-color": "liquid color",
  "graphite-whisper": "graphite whisper",
  "firefly": "firefly",
  "growth": "growth",
  "color-liquify-splash": "color liquify splash",
};

export function liveBrushesForRoom(room: ArtRoomDefinition): readonly LiveBrushId[] {
  return room.liveBrushes?.length ? room.liveBrushes : [LIVE_BRUSH_DEFAULT];
}

export function defaultLiveBrushForRoom(room: ArtRoomDefinition): LiveBrushId {
  return liveBrushesForRoom(room)[0] ?? LIVE_BRUSH_DEFAULT;
}

// ---- Avatar wave look (the room's donor-wave technique, force-only) --------
// D-016: a Live Brush describes FORCE only and owns no color. At rest the
// avatar keeps its exact painted look; each liquid-color mark runs the room's
// alpha wave LOCALLY — the paint inside an expanding organic ring thins out
// (alpha-only, like the room's transparent holes) while a slightly outward-
// pushed copy of the SAME pigment breathes through the ring, then everything
// heals. No brush ever introduces color; pigment comes from the Hider's paint.
const WAVE_REACH = 2.3; // liquid-color front sweeps to size * REACH
const LIQUID_REVEAL = .55;
// The ring must genuinely thin the paint (the room's holes go fully
// transparent) — with a high reveal the re-laid copy cancels the erosion and
// the wave is invisible on smoothly painted areas.
const WAVE_EROSION = .85;
const WAVE_BAND_BASE = .42; // annulus thickness = size * (BASE + growth * GROW)
const WAVE_BAND_GROW = .5;
const WAVE_ZOOM = .15; // outward pigment push at full growth
const WAVE_DRIFT = 3.6; // sideways pigment drift in 512-study pixels

type RGB = readonly [number, number, number];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function liveAlphaWaveState(time: number, seed: number, speed: number): {
  cycle: number;
  growth: number;
  opacity: number;
} {
  const cycle = (time * speed + seed) % 1;
  const growth = smoothstep(.005, .8, cycle);
  const appear = smoothstep(.015, .34, cycle);
  const disappear = 1 - smoothstep(.64, .985, cycle);
  return { cycle, growth, opacity: appear * disappear };
}

export function liveCurrentState(time: number, seed: number): {
  phase: number;
  slide: number;
  sizeScale: number;
  yDrift: number;
  opacity: number;
} {
  const phase = time + seed * Math.PI * 2;
  return {
    phase,
    slide: ((time * LIVE_CURRENT_TRAVEL_SPEED + seed * 55) % 48) - 24,
    sizeScale: 1 + Math.sin(phase * .8) * .08,
    yDrift: Math.sin(phase) * 2.1,
    opacity: .16 + (Math.sin(phase * 1.2) + 1) * .08,
  };
}

export function liveGraphiteState(time: number, seed: number, speed: number): {
  cycle: number;
  start: number;
  end: number;
} {
  const cycle = (time * speed + seed) % 1;
  return {
    cycle,
    start: smoothstep(.7, .9, cycle),
    end: smoothstep(.04, .27, cycle),
  };
}

/** The force dial (quiet → live) is the challenge's RATE OF CHANGE: an
 * animation-clock multiplier. 10 breathes at ~0.35× the reviewed cadence, the
 * default 68 is exactly the reviewed room cadence (1×), and 100 runs about
 * twice it. It never changes reach, density or opacity. */
export function liveForceSpeedScale(strength: number): number {
  const clamped = Math.max(LIVE_STRENGTH_MIN, Math.min(LIVE_STRENGTH_MAX, strength));
  return clamped <= LIVE_STRENGTH_DEFAULT
    ? .35 + ((clamped - LIVE_STRENGTH_MIN) / (LIVE_STRENGTH_DEFAULT - LIVE_STRENGTH_MIN)) * .65
    : 1 + (clamped - LIVE_STRENGTH_DEFAULT) / (LIVE_STRENGTH_MAX - LIVE_STRENGTH_DEFAULT);
}

export function normalizeLivePaintingConfig(value: Partial<LivePaintingConfig> | null | undefined): LivePaintingConfig {
  const marks = (Array.isArray(value?.marks) ? value.marks : [])
    .slice(0, MAX_LIVE_PAINT_MARKS)
    .map(mark => normalizeLivePaintMark(mark));
  const rawStrength = Number(value?.strength);
  const strength = Number.isFinite(rawStrength)
    ? Math.round(Math.max(LIVE_STRENGTH_MIN, Math.min(LIVE_STRENGTH_MAX, rawStrength)))
    : LIVE_STRENGTH_DEFAULT;
  return { marks, strength };
}

export function normalizeLivePaintMark(value: Partial<LivePaintMark>): LivePaintMark {
  const brush = LIVE_BRUSH_IDS.includes(value.brush as LiveBrushId)
    ? value.brush as LiveBrushId
    : LIVE_BRUSH_DEFAULT;
  const integer = (raw: unknown, min: number, max: number, fallback: number): number => {
    const numeric = Number(raw);
    return Math.round(Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : fallback)));
  };
  return {
    brush,
    x: integer(value.x, 0, LIVE_MARK_SPACE, LIVE_MARK_SPACE / 2),
    y: integer(value.y, 0, LIVE_MARK_SPACE, LIVE_MARK_SPACE / 2),
    size: integer(value.size, LIVE_SIZE_MIN, LIVE_SIZE_MAX, LIVE_SIZE_DEFAULT),
    flow: integer(value.flow, LIVE_FLOW_MIN, LIVE_FLOW_MAX, LIVE_FLOW_DEFAULT),
    seed: integer(value.seed, 0, 65_535, 1),
    angle: Math.max(-Math.PI, Math.min(Math.PI, Number(value.angle) || 0)),
  };
}

function hash(seed: number): number {
  const value = Math.sin((seed + 1) * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

/** One cloudy paint-loss mark: several rotated, off-centre feathered lobes,
 * normalized so the cloud has genuinely clear edges and a solid organic core.
 * Shared by the room renderer (6B face hole) and the avatar wave brush. */
export function makeOrganicFadeStamp(size: number, seed: number, firmer = false): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  context.globalCompositeOperation = "lighter";
  for (let index = 0; index < 13; index += 1) {
    const localSeed = seed * 101 + index * 37;
    const cx = size * (.5 + (hash(localSeed + 1) - .5) * .38);
    const cy = size * (.5 + (hash(localSeed + 3) - .5) * .34);
    const radius = size * (.19 + hash(localSeed + 5) * .15);
    const stretch = .55 + hash(localSeed + 7) * .9;
    context.save();
    context.translate(cx, cy);
    context.rotate((hash(localSeed + 9) - .5) * Math.PI);
    context.scale(stretch, 1 / Math.sqrt(stretch));
    const gradient = context.createRadialGradient(0, 0, radius * .04, 0, 0, radius);
    gradient.addColorStop(0, firmer ? "rgba(255,255,255,.32)" : "rgba(255,255,255,.25)");
    gradient.addColorStop(.24, firmer ? "rgba(255,255,255,.24)" : "rgba(255,255,255,.18)");
    gradient.addColorStop(.68, firmer ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.055)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(-radius * 1.6, -radius * 1.6, radius * 3.2, radius * 3.2);
    context.restore();
  }
  context.globalCompositeOperation = "source-over";
  const pixels = context.getImageData(0, 0, size, size);
  const solidAt = firmer ? .58 : .72;
  for (let offset = 3; offset < pixels.data.length; offset += 4) {
    const sourceAlpha = (pixels.data[offset] ?? 0) / 255;
    pixels.data[offset] = Math.round(255 * smoothstep(.005, solidAt, sourceAlpha));
  }
  context.clearRect(0, 0, size, size);
  context.putImageData(pixels, 0, 0);
  return canvas;
}

/** The room's blue-current stamp: one soft S-shaped flow line. */
export function makeCurrentStamp(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 112;
  canvas.height = 42;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(0, 21, 112, 21);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(.25, "rgba(255,255,255,.25)");
  gradient.addColorStop(.54, "rgba(255,255,255,.82)");
  gradient.addColorStop(.78, "rgba(255,255,255,.22)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.strokeStyle = gradient;
  context.lineWidth = 8;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(4, 28);
  context.bezierCurveTo(34, 2, 70, 38, 108, 13);
  context.stroke();
  return canvas;
}

// Lazy module-level stamp atlas: the wave brush still picks one of the same
// six organic clouds by seed, but they share one GPU texture/canvas instead of
// keeping six separate backing stores alive.
const WAVE_STAMP_SIZE = 240;
const WAVE_STAMP_COUNT = 6;
const WAVE_STAMP_COLUMNS = 3;
// The diagnostic batch path stores twelve already-cut annuli for every
// organic cloud below the original six full-size stamps. This is still one
// shared atlas/canvas — never one mask canvas per mark or ring state.
const WAVE_RING_STAMP_SIZE = 80;
const WAVE_RING_BUCKET_COUNT = 12;
const WAVE_RING_MAX_INNER_RATIO = .72;
const WAVE_RING_COLUMNS = WAVE_STAMP_COLUMNS * WAVE_STAMP_SIZE / WAVE_RING_STAMP_SIZE;
interface WaveStampAtlas {
  canvas: HTMLCanvasElement;
  size: number;
  columns: number;
  count: number;
  ringSize: number;
  ringColumns: number;
  ringOffsetY: number;
  ringBuckets: number;
  ringMaxInnerRatio: number;
}
let waveStampAtlas: WaveStampAtlas | null = null;
let liveAvatarRendererCount = 0;
function waveStamps(): WaveStampAtlas {
  if (waveStampAtlas) return waveStampAtlas;
  const rows = Math.ceil(WAVE_STAMP_COUNT / WAVE_STAMP_COLUMNS);
  const ringOffsetY = rows * WAVE_STAMP_SIZE;
  const ringCount = WAVE_STAMP_COUNT * WAVE_RING_BUCKET_COUNT;
  const ringRows = Math.ceil(ringCount / WAVE_RING_COLUMNS);
  const canvas = document.createElement("canvas");
  canvas.width = WAVE_STAMP_COLUMNS * WAVE_STAMP_SIZE;
  canvas.height = ringOffsetY + ringRows * WAVE_RING_STAMP_SIZE;
  const context = canvas.getContext("2d")!;
  for (let index = 0; index < WAVE_STAMP_COUNT; index += 1) {
    const stamp = makeOrganicFadeStamp(WAVE_STAMP_SIZE, 701 + index * 97);
    context.drawImage(
      stamp,
      index % WAVE_STAMP_COLUMNS * WAVE_STAMP_SIZE,
      Math.floor(index / WAVE_STAMP_COLUMNS) * WAVE_STAMP_SIZE,
    );
    for (let bucket = 0; bucket < WAVE_RING_BUCKET_COUNT; bucket += 1) {
      const ringIndex = index * WAVE_RING_BUCKET_COUNT + bucket;
      const ringX = ringIndex % WAVE_RING_COLUMNS * WAVE_RING_STAMP_SIZE;
      const ringY = ringOffsetY
        + Math.floor(ringIndex / WAVE_RING_COLUMNS) * WAVE_RING_STAMP_SIZE;
      const innerRatio = bucket / (WAVE_RING_BUCKET_COUNT - 1) * WAVE_RING_MAX_INNER_RATIO;
      context.save();
      context.beginPath();
      context.rect(ringX, ringY, WAVE_RING_STAMP_SIZE, WAVE_RING_STAMP_SIZE);
      context.clip();
      context.drawImage(
        stamp,
        0,
        0,
        WAVE_STAMP_SIZE,
        WAVE_STAMP_SIZE,
        ringX,
        ringY,
        WAVE_RING_STAMP_SIZE,
        WAVE_RING_STAMP_SIZE,
      );
      if (innerRatio > 0) {
        const innerSize = WAVE_RING_STAMP_SIZE * innerRatio;
        const innerOffset = (WAVE_RING_STAMP_SIZE - innerSize) / 2;
        context.globalCompositeOperation = "destination-out";
        context.drawImage(
          stamp,
          0,
          0,
          WAVE_STAMP_SIZE,
          WAVE_STAMP_SIZE,
          ringX + innerOffset,
          ringY + innerOffset,
          innerSize,
          innerSize,
        );
      }
      context.restore();
    }
    stamp.width = 0;
    stamp.height = 0;
  }
  waveStampAtlas = {
    canvas,
    size: WAVE_STAMP_SIZE,
    columns: WAVE_STAMP_COLUMNS,
    count: WAVE_STAMP_COUNT,
    ringSize: WAVE_RING_STAMP_SIZE,
    ringColumns: WAVE_RING_COLUMNS,
    ringOffsetY,
    ringBuckets: WAVE_RING_BUCKET_COUNT,
    ringMaxInnerRatio: WAVE_RING_MAX_INNER_RATIO,
  };
  return waveStampAtlas;
}

// The blue-current is stroked DIRECTLY in the sampled color (see drawCurrent).
// The former per-color tinted-stamp cache created one offscreen canvas per
// unique color = a GPU texture per color — the same anti-pattern as the
// curated room's stamp cache that overran Safari's accelerated-canvas budget.

interface PreparedWave {
  kind: "wave";
  mark: LivePaintMark;
  seed01: number;
  speed: number;
  rotation: number;
  stampIndex: number;
}
interface PreparedCurrent {
  kind: "current";
  mark: LivePaintMark;
  seed01: number;
  rgb: RGB;
}
interface PreparedGraphite {
  kind: "graphite";
  mark: LivePaintMark;
  seed01: number;
  speed: number;
  css: string;
}
interface PreparedPigment {
  kind: "firefly" | "growth" | "splash";
  mark: LivePaintMark;
  seed01: number;
  rgb: RGB;
  atlasIndex: number;
  atlasVariantCount: number;
}
type PreparedMark = PreparedWave | PreparedCurrent | PreparedGraphite | PreparedPigment;

// One renderer-owned texture packs every sampled avatar pigment used by the
// Van Gogh Live brushes. Splash's four softness states occupy neighbouring
// cells in the SAME atlas; there is never one canvas per mark or colour.
const AVATAR_PIGMENT_ATLAS_TILE_SIZE = 32;
const AVATAR_PIGMENT_ATLAS_COLUMNS = 32;

/**
 * Small reusable, deterministic renderer for the Hider Studio and game actor.
 * It executes no project/brush code and follows D-016: forces only — the
 * avatar's painted colors are never replaced, and no brush introduces pigment.
 *
 * Dials: size = footprint, flow = pigment density/opacity of the force,
 * force/strength = rate of change (a shared animation-clock multiplier).
 *
 * Room ⇄ avatar mapping (same technique, force-only):
 * - room alpha wave (donor ring)  → liquid-color: the paint inside one
 *   expanding organic ring thins and is re-laid slightly outward, using ONLY
 *   the Hider's own pigment, then heals
 * - room blue current             → blue-current: the room's S-stamp sliding
 *   along the gesture, tinted with the exact sampled paint color
 * - room ground graphite          → graphite-whisper: the same self-drawing
 *   fixed vector in the sampled paint color
 */
export class LiveAvatarRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly sample: HTMLCanvasElement;
  private readonly sampleContext: CanvasRenderingContext2D;
  private readonly scratch: HTMLCanvasElement;
  private readonly scratchContext: CanvasRenderingContext2D;
  private pigmentAtlasCanvas: HTMLCanvasElement | null = null;
  private sampledSource: CanvasImageSource | null = null;
  private samplePixels: Uint8ClampedArray | null = null;
  private seed = 1;
  private preparedInput: LivePaintingConfig | null = null;
  private preparedSeed = 0;
  private prepared: PreparedMark[] = [];
  /** Hider's quiet→live dial: the shared animation-clock multiplier. */
  private speedScale = 1;
  private liquidDiagnosticPass: LiveLiquidDiagnosticPass = "full";
  private disposed = false;

  constructor(private readonly size = 256, seed = 1) {
    liveAvatarRendererCount += 1;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = size;
    this.context = this.canvas.getContext("2d")!;
    this.sample = document.createElement("canvas");
    this.sample.width = this.sample.height = size;
    this.sampleContext = this.sample.getContext("2d", { willReadFrequently: true })!;
    this.scratch = document.createElement("canvas");
    this.scratch.width = this.scratch.height = size;
    this.scratchContext = this.scratch.getContext("2d")!;
    this.setSeed(seed);
  }

  setSeed(seed: number): void {
    const normalized = Math.max(1, Math.round(seed) || 1);
    if (normalized === this.seed) return;
    this.seed = normalized;
    this.preparedSeed = 0;
  }

  /** The static painted avatar changed in-place (Paint Studio reuses a canvas). */
  invalidateSource(): void {
    this.sampledSource = null;
    this.samplePixels = null;
    this.preparedInput = null;
    this.releasePigmentAtlas();
  }

  /** 6A benchmark hook. Game and Studio never call this, so they always render
   * the complete erosion + pigment re-lay effect. */
  setLiquidDiagnosticPass(pass: LiveLiquidDiagnosticPass): void {
    this.liquidDiagnosticPass = pass;
  }

  /** Release GPU backing stores when the owning mode exits. The six organic
   * wave stamps are a bounded shared pool, and are released after the final
   * LiveAvatarRenderer is disposed. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sampledSource = null;
    this.samplePixels = null;
    this.preparedInput = null;
    this.prepared = [];
    this.releasePigmentAtlas();
    for (const canvas of [this.canvas, this.sample, this.scratch]) {
      canvas.width = 0;
      canvas.height = 0;
    }
    liveAvatarRendererCount = Math.max(0, liveAvatarRendererCount - 1);
    if (liveAvatarRendererCount === 0 && waveStampAtlas) {
      waveStampAtlas.canvas.width = 0;
      waveStampAtlas.canvas.height = 0;
      waveStampAtlas = null;
    }
  }

  render(source: CanvasImageSource, value: LivePaintingConfig, timeSeconds: number): HTMLCanvasElement {
    if (this.disposed) throw new Error("LiveAvatarRenderer was used after dispose()");
    const sourceChanged = source !== this.sampledSource;
    if (sourceChanged) this.samplePaint(source);
    if (value !== this.preparedInput || sourceChanged || this.seed !== this.preparedSeed) {
      this.prepareMarks(value);
      this.preparedInput = value;
      this.preparedSeed = this.seed;
    }
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    context.clearRect(0, 0, this.size, this.size);
    // At rest the avatar is EXACTLY the Hider's painting — the same pixels the
    // Studio and the game both show, so the two never disagree on color.
    context.drawImage(source, 0, 0, this.size, this.size);
    const batchLiquid = this.liquidDiagnosticPass === "full"
      || this.liquidDiagnosticPass === "batch-erosion"
      || this.liquidDiagnosticPass === "batch-tint";
    if (batchLiquid) {
      this.drawBatchedWaves(
        context,
        this.prepared,
        timeSeconds,
      );
      for (const prepared of this.prepared) {
        if (prepared.kind === "wave") continue;
        if (prepared.kind === "current") this.drawCurrent(context, prepared, timeSeconds);
        else if (prepared.kind === "graphite") this.drawGraphite(context, prepared, timeSeconds);
        else this.drawPigmentForce(context, prepared, timeSeconds);
      }
    } else {
      for (const prepared of this.prepared) {
        if (prepared.kind === "wave") this.drawWave(context, prepared, timeSeconds);
        else if (prepared.kind === "current") this.drawCurrent(context, prepared, timeSeconds);
        else if (prepared.kind === "graphite") this.drawGraphite(context, prepared, timeSeconds);
        else this.drawPigmentForce(context, prepared, timeSeconds);
      }
    }
    // Everything the forces moved stays clipped to the avatar silhouette. A
    // destination-in multiply keeps the waves' alpha dips (they are the point).
    context.globalCompositeOperation = "destination-in";
    context.globalAlpha = 1;
    context.drawImage(source, 0, 0, this.size, this.size);
    context.globalCompositeOperation = "source-over";
    return this.canvas;
  }

  private prepareMarks(value: LivePaintingConfig): void {
    const config = normalizeLivePaintingConfig(value);
    // The force dial retimes every mark together (quiet → live).
    this.speedScale = liveForceSpeedScale(config.strength ?? LIVE_STRENGTH_DEFAULT);
    const scale = this.size / LIVE_MARK_SPACE;
    let atlasIndex = 0;
    this.prepared = config.marks.flatMap((sourceMark): PreparedMark[] => {
      const mark = {
        ...sourceMark,
        x: sourceMark.x * scale,
        y: sourceMark.y * scale,
        size: sourceMark.size * scale,
      };
      const seed01 = Math.max(0, Math.min(65_535, mark.seed)) / 65_535;
      if (mark.brush === "liquid-color") {
        // Wave marks act on whatever paint their ring crosses, so they need
        // no pigment of their own at the exact mark point.
        const stamps = waveStamps();
        return [{
          kind: "wave",
          mark,
          seed01,
          speed: (LIVE_ALPHA_WAVE_SPEED_MIN + seed01 * LIVE_ALPHA_WAVE_SPEED_RANGE) * this.speedScale,
          rotation: seed01 * Math.PI * 2,
          stampIndex: Math.floor(seed01 * stamps.count) % stamps.count,
        }];
      }
      const rgb = this.paintColorAt(mark.x, mark.y);
      if (!rgb) return [];
      if (mark.brush === "blue-current") {
        return [{ kind: "current", mark, seed01, rgb }];
      }
      if (mark.brush === "firefly" || mark.brush === "growth" || mark.brush === "color-liquify-splash") {
        const atlasVariantCount = mark.brush === "color-liquify-splash" ? 4 : 1;
        const prepared: PreparedPigment = {
          kind: mark.brush === "color-liquify-splash" ? "splash" : mark.brush,
          mark,
          seed01,
          rgb,
          atlasIndex,
          atlasVariantCount,
        };
        atlasIndex += atlasVariantCount;
        return [prepared];
      }
      return [{
        kind: "graphite",
        mark,
        seed01,
        speed: (LIVE_GRAPHITE_SPEED_MIN + seed01 * LIVE_GRAPHITE_SPEED_RANGE) * this.speedScale,
        css: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
      }];
    });
    this.preparePigmentAtlas(atlasIndex);
  }

  private preparePigmentAtlas(cellCount: number): void {
    this.releasePigmentAtlas();
    if (cellCount <= 0) return;
    const tile = AVATAR_PIGMENT_ATLAS_TILE_SIZE;
    const columns = Math.min(AVATAR_PIGMENT_ATLAS_COLUMNS, cellCount);
    const rows = Math.ceil(cellCount / columns);
    const atlas = document.createElement("canvas");
    atlas.width = columns * tile;
    atlas.height = rows * tile;
    const context = atlas.getContext("2d", { alpha: true })!;

    for (const prepared of this.prepared) {
      if (prepared.kind !== "firefly" && prepared.kind !== "growth" && prepared.kind !== "splash") continue;
      for (let variant = 0; variant < prepared.atlasVariantCount; variant += 1) {
        const index = prepared.atlasIndex + variant;
        const centerX = index % columns * tile + tile / 2;
        const centerY = Math.floor(index / columns) * tile + tile / 2;
        const softness = prepared.kind === "splash"
          ? variant / 3
          : prepared.kind === "firefly" ? 1 : .45;
        const outer = tile * .42;
        const inner = Math.max(.7, outer * (1 - softness * .78));
        const [red, green, blue] = prepared.rgb;
        const gradient = context.createRadialGradient(
          centerX,
          centerY,
          Math.min(inner, outer - .5),
          centerX,
          centerY,
          outer,
        );
        gradient.addColorStop(0, `rgba(${red}, ${green}, ${blue}, .92)`);
        gradient.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);
        context.fillStyle = gradient;
        context.beginPath();
        if (prepared.kind === "growth") {
          context.ellipse(centerX, centerY, outer, outer * .3, 0, 0, Math.PI * 2);
        } else {
          context.arc(centerX, centerY, outer, 0, Math.PI * 2);
        }
        context.fill();
      }
    }
    this.pigmentAtlasCanvas = atlas;
  }

  private releasePigmentAtlas(): void {
    const atlas = this.pigmentAtlasCanvas;
    if (!atlas) return;
    atlas.width = 0;
    atlas.height = 0;
    this.pigmentAtlasCanvas = null;
  }

  private drawPigmentForce(
    context: CanvasRenderingContext2D,
    prepared: PreparedPigment,
    timeSeconds: number,
  ): void {
    const { mark } = prepared;
    const time = timeSeconds * this.speedScale;
    const flowScale = Math.max(.1, Math.min(1, mark.flow / 100));
    let x = mark.x;
    let y = mark.y;
    let size = mark.size;
    let alpha = flowScale;
    let angle = mark.angle;
    let variant = 0;
    let blend: GlobalCompositeOperation = "source-over";

    if (prepared.kind === "firefly") {
      const direction = Math.sin(time * .57 + prepared.seed01 * 11) * Math.PI * 1.7
        + Math.sin(time * .23 + prepared.seed01 * 19) * Math.PI;
      const wander = Math.min(12, 3 + mark.size * (.08 + prepared.seed01 * .12));
      x += Math.cos(direction) * wander;
      y += Math.sin(direction) * wander;
      const flicker = .35 + Math.abs(Math.sin(time * 2.6 + prepared.seed01 * 10)) * .6;
      size *= .58 + flicker * .3;
      alpha *= flicker * .68;
      angle = 0;
      blend = "lighter";
    } else if (prepared.kind === "growth") {
      const pulse = .5 + .5 * Math.sin(time * .72 + prepared.seed01 * Math.PI * 2);
      x += Math.sin(time * 1.3 + prepared.seed01 * 8) * Math.min(4, mark.size * .08);
      size *= .72 + pulse * .38;
      alpha *= .48 + pulse * .32;
    } else {
      const duration = 5.3846;
      const age = (time + prepared.seed01 * duration) % duration;
      const progress = age / duration;
      const soak = 1 - (1 - progress) ** 2.4;
      const reach = mark.size * (.24 + prepared.seed01 * .62) * soak;
      const sideways = (prepared.seed01 - .5) * mark.size * .72 * Math.sqrt(soak);
      x += Math.cos(angle) * reach - Math.sin(angle) * sideways;
      y += Math.sin(angle) * reach + Math.cos(angle) * sideways;
      size *= .34 + soak * (1.45 + prepared.seed01 * .7);
      variant = Math.round(clamp01(.72 + soak * .28) * 3);
      const remain = 1 - progress;
      alpha *= .72 * (remain < .3 ? remain / .3 : 1);
    }
    if (alpha <= .01 || size <= .2) return;
    this.drawPigmentAtlasCell(context, prepared, x, y, size, angle, alpha, variant, blend);
  }

  private drawPigmentAtlasCell(
    context: CanvasRenderingContext2D,
    prepared: PreparedPigment,
    x: number,
    y: number,
    size: number,
    angle: number,
    alpha: number,
    variant: number,
    blend: GlobalCompositeOperation,
  ): void {
    const atlas = this.pigmentAtlasCanvas;
    if (!atlas) return;
    const tile = AVATAR_PIGMENT_ATLAS_TILE_SIZE;
    const columns = Math.max(1, Math.floor(atlas.width / tile));
    const index = prepared.atlasIndex
      + Math.max(0, Math.min(prepared.atlasVariantCount - 1, variant));
    const sourceX = index % columns * tile;
    const sourceY = Math.floor(index / columns) * tile;
    const destinationSize = size * 1.18;
    context.save();
    context.translate(x, y);
    if (angle) context.rotate(angle);
    context.globalAlpha = clamp01(alpha);
    context.globalCompositeOperation = blend;
    context.drawImage(
      atlas,
      sourceX,
      sourceY,
      tile,
      tile,
      -destinationSize / 2,
      -destinationSize / 2,
      destinationSize,
      destinationSize,
    );
    context.restore();
  }

  /** The room's alpha wave applied locally to the Hider's own paint: inside
   * one expanding organic ring the base paint thins (pure alpha, like the
   * room's transparent holes) and the same pigment is re-laid slightly
   * outward, so the wave reads as force even over flat color. Flow scales the
   * pigment density of the force; the force dial only retimes it. */
  private drawBatchedWaves(
    context: CanvasRenderingContext2D,
    preparedMarks: readonly PreparedMark[],
    time: number,
  ): void {
    if (preparedMarks.length === 0) return;
    const scratch = this.scratchContext;
    const stamps = waveStamps();
    const full = this.liquidDiagnosticPass === "full";
    const tint = this.liquidDiagnosticPass === "batch-tint";
    let drewMask = false;

    // One clear and one source-over union for the complete frame. Pre-cut
    // annuli avoid the old per-mark destination-out ring construction.
    scratch.setTransform(1, 0, 0, 1, 0, 0);
    scratch.globalCompositeOperation = "source-over";
    scratch.globalAlpha = 1;
    scratch.clearRect(0, 0, this.size, this.size);
    for (const prepared of preparedMarks) {
      if (prepared.kind !== "wave") continue;
      const { mark } = prepared;
      const wave = liveAlphaWaveState(time, prepared.seed01, prepared.speed);
      const flowScale = Math.max(.1, Math.min(1, mark.flow / 100));
      const opacity = wave.opacity * LIVE_FORCE_STRENGTH * flowScale;
      if (opacity <= .004) continue;
      const front = (mark.size * .5 + mark.size * WAVE_REACH) * wave.growth;
      if (front < 1) continue;
      const band = mark.size * (WAVE_BAND_BASE + wave.growth * WAVE_BAND_GROW);
      const inner = Math.max(0, front - band);
      const innerRatio = clamp01(inner / front);
      const bucket = Math.round(
        Math.min(stamps.ringMaxInnerRatio, innerRatio)
          / stamps.ringMaxInnerRatio
          * (stamps.ringBuckets - 1),
      );
      const ringIndex = prepared.stampIndex * stamps.ringBuckets + bucket;
      const ringX = ringIndex % stamps.ringColumns * stamps.ringSize;
      const ringY = stamps.ringOffsetY
        + Math.floor(ringIndex / stamps.ringColumns) * stamps.ringSize;

      scratch.save();
      scratch.globalAlpha = clamp01(
        opacity * (full ? 1 : tint ? LIQUID_REVEAL : WAVE_EROSION),
      );
      scratch.translate(mark.x, mark.y);
      scratch.rotate(prepared.rotation);
      scratch.drawImage(
        stamps.canvas,
        ringX,
        ringY,
        stamps.ringSize,
        stamps.ringSize,
        -front,
        -front,
        front * 2,
        front * 2,
      );
      scratch.restore();
      drewMask = true;
    }
    if (!drewMask) return;

    // All marks now share one scratch mask. Batch Full consumes it once for
    // erosion, then once for a shared moving copy of the Hider's own pigment.
    if (full) {
      context.globalCompositeOperation = "destination-out";
      context.globalAlpha = WAVE_EROSION;
      context.drawImage(this.scratch, 0, 0);

      const phase = time * this.speedScale;
      const motionScale = this.size / 512;
      const pulse = .5 + Math.sin(phase * .83) * .5;
      const zoom = 1 + pulse * WAVE_ZOOM;
      const driftX = Math.sin(phase * .71) * WAVE_DRIFT * motionScale;
      const driftY = Math.cos(phase * .59) * WAVE_DRIFT * .72 * motionScale;
      scratch.setTransform(1, 0, 0, 1, 0, 0);
      scratch.globalCompositeOperation = "source-in";
      scratch.globalAlpha = 1;
      scratch.translate(this.size / 2 + driftX, this.size / 2 + driftY);
      scratch.scale(zoom, zoom);
      scratch.translate(-this.size / 2, -this.size / 2);
      scratch.drawImage(this.sample, 0, 0);

      context.globalCompositeOperation = "source-over";
      context.globalAlpha = LIQUID_REVEAL;
      context.drawImage(this.scratch, 0, 0);
    } else if (tint) {
      scratch.setTransform(1, 0, 0, 1, 0, 0);
      scratch.globalCompositeOperation = "source-in";
      scratch.globalAlpha = 1;
      scratch.fillStyle = "#e3bd67";
      scratch.fillRect(0, 0, this.size, this.size);
      context.globalCompositeOperation = "source-over";
    } else {
      context.globalCompositeOperation = "destination-out";
    }
    if (!full) {
      context.globalAlpha = 1;
      context.drawImage(this.scratch, 0, 0);
    }
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    scratch.globalCompositeOperation = "source-over";
  }

  private drawWave(context: CanvasRenderingContext2D, prepared: PreparedWave, time: number): void {
    if (this.liquidDiagnosticPass === "off") return;
    const drawErosion = this.liquidDiagnosticPass === "legacy-full"
      || this.liquidDiagnosticPass === "erosion";
    const drawRelay = this.liquidDiagnosticPass === "legacy-full"
      || this.liquidDiagnosticPass === "relay"
      || this.liquidDiagnosticPass === "relay-tint";
    const { mark } = prepared;
    const wave = liveAlphaWaveState(time, prepared.seed01, prepared.speed);
    const flowScale = Math.max(.1, Math.min(1, mark.flow / 100));
    const opacity = wave.opacity * LIVE_FORCE_STRENGTH * flowScale;
    if (opacity <= .004) return;
    const front = (mark.size * .5 + mark.size * WAVE_REACH) * wave.growth;
    if (front < 1) return;
    const band = mark.size * (WAVE_BAND_BASE + wave.growth * WAVE_BAND_GROW);
    const inner = Math.max(0, front - band);
    // Every operation below is bounded to the mark's box — a frame costs
    // O(Σ mark areas), never O(marks × canvas). Full-canvas composites per
    // mark were the phone/iPad lag (the same lesson as Art Lab's brush).
    const pad = Math.ceil(front) + 2;
    const boxX = Math.max(0, Math.floor(mark.x - pad));
    const boxY = Math.max(0, Math.floor(mark.y - pad));
    const boxW = Math.min(this.size, Math.ceil(mark.x + pad)) - boxX;
    const boxH = Math.min(this.size, Math.ceil(mark.y + pad)) - boxY;
    if (boxW <= 0 || boxH <= 0) return;

    // 1. The ring mask, from the shared organic cloud stamps.
    const scratch = this.scratchContext;
    scratch.setTransform(1, 0, 0, 1, 0, 0);
    scratch.globalCompositeOperation = "source-over";
    scratch.globalAlpha = 1;
    scratch.clearRect(boxX, boxY, boxW, boxH);
    scratch.save();
    // The rect clip keeps even the whole-canvas source-in composite inside
    // the box (leftovers outside are never read — blits are box-bounded).
    scratch.beginPath();
    scratch.rect(boxX, boxY, boxW, boxH);
    scratch.clip();
    scratch.translate(mark.x, mark.y);
    scratch.rotate(prepared.rotation);
    const stamps = waveStamps();
    const stampX = prepared.stampIndex % stamps.columns * stamps.size;
    const stampY = Math.floor(prepared.stampIndex / stamps.columns) * stamps.size;
    scratch.drawImage(
      stamps.canvas,
      stampX,
      stampY,
      stamps.size,
      stamps.size,
      -front,
      -front,
      front * 2,
      front * 2,
    );
    if (inner > 1) {
      // Cut the already-crossed core so the wave is a dissipating ring, not a
      // growing disc — the room's smoke-ring signature.
      scratch.globalCompositeOperation = "destination-out";
      scratch.drawImage(
        stamps.canvas,
        stampX,
        stampY,
        stamps.size,
        stamps.size,
        -inner,
        -inner,
        inner * 2,
        inner * 2,
      );
    }

    // 2. Thin the base paint inside the ring (alpha-only, heals next frame).
    // destination-out is identity outside the drawn source, so the bounded
    // blit leaves the rest of the avatar untouched.
    if (drawErosion) {
      const erosion = opacity * WAVE_EROSION;
      context.globalCompositeOperation = "destination-out";
      context.globalAlpha = clamp01(erosion);
      context.drawImage(this.scratch, boxX, boxY, boxW, boxH, boxX, boxY, boxW, boxH);
    }

    // 3. Re-lay the SAME pigment slightly pushed outward through the ring.
    if (drawRelay) {
      scratch.setTransform(1, 0, 0, 1, 0, 0);
      scratch.globalCompositeOperation = "source-in";
      if (this.liquidDiagnosticPass === "relay-tint") {
        // Diagnostic only: keep the same mask + source-in + bounded blit, but
        // replace the full sampled-pigment image with a solid bounded fill.
        // If this stays smooth while "relay" stalls, the expensive operation
        // is the per-mark transformed full-source draw, not mask generation or
        // Canvas 2D's source-in mode by itself.
        scratch.fillStyle = "#e3bd67";
        scratch.fillRect(boxX, boxY, boxW, boxH);
      } else {
        const cyclePhase = wave.cycle * Math.PI * 2;
        const motionScale = this.size / 512;
        const zoom = 1 + wave.growth * WAVE_ZOOM;
        const driftX = Math.sin(cyclePhase * .47 + prepared.seed01 * 6) * WAVE_DRIFT * motionScale;
        const driftY = Math.cos(cyclePhase * .39 + prepared.seed01 * 9) * WAVE_DRIFT * .72 * motionScale;
        scratch.translate(mark.x + driftX, mark.y + driftY);
        scratch.scale(zoom, zoom);
        scratch.translate(-mark.x, -mark.y);
        scratch.drawImage(this.sample, 0, 0);
      }
      scratch.restore();
      context.globalCompositeOperation = "source-over";
      context.globalAlpha = clamp01(opacity * LIQUID_REVEAL);
      context.drawImage(this.scratch, boxX, boxY, boxW, boxH, boxX, boxY, boxW, boxH);
    } else {
      scratch.restore();
    }
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
  }

  /** Room drawBlueCurrent at avatar scale, following the gesture angle.
   * The force dial retimes the current; flow fades or thickens its pigment. */
  private drawCurrent(context: CanvasRenderingContext2D, prepared: PreparedCurrent, time: number): void {
    const { mark } = prepared;
    const current = liveCurrentState(time * this.speedScale, prepared.seed01);
    const motionScale = this.size / 512;
    const flowScale = Math.max(.1, Math.min(1, mark.flow / 100));
    const size = mark.size * current.sizeScale;
    const slide = current.slide * motionScale;
    context.save();
    context.translate(
      mark.x + Math.cos(mark.angle) * slide,
      mark.y + Math.sin(mark.angle) * slide + current.yDrift * motionScale,
    );
    context.rotate(mark.angle);
    context.globalAlpha = clamp01(current.opacity * LIVE_FORCE_STRENGTH * flowScale);
    // Stroke the S-flow directly in the sampled colour — no per-colour cached
    // stamp. The transform maps the 112×42 authored stamp onto the mark's
    // footprint (same placement as the old drawImage).
    const [r, g, b] = prepared.rgb;
    context.translate(-size * 1.3, -size * .32);
    context.scale(size * 2.6 / 112, size * .64 / 42);
    const gradient = context.createLinearGradient(0, 21, 112, 21);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
    gradient.addColorStop(.25, `rgba(${r}, ${g}, ${b}, .25)`);
    gradient.addColorStop(.54, `rgba(${r}, ${g}, ${b}, .82)`);
    gradient.addColorStop(.78, `rgba(${r}, ${g}, ${b}, .22)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    context.strokeStyle = gradient;
    context.lineWidth = 8;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(4, 28);
    context.bezierCurveTo(34, 2, 70, 38, 108, 13);
    context.stroke();
    context.restore();
  }

  /** Room strokeDraftVector at avatar scale: a fixed curve whose endpoint
   * advances like a pencil physically drawing (and erasing) the path. */
  private drawGraphite(context: CanvasRenderingContext2D, prepared: PreparedGraphite, time: number): void {
    const { mark } = prepared;
    const graphite = liveGraphiteState(time, prepared.seed01, prepared.speed);
    if (graphite.end - graphite.start <= .001) return;
    const flowScale = Math.max(.1, Math.min(1, mark.flow / 100));
    const length = mark.size * 1.8;
    const bend = (prepared.seed01 - .5) * mark.size * .18;
    const pointAt = (progress: number): readonly [number, number] => {
      const inverse = 1 - progress;
      return [
        inverse * inverse * -length / 2 + progress * progress * length / 2,
        2 * inverse * progress * bend + progress * progress * bend * .16,
      ];
    };
    context.save();
    context.translate(mark.x, mark.y);
    context.rotate(mark.angle);
    context.globalAlpha = .34 * LIVE_FORCE_STRENGTH * flowScale;
    context.strokeStyle = prepared.css;
    context.lineWidth = Math.max(.72, mark.size * .025);
    context.lineCap = "round";
    context.lineJoin = "round";
    const [firstX, firstY] = pointAt(graphite.start);
    const segments = Math.max(1, Math.ceil((graphite.end - graphite.start) * 18));
    context.beginPath();
    context.moveTo(firstX, firstY);
    for (let index = 1; index <= segments; index += 1) {
      const [x, y] = pointAt(
        graphite.start + (graphite.end - graphite.start) * index / segments,
      );
      context.lineTo(x, y);
    }
    context.stroke();
    context.restore();
  }

  /** Art Lab rebuild-photo semantics: the force mark takes the exact color of
   * the already-painted source where the Hider placed it. Live brushes never
   * introduce their named blue/graphite palette. */
  private samplePaint(source: CanvasImageSource): void {
    const context = this.sampleContext;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.size, this.size);
    context.drawImage(source, 0, 0, this.size, this.size);
    try {
      this.samplePixels = context.getImageData(0, 0, this.size, this.size).data;
    } catch {
      this.samplePixels = null;
    }
    this.sampledSource = source;
  }

  private paintColorAt(x: number, y: number): RGB | null {
    if (!this.samplePixels) return null;
    const px = Math.max(0, Math.min(this.size - 1, Math.round(x)));
    const py = Math.max(0, Math.min(this.size - 1, Math.round(y)));
    const offset = (py * this.size + px) * 4;
    if ((this.samplePixels[offset + 3] ?? 0) < 16) return null;
    return [
      this.samplePixels[offset] ?? 0,
      this.samplePixels[offset + 1] ?? 0,
      this.samplePixels[offset + 2] ?? 0,
    ];
  }
}
