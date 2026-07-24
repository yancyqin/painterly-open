import { t, type MessageKey } from "../i18n";
import { LIVE_BRUSH_IDS, type ArtHouseId, type ArtRoomDefinition, type LiveBrushId, type LivePaintMark, type LivePaintingConfig } from "./types";
import {
  AVATAR_SIZE,
  MAX_MARKS_PER_BRUSH_POINT,
  MAX_PAINT_COLORS,
  POSE_IDS,
  type PoseId,
} from "./config";
import {
  PAINT_SHAPES,
  paintPalette,
  sanitizeCustomPaintColors,
  sanitizePaintMarks,
  type PaintMark,
  type PaintShape,
} from "./paint";
import { drawPaintMarks } from "./renderPaint";
import { makeRoomCamoMarks } from "./camo";
import { makeIvoryAvatar } from "./avatarAppearance";
import {
  LIVE_BRUSH_DEFAULT,
  LIVE_FLOW_DEFAULT,
  LIVE_FLOW_MAX,
  LIVE_FLOW_MIN,
  LIVE_SIZE_DEFAULT,
  LIVE_SIZE_MAX,
  LIVE_MARK_SPACE,
  LIVE_SIZE_MIN,
  LIVE_STRENGTH_DEFAULT,
  LIVE_STRENGTH_MAX,
  LIVE_STRENGTH_MIN,
  LIVE_TOOL_SIZE_MAX,
  MAX_LIVE_PAINT_MARKS,
  LiveAvatarRenderer,
  liveBrushesForRoom,
  normalizeLivePaintingConfig,
} from "./livePainting";

type BrushMode = "gaussian" | "streak" | "point" | "impasto" | "wash" | "block";
type StudioToolTab = "paint" | "live";
interface PointerSample { x: number; y: number; pressure: number }

const ROOM_MESSAGES = {
  "van-gogh-house": { title: "house.vanGoghFull", tip: "room.vanGogh.tip", camo: "room.vanGogh.camo", camoHelp: "room.vanGogh.camoHelp" },
  "monet-garden-house": { title: "house.monetFull", tip: "room.monet.tip", camo: "room.monet.camo", camoHelp: "room.monet.camoHelp" },
  "outdoor-masters-journey": { title: "house.outdoorFull", tip: "room.outdoor.tip", camo: "room.outdoor.camo", camoHelp: "room.outdoor.camoHelp" },
} as const satisfies Record<ArtHouseId, Record<"title" | "tip" | "camo" | "camoHelp", MessageKey>>;

