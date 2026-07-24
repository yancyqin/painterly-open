import {
  activeProps,
  actorCanStandAt,
  AVATAR_URLS,
  portalsFor,
  PROP_SPECS,
  propUrl,
  roomUrl,
  spawnsFor,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "./gameData";
import { LiveAvatarRenderer, normalizeLivePaintingConfig } from "./livePainting";
import {
  CuratedLiveRoomRenderer,
  curatedLiveBaseSurface,
  curatedLiveProjectFor,
  ensureCuratedLiveProject,
  supportsCuratedLiveProject,
} from "./curatedLivePainting";
import type { ArtHouseId, ChallengePayloadV1, LivePaintingConfig, PoseId, PropInstance } from "./types";
import {
  BASE_MOVE_SPEED,
  INSPECTION_SOURCE_HEIGHT,
  INSPECTION_SOURCE_WIDTH,
  inspectionCardHit,
  inspectionSource,
} from "./interaction.js";

type SceneMode = "hider" | "seeker";
type InspectionHandler = (x: number, y: number, hit: boolean) => void;

// Hider Close Look crop (16:9), zoomed in on the painted chameleon so the blend
// is easy to judge on a small phone screen — but wide enough to show the whole
// body incl. the feet (the avatar spans ~100px around this.target; a tighter
// crop clipped the feet).

const HIDER_INSPECTION_WIDTH = 208;
const HIDER_INSPECTION_HEIGHT = 117;
type RoomIndex = 0 | 1 | 2;
type RoomChangeHandler = (roomIndex: RoomIndex) => void;
type LoadingChangeHandler = (loading: boolean, immediate: boolean) => void;

// --- On-canvas play UI ("everything on canvas") ---------------------------
// All HUD/controls are drawn in the same 960×640 design space as the room, so
// they scale with the canvas. Pointer events map client→960×640 (clientPoint)
// and hit-test the regions below. Enabled per-scene via enablePlayUi().
type PlayPhase = "ready" | "playing" | "result";
interface HudState {
  roomName: string;
  meta: string;      // seeker: expiry ("14h 50m")
  timer: string;     // "" hides the timer chip
  timerLow: boolean;
  triesLeft: number;
  triesTotal: number; // 0 hides the pips
  stats: string;      // pre-formatted, localized; "\n" starts another HUD line
  hint: string;
  liveAvailable: boolean; // hider: room supports Live Painting
  liveEnabled: boolean;   // hider: pulse-dot Live control state
  paintVisited: boolean;  // hider: Studio has been opened for this draft
  hideReady: boolean;     // hider: a painted avatar is ready to publish
}
interface PlayResult { title: string; sub: string; actionLabel: string; }
interface PlayCallbacks {
  start?: () => void;
  lobby?: () => void;
  report?: () => void;
  action?: () => void; // result-card action (my turn → / back to lobby →)
  home?: () => void;        // on-canvas wordmark → home
  paint?: () => void;       // hider: open the paint studio
  hide?: () => void;        // hider: publish the challenge
  reroll?: () => void;      // hider: shuffle the room name + look
  live?: () => void;        // hider: toggle Live Painting
}
interface HotRegion { x: number; y: number; w: number; h: number; id: string; }
// Fixed on-canvas joystick (bottom-left) + Close Look card (bottom-right),
// positioned in screen px relative to the camera (see joyPos / drawCloseLook).
const JOY_BASE = 78;
const JOY_KNOB = 34;
const LOOK = { w: 268, h: 150, pad: 20 };
// Owner-gated experiment concluded that removing Close Look did not cure
// Seeker lag. Restore the useful zoom/inspection surface.
const SEEKER_CLOSE_LOOK_ENABLED = true;
// Cap the play loop near 60fps. New phones (ProMotion) drive rAF at 120Hz, and
// walking re-renders the whole scene per rAF frame — 120 full-scene renders/sec
// was the mobile freeze. 62 (not 60) leaves headroom so a plain 60Hz display
// isn't accidentally halved to 30 by frame jitter. The live FX keeps its own
// 30fps rebuild cap on top of this.
const PLAY_FRAME_MS = 1000 / 62;

interface ActorPosition {
  roomIndex: RoomIndex;
  x: number;
  y: number;
}

interface DrawLayer {
  depth: number;
  draw(): void;
}

const imageCache = new Map<string, HTMLImageElement>();

// `onReady` MUST be a stable reference (see GameCanvas.redraw). While an image
// loads, render() runs every animation frame during movement; a fresh closure
// each call would stack a new load listener per frame, and when the image
// finally decoded every stacked listener fired a full re-render — an
// exponential cascade that froze the second room. A stable listener + { once }
// dedupes to a single pending redraw per image.
function cachedImage(url: string, onReady: () => void): HTMLImageElement {
  let image = imageCache.get(url);
  if (!image) {
    image = new Image();
    image.decoding = "async";
    image.src = url;
    imageCache.set(url, image);
  }
  if (!image.complete) image.addEventListener("load", onReady, { once: true });
  return image;
}

export class GameCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly mode: SceneMode;
  private artHouse: ArtHouseId = "van-gogh-house";
  private roomIndex: 0 | 1 | 2 = 0;
  private surface: 0 | 1 | 2 = 0;
  private artSeed = 0;
  private target = { roomIndex: 0 as 0 | 1 | 2, x: 520, y: 470 };
  private explorer: ActorPosition = { roomIndex: 0, x: 150, y: 520 };
  private pose: PoseId = "stand";
  private avatarSource: CanvasImageSource | null = null;
  private avatarUrl = AVATAR_URLS.stand;
  private livePainting: LivePaintingConfig | null = null;
  private liveAnimationPaused = false;
  // Mutually exclusive Live renderers are owned by the active mode, not by
  // GameCanvas construction. Hider + Seeker therefore no longer allocate all
  // three renderer graphs before either scene needs one.
  private liveAvatarRenderer: LiveAvatarRenderer | null = null;
  private curatedLiveRoomRenderer: CuratedLiveRoomRenderer | null = null;
  private active = true;
  private liveStartedAt = performance.now();
  private liveLastFrameAt = 0;
  private backgroundReady = true;
  private foregroundReady = true;
  private showAvatar = true;
  private inspectionHandler: InspectionHandler | null = null;
  private roomChangeHandler: RoomChangeHandler | null = null;
  // Fired when the hider's chameleon moves, so the paint studio (a side panel on
  // desktop, with the room + joystick still live) can re-pull its room backdrop.
  private targetMoveHandler: (() => void) | null = null;
  private movementHandler: ((moving: boolean) => void) | null = null;
  // Fired when the current room's background flips loading↔ready, so a loader
  // overlay can show while a room's art streams in (cold cache / slow mobile).
  private loadingHandler: LoadingChangeHandler | null = null;
  private roomLoading = false;
  private roomLoadingImmediate = false;
  // A portal transition must paint the existing DOM loader before a cold
  // room parses its project and prepares a large atlas. Until the next rAF,
  // keep showing the previous cached room frame underneath that opaque cover.
  private roomTransitionPending = false;
  private inspectionCanvas: HTMLCanvasElement | null = null;
  private targetFacing: -1 | 1 = -1;
  private explorerFacing: -1 | 1 = 1;
  private explorerAim = { x: 1, y: 0 };
  private moveSpeed = BASE_MOVE_SPEED;
  private renderQueued = false;
  // Scene-only crop used by Close Look. Sampling the visible canvas while its
  // card is being drawn feeds the previous card back into itself every frame,
  // producing the recursive oversized UI shown in the bug report.
  private inspectionFrame: HTMLCanvasElement | null = null;
  // One bounded, non-DOM room cache. Live background work updates this
  // 960×640 frame at 30Hz; movement frames copy it into the sole visible
  // canvas, then draw furniture, actors and HUD. It is never inserted into the
  // document, so Safari has no second visible layer to upload or composite.
  private roomFrameCanvas: HTMLCanvasElement | null = null;
  private roomFrameDirty = true;
  private readonly roomBackdropCanvas = document.createElement("canvas");
  private inspectionFrameCrop = { ready: false, sourceX: 0, sourceY: 0, sourceWidth: 1, sourceHeight: 1 };

  // On-canvas play UI. Inert until enablePlayUi(); the hider/seeker DOM shells
  // used to own these controls — now GameCanvas draws + handles them.
  private playUi = false;
  private phase: PlayPhase = "playing";
  private hud: HudState = { roomName: "", meta: "", timer: "", timerLow: false, triesLeft: 0, triesTotal: 0, stats: "", hint: "", liveAvailable: false, liveEnabled: false, paintVisited: false, hideReady: false };
  private resultCard: PlayResult = { title: "", sub: "", actionLabel: "" };
  private cb: PlayCallbacks = {};
  private joy = { active: false, pointerId: -1, dx: 0, dy: 0 };
  private keys = new Set<string>();
  private hotRegions: HotRegion[] = [];
  private tapId: string | null = null;
  private hoveredUi: string | null = null;
  private uiLastFrame = 0;
  private closeLookOpen = true;
  // First-time hider guidance lives on the primary canvas. Its animation is
  // deliberately brief so a helper arrow never turns a static room into a
  // permanently redrawing scene.
  private hiderOnboardingStartedAt: number | null = null;
  private hiderOnboardingLastFrameAt = 0;
  private hiderOnboardingDismissed = false;
  // Localized static labels for on-canvas text — set by main.ts (t()) so i18n
  // stays in one place; refreshed on locale change.
  private labels = {
    closeLook: "close look",
    lobby: "Lobby",
    live: "Live",
    report: "report",
    start: "start",
    paint: "paint",
    hide: "hide",
    brand: "Painterly Chameleon",
    seekerReadyLine1: "Your friend painted and hid",
    seekerReadyLine2: "their chameleon.",
    seekerReadyCall: "Your turn to find it!",
    hiderGuideLine1: "Move and paint your chameleon,",
    hiderGuideLine2: "then hide it. Share with a friend—",
    hiderGuideLine3: "let them find it!",
  };
  // Camera for the full-screen play surface: the canvas fills the viewport (CSS
  // px = cam.w×cam.h, backing ×dpr), the 960×640 room is drawn contain-fit via
  // (scale, ox, oy), and the HUD/joystick/Close Look are laid out in screen px.
  private cam = { w: VIEW_WIDTH, h: VIEW_HEIGHT, scale: 1, ox: 0, oy: 0 };
  private dpr = 1;
  // Tracks walking for input/Studio coordination and the avatar draw-calm:
  // while moving, drawAvatar uses the static painted result instead of the
  // per-mark force pass. Room Live remains animated.
  private actorMoving = false;
  // Responsive on-canvas control sizes (recomputed in resize) so nothing spills
  // off a narrow phone.
  private ui = { joyBase: JOY_BASE, joyKnob: JOY_KNOB, lookW: LOOK.w, lookH: LOOK.h, pad: LOOK.pad };

  // Stable, animation-frame-coalesced redraw handed to cachedImage. Because it
  // is one reference, repeated `addEventListener("load", …)` calls dedupe; the
  // rAF gate then collapses any burst of image-load callbacks into one render.
  private readonly redraw = (): void => {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.roomFrameDirty = true;
      this.render();
    });
  };

  constructor(canvas: HTMLCanvasElement, mode: SceneMode) {
    this.canvas = canvas;
    this.mode = mode;
    // GPU-accelerated 2D context. The scene redraws the full room every frame
    // during movement, so it must NOT be willReadFrequently (that forces a
    // software canvas and was the mobile slowdown). The occasional eyedropper
    // getImageData still works without the hint.
    this.ctx = canvas.getContext("2d")!;
    this.applyHouseSpawns();
    // Seeker tap-to-inspect is bound in enablePlayUi (the on-canvas UI owns all
    // canvas pointer input); scenes that don't enable it stay render-only.
    this.render();
  }

  private getLiveAvatarRenderer(): LiveAvatarRenderer {
    if (!this.liveAvatarRenderer) {
      this.liveAvatarRenderer = new LiveAvatarRenderer(256, this.artSeed);
    }
    return this.liveAvatarRenderer;
  }

  private getCuratedLiveRoomRenderer(): CuratedLiveRoomRenderer {
    return this.curatedLiveRoomRenderer ??= new CuratedLiveRoomRenderer();
  }

  private ensureRoomFrame(): HTMLCanvasElement {
    if (this.roomFrameCanvas) return this.roomFrameCanvas;
    const frame = document.createElement("canvas");
    frame.width = VIEW_WIDTH;
    frame.height = VIEW_HEIGHT;
    this.roomFrameCanvas = frame;
    this.roomFrameDirty = true;
    return frame;
  }

  private disposeRoomFrame(): void {
    const frame = this.roomFrameCanvas;
    if (!frame) return;
    this.roomFrameCanvas = null;
    frame.width = 0;
    frame.height = 0;
    this.roomFrameDirty = true;
    this.backgroundReady = true;
  }

  private refreshRoomFrame(time = performance.now()): HTMLCanvasElement {
    const frame = this.ensureRoomFrame();
    if (this.roomTransitionPending) return frame;
    if (!this.roomFrameDirty) return frame;
    const context = frame.getContext("2d", { alpha: false })!;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.backgroundReady = this.drawWorldBackground(
      context,
      Math.max(0, time - this.liveStartedAt) / 1_000,
    );
    this.roomFrameDirty = false;
    return frame;
  }

  /** Keep only renderers that can contribute to the current frame. Backing
   * stores are explicitly zeroed by dispose(), so leaving a Live room releases
   * its GPU textures instead of retaining them for every page state. */
  private syncLiveRendererLifecycle(): void {
    const avatarNeeded = Boolean(
      this.active
      && this.livePainting?.marks.length
      && this.showAvatar
      && this.roomIndex === this.target.roomIndex,
    );
    const curatedNeeded = Boolean(
      this.active
      && this.livePainting
      && supportsCuratedLiveProject(this.artHouse, this.roomIndex),
    );

    if (!avatarNeeded && this.liveAvatarRenderer) {
      this.liveAvatarRenderer.dispose();
      this.liveAvatarRenderer = null;
    }
    if (!curatedNeeded && this.curatedLiveRoomRenderer) {
      this.curatedLiveRoomRenderer.dispose();
      this.curatedLiveRoomRenderer = null;
    }
  }

  /** Route visibility without destroying business state. Hidden pages release
   * their Live GPU resources and bounded room-frame cache; returning recreates
   * only the active scene's render resources lazily. */
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    if (!active) {
      this.joy.active = false;
      this.joy.pointerId = -1;
      this.joy.dx = 0;
      this.joy.dy = 0;
      this.keys.clear();
      this.setActorMoving(false);
      this.disposeRoomFrame();
    }
    this.syncLiveRendererLifecycle();
    if (active) {
      this.liveLastFrameAt = 0;
      this.roomFrameDirty = true;
      this.render();
    }
  }

  /** Seat both actors at the current art house's editor-authored birth places
   * (with legacy fallbacks) and open on the relevant actor's room. */
  private applyHouseSpawns(): void {
    const spawns = spawnsFor(this.artHouse);
    this.target = { ...spawns.hider };
    this.explorer = { ...spawns.seeker };
    this.roomIndex = this.mode === "seeker" ? spawns.seeker.roomIndex : spawns.hider.roomIndex;
  }

  /** Walking speed in px/s. Lowered on touch devices (see moveSpeedFor). */
  setMoveSpeed(pixelsPerSecond: number): void {
    this.moveSpeed = pixelsPerSecond;
  }

  setRoom(roomIndex: 0 | 1 | 2): void {
    this.roomIndex = roomIndex;
    this.roomFrameDirty = true;
    this.syncLiveRendererLifecycle();
    this.render();
  }

  /** Re-seat both actors at this house's spawns and open on the right room —
   * used to start a fresh hide without changing art house. */
  resetActors(): void {
    this.applyHouseSpawns();
    this.roomFrameDirty = true;
    this.syncLiveRendererLifecycle();
    this.render();
  }

  setArtHouse(artHouse: ArtHouseId): void {
    if (this.artHouse === artHouse) return;
    this.artHouse = artHouse;
    this.applyHouseSpawns();
    this.roomFrameDirty = true;
    this.syncLiveRendererLifecycle();
    this.render();
  }

  getRoom(): 0 | 1 | 2 {
    return this.roomIndex;
  }

  setRoomTexture(surface: 0 | 1 | 2, artSeed: number): void {
    this.surface = surface;
    this.artSeed = artSeed;
    this.roomFrameDirty = true;
    this.liveAvatarRenderer?.setSeed(artSeed);
    this.render();
  }

  setTarget(roomIndex: 0 | 1 | 2, x: number, y: number): void {
    this.target = { roomIndex, x, y };
    this.syncLiveRendererLifecycle();
    this.render();
  }

  getTarget(): { roomIndex: 0 | 1 | 2; x: number; y: number } {
    return {
      roomIndex: this.target.roomIndex,
      x: Math.round(this.target.x),
      y: Math.round(this.target.y),
    };
  }

  setAvatar(source: CanvasImageSource | null, pose: PoseId, url = AVATAR_URLS[pose]): void {
    this.avatarSource = source;
    this.pose = pose;
    this.avatarUrl = url;
    this.render();
  }

  /** Enable bounded local marks made with curated, game-shipped avatar forces.
   * Challenge data never supplies masks, projects, brush source, or code. */
  /** The ≤760px Paint Studio is fullscreen and completely covers this canvas
   * (getClientRects still reports it visible) — pause the live loop under it
   * so the phone isn't rendering a room nobody can see. The desktop side
   * panel never pauses: there the room stays visible next to the studio. */
  setLiveAnimationPaused(paused: boolean): void {
    if (this.liveAnimationPaused === paused) return;
    this.liveAnimationPaused = paused;
    if (!paused) {
      this.liveLastFrameAt = 0;
      this.roomFrameDirty = true;
      this.render();
    }
  }

  setLivePainting(value: LivePaintingConfig | null): void {
    const wasLive = Boolean(this.livePainting);
    this.livePainting = value ? normalizeLivePaintingConfig(value) : null;
    // Studio sends a fresh config on every force stroke. Keep the room
    // clock continuous; only a real off→on transition begins a new painting.
    if (!wasLive && this.livePainting) this.liveStartedAt = performance.now();
    this.liveLastFrameAt = 0;
    this.roomFrameDirty = true;
    this.liveAvatarRenderer?.setSeed(this.artSeed);
    this.syncLiveRendererLifecycle();
    this.render();
  }

  setChallenge(payload: ChallengePayloadV1): void {
    this.artHouse = payload.artHouse;
    this.surface = payload.surface;
    this.artSeed = payload.artSeed;
    this.target = { roomIndex: payload.roomIndex, x: payload.x, y: payload.y };
    // The seeker births at the editor's seeker spawn — which may be a different
    // room than the hidden chameleon — and the view opens there.
    this.explorer = { ...spawnsFor(this.artHouse).seeker };
    this.roomIndex = this.explorer.roomIndex;
    this.pose = payload.pose;
    this.avatarSource = null;
    this.avatarUrl = payload.avatarData;
    this.livePainting = payload.livePainting ? normalizeLivePaintingConfig(payload.livePainting) : null;
    this.liveStartedAt = performance.now();
    this.liveLastFrameAt = 0;
    this.roomFrameDirty = true;
    this.liveAvatarRenderer?.setSeed(payload.artSeed);
    this.syncLiveRendererLifecycle();
    this.render();
  }

  setAvatarVisible(visible: boolean): void {
    this.showAvatar = visible;
    this.syncLiveRendererLifecycle();
    this.render();
  }

  // ---- On-canvas play UI --------------------------------------------------

  /** Turn this scene into a full-screen, everything-on-canvas play surface:
   * the joystick, Close Look, HUD, buttons and overlays are drawn on the canvas
   * and driven by canvas pointer + keyboard input (no DOM controls). */
  enablePlayUi(callbacks: PlayCallbacks): void {
    this.cb = callbacks;
    if (this.playUi) { this.render(); return; } // idempotent: bind listeners once
    this.playUi = true;
    this.canvas.style.touchAction = "none";
    this.canvas.addEventListener("pointerdown", this.onUiPointerDown);
    this.canvas.addEventListener("pointermove", this.onUiPointerMove);
    this.canvas.addEventListener("pointerup", this.onUiPointerUp);
    this.canvas.addEventListener("pointercancel", this.onUiPointerUp);
    this.canvas.addEventListener("pointerleave", this.onUiPointerLeave);
    window.addEventListener("keydown", this.onUiKeyDown);
    window.addEventListener("keyup", this.onUiKeyUp);
    this.uiLastFrame = performance.now();
    requestAnimationFrame(this.uiFrame);
    this.render();
  }

  setLabels(labels: Partial<typeof this.labels>): void {
    this.labels = { ...this.labels, ...labels };
    this.render();
  }

  setPhase(phase: PlayPhase): void {
    this.phase = phase;
    if (phase !== "playing") { this.joy.active = false; this.joy.dx = 0; this.joy.dy = 0; this.keys.clear(); }
    this.render();
  }

  setHudState(patch: Partial<HudState>): void {
    this.hud = { ...this.hud, ...patch };
    this.render();
  }

  setResultCard(card: PlayResult): void {
    this.resultCard = card;
    this.render();
  }

  // rAF loop: steps the actor from the joystick + keys while playing. moveActor
  // re-renders, so idle frames stay cheap (no move ⇒ no redraw).
  private readonly uiFrame = (time: number): void => {
    if (!this.playUi) return;
    // Frame cap: on a 120Hz phone this skips every other rAF so movement and
    // the live loop render at ≤60fps instead of 120 — the fix for walking
    // freezing the scene. Position physics also steps at this rate (smooth).
    if (time - this.uiLastFrame < PLAY_FRAME_MS) {
      requestAnimationFrame(this.uiFrame);
      return;
    }
    const deltaMs = Math.min(40, Math.max(0, time - this.uiLastFrame));
    this.uiLastFrame = time;
    let moved = false;
    if (this.phase === "playing") {
      let dx = this.joy.active ? this.joy.dx : 0;
      let dy = this.joy.active ? this.joy.dy : 0;
      if (this.keys.has("left")) dx -= 1;
      if (this.keys.has("right")) dx += 1;
      if (this.keys.has("up")) dy -= 1;
      if (this.keys.has("down")) dy += 1;
      if (Math.abs(dx) > 0.08 || Math.abs(dy) > 0.08) {
        // While walking, the avatar uses its static painted result. Room Live
        // stays alive in this same primary-canvas render; no second visible
        // canvas participates.
        this.setActorMoving(true);
        this.moveActor(dx, dy, deltaMs);
        moved = true;
      }
    }
    if (!moved) this.setActorMoving(false);
    // Static rooms remain event-driven. A reviewed Live room keeps animating
    // even when the hidden avatar is not currently visible; avatar-only motion
    // still stops when there is no avatar to draw.
    const canvasVisible = !document.hidden
      && this.canvas.isConnected
      && this.canvas.getClientRects().length > 0;
    const animateLive = !this.liveAnimationPaused && canvasVisible && Boolean(this.livePainting) && (
      supportsCuratedLiveProject(this.artHouse, this.roomIndex)
      || Boolean(
        this.showAvatar
        && this.roomIndex === this.target.roomIndex
        && this.livePainting?.marks.length,
      )
    );
    let needsIdleRender = false;
    if (animateLive && time - this.liveLastFrameAt >= 1000 / 30) {
      this.liveLastFrameAt = time;
      // Rebuild the non-DOM room cache on the next visible render. Movement
      // already rendered this frame, so it picks the new cache up on the next
      // capped movement frame; idle Live redraws immediately at 30Hz.
      this.roomFrameDirty = true;
      needsIdleRender = true;
    }
    if (
      this.hiderOnboardingActive(time)
      && time - this.hiderOnboardingLastFrameAt >= 1000 / 24
    ) {
      this.hiderOnboardingLastFrameAt = time;
      needsIdleRender = true;
    }
    if (!moved && needsIdleRender) this.render();
    requestAnimationFrame(this.uiFrame);
  };

  // Client → screen (CSS px) for on-canvas UI hit-testing.
  private screenPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return { x: (clientX - rect.left) * (this.cam.w / rect.width), y: (clientY - rect.top) * (this.cam.h / rect.height) };
  }

  private updateJoy(p: { x: number; y: number }): void {
    const c = this.joyPos();
    let x = p.x - c.x;
    let y = p.y - c.y;
    const max = this.ui.joyBase - 8;
    const len = Math.sqrt(x * x + y * y);
    if (len > max) { x *= max / len; y *= max / len; }
    // Pointer events may arrive at 60–120Hz independently of requestAnimationFrame.
    // They only update the desired movement vector; uiFrame owns physics and
    // the single foreground render. Rendering here as well made one gesture
    // repaint the furniture/actor/HUD overlay twice in the same display frame.
    this.joy.dx = x / max;
    this.joy.dy = y / max;
  }

  private readonly onUiPointerDown = (event: PointerEvent): void => {
    const p = this.screenPoint(event.clientX, event.clientY);
    if (!p) return;
    // Buttons/pills/Close Look take priority over the joystick, so a control
    // stacked just above the joystick isn't swallowed by its larger grab area.
    const region = this.hitRegion(p);
    if (region) { this.tapId = region; return; }
    this.tapId = null;
    const c = this.joyPos();
    if (this.phase === "playing" && dist(p.x, p.y, c.x, c.y) <= this.ui.joyBase * 1.3) {
      this.joy.active = true;
      this.joy.pointerId = event.pointerId;
      try { this.canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
      this.updateJoy(p);
      event.preventDefault();
    }
  };

  private readonly onUiPointerMove = (event: PointerEvent): void => {
    if (!this.joy.active || event.pointerId !== this.joy.pointerId) {
      const p = this.screenPoint(event.clientX, event.clientY);
      const next = event.pointerType === "mouse" && p && this.hitRegion(p) === "live-state" ? "live-state" : null;
      if (next !== this.hoveredUi) {
        this.hoveredUi = next;
        this.render();
      }
      return;
    }
    const p = this.screenPoint(event.clientX, event.clientY);
    if (p) this.updateJoy(p);
    event.preventDefault();
  };

  private readonly onUiPointerLeave = (): void => {
    if (!this.hoveredUi) return;
    this.hoveredUi = null;
    this.render();
  };

  private readonly onUiPointerUp = (event: PointerEvent): void => {
    if (this.joy.active && event.pointerId === this.joy.pointerId) {
      this.joy.active = false;
      this.joy.pointerId = -1;
      this.joy.dx = 0;
      this.joy.dy = 0;
      this.render();
      return;
    }
    const p = this.screenPoint(event.clientX, event.clientY);
    const pressed = this.tapId;
    this.tapId = null;
    if (!p) return;
    const id = this.hitRegion(p);
    if (id && id === pressed) { this.activateRegion(id); return; }
    // Tapping the bare room while playing = seeker inspects at the reticle.
    if (!id && this.phase === "playing" && this.mode === "seeker") this.inspect();
  };

  private activateRegion(id: string): void {
    if (id === "start") this.cb.start?.();
    else if (id === "home") this.cb.home?.();
    else if (id === "lobby") this.cb.lobby?.();
    else if (id === "report") this.cb.report?.();
    else if (id === "action") this.cb.action?.();
    else if (id === "paint") {
      this.hiderOnboardingDismissed = true;
      this.cb.paint?.();
    }
    else if (id === "hide") this.cb.hide?.();
    else if (id === "reroll") this.cb.reroll?.();
    else if (id === "live-state") this.cb.live?.();
    else if (SEEKER_CLOSE_LOOK_ENABLED
      && id === "look-toggle"
      && this.phase === "playing"
      && this.mode === "seeker") {
      this.closeLookOpen = !this.closeLookOpen;
      this.render();
    }
    else if (SEEKER_CLOSE_LOOK_ENABLED
      && id === "look"
      && this.phase === "playing"
      && this.mode === "seeker") this.inspect();
  }

  private hitRegion(p: { x: number; y: number }): string | null {
    // Topmost-first: regions are pushed room→overlay, so scan in reverse.
    for (let i = this.hotRegions.length - 1; i >= 0; i -= 1) {
      const r = this.hotRegions[i]!;
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return r.id;
    }
    return null;
  }

  private readonly onUiKeyDown = (event: KeyboardEvent): void => {
    if (!this.active || !this.playUi || this.phase !== "playing" || isTypingTarget(event.target)) return;
    if (this.mode === "seeker" && (event.code === "Space" || event.code === "KeyR")) {
      if (!event.repeat) this.inspect();
      event.preventDefault();
      return;
    }
    const dir = keyDir(event.code);
    if (!dir) return;
    this.keys.add(dir);
    event.preventDefault();
  };

  private readonly onUiKeyUp = (event: KeyboardEvent): void => {
    const dir = keyDir(event.code);
    if (dir) this.keys.delete(dir);
  };

  onInspect(handler: InspectionHandler): void {
    this.inspectionHandler = handler;
  }

  onRoomChange(handler: RoomChangeHandler): void {
    this.roomChangeHandler = handler;
  }

  /** Notified whenever the hider's chameleon moves (position changed). */
  onTargetMove(handler: () => void): void {
    this.targetMoveHandler = handler;
  }

  /** Allows the Studio to share the room's draw-calm window. */
  onMovementChange(handler: (moving: boolean) => void): void {
    this.movementHandler = handler;
    handler(this.actorMoving);
  }

  private setActorMoving(moving: boolean): void {
    if (this.actorMoving === moving) return;
    this.actorMoving = moving;
    this.movementHandler?.(moving);
  }

  /** Notified when the current room's background flips loading↔ready. Fires
   *  immediately with the current state so the overlay starts in sync. */
  onLoadingChange(handler: LoadingChangeHandler): void {
    this.loadingHandler = handler;
    handler(this.roomLoading, this.roomLoadingImmediate);
  }

  private setRoomLoading(loading: boolean, immediate = false): void {
    const nextImmediate = loading && immediate;
    if (loading === this.roomLoading && (!nextImmediate || this.roomLoadingImmediate)) return;
    this.roomLoading = loading;
    this.roomLoadingImmediate = nextImmediate;
    this.loadingHandler?.(loading, nextImmediate);
  }

  attachInspection(canvas: HTMLCanvasElement): void {
    if (this.mode === "seeker" && !SEEKER_CLOSE_LOOK_ENABLED) return;
    this.inspectionCanvas = canvas;
    // Tapping the zoomed card scores directly on the hider shown there — much
    // easier on a phone than nudging the reticle over it on the full canvas.
    if (this.mode === "seeker") {
      canvas.addEventListener("pointerup", event => this.inspectFromCard(canvas, event));
    }
    this.render();
  }

  /** Point-based inspection from a tap inside the seeker's zoom card. */
  private inspectFromCard(canvas: HTMLCanvasElement, event: PointerEvent): void {
    if (this.mode !== "seeker" || !this.inspectionHandler) return;
    const point = this.inspectionPoint();
    // Off-room: the card is blank, so fall back to the reticle inspection.
    if (point.roomIndex !== this.roomIndex) {
      this.inspect();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const tapX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const tapY = (event.clientY - rect.top) * (canvas.height / rect.height);
    const source = inspectionSource(point.x, point.y, VIEW_WIDTH, VIEW_HEIGHT);
    const result = inspectionCardHit({
      tapX,
      tapY,
      cardWidth: canvas.width,
      cardHeight: canvas.height,
      sourceX: source.x,
      sourceY: source.y,
      hider: { x: this.target.x, y: this.target.y },
      sameRoom: this.target.roomIndex === this.roomIndex,
    });
    this.inspectionHandler(Math.round(result.x), Math.round(result.y), result.hit);
  }

  /** A read-only square crop of the current room around the chameleon, for the
   * paint studio to show behind the paper so its eyedropper can sample room
   * colors. Returns null until the room background has decoded. */
  roomBackdrop(size: number): HTMLCanvasElement | null {
    const url = roomUrl(this.artHouse, this.roomIndex, this.surface);
    if (!url) return null;
    const background = imageCache.get(url);
    if (!background || !background.complete || !background.naturalWidth) return null;
    const out = this.roomBackdropCanvas;
    if (out.width !== size || out.height !== size) {
      out.width = size;
      out.height = size;
    }
    const octx = out.getContext("2d");
    if (!octx) return null;
    octx.clearRect(0, 0, size, size);
    // The paint backdrop shows this much of the room around the chameleon. It's
    // ZOOMED IN (125 world px) so the chameleon is big + easy to paint — the
    // paint surface is scaled to AVATAR_SPAN(100) / cropSide ≈ 80% of the canvas
    // (see styles.css), which keeps a natural chameleon↔room proportion while
    // filling most of the frame. Keep the surface % = 100/cropSide in sync.
    const cropSide = 125;
    const scaleX = background.naturalWidth / VIEW_WIDTH;
    const scaleY = background.naturalHeight / VIEW_HEIGHT;
    const cx = this.target.x;
    const cy = this.target.y - 40;
    const sx = Math.max(0, Math.min(VIEW_WIDTH - cropSide, cx - cropSide / 2));
    const sy = Math.max(0, Math.min(VIEW_HEIGHT - cropSide, cy - cropSide / 2));
    octx.drawImage(background, sx * scaleX, sy * scaleY, cropSide * scaleX, cropSide * scaleY, 0, 0, size, size);
    return out;
  }

  inspect(): void {
    if (this.mode !== "seeker" || !this.inspectionHandler) return;
    const point = this.inspectionPoint();
    const sameRoom = point.roomIndex === this.target.roomIndex;
    const dx = (point.x - this.target.x) / 48;
    const dy = (point.y - (this.target.y - 38)) / 54;
    this.inspectionHandler(
      Math.round(point.x),
      Math.round(point.y),
      sameRoom && dx * dx + dy * dy <= 1,
    );
  }

  moveActor(dx: number, dy: number, deltaMs: number): void {
    if (!dx && !dy) return;
    const length = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / length;
    const uy = dy / length;
    if (this.mode === "hider") {
      if (Math.abs(ux) > 0.05) this.targetFacing = ux > 0 ? 1 : -1;
    } else {
      if (Math.abs(ux) > 0.05) this.explorerFacing = ux > 0 ? 1 : -1;
      this.explorerAim = { x: ux, y: uy };
    }
    const distance = this.moveSpeed * Math.min(40, deltaMs) / 1_000;
    const steps = Math.max(1, Math.ceil(distance / 4));
    let actor: ActorPosition = { ...(this.mode === "hider" ? this.target : this.explorer) };

    for (let index = 0; index < steps; index += 1) {
      const sx = ux * distance / steps;
      const sy = uy * distance / steps;
      const portalExit = this.portalExit(actor, sx, sy);
      if (portalExit) {
        actor = portalExit;
        continue;
      }
      const nextX = actor.x + sx;
      if (actorCanStandAt(this.artHouse, this.surface, actor.roomIndex, nextX, actor.y)) actor.x = nextX;
      const nextY = actor.y + sy;
      if (actorCanStandAt(this.artHouse, this.surface, actor.roomIndex, actor.x, nextY)) actor.y = nextY;
    }

    actor.x = Math.round(actor.x * 10) / 10;
    actor.y = Math.round(actor.y * 10) / 10;
    if (this.mode === "hider") { this.target = actor; this.targetMoveHandler?.(); }
    else this.explorer = actor;
    if (this.roomIndex !== actor.roomIndex) this.switchRoom(actor.roomIndex);
    this.render();
  }

  /**
   * A small, low-resolution JPEG data URL of the current scene, for the share
   * page (the Hider's room + chameleon, or a Seeker's found moment). Kept tiny
   * on purpose — these are stored per challenge in D1. Retries smaller if the
   * first encode is over budget, and returns "" if the canvas can't be read.
   */
  snapshot(maxLength = 55_000): string {
    this.render();
    // The found screenshot is shown fairly large (~360-410px in "my rooms" and
    // the share view) and there's only one per challenge, so it's the one image
    // worth storing at a real size.
    const attempts: Array<{ width: number; quality: number }> = [
      { width: 400, quality: 0.5 },
      { width: 360, quality: 0.44 },
      { width: 320, quality: 0.4 },
    ];
    let best = "";
    for (const attempt of attempts) {
      const encoded = this.encodeScaled(attempt.width, attempt.quality);
      if (!encoded) return best;
      best = encoded;
      if (encoded.length <= maxLength) return encoded;
    }
    return best.length <= maxLength ? best : "";
  }

  /** Clear room capture for the Hider's immediate share modal. This stays in
   * the current browser and is never sent to D1 or exposed in the Lobby feed. */
  shareSnapshot(maxLength = 55_000): string {
    this.render();
    const attempts: Array<{ width: number; quality: number }> = [
      { width: 400, quality: 0.58 },
      { width: 360, quality: 0.52 },
      { width: 320, quality: 0.46 },
    ];
    let best = "";
    for (const attempt of attempts) {
      const encoded = this.encodeRoomCrop(attempt.width, attempt.quality);
      if (!encoded) return best;
      best = encoded;
      if (encoded.length <= maxLength) return encoded;
    }
    return best.length <= maxLength ? best : "";
  }

  private encodeScaled(maxWidth: number, quality: number): string {
    const scale = Math.min(1, maxWidth / this.canvas.width);
    const width = Math.max(1, Math.round(this.canvas.width * scale));
    const height = Math.max(1, Math.round(this.canvas.height * scale));
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const octx = out.getContext("2d");
    if (!octx) return "";
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = "medium";
    this.drawSceneLayers(octx, width, height);
    try {
      return out.toDataURL("image/jpeg", quality);
    } catch {
      return "";
    }
  }

  private encodeRoomCrop(width: number, quality: number): string {
    const height = Math.max(1, Math.round(width * VIEW_HEIGHT / VIEW_WIDTH));
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const context = out.getContext("2d");
    if (!context) return "";

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "medium";
    const sourceX = this.cam.ox * this.dpr;
    const sourceY = this.cam.oy * this.dpr;
    const sourceWidth = VIEW_WIDTH * this.cam.scale * this.dpr;
    const sourceHeight = VIEW_HEIGHT * this.cam.scale * this.dpr;
    context.drawImage(this.canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    try {
      return out.toDataURL("image/jpeg", quality);
    } catch {
      return "";
    }
  }

  sampleColor(clientX: number, clientY: number): string | null {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    // Sample the pixel actually rendered under the point, in BACKING px — works
    // for the full-screen camera canvas (cam.w×cam.h CSS, backing ×dpr, room
    // drawn through the camera transform) as well as a legacy 960×640 canvas.
    // The old 960×640 mapping sampled the wrong pixel once the camera landed.
    const x = Math.floor((clientX - rect.left) * (this.canvas.width / rect.width));
    const y = Math.floor((clientY - rect.top) * (this.canvas.height / rect.height));
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return null;
    const pixel = this.ctx.getImageData(x, y, 1, 1).data;
    if ((pixel[3] ?? 0) < 8) return null;
    return `#${[0, 1, 2]
      .map(index => (pixel[index] ?? 0).toString(16).padStart(2, "0"))
      .join("")}`;
  }

  /** Copy the single visible scene for explicit exports and preview samples. */
  private drawSceneLayers(context: CanvasRenderingContext2D, width: number, height: number): void {
    context.drawImage(this.canvas, 0, 0, width, height);
  }

  /** Size the full-screen canvas to fill its container and recompute the
   * contain-fit camera for the 960×640 room. */
  resize(cssW: number, cssH: number): void {
    if (cssW < 4 || cssH < 4) return;
    this.dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    delete this.canvas.dataset.backingResolution;
    delete this.canvas.dataset.renderScale;
    delete this.canvas.dataset.pixelBudget;
    this.cam.w = cssW;
    this.cam.h = cssH;
    const scale = Math.min(cssW / VIEW_WIDTH, cssH / VIEW_HEIGHT);
    this.cam.scale = scale;
    this.cam.ox = Math.round((cssW - VIEW_WIDTH * scale) / 2);
    // Center the room vertically, but cap the top gap so a tall phone keeps a
    // roomy control band below. Portrait phones reserve a few extra pixels
    // above the art so Live/Lobby sit wholly in the header band.
    const portraitPhone = cssW < cssH && cssW <= 760;
    this.cam.oy = Math.round(Math.min((cssH - VIEW_HEIGHT * scale) / 2, portraitPhone ? 92 : 84));
    // Controls scale down on narrow screens so the joystick + Close Look fit.
    const joyBase = Math.round(Math.max(52, Math.min(cssW * 0.15, 82)));
    // Close Look: phones keep the compact card, but on a desktop-size viewport
    // (same 761px breakpoint the stylesheet uses) the magnifier is the seeker's
    // main tool, so it takes real space — bounded on both axes so it never
    // crowds the joystick row or the centered timer.
    const lookW = cssW >= 761
      ? Math.round(Math.min(cssW * 0.46, (cssH * 0.46) / 0.56, 640))
      : Math.round(Math.max(140, Math.min(cssW * 0.42, 300)));
    this.ui = { joyBase, joyKnob: Math.round(joyBase * 0.44), lookW, lookH: Math.round(lookW * 0.56), pad: 16 };
    this.render();
  }

  render(): void {
    if (!this.active) {
      this.syncLiveRendererLifecycle();
      return;
    }
    this.syncLiveRendererLifecycle();
    const context = this.ctx;
    if (this.playUi) {
      context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      context.clearRect(0, 0, this.cam.w, this.cam.h);
      // Soft radial "gallery wall" glow behind the room so the space around a
      // 3:2 room on a tall phone reads as intentional, not a dead black band.
      const roomCx = this.cam.ox + VIEW_WIDTH * this.cam.scale / 2;
      const roomCy = this.cam.oy + VIEW_HEIGHT * this.cam.scale / 2;
      const wall = context.createRadialGradient(roomCx, roomCy, 60, roomCx, this.cam.h / 2, Math.max(this.cam.w, this.cam.h) * 0.82);
      wall.addColorStop(0, "#151b30");
      wall.addColorStop(1, "#080a12");
      context.fillStyle = wall;
      context.fillRect(0, 0, this.cam.w, this.cam.h);
      context.save();
      context.translate(this.cam.ox, this.cam.oy);
      context.scale(this.cam.scale, this.cam.scale);
      // The room's expensive Live pass is cached off-DOM at 960×640. Every
      // visible frame still lands on this one canvas: copy the latest room,
      // then draw depth-sorted furniture, actors and the HUD above it.
      context.drawImage(this.refreshRoomFrame(), 0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      this.foregroundReady = this.drawWorldForeground();
      this.setRoomLoading(this.roomTransitionPending || !(this.backgroundReady && this.foregroundReady));
      context.restore();
      // On a phone the room can spend several seconds behind the loading
      // cover. Start the brief guide only once the player can actually see it,
      // instead of letting its timer expire underneath that cover.
      this.startHiderOnboardingIfReady();
      if (this.mode === "seeker" && SEEKER_CLOSE_LOOK_ENABLED && this.closeLookOpen) this.captureInspectionFrame();
      this.drawPlayUi();
    } else {
      context.setTransform(1, 0, 0, 1, 0, 0);
      this.drawWorld(true, true);
      this.updateInspection();
    }
  }

  // The room + props + actors, always drawn in 960×640 world coords. render()
  // wraps this in the camera transform for the full-screen play surface.
  private drawWorld(includeBackground: boolean, includeForeground: boolean): void {
    this.syncLiveRendererLifecycle();
    if (includeBackground) {
      this.backgroundReady = this.drawWorldBackground(
        this.ctx,
        Math.max(0, performance.now() - this.liveStartedAt) / 1_000,
      );
    }
    if (includeForeground) this.foregroundReady = this.drawWorldForeground();
    this.setRoomLoading(this.roomTransitionPending || !(this.backgroundReady && this.foregroundReady));
  }

  private drawWorldBackground(context: CanvasRenderingContext2D, sceneSeconds: number): boolean {
    const redraw = this.redraw;
    context.fillStyle = "#11162c";
    context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    const curatedLiveRoom = Boolean(this.livePainting
      && supportsCuratedLiveProject(this.artHouse, this.roomIndex));
    const curatedLiveProject = curatedLiveRoom
      ? curatedLiveProjectFor(this.artHouse, this.roomIndex)
      : null;
    const liveBaseSurface = curatedLiveRoom
      ? curatedLiveBaseSurface(this.artHouse, this.roomIndex)
      : null;
    const backgroundSurface = liveBaseSurface ?? this.surface;
    const backgroundUrl = roomUrl(this.artHouse, this.roomIndex, backgroundSurface);
    let backgroundReady = true;
    if (backgroundUrl) {
      const background = cachedImage(backgroundUrl, redraw);
      backgroundReady = Boolean(background.complete && background.naturalWidth);
      if (backgroundReady) {
        context.drawImage(background, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);
        if (curatedLiveRoom) {
          if (curatedLiveProject) {
            this.getCuratedLiveRoomRenderer().draw(
              context,
              background,
              curatedLiveProject,
              sceneSeconds,
            );
          } else if (ensureCuratedLiveProject(this.artHouse, this.roomIndex, redraw) === "loading") {
            backgroundReady = false;
          }
        }
      }
    }
    return backgroundReady;
  }

  private drawWorldForeground(): boolean {
    const redraw = this.redraw;
    // The loading overlay stays up until EVERYTHING the current room draws is
    // ready — background, every prop in this room, and the actors — so on a
    // slow connection the room never appears half-furnished (props popping in
    // one by one after the overlay left).
    let foregroundReady = true;
    const imageReady = (image: CanvasImageSource): boolean =>
      !(image instanceof HTMLImageElement) || Boolean(image.complete && image.naturalWidth);

    const roomOffset = this.roomIndex * VIEW_WIDTH;
    const layers: DrawLayer[] = [];
    for (const instance of activeProps(this.artHouse, this.surface)) {
      if (instance.x < roomOffset || instance.x >= roomOffset + VIEW_WIDTH) continue;
      // The corrected 1B Live artwork already paints this floor area. Keep the
      // prop in ordinary rooms, but do not composite the duplicate rug in Live.
      if (this.livePainting
        && this.artHouse === "van-gogh-house"
        && this.roomIndex === 1
        && instance.modelId === "paint-splashed-rug") continue;
      const spec = PROP_SPECS[instance.modelId];
      const url = propUrl(this.artHouse, instance, this.artSeed);
      if (!spec || !url) continue;
      const image = cachedImage(url, redraw);
      if (!imageReady(image)) foregroundReady = false;
      const localX = instance.x - roomOffset;
      const bias = instance.depthBias ?? 0;
      const depth = spec.surface ? -850 : instance.y + 0.5 + bias;
      layers.push({
        depth,
        draw: () => this.drawProp(instance, localX, image),
      });
    }

    if (this.showAvatar && this.roomIndex === this.target.roomIndex) {
      const avatar = this.avatarSource ?? cachedImage(this.avatarUrl, redraw);
      if (!imageReady(avatar)) foregroundReady = false;
      layers.push({
        depth: this.target.y,
        draw: () => this.drawAvatar(avatar),
      });
    }

    if (this.mode === "seeker" && this.roomIndex === this.explorer.roomIndex) {
      const explorer = cachedImage(AVATAR_URLS.stand, redraw);
      if (!imageReady(explorer)) foregroundReady = false;
      layers.push({
        depth: this.explorer.y + 0.25,
        draw: () => this.drawExplorer(explorer),
      });
    }

    layers.sort((a, b) => a.depth - b.depth);
    for (const layer of layers) layer.draw();
    return foregroundReady;
  }

  // ---- On-canvas play UI drawing (all in 960×640 design space) ------------
  private drawPlayUi(): void {
    const ctx = this.ctx;
    this.hotRegions = [];
    if (this.phase === "playing") {
      // Close Look is a seeker tool only — the hider judges the blend on the
      // big room canvas, not in a magnifier.
      if (this.mode === "seeker" && SEEKER_CLOSE_LOOK_ENABLED) {
        if (this.closeLookOpen) this.drawCloseLook(ctx);
        else this.drawCloseLookToggle(ctx);
      }
      this.drawJoystick(ctx);
      this.drawButtons(ctx);
      if (this.mode === "hider") this.drawHiderOnboarding(ctx);
    }
    this.drawWordmark(ctx);
    this.drawHud(ctx);
    if (this.phase === "ready") this.drawReadyOverlay(ctx);
    else if (this.phase === "result") this.drawResultOverlay(ctx);
  }

  // Wordmark on the canvas (top-left), replacing the old DOM header. The ◒ mark
  // shows on every size; the full name only when there's room (the seeker's
  // centered timer needs a wide screen to clear). Tap → home (seeker only).
  private drawWordmark(ctx: CanvasRenderingContext2D): void {
    // The wordmark is the hero on the play surface. Full name shows unless the
    // seeker's centered timer needs the width.
    const showText = this.cam.w >= (this.mode === "seeker" ? 560 : 320);
    const x = 16;
    const y = 30;
    ctx.save();
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    // Soft shadow so the wordmark stays legible over any room art beneath it.
    ctx.shadowColor = "rgba(0, 0, 0, .55)";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#e9c86e";
    ctx.font = "600 31px Georgia, serif";
    ctx.fillText("◒", x, y);
    let w = 31;
    if (showText) {
      ctx.fillStyle = "#f7edd4";
      ctx.font = "600 21px Georgia, serif";
      ctx.fillText(this.labels.brand, x + 36, y + 1);
      w = 36 + ctx.measureText(this.labels.brand).width;
    }
    ctx.restore();
    if (this.mode === "seeker") this.hotRegions.push({ x: x - 4, y: 8, w: w + 8, h: 44, id: "home" });
  }

  // Fixed joystick, bottom-left of the screen (CSS px).
  private joyPos(): { x: number; y: number } {
    return { x: 22 + this.ui.joyBase, y: this.cam.h - 22 - this.ui.joyBase };
  }

  private drawJoystick(ctx: CanvasRenderingContext2D): void {
    const { x: cx, y: cy } = this.joyPos();
    const base = this.ui.joyBase;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, base, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(14, 18, 32, .5)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(238, 211, 142, .38)";
    ctx.stroke();
    const kx = cx + this.joy.dx * (base - 8);
    const ky = cy + this.joy.dy * (base - 8);
    const knob = ctx.createRadialGradient(kx - 6, ky - 6, 4, kx, ky, this.ui.joyKnob);
    knob.addColorStop(0, "#efd68d");
    knob.addColorStop(1, "#a5772f");
    ctx.beginPath();
    ctx.arc(kx, ky, this.ui.joyKnob, 0, Math.PI * 2);
    ctx.fillStyle = knob;
    ctx.fill();
    ctx.restore();
  }

  private drawCloseLook(ctx: CanvasRenderingContext2D): void {
    const inspectionFrame = this.inspectionFrame;
    if (!inspectionFrame) return;
    const LW = this.ui.lookW;
    const LH = this.ui.lookH;
    const x = this.cam.w - LW - this.ui.pad;
    const y = this.cam.h - LH - this.ui.pad;
    const point = this.inspectionPoint();
    ctx.save();
    roundRectPath(ctx, x, y, LW, LH, 14);
    ctx.fillStyle = "#0c1020";
    ctx.fill();
    ctx.clip();
    if (point.roomIndex === this.roomIndex && this.inspectionFrameCrop.ready) {
      const { sourceX: wsx, sourceY: wsy, sourceWidth: sw, sourceHeight: sh } = this.inspectionFrameCrop;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(inspectionFrame, 0, 0, inspectionFrame.width, inspectionFrame.height, x, y, LW, LH);
      if (this.mode === "seeker") {
        const mx = x + (point.x - wsx) / sw * LW;
        const my = y + (point.y - wsy) / sh * LH;
        ctx.strokeStyle = "rgba(246, 215, 130, .9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(mx, my, 48 / sw * LW, 54 / sh * LH, 0, 0, Math.PI * 2);
        ctx.moveTo(mx - 9, my); ctx.lineTo(mx + 9, my);
        ctx.moveTo(mx, my - 9); ctx.lineTo(mx, my + 9);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.save();
    roundRectPath(ctx, x, y, LW, LH, 14);
    ctx.strokeStyle = "rgba(239, 217, 168, .32)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "rgba(13, 16, 26, .72)";
    roundRectPath(ctx, x + 8, y + 7, 96, 20, 7);
    ctx.fill();
    ctx.fillStyle = "#d8b866";
    ctx.font = "800 11px Inter, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(this.labels.closeLook.toUpperCase(), x + 14, y + 18);
    const closeW = 28;
    const closeX = x + LW - closeW - 8;
    if (LW >= 210) {
      const shortcut = "SPACE / R";
      ctx.font = "800 10px ui-monospace, Menlo, monospace";
      const shortcutWidth = Math.ceil(ctx.measureText(shortcut).width) + 16;
      const shortcutX = closeX - shortcutWidth - 6;
      roundRectPath(ctx, shortcutX, y + 7, shortcutWidth, 20, 7);
      ctx.fillStyle = "rgba(13, 16, 26, .72)";
      ctx.fill();
      ctx.fillStyle = "#d8b866";
      ctx.textAlign = "center";
      ctx.fillText(shortcut, shortcutX + shortcutWidth / 2, y + 18);
    }
    roundRectPath(ctx, closeX, y + 7, closeW, 20, 7);
    ctx.fillStyle = "rgba(13, 16, 26, .82)";
    ctx.fill();
    ctx.strokeStyle = "rgba(216, 184, 102, .45)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#e8cc82";
    ctx.font = "800 15px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("×", closeX + closeW / 2, y + 17.5);
    ctx.restore();
    this.hotRegions.push({ x, y, w: LW, h: LH, id: "look" });
    this.hotRegions.push({ x: closeX, y: y + 7, w: closeW, h: 20, id: "look-toggle" });
  }

  private drawCloseLookToggle(ctx: CanvasRenderingContext2D): void {
    const font = "800 12px Inter, system-ui, sans-serif";
    ctx.save();
    ctx.font = font;
    const width = Math.ceil(ctx.measureText(this.labels.closeLook).width) + 34;
    ctx.restore();
    this.drawButton(
      ctx,
      this.cam.w - this.ui.pad - width,
      this.cam.h - this.ui.pad - 38,
      width,
      38,
      this.labels.closeLook,
      "look-toggle",
      false,
      12,
    );
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    const W = this.cam.w;
    const H = this.cam.h;
    // On a narrow phone the centered attempt pips would collide with the room
    // name / expiry / stats, so during a seek those secondary chips are dropped
    // (they're on the ready screen + lobby).
    const declutter = W < 520 && this.mode === "seeker" && this.phase === "playing";
    // Portrait phones lift the paired Live/Lobby controls slightly so their
    // lower border clears the room art; wider layouts retain the usual offset.
    const portraitPhone = W < H && W <= 760;
    const RIGHT_TOP = portraitPhone ? 48 : 56;
    ctx.save();
    ctx.textBaseline = "top";
    // Both play surfaces keep the artwork clear of generated room names.
    // Ordinary Hider rooms retain only the reroll icon; Live Hider rooms and
    // all Seeker rooms show neither a room name nor reroll.
    if (this.mode === "hider" && this.hud.roomName && !this.hud.liveEnabled) {
      const w = this.drawPill(ctx, 16, RIGHT_TOP, "↻", "#c6bca6", "700 17px Inter, system-ui, sans-serif", 30);
      this.hotRegions.push({ x: 16, y: RIGHT_TOP, w, h: 30, id: "reroll" });
    }
    if (this.mode === "hider") {
      // Lobby and Live share one size/shape. Portrait phones place Live to the
      // left of Lobby; wider layouts keep the compact vertical stack.
      const bh = 34;
      const gap = 8;
      ctx.font = "800 14px Inter, system-ui, sans-serif";
      const naturalWidth = Math.round(Math.max(
        ctx.measureText(this.labels.lobby).width,
        ctx.measureText(this.labels.live).width + 18,
      ) + 30);
      const buttonWidth = portraitPhone && this.hud.liveAvailable
        ? Math.min(naturalWidth, Math.floor((W - 32 - gap) / 2))
        : naturalWidth;
      const lobbyX = W - 16 - buttonWidth;
      this.drawButton(ctx, lobbyX, RIGHT_TOP, buttonWidth, bh, this.labels.lobby, "lobby", false, 14);
      if (this.hud.liveAvailable) {
        this.drawLiveStateButton(
          ctx,
          portraitPhone ? lobbyX - gap - buttonWidth : lobbyX,
          portraitPhone ? RIGHT_TOP : RIGHT_TOP + bh + gap,
          buttonWidth,
          bh,
          this.labels.live,
          this.hud.liveEnabled,
        );
      }
    } else {
      // Seeker right column, mirroring the hider's top-right cluster: nav
      // buttons — lobby + report — sit in the top-right under the language
      // <select> during play, then expiry + stats stack beneath them.
      let ry = RIGHT_TOP;
      if (this.phase === "playing") {
        ctx.font = "800 14px Inter, system-ui, sans-serif";
        const lw = Math.round(ctx.measureText(this.labels.lobby).width + 30);
        this.drawButton(ctx, W - 16 - lw, ry, lw, 34, this.labels.lobby, "lobby", false, 14);
        ry += 34 + 8;
        // Reporting is important but secondary. A quiet one-line text link is
        // less likely to read as a required game action than a second button.
        ctx.font = "600 11px Inter, system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(224, 216, 199, .72)";
        ctx.fillText(this.labels.report, W - 18, ry + 2);
        const rw = Math.ceil(ctx.measureText(this.labels.report).width);
        ctx.strokeStyle = "rgba(224, 216, 199, .32)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(W - 18 - rw, ry + 17.5);
        ctx.lineTo(W - 18, ry + 17.5);
        ctx.stroke();
        this.hotRegions.push({ x: W - 28 - rw, y: ry - 6, w: rw + 20, h: 32, id: "report" });
        ry += 30;
      }
      if (this.hud.meta && !declutter) {
        const w = this.measurePill(ctx, this.hud.meta, "800 12px Inter, system-ui, sans-serif");
        this.drawPill(ctx, W - 16 - w, ry, this.hud.meta, "#eee4cc", "800 12px Inter, system-ui, sans-serif");
        ry += 28;
      }
      if (this.phase === "playing") {
        if (this.hud.timer) {
          ctx.font = "700 26px ui-monospace, Menlo, monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = this.hud.timerLow ? "#ff9d92" : "#f0cf7a";
          ctx.fillText(this.hud.timer, W / 2, 16);
        }
        if (this.hud.triesTotal > 0) {
          const gap = 22;
          const startX = W / 2 - (this.hud.triesTotal - 1) * gap / 2;
          for (let i = 0; i < this.hud.triesTotal; i += 1) {
            ctx.beginPath();
            ctx.arc(startX + i * gap, 58, 7, 0, Math.PI * 2);
            if (i < this.hud.triesLeft) { ctx.fillStyle = "#ecbf52"; ctx.fill(); }
            else { ctx.strokeStyle = "rgba(236, 191, 82, .45)"; ctx.lineWidth = 1.5; ctx.stroke(); }
          }
        }
        if (this.hud.stats && !declutter) {
          ctx.textAlign = "right";
          ctx.font = "800 12px Inter, system-ui, sans-serif";
          ctx.fillStyle = "#cbbfa6";
          for (const [lineIndex, line] of this.hud.stats.split("\n").entries()) {
            ctx.fillText(line, W - 18, ry + lineIndex * 16);
          }
        }
      }
    }
    // Hint line (both modes while playing), bottom-center above the controls.
    if (this.phase === "playing" && this.hud.hint) {
      ctx.textAlign = "center";
      ctx.font = "700 13px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#d6cbb8";
      ctx.fillText(this.hud.hint, W / 2, H - 132);
    }
    ctx.restore();
  }

  private hiderActionRect(): { x: number; y: number; size: number } {
    // Desktop Hider actions share the joystick's full footprint.
    const size = Math.round(this.ui.joyBase * 2);
    return {
      x: this.cam.w - 18 - size,
      y: this.cam.h - 20 - size,
      size,
    };
  }

  private portraitPaintButtonRect(): { x: number; y: number; size: number } {
    // Keep the palette bottom-right while matching the joystick's full size.
    const size = Math.round(this.ui.joyBase * 2);
    return {
      x: this.cam.w - 18 - size,
      y: this.cam.h - 20 - size,
      size,
    };
  }

  private portraitDoneButtonRect(): { x: number; y: number; w: number; h: number } {
    const w = Math.round(Math.max(96, Math.min(124, this.cam.w * .28)));
    const h = Math.round(Math.max(38, Math.min(46, this.ui.joyBase * .72)));
    // Put Done directly below the 3:2 room artwork. The lower control row then
    // belongs only to movement (left) and the paint board (right).
    const roomBottom = this.cam.oy + VIEW_HEIGHT * this.cam.scale;
    return {
      x: Math.round((this.cam.w - w) / 2),
      y: Math.min(this.cam.h - 20 - h, Math.round(roomBottom + 14)),
      w,
      h,
    };
  }

  private isPortraitPhone(): boolean {
    return this.cam.w < this.cam.h && this.cam.w <= 760;
  }

  private startHiderOnboardingIfReady(time = performance.now()): void {
    if (
      this.active
      && this.mode === "hider"
      && this.phase === "playing"
      && !this.roomLoading
      && !this.hiderOnboardingDismissed
      && this.hiderOnboardingStartedAt === null
    ) {
      this.hiderOnboardingStartedAt = time;
      this.hiderOnboardingLastFrameAt = 0;
    }
  }

  private hiderOnboardingActive(time = performance.now()): boolean {
    return this.active
      && this.mode === "hider"
      && this.phase === "playing"
      && !this.hiderOnboardingDismissed
      && this.hiderOnboardingStartedAt !== null
      && time - this.hiderOnboardingStartedAt < 8_000;
  }

  private drawHiderOnboarding(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();
    if (!this.hiderOnboardingActive(now)) return;

    const button = this.isPortraitPhone()
      ? this.portraitPaintButtonRect()
      : this.hiderActionRect();
    const cardW = Math.min(304, this.cam.w - 32);
    const cardH = 91;
    const cardX = Math.max(16, Math.min(this.cam.w - cardW - 16, button.x + button.size - cardW));
    const cardY = Math.max(72, button.y - cardH - 72);
    const pulse = .5 + .5 * Math.sin((now - (this.hiderOnboardingStartedAt ?? now)) / 220);
    const arrowStartX = cardX + cardW - 48;
    const arrowStartY = cardY + cardH + 3;
    const arrowTipX = button.x + button.size * .45;
    const arrowTipY = button.y - 7 - pulse * 7;
    const controlX = arrowTipX - 32 - pulse * 8;
    const controlY = arrowStartY + 28;

    ctx.save();
    roundRectPath(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fillStyle = "rgba(13, 16, 26, .9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(237, 207, 125, .7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f6ecd5";
    ctx.font = "700 13px Inter, system-ui, sans-serif";
    ctx.fillText(this.labels.hiderGuideLine1, cardX + 16, cardY + 23, cardW - 32);
    ctx.fillText(this.labels.hiderGuideLine2, cardX + 16, cardY + 46, cardW - 32);
    ctx.fillStyle = "#f0cf7a";
    ctx.fillText(this.labels.hiderGuideLine3, cardX + 16, cardY + 69, cardW - 32);

    ctx.beginPath();
    ctx.moveTo(arrowStartX, arrowStartY);
    ctx.quadraticCurveTo(controlX, controlY, arrowTipX, arrowTipY);
    ctx.strokeStyle = "#f0cf7a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(0, 0, 0, .65)";
    ctx.shadowBlur = 5;
    ctx.stroke();

    const angle = Math.atan2(arrowTipY - controlY, arrowTipX - controlX);
    const head = 13;
    ctx.beginPath();
    ctx.moveTo(arrowTipX, arrowTipY);
    ctx.lineTo(
      arrowTipX - Math.cos(angle - .55) * head,
      arrowTipY - Math.sin(angle - .55) * head,
    );
    ctx.moveTo(arrowTipX, arrowTipY);
    ctx.lineTo(
      arrowTipX - Math.cos(angle + .55) * head,
      arrowTipY - Math.sin(angle + .55) * head,
    );
    ctx.stroke();
    ctx.restore();
  }

  private drawButtons(ctx: CanvasRenderingContext2D): void {
    if (this.mode === "hider") {
      if (this.isPortraitPhone()) {
        // Mobile keeps movement and painting as the two bottom controls. Once
        // Studio has been opened, Done sits directly below the room artwork.
        const palette = this.portraitPaintButtonRect();
        this.drawPaintPaletteButton(ctx, palette.x, palette.y, palette.size);
        if (this.hud.paintVisited) {
          const done = this.portraitDoneButtonRect();
          this.drawButton(
            ctx,
            done.x,
            done.y,
            done.w,
            done.h,
            this.labels.hide,
            "hide",
            true,
            14,
            !this.hud.hideReady,
          );
        }
        return;
      }

      const action = this.hiderActionRect();
      if (!this.hud.paintVisited) {
        // First action: a single palette with the same footprint as the
        // joystick, making the start of the Hider flow unmistakable.
        this.drawPaintPaletteButton(ctx, action.x, action.y, action.size);
      } else {
        // After Studio has been visited, split that same footprint into a
        // smaller palette and the final publish action. The layout never grows
        // beyond the joystick's width or height.
        const gap = Math.max(6, Math.round(action.size * .05));
        const hideH = Math.max(38, Math.round(action.size * .29));
        const paletteSize = action.size - gap - hideH;
        const paletteX = action.x + Math.round((action.size - paletteSize) / 2);
        this.drawPaintPaletteButton(ctx, paletteX, action.y, paletteSize);
        this.drawButton(
          ctx,
          paletteX,
          action.y + paletteSize + gap,
          paletteSize,
          hideH,
          this.labels.hide,
          "hide",
          true,
          Math.max(11, Math.min(15, Math.round(action.size * .095))),
          !this.hud.hideReady,
        );
      }
    }
    // Seeker nav (lobby + report) now lives in the top-right HUD cluster (see
    // drawHud), mirroring the hider — nothing to draw here.
  }

  private drawReadyOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.mode !== "seeker") {
      ctx.save();
      ctx.fillStyle = "rgba(9, 12, 22, .5)";
      ctx.fillRect(0, 0, this.cam.w, this.cam.h);
      this.drawButton(ctx, this.cam.w / 2 - 90, this.cam.h / 2 - 32, 180, 64, this.labels.start, "start", true, 20);
      ctx.restore();
      return;
    }

    const W = this.cam.w;
    const H = this.cam.h;
    const avatarSize = Math.max(128, Math.min(192, H * .33));
    const buttonW = Math.min(200, W - 44);
    const buttonY = Math.min(H - 70, H / 2 + 100);
    const avatarY = Math.max(16, buttonY - avatarSize - 100);
    const copyY = avatarY + avatarSize + 18;

    ctx.save();
    ctx.fillStyle = "rgba(9, 12, 22, .5)";
    ctx.fillRect(0, 0, W, H);

    const curl = cachedImage(AVATAR_URLS.curl, this.redraw);
    if (curl.complete && curl.naturalWidth) {
      ctx.drawImage(curl, W / 2 - avatarSize / 2, avatarY, avatarSize, avatarSize);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, .85)";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#f4ead2";
    ctx.font = "650 15px Inter, system-ui, sans-serif";
    ctx.fillText(this.labels.seekerReadyLine1, W / 2, copyY);
    ctx.fillText(this.labels.seekerReadyLine2, W / 2, copyY + 21);
    ctx.fillStyle = "#f0cf7a";
    ctx.font = "800 18px Inter, system-ui, sans-serif";
    ctx.fillText(this.labels.seekerReadyCall, W / 2, copyY + 50);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    this.drawButton(ctx, W / 2 - buttonW / 2, buttonY, buttonW, 52, this.labels.start, "start", true, 18);
    ctx.restore();
  }

  private drawResultOverlay(ctx: CanvasRenderingContext2D): void {
    const W = this.cam.w;
    const H = this.cam.h;
    ctx.save();
    ctx.fillStyle = "rgba(9, 12, 22, .58)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f7efdb";
    ctx.font = "500 40px Georgia, serif";
    ctx.textBaseline = "middle";
    ctx.fillText(this.resultCard.title, W / 2, H / 2 - 54);
    if (this.resultCard.sub) {
      ctx.fillStyle = "#fff0bc";
      ctx.font = "600 18px Inter, system-ui, sans-serif";
      ctx.fillText(this.resultCard.sub, W / 2, H / 2 - 12);
    }
    this.drawButton(ctx, W / 2 - 110, H / 2 + 24, 220, 58, this.resultCard.actionLabel, "action", true, 18);
    ctx.restore();
  }

  // Gold primary / quiet secondary / dim disabled button; registers a hot
  // region by id unless disabled (a disabled button is inert).
  private drawButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, id: string, primary: boolean, fontSize = 15, disabled = false): void {
    ctx.save();
    roundRectPath(ctx, x, y, w, h, 12);
    if (disabled) {
      ctx.fillStyle = "rgba(20, 24, 38, .45)"; ctx.fill();
      ctx.strokeStyle = "rgba(237, 207, 125, .16)"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "rgba(240, 216, 140, .34)";
    } else if (primary) {
      ctx.fillStyle = "#e6c369"; ctx.fill();
      ctx.fillStyle = "#20180b";
    } else {
      ctx.fillStyle = "rgba(20, 24, 38, .72)"; ctx.fill();
      ctx.strokeStyle = "rgba(237, 207, 125, .5)"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#f0d88c";
    }
    ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.restore();
    if (!disabled) this.hotRegions.push({ x, y, w, h, id });
  }

  private measurePill(ctx: CanvasRenderingContext2D, text: string, font: string): number {
    ctx.font = font;
    return ctx.measureText(text).width + 24;
  }

  private drawPill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, font: string, h = 34): number {
    ctx.save();
    ctx.font = font;
    const w = ctx.measureText(text).width + 24;
    ctx.fillStyle = "rgba(13, 16, 26, .72)";
    roundRectPath(ctx, x, y, w, h, 999);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + 12, y + h / 2 + 1);
    ctx.restore();
    return w;
  }

  private drawLiveStateButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    live: boolean,
  ): void {
    ctx.save();
    roundRectPath(ctx, x, y, w, h, 12);
    ctx.fillStyle = "rgba(13, 16, 26, .72)";
    ctx.fill();
    ctx.strokeStyle = live ? "rgba(228, 189, 100, .65)" : "rgba(190, 185, 174, .3)";
    ctx.lineWidth = this.hoveredUi === "live-state" ? 2 : 1;
    ctx.stroke();

    const dotX = x + 16;
    const cy = y + h / 2;
    if (live) {
      const pulse = .5 + .5 * Math.sin(performance.now() / 420);
      ctx.beginPath();
      ctx.arc(dotX, cy, 5 + pulse * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(228, 189, 100, ${.05 + pulse * .08})`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(dotX, cy, 3.8, 0, Math.PI * 2);
    ctx.fillStyle = live ? "#ebca73" : "#6c675e";
    ctx.fill();
    ctx.font = "850 12px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = live ? "#f2d685" : "#aaa18e";
    ctx.fillText(label, x + 27, cy + 1, Math.max(1, w - 34));
    ctx.restore();
    this.hotRegions.push({ x, y, w, h, id: "live-state" });
  }

  private drawPaintPaletteButton(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.save();
    roundRectPath(ctx, x, y, size, size, 20);
    ctx.fillStyle = "rgba(13, 16, 26, .82)";
    ctx.fill();
    ctx.strokeStyle = "rgba(237, 207, 125, .72)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const cx = x + size / 2;
    const cy = y + size / 2;
    const scale = size / 90;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 29 * scale, 22 * scale, -.22, 0, Math.PI * 2);
    ctx.moveTo(cx + 26 * scale, cy + 9 * scale);
    ctx.arc(cx + 19 * scale, cy + 9 * scale, 7 * scale, 0, Math.PI * 2);
    ctx.fillStyle = "#eadbb9";
    ctx.fill("evenodd");

    const dots = [
      [cx - 14 * scale, cy - 8 * scale, "#36c8c4"],
      [cx - 2 * scale, cy - 14 * scale, "#efc862"],
      [cx + 11 * scale, cy - 9 * scale, "#ef806f"],
      [cx - 8 * scale, cy + 5 * scale, "#a98bea"],
      [cx + 6 * scale, cy + 7 * scale, "#5d8fcb"],
    ] as const;
    for (const [dx, dy, color] of dots) {
      ctx.beginPath();
      ctx.arc(dx, dy, 4.2 * scale, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.restore();
    this.hotRegions.push({ x, y, w: size, h: size, id: "paint" });
  }

  private drawProp(instance: PropInstance, x: number, image: HTMLImageElement): void {
    const spec = PROP_SPECS[instance.modelId];
    if (!spec || !image.complete || !image.naturalWidth) return;
    const bias = instance.depthBias ?? 0;
    if (!spec.surface && spec.shadowWidth > 0) {
      if (this.livePainting) {
        this.drawFeatheredShadow(x + 10, instance.y + 4 + bias, spec.shadowWidth / 2, spec.shadowDepth / 2, -0.18, "23, 25, 36");
      } else {
        this.ctx.save();
        this.ctx.fillStyle = "rgba(23, 25, 36, .28)";
        this.ctx.beginPath();
        this.ctx.ellipse(x + 10, instance.y + 4 + bias, spec.shadowWidth / 2, spec.shadowDepth / 2, -0.18, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    }
    this.ctx.save();
    if (instance.rotation === 180) {
      this.ctx.translate(x, 0);
      this.ctx.scale(-1, 1);
      this.ctx.translate(-x, 0);
    }
    const y = spec.surface ? instance.y - spec.height / 2 : instance.y - spec.height;
    this.ctx.drawImage(image, x - spec.width / 2, y, spec.width, spec.height);
    this.ctx.restore();
  }

  private drawAvatar(source: CanvasImageSource): void {
    const image = source as HTMLImageElement;
    if (image instanceof HTMLImageElement && (!image.complete || !image.naturalWidth)) return;
    this.ctx.save();
    if (this.livePainting) {
      this.drawFeatheredShadow(this.target.x + 5, this.target.y + 6, 25, 8, 0, "18, 21, 31");
    } else {
      this.ctx.fillStyle = "rgba(18, 21, 31, .3)";
      this.ctx.beginPath();
      this.ctx.ellipse(this.target.x + 5, this.target.y + 6, 25, 8, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }
    if (this.targetFacing > 0) {
      this.ctx.translate(this.target.x, 0);
      this.ctx.scale(-1, 1);
      this.ctx.translate(-this.target.x, 0);
    }
    // Hider movement keeps its established draw-calm optimization. Seeker
    // movement must never freeze the remote Hider's Live avatar animation.
    const displaySource = this.livePainting?.marks.length
      && (this.mode === "seeker" || !this.actorMoving)
      ? this.getLiveAvatarRenderer().render(
        source,
        this.livePainting,
        Math.max(0, performance.now() - this.liveStartedAt) / 1_000,
      )
      : source;
    this.ctx.drawImage(displaySource, this.target.x - 50, this.target.y - 82, 100, 100);
    this.ctx.restore();
  }

  private drawExplorer(source: HTMLImageElement): void {
    if (!source.complete || !source.naturalWidth) return;
    const { x, y } = this.explorer;
    const inspection = this.inspectionPoint();
    this.ctx.save();
    if (this.livePainting) {
      this.drawFeatheredShadow(x, y + 5, 29, 10, 0, "236, 191, 82");
    } else {
      this.ctx.fillStyle = "rgba(236, 191, 82, .23)";
      this.ctx.beginPath();
      this.ctx.ellipse(x, y + 5, 29, 10, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.strokeStyle = "rgba(255, 224, 139, .92)";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.ellipse(inspection.x, inspection.y, 48, 54, 0, 0, Math.PI * 2);
    this.ctx.stroke();
    if (this.explorerFacing > 0) {
      this.ctx.translate(x, 0);
      this.ctx.scale(-1, 1);
      this.ctx.translate(-x, 0);
    }
    this.ctx.drawImage(source, x - 40, y - 70, 80, 80);
    this.ctx.restore();
  }

  // Live Painting makes authored pigment the visual focus. Generated contact
  // shadows therefore peak at only 5% opacity and feather fully transparent at
  // their edge instead of reading as hard CGI ellipses.
  private drawFeatheredShadow(x: number, y: number, rx: number, ry: number, rotation: number, rgb: string): void {
    const context = this.ctx;
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.scale(rx, ry);
    const feather = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    feather.addColorStop(0, `rgba(${rgb}, .05)`);
    feather.addColorStop(0.5, `rgba(${rgb}, .035)`);
    feather.addColorStop(0.78, `rgba(${rgb}, .014)`);
    feather.addColorStop(1, `rgba(${rgb}, 0)`);
    context.fillStyle = feather;
    context.beginPath();
    context.arc(0, 0, 1, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  private portalExit(actor: ActorPosition, dx: number, dy: number): ActorPosition | null {
    const nextWorld = {
      x: actor.roomIndex * VIEW_WIDTH + actor.x + dx,
      y: actor.y + dy,
    };
    const portals = portalsFor(this.artHouse);
    for (let index = 0; index < portals.length; index += 1) {
      const portal = portals[index];
      if (!portal) continue;
      if (dx > 0 && actor.roomIndex === index && pointInPortalEntry(nextWorld, portal.leftEntryShape, portal.leftEntry)) {
        return {
          roomIndex: (index + 1) as RoomIndex,
          x: portal.rightExit.x - (index + 1) * VIEW_WIDTH,
          y: portal.rightExit.y,
        };
      }
      if (dx < 0 && actor.roomIndex === index + 1 && pointInPortalEntry(nextWorld, portal.rightEntryShape, portal.rightEntry)) {
        return {
          roomIndex: index as RoomIndex,
          x: portal.leftExit.x - index * VIEW_WIDTH,
          y: portal.leftExit.y,
        };
      }
    }
    return null;
  }

  private switchRoom(roomIndex: RoomIndex): void {
    const changed = this.roomIndex !== roomIndex;
    this.roomIndex = roomIndex;
    if (changed) {
      this.roomFrameDirty = true;
      this.syncLiveRendererLifecycle();
      // This notification belongs to the destination room. It bypasses the
      // normal 150ms anti-flash delay, then defers destination rendering by
      // one rAF so the existing painting-chameleon overlay reaches the screen
      // before JSON parsing / source sampling / atlas construction begins.
      if (this.livePainting && supportsCuratedLiveProject(this.artHouse, roomIndex)) {
        this.setRoomLoading(true, true);
        this.roomTransitionPending = true;
        requestAnimationFrame(() => {
          if (!this.roomTransitionPending) return;
          this.roomTransitionPending = false;
          this.roomFrameDirty = true;
          this.render();
        });
      }
    }
    if (changed) this.roomChangeHandler?.(roomIndex);
  }

  /** Capture only the scene under the inspection reticle, before any HUD is
   * drawn. The buffer stays small (roughly 192×108 world px at device scale),
   * so Close Look never needs a full-screen offscreen copy. */
  private captureInspectionFrame(): void {
    if (!SEEKER_CLOSE_LOOK_ENABLED) return;
    const inspectionFrame = this.inspectionFrame ??= document.createElement("canvas");
    const point = this.inspectionPoint();
    const sourceWidth = this.mode === "hider" ? HIDER_INSPECTION_WIDTH : INSPECTION_SOURCE_WIDTH;
    const sourceHeight = this.mode === "hider" ? HIDER_INSPECTION_HEIGHT : INSPECTION_SOURCE_HEIGHT;
    const sourceX = Math.max(0, Math.min(VIEW_WIDTH - sourceWidth, point.x - sourceWidth / 2));
    const sourceY = Math.max(0, Math.min(VIEW_HEIGHT - sourceHeight, point.y - sourceHeight / 2));
    const ready = point.roomIndex === this.roomIndex;
    this.inspectionFrameCrop = { ready, sourceX, sourceY, sourceWidth, sourceHeight };

    const k = this.cam.scale * this.dpr;
    const width = Math.max(1, Math.round(sourceWidth * k));
    const height = Math.max(1, Math.round(sourceHeight * k));
    if (inspectionFrame.width !== width) inspectionFrame.width = width;
    if (inspectionFrame.height !== height) inspectionFrame.height = height;
    const context = inspectionFrame.getContext("2d")!;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    if (!ready) return;
    context.imageSmoothingEnabled = true;
    context.drawImage(
      this.canvas,
      (this.cam.ox + sourceX * this.cam.scale) * this.dpr,
      (this.cam.oy + sourceY * this.cam.scale) * this.dpr,
      sourceWidth * k,
      sourceHeight * k,
      0,
      0,
      width,
      height,
    );
  }

  private updateInspection(): void {
    if (this.mode === "seeker" && !SEEKER_CLOSE_LOOK_ENABLED) return;
    const canvas = this.inspectionCanvas;
    if (!canvas) return;
    const context = canvas.getContext("2d")!;
    const point = this.inspectionPoint();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#0c1020";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (point.roomIndex !== this.roomIndex) return;

    // Seeker: same crop as the tap-to-score path (INSPECTION_SOURCE_*), so the
    // card and a tap hit the same world pixels. Hider: a tighter crop zoomed in
    // on their own chameleon (display only — no scoring), since on phones the
    // Close Look is how they check the paint's blend up close.
    const sourceWidth = this.mode === "hider" ? HIDER_INSPECTION_WIDTH : INSPECTION_SOURCE_WIDTH;
    const sourceHeight = this.mode === "hider" ? HIDER_INSPECTION_HEIGHT : INSPECTION_SOURCE_HEIGHT;
    const sourceX = Math.max(0, Math.min(VIEW_WIDTH - sourceWidth, point.x - sourceWidth / 2));
    const sourceY = Math.max(0, Math.min(VIEW_HEIGHT - sourceHeight, point.y - sourceHeight / 2));
    context.imageSmoothingEnabled = true;
    context.drawImage(this.canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    if (this.mode !== "seeker") return;

    const markerX = (point.x - sourceX) / sourceWidth * canvas.width;
    const markerY = (point.y - sourceY) / sourceHeight * canvas.height;
    context.strokeStyle = "rgba(246, 215, 130, .88)";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(markerX, markerY, 48 / sourceWidth * canvas.width, 54 / sourceHeight * canvas.height, 0, 0, Math.PI * 2);
    context.moveTo(markerX - 9, markerY);
    context.lineTo(markerX + 9, markerY);
    context.moveTo(markerX, markerY - 9);
    context.lineTo(markerX, markerY + 9);
    context.stroke();
  }

  private inspectionPoint(): ActorPosition {
    if (this.mode === "hider") {
      return {
        roomIndex: this.target.roomIndex,
        x: this.target.x,
        y: this.target.y - 38,
      };
    }
    return {
      roomIndex: this.explorer.roomIndex,
      x: Math.max(0, Math.min(VIEW_WIDTH, this.explorer.x + this.explorerAim.x * 78)),
      y: Math.max(0, Math.min(VIEW_HEIGHT, this.explorer.y - 38 + this.explorerAim.y * 62)),
    };
  }
}

function pointInRect(point: { x: number; y: number }, rect: { x: number; y: number; w: number; h: number }): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.w
    && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function keyDir(code: string): "left" | "right" | "up" | "down" | null {
  if (code === "ArrowLeft" || code === "KeyA") return "left";
  if (code === "ArrowRight" || code === "KeyD") return "right";
  if (code === "ArrowUp" || code === "KeyW") return "up";
  if (code === "ArrowDown" || code === "KeyS") return "down";
  return null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || (target instanceof HTMLElement && target.isContentEditable);
}

// Match snake-lab's deterministic door semantics: a supplied 3+ point shape
// is the whole trigger; legacy rooms without one retain their rectangular
// entry. Painterly has no map editor, so it only needs this tiny runtime half
// of the polygon-door feature.
function pointInPortalEntry(
  point: { x: number; y: number },
  shape: readonly { x: number; y: number }[] | undefined,
  fallbackRect: { x: number; y: number; w: number; h: number },
): boolean {
  if (!shape || shape.length < 3) return pointInRect(point, fallbackRect);
  let inside = false;
  for (let index = 0, previous = shape.length - 1; index < shape.length; previous = index++) {
    const current = shape[index]!;
    const prior = shape[previous]!;
    if ((current.y > point.y) !== (prior.y > point.y)
      && point.x < (prior.x - current.x) * (point.y - current.y) / (prior.y - current.y) + current.x) {
      inside = !inside;
    }
  }
  return inside;
}
