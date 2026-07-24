import {
  LiveAvatarRenderer,
  MAX_LIVE_PAINT_MARKS,
  type LiveLiquidDiagnosticPass,
} from "./game/livePainting";
import {
  UNFINISHED_MORNING_FOG_DENSITY_URL,
  unfinishedMorningLiveBaseSurface,
  unfinishedMorningLiveBackgroundUrl,
  UnfinishedMorningLiveRoomRenderer,
} from "./game/liveRoomPainting";
import type { LiveBrushId, LivePaintMark, LivePaintingConfig } from "./game/types";

type BrushId = Extract<LiveBrushId, "blue-current" | "liquid-color" | "graphite-whisper">;
type AvatarTestTab = "paint" | "liquid";

const ROOM_W = 960;
const ROOM_H = 640;
const AVATAR_SIZE = 512;
const DEMO_ROOM_INDEX = Math.max(0, Math.min(2, Math.round(Number(
  new URLSearchParams(window.location.search).get("room") ?? 0,
)) || 0));
const DEMO_ROOM_LABELS = [
  "6A · Blank Canvas Morning",
  "6B · Humanist Dome",
  "6C · Ten-Thousand-Forms Handscroll",
] as const;
const DEMO_ROOM_SLUGS = ["blank-canvas", "humanist-dome", "handscroll"] as const;
const ROOM_URLS = DEMO_ROOM_SLUGS.map(slug => ([1, 2, 3] as const).map(study => new URL(
  `./game/assets/rooms/unfinished-morning/unfinished-morning-${slug}-shell-v${study}.jpg`,
  import.meta.url,
).href))[DEMO_ROOM_INDEX]!;
const AVATAR_URL = new URL("./game/assets/avatars/flat.png", import.meta.url).href;

const BRUSH_LABELS: Readonly<Record<BrushId, string>> = {
  "blue-current": "blue current",
  "liquid-color": "liquid color",
  "graphite-whisper": "graphite whisper",
};

function requireElement<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing #${id}`);
  return found as T;
}

const roomCanvas = requireElement<HTMLCanvasElement>("room-canvas");
const roomCtx = roomCanvas.getContext("2d")!;
const brushCanvas = requireElement<HTMLCanvasElement>("brush-canvas");
const brushCtx = brushCanvas.getContext("2d")!;
const liveToggle = requireElement<HTMLButtonElement>("live-toggle");
const brushLabel = requireElement<HTMLSpanElement>("brush-label");
const brushSizeInput = requireElement<HTMLInputElement>("brush-size");
const brushFlowInput = requireElement<HTMLInputElement>("brush-flow");
const undoPaintButton = requireElement<HTMLButtonElement>("undo-paint");
const clearPaintButton = requireElement<HTMLButtonElement>("clear-paint");
const liquidBenchCountInput = requireElement<HTMLInputElement>("liquid-bench-count");
const liquidBenchCountValue = requireElement<HTMLOutputElement>("liquid-bench-count-value");
const liquidBenchGenerate = requireElement<HTMLButtonElement>("liquid-bench-generate");
const liquidBenchMetrics = requireElement<HTMLOutputElement>("liquid-bench-metrics");
const loading = requireElement<HTMLDivElement>("room-loading");
const brushCursor = document.createElement("div");
brushCursor.className = "live-brush-cursor hidden";
brushCursor.setAttribute("aria-hidden", "true");
document.body.appendChild(brushCursor);

const roomImages: HTMLImageElement[] = [];
let liveBackgroundImage: HTMLImageElement;
let fogDensityImage: HTMLImageElement | null;
let avatarImage: HTMLImageElement;
let avatarPixels: Uint8ClampedArray;

