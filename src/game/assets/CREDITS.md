# Painterly Chameleon asset record

> Migration note: this ledger was copied intact from Snake Lab so generation
> history is not lost. Painterly Chameleon ships the 9 Van Gogh v6 room
> surfaces, 81 active Van Gogh prop variants, 3 avatar masks, the 3 Monet room
> surfaces plus 33 Monet prop variants, 3 Outdoor runtime plates plus 49 props,
> and 3 Color Rebirth plates plus 58 props. Each migrated art house has a
> `content/art-houses/*/provenance.json` record. Other legacy plates and
> modeling experiments below remain historical context and are not runtime
> assets. All migrated assets remain `prototype` until their commercial review
> fields are completed.

Generated for this project with OpenAI's built-in image generation tool on
2026-07-16 and 2026-07-17. The checked-in files are project-bound game assets; source outputs
remain in Codex's generated-image store under generation thread
`019f69a8-aa13-75e3-a8cf-5e34c39b506c`.

## Active v6 Van Gogh House gallery shells

The runtime uses these nine 960 × 640 plates. A/B/C share the same camera and
single Editor-authored prop layout, but each has different wall/floor painting
and one or two permanent rear/side-wall fixtures. Every floor-standing fixture
has a matching surface-specific `backgroundSolid`; freestanding runtime props
remain separate sprites.

- `rooms/van-gogh-sunflower-parlor-shell-v6a.jpg` — rear-left sunflower
  sideboard; source `exec-34908f96-c386-4ea6-a631-71b91e1f6fdb.png`.
- `rooms/van-gogh-starry-studio-shell-v6a.jpg` — rear-left canvas drying rack;
  source `exec-3adad3c2-05bd-4e28-90b6-070c2dc429fb.png`.
- `rooms/van-gogh-cypress-bedroom-shell-v6a.jpg` — right-wall bed; corrected
  source `exec-52e5474c-f60f-43b5-b737-69da5bda8a7c.png`.
- `rooms/van-gogh-sunflower-parlor-shell-v6b.jpg` — curved built-in bench;
  source `exec-055d1fae-6dff-48e7-8e12-644f0938b6e7.png`.
- `rooms/van-gogh-starry-studio-shell-v6b.jpg` — portfolio hutch under the
  window; source `exec-b2c3526e-69a6-4782-8cc7-ac76bd010c5d.png`.
- `rooms/van-gogh-cypress-bedroom-shell-v6b.jpg` — narrow cypress bookcase;
  source `exec-76d40455-49c9-48e0-bcb2-7a485fb774f1.png`.
- `rooms/van-gogh-sunflower-parlor-shell-v6c.jpg` — sideboard plus upholstered
  bench; source `exec-77b4651c-2f50-4d9f-bc46-3d26114b82f6.png`.
- `rooms/van-gogh-starry-studio-shell-v6c.jpg` — window bench plus drying rack;
  source `exec-12123d10-9cdc-42aa-847f-474b397123f9.png`.
- `rooms/van-gogh-cypress-bedroom-shell-v6c.jpg` — bed plus low bookcase;
  source `exec-eb4500b8-c931-416b-9e5a-53813d01cbb1.png`.

Built-in Image Generation edit mode was used. The final prompt set locked the
960:640 camera, crop, wall corners, baseboards, window/doors, floor perspective,
room motif and bottom/front light direction; it added only the named fixture,
required a simple measurable floor-contact shape, and forbade people, text, UI,
new openings, extra loose furniture and watermarks. Outputs were inspected at
full size, resized to 960 × 640, then collision was measured from the final
pixels rather than from requested coordinates.

## Gallery-shell generation history

The earlier pipeline produced three geometry-locked 960 x 640 paintings for each of three
spatial galleries. They contain painted architecture, correct side-wall
openings, and primarily flat surface artwork. Freestanding furniture,
collision, and occlusion remain catalogued runtime instances; the new C plates
also test one permanent collision-backed wall fixture per room. Each
room is viewed through its own fixed local camera, so its vanishing point is
never horizontally stitched to another room's vanishing point. Walking into a
painted doorway performs a deterministic shared client/server room transition.

- `rooms/van-gogh-sunflower-parlor-shell-v4a.jpg` — source
  `exec-1f22fd06-fd05-47e1-bf4e-b3d69d5a6a9a.png`.
- `rooms/van-gogh-sunflower-parlor-shell-v4b.jpg` — source
  `exec-4616533c-5b44-4624-80c8-fb1caf5f86de.png`.
- `rooms/van-gogh-starry-studio-shell-v4a.jpg` — source
  `exec-197f5b34-6253-4504-9f82-2824ea0857f4.png`.
