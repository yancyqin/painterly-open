import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const english = readFileSync(new URL("../src/i18n/en.ts", import.meta.url), "utf8");
const worker = readFileSync(new URL("../src/worker.js", import.meta.url), "utf8");
const favicon = readFileSync(new URL("../public/favicon.svg", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("landscape lobby metadata no longer competes with the room-name column", () => {
  assert.match(main, /meta\.className = "challenge-meta"/);
  const mediaStart = styles.indexOf("@media (max-height: 560px)");
  const mediaEnd = styles.indexOf("@media (prefers-reduced-motion: reduce)", mediaStart);
  const shortViewport = mediaStart >= 0 && mediaEnd > mediaStart
    ? styles.slice(mediaStart, mediaEnd)
    : "";
  assert.match(shortViewport, /\.challenge-link\s*\{[\s\S]*?grid-template-columns: 58px minmax\(0, 1fr\)/);
  assert.match(shortViewport, /"thumb copy"\s+"thumb meta"/);
  assert.match(shortViewport, /\.challenge-copy strong\s*\{[\s\S]*?word-break: normal/);
  assert.match(shortViewport, /\.challenge-link > \.challenge-meta\s*\{[\s\S]*?text-overflow: ellipsis/);
});

test("landscape phone Hider Studio owns the full usable viewport", () => {
  const mediaStart = styles.indexOf("@media (orientation: landscape) and (max-height: 560px) and (any-pointer: coarse)");
  const mediaEnd = styles.indexOf("@media (max-height: 560px)", mediaStart);
  const landscapeStudio = mediaStart >= 0 && mediaEnd > mediaStart
    ? styles.slice(mediaStart, mediaEnd)
    : "";
  assert.match(landscapeStudio, /\.paint-studio\s*\{[\s\S]*?inset: 0;[\s\S]*?width: 100vw;[\s\S]*?height: 100dvh/);
  assert.match(landscapeStudio, /\.paint-card\s*\{[\s\S]*?height: 100%;[\s\S]*?overflow: hidden/);
  assert.match(landscapeStudio, /\.paint-tools\s*\{[\s\S]*?overflow-y: auto/);
});

test("canvas navigation labels and locale control stay compact", () => {
  assert.match(english, /"explore\.cta": "Lobby"/);
  assert.match(english, /"studio\.liveToggle": "Live"/);
  assert.match(styles, /\.locale-select\s*\{[\s\S]*?width: 86px;[\s\S]*?max-width: 86px/);
  assert.match(styles, /\.canvas-locale\s*\{[\s\S]*?max-width: min\(86px, 42vw\)/);
});

test("Seeker counts render as two localized lines without average-time clutter", () => {
  assert.match(main, /return `\$\{attemptCount\} \$\{t\("manage\.seekers"\)\}\\n\$\{foundCount\} \$\{t\("manage\.found"\)\}`/);
  assert.doesNotMatch(main, /function seekerStatsText\([^)]*averageFindMs/);
});

test("released Live houses start with Live enabled", () => {
  assert.match(main, /liveEnabled: Boolean\(artRoomFor\("van-gogh-house"\)\.livePainting\)/);
  assert.match(main, /const liveAvailable = Boolean\(artRoomFor\(artHouse\)\.livePainting\)/);
  assert.match(main, /draft\.liveEnabled = liveAvailable/);
  assert.match(main, /setDraftLiveEnabled\(draft\.liveEnabled\)/);
});

test("Seeker rounds have no 180-second countdown", () => {
  assert.doesNotMatch(main, /SEEK_LIMIT_MS|tickTimer|formatCountdown/);
  assert.doesNotMatch(main, /setInterval\([^)]*tickTimer/);
});

test("account rooms expose a compact copy-link action", () => {
  assert.match(worker, /getAccountChallenges\(request, env, url\)/);
  assert.match(worker, /playUrl: row\.public_token \? buildPlayUrl\(env, url, String\(row\.public_token\)\) : null/);
  assert.match(main, /copy\.className = "icon-button account-room-copy"/);
  assert.match(main, /copyAccountRoomLink\(copy, room\.playUrl!\)/);
  assert.match(main, /copyGlyph\.textContent = "⧉"/);
  assert.match(styles, /\.account-room-copy\s*\{[\s\S]*?width: 38px;[\s\S]*?min-height: 38px/);
});

test("share modal explains how to find the published room by name", () => {
  assert.match(index, /data-i18n="manage\.roomNameLabel">Room name:<\/span>/);
  assert.match(index, /data-i18n="manage\.searchRoomHint">Search this room name in the Lobby to find it\.<\/small>/);
});

test("Lobby cards use authored room art without selecting preview images from D1", () => {
  assert.match(main, /thumbnail\.src = lobbyRoomThumbnail\(challenge\.artHouse, challenge\.token\)/);
  assert.match(main, /function samplerSupportedChallenges[\s\S]*?ART_HOUSE_IDS\.includes\(challenge\.artHouse\)/);
  assert.match(main, /tricky: samplerSupportedChallenges\(data\.feeds\.tricky\)/);
  const exploreQuery = worker.match(/async function getExplore[\s\S]*?async function searchExplore/)?.[0] ?? "";
  const searchQuery = worker.match(/async function searchExplore[\s\S]*?async function getAuthState/)?.[0] ?? "";
  assert.doesNotMatch(exploreQuery, /preview_image|previewImage/);
  assert.doesNotMatch(searchQuery, /preview_image|previewImage/);
});

test("the itch sampler keeps its three free houses visible and omits cookie-only account UI", () => {
  assert.match(main, /const EMBEDDED_SAMPLER = usesCrossOriginApi\(\)/);
  assert.match(main, /button\.hidden = EMBEDDED_SAMPLER/);
  assert.match(main, /switcher\.hidden = !account && anonymousHouseCount <= 1/);
  assert.match(main, /if \(EMBEDDED_SAMPLER\) syncAccountUi\(\);\s+else await loadAccount\(\)/);
});

test("the site favicon uses the same colorful paint-palette language as the game", () => {
  assert.match(favicon, /Painterly Chameleon paint palette/);
  for (const color of ["#36c8c4", "#efc862", "#ef806f", "#a98bea", "#5d8fcb"]) {
    assert.match(favicon, new RegExp(color));
  }
});

test("shared game links expose a large non-spoiler social card", () => {
  assert.match(index, /property="og:image" content="https:\/\/pc\.lucasacademy\.org\/og-painterly-chameleon\.jpg"/);
  assert.match(index, /property="og:image:width" content="1200"/);
  assert.match(index, /property="og:image:height" content="630"/);
  assert.match(index, /name="twitter:card" content="summary_large_image"/);
});

test("the Lobby links to the public build-with-us story", () => {
  assert.match(index, /class="lobby-footer-links"/);
  assert.match(index, /href="https:\/\/lucasacademy\.org\/painterly-chameleon#build-with-us" data-i18n="support\.knowMore">know more\?<\/a>/);
  assert.match(styles, /\.lobby-stage > \.lobby-footer-links\s*\{[\s\S]*?display: flex;[\s\S]*?gap: 6px 16px/);
});
