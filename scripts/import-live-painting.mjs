#!/usr/bin/env node

// Build-time importer for owner-reviewed Art Lab `.lpp` projects.
//
// The archive remains the editable/audit source. The browser receives only
// declarative marks, masks and adapters selected by FULL approved SHA-256
// revision. Function Brush source never enters the shipped runtime.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = Object.freeze({
  "van-gogh-sunflower-parlor-1a": {
    artHouse: "van-gogh-house",
    roomIndex: 0,
    baseSurface: 2,
    sceneId: "custom",
    shell: "src/game/assets/rooms/van-gogh-sunflower-parlor-shell-v6c.jpg",
    output: "src/game/assets/live-projects/van-gogh-sunflower-parlor-1a.json",
  },
  "van-gogh-starry-studio-1b": {
    artHouse: "van-gogh-house",
    roomIndex: 1,
    baseSurface: 0,
    sceneId: "starry-studio",
    shell: "src/game/assets/rooms/van-gogh-starry-studio-shell-v6a.jpg",
    output: "src/game/assets/live-projects/van-gogh-starry-studio-1b.json",
  },
  "van-gogh-cypress-bedroom-1c": {
    artHouse: "van-gogh-house",
    roomIndex: 2,
    baseSurface: 0,
    sceneId: "custom",
    shell: "src/game/assets/rooms/van-gogh-cypress-bedroom-shell-v6a.jpg",
    output: "src/game/assets/live-projects/van-gogh-cypress-bedroom-1c.json",
  },
});

