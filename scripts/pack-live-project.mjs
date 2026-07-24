// Pack the Unfinished Morning live background — images, brushes and every
// setting — into ONE portable `.lpp` file (Lucas live-painting project).
//
// A `.lpp` is a plain ZIP archive with a canonical layout:
//   manifest.json               machine-readable settings (format v1)
//   notes.md                    how the effect works + how to open the file
//   scenes/<id>/shell.jpg       the pale "unfinished" base the room rests on
//   scenes/<id>/donor.jpg       the finished color that breathes in (white = hole)
//   brushes/*.fnbrush.json      the three active Live Brush function-brush files
//   effects/*                   auxiliary maps (kept for provenance)
//
// Open it with `unzip file.lpp -d out/` or rename to .zip. Regenerate with:
//   node scripts/pack-live-project.mjs
//
// This file format is the baseline for Art Lab's Live Painting "load project".
// The TypeScript renderers (src/game/livePainting.ts, liveRoomPainting.ts)
// remain authoritative; the manifest carries the same reviewed constants.
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "src/game/assets/rooms/unfinished-morning");
const outFile = join(root, "content/live-projects/unfinished-morning.lpp");
const stage = join(root, "content/live-projects/.staging-unfinished-morning");

// Same deterministic hash as the renderers — accents are resolved here so the
// manifest is self-contained (colors stay runtime-sampled from the donor).
function hash(seed) {
  const value = Math.sin((seed + 1) * 127.1) * 43758.5453;
  return value - Math.floor(value);
}
const round2 = value => Math.round(value * 100) / 100;

// liveRoomPainting.makeCurrentMarks (room 0 sky current), color left to runtime.
const blueCurrentMarks = Array.from({ length: 34 }, (_, index) => {
  const u = index / 33;
  return {
    x: round2(430 + u * 410),
    y: round2(68 + Math.sin(u * Math.PI * 1.1) * 84 + Math.sin(u * Math.PI * 3) * 14),
    size: round2(24 + hash(1700 + index * 5) * 22),
    seed: round2(hash(1700 + index * 7)),
    angle: round2(.1 + Math.cos(u * Math.PI) * .28),
  };
});

// liveRoomPainting.makeDraftLines (room 0 floor graphite).
const graphiteLines = Array.from({ length: 7 }, (_, index) => {
  const seed = 811 + index * 31;
  const x = 92 + hash(seed + 3) * 790;
  const y = 342 + Math.pow(hash(seed + 1), .72) * 225;
  const angle = Math.atan2(y - 292, x - 485)
    + (index % 3 === 0 ? Math.PI / 2 : 0)
    + (hash(seed + 11) - .5) * .28;
  return {
    x: round2(x),
    y: round2(y),
    length: round2(18 + hash(seed + 5) * (42 + (y - 342) * .13)),
    bend: round2((hash(seed + 7) - .5) * 10),
    angle: round2(angle),
    seed: round2(hash(seed + 13)),
    speed: round2(.075 + hash(seed + 17) * .055),
    weight: round2(.55 + hash(seed + 19) * .75),
  };
});

const scenes = [
  {
    index: 0,
    id: "blank-canvas",
    title: "Blank Canvas Morning",
    shell: "unfinished-morning-blank-canvas-shell-v1.jpg",
    donor: "donors/unfinished-morning-blank-canvas-owner-donor-v3.jpg",
    accents: { blueCurrent: blueCurrentMarks, graphiteLines },
  },
  {
    index: 1,
    id: "humanist-dome",
    title: "Humanist Dome · Academy of Many Minds",
    shell: "unfinished-morning-humanist-dome-shell-v1.jpg",
    donor: "donors/unfinished-morning-humanist-owner-donor-v5.jpg",
    // The Creator's face is always supplied by the shell, never by the donor.
    faceHole: { stampSeed: 895, x: 150, y: 24, width: 42, height: 42, space: "fx" },
    accents: {},
  },
  {
    index: 2,
    id: "handscroll",
    title: "Ten-Thousand-Forms Handscroll",
    shell: "unfinished-morning-handscroll-shell-v1.jpg",
    donor: "donors/unfinished-morning-handscroll-owner-donor-v4.jpg",
    accents: {},
  },
];

