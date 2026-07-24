import "./styles.css";
import { apiFetch, usesCrossOriginApi } from "./api";
import { initializeI18n, locale, t } from "./i18n";
import { artRoomFor } from "./game/artRoom";
import { encodeAvatar } from "./game/avatarCodec";
import { GameCanvas } from "./game/GameCanvas";
import { ART_HOUSE_THUMBNAILS, AVATAR_URLS, lobbyRoomThumbnail } from "./game/gameData";
import { moveSpeedFor } from "./game/interaction.js";
import { PaintStudio } from "./game/PaintStudio";
import { TurnstileGate } from "./turnstile";
import {
  defaultLiveBrushForRoom,
  LIVE_FLOW_DEFAULT,
  LIVE_FLOW_MAX,
  LIVE_FLOW_MIN,
  LIVE_SIZE_DEFAULT,
  LIVE_SIZE_MAX,
  LIVE_SIZE_MIN,
  LIVE_STRENGTH_DEFAULT,
  MAX_LIVE_PAINT_MARKS,
} from "./game/livePainting";
import {
  ART_HOUSE_IDS,
  LIVE_BRUSH_IDS,
  type ArtHouseId,
  type ChallengePayloadV1,
  type LiveBrushId,
  type LivePaintMark,
  type PoseId,
} from "./game/types";
import { randomRoomName } from "./roomNames.js";
import encodeQR from "qr";

// The share/manage screen is a modal (#manage-dialog), not a view. "explore-view"
// is the Lobby. Everything switches in-page — no full-page navigations.
const views = ["create-view", "seeker-view", "explore-view", "admin-view", "error-view"] as const;
// This must precede GameCanvas construction: its first render begins fetching
// the room background, props and actors. Request the loader's flat avatar first;
// all living-colour effects are inline and can start the instant it decodes.
const loaderArtReady = primeLoaderArt();
let hiderScene: GameCanvas;
let seekerScene: GameCanvas;
const studio = new PaintStudio();
const turnstile = new TurnstileGate();
// Where the seeker's on-canvas result button goes: home after a win ("my turn
// →"), lobby after a loss ("back to lobby →").
let seekerResultNav: "home" | "lobby" = "lobby";

const draft = {
  artHouse: "van-gogh-house" as ArtHouseId,
  surface: randomSmallInt(3) as 0 | 1 | 2,
  artSeed: randomSeed(),
  pose: "stand" as PoseId,
  paintedCanvas: null as HTMLCanvasElement | null,
  customColors: [] as string[],
  camoEnabled: true,
  // Both released Live houses (layers 1 and 6) begin breathing immediately.
  // Houses without Live Painting still normalize this to false.
  liveEnabled: Boolean(artRoomFor("van-gogh-house").livePainting),
  liveBrush: defaultLiveBrushForRoom(artRoomFor("van-gogh-house")) as LiveBrushId,
  liveMarks: [] as LivePaintMark[],
  liveSize: LIVE_SIZE_DEFAULT,
  liveFlow: LIVE_FLOW_DEFAULT,
  liveStrength: LIVE_STRENGTH_DEFAULT,
  saved: false,
  paintVisited: false,
  roomName: randomRoomName(),
  // Share on Explore. Was the #public-challenge checkbox; now the on-canvas
  // "share" toggle in the hider HUD.
  isPublic: true,
};

interface SeekerState {
  token: string;
  payload: ChallengePayloadV1;
  expiresAt: number;
  attemptId: string;
  startedAt: number;
  completed: boolean;
  misses: number;
  roomName: string;
}

// A seek has no clock. The shared challenge link still expires normally, and
// each round keeps three Close Look attempts.
const MAX_MISSES = 3;

let seekerState: SeekerState | null = null;
// The hide currently shown in the manage modal (set when the modal opens), so
// its controls don't depend on the URL.
let manageToken: string | null = null;
let manageHiderKey: string | null = null;
// Share-modal listing state (the share-on-Lobby toggle lives in the modal now).
let manageListed = false;
let manageExpiresAt: number | null = null;
let account: Account | null = null;
let pendingArtHouse: ArtHouseId | null = null;
let exploreSearchTimer = 0;
let exploreSearchRequest = 0;
// The last /api/explore payload is held so each lane's refresh pages through it
// locally — no re-fetch, no DB. Offsets advance by EXPLORE_LANE_SIZE and wrap.
type LaneKey = "tricky" | "fresh" | "surprise";
const EXPLORE_LANE_SIZE = 10;
let exploreFeeds: Record<LaneKey, ExploreChallenge[]> | null = null;
const exploreOffsets: Record<LaneKey, number> = { tricky: 0, fresh: 0, surprise: 0 };
const EXPLORE_LANES: Record<LaneKey, { listId: string; emptyKey: "explore.trickyEmpty" | "explore.freshEmpty" | "explore.surpriseEmpty" }> = {
  tricky: { listId: "explore-tricky-list", emptyKey: "explore.trickyEmpty" },
  fresh: { listId: "explore-fresh-list", emptyKey: "explore.freshEmpty" },
  surprise: { listId: "explore-surprise-list", emptyKey: "explore.surpriseEmpty" },
};
// All houses in the itch sampler are playable without sign-in or purchase.
const ACCOUNT_REQUIRED_HOUSES = new Set<ArtHouseId>();
const FREE_HOUSES = new Set<ArtHouseId>(["van-gogh-house", "monet-garden-house", "outdoor-masters-journey"]);
// The itch build is intentionally anonymous. Account cookies are third-party
// cookies inside itch's iframe, so exposing an OTP screen here would promise a
// sign-in that browsers may immediately discard. Hiding it keeps the sampler
// fully playable while the primary site remains the account home.
const EMBEDDED_SAMPLER = usesCrossOriginApi();
const isPaidHouse = (artHouse: ArtHouseId): boolean => !FREE_HOUSES.has(artHouse);
// Whether the signed-in account has bought the one-time unlock (grants all paid
// houses). Loaded from the server; false when logged out.
let hasUnlock = false;
const houseUnlocked = (artHouse: ArtHouseId): boolean => !isPaidHouse(artHouse) || hasUnlock;
// Store catalog from /api/config: the unlock price (for the confirm modal's
// blurb) + whether real checkout is wired (Stripe vs local dev-grant path).
let unlockPriceCents: number | null = null;
let storeCheckoutLive = false;
let storeDevGrant = false;

document.addEventListener("DOMContentLoaded", () => void initializeApp());

async function initializeApp(): Promise<void> {
  await initializeI18n();
  // This await is intentional: GameCanvas requests every room image from its
  // constructor. Do not construct either scene until flat.png has decoded (or
  // failed and left the inline fallback visible), so the little dragon is the
  // first artwork the browser can paint and receives network priority.
  await loaderArtReady;
  hiderScene = new GameCanvas(element<HTMLCanvasElement>("hider-canvas"), "hider");
  seekerScene = new GameCanvas(element<HTMLCanvasElement>("seeker-canvas"), "seeker");
  hydrateArtHouseImages();
  void loadStoreConfig();
  wireCanvasLoaders();
  hiderScene.setRoomTexture(draft.surface, draft.artSeed);
  setDraftLiveEnabled(draft.liveEnabled);
  bindMovementControls();
  bindArtHouseControls();
  bindExploreSearch();
  bindExploreRefresh();
  bindLobbyTabs();
  bindAuthControls();
  bindManageControls();
  bindReportControls();
  bindAdminControls();
  bindGlobalNav();
  bindHistoryNav();
  setupCanvasFit();
  document.addEventListener("pc:localechange", () => {
    syncArtHouseButtons();
    syncAccountUi();
    applyHiderLabels();
    refreshHiderHud();
    applySeekerLabels();
    if (!element<HTMLElement>("explore-view").hidden) {
      void loadExplore();
      const query = element<HTMLInputElement>("explore-search-input").value.trim();
      if (query) void runExploreSearch(query);
    }
  });
  refreshHiderHud();
  void checkHealth();
  if (EMBEDDED_SAMPLER) syncAccountUi();
  else await loadAccount();
  await routePage();
}

// The create screen's controls (paint / hide / lobby / share / room reshuffle)
// live on the canvas now — see hiderScene.enablePlayUi in bindMovementControls.

// Reshuffle the room name + look (was the "↻" room-name button). One control
// refreshes both the name and the room's surface/seed.
function rerollRoom(): void {
  let next = randomRoomName();
  for (let attempt = 0; attempt < 4 && next === draft.roomName; attempt += 1) next = randomRoomName();
  draft.roomName = next;
  draft.surface = ((draft.surface + 1) % 3) as 0 | 1 | 2;
  draft.artSeed = randomSeed();
  hiderScene.setRoomTexture(draft.surface, draft.artSeed);
  hiderScene.setHudState({ roomName: draft.roomName });
}

// On-canvas hider labels (localized here so i18n stays in one place; re-applied
// on locale change).
function applyHiderLabels(): void {
  hiderScene.setLabels({
    brand: t("brand.name"),
    closeLook: t("hider.closeLook"),
    lobby: t("explore.cta"),
    live: t("studio.liveToggle"),
    paint: t("hider.paint"),
    hide: t("studio.doneHide"),
    hiderGuideLine1: t("hider.guideLine1"),
    hiderGuideLine2: t("hider.guideLine2"),
    hiderGuideLine3: t("hider.guideLine3"),
  });
}

// Re-push the hider HUD's dynamic state. The pulse-dot button is the Live
// Painting switch when the selected art room supports Live.
function refreshHiderHud(): void {
  hiderScene.setHudState({
    roomName: draft.roomName,
    liveAvailable: Boolean(artRoomFor(draft.artHouse).livePainting),
    liveEnabled: draft.liveEnabled,
    paintVisited: draft.paintVisited,
    hideReady: draft.saved,
  });
}

// Single source of truth for both Live controls: the on-canvas pulse button and
// Hider Studio toggle call this same state transition.
function setDraftLiveEnabled(enabled: boolean): void {
  const liveAvailable = Boolean(artRoomFor(draft.artHouse).livePainting);
  draft.liveEnabled = liveAvailable && enabled;
  hiderScene.setLivePainting(draft.liveEnabled
    ? { marks: draft.liveMarks, strength: draft.liveStrength }
    : null);
  hiderScene.setHudState({ liveAvailable, liveEnabled: draft.liveEnabled });
}

function bindArtHouseControls(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-art-house-button]").forEach(button => {
    button.addEventListener("click", () => {
      const artHouse = parseArtHouse(button.dataset.artHouseButton);
      if (artHouse) requestHomeArtHouse(artHouse);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-create-art-house]").forEach(button => {
    button.addEventListener("click", () => {
      const artHouse = parseArtHouse(button.dataset.createArtHouse);
      if (artHouse) beginExploreCreation(artHouse);
    });
  });
  element("unlock-pay").addEventListener("click", () => void confirmUnlock());
  element("unlock-close").addEventListener("click", closeUnlockModal);
  element("unlock-cancel").addEventListener("click", closeUnlockModal);
}

