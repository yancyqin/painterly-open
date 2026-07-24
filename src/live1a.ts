import {
  activeProps,
  actorCanStandAt,
  AVATAR_URLS,
  PROP_SPECS,
  propUrl,
} from "./game/gameData";
import { moveSpeedFor } from "./game/interaction.js";
import {
  CuratedLiveRoomRenderer,
  type CuratedLiveDrawStages,
  type CuratedLiveProject,
} from "./game/curatedLivePainting";
import type { PropInstance } from "./game/types";

const ROOM_WIDTH = 960;
const ROOM_HEIGHT = 640;
const TARGET_FPS = 30;
const TARGET_FRAME_MS = 1000 / TARGET_FPS;
const MOVEMENT_FPS = 60;
const MOVEMENT_FRAME_MS = 1000 / 62;
const JOY = { x: 88, y: 480, base: 68, knob: 30 };
const WARP_GRID_WIDTH = 96;
const WARP_GRID_HEIGHT = 64;
const MAX_RENDERED_MARK_SIZE = 240;

const BACKGROUND_URL = new URL(
  "./game/assets/rooms/van-gogh-sunflower-parlor-shell-v6c.jpg",
  import.meta.url,
).href;
const PROJECT_URL = new URL(
  "./game/assets/live-projects/van-gogh-sunflower-parlor-1a.json",
  import.meta.url,
).href;
const DEMO_ART_HOUSE = "van-gogh-house";
const DEMO_SURFACE = 2;
const DEMO_ART_SEED = 0;

type AdditiveMode =
  | "live"
  | "furniture"
  | "chameleon"
  | "production"
  | "game-frozen"
  | "game-15"
  | "game-30"
  | "game-base-30"
  | "game-rings-30"
  | "game-flat-dots-30"
  | "game-soft-75-30"
  | "game-soft-204-30"
  | "game-soft-618-30"
  | "game-atlas-618-30"
  | "game-atlas-full-30"
  | "game-marks-30"
  | "game-coarse-warps-30";

interface DemoProp {
  instance: PropInstance;
  image: HTMLImageElement;
}

type MarkShape = "dot" | "square" | "ring" | "star" | "streak";