const manifest = {
  format: "lucas-live-painting-project",
  version: 1,
  id: "unfinished-morning",
  name: "The Unfinished Morning — Live Painting project",
  container: ".lpp is a standard ZIP archive: rename to .zip or `unzip unfinished-morning.lpp -d out/`",
  source: "painterly-chameleon — TypeScript renderers are authoritative (src/game/livePainting.ts, src/game/liveRoomPainting.ts)",
  stage: { width: 960, height: 640, fxScale: .5, fxNote: "distance/mask work runs at stage*fxScale (480x320), scaled up bilinearly" },
  forceStrength: 1,
  timing: {
    note: "One shared clock (seconds). Every animated element owns a seed in [0,1); phases are staggered so nothing pulses in sync.",
    alphaWave: {
      speedMin: .08,
      speedRange: .044,
      state: "cycle=(t*speed+seed)%1; growth=smoothstep(.005,.8,cycle); opacity=smoothstep(.015,.34,cycle)*(1-smoothstep(.64,.985,cycle))",
    },
    blueCurrent: {
      travelSpeed: 18,
      state: "phase=t+seed*2PI; slide=((t*18+seed*55)%48)-24; sizeScale=1+sin(phase*.8)*.08; yDrift=sin(phase)*2.1; opacity=.16+(sin(phase*1.2)+1)*.08",
    },
    graphite: {
      speedMin: .075,
      speedRange: .055,
      state: "cycle=(t*speed+seed)%1; start=smoothstep(.7,.9,cycle); end=smoothstep(.04,.27,cycle); stroke the fixed bezier only between start..end (a pencil drawing then erasing itself)",
    },
  },
  background: {
    technique: "donor-alpha-wave",
    summary: "The finished color painting (donor) breathes into view over the pale shell as soft rings expanding out of the owner-painted WHITE holes, then dissipates. Alpha-only: no white pigment is ever drawn.",
    pipeline: [
      "1. Draw the shell (the resting sketch) as the room background.",
      "2. Load the donor at fxScale; key owner-painted white to transparent: alpha *= smoothstep(5,38, euclideanDistanceFromWhite(rgb)).",
      "3. Remove the white fringe so no near-white pixel ever animates: keepAlpha = smoothstep(82,132,colorDistanceFromWhite) * smoothstep(7,28,chamferDistanceFromNearestHole).",
      "4. Pool discovery: flood-fill transparent regions (alpha<=8); ignore regions under 48 fx-pixels; each region is one wave origin (pool).",
      "5. Per pool, precompute a two-pass 8-neighbour chamfer distance field from the hole outward.",
      "6. Per frame (mask capped at 30fps): for each pool take alphaWave state; the visible band is an annulus IN DISTANCE SPACE: front=(maxDistance+46)*growth, band=30+growth*84, softness=25+growth*30, distance jittered by a low-frequency sine noise field (amount 5+growth*17); pool opacity *= .84+hash*.16.",
      "7. Accumulate pools with screen compositing (1-(1-a)(1-b)) into an alpha mask; donorLayer = donor x mask; draw over the shell.",
      "8. Scene accents (blank-canvas only): blue current stamps sliding in the sky + graphite draft lines self-drawing on the floor.",
    ],
    donorKeying: { whiteToAlphaSmoothstep: [5, 38], fringeColoredContent: [82, 132], fringeTransparentFeather: [7, 28] },
    poolDiscovery: { alphaThreshold: 8, minRegionPixels: 48 },
    wave: { frontPad: 46, band: [30, 84], softness: [25, 30], noiseAmount: [5, 17], poolOpacityJitter: [.84, .16], maskFps: 30 },
    noiseField: "n(x,y)=sin(x*.041+y*.017+room*1.73)*.47 + sin(x*.016-y*.053+room*2.31)*.31 + sin((x+y)*.009+room*3.17)*.22",
    blueCurrentColor: "sampledDonorPixel*0.58 + rgb(91,136,156)*0.42 (keeps the current legibly blue)",
    graphiteColor: "rgb(82,85,82), alpha .34",
  },
  scenes: scenes.map(scene => ({
    index: scene.index,
    id: scene.id,
    title: scene.title,
    shell: `scenes/${scene.id}/shell.jpg`,
    donor: `scenes/${scene.id}/donor.jpg`,
    originalShell: scene.shell,
    originalDonor: scene.donor,
    ...(scene.faceHole ? { faceHole: scene.faceHole } : {}),
    accents: scene.accents,
  })),
  avatar: {
    summary: "FORCE-ONLY (D-016, rebuildPhoto semantics): at rest the chameleon keeps its exact painted colors; a Live Brush never introduces pigment. liquid-color runs the room's alpha wave LOCALLY — inside one expanding organic ring the base paint thins (pure alpha) while the SAME pigment is re-laid slightly outward, then heals. blue-current = the room's S-stamp sliding along the gesture, tinted with the exact sampled paint color. graphite-whisper = the room's self-drawing fixed vector in the sampled color. (white-mist was retired 2026-07-21; old marks fall back to liquid-color.)",
    markSpace: 256,
    maxMarks: 320,
    sizeRange: [8, 96],
    toolSizeMax: 60,
    flowRange: { min: 10, max: 100, default: 68, note: "per-mark pigment density: opacity factor plus dab spacing while stroking" },
    strengthRange: { min: 10, max: 100, default: 68, note: "the force (quiet→live) dial = per-challenge RATE OF CHANGE: an animation-clock multiplier (10≈0.35x, 68=the reviewed cadence 1x, 100=2x); never affects reach, density or opacity" },
    wave: { liquidReach: 2.3, liquidReveal: .55, erosion: .85, zoom: "1+growth*.15", drift: "±3.6px at 512-study scale", band: "size*(.42+growth*.5)", note: "erosion must clearly exceed reveal or the wave cancels itself and is invisible on smooth paint", stamps: "6 organic fade stamps (seed 701+i*97, 240px); the crossed core is cut so the wave is a dissipating ring" },
    brushes: [
      "brushes/blue-current.fnbrush.json",
      "brushes/liquid-color.fnbrush.json",
      "brushes/graphite-whisper.fnbrush.json",
    ],
  },
  effects: [
    { path: "effects/fog-density.png", original: "effects/unfinished-morning-fog-density-v1.png", used: false, note: "from an earlier fog approach; the shipped renderer ignores it (kept for provenance)" },
  ],
};