// Kick off loader art before any other await. The original flat PNG supplies
// the silhouette, static ivory filter input and natural eye overlay.
function primeLoaderArt(): Promise<void> {
  // The loader itself is inline and can appear before any network image. Keep
  // it up continuously while flat.png decodes and while GameCanvas later loads
  // the room; wireCanvasLoaders adopts this already-visible overlay.
  document.querySelectorAll<HTMLElement>("[data-canvas-loader]").forEach(loader => {
    loader.hidden = false;
    loader.closest<HTMLElement>(".play-viewport")?.setAttribute("aria-busy", "true");
  });
  // Some embedded WebViews fail to paint <symbol><use> trees containing
  // animated masks. Clone the authored defs + artwork into each small loader,
  // giving every SVG local IDs so filters/masks/gradients never cross SVG roots.
  const symbol = document.querySelector<SVGSymbolElement>("#loader-live-chameleon");
  const definitions = document.querySelector<SVGDefsElement>(".loader-art-defs > defs");
  const artwork = symbol ? [...symbol.children] : [];
  if (definitions && artwork.length) {
    document.querySelectorAll<SVGSVGElement>(".canvas-loader-glyph").forEach((svg, index) => {
      const defsCopy = definitions.cloneNode(true) as SVGDefsElement;
      const artCopies = artwork.map(element => element.cloneNode(true) as SVGElement);
      const idMap = new Map<string, string>();
      defsCopy.querySelectorAll<SVGElement>("[id]").forEach(element => {
        const oldId = element.id;
        const localId = `${oldId}-${index}`;
        idMap.set(oldId, localId);
        element.id = localId;
      });
      const rewriteReferences = (root: SVGElement): void => {
        [root, ...root.querySelectorAll<SVGElement>("*")].forEach(element => {
          for (const attribute of ["filter", "mask", "clip-path", "fill", "stroke"]) {
            const value = element.getAttribute(attribute);
            if (!value) continue;
            element.setAttribute(attribute, value.replace(/url\(#([^)]+)\)/g, (match, id: string) => {
              const localId = idMap.get(id);
              return localId ? `url(#${localId})` : match;
            }));
          }
        });
      };
      rewriteReferences(defsCopy);
      artCopies.forEach(rewriteReferences);
      svg.replaceChildren(defsCopy, ...artCopies);
    });
  }
  const probe = new Image();
  probe.decoding = "async";
  probe.fetchPriority = "high";
  const ready = new Promise<void>(resolve => {
    const finish = (): void => {
      document.documentElement.style.setProperty("--loader-art-ready", "1");
      resolve();
    };
    probe.onload = () => {
      // decode() never settles in some contexts (throttled/headless tabs,
      // memory-starved devices) — the bytes are here, so don't let a stuck
      // decode hold the whole boot. Belt: cap the wait at a beat.
      const decodeFailsafe = window.setTimeout(finish, 1_500);
      const decoded = typeof probe.decode === "function" ? probe.decode().catch(() => undefined) : Promise.resolve();
      void decoded.then(() => {
        window.clearTimeout(decodeFailsafe);
        finish();
      });
    };
    // The inline ivory fallback remains visible if this one asset fails; never
    // hold the entire game behind a broken image response.
    probe.onerror = () => resolve();
    // Suspenders: a connection that hangs without ever firing load/error must
    // not freeze the app either — boot on with the inline fallback.
    window.setTimeout(resolve, 8_000);
  });
  // Start the high-priority request before assigning the same URL to the SVG
  // copies. They share the response, but the probe controls decode readiness.
  probe.src = AVATAR_URLS.flat;
  document.querySelectorAll<SVGImageElement>("[data-loader-mask]").forEach(image => {
    image.setAttribute("href", AVATAR_URLS.flat);
  });
  return ready;
}

interface CanvasLoaderState {
  loader: HTMLElement;
  viewport: HTMLElement;
  roomLoading: boolean;
  roomLoadingImmediate: boolean;
  taskCount: number;
  showTimer: number;
}

const canvasLoaderStates = new Map<string, CanvasLoaderState>();

function syncCanvasLoader(state: CanvasLoaderState): void {
  window.clearTimeout(state.showTimer);
  state.showTimer = 0;
  if (state.taskCount > 0 || (state.roomLoading && state.roomLoadingImmediate)) {
    state.loader.hidden = false;
    state.viewport.setAttribute("aria-busy", "true");
    return;
  }
  if (!state.roomLoading) {
    state.loader.hidden = true;
    state.viewport.removeAttribute("aria-busy");
    return;
  }
  // Cached rooms should never flash the loader. A deliberate async action such
  // as publishing skips this delay via taskCount above.
  state.showTimer = window.setTimeout(() => {
    if (!state.roomLoading || state.taskCount > 0) return;
    state.loader.hidden = false;
    state.viewport.setAttribute("aria-busy", "true");
  }, 150);
}

// Reuse the room loader for any real background task. The returned cleanup is
// idempotent so callers can always invoke it from `finally`.
function beginCanvasTask(canvasId: string): () => void {
  const state = canvasLoaderStates.get(canvasId);
  if (!state) return () => undefined;
  state.taskCount += 1;
  syncCanvasLoader(state);
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    state.taskCount = Math.max(0, state.taskCount - 1);
    syncCanvasLoader(state);
  };
}

// Show a painting-chameleon overlay while a room's background streams in. Each
// play scene drives its own viewport's loader; a small delay before showing
// means cached/instant rooms never flash it.
function wireCanvasLoaders(): void {
  const wire = (scene: GameCanvas, canvasId: string): void => {
    const viewport = document.getElementById(canvasId)?.closest<HTMLElement>(".play-viewport");
    const loader = viewport?.querySelector<HTMLElement>("[data-canvas-loader]");
    if (!viewport || !loader) return;
    const state: CanvasLoaderState = {
      loader,
      viewport,
      roomLoading: false,
      roomLoadingImmediate: false,
      taskCount: 0,
      showTimer: 0,
    };
    canvasLoaderStates.set(canvasId, state);
    scene.onLoadingChange((loading, immediate) => {
      state.roomLoading = loading;
      state.roomLoadingImmediate = immediate;
      syncCanvasLoader(state);
    });
  };
  wire(hiderScene, "hider-canvas");
  wire(seekerScene, "seeker-canvas");
}

function hydrateArtHouseImages(): void {
  document.querySelectorAll<HTMLImageElement>("[data-art-house-thumbnail]").forEach(image => {
    const artHouse = parseArtHouse(image.dataset.artHouseThumbnail);
    if (!artHouse) return;
    image.loading = "lazy";
    image.decoding = "async";
    image.src = ART_HOUSE_THUMBNAILS[artHouse];
  });
}

function requestHomeArtHouse(artHouse: ArtHouseId): void {
  if (ACCOUNT_REQUIRED_HOUSES.has(artHouse) && !account) {
    pendingArtHouse = artHouse;
    openAuthDialog();
    return;
  }
  selectArtHouse(artHouse);
}

function beginExploreCreation(artHouse: ArtHouseId): void {
  // Login is a separate gate from payment: monet/outdoor are free but still
  // login-required. Prompt sign-in for any login-gated house; the payment gate
  // (paid house + no unlock) is handled after login in enterOrUnlock.
  if (!account && ACCOUNT_REQUIRED_HOUSES.has(artHouse)) {
    pendingArtHouse = artHouse;
    openAuthDialog();
    return;
  }
  // In-page: switch to the create screen (unlocking the paid house first if
  // needed). No reload.
  void enterOrUnlock(artHouse);
}

function selectArtHouse(artHouse: ArtHouseId): void {
  if (draft.artHouse === artHouse) {
    syncArtHouseButtons();
    return;
  }
  resetHiderDraft(artHouse, false);
  if (location.pathname === "/") {
    const url = new URL(location.href);
    url.searchParams.set("art", artHouse);
    url.searchParams.delete("source");
    history.replaceState(history.state, "", `${url.pathname}${url.search}`);
  }
}

// Reset the create-screen draft to a fresh, unpainted chameleon for `artHouse`.
// `freshName` also rolls a new room name (for "my turn"/"make a new one").
function resetHiderDraft(artHouse: ArtHouseId, freshName: boolean): void {
  studio.close();
  draft.artHouse = artHouse;
  draft.surface = randomSmallInt(3) as 0 | 1 | 2;
  draft.artSeed = randomSeed();
  draft.pose = "stand";
  draft.paintedCanvas = null;
  draft.customColors = [];
  draft.camoEnabled = true;
  const liveAvailable = Boolean(artRoomFor(artHouse).livePainting);
  // Every released Live room starts on; the HUD/Studio switch can still turn it
  // off, and non-Live houses remain false through the same capability check.
  draft.liveEnabled = liveAvailable;
  draft.liveBrush = defaultLiveBrushForRoom(artRoomFor(artHouse));
  draft.liveMarks = [];
  draft.liveSize = LIVE_SIZE_DEFAULT;
  draft.liveFlow = LIVE_FLOW_DEFAULT;
  draft.liveStrength = LIVE_STRENGTH_DEFAULT;
  draft.saved = false;
  draft.paintVisited = false;
  if (freshName) draft.roomName = randomRoomName();
  hiderScene.setArtHouse(artHouse);
  hiderScene.resetActors();
  hiderScene.setRoomTexture(draft.surface, draft.artSeed);
  hiderScene.setAvatar(null, "stand");
  hiderScene.setLivePainting(draft.liveEnabled
    ? { marks: draft.liveMarks, strength: draft.liveStrength }
    : null);
  // Fresh state starts with one large palette. The publish button appears only
  // after Studio has been visited.
  hiderScene.setHudState({
    roomName: draft.roomName,
    liveAvailable,
    liveEnabled: draft.liveEnabled,
    paintVisited: false,
    hideReady: false,
    hint: "",
  });
  syncArtHouseButtons();
}

// Once the chameleon has any paint (incl. the starter camo), the on-canvas
// "hide" can publish — used both while painting and after "Back to room".
function markHidePaintReady(): void {
  const changed = !draft.saved || !draft.paintVisited;
  draft.saved = true;
  draft.paintVisited = true;
  // Paint preview can fire on every stroke. Only redraw the room HUD for the
  // one false→true readiness transition, not once per brush update.
  if (changed) hiderScene.setHudState({ paintVisited: true, hideReady: true });
}