let currentStudy = 0;
let selectedBrush: BrushId = "liquid-color";
let live = true;
let brushSize = Number(brushSizeInput.value);
let brushFlow = Number(brushFlowInput.value);
let animationTime = 0;
let lastFrame = performance.now();
let frameRequest = 0;
let avatarMarks: LivePaintMark[] = [];
let avatarConfig: LivePaintingConfig = { marks: avatarMarks };
const emptyAvatarConfig: LivePaintingConfig = { marks: [] };
let avatarUndo: LivePaintMark[][] = [];
let avatarDragging = false;
let avatarDrawing = false;
let lastPaintPoint: { x: number; y: number } | null = null;
let brushCursorAt: { x: number; y: number } | null = null;
let roomAvatar = { x: 562, y: 442 };
let avatarTestTab: AvatarTestTab = "paint";
let liquidDiagnosticPass: LiveLiquidDiagnosticPass = "full";
let roomBenchFrozen = false;
let paintMarksSnapshot: LivePaintMark[] | null = null;
let avatarRenderSamples: number[] = [];
let benchFrameSamples: number[] = [];
let lastBenchMetricsAt = 0;
let latestBenchMetrics = { averageMs: 0, p95Ms: 0, fps: 0 };

const liveAvatarRenderer = new LiveAvatarRenderer(AVATAR_SIZE, 1);
const liveRoomRenderer = new UnfinishedMorningLiveRoomRenderer();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
}

function sourceCanvas(image: HTMLImageElement, width: number, height: number): { canvas: HTMLCanvasElement; pixels: Uint8ClampedArray } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, width, height);
  return { canvas, pixels: context.getImageData(0, 0, width, height).data };
}

function hash(seed: number): number {
  const value = Math.sin((seed + 1) * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roomAvatarRect(): { x: number; y: number; size: number } {
  const size = 172;
  return { x: roomAvatar.x - size / 2, y: roomAvatar.y - size * .66, size };
}

function renderAvatarComposite(t: number): HTMLCanvasElement {
  return liveAvatarRenderer.render(avatarImage, live ? avatarConfig : emptyAvatarConfig, t);
}

function renderRoom(t: number, avatar: HTMLCanvasElement): void {
  const liveBaseSurface = unfinishedMorningLiveBaseSurface(DEMO_ROOM_INDEX);
  const image = roomImages[live ? (liveBaseSurface ?? currentStudy) : currentStudy];
  if (!image) return;
  roomCtx.setTransform(1, 0, 0, 1, 0, 0);
  roomCtx.clearRect(0, 0, ROOM_W, ROOM_H);
  roomCtx.drawImage(image, 0, 0, ROOM_W, ROOM_H);
  if (live && !roomBenchFrozen) {
    liveRoomRenderer.draw(
      roomCtx,
      liveBackgroundImage,
      fogDensityImage,
      DEMO_ROOM_INDEX,
      t,
    );
  }
  const rect = roomAvatarRect();
  roomCtx.save();
  if (
    avatarTestTab === "liquid"
    && (liquidDiagnosticPass === "erosion" || liquidDiagnosticPass === "batch-erosion")
  ) {
    roomCtx.globalAlpha = .24;
    roomCtx.drawImage(avatarImage, rect.x, rect.y, rect.size, rect.size);
  }
  roomCtx.globalAlpha = .98;
  roomCtx.drawImage(avatar, rect.x, rect.y, rect.size, rect.size);
  roomCtx.restore();
}

function renderBrushCanvas(avatar: HTMLCanvasElement): void {
  brushCtx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  if (
    avatarTestTab === "liquid"
    && (liquidDiagnosticPass === "erosion" || liquidDiagnosticPass === "batch-erosion")
  ) {
    brushCtx.save();
    brushCtx.globalAlpha = .24;
    brushCtx.drawImage(avatarImage, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    brushCtx.restore();
  }
  brushCtx.drawImage(avatar, 0, 0);
}

function requestDemoFrame(): void {
  if (avatarImage && !frameRequest) frameRequest = requestAnimationFrame(frame);
}

function boundedSample(samples: number[], value: number): void {
  samples.push(value);
  if (samples.length > 120) samples.shift();
}

function percentile95(samples: readonly number[]): number {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] ?? 0;
}

function resetLiquidBenchMetrics(): void {
  avatarRenderSamples = [];
  benchFrameSamples = [];
  lastBenchMetricsAt = 0;
  latestBenchMetrics = { averageMs: 0, p95Ms: 0, fps: 0 };
  liquidBenchMetrics.textContent = "warming up…";
}

function publishLiquidBenchMetrics(now: number): void {
  if (now - lastBenchMetricsAt < 250 || avatarRenderSamples.length < 4) return;
  lastBenchMetricsAt = now;
  const averageMs = avatarRenderSamples.reduce((sum, value) => sum + value, 0) / avatarRenderSamples.length;
  const p95Ms = percentile95(avatarRenderSamples);
  const averageFrameMs = benchFrameSamples.length
    ? benchFrameSamples.reduce((sum, value) => sum + value, 0) / benchFrameSamples.length
    : 0;
  const fps = averageFrameMs > 0 ? Math.min(999, 1000 / averageFrameMs) : 0;
  latestBenchMetrics = { averageMs, p95Ms, fps };
  liquidBenchMetrics.textContent = `${liquidDiagnosticPass} · avatar ${averageMs.toFixed(1)} ms avg · ${p95Ms.toFixed(1)} ms p95 · ${fps.toFixed(0)} fps · ${avatarMarks.length} marks`;
}

function frame(now: number): void {
  frameRequest = 0;
  const frameGapMs = Math.max(0, now - lastFrame);
  const dt = Math.min(.05, frameGapMs / 1000);
  lastFrame = now;
  if (live) animationTime += dt;
  const avatarStartedAt = performance.now();
  const avatar = renderAvatarComposite(animationTime);
  if (avatarTestTab === "liquid") {
    boundedSample(avatarRenderSamples, performance.now() - avatarStartedAt);
    if (frameGapMs > 0 && frameGapMs < 1000) boundedSample(benchFrameSamples, frameGapMs);
    publishLiquidBenchMetrics(now);
  }
  renderRoom(animationTime, avatar);
  renderBrushCanvas(avatar);
  if (live) requestDemoFrame();
}

function canvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height) || 1;
  const contentW = canvas.width * scale;
  const contentH = canvas.height * scale;
  const left = rect.left + (rect.width - contentW) / 2;
  const top = rect.top + (rect.height - contentH) / 2;
  return {
    x: clamp((event.clientX - left) / contentW * canvas.width, 0, canvas.width),
    y: clamp((event.clientY - top) / contentH * canvas.height, 0, canvas.height),
  };
}

