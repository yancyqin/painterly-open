PRAGMA foreign_keys = ON;

-- Per-challenge screenshots. Both are small, compressed data URLs (JPEG/WebP)
-- captured client-side and re-encoded low-resolution to keep row size small;
-- see MAX_PREVIEW_DATA_LENGTH / MAX_FOUND_DATA_LENGTH in core.js. They live and
-- die with the 24-hour challenge row (no separate cleanup path). Nullable so
-- existing rows are fine.

-- The single public-safe (obscured) preview, shown everywhere a challenge
-- appears as a thumbnail — Lobby cards and the Hider's manage/share view.
ALTER TABLE challenges ADD COLUMN preview_image TEXT;

-- The most recent successful find, captured by the Seeker at the moment they
-- spotted it. Overwritten on every new found attempt, so only the latest is
-- retained — cheapest possible "someone found it here" proof.
ALTER TABLE challenges ADD COLUMN last_found_image TEXT;
ALTER TABLE challenges ADD COLUMN last_found_at INTEGER;
