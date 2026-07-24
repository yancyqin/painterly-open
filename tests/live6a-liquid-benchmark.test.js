import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../live-6a.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../src/live6a.ts", import.meta.url), "utf8");
const renderer = readFileSync(new URL("../src/game/livePainting.ts", import.meta.url), "utf8");

test("6A separates normal painting from the Liquid benchmark with tabs", () => {
  assert.equal((html.match(/data-avatar-test-tab=/g) ?? []).length, 2);
  assert.equal((html.match(/data-avatar-test-panel=/g) ?? []).length, 2);
  assert.equal((html.match(/data-liquid-pass=/g) ?? []).length, 8);
  assert.match(html, /id="liquid-bench-count"[^>]*min="20"[^>]*max="320"[^>]*step="20"/);
  assert.match(html, /data-liquid-pass="relay-tint"/);
  assert.match(source, /panel\.hidden = panel\.dataset\.avatarTestPanel !== avatarTestTab/);
});

test("Liquid benchmark isolates the 6A avatar and uses deterministic layer-6 marks", () => {
  assert.match(source, /if \(live && !roomBenchFrozen\) \{\s+liveRoomRenderer\.draw/);
  assert.match(source, /brush: "liquid-color",[\s\S]*?size: 26,[\s\S]*?flow: 68/);
  assert.match(source, /paintMarksSnapshot = \[\.\.\.avatarMarks\]/);
  assert.match(source, /avatarMarks = paintMarksSnapshot/);
  assert.match(source, /liquidDiagnosticPass === "erosion" \|\| liquidDiagnosticPass === "batch-erosion"[\s\S]*?globalAlpha = \.24/);
  assert.match(source, /boundedSample\(avatarRenderSamples, performance\.now\(\) - avatarStartedAt\)/);
});

test("production Liquid keeps the full effect while 6A can split its passes", () => {
  assert.match(renderer, /\| "legacy-full"[\s\S]*?\| "batch-erosion"[\s\S]*?\| "batch-tint"/);
  assert.match(renderer, /private liquidDiagnosticPass: LiveLiquidDiagnosticPass = "full"/);
  assert.match(renderer, /setLiquidDiagnosticPass\(pass: LiveLiquidDiagnosticPass\): void/);
  assert.match(renderer, /const batchLiquid = this\.liquidDiagnosticPass === "full"/);
  assert.match(renderer, /const full = this\.liquidDiagnosticPass === "full"/);
  assert.match(renderer, /const drawErosion = this\.liquidDiagnosticPass === "legacy-full"/);
  assert.match(renderer, /this\.liquidDiagnosticPass === "relay-tint"/);
  assert.match(renderer, /scratch\.fillRect\(boxX, boxY, boxW, boxH\)/);
  assert.match(renderer, /scratch\.drawImage\(this\.sample, 0, 0\)/);
  assert.match(renderer, /Pre-cut[\s\S]*?annuli avoid the old per-mark destination-out ring construction/);
  assert.match(renderer, /Batch Full consumes it once for[\s\S]*?erosion, then once for a shared moving copy/);
  assert.match(renderer, /scratch\.drawImage\(this\.sample, 0, 0\)/);
  assert.match(renderer, /context\.drawImage\(this\.scratch, 0, 0\)/);
  assert.match(renderer, /never one mask canvas per mark or ring state/);
  assert.equal((source.match(/liveAvatarRenderer\.setLiquidDiagnosticPass\(/g) ?? []).length, 3);
});