- `rooms/van-gogh-starry-studio-shell-v4b.jpg` — source
  `exec-330719be-f9d3-4b9c-a035-9aeae697078b.png`.
- `rooms/van-gogh-cypress-bedroom-shell-v4a.jpg` — source
  `exec-663ce7bb-4aba-4d4e-be60-b44dfee9bce5.png`.
- `rooms/van-gogh-cypress-bedroom-shell-v4b.jpg` — source
  `exec-5f78db94-fc69-4124-86cd-15e1d93dc63a.png`.

The v4 prompts preserved the supplied camera, crop, wall-floor seams, columns,
window, and quadrilateral passages. Sunflower Parlor was repainted as a clean
gold-and-cobalt floral salon; Starry Studio is the only deliberately messy room,
with clustered pigment and charcoal work traces; Cypress Bedroom is a quiet
cypress, hill, and moon landscape with an orderly striped floor. Each B prompt
changed only the painted motif arrangement to create an alternate session
texture. All prompts forbade furniture, freestanding objects, people, text, UI,
changed architecture, CGI, and watermarks. Superseded v2/v3 shells remain as
generation history but are not loaded by the client.

The geometry-locked C surfaces were generated on 2026-07-17 and were the first
fixture experiment before v6. They use the same architecture and a
shared lighting rule: diffuse light enters from screen-bottom/front and falls
off toward screen-top/back. They remain deliberately different by room: a
curated curling sunflower composition, a localized messy comet-and-charcoal
studio, and an orderly cypress-and-wheat bedroom.

- `rooms/van-gogh-sunflower-parlor-shell-v4c.jpg` — source
  `exec-6f693fe9-f33f-4d5a-96c6-85cb8660f5e3.png`.
- `rooms/van-gogh-starry-studio-shell-v4c.jpg` — source
  `exec-9771b69a-04a5-4ca8-8da0-048f8edbd271.png`.
- `rooms/van-gogh-cypress-bedroom-shell-v4c.jpg` — source
  `exec-fdbb9a26-164f-462f-b7a0-6f7e8949c0fd.png`.

The original empty v4c plates remain checked in as generation history. The
superseded v5c revisions were produced with built-in image generation in edit mode,
preserving camera, crop, wall corners, baseboards, columns, window, openings,
and front-to-back illumination while adding exactly one rear/side-wall fixture:

- `rooms/van-gogh-sunflower-parlor-shell-v5c.jpg` — low sunflower sideboard
  and framed wall study; source
  `exec-ebdd1193-5a85-49e1-b7f2-cd9e5832ab92.png`.
- `rooms/van-gogh-starry-studio-shell-v5c.jpg` — low storage bench directly
  below the rear window; source
  `exec-645d83ee-df96-4145-b9f5-805ae7b2df58.png`.
- `rooms/van-gogh-cypress-bedroom-shell-v5c.jpg` — narrow blue-and-gold bed
  against the back/right wall; source
  `exec-f9459635-5bbe-410c-8a04-cef0d8dfc466.png`.

The final prompt set required late-19th-century impasto, unchanged perspective
and doors, no people/text/UI/new openings, no extra loose furniture, and a
floor-contact area fully reachable by one simple rectangular collision solid.

## Curated Live Painting project: Van Gogh 1A

- Editable audit source: `content/live-projects/van-gogh-sunflower-parlor-1a.lpp`.
- Runtime data: `live-projects/van-gogh-sunflower-parlor-1a.json`.
- Authored by project owner Yanxiang Qin in Lucas Visual Art Lab on
  2026-07-21 using immutable Function Brush revisions.
- The embedded 960×640 shell is byte-identical to
  `rooms/van-gogh-sunflower-parlor-shell-v6c.jpg` (SHA-256
  `07a8b1f37ceb1527b3139add528243d568fcdedf707c0faa525c67bc989f6388`).
- The imported `.lpp` SHA-256 is
  `3aa1db5eadb52115145a3a61a7ebbbdd67b428728477b638ca7ee2b3ef789489`.
- The browser receives 626 declarative marks, 5 bounded liquid masks and
  reviewed static adapters. The Function Brush source remains in the editable
  archive and is never shipped or dynamically executed by the game runtime.

## Owner-final Live Painting validation fixtures

The owner supplied the final 1A, 1B and 1C Art Lab archives on 2026-07-22 for
the single-Canvas migration. Their immutable checksums and content counts are
recorded in `content/live-projects/FINAL-FIXTURES.md`.

- Final 1A is now the editable source and generated runtime used by the Phase 1
  single-Canvas control page.