function avatarContains(x: number, y: number): boolean {
  const px = clamp(Math.round(x), 0, AVATAR_SIZE - 1);
  const py = clamp(Math.round(y), 0, AVATAR_SIZE - 1);
  return (avatarPixels[(py * AVATAR_SIZE + px) * 4 + 3] ?? 0) > 24;
}

function addAvatarMark(
  x: number,
  y: number,
  brush = selectedBrush,
  seed = Math.random(),
  strokeAngle = 0,
): void {
  if (!avatarContains(x, y)) return;
  const brushScale: Record<BrushId, number> = {
    "blue-current": .9,
    "liquid-color": 1,
    "graphite-whisper": .72,
  };
  avatarMarks.push({
    brush,
    x: Math.round(x / 2),
    y: Math.round(y / 2),
    size: Math.round(brushSize / 2 * brushScale[brush] * (.86 + hash(seed * 877) * .28)),
    flow: Math.round(brushFlow),
    seed: Math.round(hash(seed * 911) * 65_535),
    angle: brush === "blue-current" || brush === "graphite-whisper"
      ? strokeAngle + (hash(seed * 947) - .5) * .14
      : (hash(seed * 947) - .5) * 1.5,
  });
  if (avatarMarks.length > MAX_LIVE_PAINT_MARKS) avatarMarks.length = MAX_LIVE_PAINT_MARKS;
  avatarConfig = { marks: avatarMarks };
}

