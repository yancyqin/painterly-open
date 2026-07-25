import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gameCanvas = readFileSync(new URL("../src/game/GameCanvas.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const paintStudio = readFileSync(new URL("../src/game/PaintStudio.ts", import.meta.url), "utf8");
const avatarRenderer = readFileSync(new URL("../src/game/livePainting.ts", import.meta.url), "utf8");
const curatedRenderer = readFileSync(new URL("../src/game/curatedLivePainting.ts", import.meta.url), "utf8");
const unfinishedRenderer = readFileSync(new URL("../src/game/liveRoomPainting.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("GameCanvas owns only the sampler's nullable, on-demand Live renderers", () => {
  assert.match(gameCanvas, /private liveAvatarRenderer: LiveAvatarRenderer \| null = null/);
  assert.match(gameCanvas, /private curatedLiveRoomRenderer: CuratedLiveRoomRenderer \| null = null/);
  assert.equal((gameCanvas.match(/new LiveAvatarRenderer\(/g) ?? []).length, 1);
  assert.equal((gameCanvas.match(/new CuratedLiveRoomRenderer\(/g) ?? []).length, 1);
  assert.doesNotMatch(gameCanvas, /UnfinishedMorningLiveRoomRenderer|liveRoomRenderer/);
  assert.match(gameCanvas, /syncLiveRendererLifecycle\(\): void/);
  assert.match(gameCanvas, /setActive\(active: boolean\): void/);
  assert.match(gameCanvas, /\.dispose\(\);\s+this\.curatedLiveRoomRenderer = null/);
});

test("PaintStudio creates its Live renderer only while Live is active", () => {
  assert.match(paintStudio, /private liveRenderer: LiveAvatarRenderer \| null = null/);
  assert.equal((paintStudio.match(/new LiveAvatarRenderer\(/g) ?? []).length, 1);
  assert.match(paintStudio, /releaseLiveRenderer\(\): void/);
  assert.match(paintStudio, /close\(\)[\s\S]*?this\.releaseLiveRenderer\(\)/);
});

test("Hider Full color owns one mutable custom swatch", () => {
  assert.match(paintStudio, /sanitizeCustomPaintColors\(options\.customColors, options\.room\.palette\)\.slice\(-1\)/);
  assert.match(paintStudio, /this\.colorInput\.addEventListener\("change", \(\) => this\.selectColor\(this\.colorInput\.value, true\)\)/);
  assert.match(paintStudio, /if \(replaceCustom && roomIndex < 0\) \{[\s\S]*?sanitizeCustomPaintColors\(\[color\], this\.options\.room\.palette\)/);
});

test("renderer disposal zeros backing stores", () => {
  for (const source of [avatarRenderer, curatedRenderer, unfinishedRenderer]) {
    assert.match(source, /dispose\(\): void/);
  }

  for (const source of [avatarRenderer, unfinishedRenderer]) {
    assert.match(source, /canvas\.width = 0/);
    assert.match(source, /canvas\.height = 0/);
  }

  assert.match(curatedRenderer, /this\.sourceCanvas\.width = 0/);
  assert.match(curatedRenderer, /this\.sourceCanvas\.height = 0/);
  assert.match(curatedRenderer, /atlas\.width = 0;\s+atlas\.height = 0;\s+this\.markAtlasCanvas = null/);
});

test("Live avatar uses one shared organic stamp atlas and draw-calm in Studio", () => {
  assert.match(avatarRenderer, /let waveStampAtlas: WaveStampAtlas \| null = null/);
  assert.doesNotMatch(avatarRenderer, /waveStampPool/);
  assert.match(avatarRenderer, /six organic clouds by seed[\s\S]*?share one GPU texture\/canvas/);
  assert.match(avatarRenderer, /waveStampAtlas\.canvas\.width = 0;\s+waveStampAtlas\.canvas\.height = 0/);
  assert.match(paintStudio, /\|\| this\.liveDrawing\s+\|\| this\.movementCalm/);
  assert.match(paintStudio, /!this\.liveDrawing\s+&& !this\.movementCalm/);
  assert.match(paintStudio, /Live draw-calm: keep pointer capture and mark generation responsive/);
});

test("Van Gogh avatar forces use one bounded sampled-pigment atlas", () => {
  assert.match(avatarRenderer, /private pigmentAtlasCanvas: HTMLCanvasElement \| null = null/);
  assert.match(avatarRenderer, /Splash's four softness states occupy neighbouring[\s\S]*?never one canvas per mark or colour/);
  assert.match(avatarRenderer, /mark\.brush === "firefly" \|\| mark\.brush === "growth" \|\| mark\.brush === "color-liquify-splash"/);
  assert.match(avatarRenderer, /const atlasVariantCount = mark\.brush === "color-liquify-splash" \? 4 : 1/);
  assert.match(avatarRenderer, /this\.releasePigmentAtlas\(\)/);
  assert.doesNotMatch(avatarRenderer, /pigmentAtlasPool|pigmentCanvasBy/);
  assert.match(paintStudio, /liveBrushesForRoom\(options\.room\)/);
  assert.match(paintStudio, /data-live-brush="firefly"/);
  assert.match(paintStudio, /data-live-brush="growth"/);
  assert.match(paintStudio, /data-live-brush="color-liquify-splash"/);
});

test("Hider HUD gives Lobby and Live the same shape and puts Live left in portrait", () => {
  assert.match(gameCanvas, /const portraitPhone = W < H && W <= 760/);
  assert.match(gameCanvas, /this\.drawButton\(ctx, lobbyX, RIGHT_TOP, buttonWidth, bh, this\.labels\.lobby/);
  assert.match(gameCanvas, /portraitPhone \? lobbyX - gap - buttonWidth : lobbyX/);
  assert.match(gameCanvas, /portraitPhone \? RIGHT_TOP : RIGHT_TOP \+ bh \+ gap/);
  assert.match(gameCanvas, /private drawLiveStateButton[\s\S]*?roundRectPath\(ctx, x, y, w, h, 12\)/);
  assert.match(gameCanvas, /ctx\.fillText\(label, x \+ 27/);
  assert.doesNotMatch(gameCanvas, /ctx\.fillText\(label\.toUpperCase\(\), x \+ 27/);
  assert.match(gameCanvas, /Math\.sin\(performance\.now\(\) \/ 420\)/);
  assert.match(gameCanvas, /private drawPaintPaletteButton/);
  assert.match(gameCanvas, /this\.hotRegions\.push\(\{ x, y, w: size, h: size, id: "paint" \}\)/);
  assert.doesNotMatch(gameCanvas, /drawPaintPaletteIcon/);
});

test("Hider palette and done-hiding control share one joystick-sized footprint", () => {
  assert.match(gameCanvas, /private hiderActionRect/);
  assert.match(gameCanvas, /const size = Math\.round\(this\.ui\.joyBase \* 2\)/);
  assert.match(gameCanvas, /if \(!this\.hud\.paintVisited\)[\s\S]*?this\.drawPaintPaletteButton\(ctx, action\.x, action\.y, action\.size\)/);
  assert.match(gameCanvas, /const paletteSize = action\.size - gap - hideH/);
  assert.match(gameCanvas, /paletteX,[\s\S]*?action\.y \+ paletteSize \+ gap,[\s\S]*?paletteSize,/);
  assert.match(gameCanvas, /"hide",[\s\S]*?!this\.hud\.hideReady/);
  assert.match(main, /paint: openPaintStudio,[\s\S]*?hide: \(\) => void publishChallenge\(\)/);
});

test("portrait Hider keeps the paint board at right and puts Done below the room art", () => {
  assert.match(gameCanvas, /private portraitPaintButtonRect/);
  assert.match(gameCanvas, /private portraitPaintButtonRect[\s\S]*?this\.ui\.joyBase \* 2/);
  assert.match(gameCanvas, /x: this\.cam\.w - 18 - size/);
  assert.match(gameCanvas, /private portraitDoneButtonRect/);
  assert.match(gameCanvas, /const roomBottom = this\.cam\.oy \+ VIEW_HEIGHT \* this\.cam\.scale/);
  assert.match(gameCanvas, /y: Math\.min\(this\.cam\.h - 20 - h, Math\.round\(roomBottom \+ 14\)\)/);
  assert.match(gameCanvas, /if \(this\.hud\.paintVisited\)[\s\S]*?const done = this\.portraitDoneButtonRect\(\)/);
});

test("portrait phones separate Live and Lobby from the room art", () => {
  assert.match(gameCanvas, /portraitPhone \? 92 : 84/);
  assert.match(gameCanvas, /const RIGHT_TOP = portraitPhone \? 48 : 56/);
});

test("share modal uses a clear local room crop without the old blur-doodle encoder", () => {
  assert.match(gameCanvas, /shareSnapshot\(maxLength = 55_000\)/);
  assert.match(gameCanvas, /encodeRoomCrop\(attempt\.width, attempt\.quality\)/);
  assert.doesNotMatch(gameCanvas, /previewSnapshot|encodeLobbySnapshot|drawLobbyDoodles/);
});

test("Hider paint guidance starts after the room is visible on mobile", () => {
  const setActive = gameCanvas.match(/setActive\(active: boolean\): void \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.doesNotMatch(setActive, /hiderOnboardingStartedAt = performance\.now/);
  assert.match(gameCanvas, /this\.setRoomLoading\(this\.roomTransitionPending \|\| !\(this\.backgroundReady && this\.foregroundReady\)\);\s+context\.restore\(\);[\s\S]*?this\.startHiderOnboardingIfReady\(\)/);
  assert.match(gameCanvas, /private startHiderOnboardingIfReady[\s\S]*?!this\.roomLoading[\s\S]*?this\.hiderOnboardingStartedAt = time/);
});

test("play surfaces hide generated room names and only ordinary Hider rooms keep reroll", () => {
  assert.match(gameCanvas, /this\.mode === "hider" && this\.hud\.roomName && !this\.hud\.liveEnabled/);
  assert.match(gameCanvas, /this\.drawPill\(ctx, 16, RIGHT_TOP, "↻"/);
  assert.doesNotMatch(gameCanvas, /this\.drawPill\([^\n]*this\.hud\.roomName/);
  assert.doesNotMatch(gameCanvas, /`\$\{this\.hud\.roomName\}\s+↻`/);
});

test("curated room renderer has no per-mark, FX, layer or glow canvas", () => {
  assert.equal((curatedRenderer.match(/createElement\("canvas"\)/g) ?? []).length, 3);
  assert.doesNotMatch(curatedRenderer, /fxCanvas|layerCanvas|glowCanvas/);
  assert.match(curatedRenderer, /private markAtlasCanvas: HTMLCanvasElement \| null = null/);
  assert.match(curatedRenderer, /private warpBlurCanvas: HTMLCanvasElement \| null = null/);
  assert.match(curatedRenderer, /one prepared source texture, never one blur canvas per field or slice/);
  assert.match(curatedRenderer, /One atlas packs every authored\s+\/\/ color; it is never one canvas per mark, color, layer or animation state/);
  assert.match(curatedRenderer, /const atlasSoftMarks = stages\?\.atlasSoftMarks !== false/);
  assert.match(curatedRenderer, /adapter\.kind === "lissajous-heartbeat"[\s\S]*?adapter\.kind === "firefly"[\s\S]*?adapter\.kind === "growth"[\s\S]*?adapter\.kind === "twinkle"[\s\S]*?adapter\.kind === "galaxy"[\s\S]*?adapter\.kind === "color-liquify-splash"/);
  assert.match(curatedRenderer, /adapter\.kind === "color-liquify-breakout"/);
  assert.match(curatedRenderer, /const open = 1 - \(1 - progress\) \*\* 3/);
  assert.match(curatedRenderer, /atlasUsesPhoto = adapter\.kind === "growth"/);
  assert.match(curatedRenderer, /mark\.shape === "dot" \|\| mark\.shape === "streak"/);
  assert.match(curatedRenderer, /this\.sourceCanvas\.width = 0;\s+this\.sourceCanvas\.height = 0/);
  assert.match(curatedRenderer, /for \(const slice of field\.slices\)/);
  assert.match(curatedRenderer, /this\.releaseWarpBlur\(\)/);
});

test("curated mark atlas stays within a mobile-safe texture edge", () => {
  assert.match(curatedRenderer, /const MAX_MARK_ATLAS_EDGE = 4_096/);
  assert.match(curatedRenderer, /Math\.ceil\(Math\.sqrt\(cellCount\)\)/);
  assert.match(curatedRenderer, /Curated mark atlas exceeds the mobile texture bound/);
  assert.match(curatedRenderer, /private readonly resolvedMark: ResolvedMark/);
  assert.match(curatedRenderer, /const resolved = this\.resolvedMark/);
});

test("Unfinished Morning does not create a canvas per sampled color", () => {
  assert.doesNotMatch(unfinishedRenderer, /function tintedStamp/);
  assert.doesNotMatch(unfinishedRenderer, /stamp: HTMLCanvasElement/);
  assert.match(unfinishedRenderer, /drawn directly in\s+\/\/ the sampled color/);
});

test("curated Hider and Seeker Live have one visible canvas and one bounded off-DOM room cache", () => {
  assert.doesNotMatch(gameCanvas, /liveUnderlay|LiveUnderlay|usesLiveUnderlay|renderLiveUnderlay/);
  assert.doesNotMatch(gameCanvas, /FREEZE_UNDERLAY_WHILE_MOVING/);
  assert.doesNotMatch(styles, /live-room-underlay|game-overlay-canvas|has-live-room-underlay/);
  assert.match(gameCanvas, /private roomFrameCanvas: HTMLCanvasElement \| null = null/);
  assert.match(gameCanvas, /frame\.width = VIEW_WIDTH;\s+frame\.height = VIEW_HEIGHT/);
  const ensureRoomFrame = gameCanvas.match(/private ensureRoomFrame\(\): HTMLCanvasElement \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.doesNotMatch(ensureRoomFrame, /\.before\(|\.after\(|append|prepend|replace/);
  assert.match(gameCanvas, /context\.drawImage\(this\.refreshRoomFrame\(\), 0, 0, VIEW_WIDTH, VIEW_HEIGHT\);\s+this\.foregroundReady = this\.drawWorldForeground\(\)/);
  assert.match(gameCanvas, /this\.roomFrameDirty = true;\s+needsIdleRender = true;/);
  assert.match(gameCanvas, /if \(!moved && needsIdleRender\) this\.render\(\)/);
  assert.match(gameCanvas, /private drawSceneLayers[\s\S]*?context\.drawImage\(this\.canvas, 0, 0, width, height\)/);
});

test("turning starter camo off restores the authored chameleon base", () => {
  assert.match(paintStudio, /const base = this\.camoEnabled \? this\.ivoryBaseFor\(this\.pose, image\) : image/);
  assert.doesNotMatch(paintStudio, /ctx\.drawImage\(this\.clipToMask\(this\.camoLayer, this\.upperEdgeMaskFor/);
});

test("Seeker Close Look is restored with tap and Space/R inspection", () => {
  assert.match(gameCanvas, /const SEEKER_CLOSE_LOOK_ENABLED = true/);
  assert.match(gameCanvas, /private inspectionFrame: HTMLCanvasElement \| null = null/);
  assert.match(gameCanvas, /SEEKER_CLOSE_LOOK_ENABLED && this\.closeLookOpen\) this\.captureInspectionFrame\(\)/);
  assert.match(gameCanvas, /if \(this\.closeLookOpen\) this\.drawCloseLook\(ctx\)/);
  assert.match(gameCanvas, /if \(!SEEKER_CLOSE_LOOK_ENABLED\) return;\s+const inspectionFrame = this\.inspectionFrame \?\?= document\.createElement\("canvas"\)/);
  assert.match(gameCanvas, /SEEKER_CLOSE_LOOK_ENABLED\s+&& id === "look"/);
  assert.match(gameCanvas, /event\.code === "Space" \|\| event\.code === "KeyR"/);
  assert.match(gameCanvas, /const shortcut = "SPACE \/ R"/);
  assert.match(gameCanvas, /if \(!this\.active \|\| !this\.playUi \|\| this\.phase !== "playing"/);
});

test("Seeker can collapse and reopen Close Look without another canvas", () => {
  assert.match(gameCanvas, /private closeLookOpen = true/);
  assert.match(gameCanvas, /this\.drawCloseLookToggle\(ctx\)/);
  assert.match(gameCanvas, /id: "look-toggle"/);
  assert.match(gameCanvas, /this\.closeLookOpen = !this\.closeLookOpen/);
});

test("joystick pointer events do not render the foreground outside the movement RAF", () => {
  const updateJoy = gameCanvas.match(/private updateJoy\([^)]*\): void \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.match(updateJoy, /this\.joy\.dx = x \/ max/);
  assert.match(updateJoy, /this\.joy\.dy = y \/ max/);
  assert.doesNotMatch(updateJoy, /this\.render\(\)/);
  assert.match(gameCanvas, /private readonly uiFrame[\s\S]*?this\.moveActor\(dx, dy, deltaMs\)/);
});

test("movement keeps the animated room and actor in the same render pass", () => {
  assert.match(gameCanvas, /this\.moveActor\(dx, dy, deltaMs\)[\s\S]*?moved = true/);
  assert.match(gameCanvas, /moveActor\(dx: number, dy: number, deltaMs: number\): void[\s\S]*?this\.render\(\)/);
  assert.match(gameCanvas, /context\.drawImage\(this\.refreshRoomFrame\(\)[\s\S]*?this\.drawWorldForeground\(\)/);
  assert.doesNotMatch(gameCanvas, /renderMovementForeground|actorMovementRect|joystickMovementRect/);
});

test("portal transitions paint the destination loader before cold Live preparation", () => {
  assert.match(gameCanvas, /type LoadingChangeHandler = \(loading: boolean, immediate: boolean\) => void/);
  assert.match(gameCanvas, /if \(this\.livePainting && supportsCuratedLiveProject\(this\.artHouse, roomIndex\)\) \{[\s\S]*?this\.setRoomLoading\(true, true\);\s+this\.roomTransitionPending = true/);
  assert.match(gameCanvas, /if \(this\.roomTransitionPending\) return frame/);
  assert.match(gameCanvas, /requestAnimationFrame\(\(\) => \{[\s\S]*?this\.roomTransitionPending = false;[\s\S]*?this\.render\(\)/);
  assert.equal(
    (gameCanvas.match(/this\.setRoomLoading\(this\.roomTransitionPending \|\| !\(this\.backgroundReady && this\.foregroundReady\)\)/g) ?? []).length,
    2,
  );
  assert.match(main, /state\.taskCount > 0 \|\| \(state\.roomLoading && state\.roomLoadingImmediate\)/);
  assert.match(main, /scene\.onLoadingChange\(\(loading, immediate\) =>/);
});

test("1B Live omits only the duplicate paint-splashed rug", () => {
  assert.match(gameCanvas, /this\.livePainting[\s\S]*?this\.artHouse === "van-gogh-house"[\s\S]*?this\.roomIndex === 1[\s\S]*?instance\.modelId === "paint-splashed-rug"\) continue/);
});

test("Seeker movement keeps the Hider Live avatar animating", () => {
  assert.match(gameCanvas, /this\.livePainting\?\.marks\.length[\s\S]*?\(this\.mode === "seeker" \|\| !this\.actorMoving\)/);
});

test("Seeker view treats the hidden chameleon as room artwork", () => {
  assert.match(gameCanvas, /const SEEKER_HIDER_BACKGROUND_DEPTH = -800/);
  assert.match(gameCanvas, /depth: this\.mode === "seeker" \? SEEKER_HIDER_BACKGROUND_DEPTH : this\.target\.y/);
  assert.doesNotMatch(gameCanvas, /clipHiderBehindSeeker/);
  assert.match(gameCanvas, /layers\.sort\(\(a, b\) => a\.depth - b\.depth\)/);
});

test("Hider and Seeker use the same aligned actor image frame", () => {
  assert.match(gameCanvas, /const ACTOR_IMAGE_SIZE = 90/);
  assert.match(gameCanvas, /const ACTOR_IMAGE_TOP_OFFSET = 76/);
  assert.equal((gameCanvas.match(/ACTOR_IMAGE_SIZE,\n\s+ACTOR_IMAGE_SIZE,/g) ?? []).length, 2);
  assert.equal((gameCanvas.match(/- ACTOR_IMAGE_TOP_OFFSET/g) ?? []).length, 2);
});