function syncArtHouseButtons(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-art-house-button]").forEach(button => {
    const active = button.dataset.artHouseButton === draft.artHouse;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function bindMovementControls(): void {
  // Touch devices oversteer a joystick, so walk the chameleon slower there.
  const coarsePointer = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const speed = moveSpeedFor({ coarsePointer });
  hiderScene.setMoveSpeed(speed);
  seekerScene.setMoveSpeed(speed);
  // Both scenes are fully on-canvas: the joystick, Close Look, HUD, buttons and
  // overlays are drawn + handled by GameCanvas (no DOM control shell). The hider
  // maps its buttons/pills to the create actions; the seeker to the seek loop.
  hiderScene.enablePlayUi({
    paint: openPaintStudio,
    hide: () => void publishChallenge(),
    lobby: () => goLobby(),
    reroll: rerollRoom,
    live: () => setDraftLiveEnabled(!draft.liveEnabled),
  });
  applyHiderLabels();
  // Desktop studio is a side panel: as the chameleon walks (room + joystick stay
  // live), keep the studio's room-reference backdrop tracking its position.
  hiderScene.onTargetMove(() => studio.refreshBackdrop());
  hiderScene.onMovementChange(moving => studio.setMovementCalm(moving));
  seekerScene.onInspect((x, y, hit) => void handleInspection(x, y, hit));
  seekerScene.onRoomChange(() => {
    if (seekerState?.startedAt && !seekerState.completed) {
      seekerScene.setHudState({ hint: t("seeker.keepCircle") });
    }
  });
  seekerScene.enablePlayUi({
    start: startSeeking,
    home: goHome,
    lobby: () => goLobby(),
    report: openReportPanel,
    action: seekerResultAction,
  });
  applySeekerLabels();
  studio.onStateChange(open => {
    // On ≤760px the studio is fullscreen and covers the room — pause the
    // room's live loop underneath (the desktop side panel keeps it visible
    // and breathing).
    hiderScene.setLiveAnimationPaused(open && matchMedia("(max-width: 760px)").matches);
    // Left the studio (e.g. "Back to room") with a painted chameleon → the
    // on-canvas "hide" is ready to publish once the hider positions it.
    if (!open && draft.paintedCanvas) markHidePaintReady();
  });
}

function openPaintStudio(): void {
  draft.paintVisited = true;
  hiderScene.setHudState({ paintVisited: true, hideReady: draft.saved });
  studio.open({
    room: artRoomFor(draft.artHouse),
    pose: draft.pose,
    sessionId: `local-hider-draft:${draft.artHouse}`,
    customColors: draft.customColors,
    maskUrls: AVATAR_URLS,
    defaultCamo: draft.camoEnabled,
    liveEnabled: draft.liveEnabled,
    liveBrush: draft.liveBrush,
    liveMarks: draft.liveMarks,
    liveSize: draft.liveSize,
    liveFlow: draft.liveFlow,
    liveStrength: draft.liveStrength,
    liveSeed: draft.artSeed,
    onPreview: (pose, canvas, customColors) => {
      draft.pose = pose;
      draft.customColors = customColors;
      draft.paintedCanvas = copyCanvas(canvas);
      hiderScene.setAvatar(draft.paintedCanvas, pose);
      hiderScene.setLivePainting(draft.liveEnabled
        ? { marks: draft.liveMarks, strength: draft.liveStrength }
        : null);
      // As soon as there's paint, the home "hide" can publish (position first,
      // then paint publishes).
      markHidePaintReady();
    },
    onCamoChange: enabled => { draft.camoEnabled = enabled; },
    onLiveChange: (value, tools) => {
      draft.liveBrush = tools.brush;
      draft.liveSize = tools.size;
      draft.liveFlow = tools.flow;
      draft.liveStrength = tools.strength;
      if (value) {
        draft.liveMarks = value.marks;
      }
      setDraftLiveEnabled(Boolean(value));
    },
    // Finish painting and return to the room. The Hider chooses the final
    // position, then publishes with the on-canvas "done hiding" button.
    onLock: (pose, canvas) => {
      draft.pose = pose;
      draft.paintedCanvas = copyCanvas(canvas);
      hiderScene.setAvatar(draft.paintedCanvas, pose);
      hiderScene.setLivePainting(draft.liveEnabled
        ? { marks: draft.liveMarks, strength: draft.liveStrength }
        : null);
      markHidePaintReady();
    },
    onLeave: () => studio.close(),
    sampleRoomColor: async (x, y) => hiderScene.sampleColor(x, y),
    // A crop of the room the chameleon is standing in, shown behind the paper
    // so its eyedropper can sample room colors even when the studio covers the
    // game canvas (the mobile case). Read-only reference; never published.
    roomBackdrop: size => hiderScene.roomBackdrop(size),
  });
}

async function publishChallenge(): Promise<void> {
  if (!draft.saved || !draft.paintedCanvas) return;
  const finishThinking = beginCanvasTask("hider-canvas");
  // Progress is shown on the on-canvas hint line; the old DOM publish button is
  // gone.
  hiderScene.setHudState({ hint: t("hider.security") });
  try {
    const turnstileToken = await turnstile.token("publish");
    hiderScene.setHudState({ hint: t("hider.compressing") });
    const avatarData = await encodeAvatar(draft.paintedCanvas);
    const target = hiderScene.getTarget();
    const isPublic = draft.isPublic;
    // The clear room shot is for this local Hider share modal only. Lobby cards
    // use authored house art, so no per-challenge image is uploaded to D1.
    const shareImage = hiderScene.shareSnapshot();
    const payload: ChallengePayloadV1 = {
      version: 1,
      artHouse: draft.artHouse,
      surface: draft.surface,
      artSeed: draft.artSeed,
      roomIndex: target.roomIndex,
      x: target.x,
      y: target.y,
      pose: draft.pose,
      avatarData,
      ...(draft.liveEnabled ? {
        livePainting: { marks: draft.liveMarks, strength: draft.liveStrength },
      } : {}),
    };
    hiderScene.setHudState({ hint: t("hider.linking") });
    const result = await api<CreateChallengeResponse>("/api/challenges", {
      method: "POST",
      headers: { "X-Turnstile-Token": turnstileToken },
      body: JSON.stringify({
        ...payload,
        roomName: draft.roomName,
        isPublic,
      }),
    });
    localStorage.setItem(hiderKeyName(result.token), result.hiderKey);
    const localResult = { ...result, playUrl: playLinkFor(result), shareImage: shareImage || undefined };
    // One page: keep the base URL and drop into the Lobby with the share modal.
    // The pushed create entry becomes a Lobby entry, so Back from the modal
    // pops to the base Lobby (closing the modal) instead of reopening create.
    history.replaceState({ v: "lobby" } satisfies NavState, "", "/");
    showView("explore-view");
    void loadExplore();
    openShareModal(result.token, result.hiderKey, localResult);
  } catch (error) {
    showError(t("hider.publishFailed"), errorMessage(error));
  } finally {
    turnstile.reset("publish");
    hiderScene.setHudState({ hint: "" });
    finishThinking();
  }
}

// The play link to display and encode in the QR. In local dev, wrangler serves
// under the custom-domain route so the server's playUrl isn't reachable on the
// dev machine — use the browser origin instead. In prod, use the server's link
// (configurable per platform via SHARE_LINK_TEMPLATE).
function playLinkFor(result: CreateChallengeResponse): string {
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    return `${location.origin}/?c=${encodeURIComponent(result.token)}`;
  }
  return result.playUrl;
}

// Draw the play-link QR into its own canvas — a crisp, standalone element in
// the share card (not baked into the room preview). Centered on a white plate.
function renderQr(canvas: HTMLCanvasElement, url: string): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  let matrix: boolean[][];
  try {
    matrix = encodeQR(url, "raw", { ecc: "medium", border: 2 });
  } catch {
    return;
  }
  const count = matrix.length;
  const module = Math.max(1, Math.floor(canvas.width / count));
  const dim = module * count;
  const offset = Math.floor((canvas.width - dim) / 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < count; r += 1) {
    const row = matrix[r]!;
    for (let c = 0; c < count; c += 1) {
      if (row[c]) ctx.fillRect(offset + c * module, offset + r * module, module, module);
    }
  }
}

async function routePage(): Promise<void> {
  // On a slow connection the user can navigate in-page before this runs (it
  // waits behind the account fetch) — never yank them off their chosen view.
  if (userNavigated) return;
  const search = new URLSearchParams(location.search);
  if (location.pathname === "/admin" || location.pathname === "/admin/") {
    history.replaceState({ v: "admin" }, "", location.href);
    showView("admin-view");
    restoreAdminToken();
    return;
  }
  // Trap the FIRST Back press into the in-page Lobby: the bottom history entry
  // is always the Lobby at "/", and the play view the visitor actually landed
  // on is pushed on top of it. Back → Lobby (in-page); a second Back leaves.
  const entryUrl = `${location.pathname}${location.search}`;
  history.replaceState({ v: "lobby" }, "", "/");
  // Returned from Stripe hosted checkout (success_url = /?unlocked=1&art=<house>).
  // Re-pull entitlements, strip the params so a refresh can't replay, and drop
  // the buyer into the house they were unlocking.
  if (search.get("unlocked") === "1") {
    const art = parseArtHouse(search.get("art"));
    // The webhook that records the purchase may land a moment after Stripe
    // redirects back, so poll entitlements briefly before deciding.
    for (let i = 0; i < 5; i += 1) {
      await loadEntitlements();
      if (hasUnlock) break;
      await new Promise(resolve => window.setTimeout(resolve, 1200));
    }
    if (userNavigated) return; // the user moved on while we polled
    if (art && houseUnlocked(art)) { enterCreate(art); return; }
    pushPlayState({ v: "create" }, "/");
    showView("create-view");
    return;
  }
  const token = search.get("c");
  if (!token) {
    // Everything else is one page: home (create) is the only landing view, and
    // the Lobby is reached in-page (no /lobby URL).
    const requestedArtHouse = parseArtHouse(search.get("art"));
    pushPlayState({ v: "create" }, entryUrl);
    if (requestedArtHouse && ACCOUNT_REQUIRED_HOUSES.has(requestedArtHouse) && !account) {
      pendingArtHouse = requestedArtHouse;
      showView("create-view");
      openAuthDialog();
      return;
    }
    if (requestedArtHouse) selectArtHouse(requestedArtHouse);
    showView("create-view");
    return;
  }
  // The one shareable URL: a seeker opening a friend's link.
  pushPlayState({ v: "seek", token }, `/?c=${encodeURIComponent(token)}`);
  await loadSeekerChallenge(token);
}

// In-page history entries: `{v:'lobby'}` is the base, play views sit one entry
// above it. Entering a play view from another play view REPLACES the top entry
// (depth stays 2), so Back always means "to the Lobby", never a long unwind.
type NavState = { v: "lobby" | "create" | "seek" | "admin"; token?: string };

