import {
  CuratedLiveRoomRenderer,
  type CuratedLiveDrawStages,
  type CuratedLiveProject,
} from "./game/curatedLivePainting";

type BenchMode = "base" | "splash" | "stars" | "breakout" | "full";

const ROOM_WIDTH = 960;
const ROOM_HEIGHT = 640;
const PROJECT_URL = new URL(
  "./game/assets/live-projects/van-gogh-starry-studio-1b.json",
  import.meta.url,
).href;
const ROOM_URL = new URL(
  "./game/assets/rooms/van-gogh-starry-studio-shell-v6a.jpg",
  import.meta.url,
).href;
const AVATAR_URL = new URL("./game/assets/avatars/stand.png", import.meta.url).href;

function requireElement<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing #${id}`);
  return found as T;
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

async function loadProject(): Promise<CuratedLiveProject> {
  const response = await fetch(PROJECT_URL);
  if (!response.ok) throw new Error(`Could not load final 1B (HTTP ${response.status})`);
  const project = await response.json() as CuratedLiveProject;
  if (project.id !== "van-gogh-starry-studio-1b"
    || project.canvas.width !== ROOM_WIDTH
    || project.canvas.height !== ROOM_HEIGHT
    || project.stats.marks !== 1233) {
    throw new Error("Final 1B runtime data does not match its reviewed contract");
  }
  return project;
}

function percentile95(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] ?? 0;
}

const canvas = requireElement<HTMLCanvasElement>("bench-canvas");
const context = canvas.getContext("2d", { alpha: false })!;
const loading = requireElement<HTMLDivElement>("bench-loading");
const markLimitInput = requireElement<HTMLInputElement>("bench-mark-limit");
const markValue = requireElement<HTMLOutputElement>("bench-mark-value");
const metrics = requireElement<HTMLOutputElement>("bench-metrics");

let mode: BenchMode = "full";
let markLimit = Number(markLimitInput.value);
let project: CuratedLiveProject;
let room: HTMLImageElement;
let avatar: HTMLImageElement;
let renderer: CuratedLiveRoomRenderer;
let startedAt = performance.now();
let lastFrameAt = performance.now();
let lastMetricsAt = 0;
let dragPointer = -1;
let actor = { x: 548, y: 450 };
let durations: number[] = [];
let frameGaps: number[] = [];

function stages(): CuratedLiveDrawStages | undefined {
  if (mode === "base") return { warpFieldLimit: 0, marks: false };
  if (mode === "splash") {
    return { warpFieldLimit: 0, markKinds: ["color-liquify-splash"], markLimit, atlasSoftMarks: true };
  }
  if (mode === "stars") {
    return { warpFieldLimit: 0, markKinds: ["twinkle"], markLimit, atlasSoftMarks: true };
  }
  if (mode === "breakout") {
    return { warpFieldLimit: 0, markKinds: ["color-liquify-breakout"], markLimit, atlasSoftMarks: true };
  }
  return { markLimit, atlasSoftMarks: true };
}

function resetMetrics(): void {
  durations = [];
  frameGaps = [];
  lastMetricsAt = 0;
  metrics.textContent = "warming up…";
}

function drawAvatar(): void {
  context.save();
  context.globalAlpha = .98;
  context.drawImage(avatar, actor.x - 51, actor.y - 84, 102, 102);
  context.restore();
}

function publishMetrics(now: number): void {
  if (now - lastMetricsAt < 250 || durations.length < 4) return;
  lastMetricsAt = now;
  const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  const p95 = percentile95(durations);
  const frameAverage = frameGaps.reduce((sum, value) => sum + value, 0) / Math.max(1, frameGaps.length);
  const fps = frameAverage > 0 ? Math.min(999, 1000 / frameAverage) : 0;
  metrics.textContent = `${mode} · ${markLimit} limit · ${average.toFixed(1)} ms avg · ${p95.toFixed(1)} ms p95 · ${fps.toFixed(0)} fps`;
}

function frame(now: number): void {
  const frameGap = now - lastFrameAt;
  lastFrameAt = now;
  const drawStartedAt = performance.now();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.drawImage(room, 0, 0, ROOM_WIDTH, ROOM_HEIGHT);
  renderer.draw(context, room, project, (now - startedAt) / 1000, stages());
  drawAvatar();
  durations.push(performance.now() - drawStartedAt);
  if (durations.length > 120) durations.shift();
  if (frameGap > 0 && frameGap < 1000) frameGaps.push(frameGap);
  if (frameGaps.length > 120) frameGaps.shift();
  publishMetrics(now);
  requestAnimationFrame(frame);
}

function canvasPoint(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * ROOM_WIDTH / rect.width,
    y: (event.clientY - rect.top) * ROOM_HEIGHT / rect.height,
  };
}

function moveActor(event: PointerEvent): void {
  const point = canvasPoint(event);
  actor = {
    x: Math.max(52, Math.min(ROOM_WIDTH - 52, point.x)),
    y: Math.max(100, Math.min(ROOM_HEIGHT - 16, point.y + 30)),
  };
}

function bindControls(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-bench-mode]").forEach(button => {
    button.addEventListener("click", () => {
      mode = button.dataset.benchMode as BenchMode;
      document.querySelectorAll<HTMLButtonElement>("[data-bench-mode]").forEach(candidate => {
        const active = candidate === button;
        candidate.classList.toggle("is-active", active);
        candidate.setAttribute("aria-selected", String(active));
      });
      resetMetrics();
    });
  });
  markLimitInput.addEventListener("input", () => {
    markLimit = Number(markLimitInput.value);
    markValue.value = String(markLimit);
    resetMetrics();
  });
  canvas.addEventListener("pointerdown", event => {
    dragPointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    moveActor(event);
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", event => {
    if (event.pointerId !== dragPointer) return;
    moveActor(event);
    event.preventDefault();
  });
  const stopDrag = (event: PointerEvent): void => {
    if (event.pointerId === dragPointer) dragPointer = -1;
  };
  canvas.addEventListener("pointerup", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);
}

async function initialize(): Promise<void> {
  [project, room, avatar] = await Promise.all([loadProject(), loadImage(ROOM_URL), loadImage(AVATAR_URL)]);
  renderer = new CuratedLiveRoomRenderer();
  bindControls();
  loading.classList.add("is-ready");
  startedAt = performance.now();
  lastFrameAt = startedAt;
  requestAnimationFrame(frame);
}

void initialize().catch(error => {
  loading.textContent = "could not load final 1B";
  console.error(error);
});
