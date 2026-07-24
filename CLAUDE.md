# Claude Code handoff

Read `AGENTS.md` first, then `docs/DECISIONS.md` and `docs/MONETIZATION-BUILD.md` (current money/distribution plan). Completed/superseded plans live in `docs/archive/`.

## Current phase

The repository contains a deliberately small foundation playtest deployed as one Cloudflare Worker:

- Static client: `public/`
- Worker API: `src/worker.js`
- Pure validation helpers: `src/core.js`
- D1 migrations: `migrations/`
- Deployment config: `wrangler.jsonc`

The abstract painted-tile board validates the async Hider → share → many Seekers loop. It is disposable UI, not the final game or art direction.

## Important boundary

Do not copy or refactor the Snake Lab Chameleon game yet. Its owner is actively changing it. When migration is explicitly requested, inspect its Git status and migrate selected modules only; never overwrite or clean the Snake Lab working tree.

## Commands

```bash
npm install
npm run db:migrate:local
npm run dev
npm run check
```

Production deployment and remote migrations affect external state. Confirm the intended change, then use:

```bash
npm run db:migrate:remote
npm run deploy
```

## Invariants

- Canonical origin: `https://pc.lucasacademy.org`
- API prefix: `/api`
- Dedicated database: `painterly-chameleon-prod`
- Challenge lifetime: exactly 86,400 seconds
- API enforces expiry synchronously; Cron only performs physical cleanup
- Hider key must never appear in the Seeker share URL
- No accounts, free text, ads, analytics SDKs, payment, WebSockets or platform SDKs in this phase
