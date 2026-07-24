const ROOM_WIDTH = 960;
const ROOM_HEIGHT = 640;
const WARP_GRID_WIDTH = 96;
const WARP_GRID_HEIGHT = 64;
const MAX_RENDERED_MARK_SIZE = 240;
const MAX_MARK_ATLAS_EDGE = 4_096;

type MarkShape = "dot" | "square" | "ring" | "star" | "streak";

interface CuratedLiveMark {
  x: number;
  y: number;
  size: number;
  alpha: number;
  red: number;
  green: number;
  blue: number;
  shape: MarkShape;
  softIdx: number;
  angle: number;
  glow: boolean;
  life: number;
  born: number;
  seed: number;
  index: number;
}

interface CuratedStroke {
  brushRevision: string;
  marks: CuratedLiveMark[];
}

interface CuratedLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: GlobalCompositeOperation;
  timeScale: number;
  timeOffsetMs: number;
  strokes: CuratedStroke[];
}

interface LissajousAdapter {
  kind: "lissajous-heartbeat";
  speed: number;
}

interface RippleAdapter {
  kind: "ripple";
  speed: number;
  size: number;
  ringSpeed: number;
  range: number;
  colorFlicker: number;
  photoOpacity: number;
  photoBlur: number;
}

interface LiquidWarpAdapter {
  kind: "liquid-warp";
  speed: number;
  strength: number;
  wavelength: number;
  edgeFeather?: number;
  edgeBlur?: number;
  edgeOpacity?: number;
}

interface GrowthAdapter {
  kind: "growth";
  speed: number;
  sway: number;
  photoOpacity: number;
  photoBlur: number;
}

interface FireflyAdapter {
  kind: "firefly";
  speed: number;
  wander: number;
}

interface TwinkleAdapter {
  kind: "twinkle";
  speed: number;
  twinkleRate: number;
}

interface GalaxyAdapter {
  kind: "galaxy";
  speed: number;
  turn: number;
  arm: number;
}

interface ColorLiquifySplashAdapter {
  kind: "color-liquify-splash";
  speed: number;
  distance: number;
  diffusion: number;
}

interface ColorLiquifyBreakoutAdapter {
  kind: "color-liquify-breakout";
  speed: number;
  size: number;
  travel: number;
  lives: number;
}

interface CurveCurrentAdapter {
  kind: "curve-current";
  speed: number;
  flow: number;
  startStagger: number;
  activeWindow: number;
  arriveAt: number;
  wobble: number;
  photoOpacity: number;
  photoBlur: number;
  cover?: {
    lead: number;
    restore: number;
    finalPause: number;
    red: number;
    green: number;
    blue: number;
    opacity: number;
    startFade?: number;
    endFade?: number;
  };
}

type CuratedMarkAdapter =
  | LissajousAdapter
  | RippleAdapter
  | GrowthAdapter
  | FireflyAdapter
  | TwinkleAdapter
  | GalaxyAdapter
  | ColorLiquifySplashAdapter
  | ColorLiquifyBreakoutAdapter
  | CurveCurrentAdapter;
type CuratedAdapter = CuratedMarkAdapter | LiquidWarpAdapter;

interface CuratedWarpField {
  brushRevision: string;
  maskRle: string;
}

export interface CuratedLiveProject {
  format: "painterly-curated-live-project";
  version: 1;
  id: string;
  artHouse: string;
  roomIndex: number;
  baseSurface: 0 | 1 | 2;
  canvas: { width: number; height: number };
  source: { gameAsset: string; sha256: string; lppSha256: string };
  clock: { timeAnchor: number; timeOrigin: "scene-enter"; unit: "seconds" };
  adapters: Record<string, CuratedAdapter>;
  layers: CuratedLayer[];
  warps: CuratedWarpField[];
  stats: { marks: number; strokes: number; warpFields: number };
}

/**
 * Diagnostic stage filter for the additive live-1a benchmark. Production
 * callers omit it and continue to render every authored warp and mark.
 */
export interface CuratedLiveDrawStages {
  warpFieldLimit?: number;
  marks?: boolean;
  markKinds?: readonly CuratedMarkAdapter["kind"][];
  markLimit?: number;
  flatDots?: boolean;
  atlasSoftMarks?: boolean;
  curveRole?: "cover" | "moving";
}

interface WarpSlice {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  logicalY: number;
  alpha: number;
  blurMix: number;
}

interface PreparedWarpField {
  adapter: LiquidWarpAdapter;
  slices: WarpSlice[];
}

interface PreparedMark extends CuratedLiveMark {
  photoRed: number;
  photoGreen: number;
  photoBlue: number;
  atlasIndex: number;
  atlasVariantCount: number;
  atlasRed: number;
  atlasGreen: number;
  atlasBlue: number;
  atlasSoftIdx: number;
  curveStartDistance: number;
  curveSideDistance: number;
  curveOrder: number;
  curveCover: boolean;
}

interface PreparedCurvePoint {
  x: number;
  y: number;
  distance: number;
}

interface PreparedCurvePath {
  points: PreparedCurvePoint[];
  total: number;
  endpointX: number;
  endpointY: number;
  endpointAngle: number;
}

interface PreparedStroke {
  adapter: CuratedMarkAdapter;
  marks: PreparedMark[];
  curvePath: PreparedCurvePath | null;
}

interface PreparedLayer {
  visible: boolean;
  opacity: number;
  blendMode: GlobalCompositeOperation;
  timeScale: number;
  timeOffsetMs: number;
  strokes: PreparedStroke[];
}

interface ResolvedMark {
  x: number;
  y: number;
  size: number;
  alpha: number;
  red: number;
  green: number;
  blue: number;
  shape: MarkShape;
  softIdx: number;
  angle: number;
  glow: boolean;
  atlasIndex: number;
  atlasVariantCount: number;
  atlasBaseSize: number;
}

interface CuratedProjectRef {
  id: string;
  artHouse: string;
  roomIndex: number;
  baseSurface: 0 | 1 | 2;
  url: string;
}

const CURATED_PROJECT_REFS: readonly CuratedProjectRef[] = [
  {
    id: "van-gogh-sunflower-parlor-1a",
    artHouse: "van-gogh-house",
    roomIndex: 0,
    baseSurface: 2,
    url: new URL("./assets/live-projects/van-gogh-sunflower-parlor-1a.json", import.meta.url).href,
  },
  {
    id: "van-gogh-starry-studio-1b",
    artHouse: "van-gogh-house",
    roomIndex: 1,
    baseSurface: 0,
    url: new URL("./assets/live-projects/van-gogh-starry-studio-1b.json", import.meta.url).href,
  },
  {
    id: "van-gogh-cypress-bedroom-1c",
    artHouse: "van-gogh-house",
    roomIndex: 2,
    baseSurface: 0,
    url: new URL("./assets/live-projects/van-gogh-cypress-bedroom-1c.json", import.meta.url).href,
  },
];

