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

test("1B owner-approved Curve Current stays explicitly bounded and source-free", () => {
  assert.equal(starryProject.format, "painterly-curated-live-project");
  assert.equal(starryProject.version, 1);
  assert.equal(starryProject.artHouse, "van-gogh-house");
  assert.equal(starryProject.roomIndex, 1);
  assert.equal(starryProject.baseSurface, 0);
  assert.deepEqual(starryProject.stats, { marks: 4910, strokes: 227, warpFields: 0 });
  assert.equal(
    starryProject.source.lppSha256,
    "sha256:1b26be2478043bb57b0abd1cc0130ae2c70061061d5e3b29eb727cca9d734cd9",
  );
  assert.equal(
    starryProject.source.sha256,
    "sha256:34684e067ca29b9219b00e6949463d70e5b6f7bbeab106f7f14063c708a2cbab",
  );

  const kinds = Object.values(starryProject.adapters).map(adapter => adapter.kind);
  assert.equal(kinds.filter(kind => kind === "twinkle").length, 4);
  assert.equal(kinds.filter(kind => kind === "color-liquify-splash").length, 14);
  assert.equal(kinds.filter(kind => kind === "color-liquify-breakout").length, 2);
  assert.equal(kinds.filter(kind => kind === "curve-current").length, 3);
  assert.equal(kinds.filter(kind => kind === "galaxy").length, 0);
  assert.deepEqual(
    starryProject.adapters["sha256:36cb21d7a2dca0befd24c387d7930991daefa7dc71a72f9bf59841ceaec17d7a"],
    { kind: "color-liquify-breakout", speed: 10, size: 11, travel: 10, lives: 2.8 },
  );
  for (const revision of [
    "sha256:a8702e96aacda345e971d203b34c689d0bb404960425eb6d1abc4f23b413230d",
    "sha256:6de17a7cd51904f7056d233d0d65232b176212bdf68efe9a1f1434f8333553c7",
    "sha256:2c730ba29858619f259549bc01c79540ed515ff7b9004c8ba3339daaaaa111cd",
  ]) {
    assert.deepEqual(starryProject.adapters[revision], {
      kind: "curve-current",
      speed: 17,
      flow: 3,
      startStagger: .38,
      activeWindow: .55,
      arriveAt: .78,
      wobble: 4,
      photoOpacity: 78,
      photoBlur: 7,
    });
  }
  assert.deepEqual(
    starryProject.adapters["sha256:d1e72b3f6e17396bb4d6f0eedd4a119e688677e289f09ba7683f565c30a79e88"],
    { kind: "color-liquify-breakout", speed: 10, size: 7, travel: 10, lives: 2.8 },
  );
  assert.equal(JSON.stringify(starryProject).includes("function brush"), false);
  assert.equal(JSON.stringify(starryProject).includes("function move"), false);
});