- The corrected 1B supplied on 2026-07-23 is the editable source at
  `content/live-projects/van-gogh-starry-studio-1b.lpp`; its generated runtime
  is ready for owner visual/mobile QA.
- Final 1C replaced the earlier runtime source at
  `content/live-projects/van-gogh-cypress-bedroom-1c.lpp`; its generated
  runtime is ready for owner visual/mobile QA.

The duplicate `final-fixtures/` copies remain immutable audit fixtures, not
browser assets. Archived Function Brush source is never copied into generated
runtime JSON or executed by Painterly Chameleon.

## Curated Live Painting project: Van Gogh 1B

- Editable audit source: `content/live-projects/van-gogh-starry-studio-1b.lpp`.
- Runtime data: `live-projects/van-gogh-starry-studio-1b.json`.
- Authored by project owner Yanxiang Qin in Lucas Visual Art Lab on
  2026-07-22 using immutable Function Brush revisions.
- The embedded 960×640 shell is byte-identical to
  `rooms/van-gogh-starry-studio-shell-v6a.jpg` (SHA-256
  `34684e067ca29b9219b00e6949463d70e5b6f7bbeab106f7f14063c708a2cbab`).
- The imported `.lpp` SHA-256 is
  `d567a1b07cc75e7e0ff925a592fa39c933730aae514f323f5a85aa9e0464ae15`.
- The browser receives 1,233 declarative marks and reviewed static Color
  Liquify Splash, directional Color Liquify Breakout and Stars/Twinkle
  adapters. Their source-derived pigments are prepared once and packed into
  one shared atlas.

## Curated Live Painting project: Van Gogh 1C

- Editable audit source: `content/live-projects/van-gogh-cypress-bedroom-1c.lpp`.
- Runtime data: `live-projects/van-gogh-cypress-bedroom-1c.json`.
- Authored by project owner Yanxiang Qin in Lucas Visual Art Lab on
  2026-07-22 using immutable Function Brush revisions.
- The embedded 960×640 shell is byte-identical to
  `rooms/van-gogh-cypress-bedroom-shell-v6a.jpg` (SHA-256
  `85f71fc3fd00b7c1436d1e38331c8f1a8c4aeff62f9807f3533137e1f05bf698`).
- The imported `.lpp` SHA-256 is
  `c5f646b6f4bdab6a09678b277096af0b1953cc1483fb60833a816ace6843f43f`.
- The browser receives 553 declarative marks, 2 bounded liquid masks and
  reviewed Growth, Firefly, Twinkle and feathered Liquid adapters. Function
  Brush source stays only in the editable archive.

## Active painterly Van Gogh House props

The Van Gogh House no longer displays the neutral Blender workbench rasters or
code-drawn furniture. The original 17 model sprites plus 11 instance-specific
sprites were generated specifically for the room, keyed on uniform magenta,
converted to alpha, edge-contracted, cropped, and resized to at most 384 px.
Runtime display remains tied to the
catalogued model footprint and feet pivot, so these are an art layer over the
same client/server collision contract—not unmodeled decoration.

The complete saved layout contains 27 props. Every placed prop resolves to a
distinct `v1` source PNG, including the Editor-created second writing chair.
Each placed prop also has independently painted `v2` and `v3` files, for 81
active prop sprites across the three surface sets. Repeated model families
never share the same runtime image, and no tint, shader or corner glaze is used
as a substitute for new artwork. A stable per-instance hash rolls `v1`/`v2`/`v3`
independently for every prop; it is intentionally decoupled from the A/B/C
shell selection and never changes placement or collision.

The 54 `v2`/`v3` variants and the copied chair's unique `v1` were generated on
2026-07-17 with OpenAI built-in Image Generation in reference-image edit mode.
Each prompt locked the source silhouette, camera, proportions, feet/contact
points and padding while asking only for a room-specific repaint: curated
gold/cobalt for Sunflower Parlor, nocturnal pigment wear for Starry Studio, and
quiet ochre/cornflower/sage for Cypress Bedroom. Outputs used a flat `#ff00ff`
background, were converted to RGBA with the standard soft-matte/despill helper,
and were resized to a maximum edge of 384 px. Source outputs remain in the
generation thread named at the top of this file.

The first ten instance-specific files were generated with OpenAI built-in Image
Generation on 2026-07-17:

- `props/van-gogh/instances/vg-bedroom-daybed-v1.png` — source
  `exec-cc86125d-a4de-400c-b077-01a4a341b973.png`.
- `props/van-gogh/instances/vg-bedroom-cabinet-v1.png` — source
  `exec-8ea3a172-afad-48a2-8518-593f42e45d4d.png`.