// True only while THIS document has a play entry it pushed itself sitting on
// top of the stack. Crucial: history.state PERSISTS across reloads, so a play
// state alone doesn't prove the entry below is ours — history.back() onto a
// foreign entry is a cross-document navigation (a slow, blank reload on 3G).
let playEntryPushed = false;
// Set once the user navigates in-page before routePage() finishes (its await
// on the account fetch leaves a gap on slow connections). routePage must not
// stomp a view the user already chose.
let userNavigated = false;

function pushPlayState(state: NavState, url: string): void {
  const current = (history.state as NavState | null)?.v;
  if (playEntryPushed && (current === "create" || current === "seek")) {
    history.replaceState(state, "", url);
  } else {
    history.pushState(state, "", url);
    playEntryPushed = true;
  }
}

// Browser Back / swipe-back: route in-page instead of leaving the site. Any
// open overlay (share modal, dialogs, paint studio) closes on the way.
function bindHistoryNav(): void {
  window.addEventListener("popstate", event => {
    const state = event.state as NavState | null;
    userNavigated = true;
    playEntryPushed = false; // we traversed; any pushed play entry is behind us
    closeTransientOverlays();
    if (state?.v === "seek" && state.token) {
      void loadSeekerChallenge(state.token);
      return;
    }
    if (state?.v === "create") {
      showView("create-view");
      return;
    }
    if (state?.v === "admin") {
      showView("admin-view");
      return;
    }
    if (element<HTMLElement>("explore-view").hidden) {
      showView("explore-view");
      void loadExplore();
    }
  });
}

function closeTransientOverlays(): void {
  closeManageModal();
  if (studio.isOpen) studio.close();
  for (const id of ["auth-dialog", "unlock-dialog"]) {
    const dialog = document.getElementById(id) as HTMLDialogElement | null;
    if (dialog?.open) dialog.close();
  }
}

function bindGlobalNav(): void {
  // In-page navigation for internal links (wordmark → home, "lobby →" → lobby).
  // Left-click only; modified clicks (open-in-new-tab) fall through to the href.
  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const nav = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-nav]");
    if (!nav) return;
    event.preventDefault();
    if (nav.dataset.nav === "lobby") goLobby();
    else goHome();
  });
}

function goHome(): void {
  startFreshHide();
}

function goLobby(): void {
  // The in-app lobby button's ORIGINAL behavior, untouched: render in-page and
  // anchor the URL at "/". It never touches history traversal — browser-Back
  // support is a separate, additive layer (pushPlayState + popstate).
  userNavigated = true;
  closeManageModal();
  showView("explore-view");
  void loadExplore();
  // One page: no /lobby URL — the Lobby is an in-page view anchored at "/".
  history.replaceState({ v: "lobby" } satisfies NavState, "", "/");
}

// Open a challenge as a seeker in-page (Lobby cards, no reload); keep the URL
// shareable so external opens and refreshes still work.
function openSeek(token: string): void {
  userNavigated = true;
  closeManageModal();
  pushPlayState({ v: "seek", token }, `/?c=${encodeURIComponent(token)}`);
  void loadSeekerChallenge(token);
}

function startFreshHide(): void {
  userNavigated = true;
  closeManageModal();
  resetHiderDraft(draft.artHouse, true);
  showView("create-view");
  pushPlayState({ v: "create" }, "/");
}

function closeManageModal(): void {
  const dialog = element<HTMLDialogElement>("manage-dialog");
  if (dialog.open) dialog.close();
}

function bindAuthControls(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-account-button]").forEach(button => {
    button.addEventListener("click", () => {
      pendingArtHouse = null;
      openAuthDialog();
    });
  });
  element("auth-close").addEventListener("click", closeAuthDialog);
  element("auth-email-form").addEventListener("submit", event => {
    event.preventDefault();
    void requestSignInCode();
  });
  element("auth-code-form").addEventListener("submit", event => {
    event.preventDefault();
    void verifySignInCode();
  });
  element("auth-again").addEventListener("click", () => resetAuthForm());
  element("auth-continue").addEventListener("click", continueAfterAuth);
  element("auth-logout").addEventListener("click", () => void signOut());
  element<HTMLDialogElement>("auth-dialog").addEventListener("cancel", event => {
    event.preventDefault();
    closeAuthDialog();
  });
}

async function loadAccount(): Promise<void> {
  try {
    const data = await api<AuthStateResponse>("/api/auth/me");
    account = data.account;
  } catch (error) {
    console.warn("Account state could not load", error);
    account = null;
  }
  await loadEntitlements();
  syncAccountUi();
}

// Whether the signed-in account has the one-time unlock. False when logged out.
async function loadEntitlements(): Promise<void> {
  if (!account) { hasUnlock = false; refreshShelfBadges(); return; }
  try {
    const data = await api<{ unlocked: boolean }>("/api/account/entitlements");
    hasUnlock = data.unlocked === true;
  } catch {
    hasUnlock = false;
  }
  refreshShelfBadges();
}

// One-shot: pull the store catalog (whether real checkout is live) so a
// locked-house click knows to go to Stripe vs the local dev-grant. Best-effort.
async function loadStoreConfig(): Promise<void> {
  try {
    const cfg = await api<{ products?: { unlockPriceCents?: number | null; checkout?: boolean; devGrant?: boolean } }>("/api/config");
    unlockPriceCents = cfg.products?.unlockPriceCents ?? null;
    storeCheckoutLive = cfg.products?.checkout === true;
    storeDevGrant = cfg.products?.devGrant === true;
  } catch {
    unlockPriceCents = null;
    storeCheckoutLive = false;
    storeDevGrant = false;
  }
  refreshShelfBadges();
}

// Reflect the unlock on the lobby shelf. A paid house stays locked (dimmed + a
// bare 🔒 — NO price, so nobody mistakes it for a per-room charge); free /
// unlocked houses read plainly. The one price lives on the "unlock all" CTA.
function refreshShelfBadges(): void {
  document.querySelectorAll<HTMLButtonElement>(".art-house-card[data-create-art-house]").forEach(card => {
    const artHouse = parseArtHouse(card.dataset.createArtHouse);
    if (!artHouse) return;
    const unlocked = houseUnlocked(artHouse);
    card.classList.toggle("is-locked", !unlocked);
    card.classList.toggle("is-owned", unlocked && isPaidHouse(artHouse));
    let badge = card.querySelector<HTMLSpanElement>(".house-badge");
    if (unlocked) { badge?.remove(); return; }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "house-badge";
      badge.setAttribute("aria-hidden", "true");
      badge.textContent = "🔒";
      card.appendChild(badge);
    }
  });
  refreshUnlockNote();
}

// Small "seeking is always free" reassurance under the shelf. Shown while the
// account still has locked rooms; hidden once everything's unlocked. Price and
// what-you-get live in the checkout prompt, not here.
function refreshUnlockNote(): void {
  const note = document.getElementById("unlock-all-note");
  if (note) note.hidden = hasUnlock;
}

// The paid house awaiting confirmation in the unlock modal.
let unlockDialogHouse: ArtHouseId | null = null;

// Enter the create screen for a house. If it's paid + not owned, show the unlock
// modal first (explains the one-time purchase, then links out to Stripe).
async function enterOrUnlock(artHouse: ArtHouseId): Promise<void> {
  if (houseUnlocked(artHouse)) { enterCreate(artHouse); return; }
  if (storeCheckoutLive || storeDevGrant) { openUnlockModal(artHouse); return; }
  showError(t("brand.name"), t("store.comingSoon"));
}

// The confirm/explain modal shown before leaving for Stripe. Explains what the
// one-time purchase covers (+ price + that seeking is free); its primary button
// continues to Stripe (or, locally, the dev grant).
function openUnlockModal(artHouse: ArtHouseId): void {
  unlockDialogHouse = artHouse;
  const price = typeof unlockPriceCents === "number" ? `$${(unlockPriceCents / 100).toFixed(2)}` : "";
  element("unlock-blurb").textContent = t("store.unlockBlurb", { price });
  const dialog = element<HTMLDialogElement>("unlock-dialog");
  if (!dialog.open) dialog.showModal();
}

function closeUnlockModal(): void {
  unlockDialogHouse = null;
  const dialog = element<HTMLDialogElement>("unlock-dialog");
  if (dialog.open) dialog.close();
}

// Modal primary button: go to Stripe (live) or dev-grant (local).
async function confirmUnlock(): Promise<void> {
  const artHouse = unlockDialogHouse;
  closeUnlockModal();
  if (!artHouse) return;
  if (storeCheckoutLive) { await startCheckout(artHouse); return; }
  if (storeDevGrant) {
    try {
      await api("/api/dev/grant-entitlement", { method: "POST", body: JSON.stringify({}) });
      await loadEntitlements();
      enterCreate(artHouse);
    } catch {
      showError(t("brand.name"), t("store.unlockFailed"));
    }
  }
}

// Send the buyer to Stripe's hosted checkout for the one-time unlock. On success
// Stripe redirects back to /?unlocked=1[&art=<house>], which routePage() picks
// up to reload entitlements and (if a house was named) drop them into it.
async function startCheckout(artHouse?: ArtHouseId): Promise<void> {
  try {
    const res = await api<{ url?: string; alreadyUnlocked?: boolean }>("/api/checkout", {
      method: "POST",
      // Localized item name + note for the Stripe payment prompt.
      body: JSON.stringify({ ...(artHouse ? { artHouse } : {}), name: t("store.unlockAll"), note: t("store.seekFree") }),
    });
    if (res.alreadyUnlocked) { await loadEntitlements(); if (artHouse) enterCreate(artHouse); return; }
    if (res.url) { window.location.href = res.url; return; }
    throw new Error("no checkout url");
  } catch {
    showError(t("brand.name"), t("store.checkoutFailed"));
  }
}

function enterCreate(artHouse: ArtHouseId): void {
  userNavigated = true;
  selectArtHouse(artHouse);
  showView("create-view");
  pushPlayState({ v: "create" }, `/?art=${encodeURIComponent(artHouse)}`);
}