const loadedProjects = new Map<string, CuratedLiveProject>();
const projectLoads = new Map<string, Promise<void>>();
const failedProjects = new Set<string>();
const projectCallbacks = new Map<string, Set<() => void>>();

function projectRefFor(artHouse: string, roomIndex: number): CuratedProjectRef | null {
  return CURATED_PROJECT_REFS.find(ref => ref.artHouse === artHouse && ref.roomIndex === roomIndex) ?? null;
}

export function curatedLiveProjectFor(artHouse: string, roomIndex: number): CuratedLiveProject | null {
  const ref = projectRefFor(artHouse, roomIndex);
  return ref ? loadedProjects.get(ref.id) ?? null : null;
}

export function curatedLiveBaseSurface(artHouse: string, roomIndex: number): 0 | 1 | 2 | null {
  return projectRefFor(artHouse, roomIndex)?.baseSurface ?? null;
}

export function supportsCuratedLiveProject(artHouse: string, roomIndex: number): boolean {
  return Boolean(projectRefFor(artHouse, roomIndex));
}

export function ensureCuratedLiveProject(
  artHouse: string,
  roomIndex: number,
  onReady: () => void,
): "ready" | "loading" | "failed" | "missing" {
  const ref = projectRefFor(artHouse, roomIndex);
  if (!ref) return "missing";
  if (loadedProjects.has(ref.id)) return "ready";
  if (failedProjects.has(ref.id)) return "failed";

  let callbacks = projectCallbacks.get(ref.id);
  if (!callbacks) {
    callbacks = new Set();
    projectCallbacks.set(ref.id, callbacks);
  }
  callbacks.add(onReady);

  if (!projectLoads.has(ref.id)) {
    const load = fetch(ref.url)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then(raw => {
        const project = raw as Partial<CuratedLiveProject>;
        if (project.format !== "painterly-curated-live-project"
          || project.version !== 1
          || project.id !== ref.id
          || project.artHouse !== ref.artHouse
          || project.roomIndex !== ref.roomIndex
          || project.baseSurface !== ref.baseSurface
          || project.canvas?.width !== ROOM_WIDTH
          || project.canvas?.height !== ROOM_HEIGHT) {
          throw new Error("runtime project metadata mismatch");
        }
        loadedProjects.set(ref.id, project as CuratedLiveProject);
      })
      .catch(error => {
        failedProjects.add(ref.id);
        console.warn(`Live Painting ${ref.id} failed to load; using the static room.`, error);
      })
      .finally(() => {
        const listeners = projectCallbacks.get(ref.id);
        projectCallbacks.delete(ref.id);
        for (const callback of listeners ?? []) callback();
      });
    projectLoads.set(ref.id, load);
  }
  return "loading";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function imageReady(image: HTMLImageElement): boolean {
  return Boolean(image.complete && image.naturalWidth && image.naturalHeight);
}

function decodeMaskRle(data: string): Uint8Array {
  const rawString = atob(data);
  if (rawString.length % 2 !== 0) throw new Error("Invalid Live Painting warp mask");
  const output = new Uint8Array(WARP_GRID_WIDTH * WARP_GRID_HEIGHT);
  let cursor = 0;
  for (let index = 0; index < rawString.length; index += 2) {
    const value = rawString.charCodeAt(index);
    const count = rawString.charCodeAt(index + 1);
    if (value > 1 || count < 1 || cursor + count > output.length) throw new Error("Invalid Live Painting warp run");
    output.fill(value, cursor, cursor + count);
    cursor += count;
  }
  if (cursor !== output.length) throw new Error("Incomplete Live Painting warp mask");
  return output;
}

function speedScale(speed: number): number {
  return .15 + clamp(speed, 0, 100) / 100 * 1.85;
}

function smoothstep01(value: number): number {
  const progress = clamp(value, 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function prepareCurvePath(
  marks: readonly CuratedLiveMark[],
  adapter: CurveCurrentAdapter,
): { path: PreparedCurvePath | null; starts: { distance: number; side: number; order: number }[] } {
  const flow = Math.floor(adapter.flow);
  if (flow < 1 || flow > 8) throw new Error("Curve Current flow is out of bounds");
  if (adapter.cover && marks.length % flow !== 0) {
    throw new Error("Curve Current Source Cover cohort is incomplete");
  }
  const points: PreparedCurvePoint[] = [];
  let total = 0;
  for (let offset = 0; offset < marks.length; offset += flow) {
    const end = Math.min(marks.length, offset + flow);
    let x = 0;
    let y = 0;
    if (adapter.cover) {
      const coverMark = marks[offset]!;
      if (coverMark.angle >= -10) throw new Error("Curve Current Source Cover sentinel is missing");
      for (let index = offset + 1; index < end; index += 1) {
        if (marks[index]!.angle < -10) throw new Error("Curve Current Source Cover cohort has multiple covers");
      }
      // The cover is born at the actual hand point. Use it instead of the
      // side-scattered moving pigments to reconstruct the authored curve.
      x = coverMark.x;
      y = coverMark.y;
    } else {
      for (let index = offset; index < end; index += 1) {
        x += marks[index]!.x;
        y += marks[index]!.y;
      }
      x /= end - offset;
      y /= end - offset;
    }
    const before = points.at(-1);
    if (before) {
      const step = Math.hypot(x - before.x, y - before.y);
      if (step <= .25) continue;
      total += step;
    }
    points.push({ x, y, distance: total });
  }
  if (points.length < 2 || total < 2) {
    return {
      path: null,
      starts: marks.map(() => ({ distance: 0, side: 0, order: 0 })),
    };
  }

  const endpoint = points.at(-1)!;
  const beforeEndpoint = points.at(-2)!;
  const endpointAngle = Math.atan2(endpoint.y - beforeEndpoint.y, endpoint.x - beforeEndpoint.x);
  const path: PreparedCurvePath = {
    points,
    total,
    endpointX: endpoint.x,
    endpointY: endpoint.y,
    endpointAngle,
  };
  const starts = marks.map(mark => {
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    let distance = 0;
    let side = 0;
    for (let index = 1; index < points.length; index += 1) {
      const before = points[index - 1]!;
      const after = points[index]!;
      const segmentX = after.x - before.x;
      const segmentY = after.y - before.y;
      const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
      if (segmentLengthSquared <= .0001) continue;
      const segmentLength = Math.sqrt(segmentLengthSquared);
      const amount = clamp(
        ((mark.x - before.x) * segmentX + (mark.y - before.y) * segmentY) / segmentLengthSquared,
        0,
        1,
      );
      const offsetX = mark.x - (before.x + segmentX * amount);
      const offsetY = mark.y - (before.y + segmentY * amount);
      const distanceSquared = offsetX * offsetX + offsetY * offsetY;
      if (distanceSquared >= bestDistanceSquared) continue;
      bestDistanceSquared = distanceSquared;
      distance = before.distance + segmentLength * amount;
      side = offsetX * (-segmentY / segmentLength) + offsetY * (segmentX / segmentLength);
    }
    return { distance, side, order: clamp(distance / total, 0, 1) };
  });
  return { path, starts };
}

function featherWarpMask(
  mask: Uint8Array,
  adapter: LiquidWarpAdapter,
): { alpha: Uint8Array; blurMix: Uint8Array } {
  const alpha = new Uint8Array(mask.length);
  const blurMix = new Uint8Array(mask.length);
  const edgeFeather = clamp(adapter.edgeFeather ?? 0, 0, 8);
  const edgeOpacity = clamp(adapter.edgeOpacity ?? 100, 0, 100) / 100;
  if (edgeFeather <= 0) {
    for (let index = 0; index < mask.length; index += 1) {
      if (mask[index]) alpha[index] = 255;
    }
    return { alpha, blurMix };
  }

  const searchRadius = Math.ceil(edgeFeather) + 1;
  const inward = new Float32Array(mask.length);
  let maxInward = 0;
  for (let y = 0; y < WARP_GRID_HEIGHT; y += 1) {
    for (let x = 0; x < WARP_GRID_WIDTH; x += 1) {
      const index = y * WARP_GRID_WIDTH + x;
      if (!mask[index]) continue;
      let nearestOutside = Number.POSITIVE_INFINITY;
      for (let offsetY = -searchRadius; offsetY <= searchRadius; offsetY += 1) {
        for (let offsetX = -searchRadius; offsetX <= searchRadius; offsetX += 1) {
          const sampleX = x + offsetX;
          const sampleY = y + offsetY;
          if (sampleX >= 0
            && sampleX < WARP_GRID_WIDTH
            && sampleY >= 0
            && sampleY < WARP_GRID_HEIGHT
            && mask[sampleY * WARP_GRID_WIDTH + sampleX]) {
            continue;
          }
          nearestOutside = Math.min(nearestOutside, Math.hypot(offsetX, offsetY));
        }
      }
      const distance = Number.isFinite(nearestOutside)
        ? Math.max(0, nearestOutside - 1)
        : edgeFeather;
      inward[index] = distance;
      maxInward = Math.max(maxInward, distance);
    }
  }

  // The Art Lab brush explicitly gives thin fields their full effect when
  // they have no interior. Wider fields retain a 72% moving-color seam and
  // smoothly reach full opacity over the authored inward feather.
  const availableFeather = Math.min(edgeFeather, maxInward);
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    const feather = availableFeather > 0 ? clamp(inward[index]! / availableFeather, 0, 1) : 1;
    alpha[index] = Math.round((edgeOpacity + (1 - edgeOpacity) * feather) * 255);
    blurMix[index] = Math.round((1 - feather) * 255);
  }
  return { alpha, blurMix };
}

/**
 * Playback for build-approved Art Lab projects. It consumes no Function Brush
 * source and performs no dynamic compilation: only declarative marks/masks and
 * the static adapters above reach this browser module.
 */
export class CuratedLiveRoomRenderer {
  private readonly sourceCanvas = document.createElement("canvas");
  // resolveMark writes into this one scratch record. drawOneMark consumes it
  // synchronously before the next mark, avoiding thousands of short-lived
  // result objects in high-cardinality rooms.
  private readonly resolvedMark: ResolvedMark = {
    x: 0,
    y: 0,
    size: 0,
    alpha: 0,
    red: 0,
    green: 0,
    blue: 0,
    shape: "dot",
    softIdx: 0,
    angle: 0,
    glow: false,
    atlasIndex: -1,
    atlasVariantCount: 0,
    atlasBaseSize: 0,
  };
  // Allocated only for the live-1a atlas A/B. One atlas packs every authored
  // color; it is never one canvas per mark, color, layer or animation state.
  private markAtlasCanvas: HTMLCanvasElement | null = null;
  private markAtlasTileSize = 0;
  private markAtlasColumns = 0;
  private markAtlasProjectId = "";
  // Final 1C has one authored 7px edge blur shared by both warp fields. Keep
  // one prepared source texture, never one blur canvas per field or slice.
  private warpBlurCanvas: HTMLCanvasElement | null = null;
  private warpBlurRadius = 0;
  // The source canvas exists only long enough to read the room's birth colors.
  // Its backing store is zeroed immediately after prepare(). Every animated
  // warp and mark then draws directly into the caller's visible context — the
  // exact architecture proven by the live-1a additive control.
  private sourcePixels: Uint8ClampedArray | null = null;
  private preparedImage: HTMLImageElement | null = null;
  private preparedProjectId = "";
  private preparedWarps: PreparedWarpField[] = [];
  private preparedLayers: PreparedLayer[] = [];
  private readonly disabledProjects = new Set<string>();
  private disposed = false;

  draw(
    context: CanvasRenderingContext2D,
    sourceImage: HTMLImageElement,
    project: CuratedLiveProject,
    sceneSeconds: number,
    stages?: CuratedLiveDrawStages,
  ): boolean {
    if (this.disposed || !imageReady(sourceImage) || this.disabledProjects.has(project.id)) return false;
    try {
      if (this.preparedImage !== sourceImage || this.preparedProjectId !== project.id) {
        this.prepare(sourceImage, project);
      }
      const atlasSoftMarks = stages?.atlasSoftMarks !== false;
      if (stages?.marks !== false && atlasSoftMarks) this.ensureMarkAtlas();
      else this.releaseMarkAtlas();
      const projectSeconds = project.clock.timeAnchor + Math.max(0, sceneSeconds);
      context.save();
      context.imageSmoothingEnabled = true;
      const warpFieldLimit = clamp(
        Math.floor(stages?.warpFieldLimit ?? this.preparedWarps.length),
        0,
        this.preparedWarps.length,
      );
      this.drawWarps(context, sourceImage, projectSeconds, warpFieldLimit);
      if (stages?.marks !== false) {
        const markBudget = {
          remaining: Math.max(0, Math.floor(stages?.markLimit ?? Number.MAX_SAFE_INTEGER)),
        };
        for (const layer of this.preparedLayers) {
          this.drawLayer(context, layer, projectSeconds, stages, markBudget, atlasSoftMarks);
        }
      }
      context.restore();
      return true;
    } catch (error) {
      this.disabledProjects.add(project.id);
      console.warn(`Live Painting ${project.id} fell back to the static room.`, error);
      return false;
    }
  }

  /** The project JSON remains in the shared fetch cache, but this renderer's
   * decoded pixels, prepared marks and GPU backing stores belong only to the
   * currently active room. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sourcePixels = null;
    this.preparedImage = null;
    this.preparedProjectId = "";
    this.preparedWarps = [];
    this.preparedLayers = [];
    this.disabledProjects.clear();
    this.releaseMarkAtlas();
    this.releaseWarpBlur();
    this.sourceCanvas.width = 0;
    this.sourceCanvas.height = 0;
  }

  private prepare(sourceImage: HTMLImageElement, project: CuratedLiveProject): void {
    if (project.canvas.width !== ROOM_WIDTH || project.canvas.height !== ROOM_HEIGHT) {
      throw new Error("Curated Live Painting canvas must be 960x640");
    }
    this.sourceCanvas.width = ROOM_WIDTH;
    this.sourceCanvas.height = ROOM_HEIGHT;
    const source = this.sourceCanvas.getContext("2d", { willReadFrequently: true })!;
    source.setTransform(1, 0, 0, 1, 0, 0);
    source.clearRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    source.drawImage(sourceImage, 0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    this.sourcePixels = source.getImageData(0, 0, ROOM_WIDTH, ROOM_HEIGHT).data;
    this.prepareWarpBlur(sourceImage, project);
    this.preparedWarps = project.warps.map(field => {
      const adapter = project.adapters[field.brushRevision];
      if (!adapter || adapter.kind !== "liquid-warp") throw new Error(`Missing warp adapter ${field.brushRevision}`);
      const mask = decodeMaskRle(field.maskRle);
      const feathered = featherWarpMask(mask, adapter);
      // Match the validated control renderer: the tight 2px wave keeps 2px
      // sampling, while broader waves use aligned 5px strips. Slice geometry
      // and mask runs are computed once, never rescanned in the animation loop.
      const sliceHeight = adapter.wavelength <= 4 ? 2 : 5;
      const slices: WarpSlice[] = [];
      for (let y = 0; y < ROOM_HEIGHT; y += sliceHeight) {
        const sourceHeight = Math.min(sliceHeight, ROOM_HEIGHT - y);
        const gridY = Math.min(WARP_GRID_HEIGHT - 1, Math.floor(y / ROOM_HEIGHT * WARP_GRID_HEIGHT));
        let gridX = 0;
        while (gridX < WARP_GRID_WIDTH) {
          const cellIndex = gridY * WARP_GRID_WIDTH + gridX;
          if (!mask[cellIndex]) {
            gridX += 1;
            continue;
          }
          const alphaByte = feathered.alpha[cellIndex]!;
          const blurByte = feathered.blurMix[cellIndex]!;
          let endGridX = gridX + 1;
          while (endGridX < WARP_GRID_WIDTH) {
            const nextIndex = gridY * WARP_GRID_WIDTH + endGridX;
            if (!mask[nextIndex]
              || feathered.alpha[nextIndex] !== alphaByte
              || feathered.blurMix[nextIndex] !== blurByte) {
              break;
            }
            endGridX += 1;
          }
          const sourceX = Math.floor(gridX / WARP_GRID_WIDTH * ROOM_WIDTH);
          const sourceWidth = Math.ceil((endGridX - gridX) / WARP_GRID_WIDTH * ROOM_WIDTH);
          slices.push({
            sourceX,
            sourceY: y,
            sourceWidth,
            sourceHeight,
            logicalY: y + sourceHeight / 2,
            alpha: alphaByte / 255,
            blurMix: blurByte / 255,
          });
          gridX = endGridX;
        }
      }
      return { adapter, slices };
    });
    let atlasIndex = 0;
    this.preparedLayers = project.layers.map(layer => ({
      visible: layer.visible,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      timeScale: layer.timeScale,
      timeOffsetMs: layer.timeOffsetMs,
      strokes: layer.strokes.map(stroke => {
        const adapter = project.adapters[stroke.brushRevision];
        if (!adapter || adapter.kind === "liquid-warp") {
          throw new Error(`Missing mark adapter ${stroke.brushRevision}`);
        }
        const curve = adapter.kind === "curve-current"
          ? prepareCurvePath(stroke.marks, adapter)
          : null;
        return {
          adapter,
          curvePath: curve?.path ?? null,
          marks: stroke.marks.map((mark, markIndex) => {
            const sampleX = adapter.kind === "ripple" ? mark.x + adapter.size / 2 : mark.x;
            const sampled = this.photo(sampleX, mark.y) ?? [mark.red, mark.green, mark.blue];
            const atlasEligible = (mark.shape === "dot" || mark.shape === "streak")
              && (adapter.kind === "lissajous-heartbeat"
                || adapter.kind === "firefly"
                || adapter.kind === "growth"
                || adapter.kind === "twinkle"
                || adapter.kind === "galaxy"
                || adapter.kind === "color-liquify-splash"
                || adapter.kind === "color-liquify-breakout"
                || adapter.kind === "curve-current");
            const atlasUsesPhoto = adapter.kind === "growth";
            const atlasSoftIdx = (adapter.kind === "growth" || adapter.kind === "curve-current")
              && adapter.photoBlur > 0
              ? Math.max(mark.softIdx, Math.round(clamp(adapter.photoBlur / 40, 0, 1) * 3))
              : mark.softIdx;
            // Splash animates soft from .72→1.0. Bake its four discrete runtime
            // softness levels beside each other in the SAME atlas so mobile
            // keeps the authored diffusion without per-frame gradients.
            const atlasVariantCount = atlasEligible
              ? (adapter.kind === "color-liquify-splash" ? 4 : 1)
              : 0;
            const markAtlasIndex = atlasEligible ? atlasIndex : -1;
            atlasIndex += atlasVariantCount;
            return {
              ...mark,
              photoRed: sampled[0],
              photoGreen: sampled[1],
              photoBlue: sampled[2],
              atlasIndex: markAtlasIndex,
              atlasVariantCount,
              atlasRed: atlasUsesPhoto ? sampled[0] : mark.red,
              atlasGreen: atlasUsesPhoto ? sampled[1] : mark.green,
              atlasBlue: atlasUsesPhoto ? sampled[2] : mark.blue,
              atlasSoftIdx,
              curveStartDistance: curve?.starts[markIndex]?.distance ?? 0,
              curveSideDistance: curve?.starts[markIndex]?.side ?? 0,
              curveOrder: curve?.starts[markIndex]?.order ?? 0,
              curveCover: adapter.kind === "curve-current"
                && Boolean(adapter.cover)
                && mark.angle < -10,
            };
          }),
        };
      }),
    }));
    // Birth colors are attached to the prepared marks; the pixel buffer stays
    // for the ripple colorFlicker, which lerps toward the color under the
    // GROWING ring edge — a per-rebuild array lookup, authored in Art Lab.
    this.preparedImage = sourceImage;
    this.preparedProjectId = project.id;
    this.releaseMarkAtlas();
    // Keep the typed pixel buffer, release the GPU/CPU canvas backing store.
    this.sourceCanvas.width = 0;
    this.sourceCanvas.height = 0;
  }

  private prepareWarpBlur(sourceImage: HTMLImageElement, project: CuratedLiveProject): void {
    const radii = [...new Set(project.warps
      .map(field => project.adapters[field.brushRevision])
      .filter((adapter): adapter is LiquidWarpAdapter => adapter?.kind === "liquid-warp")
      .map(adapter => clamp(adapter.edgeBlur ?? 0, 0, 40))
      .filter(radius => radius > 0))];
    if (!radii.length) {
      this.releaseWarpBlur();
      return;
    }
    if (radii.length > 1) throw new Error("Curated warp fields require more than one prepared blur radius");
    const radius = radii[0]!;
    const canvas = this.warpBlurCanvas ??= document.createElement("canvas");
    canvas.width = ROOM_WIDTH;
    canvas.height = ROOM_HEIGHT;
    const context = canvas.getContext("2d", { alpha: true })!;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    context.filter = `blur(${radius}px)`;
    context.drawImage(sourceImage, 0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    context.filter = "none";
    this.warpBlurRadius = radius;
  }

  private releaseWarpBlur(): void {
    if (this.warpBlurCanvas) {
      this.warpBlurCanvas.width = 0;
      this.warpBlurCanvas.height = 0;
      this.warpBlurCanvas = null;
    }
    this.warpBlurRadius = 0;
  }

  private ensureMarkAtlas(): void {
    if (this.markAtlasCanvas && this.markAtlasProjectId === this.preparedProjectId) return;
    this.releaseMarkAtlas();
    const marks = this.preparedLayers.flatMap(layer =>
      layer.strokes.flatMap(stroke => stroke.marks.filter(mark => mark.atlasIndex >= 0)),
    );
    if (!marks.length) return;

    let maxOuterRadius = 0;
    for (const mark of marks) {
      for (let variant = 0; variant < mark.atlasVariantCount; variant += 1) {
        const softIdx = mark.atlasVariantCount > 1 ? variant : mark.atlasSoftIdx;
        const soft = Math.round(clamp(softIdx, 0, 3)) / 3;
        const coreRadius = Math.max(.5, mark.size / 2 * (1 - (7 + soft * 7) / 32));
        maxOuterRadius = Math.max(maxOuterRadius, coreRadius * (1 + soft * .5));
      }
    }
    const tileSize = Math.max(8, Math.ceil(maxOuterRadius * 2) + 4);
    const cellCount = marks.reduce((sum, mark) => sum + mark.atlasVariantCount, 0);
    // Keep the one shared texture close to square. The old 1024px-wide strip
    // became 5456px tall for 1B Curve Current, beyond common mobile texture
    // limits even though its total pixel count was bounded.
    const columns = Math.max(
      1,
      Math.min(
        Math.ceil(Math.sqrt(cellCount)),
        Math.floor(MAX_MARK_ATLAS_EDGE / tileSize),
      ),
    );
    const rows = Math.ceil(cellCount / columns);
    if (columns * tileSize > MAX_MARK_ATLAS_EDGE || rows * tileSize > MAX_MARK_ATLAS_EDGE) {
      throw new Error("Curated mark atlas exceeds the mobile texture bound");
    }
    const atlas = document.createElement("canvas");
    atlas.width = columns * tileSize;
    atlas.height = rows * tileSize;
    const context = atlas.getContext("2d", { alpha: true })!;

    for (const mark of marks) {
      for (let variant = 0; variant < mark.atlasVariantCount; variant += 1) {
        const atlasIndex = mark.atlasIndex + variant;
        const column = atlasIndex % columns;
        const row = Math.floor(atlasIndex / columns);
        const centerX = column * tileSize + tileSize / 2;
        const centerY = row * tileSize + tileSize / 2;
        const softIdx = mark.atlasVariantCount > 1 ? variant : mark.atlasSoftIdx;
        const soft = Math.round(clamp(softIdx, 0, 3)) / 3;
        const coreRadius = Math.max(.5, mark.size / 2 * (1 - (7 + soft * 7) / 32));
        const outer = coreRadius * (1 + soft * .5);
        const inner = coreRadius * (1 - soft * .6);
        const color = `${Math.round(clamp(mark.atlasRed, 0, 255))}, ${Math.round(clamp(mark.atlasGreen, 0, 255))}, ${Math.round(clamp(mark.atlasBlue, 0, 255))}`;
        const gradient = context.createRadialGradient(
          centerX,
          centerY,
          Math.min(inner, outer - .5),
          centerX,
          centerY,
          Math.max(outer, .6),
        );
        gradient.addColorStop(0, `rgba(${color}, .9)`);
        gradient.addColorStop(1, `rgba(${color}, 0)`);
        context.fillStyle = gradient;
        context.beginPath();
        if (mark.shape === "streak") {
          context.ellipse(centerX, centerY, outer, outer * .32, 0, 0, Math.PI * 2);
        } else {
          context.arc(centerX, centerY, outer, 0, Math.PI * 2);
        }
        context.fill();
      }
    }

    this.markAtlasCanvas = atlas;
    this.markAtlasTileSize = tileSize;
    this.markAtlasColumns = columns;
    this.markAtlasProjectId = this.preparedProjectId;
  }

  private releaseMarkAtlas(): void {
    const atlas = this.markAtlasCanvas;
    if (atlas) {
      atlas.width = 0;
      atlas.height = 0;
      this.markAtlasCanvas = null;
    }
    this.markAtlasTileSize = 0;
    this.markAtlasColumns = 0;
    this.markAtlasProjectId = "";
  }

  private drawWarps(
    context: CanvasRenderingContext2D,
    sourceImage: HTMLImageElement,
    projectSeconds: number,
    fieldLimit: number,
  ): void {
    context.save();
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.imageSmoothingEnabled = true;
    for (let fieldIndex = 0; fieldIndex < fieldLimit; fieldIndex += 1) {
      const field = this.preparedWarps[fieldIndex]!;
      const brushTime = projectSeconds * speedScale(field.adapter.speed);
      for (const slice of field.slices) {
        const dx = Math.sin(
          brushTime * 1.2 + slice.logicalY / field.adapter.wavelength,
        ) * field.adapter.strength;
        const blurred = this.warpBlurRadius > 0 && (field.adapter.edgeBlur ?? 0) > 0
          ? this.warpBlurCanvas
          : null;
        const blurredAlpha = blurred ? slice.alpha * slice.blurMix : 0;
        if (blurred && blurredAlpha > .001) {
          context.globalAlpha = blurredAlpha;
          context.drawImage(
            blurred,
            slice.sourceX,
            slice.sourceY,
            slice.sourceWidth,
            slice.sourceHeight,
            slice.sourceX + dx,
            slice.sourceY,
            slice.sourceWidth,
            slice.sourceHeight,
          );
        }
        // Choose the sharp alpha so the combined blurred+sharp coverage still
        // equals the authored edge alpha under source-over compositing.
        const sharpAlpha = blurredAlpha < 1
          ? (slice.alpha - blurredAlpha) / (1 - blurredAlpha)
          : 0;
        if (sharpAlpha > .001) {
          context.globalAlpha = clamp(sharpAlpha, 0, 1);
          context.drawImage(
            sourceImage,
            slice.sourceX,
            slice.sourceY,
            slice.sourceWidth,
            slice.sourceHeight,
            slice.sourceX + dx,
            slice.sourceY,
            slice.sourceWidth,
            slice.sourceHeight,
          );
        }
      }
    }
    context.globalAlpha = 1;
    context.restore();
  }

  private drawLayer(
    context: CanvasRenderingContext2D,
    layer: PreparedLayer,
    projectSeconds: number,
    stages: CuratedLiveDrawStages | undefined,
    markBudget: { remaining: number },
    atlasSoftMarks: boolean,
  ): void {
    if (!layer.visible || layer.opacity <= 0) return;
    const layerSeconds = Math.max(0, (projectSeconds + layer.timeOffsetMs / 1_000) * layer.timeScale);
    for (const stroke of layer.strokes) {
      const adapter = stroke.adapter;
      if (stages?.markKinds && !stages.markKinds.includes(adapter.kind)) continue;
      const brushTime = layerSeconds * speedScale(adapter.speed);
      for (const mark of stroke.marks) {
        if (adapter.kind === "curve-current" && stages?.curveRole) {
          if (stages.curveRole === "cover" && !mark.curveCover) continue;
          if (stages.curveRole === "moving" && mark.curveCover) continue;
        }
        if (markBudget.remaining <= 0) return;
        markBudget.remaining -= 1;
        const output = this.resolveMark(mark, stroke, brushTime, layerSeconds);
        if (!output) continue;
        output.alpha *= layer.opacity;
        if (output.alpha > .01) {
          this.drawOneMark(
            context,
            output,
            layer.blendMode,
            stages?.flatDots === true,
            atlasSoftMarks,
          );
        }
      }
    }
  }

  private resolveMark(
    mark: PreparedMark,
    stroke: PreparedStroke,
    brushTime: number,
    layerSeconds: number,
  ): ResolvedMark | null {
    const adapter = stroke.adapter;
    let sizeMultiplier = 1;
    let alpha = mark.alpha;
    let red = mark.red;
    let green = mark.green;
    let blue = mark.blue;
    let softIdx = mark.softIdx;
    let age = Math.max(0, layerSeconds - mark.born);
    if (mark.life > 0) age %= mark.life;

    let x = mark.x;
    let y = mark.y;
    let angle = mark.angle;
    if (adapter.kind === "lissajous-heartbeat") {
      const beat = Math.abs(Math.sin(brushTime * 2.4)) ** 8;
      sizeMultiplier = 1 + beat * .5;
    } else if (adapter.kind === "ripple") {
      const range = clamp(adapter.range, .1, 10);
      sizeMultiplier = 1 + age * adapter.ringSpeed * range / 30;
      alpha = Math.max(0, .8 - age * .09);
      red = mark.photoRed;
      green = mark.photoGreen;
      blue = mark.photoBlue;
      const flicker = clamp(adapter.colorFlicker, 0, 1);
      if (flicker > 0) {
        // Authored behavior: the ring's color drifts toward the paint under
        // its GROWING edge. One cached-buffer lookup per mark per rebuild.
        const moving = this.photo(mark.x + adapter.size * sizeMultiplier / 2, mark.y);
        if (moving) {
          red += (moving[0] - red) * flicker;
          green += (moving[1] - green) * flicker;
          blue += (moving[2] - blue) * flicker;
        }
      }
      alpha *= clamp(adapter.photoOpacity, 0, 100) / 100;
      if (adapter.photoBlur > 0) softIdx = Math.round(clamp(adapter.photoBlur / 40, 0, 1) * 3);
    } else if (adapter.kind === "growth") {
      if (mark.index !== 0) x += Math.sin(layerSeconds * adapter.speed + mark.seed * 8) * adapter.sway;
      red = mark.photoRed;
      green = mark.photoGreen;
      blue = mark.photoBlue;
      alpha *= clamp(adapter.photoOpacity, 0, 100) / 100;
      if (adapter.photoBlur > 0) softIdx = Math.max(softIdx, Math.round(clamp(adapter.photoBlur / 40, 0, 1) * 3));
    } else if (adapter.kind === "twinkle") {
      const twinkle = .25 + .75 * Math.max(0, Math.sin(layerSeconds * adapter.twinkleRate + mark.seed * Math.PI * 2));
      alpha *= twinkle;
      sizeMultiplier = .55 + .7 * twinkle;
    } else if (adapter.kind === "galaxy") {
      const radius = adapter.arm * mark.seed;
      const angle = layerSeconds * adapter.turn * (1.4 - mark.seed) + mark.seed * Math.PI * 2;
      x += Math.cos(angle) * radius;
      y += Math.sin(angle) * radius * .55;
    } else if (adapter.kind === "color-liquify-splash") {
      const duration = Math.max(.001, mark.life);
      const progress = clamp(age / duration, 0, 1);
      const soak = 1 - (1 - progress) ** 2.4;
      const direction = mark.angle;
      const reach = adapter.distance * (.42 + mark.seed * .76) * soak;
      const sideways = (mark.seed - .5) * adapter.diffusion * Math.sqrt(soak);
      x += Math.cos(direction) * reach - Math.sin(direction) * sideways;
      y += Math.sin(direction) * reach + Math.cos(direction) * sideways;
      sizeMultiplier = .34 + soak * (1.45 + mark.seed * .7);
      softIdx = Math.round(clamp(.72 + soak * .28, 0, 1) * 3);
    } else if (adapter.kind === "color-liquify-breakout") {
      const direction = mark.angle;
      const progress = clamp(age / Math.max(.001, adapter.lives), 0, 1);
      const open = 1 - (1 - progress) ** 3;
      const reach = adapter.travel * (.55 + mark.seed * .9) * open;
      const sideways = Math.sin(age * 3.2 + mark.seed * Math.PI * 2)
        * adapter.size * .65 * open;
      x += Math.cos(direction) * reach - Math.sin(direction) * sideways;
      y += Math.sin(direction) * reach + Math.cos(direction) * sideways;
      sizeMultiplier = .28 + open * 1.18;
      angle += Math.sin(age * 2 + mark.seed * Math.PI * 2) * 9 * Math.PI / 180;
    } else if (adapter.kind === "curve-current") {
      const path = stroke.curvePath;
      if (!path || mark.life <= 0) return null;
      const cover = adapter.cover;
      const lifeProgress = clamp(age / mark.life, 0, 1);
      const movementDuration = cover
        ? mark.life / (1 + cover.restore + cover.finalPause)
        : mark.life;
      const globalProgress = age / Math.max(.001, movementDuration);
      const runtimeFade = lifeProgress <= .7
        ? 1
        : Math.max(.001, (1 - lifeProgress) / .3);

      if (cover && mark.curveCover) {
        const moveStart = cover.lead + mark.curveOrder * adapter.startStagger;
        const coverStart = moveStart - cover.lead;
        const moveEnd = moveStart + adapter.activeWindow;
        const restoreEnd = moveEnd + cover.restore;
        let desiredAlpha = 0;
        if (globalProgress >= coverStart && globalProgress < moveStart) {
          desiredAlpha = cover.opacity * smoothstep01(
            (globalProgress - coverStart) / Math.max(.001, cover.lead),
          );
        } else if (globalProgress >= moveStart && globalProgress < moveEnd) {
          desiredAlpha = cover.opacity;
        } else if (globalProgress >= moveEnd && globalProgress < restoreEnd) {
          desiredAlpha = cover.opacity * (1 - smoothstep01(
            (globalProgress - moveEnd) / Math.max(.001, cover.restore),
          ));
        }
        if (cover.startFade && cover.endFade) {
          desiredAlpha *= smoothstep01(mark.curveOrder / Math.max(.001, cover.startFade))
            * smoothstep01((1 - mark.curveOrder) / Math.max(.001, cover.endFade));
        }
        alpha = Math.min(1, desiredAlpha / runtimeFade);
        red = cover.red;
        green = cover.green;
        blue = cover.blue;
        x = mark.x;
        y = mark.y;
        angle = 0;
      } else {
        const startTime = (cover?.lead ?? 0) + mark.curveOrder * adapter.startStagger;
        const endTime = startTime + adapter.activeWindow;
        if (globalProgress < startTime || globalProgress >= endTime) return null;
        const localProgress = clamp(
          (globalProgress - startTime) / Math.max(.001, adapter.activeWindow),
          0,
          1,
        );
        if (localProgress < adapter.arriveAt) {
          const progress = localProgress / Math.max(.001, adapter.arriveAt);
          const eased = progress * progress * (3 - 2 * progress);
          const targetDistance = mark.curveStartDistance
            + (path.total - mark.curveStartDistance) * eased;
          let upperIndex = 1;
          if (targetDistance >= path.total) {
            upperIndex = path.points.length - 1;
          } else if (targetDistance > 0) {
            let low = 1;
            let high = path.points.length - 1;
            while (low < high) {
              const middle = Math.floor((low + high) / 2);
              if (path.points[middle]!.distance < targetDistance) low = middle + 1;
              else high = middle;
            }
            upperIndex = low;
          }
          const before = path.points[upperIndex - 1]!;
          const after = path.points[upperIndex]!;
          const segmentLength = Math.max(.0001, after.distance - before.distance);
          const amount = clamp((targetDistance - before.distance) / segmentLength, 0, 1);
          const tangentX = (after.x - before.x) / segmentLength;
          const tangentY = (after.y - before.y) / segmentLength;
          const side = mark.curveSideDistance * (1 - eased) ** .8;
          const wobble = Math.sin(progress * Math.PI * 3.6 + mark.seed * Math.PI * 2)
            * adapter.wobble
            * Math.sin(progress * Math.PI);
          const sideways = side + wobble;
          x = before.x + (after.x - before.x) * amount - tangentY * sideways;
          y = before.y + (after.y - before.y) * amount + tangentX * sideways;
          angle = Math.atan2(tangentY, tangentX);
          const fadeIn = clamp(progress / .12, 0, 1);
          const smoothFadeIn = fadeIn * fadeIn * (3 - 2 * fadeIn);
          sizeMultiplier = .72 + Math.sin(progress * Math.PI) * .62;
          const desiredAlpha = .86 * smoothFadeIn;
          alpha = Math.min(1, desiredAlpha / runtimeFade)
            * clamp(adapter.photoOpacity, 0, 100) / 100;
        } else {
          const progress = (localProgress - adapter.arriveAt) / Math.max(.001, 1 - adapter.arriveAt);
          const inward = progress * progress * (3 - 2 * progress);
          x = path.endpointX;
          y = path.endpointY;
          angle = path.endpointAngle;
          sizeMultiplier = .72 * (1 - inward) ** .62 + .01;
          const desiredAlpha = .86 * (1 - inward) ** .58;
          alpha = Math.min(1, desiredAlpha / runtimeFade)
            * clamp(adapter.photoOpacity, 0, 100) / 100;
        }
        softIdx = Math.max(
          softIdx,
          Math.round(Math.max(.45, clamp(adapter.photoBlur, 0, 40) / 40) * 3),
        );
      }
    } else {
      const wanderAge = Math.min(age, 4);
      const angle = Math.sin(layerSeconds * .57 + mark.seed * 11) * Math.PI * 1.7
        + Math.sin(layerSeconds * .23 + mark.seed * 19) * Math.PI;
      x += Math.cos(angle) * adapter.wander * wanderAge;
      y += Math.sin(angle) * adapter.wander * wanderAge;
      alpha *= .35 + Math.abs(Math.sin(layerSeconds * adapter.speed + mark.seed * 10)) * .6;
    }

    if (mark.life > 0) {
      const remain = (mark.life - age) / mark.life;
      if (remain < .3) alpha *= Math.max(0, remain / .3);
    }
    if (alpha <= .01) return null;
    const resolved = this.resolvedMark;
    resolved.x = x;
    resolved.y = y;
    resolved.size = Math.min(MAX_RENDERED_MARK_SIZE, mark.size * clamp(sizeMultiplier, .05, 20));
    resolved.alpha = alpha;
    resolved.red = red;
    resolved.green = green;
    resolved.blue = blue;
    resolved.shape = mark.shape;
    resolved.softIdx = softIdx;
    resolved.angle = angle;
    resolved.glow = mark.glow;
    resolved.atlasIndex = mark.atlasIndex;
    resolved.atlasVariantCount = mark.atlasVariantCount;
    resolved.atlasBaseSize = mark.size;
    return resolved;
  }

  private photo(x: number, y: number): readonly [number, number, number] | null {
    if (!this.sourcePixels) return null;
    const pixelX = Math.round(clamp(x, 0, ROOM_WIDTH - 1));
    const pixelY = Math.round(clamp(y, 0, ROOM_HEIGHT - 1));
    const offset = (pixelY * ROOM_WIDTH + pixelX) * 4;
    return [
      this.sourcePixels[offset] ?? 0,
      this.sourcePixels[offset + 1] ?? 0,
      this.sourcePixels[offset + 2] ?? 0,
    ];
  }

  /** Draw one mark straight onto the target — no cached stamp texture. Dots and
   * streaks get their soft edge from a radial gradient (the cheap stand-in for
   * the old per-color blurred stamp); hard shapes fill directly. Geometry
   * mirrors the old 64px stamp (inset = 7 + soft*7 over a 32px half) so authored
   * sizes are unchanged. .9 keeps the stamp's baked coverage alpha. */
  private drawOneMark(
    context: CanvasRenderingContext2D,
    mark: ResolvedMark,
    layerBlend: GlobalCompositeOperation,
    flatDots: boolean,
    atlasSoftMarks: boolean,
  ): void {
    if (mark.size <= .3) return;
    const size = mark.size;
    const softIdx = Math.round(clamp(mark.softIdx, 0, 3));
    const soft = softIdx / 3;
    const cr = Math.max(.5, size / 2 * (1 - (7 + soft * 7) / 32));
    const color = `${Math.round(clamp(mark.red, 0, 255))}, ${Math.round(clamp(mark.green, 0, 255))}, ${Math.round(clamp(mark.blue, 0, 255))}`;
    context.globalAlpha = mark.alpha * .92;
    context.globalCompositeOperation = mark.glow ? "lighter" : layerBlend;
    context.save();
    context.translate(mark.x, mark.y);
    if (mark.angle) context.rotate(mark.angle);
    context.beginPath();
    if ((mark.shape === "dot" || mark.shape === "streak")
      && atlasSoftMarks
      && mark.atlasIndex >= 0
      && mark.atlasBaseSize > 0
      && this.markAtlasCanvas
      && this.markAtlasTileSize > 0
      && this.markAtlasColumns > 0) {
      const atlasIndex = mark.atlasIndex
        + (mark.atlasVariantCount > 1 ? Math.round(clamp(mark.softIdx, 0, 3)) : 0);
      const sourceX = (atlasIndex % this.markAtlasColumns) * this.markAtlasTileSize;
      const sourceY = Math.floor(atlasIndex / this.markAtlasColumns) * this.markAtlasTileSize;
      const scale = size / mark.atlasBaseSize;
      const destinationSize = this.markAtlasTileSize * scale;
      context.drawImage(
        this.markAtlasCanvas,
        sourceX,
        sourceY,
        this.markAtlasTileSize,
        this.markAtlasTileSize,
        -destinationSize / 2,
        -destinationSize / 2,
        destinationSize,
        destinationSize,
      );
    } else if (mark.shape === "square") {
      context.fillStyle = `rgba(${color}, .9)`;
      context.fillRect(-cr, -cr, cr * 2, cr * 2);
    } else if (mark.shape === "ring") {
      context.strokeStyle = `rgba(${color}, .9)`;
      context.lineWidth = Math.max(1, size * (7 / 64));
      context.arc(0, 0, Math.max(1, cr - size * (4 / 64)), 0, Math.PI * 2);
      context.stroke();
    } else if (mark.shape === "star") {
      context.fillStyle = `rgba(${color}, .9)`;
      for (let point = 0; point < 10; point += 1) {
        const angle = -Math.PI / 2 + point / 10 * Math.PI * 2;
        const pointRadius = point % 2 === 0 ? cr : cr * .45;
        const px = Math.cos(angle) * pointRadius;
        const py = Math.sin(angle) * pointRadius;
        if (point === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
    } else if (mark.shape === "dot" && flatDots) {
      context.fillStyle = `rgba(${color}, .9)`;
      context.arc(0, 0, cr, 0, Math.PI * 2);
      context.fill();
    } else {
      const outer = cr * (1 + soft * .5);
      const inner = cr * (1 - soft * .6);
      const gradient = context.createRadialGradient(0, 0, Math.min(inner, outer - .5), 0, 0, Math.max(outer, .6));
      gradient.addColorStop(0, `rgba(${color}, .9)`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);
      context.fillStyle = gradient;
      if (mark.shape === "streak") context.ellipse(0, 0, outer, outer * .32, 0, 0, Math.PI * 2);
      else context.arc(0, 0, outer, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    context.globalAlpha = 1;
  }
}
