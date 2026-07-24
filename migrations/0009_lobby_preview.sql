-- Restore the migration filename already recorded by the production D1
-- database. The current Worker uses preview_image; this legacy column remains
-- for migration-history parity and can be retired in a future table rebuild.
ALTER TABLE challenges ADD COLUMN lobby_preview_image TEXT;