function syncAccountUi(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-account-button]").forEach(button => {
    button.hidden = EMBEDDED_SAMPLER;
    button.textContent = account ? t("auth.account") : t("auth.signIn");
  });
  // Login-gated art houses only appear on the home switcher once signed in, so
  // the home screen never has to prompt for login — Van Gogh alone is fully
  // anonymous. Driven by ACCOUNT_REQUIRED_HOUSES so new houses are covered.
  document.querySelectorAll<HTMLButtonElement>("[data-art-house-button]").forEach(button => {
    const house = parseArtHouse(button.dataset.artHouseButton);
    if (house) button.hidden = !account && ACCOUNT_REQUIRED_HOUSES.has(house);
  });
  // Hide the picker only when signing out would leave exactly one free choice.
  // The itch sampler intentionally has three anonymous houses, so its picker
  // remains available without an account.
  const anonymousHouseCount = ART_HOUSE_IDS.filter(house => !ACCOUNT_REQUIRED_HOUSES.has(house)).length;
  document.querySelectorAll<HTMLElement>(".art-house-switcher").forEach(switcher => {
    switcher.hidden = !account && anonymousHouseCount <= 1;
  });
  element<HTMLElement>("auth-signed-out").hidden = Boolean(account);
  element<HTMLElement>("auth-signed-in").hidden = !account;
  element("auth-account-email").textContent = account?.email ?? "";
}

function openAuthDialog(): void {
  if (EMBEDDED_SAMPLER) return;
  syncAccountUi();
  if (account) enterAccountView();
  else resetAuthForm(false);
  const dialog = element<HTMLDialogElement>("auth-dialog");
  if (!dialog.open) dialog.showModal();
}

// Signed-in view. "keep painting" only matters mid gated-house flow; otherwise
// this is just "my rooms" + sign out. The rooms list lazy-loads each open.
function enterAccountView(): void {
  element<HTMLElement>("auth-continue").hidden = !pendingArtHouse;
  void loadAccountRooms();
}

async function loadAccountRooms(): Promise<void> {
  const list = element("account-rooms-list");
  list.replaceChildren(roomsNote(t("account.roomsLoading")));
  try {
    const data = await api<AccountRoomsResponse>("/api/account/challenges");
    renderAccountRooms(data.rooms);
  } catch (error) {
    console.warn("Rooms could not load", error);
    list.replaceChildren(roomsNote(t("explore.loadError")));
  }
}

function roomsNote(text: string): HTMLElement {
  const note = document.createElement("p");
  note.className = "account-rooms-note";
  note.textContent = text;
  return note;
}

function renderAccountRooms(rooms: AccountRoom[]): void {
  const list = element("account-rooms-list");
  list.replaceChildren();
  if (!rooms.length) {
    list.append(roomsNote(t("account.roomsEmpty")));
    return;
  }
  for (const room of rooms) {
    const card = document.createElement("article");
    card.className = "account-room";

    const head = document.createElement("div");
    head.className = "account-room-head";
    const thumbWrap = document.createElement("div");
    thumbWrap.className = "account-room-thumb-wrap";
    const thumb = document.createElement("img");
    thumb.className = "account-room-thumb";
    thumb.loading = "lazy";
    thumb.decoding = "async";
    thumb.src = ART_HOUSE_THUMBNAILS[room.artHouse as ArtHouseId] ?? "";
    thumb.alt = "";
    thumbWrap.append(thumb);
    const meta = document.createElement("div");
    meta.className = "account-room-meta";
    const name = document.createElement("strong");
    name.textContent = room.roomName;
    const sub = document.createElement("small");
    sub.textContent = `${listingStatusCopy(room.listingStatus)} · ${formatRemaining(room.expiresAt)} left`;
    meta.append(name, sub);
    if (room.isLive) meta.append(livePaintingNote());
    const copy = document.createElement("button");
    copy.className = "icon-button account-room-copy";
    copy.type = "button";
    copy.setAttribute("aria-label", t("manage.copy"));
    copy.title = t("manage.copy");
    const copyGlyph = document.createElement("span");
    copyGlyph.setAttribute("aria-hidden", "true");
    copyGlyph.textContent = "⧉";
    copy.append(copyGlyph);
    if (room.playUrl) {
      copy.addEventListener("click", () => void copyAccountRoomLink(copy, room.playUrl!));
    } else {
      // Older rooms that were explicitly removed from the Lobby no longer
      // retain their plaintext invitation token, so never invent a bad URL.
      copy.disabled = true;
    }
    head.append(thumbWrap, meta, copy);

    const stats = document.createElement("div");
    stats.className = "account-room-stats";
    stats.append(
      roomStat(String(room.attemptCount), t("manage.seekers")),
      roomStat(String(room.foundCount), t("manage.found")),
      roomStat(room.foundCount ? formatElapsed(room.averageFindMs) : "—", t("manage.average")),
    );
    card.append(head, stats);

    // The found screenshot finally has a home: shown once someone finds it.
    if (room.foundCount > 0 && room.lastFoundImage) {
      const figure = document.createElement("figure");
      figure.className = "account-room-found";
      const image = document.createElement("img");
      image.src = room.lastFoundImage;
      image.alt = "";
      image.loading = "lazy";
      const caption = document.createElement("figcaption");
      caption.textContent = t("manage.foundShot");
      figure.append(image, caption);
      card.append(figure);
    }
    list.append(card);
  }
}

function roomStat(value: string, label: string): HTMLElement {
  const cell = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = value;
  const span = document.createElement("span");
  span.textContent = label;
  cell.append(strong, span);
  return cell;
}

async function copyAccountRoomLink(button: HTMLButtonElement, url: string): Promise<void> {
  await navigator.clipboard.writeText(url);
  const glyph = button.querySelector<HTMLElement>("span");
  if (glyph) glyph.textContent = "✓";
  button.classList.add("is-copied");
  button.setAttribute("aria-label", t("manage.copied"));
  button.title = t("manage.copied");
  window.setTimeout(() => {
    if (glyph) glyph.textContent = "⧉";
    button.classList.remove("is-copied");
    button.setAttribute("aria-label", t("manage.copy"));
    button.title = t("manage.copy");
  }, 1_500);
}

function closeAuthDialog(): void {
  pendingArtHouse = null;
  const dialog = element<HTMLDialogElement>("auth-dialog");
  if (dialog.open) dialog.close();
}

function resetAuthForm(clearEmail = true): void {
  element<HTMLElement>("auth-email-form").hidden = false;
  element<HTMLElement>("auth-code-form").hidden = true;
  element("auth-status").textContent = "";
  element<HTMLInputElement>("auth-code").value = "";
  if (clearEmail) element<HTMLInputElement>("auth-email").value = "";
}

async function requestSignInCode(): Promise<void> {
  const button = element<HTMLButtonElement>("auth-send");
  const status = element("auth-status");
  setBusy(button, true, t("auth.sending"));
  status.textContent = "";
  try {
    const turnstileToken = await turnstile.token("auth");
    const result = await api<RequestOtpResponse>("/api/auth/request-otp", {
      method: "POST",
      headers: { "X-Turnstile-Token": turnstileToken },
      body: JSON.stringify({ email: element<HTMLInputElement>("auth-email").value }),
    });
    element<HTMLElement>("auth-email-form").hidden = true;
    element<HTMLElement>("auth-code-form").hidden = false;
    status.textContent = result.devOtp ? t("auth.devCode", { code: result.devOtp }) : t("auth.sent");
    element<HTMLInputElement>("auth-code").focus();
  } catch (error) {
    status.textContent = errorMessage(error);
  } finally {
    turnstile.reset("auth");
    setBusy(button, false, t("auth.send"));
  }
}

async function verifySignInCode(): Promise<void> {
  const button = element<HTMLButtonElement>("auth-verify");
  const status = element("auth-status");
  setBusy(button, true, t("auth.verifying"));
  status.textContent = "";
  try {
    const result = await api<AuthStateResponse>("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({
        email: element<HTMLInputElement>("auth-email").value,
        otp: element<HTMLInputElement>("auth-code").value,
        locale: locale(),
      }),
    });
    account = result.account;
    await loadEntitlements();
    syncAccountUi();
    enterAccountView();
  } catch (error) {
    status.textContent = errorMessage(error);
  } finally {
    setBusy(button, false, t("auth.verify"));
  }
}

function continueAfterAuth(): void {
  const artHouse = pendingArtHouse;
  pendingArtHouse = null;
  const dialog = element<HTMLDialogElement>("auth-dialog");
  if (dialog.open) dialog.close();
  if (!artHouse) return;
  void enterOrUnlock(artHouse);
}

async function signOut(): Promise<void> {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    account = null;
    hasUnlock = false;
    refreshShelfBadges();
    if (ACCOUNT_REQUIRED_HOUSES.has(draft.artHouse)) selectArtHouse("van-gogh-house");
    syncAccountUi();
    closeAuthDialog();
  }
}

async function loadExplore(): Promise<void> {
  const status = element("explore-status");
  status.textContent = t("explore.loading");
  try {
    const data = await api<ExploreResponse>("/api/explore");
    exploreFeeds = {
      tricky: samplerSupportedChallenges(data.feeds.tricky),
      fresh: samplerSupportedChallenges(data.feeds.fresh),
      surprise: samplerSupportedChallenges(data.feeds.surprise),
    };
    for (const lane of Object.keys(EXPLORE_LANES) as LaneKey[]) {
      exploreOffsets[lane] = 0;
      renderLane(lane);
    }
    status.textContent = t("explore.loaded");
  } catch (error) {
    console.warn("Explore feed could not load", error);
    exploreFeeds = null;
    for (const lane of Object.keys(EXPLORE_LANES) as LaneKey[]) {
      renderExploreFeed(EXPLORE_LANES[lane].listId, [], EXPLORE_LANES[lane].emptyKey);
    }
    status.textContent = t("explore.loadError");
  }
}

// Show EXPLORE_LANE_SIZE cards from a lane's cached pool, starting at its
// offset and wrapping — so "refresh" always fills the lane even near the end.
function renderLane(lane: LaneKey): void {
  const { listId, emptyKey } = EXPLORE_LANES[lane];
  const pool = exploreFeeds?.[lane] ?? [];
  let view: ExploreChallenge[];
  if (pool.length <= EXPLORE_LANE_SIZE) {
    view = pool;
  } else {
    const start = ((exploreOffsets[lane] % pool.length) + pool.length) % pool.length;
    view = Array.from({ length: EXPLORE_LANE_SIZE }, (_, i) => pool[(start + i) % pool.length]);
  }
  renderExploreFeed(listId, view, emptyKey);
}

// Refresh works only against the cached pool — never the network, so it can't
// add database load. Random reshuffles for a fresh mix every time; the ordered
// lanes page forward through the pool (a no-op when it fits in one page).
function refreshLane(lane: LaneKey): void {
  const pool = exploreFeeds?.[lane];
  if (!pool || !pool.length) return;
  if (lane === "surprise") {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    exploreOffsets[lane] = 0;
  } else {
    if (pool.length <= EXPLORE_LANE_SIZE) return;
    exploreOffsets[lane] += EXPLORE_LANE_SIZE;
  }
  renderLane(lane);
}

function bindExploreRefresh(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-lane-refresh]").forEach(button => {
    button.addEventListener("click", () => {
      const lane = button.dataset.laneRefresh as LaneKey | undefined;
      if (lane && lane in EXPLORE_LANES) {
        refreshLane(lane);
        button.classList.remove("is-spinning");
        void button.offsetWidth;
        button.classList.add("is-spinning");
      }
    });
  });
}

