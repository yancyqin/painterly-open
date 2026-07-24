export const POSE_IDS = ["stand", "curl", "flat"] as const;
export type PoseId = typeof POSE_IDS[number];

// Curated game-side forces. Challenges may place bounded marks made with these
// ids, but never carry Function Brush source, masks, projects, or executable
// code. The actual brush implementations ship with the client.
export const LIVE_BRUSH_IDS = [
  "blue-current",
  "liquid-color",
  "graphite-whisper",
  "firefly",
  "growth",
  "color-liquify-splash",
] as const;
export type LiveBrushId = typeof LIVE_BRUSH_IDS[number];

export interface LivePaintMark {
  brush: LiveBrushId;
  /** Force only: color is sampled from the finished static avatar at runtime. */
  /** Avatar-space coordinates (the authored avatar canvas is 256×256). */
  x: number;
  y: number;
  /** Brush diameter in avatar pixels. */
  size: number;
  /** Per-mark pigment/density percentage, 10–100. */
  flow: number;
  /** Bounded deterministic variation; no executable brush data. */
  seed: number;
  angle: number;
}

export interface LivePaintingConfig {
  /** Local Live Brush marks; empty means the room is Live but the avatar is not. */
  marks: LivePaintMark[];
  /** Force amplitude, 10 (quiet) to 100 (the reviewed strength — the ceiling).
   * Missing on older challenges; normalization defaults it to 68. */
  strength?: number;
}

// The itch distribution is intentionally a self-contained three-house sampler.
// Paid/full-game houses are not part of its runtime catalog or ZIP payload.
export const ART_HOUSE_IDS = ["van-gogh-house", "monet-garden-house", "outdoor-masters-journey"] as const;
export type ArtHouseId = typeof ART_HOUSE_IDS[number];

export interface ChallengePayloadV1 {
  version: 1;
  artHouse: ArtHouseId;
  surface: 0 | 1 | 2;
  artSeed: number;
  roomIndex: 0 | 1 | 2;
  x: number;
  y: number;
  pose: PoseId;
  avatarData: string;
  /** Present only when the curated Live option was enabled by the Hider. */
  livePainting?: LivePaintingConfig;
}

export interface ArtRoomDefinition {
  id: ArtHouseId;
  title: string;
  palette: readonly string[];
  artTip: string;
  defaultShape: "dot" | "streak" | "square" | "ring";
  /** The room has a reviewed game-side Live Painting project available. */
  livePainting?: boolean;
  /** Owner-selected avatar forces shown by this art house. Released ids remain
   * globally valid so older challenges keep rendering after a menu changes. */
  liveBrushes?: readonly LiveBrushId[];
  starterCamo: {
    label: string;
    help: string;
    style: "swirl" | "facets" | "pointillist" | "optical" | "wash" | "blocks";
    baseColors: readonly number[];
    accentColors: readonly number[];
  };
}

export interface Point {
  x: number;
  y: number;
}

export interface PropInstance {
  id: string;
  modelId: string;
  x: number;
  y: number;
  rotation: 0 | 180;
  accent: 0 | 1 | 2;
  artId?: string;
  collision?: {
    padLeft: number;
    padRight: number;
    padFront: number;
    padBack: number;
  };
  depthBias?: number;
}