interface LiveMark {
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

interface LiveStroke {
  brushRevision: string;
  marks: LiveMark[];
}

interface LiveLayer {
  visible: boolean;
  opacity: number;
  blendMode: GlobalCompositeOperation;
  timeScale: number;
  timeOffsetMs: number;
  strokes: LiveStroke[];
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

type MarkAdapter = LissajousAdapter | RippleAdapter | GrowthAdapter | FireflyAdapter;
type LiveAdapter = MarkAdapter | LiquidWarpAdapter;

interface WarpField {
  brushRevision: string;
  maskRle: string;
}

interface LiveProject {
  format: "painterly-curated-live-project";
  version: 1;
  id: string;
  canvas: { width: number; height: number };
  clock: { timeAnchor: number };
  adapters: Record<string, LiveAdapter>;
  layers: LiveLayer[];
  warps: WarpField[];
  stats: { marks: number; strokes: number; warpFields: number };
}

interface PreparedMark extends LiveMark {
  photoRed: number;
  photoGreen: number;
  photoBlue: number;
}

interface PreparedStroke {
  adapter: MarkAdapter;
  marks: PreparedMark[];
}

interface PreparedLayer {
  visible: boolean;
  opacity: number;
  blendMode: GlobalCompositeOperation;
  timeScale: number;
  timeOffsetMs: number;
  strokes: PreparedStroke[];
}

interface WarpSlice {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  logicalY: number;
}

interface PreparedWarp {
  adapter: LiquidWarpAdapter;
  slices: WarpSlice[];
}

interface DemoMetrics {
  renderer: "single-canvas-2d";
  canvasCount: number;
  renderGraphCanvasCount: number;
  mode: AdditiveMode;
  furnitureCount: number;
  marks: number;
  warpFields: number;
  targetFps: number;
  fps: number;
  averageRenderMs: number;
  p95RenderMs: number;
  roomRebuildFps: number;
  averageRoomRebuildMs: number;
  p95RoomRebuildMs: number;
  slowFrames: number;
  renderedFrames: number;
}

declare global {
  interface Window {
    __singleCanvas1a?: DemoMetrics;
  }
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type GameMode = Extract<AdditiveMode, `game-${string}`>;

function isGameMode(mode: AdditiveMode): mode is GameMode {
  return mode.startsWith("game-");
}

function gameRoomHz(mode: AdditiveMode): 0 | 15 | 30 {
  if (mode === "game-15") return 15;
  if (mode === "game-30"
    || mode === "game-base-30"
    || mode === "game-rings-30"
    || mode === "game-flat-dots-30"
    || mode === "game-soft-75-30"
    || mode === "game-soft-204-30"
    || mode === "game-soft-618-30"
    || mode === "game-atlas-618-30"
    || mode === "game-atlas-full-30"
    || mode === "game-marks-30"
    || mode === "game-coarse-warps-30") return 30;
  return 0;
}

function gameRoomStages(mode: AdditiveMode): CuratedLiveDrawStages | undefined {
  if (mode === "game-base-30") return { warpFieldLimit: 0, marks: false };
  if (mode === "game-frozen" || mode === "game-15" || mode === "game-30") {
    return { atlasSoftMarks: false };
  }
  if (mode === "game-rings-30") {
    return {
      warpFieldLimit: 0,
      marks: true,
      markKinds: ["ripple"],
      markLimit: 8,
      atlasSoftMarks: false,
    };
  }
  if (mode === "game-flat-dots-30") {
    return {
      warpFieldLimit: 0,
      marks: true,
      markKinds: ["lissajous-heartbeat"],
      markLimit: 618,
      flatDots: true,
      atlasSoftMarks: false,
    };
  }
  if (mode === "game-soft-75-30") {
    return {
      warpFieldLimit: 0,
      marks: true,
      markKinds: ["lissajous-heartbeat"],
      markLimit: 75,
      atlasSoftMarks: false,
    };
  }
  if (mode === "game-soft-204-30") {
    return {
      warpFieldLimit: 0,
      marks: true,
      markKinds: ["lissajous-heartbeat"],
      markLimit: 204,
      atlasSoftMarks: false,
    };
  }
  if (mode === "game-soft-618-30") {
    return {
      warpFieldLimit: 0,
      marks: true,
      markKinds: ["lissajous-heartbeat"],
      markLimit: 618,
      atlasSoftMarks: false,
    };
  }
  if (mode === "game-atlas-618-30") {
    return {
      warpFieldLimit: 0,
      marks: true,
      markKinds: ["lissajous-heartbeat"],
      markLimit: 618,
      atlasSoftMarks: true,
    };
  }
  if (mode === "game-atlas-full-30") return { atlasSoftMarks: true };
  if (mode === "game-marks-30") {
    return { warpFieldLimit: 0, marks: true, atlasSoftMarks: false };
  }
  if (mode === "game-coarse-warps-30") {
    return { warpFieldLimit: 4, marks: true, atlasSoftMarks: false };
  }
  return undefined;
}

function activeStageCounts(mode: AdditiveMode, project: LiveProject): { marks: number; warpFields: number } {
  if (mode === "game-base-30") return { marks: 0, warpFields: 0 };
  if (mode === "game-rings-30") return { marks: 8, warpFields: 0 };
  if (mode === "game-flat-dots-30"
    || mode === "game-soft-618-30"
    || mode === "game-atlas-618-30") {
    return { marks: 618, warpFields: 0 };
  }
  if (mode === "game-soft-75-30") return { marks: 75, warpFields: 0 };
  if (mode === "game-soft-204-30") return { marks: 204, warpFields: 0 };
  if (mode === "game-marks-30") return { marks: project.stats.marks, warpFields: 0 };
  if (mode === "game-coarse-warps-30") {
    return { marks: project.stats.marks, warpFields: Math.min(4, project.stats.warpFields) };
  }
  if (mode === "game-atlas-full-30") {
    return { marks: project.stats.marks, warpFields: project.stats.warpFields };
  }
  return { marks: project.stats.marks, warpFields: project.stats.warpFields };
}

function speedScale(speed: number): number {
  return .15 + clamp(speed, 0, 100) / 100 * 1.85;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
}

async function loadProject(url: string): Promise<LiveProject> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load the 1A project (HTTP ${response.status})`);
  const project = await response.json() as Partial<LiveProject>;
  if (project.format !== "painterly-curated-live-project"
    || project.version !== 1
    || project.id !== "van-gogh-sunflower-parlor-1a"
    || project.canvas?.width !== ROOM_WIDTH
    || project.canvas?.height !== ROOM_HEIGHT
    || !project.adapters
    || !Array.isArray(project.layers)
    || !Array.isArray(project.warps)
    || !project.stats) {
    throw new Error("The 1A live project does not match the runtime contract.");
  }
  return project as LiveProject;
}

function decodeMaskRle(data: string): Uint8Array {
  const raw = atob(data);
  if (raw.length % 2 !== 0) throw new Error("Invalid 1A warp mask");
  const mask = new Uint8Array(WARP_GRID_WIDTH * WARP_GRID_HEIGHT);
  let cursor = 0;
  for (let index = 0; index < raw.length; index += 2) {
    const value = raw.charCodeAt(index);
    const count = raw.charCodeAt(index + 1);
    if (value > 1 || count < 1 || cursor + count > mask.length) {
      throw new Error("Invalid 1A warp run");
    }
    mask.fill(value, cursor, cursor + count);
    cursor += count;
  }
  if (cursor !== mask.length) throw new Error("Incomplete 1A warp mask");
  return mask;
}

function percentile95(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] ?? 0;
}

class SingleCanvasLiveRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly sourcePixels: Uint8ClampedArray;
  private readonly preparedWarps: PreparedWarp[];
  private readonly preparedLayers: PreparedLayer[];
  private readonly renderDurations: number[] = [];
  private readonly renderTimes: number[] = [];
  private readonly roomRebuildDurations: number[] = [];
  private readonly roomRebuildTimes: number[] = [];
  private slowFrames = 0;
  private renderedFrames = 0;
  private statsVisible = true;
  private mode: AdditiveMode = "live";
  private actor = { x: 541.3, y: 445.3 };
  private actorFacing: -1 | 1 = -1;
  private pointerId = -1;
  private joy = { active: false, pointerId: -1, dx: 0, dy: 0 };
  private readonly keys = new Set<string>();
  private lastMovementFrameAt = 0;
  private roomFrameCanvas: HTMLCanvasElement | null = null;
  private roomFrameRenderedAt = Number.NEGATIVE_INFINITY;
  private roomFrameReady = false;
  private gameFrameRequested = true;
  private readonly moveSpeed = moveSpeedFor({
    coarsePointer: window.matchMedia("(any-pointer: coarse)").matches || navigator.maxTouchPoints > 0,
  });
  private productionRenderer: CuratedLiveRoomRenderer | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly sourceImage: HTMLImageElement,
    private readonly project: LiveProject,
    private readonly props: readonly DemoProp[],
    private readonly avatar: HTMLImageElement,
  ) {
    // Deliberately use the one visible canvas for the one-time source read.
    // No HTMLCanvasElement or OffscreenCanvas is allocated anywhere else.
    this.context = canvas.getContext("2d", { alpha: false })!;
    this.context.drawImage(sourceImage, 0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    this.sourcePixels = this.context.getImageData(0, 0, ROOM_WIDTH, ROOM_HEIGHT).data;
    this.preparedWarps = project.warps.map(field => this.prepareWarp(field));
    this.preparedLayers = project.layers.map(layer => this.prepareLayer(layer));
    this.publishMetrics();
    canvas.tabIndex = 0;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("keydown", this.onKeyDown);
    canvas.addEventListener("keyup", this.onKeyUp);
  }

  setMode(mode: AdditiveMode): void {
    const needsProduction = mode === "production" || isGameMode(mode);
    if (!needsProduction && this.productionRenderer) {
      this.productionRenderer.dispose();
      this.productionRenderer = null;
    }
    if (!isGameMode(mode)) this.disposeRoomFrame();
    this.mode = mode;
    this.joy = { active: false, pointerId: -1, dx: 0, dy: 0 };
    this.keys.clear();
    this.lastMovementFrameAt = 0;
    this.roomFrameRenderedAt = Number.NEGATIVE_INFINITY;
    this.roomFrameReady = false;
    this.gameFrameRequested = true;
    this.resetMetrics();
    this.publishMetrics();
  }

  toggleStats(): void {
    this.statsVisible = !this.statsVisible;
    this.gameFrameRequested = true;
  }

  frame(sceneSeconds: number, now: number): void {
    if (!isGameMode(this.mode)) {
      const previous = this.renderTimes.at(-1) ?? Number.NEGATIVE_INFINITY;
      if (now - previous >= TARGET_FRAME_MS - .5 || now < previous) this.draw(sceneSeconds);
      return;
    }

    if (now - this.lastMovementFrameAt < MOVEMENT_FRAME_MS) return;
    const frameStartedAt = performance.now();
    const deltaMs = Math.min(40, Math.max(0, now - this.lastMovementFrameAt));
    this.lastMovementFrameAt = now;
    const moved = this.stepGameMovement(deltaMs);
    const roomDue = this.gameRoomFrameDue(now);
    if (roomDue) this.rebuildGameRoom(sceneSeconds, now);
    if (moved || roomDue || this.gameFrameRequested) {
      this.drawGameFrame(frameStartedAt);
      this.gameFrameRequested = false;
    }
  }

  draw(sceneSeconds: number): void {
    const startedAt = performance.now();
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.imageSmoothingEnabled = true;
    if (this.mode === "production") {
      context.drawImage(this.sourceImage, 0, 0, ROOM_WIDTH, ROOM_HEIGHT);
      this.getProductionRenderer().draw(
        context,
        this.sourceImage,
        this.project as unknown as CuratedLiveProject,
        Math.max(0, sceneSeconds - this.project.clock.timeAnchor),
      );
    } else {
      context.drawImage(this.sourceImage, 0, 0, ROOM_WIDTH, ROOM_HEIGHT);
      this.drawWarps(sceneSeconds);
      for (const layer of this.preparedLayers) this.drawLayer(layer, sceneSeconds);
    }
    if (this.mode !== "live") this.drawFurnitureAndActor();
    if (this.statsVisible) this.drawStats();

    this.recordVisibleFrame(performance.now() - startedAt, TARGET_FPS);
  }

  private resetMetrics(): void {
    this.renderDurations.length = 0;
    this.renderTimes.length = 0;
    this.roomRebuildDurations.length = 0;
    this.roomRebuildTimes.length = 0;
    this.slowFrames = 0;
    this.renderedFrames = 0;
  }

  private recordVisibleFrame(duration: number, targetFps: number): void {
    const finishedAt = performance.now();
    this.renderDurations.push(duration);
    if (this.renderDurations.length > 120) this.renderDurations.shift();
    this.renderTimes.push(finishedAt);
    while ((this.renderTimes[0] ?? finishedAt) < finishedAt - 1_000) this.renderTimes.shift();
    if (duration > 1_000 / targetFps) this.slowFrames += 1;
    this.renderedFrames += 1;
    this.publishMetrics();
  }

  private ensureRoomFrame(): HTMLCanvasElement {
    if (this.roomFrameCanvas) return this.roomFrameCanvas;
    const frame = document.createElement("canvas");
    frame.width = ROOM_WIDTH;
    frame.height = ROOM_HEIGHT;
    this.roomFrameCanvas = frame;
    return frame;
  }

  private disposeRoomFrame(): void {
    const frame = this.roomFrameCanvas;
    if (!frame) return;
    this.roomFrameCanvas = null;
    frame.width = 0;
    frame.height = 0;
  }

  private gameRoomFrameDue(now: number): boolean {
    if (!this.roomFrameReady) return true;
    const roomHz = gameRoomHz(this.mode);
    return roomHz > 0 && now - this.roomFrameRenderedAt >= 1_000 / roomHz;
  }

  private rebuildGameRoom(sceneSeconds: number, now: number): void {
    const startedAt = performance.now();
    const frame = this.ensureRoomFrame();
    const context = frame.getContext("2d", { alpha: false })!;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.drawImage(this.sourceImage, 0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    this.getProductionRenderer().draw(
      context,
      this.sourceImage,
      this.project as unknown as CuratedLiveProject,
      Math.max(0, sceneSeconds - this.project.clock.timeAnchor),
      gameRoomStages(this.mode),
    );
    this.roomFrameRenderedAt = now;
    this.roomFrameReady = true;
    const finishedAt = performance.now();
    this.roomRebuildDurations.push(finishedAt - startedAt);
    if (this.roomRebuildDurations.length > 120) this.roomRebuildDurations.shift();
    this.roomRebuildTimes.push(finishedAt);
    while ((this.roomRebuildTimes[0] ?? finishedAt) < finishedAt - 1_000) {
      this.roomRebuildTimes.shift();
    }
  }

  private drawGameFrame(startedAt: number): void {
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.imageSmoothingEnabled = true;
    const frame = this.ensureRoomFrame();
    context.drawImage(frame, 0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    this.drawFurnitureAndActor();
    this.drawGameJoystick();
    if (this.statsVisible) this.drawStats();
    this.recordVisibleFrame(performance.now() - startedAt, MOVEMENT_FPS);
  }

  private stepGameMovement(deltaMs: number): boolean {
    let dx = this.joy.active ? this.joy.dx : 0;
    let dy = this.joy.active ? this.joy.dy : 0;
    if (this.keys.has("ArrowLeft")) dx -= 1;
    if (this.keys.has("ArrowRight")) dx += 1;
    if (this.keys.has("ArrowUp")) dy -= 1;
    if (this.keys.has("ArrowDown")) dy += 1;
    if (Math.abs(dx) <= .08 && Math.abs(dy) <= .08) return false;
    const length = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / length;
    const uy = dy / length;
    if (Math.abs(ux) > .05) this.actorFacing = ux > 0 ? 1 : -1;
    const distance = this.moveSpeed * Math.min(40, deltaMs) / 1_000;
    const steps = Math.max(1, Math.ceil(distance / 4));
    const beforeX = this.actor.x;
    const beforeY = this.actor.y;
    for (let index = 0; index < steps; index += 1) {
      const nextX = this.actor.x + ux * distance / steps;
      if (actorCanStandAt(DEMO_ART_HOUSE, DEMO_SURFACE, 0, nextX, this.actor.y)) {
        this.actor.x = nextX;
      }
      const nextY = this.actor.y + uy * distance / steps;
      if (actorCanStandAt(DEMO_ART_HOUSE, DEMO_SURFACE, 0, this.actor.x, nextY)) {
        this.actor.y = nextY;
      }
    }
    this.actor.x = Math.round(this.actor.x * 10) / 10;
    this.actor.y = Math.round(this.actor.y * 10) / 10;
    return this.actor.x !== beforeX || this.actor.y !== beforeY;
  }

  private drawGameJoystick(): void {
    const context = this.context;
    context.save();
    context.beginPath();
    context.arc(JOY.x, JOY.y, JOY.base, 0, Math.PI * 2);
    context.fillStyle = "rgba(14, 18, 32, .54)";
    context.fill();
    context.lineWidth = 1.5;
    context.strokeStyle = "rgba(238, 211, 142, .45)";
    context.stroke();
    const knobX = JOY.x + this.joy.dx * (JOY.base - 8);
    const knobY = JOY.y + this.joy.dy * (JOY.base - 8);
    const knob = context.createRadialGradient(knobX - 6, knobY - 6, 4, knobX, knobY, JOY.knob);
    knob.addColorStop(0, "#efd68d");
    knob.addColorStop(1, "#a5772f");
    context.beginPath();
    context.arc(knobX, knobY, JOY.knob, 0, Math.PI * 2);
    context.fillStyle = knob;
    context.fill();
    context.restore();
  }

  private getProductionRenderer(): CuratedLiveRoomRenderer {
    return this.productionRenderer ??= new CuratedLiveRoomRenderer();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (isGameMode(this.mode)) {
      const point = this.clientPoint(event);
      if (!point || Math.hypot(point.x - JOY.x, point.y - JOY.y) > JOY.base * 1.3) return;
      this.joy.active = true;
      this.joy.pointerId = event.pointerId;
      try { this.canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
      this.updateGameJoy(point.x, point.y);
      this.canvas.focus({ preventScroll: true });
      event.preventDefault();
      return;
    }
    if (this.mode !== "chameleon" && this.mode !== "production") return;
    this.pointerId = event.pointerId;
    try { this.canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    this.moveActorToPointer(event);
    this.canvas.focus({ preventScroll: true });
    event.preventDefault();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (isGameMode(this.mode)) {
      if (!this.joy.active || event.pointerId !== this.joy.pointerId) return;
      const point = this.clientPoint(event);
      if (point) this.updateGameJoy(point.x, point.y);
      event.preventDefault();
      return;
    }
    if (event.pointerId !== this.pointerId
      || (this.mode !== "chameleon" && this.mode !== "production")) return;
    this.moveActorToPointer(event);
    event.preventDefault();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (isGameMode(this.mode) && event.pointerId === this.joy.pointerId) {
      this.joy = { active: false, pointerId: -1, dx: 0, dy: 0 };
      this.gameFrameRequested = true;
      event.preventDefault();
      return;
    }
    if (event.pointerId !== this.pointerId) return;
    this.moveActorToPointer(event);
    this.pointerId = -1;
    event.preventDefault();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isGameMode(this.mode) && event.key.startsWith("Arrow")) {
      this.keys.add(event.key);
      event.preventDefault();
      return;
    }
    if (this.mode !== "chameleon" && this.mode !== "production") return;
    const step = event.shiftKey ? 18 : 8;
    let dx = 0;
    let dy = 0;
    if (event.key === "ArrowLeft") dx = -step;
    else if (event.key === "ArrowRight") dx = step;
    else if (event.key === "ArrowUp") dy = -step;
    else if (event.key === "ArrowDown") dy = step;
    else return;
    this.moveActor(this.actor.x + dx, this.actor.y + dy);
    event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (!this.keys.delete(event.key)) return;
    this.gameFrameRequested = true;
    event.preventDefault();
  };

  private clientPoint(event: PointerEvent): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: (event.clientX - rect.left) * ROOM_WIDTH / rect.width,
      y: (event.clientY - rect.top) * ROOM_HEIGHT / rect.height,
    };
  }

  private updateGameJoy(x: number, y: number): void {
    let dx = x - JOY.x;
    let dy = y - JOY.y;
    const max = JOY.base - 8;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length > max) {
      dx *= max / length;
      dy *= max / length;
    }
    this.joy.dx = dx / max;
    this.joy.dy = dy / max;
    this.gameFrameRequested = true;
  }

  private moveActorToPointer(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.moveActor(
      (event.clientX - rect.left) * ROOM_WIDTH / rect.width,
      (event.clientY - rect.top) * ROOM_HEIGHT / rect.height + 38,
    );
  }

  private moveActor(x: number, y: number): void {
    const nextX = clamp(x, 50, ROOM_WIDTH - 50);
    if (Math.abs(nextX - this.actor.x) > .5) this.actorFacing = nextX > this.actor.x ? 1 : -1;
    this.actor.x = nextX;
    this.actor.y = clamp(y, 105, ROOM_HEIGHT - 18);
  }

  private drawFurnitureAndActor(): void {
    const layers: Array<{ depth: number; draw: () => void }> = this.props.map(({ instance, image }) => {
      const spec = PROP_SPECS[instance.modelId];
      const bias = instance.depthBias ?? 0;
      return {
        depth: spec?.surface ? -850 : instance.y + .5 + bias,
        draw: () => this.drawProp(instance, image),
      };
    });
    if (this.mode === "chameleon" || this.mode === "production" || isGameMode(this.mode)) {
      layers.push({
        depth: this.actor.y,
        draw: () => this.drawAvatar(),
      });
    }
    layers.sort((left, right) => left.depth - right.depth);
    for (const layer of layers) layer.draw();
  }

  private drawProp(instance: PropInstance, image: HTMLImageElement): void {
    const spec = PROP_SPECS[instance.modelId];
    if (!spec) return;
    const context = this.context;
    const bias = instance.depthBias ?? 0;
    if (!spec.surface && spec.shadowWidth > 0) {
      this.drawFeatheredShadow(
        instance.x + 10,
        instance.y + 4 + bias,
        spec.shadowWidth / 2,
        spec.shadowDepth / 2,
        -.18,
        "23, 25, 36",
      );
    }
    context.save();
    if (instance.rotation === 180) {
      context.translate(instance.x, 0);
      context.scale(-1, 1);
      context.translate(-instance.x, 0);
    }
    const y = spec.surface ? instance.y - spec.height / 2 : instance.y - spec.height;
    context.drawImage(image, instance.x - spec.width / 2, y, spec.width, spec.height);
    context.restore();
  }

  private drawAvatar(): void {
    const context = this.context;
    this.drawFeatheredShadow(this.actor.x + 5, this.actor.y + 6, 25, 8, 0, "18, 21, 31");
    context.save();
    if (this.actorFacing > 0) {
      context.translate(this.actor.x, 0);
      context.scale(-1, 1);
      context.translate(-this.actor.x, 0);
    }
    context.drawImage(this.avatar, this.actor.x - 50, this.actor.y - 82, 100, 100);
    context.restore();
  }

  private drawFeatheredShadow(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    rgb: string,
  ): void {
    const context = this.context;
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.scale(rx, ry);
    const feather = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    feather.addColorStop(0, `rgba(${rgb}, .05)`);
    feather.addColorStop(.5, `rgba(${rgb}, .035)`);
    feather.addColorStop(.78, `rgba(${rgb}, .014)`);
    feather.addColorStop(1, `rgba(${rgb}, 0)`);
    context.fillStyle = feather;
    context.beginPath();
    context.arc(0, 0, 1, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  private prepareWarp(field: WarpField): PreparedWarp {
    const adapter = this.project.adapters[field.brushRevision];
    if (!adapter || adapter.kind !== "liquid-warp") {
      throw new Error(`Missing 1A warp adapter ${field.brushRevision}`);
    }
    const mask = decodeMaskRle(field.maskRle);
    // The tight 2px wave keeps 2px sampling. Broader 33px waves use aligned
    // 5px strips: same painted mask and motion, one quarter of the draw calls.
    const sliceHeight = adapter.wavelength <= 4 ? 2 : 5;
    const slices: WarpSlice[] = [];
    for (let y = 0; y < ROOM_HEIGHT; y += sliceHeight) {
      const sourceHeight = Math.min(sliceHeight, ROOM_HEIGHT - y);
      const gridY = Math.min(WARP_GRID_HEIGHT - 1, Math.floor(y / ROOM_HEIGHT * WARP_GRID_HEIGHT));
      let gridX = 0;
      while (gridX < WARP_GRID_WIDTH) {
        if (!mask[gridY * WARP_GRID_WIDTH + gridX]) {
          gridX += 1;
          continue;
        }
        let endGridX = gridX + 1;
        while (endGridX < WARP_GRID_WIDTH && mask[gridY * WARP_GRID_WIDTH + endGridX]) {
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
        });
        gridX = endGridX;
      }
    }
    return { adapter, slices };
  }

  private prepareLayer(layer: LiveLayer): PreparedLayer {
    return {
      visible: layer.visible,
      opacity: clamp(layer.opacity, 0, 1),
      blendMode: layer.blendMode,
      timeScale: layer.timeScale,
      timeOffsetMs: layer.timeOffsetMs,
      strokes: layer.strokes.map(stroke => {
        const adapter = this.project.adapters[stroke.brushRevision];
        if (!adapter || adapter.kind === "liquid-warp") {
          throw new Error(`Missing 1A mark adapter ${stroke.brushRevision}`);
        }
        return {
          adapter,
          marks: stroke.marks.map(mark => {
            const sampleX = adapter.kind === "ripple" ? mark.x + adapter.size / 2 : mark.x;
            const sampled = this.photo(sampleX, mark.y);
            return {
              ...mark,
              photoRed: sampled[0],
              photoGreen: sampled[1],
              photoBlue: sampled[2],
            };
          }),
        };
      }),
    };
  }

  private drawWarps(projectSeconds: number): void {
    const context = this.context;
    context.save();
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    for (const field of this.preparedWarps) {
      const brushTime = projectSeconds * speedScale(field.adapter.speed);
      for (const slice of field.slices) {
        const dx = Math.sin(
          brushTime * 1.2 + slice.logicalY / field.adapter.wavelength,
        ) * field.adapter.strength;
        context.drawImage(
          this.sourceImage,
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
    context.restore();
  }

  private drawLayer(layer: PreparedLayer, projectSeconds: number): void {
    if (!layer.visible || layer.opacity <= 0) return;
    const layerSeconds = Math.max(
      0,
      (projectSeconds + layer.timeOffsetMs / 1_000) * layer.timeScale,
    );
    for (const stroke of layer.strokes) {
      const brushTime = layerSeconds * speedScale(stroke.adapter.speed);
      for (const mark of stroke.marks) {
        this.resolveAndDrawMark(mark, stroke.adapter, brushTime, layerSeconds, layer);
      }
    }
  }

  private resolveAndDrawMark(
    mark: PreparedMark,
    adapter: MarkAdapter,
    brushTime: number,
    layerSeconds: number,
    layer: PreparedLayer,
  ): void {
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
        const moving = this.photo(mark.x + adapter.size * sizeMultiplier / 2, mark.y);
        red += (moving[0] - red) * flicker;
        green += (moving[1] - green) * flicker;
        blue += (moving[2] - blue) * flicker;
      }
      alpha *= clamp(adapter.photoOpacity, 0, 100) / 100;
      if (adapter.photoBlur > 0) softIdx = Math.round(clamp(adapter.photoBlur / 40, 0, 1) * 3);
    } else if (adapter.kind === "growth") {
      if (mark.index !== 0) x += Math.sin(layerSeconds * adapter.speed + mark.seed * 8) * adapter.sway;
      red = mark.photoRed;
      green = mark.photoGreen;
      blue = mark.photoBlue;
      alpha *= clamp(adapter.photoOpacity, 0, 100) / 100;
      if (adapter.photoBlur > 0) {
        softIdx = Math.max(softIdx, Math.round(clamp(adapter.photoBlur / 40, 0, 1) * 3));
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
    alpha *= layer.opacity;
    if (alpha <= .01) return;
    this.drawOneMark({
      x,
      y,
      size: Math.min(MAX_RENDERED_MARK_SIZE, mark.size * clamp(sizeMultiplier, .05, 20)),
      alpha,
      red,
      green,
      blue,
      shape: mark.shape,
      softIdx,
      angle: mark.angle,
      glow: mark.glow,
    }, layer.blendMode);
  }

  private drawOneMark(
    mark: Pick<LiveMark, "x" | "y" | "size" | "alpha" | "red" | "green" | "blue" | "shape" | "softIdx" | "angle" | "glow">,
    layerBlend: GlobalCompositeOperation,
  ): void {
    if (mark.size <= .3) return;
    const context = this.context;
    const soft = Math.round(clamp(mark.softIdx, 0, 3)) / 3;
    const coreRadius = Math.max(.5, mark.size / 2 * (1 - (7 + soft * 7) / 32));
    const red = Math.round(clamp(mark.red, 0, 255));
    const green = Math.round(clamp(mark.green, 0, 255));
    const blue = Math.round(clamp(mark.blue, 0, 255));
    const color = `${red}, ${green}, ${blue}`;
    context.globalAlpha = mark.alpha * .92;
    context.globalCompositeOperation = mark.glow ? "lighter" : layerBlend;

    if (mark.shape === "dot" || mark.shape === "ring") {
      context.beginPath();
      if (mark.shape === "ring") {
        context.strokeStyle = `rgba(${color}, .9)`;
        context.lineWidth = Math.max(1, mark.size * (7 / 64));
        context.arc(mark.x, mark.y, Math.max(1, coreRadius - mark.size * (4 / 64)), 0, Math.PI * 2);
        context.stroke();
      } else {
        const outer = coreRadius * (1 + soft * .5);
        const inner = coreRadius * (1 - soft * .6);
        const gradient = context.createRadialGradient(
          mark.x,
          mark.y,
          Math.min(inner, outer - .5),
          mark.x,
          mark.y,
          Math.max(outer, .6),
        );
        gradient.addColorStop(0, `rgba(${color}, .9)`);
        gradient.addColorStop(1, `rgba(${color}, 0)`);
        context.fillStyle = gradient;
        context.arc(mark.x, mark.y, outer, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      return;
    }

    context.save();
    context.translate(mark.x, mark.y);
    if (mark.angle) context.rotate(mark.angle);
    context.beginPath();
    if (mark.shape === "square") {
      context.fillStyle = `rgba(${color}, .9)`;
      context.fillRect(-coreRadius, -coreRadius, coreRadius * 2, coreRadius * 2);
    } else if (mark.shape === "star") {
      context.fillStyle = `rgba(${color}, .9)`;
      for (let point = 0; point < 10; point += 1) {
        const angle = -Math.PI / 2 + point / 10 * Math.PI * 2;
        const radius = point % 2 === 0 ? coreRadius : coreRadius * .45;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (point === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.fill();
    } else {
      const outer = coreRadius * (1 + soft * .5);
      const inner = coreRadius * (1 - soft * .6);
      const gradient = context.createRadialGradient(0, 0, Math.min(inner, outer - .5), 0, 0, Math.max(outer, .6));
      gradient.addColorStop(0, `rgba(${color}, .9)`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);
      context.fillStyle = gradient;
      context.ellipse(0, 0, outer, outer * .32, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    context.globalAlpha = 1;
  }

  private photo(x: number, y: number): readonly [number, number, number] {
    const pixelX = Math.round(clamp(x, 0, ROOM_WIDTH - 1));
    const pixelY = Math.round(clamp(y, 0, ROOM_HEIGHT - 1));
    const offset = (pixelY * ROOM_WIDTH + pixelX) * 4;
    return [
      this.sourcePixels[offset] ?? 0,
      this.sourcePixels[offset + 1] ?? 0,
      this.sourcePixels[offset + 2] ?? 0,
    ];
  }

  private publishMetrics(): void {
    const now = performance.now();
    while ((this.roomRebuildTimes[0] ?? now) < now - 1_000) this.roomRebuildTimes.shift();
    const average = this.renderDurations.length
      ? this.renderDurations.reduce((sum, value) => sum + value, 0) / this.renderDurations.length
      : 0;
    const roomAverage = this.roomRebuildDurations.length
      ? this.roomRebuildDurations.reduce((sum, value) => sum + value, 0) / this.roomRebuildDurations.length
      : 0;
    const gameMode = isGameMode(this.mode);
    const activeStages = activeStageCounts(this.mode, this.project);
    const metrics: DemoMetrics = {
      renderer: "single-canvas-2d",
      canvasCount: document.querySelectorAll("canvas").length,
      renderGraphCanvasCount: gameMode ? 2 : 1,
      mode: this.mode,
      furnitureCount: this.mode === "live" ? 0 : this.props.length,
      marks: activeStages.marks,
      warpFields: activeStages.warpFields,
      targetFps: gameMode ? MOVEMENT_FPS : TARGET_FPS,
      fps: this.renderTimes.length,
      averageRenderMs: average,
      p95RenderMs: percentile95(this.renderDurations),
      roomRebuildFps: this.roomRebuildTimes.length,
      averageRoomRebuildMs: roomAverage,
      p95RoomRebuildMs: percentile95(this.roomRebuildDurations),
      slowFrames: this.slowFrames,
      renderedFrames: this.renderedFrames,
    };
    window.__singleCanvas1a = metrics;
    // A serializable DOM hook keeps mobile/WebView smoke tests independent of
    // the page's JavaScript execution world.
    this.canvas.dataset.metrics = JSON.stringify(metrics);
  }

  private drawStats(): void {
    const metrics = window.__singleCanvas1a;
    if (!metrics) return;
    const context = this.context;
    context.save();
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.shadowColor = "rgba(0, 0, 0, .35)";
    context.shadowBlur = 12;
    context.fillStyle = "rgba(7, 10, 19, .82)";
    context.beginPath();
    context.moveTo(28, 18);
    context.lineTo(332, 18);
    context.quadraticCurveTo(344, 18, 344, 30);
    context.lineTo(344, 124);
    context.quadraticCurveTo(344, 136, 332, 136);
    context.lineTo(28, 136);
    context.quadraticCurveTo(16, 136, 16, 124);
    context.lineTo(16, 30);
    context.quadraticCurveTo(16, 18, 28, 18);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = "#f4d77f";
    context.font = "800 15px Inter, system-ui, sans-serif";
    context.fillText(`${metrics.renderGraphCanvasCount} BUFFER · ${this.mode.toUpperCase()}`, 32, 45);
    context.fillStyle = "#f7f0dd";
    context.font = "700 13px Inter, system-ui, sans-serif";
    context.fillText(`${metrics.marks} marks · ${metrics.warpFields} warps · ${metrics.renderGraphCanvasCount} canvas · ${metrics.fps}/${metrics.targetFps} fps`, 32, 72);
    context.fillStyle = "#aebbd0";
    context.font = "600 12px Inter, system-ui, sans-serif";
    context.fillText(`render ${metrics.averageRenderMs.toFixed(1)} ms avg · ${metrics.p95RenderMs.toFixed(1)} ms p95`, 32, 96);
    context.fillText(`room ${metrics.roomRebuildFps} fps · ${metrics.averageRoomRebuildMs.toFixed(1)} ms avg · ${metrics.p95RoomRebuildMs.toFixed(1)} ms p95`, 32, 118);
    context.restore();
  }
}

async function start(): Promise<void> {
  const canvas = requireElement<HTMLCanvasElement>("live-1a-canvas");
  const loading = requireElement<HTMLDivElement>("live-1a-loading");
  const roomProps = activeProps(DEMO_ART_HOUSE, DEMO_SURFACE)
    .filter(instance => instance.x >= 0 && instance.x < ROOM_WIDTH)
    .map(instance => {
      const url = propUrl(DEMO_ART_HOUSE, instance, DEMO_ART_SEED);
      if (!url) throw new Error(`Missing 1A prop art for ${instance.id}`);
      return { instance, url };
    });
  const [background, project, avatar, propImages] = await Promise.all([
    loadImage(BACKGROUND_URL),
    loadProject(PROJECT_URL),
    loadImage(AVATAR_URLS.stand),
    Promise.all(roomProps.map(prop => loadImage(prop.url))),
  ]);
  const props = roomProps.map((prop, index) => ({
    instance: prop.instance,
    image: propImages[index]!,
  }));
  const renderer = new SingleCanvasLiveRenderer(canvas, background, project, props, avatar);
  const modeButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-additive-mode]")];
  const diagnosticTabs = [...document.querySelectorAll<HTMLButtonElement>("[data-diagnostic-tab]")];
  const diagnosticPanels = [...document.querySelectorAll<HTMLElement>("[data-diagnostic-panel]")];
  for (const tab of diagnosticTabs) {
    tab.addEventListener("click", () => {
      const selected = tab.dataset.diagnosticTab;
      if (!selected) return;
      for (const candidate of diagnosticTabs) {
        candidate.setAttribute("aria-selected", String(candidate === tab));
      }
      for (const panel of diagnosticPanels) {
        panel.hidden = panel.dataset.diagnosticPanel !== selected;
      }
    });
  }
  for (const button of modeButtons) {
    button.addEventListener("click", () => {
      const mode = button.dataset.additiveMode as AdditiveMode | undefined;
      if (!mode) return;
      renderer.setMode(mode);
      for (const candidate of modeButtons) {
        candidate.setAttribute("aria-pressed", String(candidate === button));
      }
    });
  }
  requireElement<HTMLButtonElement>("live-1a-stats").addEventListener("click", () => renderer.toggleStats());
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const startedAt = performance.now();

  function frame(now: number): void {
    renderer.frame(project.clock.timeAnchor + Math.max(0, now - startedAt) / 1_000, now);
    if (!reducedMotion) requestAnimationFrame(frame);
  }

  frame(startedAt);
  loading.classList.add("is-ready");
}

void start().catch((error) => {
  const loading = requireElement<HTMLDivElement>("live-1a-loading");
  loading.textContent = error instanceof Error ? error.message : "Could not paint this room.";
});

export {};