- `props/van-gogh/instances/vg-bedroom-chair-v1.png` — source
  `exec-a52abc1a-5026-4f95-b424-667248d0594c.png`.
- `props/van-gogh/instances/vg-bedroom-side-table-v1.png` — source
  `exec-0071c359-ac8c-4636-a80f-81d5760c62e2.png`.
- `props/van-gogh/instances/vg-bedroom-vase-v1.png` — source
  `exec-63f65a6e-bf64-431d-b0f5-d7bf81e97c91.png`.
- `props/van-gogh/instances/vg-bedroom-cypress-v1.png` — source
  `exec-72d9038b-9961-41ae-afea-f76de0a3b0fa.png`.
- `props/van-gogh/instances/vg-bedroom-lamp-v1.png` — source
  `exec-54972730-752c-4c25-95b2-8d611c03f171.png`.
- `props/van-gogh/instances/vg-studio-table-v1.png` — source
  `exec-b121eea5-3f9c-45a0-bca4-bc8e66f3f981.png`.
- `props/van-gogh/instances/vg-studio-easel-right-v1.png` — source
  `exec-c78355ab-38ca-4ab3-860c-744c7a4ed95b.png`.
- `props/van-gogh/instances/vg-studio-vase-v1.png` — source
  `exec-b0ba5f61-2caa-4ab1-afd9-a05c546395d7.png`.

The prompt set required one isolated object, the frozen 26-degree three-quarter
camera, late-19th-century impasto, no cast shadow, and a perfectly flat magenta
background. Bedroom prompts explicitly prohibited the Parlor's bright
cobalt/orange palette; Studio prompts required nocturnal pigment and charcoal
wear. The project used the standard chroma-key removal helper with soft matte,
despill and one-pixel edge contraction, followed by alpha-bounds cropping.

Shared prompt direction: one isolated period-appropriate object, fixed
three-quarter view from roughly 26 degrees above, late-19th-century
post-impressionist oil painting, thick directional impasto, cobalt contours,
ochre and pale-blue highlights, no smooth CGI, no cast/contact shadow, no text,
and a perfectly flat `#ff00ff` chroma background. The background-removal pass
used the installed Image Generation skill helper without color despill (which
incorrectly shifted ochre paint toward green), followed by a 1 px edge
contraction and alpha cleanup.

- `props/van-gogh/blue-settee-v1.png` — `exec-aa1af54b-6ee9-4621-942f-aeecb34e4beb.png`.
- `props/van-gogh/round-table-v1.png` — `exec-523ff6fa-4acd-44e2-9931-086d4b5ad489.png`.
- `props/van-gogh/rattan-chair-v1.png` — `exec-18a6067a-aacc-4b26-a57e-9e39c0ccc835.png`.
- `props/van-gogh/writing-table-v1.png` — `exec-1d52c963-1fa3-4289-8586-0d57e4769d6e.png`.
- `props/van-gogh/oak-chair-v1.png` — `exec-705111f4-d7f4-4f2c-be0b-88237c385322.png`.
- `props/van-gogh/sunflower-vase-v1.png` — `exec-b6775286-ef25-4a09-8259-71919f938e44.png`.
- `props/van-gogh/floor-lamp-v1.png` — `exec-ec6fd1d4-99f3-436a-bdf7-24e0721d115c.png`.
- `props/van-gogh/tripod-easel-v1.png` — `exec-61b29062-a005-486b-ad24-ec5d299bcbb4.png`.
- `props/van-gogh/painted-cabinet-v1.png` — `exec-5dd3c544-a657-4d5f-bf7d-d3069e1d5c95.png`.
- `props/van-gogh/round-stool-v1.png` — `exec-d67fcb1f-ee47-4efb-bc9e-dc8dcfa4f526.png`.
- `props/van-gogh/cypress-plant-v1.png` — `exec-7f5def24-7a4b-4820-8931-e33db860d7ae.png`.
- `props/van-gogh/paint-splashed-rug-v1.png` — `exec-2409f6ff-3d35-40b9-8f94-30be0371bb23.png`.
- `props/van-gogh/spilled-paint-kit-v1.png` — `exec-be88ba8c-7289-4d23-983f-91adbc1b3d9f.png`.
- `props/van-gogh/crumpled-sketches-v1.png` — `exec-11d58be4-0d3c-41a0-b731-dce00251ae8f.png`.
- `props/van-gogh/canvas-stack-v1.png` — `exec-018ba09d-8942-4193-8cd9-39fdd802bbce.png`.
- `props/van-gogh/painter-crate-v1.png` — `exec-589b924f-ef5a-4178-ade0-5a7ca33641b9.png`.
- `props/van-gogh/tall-brush-jar-v1.png` — `exec-8a2ca613-88ce-42d5-b380-5cd8d596ca6b.png`.

