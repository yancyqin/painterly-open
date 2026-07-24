import test from "node:test";
import assert from "node:assert/strict";

import {
  CHALLENGE_TTL_SECONDS,
  attemptFindsChallenge,
  parseChallengePath,
  unixSeconds,
  validateAttemptInput,
  validateChallengeInput,
  validateModerationActionInput,
  validateReportInput,
} from "../src/core.js";

test("challenge TTL is exactly 24 hours", () => {
  assert.equal(CHALLENGE_TTL_SECONDS, 86_400);
});

const challenge = {
  version: 1,
  artHouse: "van-gogh-house",
  surface: 1,
  artSeed: 42,
  roomIndex: 2,
  x: 420,
  y: 480,
  pose: "curl",
  roomName: "Sunny Garden",
  avatarData: `data:image/webp;base64,${Buffer.from("small-avatar").toString("base64")}`,
};

test("validates a versioned painterly challenge", () => {
  assert.deepEqual(validateChallengeInput(challenge), {
    ok: true,
    value: { ...challenge, isPublic: false },
  });
});

test("accepts every released art house payload", () => {
  assert.equal(validateChallengeInput({ ...challenge, artHouse: "monet-garden-house" }).ok, true);
  assert.equal(validateChallengeInput({ ...challenge, artHouse: "outdoor-masters-journey" }).ok, true);
  assert.equal(validateChallengeInput({ ...challenge, artHouse: "world-remembers-color" }).ok, true);
  assert.equal(validateChallengeInput({ ...challenge, artHouse: "luminous-tide-dreamscape" }).ok, true);
  assert.equal(validateChallengeInput({ ...challenge, artHouse: "unfinished-morning" }).ok, true);
  assert.equal(validateChallengeInput({ ...challenge, artHouse: "unknown-house" }).ok, false);
});

test("accepts only bounded curated Live Brush marks in a live art house", () => {
  const livePainting = {
    marks: [{ brush: "blue-current", x: 112, y: 137, size: 48, flow: 72, seed: 42, angle: 0.25 }],
  };
  const accepted = validateChallengeInput({
    ...challenge,
    artHouse: "unfinished-morning",
    livePainting,
  });
  assert.equal(accepted.ok, true);
  assert.deepEqual(accepted.value.livePainting, livePainting);

  assert.equal(validateChallengeInput({ ...challenge, livePainting }).ok, true);
  for (const brush of ["firefly", "growth", "color-liquify-splash"]) {
    assert.equal(validateChallengeInput({
      ...challenge,
      livePainting: { marks: [{ ...livePainting.marks[0], brush }] },
    }).ok, true, `${brush} is a released bounded brush`);
  }
  assert.equal(validateChallengeInput({ ...challenge, artHouse: "monet-garden-house", livePainting }).ok, false);
  assert.equal(validateChallengeInput({
    ...challenge,
    artHouse: "unfinished-morning",
    livePainting: { ...livePainting, marks: [{ ...livePainting.marks[0], brush: "custom-code" }] },
  }).ok, false);
  assert.equal(validateChallengeInput({
    ...challenge,
    artHouse: "unfinished-morning",
    livePainting: { ...livePainting, intensity: 96 },
  }).ok, false);
  assert.equal(validateChallengeInput({
    ...challenge,
    artHouse: "unfinished-morning",
    livePainting: { ...livePainting, marks: [{ ...livePainting.marks[0], flow: 101 }] },
  }).ok, false);
  assert.equal(validateChallengeInput({
    ...challenge,
    artHouse: "unfinished-morning",
    livePainting: { ...livePainting, brush: "blue-current" },
  }).ok, false);

  // The quiet→live force dial: an optional integer, 10 up to the reviewed 100.
  const quieted = validateChallengeInput({
    ...challenge,
    artHouse: "unfinished-morning",
    livePainting: { ...livePainting, strength: 35 },
  });
  assert.equal(quieted.ok, true);
  assert.deepEqual(quieted.value.livePainting, { ...livePainting, strength: 35 });
  for (const strength of [9, 101, 55.5, "70"]) {
    assert.equal(validateChallengeInput({
      ...challenge,
      artHouse: "unfinished-morning",
      livePainting: { ...livePainting, strength },
    }).ok, false, `strength ${strength} must be rejected`);
  }
});

test("accepts an explicit public Explore opt-in", () => {
  assert.equal(validateChallengeInput({ ...challenge, isPublic: true }).value.isPublic, true);
  assert.equal(validateChallengeInput({ ...challenge, isPublic: "yes" }).ok, false);
});