const notes = `# The Unfinished Morning — Live Painting project (.lpp)

（打开方式：\`.lpp\` 就是一个标准 ZIP —— 改名成 .zip 双击，或 \`unzip unfinished-morning.lpp -d out/\` 即可检查全部原始数据。）

## What this file is

One portable bundle of EVERYTHING the live background effect needs: the shell
images (the resting sketch), the color donors (with owner-painted white holes),
the three active Live Brush function-brush files, and every reviewed setting in
\`manifest.json\`. It is the baseline file format for Art Lab's Live Painting
"load project".

## How the background effect works (donor-alpha-wave)

1. The room rests as the SHELL — a pale, unfinished sketch (scenes/*/shell.jpg).
2. The DONOR (scenes/*/donor.jpg) is the same view fully painted, except the
   owner painted pure WHITE over the parts that must stay unfinished.
3. At load, white is keyed to transparency (with a soft feather), so each white
   area becomes a HOLE — and each hole becomes a wave origin ("pool").
4. A chamfer distance field is precomputed from every hole outward.
5. Every frame, each pool runs one alpha wave (see manifest.timing.alphaWave):
   an annulus in distance space — front = (maxDistance+46)*growth — expands out
   of the hole like a smoke ring, jittered by a low-frequency noise field so it
   never looks geometric, then dissipates (opacity = appear*disappear).
6. The donor is revealed ONLY inside these rings (alpha mask, screen-
   accumulated), drawn over the shell. No white pigment is ever drawn: the
   whole transition is alpha.
7. Scene accents (blank-canvas room only): tinted S-curve "blue current"
   stamps sliding through the sky, and floor graphite draft lines that draw and
   erase themselves like a pencil (manifest.scenes[0].accents).

The chameleon avatar uses the same technique at mark scale, but FORCE-ONLY
(D-016 / Art Lab rebuildPhoto semantics): at rest it keeps its exact painted
colors, and a Live Brush never introduces pigment. Each liquid-color mark runs
the alpha wave locally — the paint inside an expanding organic ring thins out
(pure alpha) while the same pigment is re-laid slightly outward, then heals.
Blue-current and graphite-whisper are the two room accents, both in the
sampled paint color. Dials: size = footprint, flow = pigment density, force
(quiet→live) = rate of change (manifest.avatar). white-mist was retired.

## Layout

- manifest.json — all settings (format: lucas-live-painting-project v1)
- scenes/<id>/shell.jpg + donor.jpg — per-room image pair
- brushes/*.fnbrush.json — Live Brushes (v1 Function Brush contract)
- effects/fog-density.png — unused legacy map, kept for provenance

The TypeScript renderers in painterly-chameleon
(src/game/livePainting.ts, src/game/liveRoomPainting.ts) are authoritative;
this bundle carries the same reviewed constants for Art Lab import.
`;

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
writeFileSync(join(stage, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(stage, "notes.md"), notes);
for (const scene of scenes) {
  const dir = join(stage, "scenes", scene.id);
  mkdirSync(dir, { recursive: true });
  cpSync(join(assets, scene.shell), join(dir, "shell.jpg"));
  cpSync(join(assets, scene.donor), join(dir, "donor.jpg"));
}
mkdirSync(join(stage, "brushes"), { recursive: true });
for (const brush of ["blue-current", "liquid-color", "graphite-whisper"]) {
  cpSync(join(root, "content/live-brushes/6a", `${brush}.fnbrush.json`), join(stage, "brushes", `${brush}.fnbrush.json`));
}
mkdirSync(join(stage, "effects"), { recursive: true });
cpSync(join(assets, "effects/unfinished-morning-fog-density-v1.png"), join(stage, "effects/fog-density.png"));

rmSync(outFile, { force: true });
mkdirSync(dirname(outFile), { recursive: true });
execSync(`zip -r -X ${JSON.stringify(outFile)} .`, { cwd: stage, stdio: "pipe" });
rmSync(stage, { recursive: true, force: true });
console.log(`packed ${outFile}`);
console.log(execSync(`unzip -l ${JSON.stringify(outFile)}`).toString());