## Monet Garden House vertical slice

All phase-one Monet assets are original game art generated on 2026-07-17 with
OpenAI built-in Image Generation. No museum scan or specific Claude Monet
painting is embedded in these files. The three existing Van Gogh shell plates
were used only as project-owned geometry references so camera, doors, wall-floor
seams, and gameplay paths remained fixed; prompts explicitly requested a newly
composed impressionist environment rather than a reproduction.

Backgrounds were resized to 960 x 640 JPEG after generation:

- `rooms/monet-water-lily-conservatory-shell-v1.jpg` — source
  `exec-58b49c0b-d3d3-4e46-9d7d-957cb7c24cae.png`.
- `rooms/monet-giverny-sunroom-shell-v1.jpg` — source
  `exec-746a16c1-3f0f-4f05-868b-8363bb603580.png`.
- `rooms/monet-morning-mist-salon-shell-v1.jpg` — source
  `exec-343ec2e1-6692-408e-8144-b891341dc8bd.png`.

The Water Lily Conservatory prop pass preserved each verified model silhouette,
three-quarter camera, feet/contact points, open gaps, and padding while changing
the complete paint treatment. Sources used a flat `#ff00ff` chroma background,
then the standard soft-matte/despill helper with a one-pixel edge contraction;
alpha bounds were cropped with eight pixels of safety padding and resized to a
maximum 384 px edge:

- `props/monet/monet-water-settee-v1.png` —
  `exec-7a437b47-34bb-474f-97d5-074da9021c7e.png`.
- `props/monet/monet-writing-table-v1.png` —
  `exec-0e42917b-4774-4633-819f-c873814be106.png`.
- `props/monet/monet-conservatory-lamp-v1.png` —
  `exec-d6cbddfa-89db-4afe-b6f6-35a7a5ca4efa.png`.
- `props/monet/monet-lily-table-v1.png` —
  `exec-67323717-fd06-4760-bbe4-ad5c54bffc4c.png`.
- `props/monet/monet-willow-chair-v1.png` —
  `exec-b5d12d2b-6bc3-47fe-9c0d-c8b979a0f98a.png`.
- `props/monet/monet-giverny-chair-v1.png` —
  `exec-ec500a17-aeab-4d79-b8d2-65bfd10e373e.png`.
- `props/monet/monet-iris-vase-v1.png` —
  `exec-cdb54349-294a-4b0c-b98b-e0404564a75e.png`.

Shared asset constraints: original Monet-inspired broken color and coherent
upper-left daylight; no exact painting reproduction, people, text, logo,
watermark, cast shadow, new architecture, Van Gogh swirls, or magenta in the
subject.

## Legacy furnished Van Gogh references (not loaded at runtime)

These three plates were generated in the built-in `image_gen` mode as one
connected art-house set. The camera, rectangular shell, cobalt/ochre palette,
foreground rail, player scale, doorway scale, and directional impasto language
were locked across the set. The direction is an original historical-style
inspiration, not a copy of a specific painting. Every prompt forbade
characters, text, UI, logos, watermarks, deep black hiding regions, and props
that could fully cover the player.

- `rooms/van-gogh-sunflower-parlor.jpg` — source
  `exec-ade40917-3c06-42be-b7ae-025492e9a5d8.png`.
  Final prompt: production 2.5D game plate, fixed orthographic-like
  three-quarter top-down camera, original Van Gogh-inspired sunflower parlor
  in cobalt blue and warm gold directional impasto; richly furnished with
  patterned sofa, rugs, round table, desk, easel, lamps, books, vases, plants,
  and many sunflowers; winding player-scale walk lanes instead of an empty
  arena; substantial bottom foreground rail; one open player-scale doorway on
  the right that visually continues into the next room.
- `rooms/van-gogh-starry-studio.jpg` — source
  `exec-cad92a99-ea8c-421c-9f04-b961d45097cf.png`.
  Final prompt: matching second production plate using the reference camera,
  scale, shell, rail, palette, lighting, and impasto density; a night-blue
  painter's studio packed with worktables, pottery, brushes, two easels,
  cabinets, rugs, chaise, lamps, and flowers; readable winding walk lanes;
  matching player-scale open doorways on both left and right.
- `rooms/van-gogh-cypress-bedroom.jpg` — source
  `exec-34cdff28-7e9c-4709-ad48-6c1af1978cc4.png`.
  Final prompt: matching third production plate using both prior rooms as
  visual references; a warm cypress bedroom/study with blue-and-gold bed,
  writing desk, bookcase, rugs, tables, easel, lamps, flowers, pottery, and
  tall cypress plants; readable winding player-scale paths; one matching open
  doorway on the left; same foreground rail and no right exit.

