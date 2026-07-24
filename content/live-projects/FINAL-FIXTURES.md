# Owner-final Live Painting fixtures

These archives are the owner-authored visual source of truth for the single-Canvas migration. Preserve them byte-for-byte. Do not replace them with reconstructed test projects, and do not rewrite them in place during format migration.

| Room | Repository source | Archive SHA-256 | Shell SHA-256 | Final content | Runtime status |
| --- | --- | --- | --- | --- | --- |
| 1A Sunflower Parlor | `van-gogh-sunflower-parlor-1a.lpp` | `3aa1db5eadb52115145a3a61a7ebbbdd67b428728477b638ca7ee2b3ef789489` | `07a8b1f37ceb1527b3139add528243d568fcdedf707c0faa525c67bc989f6388` | 626 marks, 17 strokes, 5 warps | Runtime imported; owner-approved |
| 1B Starry Studio correction | `van-gogh-starry-studio-1b.lpp` | `d567a1b07cc75e7e0ff925a592fa39c933730aae514f323f5a85aa9e0464ae15` | `34684e067ca29b9219b00e6949463d70e5b6f7bbeab106f7f14063c708a2cbab` | 1,233 marks, 88 strokes, 0 warps | Correction imported; owner QA pending |
| 1C Cypress Bedroom | `van-gogh-cypress-bedroom-1c.lpp` | `c5f646b6f4bdab6a09678b277096af0b1953cc1483fb60833a816ace6843f43f` | `85f71fc3fd00b7c1436d1e38331c8f1a8c4aeff62f9807f3533137e1f05bf698` | 553 marks, 15 strokes, 2 warps | Final runtime imported; owner QA pending |

All three archives use `lucas-live-painting-project` v1, `artlab-live-doc` v3, and a 960×640 stage. Their embedded shells are byte-identical to the mapped game room assets.

The pre-correction 1B archive remains unchanged at
`final-fixtures/van-gogh-starry-studio-1b.lpp`. The corrected owner archive is
preserved separately at
`final-fixtures/van-gogh-starry-studio-1b-correction.lpp`.

The `.lpp` files are editable/audit sources and may contain Function Brush source. Browser builds must receive only importer-generated declarative data and explicitly reviewed static adapters.
