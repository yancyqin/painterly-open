import monetLayoutJson from "./assets/layouts/monet-garden-house-layout-0.json";
import vanGoghLayoutJson from "./assets/layouts/van-gogh-layout-0.json";
import outdoorLayoutJson from "./assets/layouts/outdoor-triptych-layout-0.json";
import {
  ACTOR_HALF_HEIGHT,
  ACTOR_HALF_WIDTH,
  actorHitsAnyPolygon,
  actorHitsAnyRect,
  propCollisionRects,
  type CollisionRect,
} from "./collision.js";
import type { ArtHouseId, Point, PropInstance } from "./types";

export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 640;

export const AVATAR_URLS = {
  stand: new URL("./assets/avatars/stand.png", import.meta.url).href,
  curl: new URL("./assets/avatars/curl.png", import.meta.url).href,
  flat: new URL("./assets/avatars/flat.png", import.meta.url).href,
} as const;

const vanGoghPropModules = {
  ...import.meta.glob<string>("./assets/props/van-gogh/*.png", { eager: true, import: "default", query: "?url" }),
  ...import.meta.glob<string>("./assets/props/van-gogh/instances/*.png", { eager: true, import: "default", query: "?url" }),
};
const monetPropModules = import.meta.glob<string>("./assets/props/monet/*.png", {
  eager: true,
  import: "default",
  query: "?url",
});
const outdoorPropModules = import.meta.glob<string>("./assets/props/outdoor-triptych/*.png", {
  eager: true,
  import: "default",
  query: "?url",
});
// Do not use a catch-all room glob here: Vite eagerly emits every matched file.
// The itch sampler deliberately ships only its three playable houses.
const roomModules = {
  ...import.meta.glob<string>("./assets/rooms/van-gogh-*.jpg", { eager: true, import: "default", query: "?url" }),
  ...import.meta.glob<string>("./assets/rooms/monet-*.jpg", { eager: true, import: "default", query: "?url" }),
  ...import.meta.glob<string>("./assets/rooms/outdoor-triptych/*.jpg", { eager: true, import: "default", query: "?url" }),
};

const VAN_GOGH_MODEL_ART_IDS: Readonly<Record<string, string>> = {
  "blue-sofa": "blue-settee-v1",
  "canvas-stack": "canvas-stack-v1",
  "standing-lamp-gold": "floor-lamp-v1",
  "chair-oak": "oak-chair-v1",
  "painted-cabinet": "painted-cabinet-v1",
  "painter-crate": "painter-crate-v1",
  "paint-splashed-rug": "paint-splashed-rug-v1",
  "rattan-armchair": "rattan-chair-v1",
  "round-stool": "round-stool-v1",
  "round-pedestal-table": "round-table-v1",
  "sunflower-vase": "sunflower-vase-v1",
  "spilled-paint-kit": "spilled-paint-kit-v1",
  "crumpled-sketches": "crumpled-sketches-v1",
  "tall-brush-jar": "tall-brush-jar-v1",
  "tripod-easel": "tripod-easel-v1",
  "atelier-table": "writing-table-v1",
};

const VAN_GOGH_INSTANCE_ART_IDS: Readonly<Record<string, string>> = {
  "vg-bedroom-cabinet": "vg-bedroom-cabinet-v1",
  "vg-bedroom-chair": "vg-bedroom-chair-v1",
  "vg-bedroom-cypress": "vg-bedroom-cypress-v1",
  "vg-bedroom-daybed": "vg-bedroom-daybed-v1",
  "vg-bedroom-lamp": "vg-bedroom-lamp-v1",
  "vg-bedroom-side-table": "vg-bedroom-side-table-v1",
  "vg-bedroom-vase": "vg-bedroom-vase-v1",
  "vg-studio-easel-right": "vg-studio-easel-right-v1",
  "vg-studio-table": "vg-studio-table-v1",
  "vg-studio-vase": "vg-studio-vase-v1",
  "vg-parlor-writing-chair-copy": "vg-parlor-writing-chair-copy-v1",
};