These reference copies were resized to 1200 x 800 and encoded as quality-84 JPEGs.
The 1536 x 1024 PNG outputs remain in Codex's generated-image store.

## Earlier single-room style studies

These checked-in plates are retained for future Art House development but are
not currently offered by the portal map dropdown.

- `rooms/starry-studio.jpg` — directional-impasto studio; source
  `exec-a66ead44-417f-4806-94de-4836ba16cfe3.png`.
- `rooms/pointillist-garden.jpg` — optical-color garden pavilion; source
  `exec-047ea993-9874-46b0-b602-33bfd2962c5a.png`.
- `rooms/ink-wash-teahouse.jpg` — xuan-paper ink-wash tea pavilion; source
  `exec-8606c3e1-acc2-400a-a71c-8754ac2a0661.png`.
- `rooms/ukiyoe-bathhouse.jpg` — flat-color woodblock bathhouse; source
  `exec-2ea41e46-c29c-45ef-9da2-cf02b2a9000f.png`.

## Avatar pose masks

The standing mascot was generated as an original ivory chameleon-inspired
humanoid in a fixed three-quarter camera. Curl and flat were generated as
identity-preserving pose changes using the earlier outputs as references.
Every pose used a uniform green chroma background with no shadows. The
installed Image Generation skill's chroma-removal helper produced the final
RGBA PNGs. Runtime copies were then resized to 512 x 512; painting renders into
a 192 x 192 canvas, so this keeps clean mask edges without retaining oversized
decoded textures on iPad.

- `avatars/stand.png` — source `exec-638bebd1-c307-4061-9cfd-18221d850713.png`.
- `avatars/curl.png` — source `exec-ab5cae79-12d5-4920-b764-10c2747d8d3c.png`.
- `avatars/flat.png` — source `exec-f5535cd7-58bb-4978-8299-3a2b496f68db.png`.

The complete production prompt structure and invariants are also documented in
`docs/chameleon/GAME-DESIGN.md`, section 8.

## Outdoor Masters Journey

The Outdoor Masters Journey art house is original project game art imported
from Snake Lab at source commit `3feac00a6174`. It is an original outdoor
progression in a broad historical painting language, not a reproduction of a
specific painting or museum scan.

- `rooms/outdoor-triptych/*-shell-v1.jpg` — retained provenance/rollback room
  plates; `*-shell-v2.jpg` are the three runtime plates.
- `props/outdoor-triptych/*.png` — independent, transparent outdoor prop
  sprites; only the 13 props in the saved layout are active at runtime.
- `layouts/outdoor-triptych-layout-0.json` — copied byte-for-byte from source
  commit `06c9790` after the owner-authored 3C doorway/floor correction; it
  carries the authored props, floor polygons, spawn points and polygon portal
  triggers.

The detailed source IDs, prompt constraints, reference-image treatment and
asset-level provenance remain recorded in Snake Lab's
`docs/chameleon/OUTDOOR-TRIPTYCH.md`. This migration remains prototype content
pending the formal commercial review in
`content/art-houses/outdoor-masters-journey/provenance.json`.

## Color Rebirth

The three Color Rebirth plates and 58 transparent props are original game art
generated with built-in ImageGen for this project, then curated and
layout-authored in Snake Lab before being imported at source commit
`f74595c3ce6e3c970b1e407679d11acdc92b1f31`. They do not reproduce an
individual artist's work or a museum scan.

- `rooms/color-rebirth/color-rebirth-*-shell-v1.jpg` — original Ink Storm,
  Four Seasons, and Canvas Islands room plates; the latter two are the final
  cleanup plates from that source commit.
- `props/color-rebirth/*.png` — original matching easels, working clusters,
  seasonal tree, and floating-paper sprites. The 18 workstation asset families
  each carry V1/V2/V3 artwork; the 16 final layout instances select a stable
  variant from the challenge seed when one exists. The tree and floating-paper
  anchors intentionally remain V1-only.
- `layouts/color-rebirth-layout-0.json` — authored placements, door geometry,
  floor polygons, spawn positions, and two world-space collision barriers for
  the three connected rooms; copied byte-for-byte from the recorded source
  commit. Its inactive legacy transition-path assets remain in the ledger but
  are not loaded by the final layout.

Commercial release remains blocked pending the formal review recorded in
`content/art-houses/world-remembers-color/provenance.json`.

## The Tide Dreams in Starlight

