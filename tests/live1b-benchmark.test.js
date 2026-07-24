import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../live-1b.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../src/live1b.ts", import.meta.url), "utf8");

test("1B additive benchmark has one visible canvas and tabbed stages", () => {
  assert.equal((html.match(/<canvas\b/g) ?? []).length, 1);
  assert.equal((html.match(/data-bench-mode=/g) ?? []).length, 6);
  assert.match(html, /id="bench-mark-limit"[^>]*max="4910"/);
  assert.match(source, /new CuratedLiveRoomRenderer\(\)/);
  assert.match(source, /markKinds: \["color-liquify-splash"\]/);
  assert.match(source, /markKinds: \["twinkle"\]/);
  assert.match(source, /markKinds: \["color-liquify-breakout"\]/);
  assert.match(source, /markKinds: \["curve-current"\]/);
  assert.match(source, /atlasSoftMarks: true/);
});

test("1B benchmark uses the owner-final project and supports actor dragging", () => {
  assert.match(source, /van-gogh-starry-studio-1b\.json/);
  assert.match(source, /project\.stats\.marks !== 4910/);
  assert.match(source, /canvas\.addEventListener\("pointermove"/);
  assert.match(source, /renderer\.draw\(context, room, project/);
});