const MONET_MODEL_ART_IDS: Readonly<Record<string, string>> = {
  "blue-sofa": "monet-water-settee-v1",
  "atelier-table": "monet-writing-table-v1",
  "standing-lamp-gold": "monet-conservatory-lamp-v1",
  "round-pedestal-table": "monet-lily-table-v1",
  "rattan-armchair": "monet-willow-chair-v1",
  "chair-oak": "monet-giverny-chair-v1",
  "sunflower-vase": "monet-iris-vase-v1",
  "flower-etagere": "monet-flower-etagere-v1",
  "water-lily-basin": "monet-lily-basin-v1",
  "garden-trolley": "monet-garden-trolley-v1",
  "japanese-folding-screen": "monet-japanese-screen-v1",
};

export interface PropSpec {
  width: number;
  height: number;
  shadowWidth: number;
  shadowDepth: number;
  collisionWidth: number;
  collisionDepth: number;
  collision: readonly CollisionRect[];
  surface?: boolean;
}

const SOLID_FOOTPRINT = [{ x: -0.5, y: -0.5, w: 1, h: 1 }] as const;
const NO_COLLISION = [] as const;

export const PROP_SPECS: Readonly<Record<string, PropSpec>> = {
  "blue-sofa": { width: 174, height: 126, shadowWidth: 170, shadowDepth: 34, collisionWidth: 174, collisionDepth: 70, collision: SOLID_FOOTPRINT },
  "canvas-stack": { width: 82, height: 138, shadowWidth: 74, shadowDepth: 18, collisionWidth: 82, collisionDepth: 24, collision: SOLID_FOOTPRINT },
  "cypress-plant-stand": { width: 66, height: 130, shadowWidth: 54, shadowDepth: 24, collisionWidth: 66, collisionDepth: 54, collision: SOLID_FOOTPRINT },
  "standing-lamp-gold": { width: 46, height: 127, shadowWidth: 42, shadowDepth: 18, collisionWidth: 46, collisionDepth: 38, collision: SOLID_FOOTPRINT },
  "chair-oak": { width: 62, height: 96, shadowWidth: 55, shadowDepth: 25, collisionWidth: 62, collisionDepth: 50, collision: [{ x: -0.444, y: 0, w: 0.887, h: 0.5 }] },
  "painted-cabinet": { width: 142, height: 104, shadowWidth: 134, shadowDepth: 30, collisionWidth: 142, collisionDepth: 56, collision: SOLID_FOOTPRINT },
  "painter-crate": { width: 72, height: 64, shadowWidth: 68, shadowDepth: 22, collisionWidth: 72, collisionDepth: 48, collision: SOLID_FOOTPRINT },
  "paint-splashed-rug": { width: 230, height: 128, shadowWidth: 0, shadowDepth: 0, collisionWidth: 230, collisionDepth: 116, collision: NO_COLLISION, surface: true },
  "rattan-armchair": { width: 82, height: 112, shadowWidth: 74, shadowDepth: 31, collisionWidth: 82, collisionDepth: 64, collision: [{ x: -0.451, y: 0.016, w: 0.902, h: 0.484 }] },
  "round-stool": { width: 46, height: 54, shadowWidth: 43, shadowDepth: 22, collisionWidth: 46, collisionDepth: 40, collision: SOLID_FOOTPRINT },
  "round-pedestal-table": { width: 82, height: 92, shadowWidth: 75, shadowDepth: 29, collisionWidth: 82, collisionDepth: 68, collision: [{ x: -0.457, y: 0.074, w: 0.915, h: 0.426 }] },
  "sunflower-vase": { width: 56, height: 82, shadowWidth: 34, shadowDepth: 15, collisionWidth: 40, collisionDepth: 32, collision: SOLID_FOOTPRINT },
  "spilled-paint-kit": { width: 94, height: 77, shadowWidth: 86, shadowDepth: 20, collisionWidth: 94, collisionDepth: 58, collision: [{ x: -0.42, y: -0.35, w: 0.84, h: 0.65 }] },
  "crumpled-sketches": { width: 78, height: 56, shadowWidth: 0, shadowDepth: 0, collisionWidth: 78, collisionDepth: 48, collision: NO_COLLISION, surface: true },
  "tall-brush-jar": { width: 48, height: 83, shadowWidth: 38, shadowDepth: 15, collisionWidth: 48, collisionDepth: 38, collision: SOLID_FOOTPRINT },
  "tripod-easel": { width: 80, height: 131, shadowWidth: 72, shadowDepth: 25, collisionWidth: 80, collisionDepth: 48, collision: SOLID_FOOTPRINT },
  "atelier-table": { width: 148, height: 88, shadowWidth: 140, shadowDepth: 35, collisionWidth: 148, collisionDepth: 72, collision: [{ x: -0.473, y: 0.014, w: 0.946, h: 0.486 }] },
  "flower-etagere": { width: 92, height: 188, shadowWidth: 82, shadowDepth: 22, collisionWidth: 92, collisionDepth: 44, collision: [{ x: -0.45, y: -0.5, w: 0.16, h: 1 }, { x: 0.29, y: -0.5, w: 0.16, h: 1 }] },
  "water-lily-basin": { width: 132, height: 88, shadowWidth: 118, shadowDepth: 38, collisionWidth: 132, collisionDepth: 72, collision: [{ x: -0.46, y: -0.42, w: 0.92, h: 0.82 }] },
  "garden-trolley": { width: 160, height: 145, shadowWidth: 150, shadowDepth: 38, collisionWidth: 160, collisionDepth: 70, collision: [{ x: -0.48, y: -0.46, w: 0.96, h: 0.88 }] },
  "japanese-folding-screen": { width: 154, height: 204, shadowWidth: 146, shadowDepth: 18, collisionWidth: 154, collisionDepth: 30, collision: SOLID_FOOTPRINT },
  "world-transition-path": { width: 360, height: 180, shadowWidth: 0, shadowDepth: 0, collisionWidth: 360, collisionDepth: 180, collision: NO_COLLISION, surface: true },
  "world-pink-green-tree": { width: 500, height: 350, shadowWidth: 190, shadowDepth: 42, collisionWidth: 500, collisionDepth: 80, collision: NO_COLLISION },
  "world-antigravity-papers": { width: 170, height: 276, shadowWidth: 0, shadowDepth: 0, collisionWidth: 170, collisionDepth: 68, collision: NO_COLLISION },
  // Unfinished Morning (sizes + collision rects verbatim from Snake Lab
  // roomModels.ts; collisionWidth/Depth = model width/depth so the layout's
  // per-instance collision pads keep Snake Lab semantics). The 6B figure
  // groups use two foot-contact rects so the academy stairs stay walkable.
  "humanist-standing-pair": { width: 190, height: 210, shadowWidth: 170, shadowDepth: 20, collisionWidth: 190, collisionDepth: 42, collision: [{ x: -0.42, y: -0.5, w: 0.24, h: 1 }, { x: 0.18, y: -0.5, w: 0.24, h: 1 }] },
  "humanist-reclining-figure": { width: 220, height: 145, shadowWidth: 200, shadowDepth: 28, collisionWidth: 220, collisionDepth: 60, collision: [{ x: -0.45, y: -0.5, w: 0.9, h: 1 }] },
  "humanist-geometer-group": { width: 220, height: 145, shadowWidth: 200, shadowDepth: 30, collisionWidth: 220, collisionDepth: 62, collision: [{ x: -0.47, y: -0.5, w: 0.42, h: 1 }, { x: 0.08, y: -0.5, w: 0.39, h: 1 }] },
  "humanist-raphael-figure": { width: 86, height: 195, shadowWidth: 66, shadowDepth: 16, collisionWidth: 86, collisionDepth: 32, collision: [{ x: -0.3, y: -0.5, w: 0.6, h: 1 }] },
  "scroll-scholar-rock": { width: 168, height: 132, shadowWidth: 150, shadowDepth: 22, collisionWidth: 168, collisionDepth: 46, collision: [{ x: -0.42, y: -0.5, w: 0.5, h: 1 }, { x: 0.04, y: -0.38, w: 0.28, h: 0.76 }] },
  "scroll-stone-pavilion": { width: 80, height: 132, shadowWidth: 66, shadowDepth: 16, collisionWidth: 80, collisionDepth: 34, collision: [{ x: -0.4, y: -0.5, w: 0.8, h: 1 }] },
};