// On phones the three lobby lanes become tabs (one lane at a time) so the frame
// height is fixed instead of a tall stack. Desktop shows all three (tabs hidden
// by CSS). All lanes stay rendered; switching just toggles which one is shown.
function bindLobbyTabs(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-lobby-tab]").forEach(tab => {
    tab.addEventListener("click", () => {
      const lane = tab.dataset.lobbyTab as LaneKey | undefined;
      if (lane && lane in EXPLORE_LANES) setLobbyTab(lane);
    });
  });
  setLobbyTab("fresh");
}

function setLobbyTab(lane: LaneKey): void {
  document.querySelectorAll<HTMLButtonElement>("[data-lobby-tab]").forEach(tab => {
    const active = tab.dataset.lobbyTab === lane;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll<HTMLElement>("#explore-grid .explore-lane").forEach(article => {
    article.classList.toggle("is-active", article.dataset.lane === lane);
  });
}

function bindExploreSearch(): void {
  const form = element<HTMLFormElement>("explore-search-form");
  const input = element<HTMLInputElement>("explore-search-input");
  const clear = element<HTMLButtonElement>("explore-search-clear");
  form.addEventListener("submit", event => {
    event.preventDefault();
    window.clearTimeout(exploreSearchTimer);
    if (input.value.trim()) void runExploreSearch(input.value);
  });
  input.addEventListener("input", () => {
    const clean = input.value.replace(/[^A-Za-z ]/gu, "").replace(/\s{2,}/gu, " ");
    if (clean !== input.value) input.value = clean;
    clear.hidden = !clean.trim();
    window.clearTimeout(exploreSearchTimer);
    if (!clean.trim()) {
      closeExploreSearch();
      return;
    }
    exploreSearchTimer = window.setTimeout(() => void runExploreSearch(clean), 280);
  });
  clear.addEventListener("click", () => {
    input.value = "";
    clear.hidden = true;
    closeExploreSearch();
    input.focus();
  });
}

function closeExploreSearch(): void {
  exploreSearchRequest += 1;
  element("explore-search-panel").hidden = true;
  element("explore-grid").hidden = false;
}

async function runExploreSearch(rawQuery: string): Promise<void> {
  const query = rawQuery.trim().replace(/\s+/gu, " ");
  if (!query) {
    closeExploreSearch();
    return;
  }
  const requestId = ++exploreSearchRequest;
  element("explore-search-panel").hidden = false;
  element("explore-grid").hidden = true;
  renderExploreFeed("explore-search-list", [], "explore.searching");
  try {
    const data = await api<ExploreSearchResponse>(`/api/explore?q=${encodeURIComponent(query)}`);
    if (requestId !== exploreSearchRequest) return;
    renderExploreFeed("explore-search-list", samplerSupportedChallenges(data.challenges), "explore.searchEmpty");
  } catch (error) {
    console.warn("Room search could not load", error);
    if (requestId === exploreSearchRequest) renderExploreFeed("explore-search-list", [], "explore.loadError");
  }
}

// The shared API also serves the full game. Never try to generate a Lobby card
// for a paid house that intentionally is not bundled in this three-house build.
function samplerSupportedChallenges(challenges: ExploreChallenge[]): ExploreChallenge[] {
  return challenges.filter(challenge => ART_HOUSE_IDS.includes(challenge.artHouse));
}

function renderExploreFeed(
  id: string,
  challenges: ExploreChallenge[],
  emptyKey: "explore.trickyEmpty" | "explore.freshEmpty" | "explore.surpriseEmpty" | "explore.searching" | "explore.searchEmpty" | "explore.loadError",
): void {
  const list = element(id);
  list.replaceChildren();
  if (!challenges.length) {
    const empty = document.createElement("p");
    empty.className = "challenge-empty";
    empty.textContent = t(emptyKey);
    list.append(empty);
    return;
  }

  for (const challenge of challenges) {
    const link = document.createElement("a");
    link.className = "challenge-link";
    link.href = `/?c=${encodeURIComponent(challenge.token)}`;
    link.addEventListener("click", event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openSeek(challenge.token);
    });

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "challenge-thumb-wrap";
    const thumbnail = document.createElement("img");
    thumbnail.className = "challenge-thumb";
    thumbnail.loading = "lazy";
    thumbnail.decoding = "async";
    thumbnail.src = lobbyRoomThumbnail(challenge.artHouse, challenge.token);
    thumbnail.alt = "";
    thumbWrap.append(thumbnail);
    const copy = document.createElement("div");
    copy.className = "challenge-copy";
    const name = document.createElement("strong");
    name.textContent = challenge.roomName;
    const action = document.createElement("small");
    action.textContent = t("explore.tryChallenge");
    copy.append(name, action);
    if (challenge.isLive) copy.append(livePaintingNote());
    const meta = document.createElement("span");
    meta.className = "challenge-meta";
    const plays = challenge.attemptCount
      ? t("explore.looks", { count: challenge.attemptCount })
      : t("explore.noLooks");
    meta.textContent = `${plays} · ${t("explore.goneIn", { time: formatRemaining(challenge.expiresAt) })}`;
    link.append(thumbWrap, copy, meta);
    list.append(link);
  }
}

// Small text line under the room/house name (never overlaid on the artwork —
// the thumbnails stay clean).
function livePaintingNote(): HTMLElement {
  const note = document.createElement("small");
  note.className = "live-painting-note";
  note.textContent = t("live.badge");
  return note;
}

// On-canvas seeker labels (localized here so i18n stays in one place; re-applied
// on locale change).
function applySeekerLabels(): void {
  seekerScene.setLabels({
    brand: t("brand.name"),
    closeLook: t("seeker.inspect"),
    lobby: t("explore.cta"),
    report: t("report.link"),
    start: t("seeker.start"),
    seekerReadyLine1: t("seeker.readyLine1"),
    seekerReadyLine2: t("seeker.readyLine2"),
    seekerReadyCall: t("seeker.readyCall"),
  });
}

function seekerStatsText(attemptCount: number, foundCount: number): string {
  return `${attemptCount} ${t("manage.seekers")}\n${foundCount} ${t("manage.found")}`;
}

function openReportPanel(): void {
  const panel = element<HTMLDetailsElement>("report-panel");
  panel.hidden = false;
  panel.open = true;
}

function seekerResultAction(): void {
  if (seekerResultNav === "home") goHome();
  else goLobby();
}

async function loadSeekerChallenge(token: string): Promise<void> {
  try {
    const data = await api<GetChallengeResponse>(`/api/challenges/${encodeURIComponent(token)}`);
    if (!isChallengePayload(data.challenge.payload)) {
      throw new Error(t("seeker.legacy"));
    }
    seekerState = {
      token,
      payload: data.challenge.payload,
      expiresAt: data.challenge.expiresAt,
      attemptId: getAttemptId(token),
      startedAt: 0,
      completed: false,
      misses: 0,
      roomName: data.challenge.roomName,
    };
    seekerScene.setChallenge(seekerState.payload);
    // setChallenge already opens on the seeker's spawn room; don't force room 0.
    seekerScene.setAvatarVisible(false);
    seekerScene.setResultCard({ title: "", sub: "", actionLabel: "" });
    seekerScene.setPhase("ready");
    seekerScene.setHudState({
      roomName: seekerState.roomName,
      meta: formatRemaining(seekerState.expiresAt),
      timer: "",
      timerLow: false,
      triesTotal: 0,
      triesLeft: MAX_MISSES,
      stats: seekerStatsText(data.challenge.attemptCount, data.challenge.foundCount),
      hint: "",
    });
    const reportPanel = element<HTMLDetailsElement>("report-panel");
    reportPanel.open = false;
    reportPanel.hidden = true;
    syncReportPanel(token);
    showView("seeker-view");
  } catch (error) {
    const apiError = error as ApiError;
    showError(apiError.status === 410 ? t("seeker.expired") : t("seeker.unavailable"), errorMessage(error));
  }
}

function startSeeking(): void {
  if (!seekerState) return;
  seekerScene.setAvatarVisible(true);
  seekerScene.setPhase("playing");
  seekerState.startedAt = performance.now();
  syncTriesIndicator();
  seekerScene.setHudState({ hint: t("seeker.status") });
}

async function handleInspection(x: number, y: number, hit: boolean): Promise<void> {
  if (!seekerState || !seekerState.startedAt || seekerState.completed) return;
  if (!hit) {
    seekerState.misses += 1;
    syncTriesIndicator();
    seekerScene.setHudState({ hint: t("seeker.notThere", { count: seekerState.misses }) });
    if (seekerState.misses >= MAX_MISSES) void failSeek();
    return;
  }

  seekerState.completed = true;
  const elapsedMs = Math.min(600_000, Math.max(0, Math.round(performance.now() - seekerState.startedAt)));
  // Capture the found moment (chameleon revealed) so the hider sees it in "my rooms".
  const foundImage = seekerScene.snapshot();
  try {
    await api(`/api/challenges/${encodeURIComponent(seekerState.token)}/attempts`, {
      method: "POST",
      body: JSON.stringify({
        attemptId: seekerState.attemptId,
        roomIndex: seekerScene.getRoom(),
        x,
        y,
        elapsedMs,
        gaveUp: false,
        ...(foundImage ? { foundImage } : {}),
      }),
    });
  } catch (error) {
    console.warn("Result could not be saved", error);
  }
  seekerResultNav = "home";
  seekerScene.setResultCard({ title: t("seeker.gotIt"), sub: t("seeker.nice", { time: formatElapsed(elapsedMs) }), actionLabel: t("seeker.myTurn") });
  seekerScene.setPhase("result");
}

async function failSeek(): Promise<void> {
  if (!seekerState || !seekerState.startedAt || seekerState.completed) return;
  seekerState.completed = true;
  const elapsedMs = Math.min(600_000, Math.max(0, Math.round(performance.now() - seekerState.startedAt)));
  // Record a not-found attempt so the Hider's "peeked" count stays honest.
  try {
    await api(`/api/challenges/${encodeURIComponent(seekerState.token)}/attempts`, {
      method: "POST",
      body: JSON.stringify({
        attemptId: seekerState.attemptId,
        roomIndex: seekerScene.getRoom(),
        x: 0,
        y: 0,
        elapsedMs,
        gaveUp: true,
      }),
    });
  } catch (error) {
    console.warn("Result could not be saved", error);
  }
  seekerResultNav = "lobby";
  seekerScene.setResultCard({ title: t("seeker.outOfLooks"), sub: "", actionLabel: t("seeker.backToExplore") });
  seekerScene.setPhase("result");
}

function syncTriesIndicator(): void {
  if (!seekerState) return;
  seekerScene.setHudState({ triesTotal: MAX_MISSES, triesLeft: Math.max(0, MAX_MISSES - seekerState.misses) });
}

function bindManageControls(): void {
  element("copy-button").addEventListener("click", () => void copyShareLink());
  element("share-button").addEventListener("click", () => void shareChallenge());
  element("delete-challenge").addEventListener("click", () => void deleteCurrentChallenge());
  element("share-listing-toggle").addEventListener("click", () => void toggleListing());
  element("manage-close").addEventListener("click", () => goLobby());
  element<HTMLDialogElement>("manage-dialog").addEventListener("cancel", event => {
    event.preventDefault();
    goLobby();
  });
}

// Share-only modal shown right after publishing: room preview, a standalone
// link QR, the link + copy, "challenge a friend", and remove/delete. No stats
// or results here — those live on the seeker page.
function openShareModal(token: string, hiderKey: string, created: CreateChallengeResponse | null = null): void {
  manageToken = token;
  manageHiderKey = hiderKey;
  manageListed = created ? created.isPublic : false;
  manageExpiresAt = created?.expiresAt ?? null;
  if (created?.roomName) element("manage-room-name").textContent = created.roomName;
  element<HTMLElement>("manage-live-badge").hidden = !created?.isLive;
  const shareLink = created?.playUrl ?? `${location.origin}/?c=${encodeURIComponent(token)}`;
  element<HTMLInputElement>("share-link").value = shareLink;
  renderListingState();
  setShot("manage-preview", "manage-preview-image", created?.shareImage ?? null);
  renderQr(element<HTMLCanvasElement>("manage-qr"), shareLink);
  const dialog = element<HTMLDialogElement>("manage-dialog");
  if (!dialog.open) dialog.showModal();
}

// Reflect the current listing state in the modal: the ◉/○ share toggle (same
// radio language as the old on-canvas pill) and the expiry line.
function renderListingState(): void {
  const toggle = element<HTMLButtonElement>("share-listing-toggle");
  toggle.classList.toggle("is-on", manageListed);
  toggle.setAttribute("aria-pressed", String(manageListed));
  toggle.querySelector("[data-listing-glyph]")!.textContent = manageListed ? "◉" : "○";
  if (manageExpiresAt) {
    element("manage-expiry").textContent = t("manage.expiry", {
      visibility: t(manageListed ? "manage.visibilityLobby" : "manage.visibilityPrivate"),
      time: formatRemaining(manageExpiresAt),
    });
  }
}

// Toggle a share-page screenshot <figure> and its <img>. A null/empty data URL
// hides the figure and clears the src so no stale image lingers.
function setShot(figureId: string, imageId: string, dataUrl: string | null | undefined): void {
  const figure = element<HTMLElement>(figureId);
  const image = element<HTMLImageElement>(imageId);
  if (dataUrl) {
    image.src = dataUrl;
    figure.hidden = false;
  } else {
    image.removeAttribute("src");
    figure.hidden = true;
  }
}

// Flip share-on-Lobby from the modal. Both directions are backed by the
// publication endpoint (DELETE = unlist, POST = relist), so no confirm — it's
// freely reversible. The friend link keeps working either way.
async function toggleListing(): Promise<void> {
  const token = manageToken;
  const hiderKey = manageHiderKey;
  if (!token || !hiderKey) return;
  const button = element<HTMLButtonElement>("share-listing-toggle");
  const next = !manageListed;
  button.disabled = true;
  try {
    await api(`/api/challenges/${encodeURIComponent(token)}/publication`, {
      method: next ? "POST" : "DELETE",
      headers: { Authorization: `Bearer ${hiderKey}` },
    });
    manageListed = next;
    renderListingState();
  } catch (error) {
    showError(t("manage.listingFailed"), errorMessage(error));
  } finally {
    button.disabled = false;
  }
}

function bindReportControls(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-report-reason]").forEach(button => {
    button.addEventListener("click", () => {
      const reason = button.dataset.reportReason as ReportReason | undefined;
      if (reason) void reportCurrentChallenge(reason);
    });
  });
}