function generateLiquidBenchMarks(): void {
  const requested = clamp(
    Math.round(Number(liquidBenchCountInput.value) / 20) * 20,
    20,
    MAX_LIVE_PAINT_MARKS,
  );
  const generated: LivePaintMark[] = [];
  for (let attempt = 0; generated.length < requested && attempt < requested * 100; attempt += 1) {
    const x = 10 + hash(attempt * 2 + 17) * (AVATAR_SIZE - 20);
    const y = 10 + hash(attempt * 2 + 53) * (AVATAR_SIZE - 20);
    if (!avatarContains(x, y)) continue;
    generated.push({
      brush: "liquid-color",
      x: Math.round(x / 2),
      y: Math.round(y / 2),
      size: 26,
      flow: 68,
      seed: Math.round(hash(attempt * 19 + 71) * 65_535),
      angle: (hash(attempt * 23 + 89) - .5) * 1.5,
    });
  }
  avatarMarks = generated;
  avatarConfig = { marks: avatarMarks };
  liquidBenchCountValue.value = String(avatarMarks.length);
  brushLabel.textContent = `liquid color · ${avatarMarks.length} marks`;
  resetLiquidBenchMetrics();
  requestDemoFrame();
}

function setLiquidDiagnosticPass(pass: LiveLiquidDiagnosticPass): void {
  liquidDiagnosticPass = pass;
  liveAvatarRenderer.setLiquidDiagnosticPass(pass);
  document.querySelectorAll<HTMLButtonElement>("[data-liquid-pass]").forEach(button => {
    const active = button.dataset.liquidPass === pass;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  resetLiquidBenchMetrics();
  requestDemoFrame();
}

function setAvatarTestTab(tab: AvatarTestTab): void {
  if (tab === avatarTestTab) return;
  if (tab === "liquid") {
    paintMarksSnapshot = [...avatarMarks];
    avatarTestTab = "liquid";
    roomBenchFrozen = true;
    live = true;
    lastFrame = performance.now();
    liveToggle.classList.add("is-on");
    liveToggle.setAttribute("aria-pressed", "true");
    liveToggle.disabled = true;
    hideBrushCursor();
    liveAvatarRenderer.setLiquidDiagnosticPass(liquidDiagnosticPass);
  } else {
    avatarTestTab = "paint";
    roomBenchFrozen = false;
    if (paintMarksSnapshot) {
      avatarMarks = paintMarksSnapshot;
      avatarConfig = { marks: avatarMarks };
    }
    paintMarksSnapshot = null;
    liveToggle.disabled = false;
    liveAvatarRenderer.setLiquidDiagnosticPass("full");
    brushLabel.textContent = BRUSH_LABELS[selectedBrush];
  }
  document.querySelectorAll<HTMLButtonElement>("[data-avatar-test-tab]").forEach(button => {
    const active = button.dataset.avatarTestTab === avatarTestTab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll<HTMLElement>("[data-avatar-test-panel]").forEach(panel => {
    panel.hidden = panel.dataset.avatarTestPanel !== avatarTestTab;
  });
  if (avatarTestTab === "liquid") generateLiquidBenchMarks();
  else requestDemoFrame();
}

function paintTo(point: { x: number; y: number }): void {
  if (!lastPaintPoint) {
    addAvatarMark(point.x, point.y, selectedBrush, Math.random(), 0);
    lastPaintPoint = point;
    return;
  }
  const dx = point.x - lastPaintPoint.x;
  const dy = point.y - lastPaintPoint.y;
  const distance = Math.hypot(dx, dy);
  const strokeAngle = distance > .001 ? Math.atan2(dy, dx) : 0;
  const flowRatio = brushFlow / 100;
  const step = Math.max(3, brushSize * (.5 - flowRatio * .35));
  const count = Math.max(1, Math.ceil(distance / step));
  for (let i = 1; i <= count; i += 1) {
    const x = lastPaintPoint.x + (point.x - lastPaintPoint.x) * i / count;
    const y = lastPaintPoint.y + (point.y - lastPaintPoint.y) * i / count;
    addAvatarMark(x, y, selectedBrush, animationTime * 101 + avatarMarks.length * 7 + i, strokeAngle);
  }
  lastPaintPoint = point;
}

function refreshBrushCursor(): void {
  if (!brushCursorAt) {
    brushCursor.classList.add("hidden");
    return;
  }
  const rect = brushCanvas.getBoundingClientRect();
  const size = Math.max(6, brushSize * (rect.width / AVATAR_SIZE));
  brushCursor.style.setProperty("--live-brush-size", `${size}px`);
  brushCursor.style.left = `${brushCursorAt.x}px`;
  brushCursor.style.top = `${brushCursorAt.y}px`;
  brushCursor.classList.remove("hidden");
}

function updateBrushCursor(event: PointerEvent): void {
  brushCursorAt = { x: event.clientX, y: event.clientY };
  refreshBrushCursor();
}

function hideBrushCursor(): void {
  brushCursorAt = null;
  brushCursor.classList.add("hidden");
}

function bindControls(): void {
  liveToggle.addEventListener("click", () => {
    live = !live;
    if (live) lastFrame = performance.now();
    liveToggle.classList.toggle("is-on", live);
    liveToggle.setAttribute("aria-pressed", String(live));
    requestDemoFrame();
  });
  brushSizeInput.addEventListener("input", () => { brushSize = Number(brushSizeInput.value); refreshBrushCursor(); });
  brushFlowInput.addEventListener("input", () => { brushFlow = Number(brushFlowInput.value); });

  document.querySelectorAll<HTMLButtonElement>("[data-avatar-test-tab]").forEach(button => {
    button.addEventListener("click", () => setAvatarTestTab(button.dataset.avatarTestTab as AvatarTestTab));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-liquid-pass]").forEach(button => {
    button.addEventListener("click", () => setLiquidDiagnosticPass(button.dataset.liquidPass as LiveLiquidDiagnosticPass));
  });
  liquidBenchCountInput.addEventListener("input", () => {
    liquidBenchCountValue.value = liquidBenchCountInput.value;
  });
  liquidBenchCountInput.addEventListener("change", generateLiquidBenchMarks);
  liquidBenchGenerate.addEventListener("click", generateLiquidBenchMarks);

  document.querySelectorAll<HTMLButtonElement>("[data-study]").forEach(button => {
    button.addEventListener("click", () => {
      currentStudy = clamp(Number(button.dataset.study), 0, 2);
      document.querySelectorAll<HTMLButtonElement>("[data-study]").forEach(candidate => {
        const active = candidate === button;
        candidate.classList.toggle("is-active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });
      requestDemoFrame();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-brush]").forEach(button => {
    button.addEventListener("click", () => {
      selectedBrush = button.dataset.brush as BrushId;
      brushLabel.textContent = BRUSH_LABELS[selectedBrush];
      document.querySelectorAll<HTMLButtonElement>("[data-brush]").forEach(candidate => {
        const active = candidate === button;
        candidate.classList.toggle("is-active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });
    });
  });

  const syncPaintActions = (): void => {
    undoPaintButton.disabled = avatarUndo.length === 0;
    clearPaintButton.disabled = avatarMarks.length === 0;
  };
  undoPaintButton.addEventListener("click", () => {
    const previous = avatarUndo.pop();
    if (previous) {
      avatarMarks = previous;
      avatarConfig = { marks: avatarMarks };
    }
    syncPaintActions();
    requestDemoFrame();
  });
  clearPaintButton.addEventListener("click", () => {
    if (!avatarMarks.length) return;
    avatarUndo.push([...avatarMarks]);
    avatarMarks = [];
    avatarConfig = { marks: avatarMarks };
    syncPaintActions();
    requestDemoFrame();
  });
  syncPaintActions();

  brushCanvas.addEventListener("pointerdown", event => {
    if (avatarTestTab !== "paint") return;
    event.preventDefault();
    updateBrushCursor(event);
    avatarUndo.push([...avatarMarks]);
    if (avatarUndo.length > 20) avatarUndo.shift();
    avatarDrawing = true;
    lastPaintPoint = null;
    brushCanvas.setPointerCapture(event.pointerId);
    paintTo(canvasPoint(brushCanvas, event));
    syncPaintActions();
    requestDemoFrame();
  });
  brushCanvas.addEventListener("pointermove", event => {
    if (avatarTestTab !== "paint") return;
    updateBrushCursor(event);
    if (!avatarDrawing) return;
    event.preventDefault();
    paintTo(canvasPoint(brushCanvas, event));
    syncPaintActions();
    requestDemoFrame();
  });
  const stopPaint = (event: PointerEvent): void => {
    avatarDrawing = false;
    lastPaintPoint = null;
    if (event.pointerType && event.pointerType !== "mouse") hideBrushCursor();
  };
  brushCanvas.addEventListener("pointerup", stopPaint);
  brushCanvas.addEventListener("pointercancel", stopPaint);
  brushCanvas.addEventListener("pointerenter", event => {
    if (avatarTestTab === "paint") updateBrushCursor(event);
  });
  brushCanvas.addEventListener("pointerleave", hideBrushCursor);

  roomCanvas.addEventListener("pointerdown", event => {
    const point = canvasPoint(roomCanvas, event);
    const rect = roomAvatarRect();
    if (point.x >= rect.x && point.x <= rect.x + rect.size && point.y >= rect.y && point.y <= rect.y + rect.size) {
      avatarDragging = true;
      roomCanvas.setPointerCapture(event.pointerId);
    }
  });
  roomCanvas.addEventListener("pointermove", event => {
    if (!avatarDragging) return;
    const point = canvasPoint(roomCanvas, event);
    roomAvatar.x = clamp(point.x, 88, ROOM_W - 88);
    roomAvatar.y = clamp(point.y + 28, 155, ROOM_H - 28);
    requestDemoFrame();
  });
  const stopDrag = (): void => { avatarDragging = false; };
  roomCanvas.addEventListener("pointerup", stopDrag);
  roomCanvas.addEventListener("pointercancel", stopDrag);
}

async function initialize(): Promise<void> {
  const liveBackgroundUrl = unfinishedMorningLiveBackgroundUrl(DEMO_ROOM_INDEX);
  if (!liveBackgroundUrl) throw new Error("Missing live background");
  const [rooms, liveBackground, fogDensity, avatar] = await Promise.all([
    Promise.all(ROOM_URLS.map(loadImage)),
    loadImage(liveBackgroundUrl),
    DEMO_ROOM_INDEX === 1 ? Promise.resolve(null) : loadImage(UNFINISHED_MORNING_FOG_DENSITY_URL),
    loadImage(AVATAR_URL),
  ]);
  roomImages.push(...rooms);
  liveBackgroundImage = liveBackground;
  fogDensityImage = fogDensity;
  avatarImage = avatar;
  const roomLabel = DEMO_ROOM_LABELS[DEMO_ROOM_INDEX];
  const studyName = document.querySelector<HTMLElement>(".study-name");
  if (studyName) studyName.textContent = roomLabel;
  roomCanvas.setAttribute("aria-label", `${roomLabel} with a draggable camouflaged chameleon`);
  const avatarSource = sourceCanvas(avatar, AVATAR_SIZE, AVATAR_SIZE);
  avatarPixels = avatarSource.pixels;
  bindControls();
  loading.classList.add("is-ready");
  requestDemoFrame();
}

declare global {
  interface Window {
    __live6a?: {
      info: () => {
        ready: boolean;
        live: boolean;
        study: number;
        brush: BrushId;
        marks: number;
        size: number;
        flow: number;
        bench: {
          tab: AvatarTestTab;
          pass: LiveLiquidDiagnosticPass;
          roomFrozen: boolean;
          averageMs: number;
          p95Ms: number;
          fps: number;
        };
      };
      clear: () => void;
      setStudy: (study: number) => void;
    };
  }
}

window.__live6a = {
  info: () => ({
    ready: Boolean(avatarImage),
    live,
    study: currentStudy,
    brush: selectedBrush,
    marks: avatarMarks.length,
    size: brushSize,
    flow: brushFlow,
    bench: {
      tab: avatarTestTab,
      pass: liquidDiagnosticPass,
      roomFrozen: roomBenchFrozen,
      ...latestBenchMetrics,
    },
  }),
  clear: () => { avatarMarks = []; avatarConfig = { marks: avatarMarks }; requestDemoFrame(); },
  setStudy: study => { currentStudy = clamp(Math.round(study), 0, 2); requestDemoFrame(); },
};

void initialize().catch(error => {
  loading.textContent = "could not paint this study";
  console.error(error);
});