The fifth art house was imported from Snake Lab source commit
`755206b894a0702d61a81743abd09ae5f403b809`. It has three connected 960 × 640
moonlit / dream-river / nebula plates and six placed props, each with three
independently repainted PNG skins selected by the challenge seed. The runtime
uses the final layout's floor geometry, polygon door entries, spawns and nine
irregular collision barriers; the barrier polygons are authored gameplay
geometry, not image-derived hit testing.

- `rooms/luminous-tide/luminous-tide-moon-garden-shell-v1.jpg` and
  `rooms/luminous-tide/luminous-tide-nebula-islands-shell-v1.jpg` —
  project-owned ImageGen cleanup workflows, selected with fixed room geometry.
- `rooms/luminous-tide/luminous-tide-dream-river-shell-v1.jpg` — accepted
  user-supplied project concept raster. Its exact source name and commercial
  rights check are retained in the provenance ledger rather than inferred.
- `props/luminous-tide/*.png` — six project-directed ImageGen prop families
  (`tide-moon-*`, `tide-dream-*`, `tide-nebula-*`), each processed through
  chroma removal, alpha cleanup and a reviewed V1/V2/V3 repaint workflow.
- `layouts/luminous-tide-layout-0.json` — copied byte-for-byte from the source
  commit; it is the authoritative placement, portal, floor, spawn and polygon
  collision contract.

This remains prototype content. Commercial release is blocked by the review
items in `content/art-houses/luminous-tide-dreamscape/provenance.json`.

## The Unfinished Morning

Migrated 2026-07-19 from Snake Lab commit
`bc48256f6b8ec23569ce9bb70049c672b3f31a12` (`Complete Unfinished Morning art
variants`). All assets are original productions from the project-owned
ImageGen workflow (fixed 960 × 640 three-quarter game camera; an original
humanist/handscroll synthesis, not a reproduction; text, UI, logos and
watermarks forbidden). Full per-file source ids live in the Snake Lab
`games/chameleon/client/assets/CREDITS.md` at that commit.

- `rooms/unfinished-morning/unfinished-morning-blank-canvas-shell-v{1,2,3}.jpg`
  — 6A Blank Canvas Morning; the three plates move finished color between the
  left portal/cypress, the willow-bench diagonal, and the right portal and
  foreground flowers while geometry stays fixed.
- `rooms/unfinished-morning/donors/unfinished-morning-liquid-donor-v1.jpg`
  — superseded project-generated 6A donor; retained for provenance only.
- `rooms/unfinished-morning/donors/unfinished-morning-blank-canvas-owner-donor-v2.jpg`
  — superseded owner-edited 6A Live donor, copied byte-for-byte from `6a.jpg`
  (SHA-256 `3772c49dfefff462efe09c379323f46590599a0c199947ef1aca3cdcd1a7e6ce`),
  960×640 JPEG. Retained for provenance only.
- `rooms/unfinished-morning/donors/unfinished-morning-blank-canvas-owner-donor-v3.jpg`
  — active 6A Live donor, copied byte-for-byte from owner-supplied `2.jpg`
  (SHA-256 `3158b1fb4176beaf46bf26d4f4f3f5d8a4d0f8db10eef9a036575907369c56e6`),
  960×640 JPEG. Runtime removes all white and near-white pixels from the Live
  layer, uses alpha-only edge transitions, and pairs it with fixed shell v1.
- `rooms/unfinished-morning/unfinished-morning-humanist-dome-shell-v{1,2,3}.jpg`
  — 6B Humanist Dome; a colored Creator reaches toward a graphite Adam while
  ~80% of the architecture returns to construction; the studies move color
  between the gesture, the central stairs/floor and the right vault.
- `rooms/unfinished-morning/donors/unfinished-morning-humanist-liquid-donor-v1.jpg`
  — user-supplied project-generated full-color 6B reference, resized from
  1536×1024 to 960×640 and JPEG encoded. Retained as the source reference; it
  is not used at runtime because it contains figures also composed by the game.
- `rooms/unfinished-morning/donors/unfinished-morning-humanist-live-background-v2.jpg`
  — OpenAI ImageGen precise-object edit of the preceding reference
  (`exec-67860791-f60b-4039-bbde-452f2f128848.png`) removing all people and
  reconstructing an empty architectural room; resized from 1536×1024 to
  960×640 and JPEG encoded. Retained as a superseded experiment and never used
  at runtime.