interface SavedPortal {
  id: string;
  leftEntry: { x: number; y: number; w: number; h: number };
  rightEntry: { x: number; y: number; w: number; h: number };
  // Newer snake-lab layouts can replace either rectangular trigger with an
  // authored polygon. Keep these optional so the existing room JSON remains
  // exactly compatible and falls back to its rectangle.
  leftEntryShape?: readonly Point[];
  rightEntryShape?: readonly Point[];
  leftExit: Point;
  rightExit: Point;
}

interface SavedSpawnPoint {
  x: number;
  y: number;
}

interface SavedSpawns {
  hiderSpawn?: SavedSpawnPoint;
  seekerSpawn?: SavedSpawnPoint;
  spectatorSpawn?: SavedSpawnPoint;
}

interface SavedLayout {
  props: PropInstance[];
  floor: Point[][];
  portals?: SavedPortal[];
  /** Optional editor-authored world-space barriers between/behind scenery. */
  collisionRects?: readonly CollisionRect[];
  /** Newer Snake Lab layouts can use irregular barriers for painted terrain. */
  collisionPolys?: readonly (readonly Point[])[];
  // Editor-authored birth places, in world coordinates (0 .. 3·VIEW_WIDTH).
  // Absent on older layouts (Van Gogh, Monet), which fall back to legacy spots.
  spawns?: SavedSpawns;
}