// Reviewed source hashes resolve to inert runtime data. Adding a new brush
// revision is an explicit code review, never a permissive parser fallback.
const APPROVED_ADAPTERS = Object.freeze({
  "sha256:83acc469944f859350d0667525cc2e4fdaa7b47641a4ee2a2976b20ba9394268": {
    kind: "lissajous-heartbeat",
    speed: 50,
  },
  "sha256:3b1617872e8cd2853a78125558bb3e05cd9f6efe7a043a4752970ab6ef56cb62": {
    kind: "ripple", speed: 50, size: 32, ringSpeed: 55, range: .9, colorFlicker: .01, photoOpacity: 100, photoBlur: 0,
  },
  "sha256:378281b675d2b312752cee07b96032b4ea5b43f4adfe3b842bc2db2ceaf805cb": {
    kind: "ripple", speed: 50, size: 26, ringSpeed: 55, range: .6, colorFlicker: .01, photoOpacity: 100, photoBlur: 0,
  },
  "sha256:e598da4c5ce655dcaae19fdadda571bf4e1fab242ad64e3785ba07130431f6a1": {
    kind: "ripple", speed: 50, size: 26, ringSpeed: 55, range: .4, colorFlicker: .01, photoOpacity: 100, photoBlur: 0,
  },
  "sha256:b12a4798930469a7d9c414071a708ead6c50cc9fd16f8fc70468f17d8d61c53a": {
    kind: "ripple", speed: 50, size: 26, ringSpeed: 55, range: .3, colorFlicker: .01, photoOpacity: 100, photoBlur: 0,
  },
  "sha256:8cbd8b32faf8b5066e90cf4411e35eab89dba0fea8b38d60ac0b13a41a5ee65c": {
    kind: "ripple", speed: 50, size: 14, ringSpeed: 55, range: .3, colorFlicker: .01, photoOpacity: 100, photoBlur: 0,
  },
  "sha256:232e830dca5982cfb29f8dabd2582ec32312a8cddf963112ac1355b17cb02fef": {
    kind: "ripple", speed: 50, size: 19, ringSpeed: 55, range: .1, colorFlicker: .01, photoOpacity: 100, photoBlur: 0,
  },
  "sha256:b9e11af7ad47219d44814063a45df0a4bb1dbafd9a8269254d3eb394974de068": {
    kind: "liquid-warp", speed: 50, strength: 8, wavelength: 33,
  },
  "sha256:7ad20b8ecf60daf04dfcdd55f5a76dc57d0efc1b495b85acf18358374391c98f": {
    kind: "liquid-warp", speed: 50, strength: 8, wavelength: 33,
  },
  "sha256:2839a77fd7b4bce6d86879921d282089f1afd031f6c52ef6b6b5e3eef8b66e78": {
    kind: "liquid-warp", speed: 50, strength: 8, wavelength: 33,
  },
  "sha256:551a96cdebe190234f42eecf907d62fd1ccdf5835d78ac6b4775362890d1c947": {
    kind: "liquid-warp", speed: 50, strength: 8, wavelength: 33,
  },
  "sha256:0141e874907be9fdeba1f99b2059b6b74590ead2fa512d1cad5c1a757a66f21b": {
    kind: "liquid-warp", speed: 50, strength: 8, wavelength: 2,
  },
  "sha256:52b0d172a7bf79a6dd3e30c3c42dcccca90beaa8ebdb2e9193fd3ae010480113": {
    kind: "growth", speed: 1.3, sway: 3, photoOpacity: 100, photoBlur: 8,
  },
  "sha256:f12bd7c28584979f4ef8dcdd35b20d50ba95512b255bb04365fd4829b2b9a7bc": {
    kind: "firefly", speed: 2.6, wander: 30,
  },
  "sha256:97694d2b152204f8669c68d474f4e9fd6014828a3ab6690f93f0fbe0d07b2d8f": {
    kind: "twinkle", speed: 50, twinkleRate: 1.6,
  },
  "sha256:d7321270fb61ee00f4b5af81ade04103844f9f478d7f0027fc6c265632ef84a0": {
    kind: "twinkle", speed: 50, twinkleRate: 1.6,
  },
  "sha256:19741dfe09537cc553aaef4503ae1baeb520eb9cd9876ed8d830262d65255372": {
    kind: "twinkle", speed: 50, twinkleRate: 1.6,
  },
  "sha256:bb2bda5ad1d139dc6458c18d09b0e232c0935163437e3aa003688c3a73d319ab": {
    kind: "twinkle", speed: 50, twinkleRate: 1.6,
  },
  "sha256:c493fc292a7d604134b6b797b42a9ec4725b2981403f300d0ef2858d06887d11": {
    kind: "color-liquify-splash", speed: 20, distance: 10, diffusion: 54,
  },
  "sha256:139a4bdbc4683929969f3297f48780086302bd88f92eb742649661bb32735cb1": {
    kind: "color-liquify-splash", speed: 20, distance: 10, diffusion: 54,
  },
  "sha256:1bfd61913c13a394e21e953f902a707e958095b7bbe12f28072fdf6f0cc0de56": {
    kind: "color-liquify-splash", speed: 20, distance: 50, diffusion: 54,
  },
  "sha256:f003468907a7500c7b6bd046412adc7881621f376bff80e0366ddfe5693126ee": {
    kind: "color-liquify-splash", speed: 20, distance: 10, diffusion: 54,
  },
  "sha256:7bd8a91256fb016a446964b18463deb2c66afa7dfb8e14fcd7715abf6197349e": {
    kind: "color-liquify-splash", speed: 20, distance: 10, diffusion: 54,
  },
  "sha256:45aedd57481996101e0a445df280ae7978d979c62b903de6456c07081b179aad": {
    kind: "color-liquify-splash", speed: 20, distance: 10, diffusion: 54,
  },
  "sha256:ab9bf9ef421135a86d41878af454b5e038309894dbaecf8ba36f1adfe523438e": {
    kind: "color-liquify-splash", speed: 20, distance: 10, diffusion: 54,
  },
  "sha256:003b89ded2ab832fa0cebbf6eb8bc2b488771c513f0415989cb37ab4b995aac1": {
    kind: "color-liquify-splash", speed: 20, distance: 10, diffusion: 54,
  },
  "sha256:10c599bd00d8766f12747aa882f0152d6013e9f4adf60ac156f74987551127b6": {
    kind: "color-liquify-splash", speed: 20, distance: 10, diffusion: 54,
  },
  "sha256:64593d0c905145d5cc6ba61932e39b4e8d4083fd50051656f4397a7d3ea2fa96": {
    kind: "color-liquify-splash", speed: 20, distance: 30, diffusion: 54,
  },
  "sha256:abb49dfc98b2aabebaa12689399dc883c270c5495f0950409fb38ee6841860d9": {
    kind: "color-liquify-splash", speed: 20, distance: 30, diffusion: 54,
  },
  "sha256:47910ea2c5ab831856cfc3ab7c33d22041a0b2f48f0f9c72aaeca960be634d78": {
    kind: "color-liquify-splash", speed: 20, distance: 30, diffusion: 54,
  },
  "sha256:f94a448019e3e7d8cf591de09e878d65fa821d4428c5075c29d4c7f6f0e900cb": {
    kind: "color-liquify-splash", speed: 20, distance: 30, diffusion: 54,
  },
  "sha256:bf07dcb19be87518615e975269ee6e72b56ce306ebe3b6abd6f7964e7f7626cc": {
    kind: "color-liquify-splash", speed: 20, distance: 10, diffusion: 54,
  },
  "sha256:36cb21d7a2dca0befd24c387d7930991daefa7dc71a72f9bf59841ceaec17d7a": {
    kind: "color-liquify-breakout", speed: 10, size: 11, travel: 10, lives: 2.8,
  },
  "sha256:d1e72b3f6e17396bb4d6f0eedd4a119e688677e289f09ba7683f565c30a79e88": {
    kind: "color-liquify-breakout", speed: 10, size: 7, travel: 10, lives: 2.8,
  },
  "sha256:5e1fd1aa82089f982b795036ee0434f4211efb022f5310bd5f6b7d1bdf795521": {
    kind: "galaxy", speed: 50, turn: .7, arm: 20,
  },
  "sha256:619c0c5d28de26ac65b14f8d7aca0b8f737c0b22039907966d307b800e649dde": {
    kind: "galaxy", speed: 50, turn: .7, arm: 20,
  },
  "sha256:bc5b4fe22bf7acb0095f8d176a151f216e426346683264a0ae5df9cd7cedf582": {
    kind: "galaxy", speed: 50, turn: .7, arm: 20,
  },
  "sha256:28f75de3e60c07c94c3439c0a3396bff824e0d65c76cfd6c6583fcc8ac60b979": {
    kind: "firefly", speed: 2.6, wander: 30,
  },
  "sha256:38ec93be61c3d2247f2336cc4caedc963d403fb25ded175aca03d4f36b2b12b3": {
    kind: "firefly", speed: 2.6, wander: 30,
  },
  "sha256:5de14f6d1253adb28bc9d31cf46df1e2c535a28dbddd1cd7b6a0255eae474c44": {
    kind: "firefly", speed: 2.6, wander: 30,
  },
  "sha256:d6b732239c24820ecd0814530f8c35bd47799f73823e24d1171549fd20365113": {
    kind: "firefly", speed: 2.6, wander: 30,
  },
  "sha256:1b9ffd923a48a50352c83844731005dfdeff7dc97def7180d102770cf51cbad2": {
    kind: "twinkle", speed: 50, twinkleRate: 1.6,
  },
  "sha256:73f8c245f5c8d5e18c6d718da32863397b4a3df6ea3e3c7141e5de8747c148aa": {
    kind: "liquid-warp",
    speed: 38,
    strength: 8,
    wavelength: 33,
    edgeFeather: 2.2,
    edgeBlur: 7,
    edgeOpacity: 72,
  },
  "sha256:7137c5c7565a8cdbac119f1e8a238400a21d14f7e6f81ad1ade5f0035e076e78": {
    kind: "liquid-warp",
    speed: 38,
    strength: 8,
    wavelength: 33,
    edgeFeather: 2.2,
    edgeBlur: 7,
    edgeOpacity: 72,
  },
});

