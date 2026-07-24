-- Fast feed/account metadata. The reviewed avatar force marks remain
-- in payload_json; no Function Brush project, marks, masks or code enter D1.
ALTER TABLE challenges ADD COLUMN is_live INTEGER NOT NULL DEFAULT 0
  CHECK (is_live IN (0, 1));