/** A birth place in the per-room coordinates the game actors use. */
export interface ActorSpawn {
  roomIndex: 0 | 1 | 2;
  x: number;
  y: number;
}

export interface RoomSpawns {
  hider: ActorSpawn;
  seeker: ActorSpawn;
}

interface ArtHouseRuntime {
  id: ArtHouseId;
  roomTitles: readonly [string, string, string];
  roomUrls: readonly [readonly string[], readonly string[], readonly string[]];
  thumbnailUrl: string;
  props: readonly PropInstance[];
  floors: readonly Point[][];
  portals: readonly SavedPortal[];
  propUrls: Readonly<Record<string, string>>;
  modelArtIds: Readonly<Record<string, string>>;
  instanceArtIds: Readonly<Record<string, string>>;
  /** Props carry their own art id in the imported layout. */
  usesExplicitArtIds?: boolean;
  /** Editor-authored world-space barriers, separate from prop footprints. */
  layoutCollisionRects: readonly CollisionRect[];
  layoutCollisionPolys: readonly (readonly Point[])[];
  backgroundSolids: readonly (readonly CollisionRect[])[];
  surfaceReplacedPropIds: readonly ReadonlySet<string>[];
  spawns: RoomSpawns;
}

// Legacy hand-placed birth spots for layouts authored before the editor wrote a
// `spawns` block (Van Gogh, Monet).
const LEGACY_HIDER_SPAWN: ActorSpawn = { roomIndex: 0, x: 520, y: 470 };
const LEGACY_SEEKER_SPAWN: ActorSpawn = { roomIndex: 0, x: 150, y: 520 };

function worldSpawnToActor(point: SavedSpawnPoint | undefined, fallback: ActorSpawn): ActorSpawn {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return fallback;
  const roomIndex = Math.min(2, Math.max(0, Math.floor(point.x / VIEW_WIDTH))) as 0 | 1 | 2;
  return { roomIndex, x: Math.round(point.x - roomIndex * VIEW_WIDTH), y: Math.round(point.y) };
}

