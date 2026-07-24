# 6A Live Brushes

These standalone Function Brush files mirror the reviewed production
effects in `src/game/livePainting.ts`. Painterly Chameleon calls them
**Live Brushes**.

- `white-mist.fnbrush.json` — RETIRED 2026-07-21 (the effect never landed
  right); kept only as an archive. The game no longer accepts or renders it —
  old stored marks fall back to liquid-color
- `blue-current.fnbrush.json` — paint flowing with the production current timing
- `liquid-color.fnbrush.json` — a soft expanding alpha annulus using the donor
  distance-wave timing
- `graphite-whisper.fnbrush.json` — a fixed vector progressively drawn and erased,
  with no line jitter

Each file follows the v1 Function Brush contract drafted in Art Lab. The
`revision` is the SHA-256 of its exact LF-normalized `source` string. They are
kept separate from the 6A demo renderer so Art Lab can import, edit, and export
them without depending on Painterly Chameleon runtime code.

The game never uploads these brush files or their source. A challenge may store
only a bounded list of local marks referencing the four shipped brush ids,
plus normalized coordinates, size, flow, deterministic variation, and angle.
The room and avatar share one reviewed game-shipped force strength; challenge
data cannot adjust it. The brush id is force-only: the runtime samples
the finished avatar paint at each mark, following Art Lab's `rebuildPhoto()`
semantics, so a force never supplies its own color. The TypeScript renderer is
authoritative; these portable files carry the same reviewed timing constants
for Art Lab import and editing.
