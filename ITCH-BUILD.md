# Painterly Chameleon — itch sampler

This repository is the **three-house itch sampler**. It is deliberately
separate from the full website and has no deploy script or production route.

## Local game with its API

```bash
npm ci
npm run dev:itch:worker
```

Open `http://localhost:8788`. This uses local Worker/D1 bindings, so the
normal create, share and seek paths can be exercised without contacting the
production site.

To test the same cross-origin path that itch uses, keep that Worker running in
one terminal and start the static client in another:

```bash
npm run dev:itch:client
```

Open `http://localhost:4173`. This client talks to the Worker on port 8788
with `X-PC-Session`, not a cookie.

## Static itch package

```bash
npm run package:itch
```

This produces `painterly-chameleon-itch.zip`. The ZIP contains only:

- Van Gogh House
- Monet Garden House
- Outdoor Masters Journey

It does not contain the later houses or their art assets. The package uses
relative asset paths so itch can extract it in an iframe directory.

## Before uploading the playable build

The static package uses the itch API adapter: its challenge API targets the
canonical Worker with explicit CORS and a cookie-independent anonymous session.
Before production upload, set `VITE_API_ORIGIN=https://pc.lucasacademy.org`
when packaging and set the exact itch iframe origin in the Worker
`ITCH_ALLOWED_ORIGINS` variable. The Turnstile site key must also allow that
iframe hostname before publishing a build that can create challenges.

Keep the itch project in Draft until those production settings have been
verified from its preview page.