function spawnsFromLayout(layout: SavedLayout): RoomSpawns {
  return {
    hider: worldSpawnToActor(layout.spawns?.hiderSpawn, LEGACY_HIDER_SPAWN),
    seeker: worldSpawnToActor(layout.spawns?.seekerSpawn, LEGACY_SEEKER_SPAWN),
  };
}

function assetUrl(path: string): string {
  const url = roomModules[path];
  if (!url) throw new Error(`Missing room asset: ${path}`);
  return url;
}

function repeatSurface(path: string): readonly [string, string, string] {
  const url = assetUrl(path);
  return [url, url, url];
}

function indexPropUrls(modules: Record<string, string>): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(modules).map(([path, url]) => [path.split("/").pop()!.replace(/\.png$/u, ""), url]));
}

const vanGoghLayout = vanGoghLayoutJson as SavedLayout;
const monetLayout = monetLayoutJson as SavedLayout;
const outdoorLayout = outdoorLayoutJson as SavedLayout;
const EMPTY_PROP_SETS = [new Set<string>(), new Set<string>(), new Set<string>()] as const;
const EMPTY_BACKGROUND_SOLIDS = [[], [], []] as const;
const MONET_BACKGROUND_SOLIDS = [
  { x: 204, y: 215, w: 152, h: 34 },
  { x: 1307, y: 238, w: 245, h: 40 },
  { x: 2600, y: 312, w: 220, h: 148 },
] as const;