/** Same tiny deterministic variation helper used by the approved 6A study. */
function liveHash(seed: number): number {
  const value = Math.sin((seed + 1) * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

// Game-balance outline: user paint cannot cover the upper half of the outermost
// 1px silhouette, and that small rim keeps the room camo. The lower silhouette
// and the complete eye are freely paintable. Toggleable starter camo covers the
// whole ivory body, including the eye.
const SILHOUETTE_PX = 1;

function makePaintLayer(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  return [canvas, canvas.getContext("2d", { willReadFrequently: true })!];
}

export interface PaintStudioOptions {
  room: ArtRoomDefinition;
  pose: PoseId;
  sessionId: string;
  customColors: string[];
  maskUrls: Record<PoseId, string>;
  defaultCamo: boolean;
  liveEnabled: boolean;
  liveBrush: LiveBrushId;
  liveMarks: LivePaintMark[];
  liveSize: number;
  liveFlow: number;
  liveStrength: number;
  liveSeed: number;
  onPreview(pose: PoseId, canvas: HTMLCanvasElement, customColors: string[]): void;
  onCamoChange(enabled: boolean): void;
  onLiveChange(value: LivePaintingConfig | null, tools: { brush: LiveBrushId; size: number; flow: number; strength: number }): void;
  onLock(pose: PoseId, canvas: HTMLCanvasElement): void;
  onLeave(): void;
  sampleRoomColor?(clientX: number, clientY: number): Promise<string | null>;
  /** A square room reference image shown behind the paper (read-only) so the
   * eyedropper can pick room colors directly on the canvas. */
  roomBackdrop?(size: number): CanvasImageSource | null;
}
export class PaintStudio {
  private root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private backdropCanvas: HTMLCanvasElement;
  private backdropCtx: CanvasRenderingContext2D;
  private hasBackdrop = false;
  private paletteEl: HTMLDivElement;
  private roomTitle: HTMLElement;
  private artTip: HTMLElement;
  private sizeInput: HTMLInputElement;
  private status: HTMLElement;
  private paintStats: HTMLElement;
  private camoButton: HTMLButtonElement;
  private camoHelp: HTMLElement;
  private colorInput: HTMLInputElement;
  private eyedropperButton: HTMLButtonElement;
  private liveToggle: HTMLButtonElement;
  private liveTabButton: HTMLButtonElement;
  private paintTabPanel: HTMLDivElement;
  private liveTabPanel: HTMLDivElement;
  private liveSizeInput: HTMLInputElement;
  private liveFlowInput: HTMLInputElement;
  private liveStrengthInput: HTMLInputElement;
  private liveUndoButton: HTMLButtonElement;
  private liveClearButton: HTMLButtonElement;
  private liveStats: HTMLElement;
  private eyedropperIndicator: HTMLDivElement;
  private brushCursor: HTMLDivElement;
  private brushCursorAt: { x: number; y: number } | null = null;
  private options: PaintStudioOptions | null = null;
  private masks = new Map<PoseId, HTMLImageElement>();
  // Per-pose cached ivory bases and clip masks. These are built once when the
  // PNG loads, never during pointer/rAF rendering.
  private ivoryBases = new Map<PoseId, HTMLCanvasElement>();
  private upperEdgeMasks = new Map<PoseId, HTMLCanvasElement>();
  private paintMasks = new Map<PoseId, HTMLCanvasElement>();
  private scratchLayer: HTMLCanvasElement;
  private scratchCtx: CanvasRenderingContext2D;
  private camoLayer: HTMLCanvasElement;
  private camoCtx: CanvasRenderingContext2D;
  private userLayer: HTMLCanvasElement;
  private userCtx: CanvasRenderingContext2D;
  private staticCanvas: HTMLCanvasElement;
  private staticCtx: CanvasRenderingContext2D;
  private liveRenderer: LiveAvatarRenderer | null = null;
  private liveSeed = 1;
  private undoStack: ImageData[] = [];
  private sessionId = "";
  private customColors: string[] = [];
  private pose: PoseId = "stand";
  private selectedColor = 0;
  private brush: BrushMode = "streak";
  private toolTab: StudioToolTab = "paint";
  private liveEnabled = false;
  private liveBrush: LiveBrushId = LIVE_BRUSH_DEFAULT;
  private liveSize = LIVE_SIZE_DEFAULT;
  private liveFlow = LIVE_FLOW_DEFAULT;
  private liveStrength = LIVE_STRENGTH_DEFAULT;
  private liveMarks: LivePaintMark[] = [];
  private liveConfig: LivePaintingConfig = { marks: [] };
  private liveUndoStack: LivePaintMark[][] = [];
  private liveDrawing = false;
  private liveLastPoint: { x: number; y: number } | null = null;
  private liveStartedAt = performance.now();
  private liveLastFrameAt = 0;
  private liveFrame = 0;
  private movementCalm = false;
  private movementCalmStartedAt = 0;
  private camoEnabled = false;
  private drawing = false;
  /** Draw-calm (Art Lab's iPad fix): true while a static-paint stroke is
   * down. Mid-stroke the live view freezes to the raw painting, and the room
   * preview + live resample wait for the lift. */
  private strokeCalm = false;
  private eyedropper = false;
  private eyedropperSampling = false;
  private eyedropperFlashTimer: number | null = null;
  private lockSubmitted = false;
  private paintBusy = false;
  private stateHandler: ((open: boolean) => void) | null = null;
  private pendingSample: PointerSample | null = null;
  private pointIndex = 0;
  private strokeStartedAt = 0;
  private strokeSeed = 0;
  private previous = { x: 0, y: 0, time: 0 };
  private static readonly MAX_UNDO_STROKES = 20;
  private readonly roomSamplePointerDown = (event: PointerEvent) => {
    if (!this.eyedropper) return;
    this.showEyedropperIndicator(event.clientX, event.clientY);
    const target = event.target;
    // The avatar canvas has its own synchronous sampler. Other studio
    // controls remain usable while the portable picker is armed.
    if (target instanceof Node && this.root.contains(target)) return;
    event.preventDefault();
    event.stopPropagation();
    void this.sampleRoomAt(event.clientX, event.clientY);
  };
  private readonly roomSamplePointerMove = (event: PointerEvent) => {
    if (this.eyedropper) this.showEyedropperIndicator(event.clientX, event.clientY);
  };

  constructor() {
    this.root = document.createElement("div");
    this.root.className = "paint-studio hidden";
    this.root.innerHTML = `
      <section class="paint-card" data-t-aria="studio.label" aria-label="Painterly Chameleon paint studio">
        <header class="paint-head">
          <div><small data-t="studio.eyebrow">hider studio</small><h2 data-room-title>Art Room</h2></div>
          <div class="paint-head-actions">
            <button class="paint-live-toggle" type="button" data-live-toggle aria-pressed="false">○ live</button>
            <button class="paint-leave" type="button" data-t="studio.leave">← leave room</button>
            <button class="paint-close" type="button" data-t-title="studio.closeLabel" title="Return to the room">×</button>
          </div>
        </header>
        <p class="paint-tip" data-art-tip></p>
        <div class="paint-workspace">
          <div class="paint-canvas-wrap">
            <div class="paint-canvas-stack">
              <canvas class="paint-backdrop" data-paint-backdrop width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" aria-hidden="true"></canvas>
              <canvas data-paint-surface width="${AVATAR_SIZE}" height="${AVATAR_SIZE}"></canvas>
            </div>
          </div>
          <div class="paint-tools">
            <label data-t="studio.pose">Pose</label><div class="paint-segment" data-poses></div>
            <div class="paint-tool-tabs" role="tablist" data-t-aria="studio.brushMode" aria-label="Chameleon brush mode">
              <button type="button" role="tab" data-tool-tab="paint" aria-selected="true" data-t="studio.paintTab">paint</button>
              <button type="button" role="tab" data-tool-tab="live" aria-selected="false" hidden data-t="studio.liveTab">live brush</button>
            </div>
            <div class="paint-tool-panel" data-tool-panel="paint" role="tabpanel">
              <label data-t="studio.starterCamo">Starter camouflage</label>
              <button type="button" data-camo>Room Camo · On</button>
              <small class="paint-help" data-camo-help>A removable room-colored starting point.</small>
              <label data-t="studio.roomPalette">Room palette</label><div class="paint-palette"></div>
              <div class="paint-color-tools">
                <button type="button" data-eyedropper>◉ Eyedropper</button>
                <label class="paint-color-picker"><span data-t="studio.fullColor">Full color</span> <input data-color-picker type="color" value="#285d9b"></label>
              </div>
              <label data-t="studio.brush">Brush</label>
              <div class="paint-segment" data-brushes>
                <button type="button" data-brush="gaussian" data-t="brush.gaussian">Gaussian</button>
                <button type="button" data-brush="streak" data-t="brush.streak">Streak</button>
                <button type="button" data-brush="point" data-t="brush.point">Point</button>
                <button type="button" data-brush="impasto" data-t="brush.impasto">Impasto</button>
                <button type="button" data-brush="wash" data-t="brush.wash">Wash</button>
                <button type="button" data-brush="block" data-t="brush.block">Block</button>
              </div>
              <label><span data-t="studio.size">Size</span> <input data-size type="range" min="6" max="72" value="26"></label>
              <div class="paint-row"><button data-undo type="button" data-t="studio.undo">Undo stroke</button><button data-clear type="button" data-t="studio.clear">Clear</button></div>
              <small class="paint-stats" data-paint-stats>Flattened painting · compressed when published</small>
            </div>
            <div class="paint-tool-panel live-brush-panel" data-tool-panel="live" role="tabpanel" hidden>
              <label data-t="studio.liveTab">live brush</label>
              <div class="paint-segment live-brush-list" data-live-brushes>
                <button type="button" data-live-brush="blue-current" data-t="brush.blueCurrent">blue current</button>
                <button type="button" data-live-brush="liquid-color" data-t="brush.liquidColor">liquid color</button>
                <button type="button" data-live-brush="graphite-whisper" data-t="brush.graphiteWhisper">graphite whisper</button>
                <button type="button" data-live-brush="firefly" data-t="brush.firefly">firefly</button>
                <button type="button" data-live-brush="growth" data-t="brush.growth">growth</button>
                <button type="button" data-live-brush="color-liquify-splash" data-t="brush.colorLiquifySplash">color liquify splash</button>
              </div>
              <div class="live-brush-sliders">
                <label><span data-t="studio.size">size</span><input data-live-size type="range" min="${LIVE_SIZE_MIN}" max="${LIVE_TOOL_SIZE_MAX}" value="${LIVE_SIZE_DEFAULT}"></label>
                <label><span data-t="studio.flow">flow</span><input data-live-flow type="range" min="${LIVE_FLOW_MIN}" max="${LIVE_FLOW_MAX}" value="${LIVE_FLOW_DEFAULT}"></label>
                <label><span data-t="studio.force">force</span><input data-live-strength type="range" min="${LIVE_STRENGTH_MIN}" max="${LIVE_STRENGTH_MAX}" value="${LIVE_STRENGTH_DEFAULT}"></label>
                <div class="live-strength-scale" aria-hidden="true"><span data-t="studio.quiet">quiet</span><span data-t="studio.liveToggle">live</span></div>
              </div>
              <div class="paint-row"><button data-live-undo data-t="studio.undo" type="button">undo</button><button data-live-clear data-t="studio.clear" type="button">clear</button></div>
              <small class="paint-stats" data-live-stats>0/320 live marks</small>
              <small class="paint-help" data-t="studio.liveHelp">paint motion on the chameleon · room force stays authored</small>
            </div>
          </div>
        </div>
        <footer class="paint-footer">
          <span data-paint-status>Ready</span>
          <button class="paint-back" type="button" data-t="studio.backToRoom">Back to room</button>
          <button class="paint-lock" type="button" data-t="hider.ready">ready</button>
        </footer>
      </section>`;
    document.body.appendChild(this.root);
    this.eyedropperIndicator = document.createElement("div");
    this.eyedropperIndicator.className = "paint-eyedropper-indicator";
    this.eyedropperIndicator.setAttribute("aria-hidden", "true");
    this.eyedropperIndicator.innerHTML = `
      <svg viewBox="0 0 32 32">
        <path d="M20 3 29 12 26 15 24 13 12 25 5 27 7 20 19 8 17 6Z"/>
        <path class="paint-eyedropper-glass" d="M7 20 12 25 5 27Z"/>
      </svg>`;
    document.body.appendChild(this.eyedropperIndicator);
    this.brushCursor = document.createElement("div");
    this.brushCursor.className = "paint-brush-cursor hidden";
    this.brushCursor.setAttribute("aria-hidden", "true");
    document.body.appendChild(this.brushCursor);
    this.canvas = this.root.querySelector("[data-paint-surface]")!;
    this.ctx = this.canvas.getContext("2d")!;
    this.backdropCanvas = this.root.querySelector("[data-paint-backdrop]")!;
    // willReadFrequently: the backdrop is static (drawn once per open) and only
    // read by the eyedropper, so a CPU-backed context is the right trade here.
    this.backdropCtx = this.backdropCanvas.getContext("2d", { willReadFrequently: true })!;
    [this.camoLayer, this.camoCtx] = makePaintLayer();
    [this.userLayer, this.userCtx] = makePaintLayer();
    [this.scratchLayer, this.scratchCtx] = makePaintLayer();
    [this.staticCanvas, this.staticCtx] = makePaintLayer();
    this.paletteEl = this.root.querySelector(".paint-palette")!;
    this.roomTitle = this.root.querySelector("[data-room-title]")!;
    this.artTip = this.root.querySelector("[data-art-tip]")!;
    this.sizeInput = this.root.querySelector("[data-size]")!;
    this.status = this.root.querySelector("[data-paint-status]")!;
    this.paintStats = this.root.querySelector("[data-paint-stats]")!;
    this.camoButton = this.root.querySelector("[data-camo]")!;
    this.camoHelp = this.root.querySelector("[data-camo-help]")!;
    this.colorInput = this.root.querySelector("[data-color-picker]")!;
    this.eyedropperButton = this.root.querySelector("[data-eyedropper]")!;
    this.liveToggle = this.root.querySelector("[data-live-toggle]")!;
    this.liveTabButton = this.root.querySelector("[data-tool-tab='live']")!;
    this.paintTabPanel = this.root.querySelector("[data-tool-panel='paint']")!;
    this.liveTabPanel = this.root.querySelector("[data-tool-panel='live']")!;
    this.liveSizeInput = this.root.querySelector("[data-live-size]")!;
    this.liveFlowInput = this.root.querySelector("[data-live-flow]")!;
    this.liveStrengthInput = this.root.querySelector("[data-live-strength]")!;
    this.liveUndoButton = this.root.querySelector("[data-live-undo]")!;
    this.liveClearButton = this.root.querySelector("[data-live-clear]")!;
    this.liveStats = this.root.querySelector("[data-live-stats]")!;
    this.buildPoseButtons();
    this.bind();
  }

  get isOpen() {
    return !this.root.classList.contains("hidden");
  }

  private getLiveRenderer(): LiveAvatarRenderer {
    if (!this.liveRenderer) this.liveRenderer = new LiveAvatarRenderer(256, this.liveSeed);
    return this.liveRenderer;
  }

  private releaseLiveRenderer(): void {
    if (!this.liveRenderer) return;
    this.liveRenderer.dispose();
    this.liveRenderer = null;
  }

  onStateChange(handler: (open: boolean) => void) {
    this.stateHandler = handler;
  }

  open(options: PaintStudioOptions) {
    const newSession = options.sessionId !== this.sessionId;
    this.options = options;
    this.prefersInAppEyedropper();
    this.drawing = false;
    this.lockSubmitted = false;
    this.stopInAppEyedropper();
    this.paintBusy = false;
    this.pendingSample = null;
    this.pose = options.pose;
    this.liveEnabled = Boolean(options.room.livePainting && options.liveEnabled);
    const roomLiveBrushes = liveBrushesForRoom(options.room);
    this.liveBrush = roomLiveBrushes.includes(options.liveBrush)
      ? options.liveBrush
      : roomLiveBrushes[0] ?? LIVE_BRUSH_DEFAULT;
    const liveConfig = normalizeLivePaintingConfig({ marks: options.liveMarks });
    this.liveMarks = liveConfig.marks;
    this.liveSize = Math.round(Math.max(LIVE_SIZE_MIN, Math.min(LIVE_TOOL_SIZE_MAX, options.liveSize)));
    this.liveFlow = Math.round(Math.max(LIVE_FLOW_MIN, Math.min(LIVE_FLOW_MAX, options.liveFlow)));
    this.liveStrength = Math.round(Math.max(LIVE_STRENGTH_MIN, Math.min(LIVE_STRENGTH_MAX, options.liveStrength)));
    this.liveConfig = { marks: [...this.liveMarks], strength: this.liveStrength };
    this.liveUndoStack = [];
    this.liveDrawing = false;
    this.liveLastPoint = null;
    this.liveSizeInput.value = String(this.liveSize);
    this.liveFlowInput.value = String(this.liveFlow);
    this.liveStrengthInput.value = String(this.liveStrength);
    this.liveSeed = options.liveSeed;
    this.liveRenderer?.setSeed(options.liveSeed);
    if (!this.liveEnabled) this.releaseLiveRenderer();
    if (!this.liveEnabled) this.toolTab = "paint";
    this.liveStartedAt = performance.now();
    if (this.movementCalm) this.movementCalmStartedAt = this.liveStartedAt;
    this.liveLastFrameAt = 0;
    if (newSession) {
      this.sessionId = options.sessionId;
      // Full color is one mutable swatch, not a growing color history. Existing
      // flattened paint keeps its pixels, so only the latest saved swatch is
      // needed when the Studio reopens.
      this.customColors = sanitizeCustomPaintColors(options.customColors, options.room.palette).slice(-1);
      this.selectedColor = 0;
      this.camoEnabled = options.defaultCamo;
      this.camoCtx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
      this.userCtx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
      this.undoStack = [];
      // Keep the camo layer ready for the ordinary protected-rim mode. Live
      // mode reveals the full authored paint instead.
      this.paintDefaultCamo();
    }
    const roomMessages = ROOM_MESSAGES[options.room.id];
    this.roomTitle.textContent = t(roomMessages.title);
    this.artTip.textContent = t(roomMessages.tip);
    this.camoHelp.textContent = t(roomMessages.camoHelp);
    this.loadMasks(options.maskUrls);
    this.loadRoomBackdrop();
    this.buildPalette();
    this.applyLabels();
    this.syncButtons();
    this.status.textContent = t("studio.ready");
    this.status.className = "";
    this.root.classList.remove("hidden");
    this.stateHandler?.(true);
    this.changed();
    this.syncLiveLoop();
  }

  close() {
    this.stopInAppEyedropper();
    this.hideBrushCursor();
    if (this.liveFrame) cancelAnimationFrame(this.liveFrame);
    this.liveFrame = 0;
    this.releaseLiveRenderer();
    this.root.classList.add("hidden");
    this.stateHandler?.(false);
  }

  /** Re-pull the room reference behind the paper. On desktop the studio is a
   * side panel and the room + joystick stay live, so when the chameleon walks
   * the backdrop should track it (called from GameCanvas.onTargetMove). */
  refreshBackdrop() {
    if (!this.isOpen) return;
    this.loadRoomBackdrop();
  }

  /** Freeze Live force while the room actor walks, matching GameCanvas. */
  setMovementCalm(moving: boolean) {
    if (this.movementCalm === moving) return;
    const now = performance.now();
    this.movementCalm = moving;
    if (moving) {
      this.movementCalmStartedAt = now;
      if (this.isOpen) this.renderDisplay(now);
      return;
    }
    if (this.movementCalmStartedAt > 0) {
      this.liveStartedAt += Math.max(0, now - this.movementCalmStartedAt);
    }
    this.movementCalmStartedAt = 0;
    this.liveLastFrameAt = 0;
    if (this.isOpen) this.renderDisplay(now);
  }

  lockForDeadline() {
    this.status.textContent = t("studio.paintEnded");
    this.status.className = "ok";
    this.submitLock();
  }

  destroy() {
    this.stopInAppEyedropper();
    if (this.liveFrame) cancelAnimationFrame(this.liveFrame);
    this.releaseLiveRenderer();
    this.eyedropperIndicator.remove();
    this.brushCursor.remove();
    this.root.remove();
  }

  private buildPoseButtons() {
    const host = this.root.querySelector("[data-poses]")!;
    for (const pose of POSE_IDS) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.pose = pose;
      button.textContent = t(`pose.${pose}` as MessageKey);
      host.appendChild(button);
    }
  }

  /** Re-apply localized text to the studio chrome — run on every open() so the
   * panel reflects the current locale (built once, shown many times). */
  private applyLabels() {
    this.root.querySelectorAll<HTMLElement>("[data-t]").forEach(el => {
      const key = el.dataset.t as MessageKey | undefined;
      if (key) el.textContent = t(key);
    });
    this.root.querySelectorAll<HTMLElement>("[data-t-title]").forEach(el => {
      const key = el.dataset.tTitle as MessageKey | undefined;
      if (key) el.title = t(key);
    });
    this.root.querySelectorAll<HTMLElement>("[data-t-aria]").forEach(el => {
      const key = el.dataset.tAria as MessageKey | undefined;
      if (key) el.setAttribute("aria-label", t(key));
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-pose]").forEach(b => {
      b.textContent = t(`pose.${b.dataset.pose}` as MessageKey);
    });
    this.eyedropperButton.textContent = `◉ ${t("studio.eyedropper")}`;
  }

  private loadMasks(urls: Record<PoseId, string>) {
    for (const pose of POSE_IDS) {
      const old = this.masks.get(pose);
      if (old?.src === new URL(urls[pose], location.href).href) continue;
      const image = new Image();
      image.src = urls[pose];
      image.onload = () => this.changed();
      this.masks.set(pose, image);
      this.ivoryBases.delete(pose);
      this.upperEdgeMasks.delete(pose); // recompute the derived clip masks
      this.paintMasks.delete(pose);
    }
  }

  /** Draw the room reference behind the paper. It is a separate canvas that the
   * paint layers never touch, so the background can be sampled but never
   * painted over and is never part of the published avatar. */
  private loadRoomBackdrop() {
    this.backdropCtx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    this.hasBackdrop = false;
    const backdrop = this.options?.roomBackdrop?.(AVATAR_SIZE);
    if (backdrop) {
      try {
        this.backdropCtx.drawImage(backdrop, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        this.hasBackdrop = true;
      } catch {
        this.hasBackdrop = false;
      }
    }
    this.backdropCanvas.classList.toggle("has-backdrop", this.hasBackdrop);
  }

  /** Sample the room reference at an avatar-space point (eyedropper on a
   * transparent part of the paper). Returns null if there is nothing there. */
  private sampleBackdrop(x: number, y: number): string | null {
    if (!this.hasBackdrop) return null;
    const px = Math.max(0, Math.min(AVATAR_SIZE - 1, Math.floor(x)));
    const py = Math.max(0, Math.min(AVATAR_SIZE - 1, Math.floor(y)));
    let data: Uint8ClampedArray;
    try {
      data = this.backdropCtx.getImageData(px, py, 1, 1).data;
    } catch {
      return null;
    }
    if ((data[3] ?? 0) < 8) return null;
    return `#${[data[0], data[1], data[2]].map(value => (value ?? 0).toString(16).padStart(2, "0")).join("")}`;
  }

  private activePalette(): string[] {
    return this.options ? paintPalette(this.options.room.palette, this.customColors) : ["#ffffff"];
  }

  private buildPalette() {
    this.paletteEl.replaceChildren();
    const palette = this.activePalette();
    palette.forEach((color, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.color = String(index);
      button.title = `${index < (this.options?.room.palette.length ?? 0) ? t("studio.roomSwatch") : t("studio.customSwatch")} · ${color}`;
      button.style.background = color;
      button.addEventListener("click", () => {
        this.selectedColor = index;
        this.colorInput.value = color;
        this.stopInAppEyedropper();
        this.syncButtons();
      });
      this.paletteEl.appendChild(button);
    });
    const selected = palette[this.selectedColor] ?? palette[0];
    if (selected) this.colorInput.value = selected;
  }

  private bind() {
    this.root.querySelectorAll("[data-pose]").forEach(node => node.addEventListener("click", () => {
      this.pose = (node as HTMLElement).dataset.pose as PoseId;
      this.syncButtons();
      this.changed();
    }));
    this.root.querySelectorAll("[data-brush]").forEach(node => node.addEventListener("click", () => {
      this.brush = (node as HTMLElement).dataset.brush as BrushMode;
      this.syncButtons();
    }));
    this.root.querySelectorAll<HTMLElement>("[data-tool-tab]").forEach(node => node.addEventListener("click", () => {
      const next = node.dataset.toolTab as StudioToolTab;
      if (next === "live" && !this.liveEnabled) return;
      this.toolTab = next;
      this.stopInAppEyedropper();
      this.syncButtons();
    }));
    this.root.querySelectorAll<HTMLElement>("[data-live-brush]").forEach(node => node.addEventListener("click", () => {
      const brush = node.dataset.liveBrush as LiveBrushId;
      if (LIVE_BRUSH_IDS.includes(brush)) this.liveBrush = brush;
      this.emitLiveChange();
      this.syncButtons();
    }));
    this.liveToggle.addEventListener("click", () => {
      if (!this.options?.room.livePainting) return;
      this.liveEnabled = !this.liveEnabled;
      if (!this.liveEnabled) {
        this.toolTab = "paint";
        this.releaseLiveRenderer();
      }
      else this.liveStartedAt = performance.now();
      this.emitLiveChange();
      this.syncButtons();
      this.changed();
      this.syncLiveLoop();
    });
    this.liveSizeInput.addEventListener("input", () => {
      this.liveSize = Math.round(Math.max(LIVE_SIZE_MIN, Math.min(LIVE_TOOL_SIZE_MAX, Number(this.liveSizeInput.value))));
      this.emitLiveChange();
      this.syncButtons();
    });
    this.liveFlowInput.addEventListener("input", () => {
      this.liveFlow = Math.round(Math.max(LIVE_FLOW_MIN, Math.min(LIVE_FLOW_MAX, Number(this.liveFlowInput.value))));
      this.emitLiveChange();
      this.syncButtons();
    });
    this.liveStrengthInput.addEventListener("input", () => {
      this.liveStrength = Math.round(Math.max(LIVE_STRENGTH_MIN, Math.min(LIVE_STRENGTH_MAX, Number(this.liveStrengthInput.value))));
      this.emitLiveChange();
      this.syncButtons();
      this.renderDisplay(performance.now());
    });
    this.liveUndoButton.addEventListener("click", () => {
      const previous = this.liveUndoStack.pop();
      if (!previous) return;
      this.liveMarks = previous;
      this.emitLiveChange();
      this.syncButtons();
      this.renderDisplay(performance.now());
    });
    this.liveClearButton.addEventListener("click", () => {
      if (!this.liveMarks.length) return;
      this.liveUndoStack.push([...this.liveMarks]);
      if (this.liveUndoStack.length > PaintStudio.MAX_UNDO_STROKES) this.liveUndoStack.shift();
      this.liveMarks = [];
      this.emitLiveChange();
      this.syncButtons();
      this.renderDisplay(performance.now());
    });
    this.camoButton.addEventListener("click", () => this.toggleDefaultCamo());
    this.eyedropperButton.addEventListener("click", () => void this.activateEyedropper());
    this.colorInput.addEventListener("change", () => this.selectColor(this.colorInput.value, true));
    this.sizeInput.addEventListener("input", () => this.refreshBrushCursor());
    this.root.querySelector("[data-undo]")!.addEventListener("click", () => {
      const previous = this.undoStack.pop();
      if (!previous) return;
      this.userCtx.putImageData(previous, 0, 0);
      this.changed();
    });
    this.root.querySelector("[data-clear]")!.addEventListener("click", () => {
      this.camoCtx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
      this.userCtx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
      this.camoEnabled = false;
      this.undoStack = [];
      this.options?.onCamoChange(false);
      this.syncButtons();
      this.changed();
    });
    this.root.querySelector(".paint-leave")!.addEventListener("click", () => this.options?.onLeave());
    this.root.querySelector(".paint-close")!.addEventListener("click", () => this.close());
    this.root.querySelector(".paint-back")!.addEventListener("click", () => this.close());
    this.root.querySelector(".paint-lock")!.addEventListener("click", () => this.submitLock());
    this.canvas.addEventListener("pointerdown", event => {
      this.updateBrushCursor(event);
      this.pointerDown(event);
    });
    this.canvas.addEventListener("pointermove", event => {
      this.updateBrushCursor(event);
      this.pointerMove(event);
    });
    this.canvas.addEventListener("pointerenter", event => this.updateBrushCursor(event));
    this.canvas.addEventListener("pointerleave", () => this.hideBrushCursor());
    this.canvas.addEventListener("pointerup", event => this.pointerUp(event));
    this.canvas.addEventListener("pointercancel", event => this.pointerUp(event));
  }

  private submitLock() {
    if (!this.options || this.lockSubmitted) return;
    if (!this.render()) {
      this.status.textContent = t("studio.maskLoading");
      this.status.className = "bad";
      return;
    }
    this.lockSubmitted = true;
    this.options.onLock(this.pose, this.staticCanvas);
    this.close();
  }

  private toggleDefaultCamo() {
    if (!this.options) return;
    // The toggle shows/hides full-body camo. The camo layer itself stays
    // painted so the unpaintable upper silhouette edge always keeps it.
    this.camoEnabled = !this.camoEnabled;
    this.options.onCamoChange(this.camoEnabled);
    this.syncButtons();
    this.changed();
  }

  private paintDefaultCamo() {
    if (!this.options) return;
    const palette = this.activePalette();
    const marks = sanitizePaintMarks(makeRoomCamoMarks(this.options.room), palette.length);
    drawPaintMarks(this.camoCtx, marks, palette);
  }

  private async activateEyedropper() {
    this.stopInAppEyedropper();
    if (this.prefersInAppEyedropper()) {
      this.startInAppEyedropper(t("studio.tapPick"));
      return;
    }
    const EyeDropperClass = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (EyeDropperClass) {
      try {
        this.status.textContent = t("studio.pickAny");
        const result = await new EyeDropperClass().open();
        this.selectColor(result.sRGBHex);
        this.status.textContent = t("studio.picked", { color: result.sRGBHex.toLowerCase() });
        this.status.className = "ok";
      } catch {
        // Safari, Firefox, embedded browsers and iPad do not expose the
        // system-wide EyeDropper API. Keep an in-game sampler available.
        this.startInAppEyedropper(t("studio.systemPickerFallback"));
      }
      return;
    }
    this.startInAppEyedropper(t("studio.tapPick"));
  }

  /** iPad browsers all use WebKit, regardless of their App Store name. Touch
   * devices and Safari therefore get the predictable in-game picker instead
   * of an absent or awkward system picker. */
  private prefersInAppEyedropper(): boolean {
    const coarsePointer = typeof matchMedia === "function" && matchMedia("(any-pointer: coarse)").matches;
    const touchDevice = navigator.maxTouchPoints > 0;
    const ua = navigator.userAgent;
    const desktopSafari = /Safari/i.test(ua) && !/(Chrome|Chromium|CriOS|Edg|OPR|Android)/i.test(ua);
    return coarsePointer || touchDevice || desktopSafari;
  }

  private startInAppEyedropper(message: string) {
    if (this.eyedropperFlashTimer !== null) window.clearTimeout(this.eyedropperFlashTimer);
    this.eyedropperFlashTimer = null;
    this.eyedropperIndicator.classList.remove("picked");
    this.eyedropper = true;
    this.hideBrushCursor();
    this.eyedropperSampling = false;
    document.body.classList.add("chameleon-eyedropper");
    document.addEventListener("pointerdown", this.roomSamplePointerDown, true);
    document.addEventListener("pointermove", this.roomSamplePointerMove, true);
    this.status.textContent = message;
    this.status.className = "ok";
    this.syncButtons();
  }

  private stopInAppEyedropper() {
    document.removeEventListener("pointerdown", this.roomSamplePointerDown, true);
    document.removeEventListener("pointermove", this.roomSamplePointerMove, true);
    document.body.classList.remove("chameleon-eyedropper");
    this.eyedropperIndicator.classList.remove("visible", "picked");
    this.eyedropper = false;
    this.eyedropperSampling = false;
  }

  private showEyedropperIndicator(clientX: number, clientY: number) {
    this.eyedropperIndicator.style.left = `${clientX}px`;
    this.eyedropperIndicator.style.top = `${clientY}px`;
    this.eyedropperIndicator.classList.add("visible");
  }

  private flashEyedropperIndicator() {
    this.eyedropperIndicator.classList.remove("picked");
    void this.eyedropperIndicator.offsetWidth;
    this.eyedropperIndicator.classList.add("picked");
    this.eyedropperFlashTimer = window.setTimeout(() => {
      this.eyedropperIndicator.classList.remove("picked");
      this.eyedropperFlashTimer = null;
    }, 240);
  }

  private async sampleRoomAt(clientX: number, clientY: number) {
    if (this.eyedropperSampling) return;
    this.eyedropperSampling = true;
    this.status.textContent = t("studio.sampling");
    try {
      const color = await this.options?.sampleRoomColor?.(clientX, clientY);
      if (!this.eyedropper) return;
      if (!color) {
        this.status.textContent = t("studio.noRoomPixel");
        this.status.className = "bad";
        return;
      }
      this.selectColor(color);
      this.status.textContent = t("studio.picked", { color: color.toLowerCase() });
      this.status.className = "ok";
    } catch {
      if (this.eyedropper) {
        this.status.textContent = t("studio.sampleFailed");
        this.status.className = "bad";
      }
    } finally {
      this.eyedropperSampling = false;
    }
  }

  private selectColor(raw: string, replaceCustom = false) {
    if (!this.options || !/^#[0-9a-f]{6}$/i.test(raw)) return;
    const showInAppFeedback = this.eyedropper && this.eyedropperIndicator.classList.contains("visible");
    const color = raw.toLowerCase();
    let palette = this.activePalette();
    let index = palette.findIndex(entry => entry.toLowerCase() === color);
    const roomIndex = this.options.room.palette.findIndex(entry => entry.toLowerCase() === color);
    if (replaceCustom && roomIndex < 0) {
      // The native Full color input owns exactly one custom swatch. Changing
      // the picker updates that swatch instead of appending another button.
      this.customColors = sanitizeCustomPaintColors([color], this.options.room.palette);
      palette = this.activePalette();
      index = this.options.room.palette.length;
    } else if (index < 0) {
      const next = sanitizeCustomPaintColors([...this.customColors, color], this.options.room.palette);
      if (next.length > this.customColors.length) {
        this.customColors = next;
        palette = this.activePalette();
        index = palette.length - 1;
      } else {
        index = this.nearestColorIndex(color, palette);
        this.status.textContent = t("studio.paletteFull", { color: palette[index] });
        this.status.className = "bad";
      }
    }
    this.selectedColor = Math.max(0, Math.min(MAX_PAINT_COLORS - 1, index));
    this.colorInput.value = palette[this.selectedColor] ?? color;
    this.stopInAppEyedropper();
    if (showInAppFeedback) this.flashEyedropperIndicator();
    this.buildPalette();
    this.syncButtons();
    this.changed();
  }

  private nearestColorIndex(color: string, palette: readonly string[]): number {
    const rgb = (hex: string) => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));
    const target = rgb(color);
    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    palette.forEach((candidate, index) => {
      const value = rgb(candidate);
      const distance = value.reduce((sum, channel, at) => sum + (channel - target[at]) ** 2, 0);
      if (distance < best) { best = distance; nearest = index; }
    });
    return nearest;
  }

  private pointerDown(event: PointerEvent) {
    if (this.eyedropper) {
      this.showEyedropperIndicator(event.clientX, event.clientY);
      const at = this.canvasPoint(event);
      let pixel: Uint8ClampedArray;
      try {
        pixel = this.ctx.getImageData(
          Math.max(0, Math.min(AVATAR_SIZE - 1, Math.floor(at.x))),
          Math.max(0, Math.min(AVATAR_SIZE - 1, Math.floor(at.y))),
          1,
          1,
        ).data;
      } catch {
        this.status.textContent = t("studio.canvasSampleFailed");
        this.status.className = "bad";
        return;
      }
      if (pixel[3] < 16) {
        // Transparent paper: fall through to the room reference behind it, so
        // the eyedropper picks room colors directly on the canvas.
        const roomColor = this.sampleBackdrop(at.x, at.y);
        if (roomColor) {
          this.selectColor(roomColor);
          this.status.textContent = t("studio.pickedFromRoom", { color: roomColor });
          this.status.className = "ok";
        } else {
          this.status.textContent = t("studio.transparentPixel");
          this.status.className = "bad";
        }
      } else {
        const hex = `#${[pixel[0], pixel[1], pixel[2]].map(value => value.toString(16).padStart(2, "0")).join("")}`;
        this.selectColor(hex);
        this.status.textContent = t("studio.picked", { color: hex });
        this.status.className = "ok";
      }
      return;
    }
    if (this.toolTab === "live") {
      if (!this.liveEnabled || this.liveMarks.length >= MAX_LIVE_PAINT_MARKS) return;
      event.preventDefault();
      this.liveDrawing = true;
      this.liveLastPoint = null;
      this.liveUndoStack.push([...this.liveMarks]);
      if (this.liveUndoStack.length > PaintStudio.MAX_UNDO_STROKES) this.liveUndoStack.shift();
      try { this.canvas.setPointerCapture(event.pointerId); } catch { /* synthetic pointer */ }
      this.paintLiveTo(this.canvasPoint(event));
      // Live draw-calm: keep pointer capture and mark generation responsive.
      // The animated force resumes once on lift with the complete stroke.
      this.renderDisplay(performance.now());
      return;
    }
    this.drawing = true;
    this.strokeCalm = true;
    this.undoStack.push(this.userCtx.getImageData(0, 0, AVATAR_SIZE, AVATAR_SIZE));
    if (this.undoStack.length > PaintStudio.MAX_UNDO_STROKES) this.undoStack.shift();
    this.pointIndex = 0;
    this.strokeStartedAt = performance.now();
    this.strokeSeed = Math.random();
    const point = this.canvasPoint(event);
    this.previous = { ...point, time: performance.now() };
    this.pendingSample = null;
    try { this.canvas.setPointerCapture(event.pointerId); } catch { /* synthetic pointer */ }
    this.enqueuePaint({ ...point, pressure: event.pressure > 0 ? event.pressure : 0.5 });
  }

  private pointerMove(event: PointerEvent) {
    if (this.liveDrawing) {
      event.preventDefault();
      this.paintLiveTo(this.canvasPoint(event));
      return;
    }
    if (!this.drawing) return;
    const point = this.canvasPoint(event);
    this.enqueuePaint({ ...point, pressure: event.pressure > 0 ? event.pressure : 0.5 });
  }

  private pointerUp(event?: PointerEvent) {
    const endedLiveStroke = this.liveDrawing;
    const endedPaintStroke = this.drawing;
    this.drawing = false;
    this.liveDrawing = false;
    this.liveLastPoint = null;
    this.pendingSample = null;
    this.strokeCalm = false;
    if (event?.pointerType && event.pointerType !== "mouse") this.hideBrushCursor();
    if (endedLiveStroke) {
      // The stroke's marks reach the draft + the room preview once, on lift.
      this.emitLiveChange();
      this.syncButtons();
      this.liveLastFrameAt = 0;
      this.renderDisplay(performance.now());
    }
    // The paint stroke syncs once on lift too (room preview, canvas copy,
    // live resample). If the coalescing queue is still draining, its tail
    // fires the same sync instead.
    if (endedPaintStroke && !this.paintBusy) this.changed();
  }

  /** Add a spatial live-brush stroke. The pointer arrives in the studio's
   * 192px avatar space and is converted here to the canonical 256px live-mark
   * space (LIVE_MARK_SPACE) that the renderers and API expect — storing the
   * raw 192-space point would land every dab up-left of the cursor.
   * Flow controls both pigment density and dab spacing; the force dial
   * (quiet→live) only retimes the animation. The runtime clips the animated
   * layer to the avatar, so a loose touch stroke can safely cross the
   * silhouette without adding per-pointer pixel reads. */
  private paintLiveTo(avatarPoint: { x: number; y: number }): void {
    if (!this.options || !this.liveEnabled || this.toolTab !== "live") return;
    const toMarkSpace = LIVE_MARK_SPACE / AVATAR_SIZE;
    const point = { x: avatarPoint.x * toMarkSpace, y: avatarPoint.y * toMarkSpace };
    const from = this.liveLastPoint ?? point;
    const dx = point.x - from.x;
    const dy = point.y - from.y;
    const distance = Math.hypot(dx, dy);
    const flowRatio = this.liveFlow / LIVE_FLOW_MAX;
    // Exact half-scale equivalent of the approved 512px 6A study.
    const spacing = Math.max(1.5, this.liveSize * (0.5 - flowRatio * 0.35));
    const steps = this.liveLastPoint ? Math.max(1, Math.ceil(distance / spacing)) : 1;
    let changed = false;
    const brushScale: Readonly<Record<LiveBrushId, number>> = {
      "blue-current": .9,
      "liquid-color": 1,
      "graphite-whisper": .72,
      "firefly": .62,
      "growth": .9,
      "color-liquify-splash": 1,
    };

    for (let step = 1; step <= steps && this.liveMarks.length < MAX_LIVE_PAINT_MARKS; step += 1) {
      const mix = steps === 1 ? 1 : step / steps;
      const sourceSeed = Math.random();
      const sizeJitter = liveHash(sourceSeed * 877);
      const phaseSeed = liveHash(sourceSeed * 911);
      const angleSeed = liveHash(sourceSeed * 947);
      const strokeAngle = distance > .001 ? Math.atan2(dy, dx) : 0;
      // Directional forces follow the gesture. Firefly keeps a loose organic
      // angle because its movement path is derived from the deterministic seed.
      const directional = this.liveBrush === "blue-current"
        || this.liveBrush === "graphite-whisper"
        || this.liveBrush === "growth"
        || this.liveBrush === "color-liquify-splash";
      const rawAngle = directional
        ? strokeAngle + (angleSeed - .5) * .14
        : (angleSeed - .5) * 1.5;
      this.liveMarks.push({
        brush: this.liveBrush,
        x: Math.round(Math.max(0, Math.min(LIVE_MARK_SPACE, from.x + dx * mix))),
        y: Math.round(Math.max(0, Math.min(LIVE_MARK_SPACE, from.y + dy * mix))),
        size: Math.round(Math.max(LIVE_SIZE_MIN, Math.min(
          LIVE_SIZE_MAX,
          this.liveSize * brushScale[this.liveBrush] * (.86 + sizeJitter * .28),
        ))),
        flow: this.liveFlow,
        seed: Math.round(phaseSeed * 65_535),
        // Wrap into [-pi, pi]: a right-to-left gesture sits at ±pi and the
        // jitter can step past it, which the API rejects.
        angle: Math.atan2(Math.sin(rawAngle), Math.cos(rawAngle)),
      });
      changed = true;
    }
    this.liveLastPoint = point;
    if (!changed) return;
    // Draw-calm (Art Lab's iPad fix): a 120Hz pencil firing full renders,
    // DOM sync and a whole-room repaint per move is exactly what stuttered
    // there. Mid-stroke we only hand the fresh marks to the 30fps loop and
    // touch one text node; emitLiveChange + syncButtons run once on lift.
    this.liveConfig = { marks: this.liveMarks, strength: this.liveStrength };
    this.liveStats.textContent = t("studio.liveStats", { count: this.liveMarks.length, max: MAX_LIVE_PAINT_MARKS });
  }

  private enqueuePaint(sample: PointerSample) {
    if (this.paintBusy) {
      // Coalesce high-frequency Pointer Events so a fast touch gesture does
      // not generate hundreds of nearly identical paint marks.
      this.pendingSample = sample;
      return;
    }
    void this.drainPaint(sample);
  }

  private async drainPaint(first: PointerSample) {
    this.paintBusy = true;
    let sample: PointerSample | null = first;
    while (sample && this.drawing) {
      await this.paintPoint(sample);
      sample = this.pendingSample;
      this.pendingSample = null;
    }
    this.paintBusy = false;
    // The pointer lifted while we were still draining: run the once-per-
    // stroke sync that pointerUp skipped.
    if (!this.drawing && this.strokeCalm === false && this.options) this.changed();
  }

  private async paintPoint(at: PointerSample) {
    if (!this.options) return;
    const now = performance.now();
    const dt = Math.max(1, now - this.previous.time);
    const dx = at.x - this.previous.x;
    const dy = at.y - this.previous.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (this.pointIndex > 0 && distance < 2.4 && dt < 24) return;
    const point = {
      x: at.x,
      y: at.y,
      pressure: at.pressure,
      speed: distance / (dt / 1000),
      angle: dx || dy ? Math.atan2(dy, dx) : 0,
      index: this.pointIndex++,
    };
    const raw: unknown = this.manualMarks(point);
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const defaults = this.options.room.defaultShape;
    const candidates = list.slice(0, MAX_MARKS_PER_BRUSH_POINT).map(value => {
      const mark = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
      return {
        x: Number.isFinite(mark.x) ? mark.x : point.x,
        y: Number.isFinite(mark.y) ? mark.y : point.y,
        size: Number.isFinite(mark.size) ? mark.size : Number(this.sizeInput.value),
        angle: Number.isFinite(mark.angle) ? mark.angle : point.angle,
        alpha: Number.isFinite(mark.alpha) ? mark.alpha : 0.8,
        soft: Number.isFinite(mark.soft) ? mark.soft : 0.55,
        colorIndex: Number.isFinite(mark.colorIndex) ? mark.colorIndex : this.selectedColor,
        shape: PAINT_SHAPES.includes(mark.shape as PaintShape) ? mark.shape : defaults,
      };
    });
    const roomMarks = sanitizePaintMarks(candidates, this.activePalette().length);
    drawPaintMarks(this.userCtx, roomMarks, this.activePalette());
    this.previous = { ...at, time: now };
    this.strokeChanged();
  }

  private manualMarks(point: { x: number; y: number; pressure: number; angle: number }) {
    const size = Number(this.sizeInput.value) * (0.75 + point.pressure * 0.5);
    if (this.brush === "streak") {
      return { ...point, size: size * 1.35, alpha: 0.92, soft: 0.12, colorIndex: this.selectedColor, shape: "streak" };
    }
    if (this.brush === "point") {
      return { ...point, size: size * 0.46, alpha: 0.9, soft: 0.18, colorIndex: this.selectedColor, shape: "dot" };
    }
    if (this.brush === "impasto") {
      return [-1, 0, 1].map(offset => ({
        ...point,
        x: point.x + Math.sin(point.angle) * offset * size * 0.16,
        y: point.y - Math.cos(point.angle) * offset * size * 0.16,
        size: size * (1.15 - Math.abs(offset) * 0.12),
        angle: point.angle + offset * 0.09,
        alpha: 0.72,
        soft: 0.08,
        colorIndex: this.selectedColor,
        shape: "streak",
      }));
    }
    if (this.brush === "wash") {
      return [0, 1].map(offset => ({
        ...point,
        x: point.x + (Math.random() - 0.5) * size * 0.3,
        y: point.y + (Math.random() - 0.5) * size * 0.3,
        size: size * (1.9 + offset * 0.3),
        alpha: 0.2,
        soft: 1,
        colorIndex: this.selectedColor,
        shape: "dot",
      }));
    }
    if (this.brush === "block") {
      return { ...point, size, angle: Math.round(point.angle / (Math.PI / 4)) * (Math.PI / 4), alpha: 0.82, soft: 0, colorIndex: this.selectedColor, shape: "square" };
    }
    return [0, 1].map(() => {
      const angle = Math.random() * Math.PI * 2;
      const wander = Math.random() * size * 0.23;
      return {
        x: point.x + Math.cos(angle) * wander,
        y: point.y + Math.sin(angle) * wander,
        size: size * (0.65 + Math.random() * 0.5),
        angle,
        alpha: 0.5,
        soft: 0.88,
        colorIndex: this.selectedColor,
        shape: "dot",
      };
    });
  }

  private canvasPoint(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (AVATAR_SIZE / rect.width),
      y: (event.clientY - rect.top) * (AVATAR_SIZE / rect.height),
    };
  }

  /** Art Lab brush cursor: the ring is centered on the real pointer and its
   * diameter is the authored brush size after canvas CSS scaling. */
  private updateBrushCursor(event: PointerEvent): void {
    this.brushCursorAt = { x: event.clientX, y: event.clientY };
    this.refreshBrushCursor();
  }

  private refreshBrushCursor(): void {
    if (!this.brushCursorAt || !this.isOpen || this.eyedropper) {
      this.brushCursor.classList.add("hidden");
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0) return;
    // Live sizes are authored in the 256px live-mark space; static paint sizes
    // in the 192px avatar space. Convert from the matching space so the ring
    // matches what the stroke will actually cover.
    const authoredSize = this.toolTab === "live" ? this.liveSize : Number(this.sizeInput.value);
    const authoredSpace = this.toolTab === "live" ? LIVE_MARK_SPACE : AVATAR_SIZE;
    const diameter = Math.max(6, authoredSize * (rect.width / authoredSpace));
    this.brushCursor.style.setProperty("--paint-brush-size", `${diameter}px`);
    this.brushCursor.style.left = `${this.brushCursorAt.x}px`;
    this.brushCursor.style.top = `${this.brushCursorAt.y}px`;
    this.brushCursor.classList.toggle("live", this.toolTab === "live");
    if (this.toolTab === "paint") {
      const color = this.activePalette()[this.selectedColor] ?? "#0f8f88";
      this.brushCursor.style.borderColor = color;
      const rgb = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/iu.exec(color);
      this.brushCursor.style.backgroundColor = rgb
        ? `rgba(${parseInt(rgb[1], 16)}, ${parseInt(rgb[2], 16)}, ${parseInt(rgb[3], 16)}, .09)`
        : "rgba(15, 143, 136, .08)";
    } else {
      this.brushCursor.style.borderColor = "";
      this.brushCursor.style.backgroundColor = "";
    }
    this.brushCursor.classList.remove("hidden");
  }

  private hideBrushCursor(): void {
    this.brushCursorAt = null;
    this.brushCursor.classList.add("hidden");
  }

  private syncButtons() {
    this.root.querySelectorAll("[data-pose]").forEach(node => node.classList.toggle("active", (node as HTMLElement).dataset.pose === this.pose));
    this.root.querySelectorAll("[data-brush]").forEach(node => node.classList.toggle("active", (node as HTMLElement).dataset.brush === this.brush));
    this.paletteEl.querySelectorAll("button").forEach((node, index) => node.classList.toggle("active", index === this.selectedColor));
    this.eyedropperButton.classList.toggle("active", this.eyedropper);
    this.root.querySelectorAll<HTMLElement>("[data-tool-tab]").forEach(node => {
      const active = node.dataset.toolTab === this.toolTab;
      node.classList.toggle("active", active);
      node.setAttribute("aria-selected", String(active));
    });
    this.root.querySelectorAll<HTMLElement>("[data-live-brush]").forEach(node => {
      const brush = node.dataset.liveBrush as LiveBrushId;
      node.hidden = !this.options || !liveBrushesForRoom(this.options.room).includes(brush);
      node.classList.toggle("active", brush === this.liveBrush);
    });
    const liveAvailable = Boolean(this.options?.room.livePainting);
    this.liveToggle.hidden = !liveAvailable;
    this.liveToggle.classList.toggle("active", this.liveEnabled);
    this.liveToggle.setAttribute("aria-pressed", String(this.liveEnabled));
    this.liveToggle.textContent = `${this.liveEnabled ? "●" : "○"} ${t("studio.liveToggle")}`;
    this.liveTabButton.hidden = !this.liveEnabled;
    this.paintTabPanel.hidden = this.toolTab !== "paint";
    this.liveTabPanel.hidden = !this.liveEnabled || this.toolTab !== "live";
    this.liveSizeInput.value = String(this.liveSize);
    this.liveFlowInput.value = String(this.liveFlow);
    this.liveStrengthInput.value = String(this.liveStrength);
    this.liveStats.textContent = t("studio.liveStats", { count: this.liveMarks.length, max: MAX_LIVE_PAINT_MARKS });
    this.liveUndoButton.disabled = this.liveUndoStack.length === 0;
    this.liveClearButton.disabled = this.liveMarks.length === 0;
    const camoActive = this.camoEnabled;
    this.camoButton.classList.toggle("active", camoActive);
    const label = this.options ? t(ROOM_MESSAGES[this.options.room.id].camo) : "";
    this.camoButton.textContent = `${label} · ${camoActive ? t("studio.on") : t("studio.off")}`;
    this.refreshBrushCursor();
  }

  /** Mid-stroke repaint: composite + stats only. The room preview, the
   * canvas copy and the live resample all wait for the lift (draw-calm). */
  private strokeChanged() {
    if (!this.render()) return;
    this.paintStats.textContent = t("studio.stats", { count: this.undoStack.length, max: PaintStudio.MAX_UNDO_STROKES });
  }

  private changed() {
    if (!this.render()) return;
    this.paintStats.textContent = t("studio.stats", { count: this.undoStack.length, max: PaintStudio.MAX_UNDO_STROKES });
    // Static paint remains flattened. Bounded live marks are persisted through
    // the separate live-painting contract and never baked into this canvas.
    this.options?.onPreview(this.pose, this.staticCanvas, [...this.customColors]);
  }

  private render(): boolean {
    const image = this.masks.get(this.pose);
    if (!image?.complete || !image.naturalWidth || !this.options) return false;
    const S = AVATAR_SIZE;
    const ctx = this.staticCtx;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    // Starter camo uses the neutral ivory base so room pigment is not mixed
    // with the authored teal/orange markings. Turning camo off must restore the
    // complete original chameleon, not leave the ivory body plus its eye.
    const base = this.camoEnabled ? this.ivoryBaseFor(this.pose, image) : image;
    ctx.drawImage(base, 0, 0, S, S);
    ctx.globalCompositeOperation = "source-atop";
    // Starter camo (toggleable) covers the complete body, including the eye.
    if (this.camoEnabled) ctx.drawImage(this.camoLayer, 0, 0, S, S);
    if (this.liveEnabled) {
      // Live Painting is a full-body mode: the force may move every painted
      // pixel, so the ordinary protected upper rim is deliberately absent.
      ctx.drawImage(this.userLayer, 0, 0, S, S);
    } else {
      // Ordinary paint is blocked only by the upper silhouette rim. The lower
      // rim and every part of the eye remain paintable.
      ctx.drawImage(this.clipToMask(this.userLayer, this.paintMaskFor(this.pose, image)), 0, 0, S, S);
      // With starter camo off, the protected upper rim remains the authored
      // original from the base image rather than retaining room-colored camo.
    }
    ctx.restore();
    this.liveRenderer?.invalidateSource();
    this.renderDisplay(performance.now());
    return true;
  }

  private renderDisplay(now: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    // strokeCalm: while the hand is down the forces freeze and the raw
    // painting shows directly — no per-point 256px resample + live pass.
    if (!this.options
      || !this.liveEnabled
      || this.strokeCalm
      || this.liveDrawing
      || this.movementCalm) {
      ctx.drawImage(this.staticCanvas, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      return;
    }
    const source = this.getLiveRenderer().render(
      this.staticCanvas,
      this.liveConfig,
      Math.max(0, now - this.liveStartedAt) / 1_000,
    );
    ctx.drawImage(source, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  }

  private emitLiveChange(): void {
    if (!this.options) return;
    this.liveConfig = { marks: [...this.liveMarks], strength: this.liveStrength };
    this.options.onLiveChange(this.liveEnabled
      ? this.liveConfig
      : null,
    { brush: this.liveBrush, size: this.liveSize, flow: this.liveFlow, strength: this.liveStrength });
  }

  private readonly animateLive = (now: number): void => {
    this.liveFrame = 0;
    if (!this.isOpen || !this.liveEnabled) return;
    if (!this.strokeCalm
      && !this.liveDrawing
      && !this.movementCalm
      && now - this.liveLastFrameAt >= 1000 / 30) {
      this.liveLastFrameAt = now;
      this.renderDisplay(now);
    }
    this.liveFrame = requestAnimationFrame(this.animateLive);
  };

  private syncLiveLoop(): void {
    if (!this.isOpen || !this.liveEnabled) {
      if (this.liveFrame) cancelAnimationFrame(this.liveFrame);
      this.liveFrame = 0;
      return;
    }
    if (!this.liveFrame) this.liveFrame = requestAnimationFrame(this.animateLive);
  }

  private ivoryBaseFor(pose: PoseId, image: HTMLImageElement): HTMLCanvasElement {
    const cached = this.ivoryBases.get(pose);
    if (cached) return cached;
    const ivory = makeIvoryAvatar(image, pose, AVATAR_SIZE);
    this.ivoryBases.set(pose, ivory);
    return ivory;
  }

  /** Where user paint may land: the full silhouette minus the upper half of
   * its outermost 1px rim. The mask is derived once per decoded pose. */
  private paintMaskFor(pose: PoseId, image: HTMLImageElement): HTMLCanvasElement {
    const cached = this.paintMasks.get(pose);
    if (cached) return cached;
    const S = AVATAR_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = S;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0, S, S);
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(this.upperEdgeMaskFor(pose, image), 0, 0, S, S);
    ctx.globalCompositeOperation = "source-over";
    this.paintMasks.set(pose, canvas);
    return canvas;
  }

  /** The upper half of the outermost 1px silhouette. It always shows room camo
   * and is the only part user paint cannot cover. */
  private upperEdgeMaskFor(pose: PoseId, image: HTMLImageElement): HTMLCanvasElement {
    const cached = this.upperEdgeMasks.get(pose);
    if (cached) return cached;
    const S = AVATAR_SIZE;
    const full = document.createElement("canvas");
    full.width = full.height = S;
    const fullCtx = full.getContext("2d", { willReadFrequently: true })!;
    fullCtx.drawImage(image, 0, 0, S, S);

    // Measure the authored alpha bounds so "upper half" follows each pose,
    // rather than assuming the character fills the square canvas.
    const alpha = fullCtx.getImageData(0, 0, S, S).data;
    let minY = S;
    let maxY = 0;
    for (let y = 0; y < S; y += 1) {
      for (let x = 0; x < S; x += 1) {
        if ((alpha[(y * S + x) * 4 + 3] ?? 0) < 16) continue;
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    const upperCutoff = minY <= maxY ? Math.round((minY + maxY) / 2) : S / 2;

    const inner = document.createElement("canvas");
    inner.width = inner.height = S;
    const innerCtx = inner.getContext("2d")!;
    innerCtx.drawImage(image, 0, 0, S, S);
    innerCtx.globalCompositeOperation = "destination-in";
    const d = SILHOUETTE_PX;
    for (const [dx, dy] of [[-d, 0], [d, 0], [0, -d], [0, d], [-d, -d], [d, -d], [-d, d], [d, d]]) {
      innerCtx.drawImage(image, dx, dy, S, S);
    }

    const edge = document.createElement("canvas");
    edge.width = edge.height = S;
    const edgeCtx = edge.getContext("2d")!;
    edgeCtx.drawImage(full, 0, 0);
    edgeCtx.globalCompositeOperation = "destination-out";
    edgeCtx.drawImage(inner, 0, 0);
    edgeCtx.globalCompositeOperation = "source-over";
    edgeCtx.clearRect(0, upperCutoff + 1, S, S - upperCutoff - 1);
    this.upperEdgeMasks.set(pose, edge);
    return edge;
  }

  /** Copy `src` into the scratch layer and keep it inside `mask`. */
  private clipToMask(src: CanvasImageSource, mask: CanvasImageSource): HTMLCanvasElement {
    const S = AVATAR_SIZE;
    const ctx = this.scratchCtx;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(src, 0, 0, S, S);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask, 0, 0, S, S);
    ctx.globalCompositeOperation = "source-over";
    return this.scratchLayer;
  }
}