- `rooms/unfinished-morning/donors/unfinished-morning-humanist-color-restored-v3.jpg`
  — superseded 6B Live donor derived solely from
  `unfinished-morning-humanist-dome-shell-v1.jpg`, with no visual input from
  the owner-supplied full-color reference. The first safe background-only pass
  (`exec-3cdb4553-ca5b-43c7-900f-ef07ae3d8623.png`) restored the protected
  architectural region; a second color-completion pass
  (`exec-6795dd53-e96a-491c-bcd8-bb97961068fb.png`) completed the warm stone,
  dusty-blue sky and restrained fresco palette. Resized from 1536×1024 to
  960×640 and JPEG encoded; retained for provenance only.
- `rooms/unfinished-morning/donors/unfinished-morning-humanist-owner-donor-v4.jpg`
  — superseded owner-edited 6B Live donor, copied byte-for-byte from `6b.jpg`
  (SHA-256 `cd02d78d06fcb44aa9b5ace70595b134592977e3946fe4fc9e5b52d482855888`),
  960×640 JPEG. Retained for provenance only.
- `rooms/unfinished-morning/donors/unfinished-morning-humanist-owner-donor-v5.jpg`
  — active 6B Live donor, copied byte-for-byte from owner-supplied `1.jpg`
  (SHA-256 `72a2d42cff9a963cbd019b55af24ca576fd4372b3859997b4cdba025c2ce67cb`),
  960×640 JPEG. Runtime removes all white and near-white pixels from the Live
  layer, uses alpha-only edge transitions, and pairs it with fixed shell v1.
- `rooms/unfinished-morning/unfinished-morning-handscroll-shell-v{1,2,3}.jpg`
  — 6C Ten-Thousand-Forms Handscroll; mineral color travels as a moving
  viewpoint (balanced / left bridge into mountains / right bridge through the
  foreground garden) around a reserved-white central route.
- `rooms/unfinished-morning/donors/unfinished-morning-handscroll-liquid-donor-v1.jpg`
  — superseded OpenAI ImageGen tone-matched donor generated from the three 6C
  shells (`exec-eb39fdaf-69a7-4615-9710-9b23586c351d.png`), resized from
  1536×1024 to 960×640 and JPEG encoded. It preserves the shells' restrained
  blue-gray/celadon/paper palette; retained for provenance only.
- `rooms/unfinished-morning/donors/unfinished-morning-handscroll-owner-donor-v2.jpg`
  — superseded owner-edited 6C Live donor, copied byte-for-byte from `6c.jpg`
  (SHA-256 `30c40fc3d1fcd878ec12db9b003d23295181dd5e234d89ca9f0e0d3beb04b436`),
  960×640 JPEG. Retained for provenance only.
- `rooms/unfinished-morning/donors/unfinished-morning-handscroll-owner-donor-v3.jpg`
  — superseded 6C Live donor, copied byte-for-byte from owner-supplied `3.jpg`
  (SHA-256 `a91939c2271fe4f009fbfa8ac8078e5462e0db838c334616d4ba680864d62028`),
  960×640 JPEG. Retained for provenance only.
- `rooms/unfinished-morning/donors/unfinished-morning-handscroll-owner-donor-v4.jpg`
  — active 6C Live donor, copied byte-for-byte from owner-supplied `6cnew.jpg`
  (SHA-256 `9a2e0dd5a4f9caedb142ab340cfe5bd990474ceb3d9016aed3f3414357c7478c`),
  960×640 JPEG. Its seven owner-painted disconnected white regions are used
  directly as seven independent alpha-wave boundaries, without clustering.
  Runtime removes all white and near-white pixels from the Live layer and
  pairs the remaining color with fixed shell v1.
- `rooms/unfinished-morning/effects/unfinished-morning-fog-density-v1.png`
  — OpenAI ImageGen monochrome fog density source
  (`exec-61fa14c6-621a-4f7f-ad3a-e4b633b2319b.png`), downsampled from
  1536×1024 to 512×341. Runtime converts its black background to alpha once and
  previously supplied an irregular ivory/cool-shadow fog stamp. White fog is
  now disabled in every room; the asset is retained for provenance only.
- `props/unfinished-morning/unfinished-humanist-*.png` — four depth-sorted
  figure groups (Plato & Aristotle, Diogenes, Euclid, Raphael) on chroma
  plates → RGBA; V2/V3 change only unfinished garment regions, and reviewed
  rejects are intentional byte-identical copies of V1.
- `props/unfinished-morning/unfinished-scroll-{scholar-rock,stone-pavilion}-v1.png`
  — the two 6C garden anchors rebuilt as transparent runtime props.
- `layouts/unfinished-morning-layout-0.json` — copied byte-for-byte from the
  source commit; authoritative placement, portal, floor, spawn and polygon
  collision contract.

This remains prototype content. Commercial release is blocked by the review
items in `content/art-houses/unfinished-morning/provenance.json`.
