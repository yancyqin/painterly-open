import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const projectPath = new URL(
  "../src/game/assets/live-projects/van-gogh-sunflower-parlor-1a.json",
  import.meta.url,
);
const project = JSON.parse(readFileSync(projectPath, "utf8"));
const cypressProject = JSON.parse(readFileSync(new URL(
  "../src/game/assets/live-projects/van-gogh-cypress-bedroom-1c.json",
  import.meta.url,
), "utf8"));
const starryProject = JSON.parse(readFileSync(new URL(
  "../src/game/assets/live-projects/van-gogh-starry-studio-1b.json",
  import.meta.url,
), "utf8"));

test("1A curated Live Painting asset stays bounded and source-free", () => {
  assert.equal(project.format, "painterly-curated-live-project");
  assert.equal(project.version, 1);
  assert.equal(project.artHouse, "van-gogh-house");
  assert.equal(project.roomIndex, 0);
  assert.equal(project.baseSurface, 2);
  assert.deepEqual(project.stats, { marks: 626, strokes: 17, warpFields: 5 });
  assert.equal(
    project.source.lppSha256,
    "sha256:3aa1db5eadb52115145a3a61a7ebbbdd67b428728477b638ca7ee2b3ef789489",
  );

  const adapterValues = Object.values(project.adapters);
  assert.equal(adapterValues.length, 12);
  for (const adapter of adapterValues) {
    assert.equal(Object.hasOwn(adapter, "source"), false);
    assert.equal(Object.hasOwn(adapter, "code"), false);
  }
});

test("1C curated Live Painting asset stays bounded and source-free", () => {
  assert.equal(cypressProject.format, "painterly-curated-live-project");
  assert.equal(cypressProject.version, 1);
  assert.equal(cypressProject.artHouse, "van-gogh-house");
  assert.equal(cypressProject.roomIndex, 2);
  assert.equal(cypressProject.baseSurface, 0);
  assert.deepEqual(cypressProject.stats, { marks: 553, strokes: 15, warpFields: 2 });
  assert.equal(
    cypressProject.source.lppSha256,
    "sha256:c5f646b6f4bdab6a09678b277096af0b1953cc1483fb60833a816ace6843f43f",
  );
  assert.equal(
    cypressProject.source.sha256,
    "sha256:85f71fc3fd00b7c1436d1e38331c8f1a8c4aeff62f9807f3533137e1f05bf698",
  );

  const adapters = Object.values(cypressProject.adapters);
  assert.deepEqual(
    adapters.map(adapter => adapter.kind).sort(),
    ["firefly", "firefly", "firefly", "firefly", "growth", "liquid-warp", "liquid-warp", "twinkle"],
  );
  for (const adapter of adapters) {
    assert.equal(Object.hasOwn(adapter, "source"), false);
    assert.equal(Object.hasOwn(adapter, "code"), false);
  }
});

test("1B Source Cover stays explicitly bounded and source-free", () => {
  assert.equal(starryProject.format, "painterly-curated-live-project");
  assert.equal(starryProject.version, 1);
  assert.equal(starryProject.artHouse, "van-gogh-house");
  assert.equal(starryProject.roomIndex, 1);
  assert.equal(starryProject.baseSurface, 0);
  assert.deepEqual(starryProject.stats, { marks: 6140, strokes: 112, warpFields: 0 });
  assert.equal(
    starryProject.source.lppSha256,
    "sha256:f5c2c632d22e80b35c2a5697af4d65c21787f57459d20e79f1a5759489bfb806",
  );
  assert.equal(
    starryProject.source.sha256,
    "sha256:34684e067ca29b9219b00e6949463d70e5b6f7bbeab106f7f14063c708a2cbab",
  );

  const kinds = Object.values(starryProject.adapters).map(adapter => adapter.kind);
  assert.equal(kinds.filter(kind => kind === "twinkle").length, 4);
  assert.equal(kinds.filter(kind => kind === "color-liquify-splash").length, 14);
  assert.equal(kinds.filter(kind => kind === "curve-current").length, 3);
  assert.equal(kinds.filter(kind => kind === "color-liquify-breakout").length, 0);
  assert.equal(kinds.filter(kind => kind === "galaxy").length, 0);
  assert.deepEqual(
    starryProject.adapters["sha256:49ebf0e7396970792b9ae961f2ddb653cccd1bb53dae42e77e9919c5dceaa3e3"],
    {
      kind: "curve-current",
      speed: 50,
      flow: 2,
      startStagger: .38,
      activeWindow: .55,
      arriveAt: .78,
      wobble: 4,
      photoOpacity: 65,
      photoBlur: 7,
      cover: {
        lead: .07,
        restore: .12,
        finalPause: .04,
        red: 12,
        green: 52,
        blue: 94,
        opacity: .96,
      },
    },
  );
  assert.deepEqual(
    starryProject.adapters["sha256:0c1a4a780ced6a386ede7d4f4481e7eb04c48d524934b17935ef6913a6f51cb0"].cover,
    {
      lead: .07,
      restore: .12,
      finalPause: .04,
      red: 7,
      green: 54,
      blue: 102,
      opacity: .96,
    },
  );
  assert.deepEqual(
    starryProject.adapters["sha256:d0901e44ff29a8ceb32cdfabab8fe098db3734d98ce2775fb0daff24f7ed06b1"].cover,
    {
      lead: .07,
      restore: .12,
      finalPause: .04,
      red: 125,
      green: 100,
      blue: 42,
      opacity: .76,
      startFade: .12,
      endFade: .12,
    },
  );
  const sourceCoverMarks = starryProject.layers
    .flatMap(layer => layer.strokes)
    .filter(stroke => starryProject.adapters[stroke.brushRevision]?.cover)
    .flatMap(stroke => stroke.marks);
  assert.equal(sourceCoverMarks.length, 5587);
  assert.equal(sourceCoverMarks.filter(mark => mark.angle < -10).length, 1691);
  assert.equal(JSON.stringify(starryProject).includes("function brush"), false);
  assert.equal(JSON.stringify(starryProject).includes("function move"), false);
});