const HOUSES: Readonly<Record<ArtHouseId, ArtHouseRuntime>> = {
  "van-gogh-house": {
    id: "van-gogh-house",
    roomTitles: ["Sunflower Parlor", "Starry Studio", "Cypress Bedroom"],
    roomUrls: [
      [assetUrl("./assets/rooms/van-gogh-sunflower-parlor-shell-v6a.jpg"), assetUrl("./assets/rooms/van-gogh-sunflower-parlor-shell-v6b.jpg"), assetUrl("./assets/rooms/van-gogh-sunflower-parlor-shell-v6c.jpg")],
      [assetUrl("./assets/rooms/van-gogh-starry-studio-shell-v6a.jpg"), assetUrl("./assets/rooms/van-gogh-starry-studio-shell-v6b.jpg"), assetUrl("./assets/rooms/van-gogh-starry-studio-shell-v6c.jpg")],
      [assetUrl("./assets/rooms/van-gogh-cypress-bedroom-shell-v6a.jpg"), assetUrl("./assets/rooms/van-gogh-cypress-bedroom-shell-v6b.jpg"), assetUrl("./assets/rooms/van-gogh-cypress-bedroom-shell-v6c.jpg")],
    ],
    thumbnailUrl: assetUrl("./assets/rooms/van-gogh-sunflower-parlor-shell-v6a.jpg"),
    props: vanGoghLayout.props,
    floors: vanGoghLayout.floor,
    portals: vanGoghLayout.portals ?? [],
    layoutCollisionRects: vanGoghLayout.collisionRects ?? [],
    layoutCollisionPolys: vanGoghLayout.collisionPolys ?? [],
    spawns: spawnsFromLayout(vanGoghLayout),
    propUrls: indexPropUrls(vanGoghPropModules),
    modelArtIds: VAN_GOGH_MODEL_ART_IDS,
    instanceArtIds: VAN_GOGH_INSTANCE_ART_IDS,
    backgroundSolids: [
      [{ x: 204, y: 215, w: 152, h: 32 }, { x: 1205, y: 238, w: 110, h: 38 }, { x: 2596, y: 312, w: 184, h: 144 }],
      [{ x: 348, y: 204, w: 264, h: 30 }, { x: 1320, y: 238, w: 226, h: 38 }, { x: 2578, y: 288, w: 98, h: 40 }],
      [{ x: 208, y: 218, w: 152, h: 40 }, { x: 436, y: 238, w: 254, h: 45 }, { x: 1314, y: 226, w: 240, h: 36 }, { x: 1177, y: 245, w: 100, h: 42 }, { x: 2652, y: 316, w: 174, h: 150 }, { x: 2276, y: 267, w: 150, h: 40 }],
    ],
    surfaceReplacedPropIds: [
      new Set(["vg-bedroom-daybed", "vg-bedroom-cabinet", "vg-bedroom-cypress", "vg-bedroom-chair", "vg-bedroom-lamp"]),
      new Set(["vg-bedroom-cabinet", "vg-bedroom-cypress"]),
      new Set(["vg-bedroom-daybed", "vg-bedroom-cabinet", "vg-bedroom-cypress", "vg-bedroom-lamp"]),
    ],
  },
  "monet-garden-house": {
    id: "monet-garden-house",
    roomTitles: ["Water Lily Conservatory", "Giverny Sunroom", "Morning Mist Salon"],
    roomUrls: [
      repeatSurface("./assets/rooms/monet-water-lily-conservatory-shell-v1.jpg"),
      repeatSurface("./assets/rooms/monet-giverny-sunroom-shell-v1.jpg"),
      repeatSurface("./assets/rooms/monet-morning-mist-salon-shell-v1.jpg"),
    ],
    thumbnailUrl: assetUrl("./assets/rooms/monet-water-lily-conservatory-shell-v1.jpg"),
    props: monetLayout.props,
    floors: monetLayout.floor,
    portals: monetLayout.portals ?? [],
    layoutCollisionRects: monetLayout.collisionRects ?? [],
    layoutCollisionPolys: monetLayout.collisionPolys ?? [],
    spawns: spawnsFromLayout(monetLayout),
    propUrls: indexPropUrls(monetPropModules),
    modelArtIds: MONET_MODEL_ART_IDS,
    instanceArtIds: {},
    backgroundSolids: [MONET_BACKGROUND_SOLIDS, MONET_BACKGROUND_SOLIDS, MONET_BACKGROUND_SOLIDS],
    surfaceReplacedPropIds: EMPTY_PROP_SETS,
  },
  "outdoor-masters-journey": {
    id: "outdoor-masters-journey",
    roomTitles: ["Cypress Terrace", "Water Garden Walk", "Sea-Breeze Garden"],
    roomUrls: [
      repeatSurface("./assets/rooms/outdoor-triptych/van-gogh-cypress-terrace-shell-v2.jpg"),
      repeatSurface("./assets/rooms/outdoor-triptych/monet-water-garden-walk-shell-v2.jpg"),
      repeatSurface("./assets/rooms/outdoor-triptych/fauvist-sea-breeze-garden-shell-v2.jpg"),
    ],
    thumbnailUrl: assetUrl("./assets/rooms/outdoor-triptych/van-gogh-cypress-terrace-shell-v2.jpg"),
    props: outdoorLayout.props,
    floors: outdoorLayout.floor,
    portals: outdoorLayout.portals ?? [],
    layoutCollisionRects: outdoorLayout.collisionRects ?? [],
    layoutCollisionPolys: outdoorLayout.collisionPolys ?? [],
    spawns: spawnsFromLayout(outdoorLayout),
    propUrls: indexPropUrls(outdoorPropModules),
    modelArtIds: {},
    instanceArtIds: {},
    usesExplicitArtIds: true,
    backgroundSolids: EMPTY_BACKGROUND_SOLIDS,
    surfaceReplacedPropIds: EMPTY_PROP_SETS,
  },
};

export const ART_HOUSE_THUMBNAILS: Readonly<Record<ArtHouseId, string>> = {
  "van-gogh-house": HOUSES["van-gogh-house"].thumbnailUrl,
  "monet-garden-house": HOUSES["monet-garden-house"].thumbnailUrl,
  "outdoor-masters-journey": HOUSES["outdoor-masters-journey"].thumbnailUrl,
};

/** Pick one authored room image for a Lobby card without fetching a
 * per-challenge screenshot from D1. The challenge token makes the choice look
 * random across cards while staying stable across rerenders and refreshes. */
