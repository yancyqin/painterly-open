import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeRoomName,
  normalizeRoomSearch,
  randomRoomName,
} from "../src/roomNames.js";

test("room names are exactly two words from the kid-safe vocabulary", () => {
  assert.equal(normalizeRoomName("sunny garden"), "Sunny Garden");
  assert.equal(normalizeRoomName("  Blue   Bird "), "Blue Bird");
  assert.equal(normalizeRoomName("Sunny"), null);
  assert.equal(normalizeRoomName("Sunny Badword"), null);
  assert.equal(normalizeRoomName("Sunny Garden Extra"), null);
});

test("room search accepts an English one- or two-word prefix", () => {
  assert.equal(normalizeRoomSearch("  BLUE   BI "), "blue bi");
  assert.equal(normalizeRoomSearch("blue bird"), "blue bird");
  assert.equal(normalizeRoomSearch("blue-bird"), null);
  assert.equal(normalizeRoomSearch("蓝色"), null);
});

test("room name generation is deterministic when given a random source", () => {
  assert.equal(randomRoomName(() => 0), "Blue Bird");
  assert.equal(randomRoomName(() => 0.999999), "Wild Willow");
});