async function reportCurrentChallenge(reason: ReportReason): Promise<void> {
  if (!seekerState) return;
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-report-reason]"));
  buttons.forEach(button => { button.disabled = true; });
  element("report-status").textContent = t("report.checking");
  try {
    const turnstileToken = await turnstile.token("report");
    element("report-status").textContent = t("report.sending");
    const result = await api<ReportResponse>(`/api/challenges/${encodeURIComponent(seekerState.token)}/reports`, {
      method: "POST",
      headers: { "X-Turnstile-Token": turnstileToken },
      body: JSON.stringify({ reportId: getReportId(seekerState.token), reason }),
    });
    localStorage.setItem(reportedKey(seekerState.token), "1");
    element("report-status").textContent = result.hiddenFromExplore
      ? t("report.hidden")
      : t("report.saved");
  } catch (error) {
    buttons.forEach(button => { button.disabled = false; });
    element("report-status").textContent = t("report.failed", { message: errorMessage(error) });
  } finally {
    turnstile.reset("report");
  }
}

function syncReportPanel(token: string): void {
  const reported = localStorage.getItem(reportedKey(token)) === "1";
  document.querySelectorAll<HTMLButtonElement>("[data-report-reason]").forEach(button => {
    button.disabled = reported;
  });
  element("report-status").textContent = reported ? t("report.already") : "";
}

const ADMIN_SESSION_KEY = "pc:admin-token";

function bindAdminControls(): void {
  element("load-moderation").addEventListener("click", () => void loadModerationQueue());
  element<HTMLInputElement>("admin-token").addEventListener("keydown", event => {
    if (event.key === "Enter") void loadModerationQueue();
  });
}

function restoreAdminToken(): void {
  const stored = sessionStorage.getItem(ADMIN_SESSION_KEY) ?? "";
  element<HTMLInputElement>("admin-token").value = stored;
  if (stored) void loadModerationQueue();
}

async function loadModerationQueue(): Promise<void> {
  const tokenInput = element<HTMLInputElement>("admin-token");
  const token = tokenInput.value.trim();
  const button = element<HTMLButtonElement>("load-moderation");
  if (!token) {
    element("admin-status").textContent = "Paste the administrator token first.";
    return;
  }
  sessionStorage.setItem(ADMIN_SESSION_KEY, token);
  setBusy(button, true, "opening…");
  element("admin-status").textContent = "loading the private queue…";
  try {
    const data = await api<ModerationQueueResponse>("/api/admin/moderation", {
      headers: { Authorization: `Bearer ${token}` },
    });
    renderModerationQueue(data.queue);
    renderModerationAudit(data.recentActions);
    element("admin-status").textContent = data.queue.length
      ? `${data.queue.length} ${data.queue.length === 1 ? "hide needs" : "hides need"} a decision.`
      : "The queue is clear.";
  } catch (error) {
    element("admin-status").textContent = errorMessage(error);
    renderModerationQueue([]);
    renderModerationAudit([]);
  } finally {
    setBusy(button, false, "open the queue");
  }
}

function renderModerationQueue(items: ModerationQueueItem[]): void {
  const list = element("moderation-queue");
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "challenge-empty";
    empty.textContent = "Nothing is waiting here.";
    list.append(empty);
    return;
  }

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "moderation-item";
    const heading = document.createElement("div");
    heading.className = "moderation-item-heading";
    const link = document.createElement("a");
    link.href = item.playUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "open the hide ↗";
    const expiry = document.createElement("small");
    expiry.textContent = `gone in ${formatRemaining(item.expiresAt)}`;
    heading.append(link, expiry);

    const summary = document.createElement("p");
    summary.textContent = `${item.reportCount} ${item.reportCount === 1 ? "report" : "reports"} · ${formatReasons(item.reasons)}`;
    const actions = document.createElement("div");
    actions.className = "report-actions";
    const restore = document.createElement("button");
    restore.className = "primary-button";
    restore.type = "button";
    restore.textContent = "restore to Explore";
    restore.addEventListener("click", () => void submitModerationAction(item.challengeId, "restore"));
    const keepHidden = document.createElement("button");
    keepHidden.className = "quiet-button";
    keepHidden.type = "button";
    keepHidden.textContent = "confirm hidden";
    keepHidden.addEventListener("click", () => void submitModerationAction(item.challengeId, "confirm_hidden"));
    actions.append(restore, keepHidden);
    card.append(heading, summary, actions);
    list.append(card);
  }
}

function renderModerationAudit(items: ModerationAuditItem[]): void {
  const list = element("moderation-audit");
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "challenge-empty";
    empty.textContent = "No decisions recorded yet.";
    list.append(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement("article");
    row.className = "moderation-audit-row";
    const action = document.createElement("strong");
    action.textContent = item.action === "restore" ? "restored to Explore" : "confirmed hidden";
    const detail = document.createElement("span");
    detail.textContent = `${item.reportCount} ${item.reportCount === 1 ? "report" : "reports"} · ${formatDate(item.createdAt)}`;
    row.append(action, detail);
    list.append(row);
  }
}