test("rejects free-text, non-English, or longer room names", () => {
  assert.equal(validateChallengeInput({ ...challenge, roomName: "Blue Bird" }).value.roomName, "Blue Bird");
  assert.equal(validateChallengeInput({ ...challenge, roomName: "My School" }).ok, false);
  assert.equal(validateChallengeInput({ ...challenge, roomName: "蓝色 小鸟" }).ok, false);
  assert.equal(validateChallengeInput({ ...challenge, roomName: "Very Sunny Garden" }).ok, false);
});

test("rejects an unsupported or oversized avatar payload", () => {
  const result = validateChallengeInput({ ...challenge, avatarData: "data:image/svg+xml;base64,PHN2Zy8+" });
  assert.equal(result.ok, false);
});

test("accepts a small preview image but rejects unsafe screenshot data", () => {
  const previewImage = `data:image/jpeg;base64,${Buffer.from("tiny-preview").toString("base64")}`;
  const accepted = validateChallengeInput({ ...challenge, previewImage });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.value.previewImage, previewImage);
  assert.equal(validateChallengeInput({ ...challenge, previewImage: "data:image/svg+xml;base64,PHN2Zy8+" }).ok, false);
  // Oversized preview (over the small ≤14k cap) is rejected.
  const huge = `data:image/jpeg;base64,${"A".repeat(20_000)}`;
  assert.equal(validateChallengeInput({ ...challenge, previewImage: huge }).ok, false);
});

test("validates a seeker attempt", () => {
  assert.equal(
    validateAttemptInput({
      attemptId: "e51b7fcc-b540-448d-bc80-9e87dce80e80",
      roomIndex: 2,
      x: 420,
      y: 442,
      elapsedMs: 1_250,
    }).ok,
    true,
  );
});

test("accepts a found screenshot only on a valid seeker attempt", () => {
  const foundImage = `data:image/webp;base64,${Buffer.from("tiny-find").toString("base64")}`;
  const result = validateAttemptInput({
    attemptId: "e51b7fcc-b540-448d-bc80-9e87dce80e80",
    roomIndex: 2,
    x: 420,
    y: 442,
    elapsedMs: 1_250,
    foundImage,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.foundImage, foundImage);
  assert.equal(validateAttemptInput({ ...result.value, foundImage: "not-an-image" }).ok, false);
});

test("checks a seeker tap against the stored room and avatar ellipse", () => {
  assert.equal(attemptFindsChallenge(challenge, { roomIndex: 2, x: 420, y: 442 }), true);
  assert.equal(attemptFindsChallenge(challenge, { roomIndex: 1, x: 420, y: 442 }), false);
  assert.equal(attemptFindsChallenge(challenge, { roomIndex: 2, x: 700, y: 442 }), false);
});

test("normalizes an explicit give-up attempt", () => {
  const result = validateAttemptInput({
    attemptId: "e51b7fcc-b540-448d-bc80-9e87dce80e80",
    roomIndex: 0,
    x: 0,
    y: 0,
    elapsedMs: 5_000,
    gaveUp: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.gaveUp, true);
});

test("parses challenge API routes", () => {
  const token = "abcdefghijklmnopqrstuvwx";
  assert.deepEqual(parseChallengePath(`/api/challenges/${token}`), { token, action: "challenge" });
  assert.deepEqual(parseChallengePath(`/api/challenges/${token}/attempts`), { token, action: "attempts" });
  assert.deepEqual(parseChallengePath(`/api/challenges/${token}/results`), { token, action: "results" });
  assert.deepEqual(parseChallengePath(`/api/challenges/${token}/reports`), { token, action: "reports" });
  assert.deepEqual(parseChallengePath(`/api/challenges/${token}/publication`), { token, action: "publication" });
  assert.equal(parseChallengePath("/api/challenges/short"), null);
});

test("accepts only fixed, no-free-text report reasons", () => {
  assert.deepEqual(validateReportInput({ reportId: "report_id_123", reason: "not_okay" }), {
    ok: true,
    value: { reportId: "report_id_123", reason: "not_okay" },
  });
  assert.equal(validateReportInput({ reportId: "report_id_123", reason: "because I said so" }).ok, false);
  assert.equal(validateReportInput({ reportId: "short", reason: "broken" }).ok, false);
});

test("accepts only fixed moderation actions", () => {
  assert.deepEqual(validateModerationActionInput({ action: "restore" }), {
    ok: true,
    value: { action: "restore" },
  });
  assert.equal(validateModerationActionInput({ action: "delete" }).ok, false);
  assert.equal(validateModerationActionInput({ action: "confirm_hidden", note: "ignored" }).ok, true);
});

test("converts milliseconds to Unix seconds", () => {
  assert.equal(unixSeconds(1_234_999), 1_234);
});