export function lobbyRoomThumbnail(artHouse: ArtHouseId, seed: string): string {
  const rooms = HOUSES[artHouse].roomUrls;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const roomIndex = (hash >>> 0) % rooms.length;
  return rooms[roomIndex]?.[0] ?? HOUSES[artHouse].thumbnailUrl;
}

export function roomTitlesFor(artHouse: ArtHouseId): readonly [string, string, string] {
  return HOUSES[artHouse].roomTitles;
}

export function roomUrl(artHouse: ArtHouseId, roomIndex: 0 | 1 | 2, surface: 0 | 1 | 2): string | null {
  return HOUSES[artHouse].roomUrls[roomIndex]?.[surface] ?? null;
}

export function portalsFor(artHouse: ArtHouseId): readonly SavedPortal[] {
  return HOUSES[artHouse].portals;
}

/** Editor-authored hider/seeker birth places, in per-room actor coordinates. */
export function spawnsFor(artHouse: ArtHouseId): RoomSpawns {
  return HOUSES[artHouse].spawns;
}

function stableVariant(id: string, seed: number): 0 | 1 | 2 {
  const source = `${seed >>> 0}:${id}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 0x01000193) >>> 0;
  }
  return (hash % 3) as 0 | 1 | 2;
}

export function activeProps(artHouse: ArtHouseId, surface: 0 | 1 | 2): readonly PropInstance[] {
  const house = HOUSES[artHouse];
  const replaced = house.surfaceReplacedPropIds[surface] ?? new Set<string>();
  return house.props.filter(prop => !replaced.has(prop.id));
}

export function propUrl(artHouse: ArtHouseId, instance: PropInstance, artSeed: number): string | null {
  const house = HOUSES[artHouse];
  const base = house.usesExplicitArtIds
    ? instance.artId
    : house.instanceArtIds[instance.id] ?? house.modelArtIds[instance.modelId];
  if (!base) return null;
  const variant = stableVariant(instance.id, artSeed);
  const artId = variant === 0 ? base : base.replace(/-v1$/u, `-v${variant + 1}`);
  return house.propUrls[artId] ?? house.propUrls[base] ?? null;
}

export function pointOnWalkableFloor(artHouse: ArtHouseId, roomIndex: 0 | 1 | 2, localX: number, y: number): boolean {
  const polygon = HOUSES[artHouse].floors[roomIndex];
  if (!polygon) return false;
  const x = localX + roomIndex * VIEW_WIDTH;
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
    const a = polygon[current];
    const b = polygon[previous];
    if (!a || !b) continue;
    const crosses = (a.y > y) !== (b.y > y)
      && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function actorCanStandAt(
  artHouse: ArtHouseId,
  surface: 0 | 1 | 2,
  roomIndex: 0 | 1 | 2,
  localX: number,
  y: number,
): boolean {
  for (const x of [localX - ACTOR_HALF_WIDTH, localX + ACTOR_HALF_WIDTH]) {
    for (const footY of [y - ACTOR_HALF_HEIGHT, y + ACTOR_HALF_HEIGHT]) {
      if (!pointOnWalkableFloor(artHouse, roomIndex, x, footY)) return false;
    }
  }

  const house = HOUSES[artHouse];
  const worldX = localX + roomIndex * VIEW_WIDTH;
  if (actorHitsAnyRect(worldX, y, house.layoutCollisionRects)) return false;
  if (actorHitsAnyPolygon(worldX, y, house.layoutCollisionPolys)) return false;
  if (actorHitsAnyRect(worldX, y, house.backgroundSolids[surface] ?? [])) return false;
  for (const instance of activeProps(artHouse, surface)) {
    if (instance.x < roomIndex * VIEW_WIDTH || instance.x >= (roomIndex + 1) * VIEW_WIDTH) continue;
    const spec = PROP_SPECS[instance.modelId];
    if (spec && actorHitsAnyRect(worldX, y, propCollisionRects(instance, spec))) return false;
  }
  return true;
}