async function submitModerationAction(challengeId: string, action: ModerationAction): Promise<void> {
  if (action === "restore" && !confirm("Restore this hide to Explore for the rest of its 24-hour lifetime?")) return;
  const token = sessionStorage.getItem(ADMIN_SESSION_KEY) ?? "";
  element("admin-status").textContent = action === "restore" ? "restoring…" : "saving that decision…";
  try {
    await api(`/api/admin/moderation/${encodeURIComponent(challengeId)}/actions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action }),
    });
    await loadModerationQueue();
  } catch (error) {
    element("admin-status").textContent = errorMessage(error);
  }
}

function formatReasons(reasons: ModerationReasons): string {
  const labels = [
    reasons.not_okay ? `${reasons.not_okay} not okay` : "",
    reasons.broken ? `${reasons.broken} broken` : "",
    reasons.other ? `${reasons.other} other` : "",
  ].filter(Boolean);
  return labels.join(" · ") || "no reason snapshot";
}

async function deleteCurrentChallenge(): Promise<void> {
  const token = manageToken;
  const hiderKey = manageHiderKey;
  if (!token || !hiderKey || !confirm(t("manage.deleteConfirm"))) return;
  const button = element<HTMLButtonElement>("delete-challenge");
  setBusy(button, true, t("manage.deleting"));
  try {
    await api(`/api/challenges/${encodeURIComponent(token)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${hiderKey}` },
    });
    localStorage.removeItem(hiderKeyName(token));
    goLobby();
  } catch (error) {
    showError(t("manage.deleteFailed"), errorMessage(error));
  } finally {
    setBusy(button, false, t("manage.delete"));
  }
}

async function copyShareLink(): Promise<void> {
  await navigator.clipboard.writeText(element<HTMLInputElement>("share-link").value);
  const button = element("copy-button");
  const glyph = button.querySelector<HTMLElement>("[data-copy-glyph]");
  if (glyph) glyph.textContent = "✓";
  button.classList.add("is-copied");
  button.setAttribute("aria-label", t("manage.copied"));
  window.setTimeout(() => {
    if (glyph) glyph.textContent = "⧉";
    button.classList.remove("is-copied");
    button.setAttribute("aria-label", t("manage.copy"));
  }, 1_500);
}

async function shareChallenge(): Promise<void> {
  const url = element<HTMLInputElement>("share-link").value;
  if (navigator.share) await navigator.share({ title: t("share.title"), text: t("share.text"), url });
  else await copyShareLink();
}

async function checkHealth(): Promise<void> {
  try {
    const response = await apiFetch("/api/health", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("health check failed");
    element("service-status").textContent = "API online";
    element("service-status").classList.add("is-online");
  } catch {
    element("service-status").textContent = "API unavailable";
  }
}

async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await apiFetch(path, { ...init, headers });
  if (response.status === 204) return null as T;
  const body = await response.json().catch(() => ({})) as { error?: { message?: string; code?: string } };
  if (!response.ok) {
    const error = new Error(body.error?.message ?? `Request failed (${response.status}).`) as ApiError;
    error.status = response.status;
    error.code = body.error?.code;
    throw error;
  }
  return body as T;
}

function isChallengePayload(value: unknown): value is ChallengePayloadV1 {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<ChallengePayloadV1>;
  const live = payload.livePainting;
  const liveValid = live === undefined || (
    typeof live === "object" && live !== null
    // marks plus the optional quiet→live strength dial - the exact key set and
    // bounds the API accepts (core.js normalizeLivePainting).
    && Object.keys(live).every(key => key === "marks" || key === "strength")
    && (live.strength === undefined
      || (Number.isInteger(live.strength) && live.strength >= 10 && live.strength <= 100))
    && Array.isArray(live.marks)
    && live.marks.length <= MAX_LIVE_PAINT_MARKS
    && live.marks.every(mark => {
      if (!mark || typeof mark !== "object") return false;
      const keys = Object.keys(mark);
      return keys.length === 7
        && keys.every(key => ["brush", "x", "y", "size", "flow", "seed", "angle"].includes(key))
        && LIVE_BRUSH_IDS.includes(mark.brush as LiveBrushId)
        && Number.isInteger(mark.x) && mark.x >= 0 && mark.x <= 256
        && Number.isInteger(mark.y) && mark.y >= 0 && mark.y <= 256
        && Number.isInteger(mark.size) && mark.size >= LIVE_SIZE_MIN && mark.size <= LIVE_SIZE_MAX
        && Number.isInteger(mark.flow) && mark.flow >= LIVE_FLOW_MIN && mark.flow <= LIVE_FLOW_MAX
        && Number.isInteger(mark.seed) && mark.seed >= 0 && mark.seed <= 65_535
        && Number.isFinite(mark.angle) && mark.angle >= -Math.PI && mark.angle <= Math.PI;
    })
  );
  return payload.version === 1
    && ART_HOUSE_IDS.includes(payload.artHouse as ArtHouseId)
    && Number.isInteger(payload.surface) && Number(payload.surface) >= 0 && Number(payload.surface) <= 2
    && Number.isInteger(payload.roomIndex) && Number(payload.roomIndex) >= 0 && Number(payload.roomIndex) <= 2
    && Number.isInteger(payload.x) && Number.isInteger(payload.y)
    && ["stand", "curl", "flat"].includes(String(payload.pose))
    && typeof payload.avatarData === "string"
    && /^data:image\/(?:webp|png);base64,/u.test(payload.avatarData)
    && liveValid;
}

function copyCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext("2d")!.drawImage(source, 0, 0);
  return copy;
}

function showView(id: typeof views[number]): void {
  for (const view of views) element<HTMLElement>(view).hidden = view !== id;
  // Phase 2 resource boundary: hidden play pages keep their ordinary scene
  // state for now, but release every Live renderer/GPU backing store.
  hiderScene?.setActive(id === "create-view");
  seekerScene?.setActive(id === "seeker-view");
  fitPlayableCanvas();
}

// Both playable stages (hider + seeker) are full-screen play surfaces: the
// canvas fills its .play-viewport and the scene draws the room contain-fit via
// its camera + the on-canvas UI around it. Driven on load, view switches, resize.
function fitPlayableCanvas(): void {
  const resize = (selector: string, scene: GameCanvas): void => {
    const vp = document.querySelector<HTMLElement>(selector);
    if (vp && vp.clientWidth > 4 && vp.clientHeight > 4) scene.resize(vp.clientWidth, vp.clientHeight);
  };
  resize("#create-view .play-viewport", hiderScene);
  resize("#seeker-view .play-viewport", seekerScene);
}

function setupCanvasFit(): void {
  const observer = new ResizeObserver(() => fitPlayableCanvas());
  document.querySelectorAll<HTMLElement>(".play-viewport").forEach(vp => observer.observe(vp));
  fitPlayableCanvas();
}

function showError(title: string, message: string): void {
  studio.close();
  element("error-title").textContent = title;
  element("error-message").textContent = message;
  showView("error-view");
}

function setBusy(button: HTMLButtonElement, busy: boolean, label: string): void {
  button.disabled = busy;
  button.textContent = label;
}

// crypto.randomUUID needs a secure context AND Safari 15.4+, so it is undefined
// on older iPads/iPhones and on a plain-http LAN dev origin — which crashed
// "join a room" (the attempt id) mid-play. crypto.getRandomValues is available
// in every context and browser, so fall back to an RFC 4122 v4 built from it.
function randomUuid(): string {
  const cryptoObj = globalThis.crypto;
  if (typeof cryptoObj?.randomUUID === "function") return cryptoObj.randomUUID();
  const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

function getAttemptId(token: string): string {
  const key = `pc:attempt:${token}`;
  let value = localStorage.getItem(key);
  if (!value) {
    value = randomUuid();
    localStorage.setItem(key, value);
  }
  return value;
}

function getReportId(token: string): string {
  const key = `pc:report:${token}`;
  let value = localStorage.getItem(key);
  if (!value) {
    value = randomUuid();
    localStorage.setItem(key, value);
  }
  return value;
}

function reportedKey(token: string): string {
  return `pc:reported:${token}`;
}

function hiderKeyName(token: string): string {
  return `pc:hider:${token}`;
}

function listingStatusCopy(status: ListingStatus): string {
  if (status === "listed") return "Lobby";
  if (status === "hidden") return "hidden";
  return "private";
}

function formatElapsed(milliseconds: number): string {
  return `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(milliseconds / 1_000)}s`;
}

function formatRemaining(expiresAt: number): string {
  const seconds = Math.max(0, expiresAt - Math.floor(Date.now() / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const hourFormatter = new Intl.NumberFormat(locale(), { style: "unit", unit: "hour", unitDisplay: "narrow" });
  const minuteFormatter = new Intl.NumberFormat(locale(), { style: "unit", unit: "minute", unitDisplay: "narrow" });
  return hours > 0
    ? `${hourFormatter.format(hours)} ${minuteFormatter.format(minutes)}`
    : minuteFormatter.format(minutes);
}

function formatDate(unixTime: number): string {
  return new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeStyle: "short" }).format(unixTime * 1_000);
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! & 0x7fffffff;
}

function randomSmallInt(limit: number): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! % limit;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing #${id}`);
  return found as T;
}

function parseArtHouse(value: string | null | undefined): ArtHouseId | null {
  return ART_HOUSE_IDS.includes(value as ArtHouseId) ? value as ArtHouseId : null;
}

interface ApiError extends Error {
  status?: number;
  code?: string;
}

interface CreateChallengeResponse {
  token: string;
  hiderKey: string;
  playUrl: string;
  manageUrl: string;
  createdAt: number;
  expiresAt: number;
  isPublic: boolean;
  roomName: string;
  isLive: boolean;
  // Attached client-side for the immediate share modal; never uploaded to D1.
  shareImage?: string;
}

interface GetChallengeResponse {
  challenge: {
    payload: unknown;
    roomName: string;
    createdAt: number;
    expiresAt: number;
    attemptCount: number;
    foundCount: number;
    averageFindMs: number;
  };
}

interface ResultsResponse {
  results: {
    attemptCount: number;
    foundCount: number;
    averageFindMs: number;
    expiresAt: number;
    isPublic: boolean;
    listingStatus: ListingStatus;
    roomName: string;
    isLive: boolean;
    lastFoundImage: string | null;
  };
}

type ListingStatus = "listed" | "hidden" | "private";
type ReportReason = "not_okay" | "broken" | "other";

interface ReportResponse {
  accepted: boolean;
  hiddenFromExplore: boolean;
}

type ModerationAction = "restore" | "confirm_hidden";

interface ModerationReasons {
  not_okay: number;
  broken: number;
  other: number;
}

interface ModerationQueueItem {
  challengeId: string;
  playUrl: string;
  createdAt: number;
  expiresAt: number;
  lastReportAt: number;
  reportCount: number;
  reasons: ModerationReasons;
}

interface ModerationAuditItem {
  challengeId: string;
  action: ModerationAction;
  reportCount: number;
  reasons: ModerationReasons;
  createdAt: number;
}

interface ModerationQueueResponse {
  queue: ModerationQueueItem[];
  recentActions: ModerationAuditItem[];
}

interface ExploreChallenge {
  token: string;
  artHouse: ArtHouseId;
  roomName: string;
  createdAt: number;
  expiresAt: number;
  attemptCount: number;
  foundCount: number;
  averageFindMs: number;
  isLive: boolean;
}

interface Account {
  id: string;
  email: string;
  providers: string[];
  preferredLocale: string | null;
}

interface AuthStateResponse {
  account: Account | null;
}

interface AccountRoom {
  playUrl: string | null;
  roomName: string;
  artHouse: string;
  createdAt: number;
  expiresAt: number;
  listingStatus: ListingStatus;
  attemptCount: number;
  foundCount: number;
  averageFindMs: number;
  lastFoundImage: string | null;
  isLive: boolean;
}

interface AccountRoomsResponse {
  rooms: AccountRoom[];
}

interface RequestOtpResponse {
  ok: boolean;
  expiresInSeconds: number;
  devOtp?: string;
}

interface ExploreResponse {
  feeds: {
    tricky: ExploreChallenge[];
    fresh: ExploreChallenge[];
    surprise: ExploreChallenge[];
  };
  generatedAt: number;
  cacheTtlSeconds: number;
}

interface ExploreSearchResponse {
  query: string;
  challenges: ExploreChallenge[];
}
