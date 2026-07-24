# Repository Instructions

## Product source of truth

This repository is the commercial, single-game source of truth for Painterly Chameleon. Snake Lab remains an educational portal and must not be a runtime dependency.

## Product invariants

- The default game is asynchronous: one Hider publishes one challenge for many Seekers.
- A published challenge has a hard 24-hour lifetime.
- The Seeker timer starts only after required assets load and the Seeker explicitly begins.
- Seekers never have to purchase a room to play an invitation. The Hider's entitlement authorizes the challenge.
- The first art house is free.
- No ads, public gallery, chat, public profiles, or free-text challenge titles in the MVP.
- Do not add Code Brush.
- Do not add WebSockets unless a separately approved live mode requires them.
- Do not introduce coins or consumable currency in the MVP. Creative brushes may be included or earned without a currency system.

## Data and privacy

- Enforce challenge expiry at read time; scheduled deletion is cleanup, not the access-control boundary.
- Delete challenge payloads and individual attempts after 24 hours.
- Purchase, refund, and entitlement records are durable and must not share the challenge TTL.
- Use high-entropy invitation tokens and store token hashes where practical.
- Avoid collecting names, email addresses, chat, precise location, or birth dates from Seekers.
- Never put secrets, access tokens, signing keys, or payment credentials in committed files. Resource IDs may appear only in explicit environment-specific deployment config when the platform requires them.

## Content

- Every production asset needs a provenance entry: creator/source, work date, source URL, license/terms snapshot, modifications, and reviewer.
- Public-domain status of an underlying artwork does not automatically grant commercial rights to a modern scan or photograph.
- Artist names, house names, copy, logos, and visual identity require separate clearance.
- After initial extraction, shared art-house content flows from this repository to Snake Lab through an explicit export step.

## Infrastructure

- MVP target: Cloudflare Worker plus a dedicated D1 database in the existing Cloudflare account.
- Do not reuse the Lucas Academy physical database.
- Static art belongs in versioned static assets/CDN storage, not D1.
- Render is a fallback for a future realtime service, not an MVP dependency.

## Change discipline

- Keep platform SDKs behind adapters; game rules must not depend on Discord, itch.io, Poki, or CrazyGames.
- Add a decision record before changing an invariant above.
- Do not deploy, create paid services, publish stores, or make a repository public without explicit owner approval.