function fail(message) {
  throw new Error(`Live Painting import rejected: ${message}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sourceRevision(source) {
  return `sha256:${sha256(Buffer.from(String(source).replace(/\r\n/g, "\n"), "utf8"))}`;
}

function finite(value, label, min = -Infinity, max = Infinity) {
  if (!Number.isFinite(value) || value < min || value > max) fail(`${label} is out of bounds`);
  return value;
}

function archiveEntries(lppPath) {
  return execFileSync("unzip", ["-Z1", lppPath], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 })
    .split(/\r?\n/)
    .filter(Boolean);
}

function archiveBytes(lppPath, entry) {
  return execFileSync("unzip", ["-p", lppPath, entry], { encoding: null, maxBuffer: 12 * 1024 * 1024 });
}

function archiveJson(lppPath, entry) {
  try {
    return JSON.parse(archiveBytes(lppPath, entry).toString("utf8"));
  } catch (error) {
    fail(`${entry} is not valid JSON (${error instanceof Error ? error.message : String(error)})`);
  }
}

function stripMark(mark, label) {
  const x = finite(mark.x, `${label}.x`, -200, 1_160);
  const y = finite(mark.y, `${label}.y`, -200, 840);
  if (mark.ox !== x || mark.oy !== y) fail(`${label} birth coordinates changed`);
  if (mark.vx !== 0 || mark.vy !== 0) fail(`${label} velocity is not approved by runtime v1`);
  const shape = String(mark.shape);
  if (!["dot", "square", "ring", "star", "streak"].includes(shape)) fail(`${label}.shape is unsupported`);
  return {
    x,
    y,
    size: finite(mark.size, `${label}.size`, 1, 120),
    alpha: finite(mark.alpha, `${label}.alpha`, 0, 1),
    red: finite(mark.red, `${label}.red`, 0, 255),
    green: finite(mark.green, `${label}.green`, 0, 255),
    blue: finite(mark.blue, `${label}.blue`, 0, 255),
    shape,
    softIdx: finite(mark.softIdx, `${label}.softIdx`, 0, 3),
    angle: finite(mark.angle, `${label}.angle`, -Math.PI * 2, Math.PI * 2),
    glow: mark.glow === true,
    life: finite(mark.life, `${label}.life`, 0, 30),
    born: finite(mark.born, `${label}.born`, 0, 1_000_000),
    seed: finite(mark.seed, `${label}.seed`, 0, 1),
    index: finite(mark.index, `${label}.index`, 0, 100_000),
  };
}

function buildProject(lppPath, targetKey) {
  const target = TARGETS[targetKey];
  if (!target) fail(`unknown target "${targetKey}"`);
  const entries = archiveEntries(lppPath);
  for (const required of ["manifest.json", "artlab/document.json"]) {
    if (!entries.includes(required)) fail(`missing ${required}`);
  }

  const manifest = archiveJson(lppPath, "manifest.json");
  const document = archiveJson(lppPath, "artlab/document.json");
  if (manifest.format !== "lucas-live-painting-project" || manifest.version !== 1) fail("unsupported manifest format/version");
  if (manifest.stage?.width !== 960 || manifest.stage?.height !== 640) fail("game projects must be exactly 960x640");
  if (document.format !== "artlab-live-doc" || document.version !== 3) fail("expected artlab-live-doc v3");

  const scene = manifest.scenes?.find(entry => entry?.id === target.sceneId);
  if (!scene?.shell) fail(`manifest scene ${target.sceneId} has no shell`);
  const embeddedShell = archiveBytes(lppPath, scene.shell);
  const gameShell = readFileSync(join(root, target.shell));
  const embeddedShellHash = sha256(embeddedShell);
  const gameShellHash = sha256(gameShell);
  if (embeddedShellHash !== gameShellHash) fail(`embedded shell does not match ${target.shell}`);

  const brushFiles = new Map();
  for (const entry of entries.filter(name => /^brushes\/[^/]+\.fnbrush\.json$/.test(name))) {
    const brush = archiveJson(lppPath, entry);
    if (sourceRevision(brush.source) !== brush.revision) fail(`${entry} source hash does not match revision`);
    brushFiles.set(brush.revision, brush);
  }

  const sourceLayers = document.scenes?.[target.sceneId];
  if (!Array.isArray(sourceLayers) || sourceLayers.length < 1 || sourceLayers.length > 8) fail("scene must contain 1-8 layers");
  const sourceWarps = document.warps?.[target.sceneId] ?? [];
  if (!Array.isArray(sourceWarps) || sourceWarps.length > 8) fail("warp revision count exceeds curated limit");

  const usedRevisions = new Set();
  const layers = [];
  let markCount = 0;
  let timeAnchor = 0;
  for (const [layerIndex, layer] of sourceLayers.entries()) {
    if (layer.type !== "marks") fail(`layer ${layerIndex} is not a marks layer`);
    const strokes = [];
    for (const [strokeIndex, stroke] of (layer.strokes ?? []).entries()) {
      if (stroke.settings?.fade !== 0 || stroke.settings?.links !== 0 || stroke.settings?.territory !== 0) {
        fail(`layer ${layerIndex} stroke ${strokeIndex} uses unsupported history settings`);
      }
      usedRevisions.add(stroke.brushRevision);
      const marks = (stroke.marks ?? []).map((mark, markIndex) => {
        const stripped = stripMark(mark, `layer ${layerIndex} stroke ${strokeIndex} mark ${markIndex}`);
        timeAnchor = Math.max(timeAnchor, stripped.born);
        return stripped;
      });
      markCount += marks.length;
      if (markCount > 2_000) fail("project has more than 2,000 marks");
      strokes.push({ brushRevision: stroke.brushRevision, marks });
    }
    layers.push({
      id: String(layer.id || `layer-${layerIndex + 1}`),
      name: String(layer.name || `Layer ${layerIndex + 1}`),
      visible: layer.visible !== false,
      opacity: finite(layer.opacity ?? 1, `layer ${layerIndex}.opacity`, 0, 1),
      blendMode: ["source-over", "screen", "lighter", "multiply"].includes(layer.blendMode)
        ? layer.blendMode
        : "source-over",
      timeScale: finite(layer.timeScale ?? 1, `layer ${layerIndex}.timeScale`, .1, 10),
      timeOffsetMs: finite(layer.timeOffsetMs ?? 0, `layer ${layerIndex}.timeOffsetMs`, -120_000, 120_000),
      strokes,
    });
  }

  const warps = sourceWarps.map((warp, index) => {
    usedRevisions.add(warp.brushRevision);
    if (typeof warp.data !== "string" || !warp.data) fail(`warp ${index} has no mask data`);
    return { brushRevision: warp.brushRevision, maskRle: warp.data };
  });

  const adapters = {};
  for (const revision of [...usedRevisions].sort()) {
    const approved = APPROVED_ADAPTERS[revision];
    if (!approved) fail(`brush revision ${revision} has no approved static adapter`);
    const brushFile = brushFiles.get(revision);
    const documentBrush = document.brushes?.[revision];
    if (!brushFile || !documentBrush) fail(`missing reviewed brush data for ${revision}`);
    if (brushFile.source !== documentBrush.source) fail(`brush source disagreement for ${revision}`);
    adapters[revision] = approved;
  }

  const project = {
    format: "painterly-curated-live-project",
    version: 1,
    id: targetKey,
    artHouse: target.artHouse,
    roomIndex: target.roomIndex,
    baseSurface: target.baseSurface,
    canvas: { width: 960, height: 640 },
    source: {
      gameAsset: target.shell,
      sha256: `sha256:${gameShellHash}`,
      lppSha256: `sha256:${sha256(readFileSync(lppPath))}`,
    },
    clock: { timeAnchor, timeOrigin: "scene-enter", unit: "seconds" },
    adapters,
    layers,
    warps,
    stats: { marks: markCount, strokes: layers.reduce((sum, layer) => sum + layer.strokes.length, 0), warpFields: warps.length },
  };
  const json = `${JSON.stringify(project, null, 2)}\n`;
  if (Buffer.byteLength(json) > 2 * 1024 * 1024) fail("runtime JSON exceeds 2 MB");
  return { json, target };
}

function main() {
  const [lppArg, targetKey, flag] = process.argv.slice(2);
  if (!lppArg || !targetKey || (flag && flag !== "--check")) {
    console.error("Usage: node scripts/import-live-painting.mjs <project.lpp> <target-key> [--check]");
    process.exitCode = 2;
    return;
  }
  const lppPath = resolve(process.cwd(), lppArg);
  const { json, target } = buildProject(lppPath, targetKey);
  const outputPath = join(root, target.output);
  if (flag === "--check") {
    const current = readFileSync(outputPath, "utf8");
    if (current !== json) fail(`${target.output} is stale; rerun importer without --check`);
    console.log(`Live Painting project verified: ${targetKey}`);
    return;
  }
  writeFileSync(outputPath, json);
  console.log(`Imported ${targetKey} -> ${target.output}`);
}

main();
