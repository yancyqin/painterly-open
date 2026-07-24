import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../live-1a.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../src/live1a.ts", import.meta.url), "utf8");

test("1A feasibility page has one DOM canvas and one bounded off-DOM room cache", () => {
  assert.equal((html.match(/<canvas\b/g) ?? []).length, 1);
  assert.equal((source.match(/createElement\s*\(\s*["']canvas["']/g) ?? []).length, 1);
  assert.doesNotMatch(source, /new\s+OffscreenCanvas\b/);
  assert.match(source, /frame\.width = ROOM_WIDTH;\s+frame\.height = ROOM_HEIGHT/);
  const ensureRoomFrame = source.match(/private ensureRoomFrame\(\): HTMLCanvasElement \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.doesNotMatch(ensureRoomFrame, /\.before\(|\.after\(|append|prepend|replace/);
});

test("1A feasibility page consumes the real curated project", () => {
  assert.match(source, /van-gogh-sunflower-parlor-1a\.json/);
  assert.match(source, /project\.stats\.marks/);
  assert.match(source, /project\.warps\.map/);
});

test("1A additive controls use real furniture and a movable actor without another canvas", () => {
  assert.equal((html.match(/data-diagnostic-tab=/g) ?? []).length, 4);
  assert.equal((html.match(/data-diagnostic-panel=/g) ?? []).length, 4);
  assert.match(html, /data-additive-mode="live"/);
  assert.match(html, /data-additive-mode="furniture"/);
  assert.match(html, /data-additive-mode="chameleon"/);
  assert.match(html, /data-additive-mode="production"/);
  assert.match(html, /data-additive-mode="game-frozen"/);
  assert.match(html, /data-additive-mode="game-15"/);
  assert.match(html, /data-additive-mode="game-base-30"/);
  assert.match(html, /data-additive-mode="game-rings-30"/);
  assert.match(html, /data-additive-mode="game-flat-dots-30"/);
  assert.match(html, /data-additive-mode="game-soft-75-30"/);
  assert.match(html, /data-additive-mode="game-soft-204-30"/);
  assert.match(html, /data-additive-mode="game-soft-618-30"/);
  assert.match(html, /data-additive-mode="game-atlas-618-30"/);
  assert.match(html, /data-additive-mode="game-atlas-full-30"/);
  assert.match(html, /data-additive-mode="game-marks-30"/);
  assert.match(html, /data-additive-mode="game-coarse-warps-30"/);
  assert.match(html, /data-additive-mode="game-30"/);
  assert.match(source, /activeProps\(DEMO_ART_HOUSE, DEMO_SURFACE\)/);
  assert.match(source, /PROP_SPECS\[instance\.modelId\]/);
  assert.match(source, /loadImage\(AVATAR_URLS\.stand\)/);
  assert.match(source, /pointermove/);
  assert.match(source, /panel\.hidden = panel\.dataset\.diagnosticPanel !== selected/);
});

test("1A production comparison uses the rewritten direct production renderer", () => {
  assert.match(source, /new CuratedLiveRoomRenderer\(\)/);
  assert.match(source, /this\.mode === "production"/);
  assert.match(source, /renderGraphCanvasCount: gameMode \? 2 : 1/);
  assert.match(source, /this\.productionRenderer\.dispose\(\)/);
});

test("1A game benchmark adds the production movement chain and room stages one at a time", () => {
  assert.match(source, /const MOVEMENT_FRAME_MS = 1000 \/ 62/);
  assert.match(source, /moveSpeedFor\(/);
  assert.match(source, /private stepGameMovement\(deltaMs: number\)/);
  assert.match(source, /actorCanStandAt\(DEMO_ART_HOUSE, DEMO_SURFACE, 0/);
  assert.match(source, /function gameRoomHz\(mode: AdditiveMode\): 0 \| 15 \| 30/);
  assert.match(source, /game-base-30"\) return \{ warpFieldLimit: 0, marks: false \}/);
  assert.match(source, /markKinds: \["ripple"\],\s+markLimit: 8/);
  assert.match(source, /markKinds: \["lissajous-heartbeat"\]/);
  assert.match(source, /markLimit: 618,\s+flatDots: true/);
  assert.match(source, /markLimit: 75/);
  assert.match(source, /markLimit: 204/);
  assert.match(source, /markLimit: 618,\s+atlasSoftMarks: true/);
  assert.match(source, /game-atlas-full-30"\) return \{ atlasSoftMarks: true \}/);
  assert.match(source, /warpFieldLimit: 0, marks: true, atlasSoftMarks: false/);
  assert.match(source, /warpFieldLimit: 4, marks: true, atlasSoftMarks: false/);
  assert.match(source, /gameRoomStages\(this\.mode\)/);
  assert.match(source, /private rebuildGameRoom\(sceneSeconds: number, now: number\)/);
  assert.match(source, /context\.drawImage\(frame, 0, 0, ROOM_WIDTH, ROOM_HEIGHT\);\s+this\.drawFurnitureAndActor\(\);\s+this\.drawGameJoystick\(\)/);
});
