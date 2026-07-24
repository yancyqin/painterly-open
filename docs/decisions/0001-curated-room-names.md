# Decision 0001: searchable names without public free text

Date: 2026-07-18

## Decision

Every challenge receives a two-word English room name made from one adjective
and one noun in a reviewed, kid-friendly vocabulary. Hiders may shuffle the
combination, but cannot type or publish arbitrary text.

Explore supports case-insensitive prefix search against a normalized,
indexed `room_name_search` column. Search results still obey the 24-hour TTL,
public-listing and moderation filters.

## Why

Names make a hide easy to find and say aloud in a family, classroom or group
chat. A constrained vocabulary keeps that benefit without opening a public
free-text surface for profanity, personal names, contact details or links.

## Consequences

- Room names are deliberately English in every locale so the same spoken name
  works across devices and platforms.
- Names are not unique. Search can return more than one active challenge with
  the same combination; art-house thumbnail and remaining time disambiguate.
- Adding words requires a reviewed code change. It is not a database or admin
  content-entry feature.
- The validation dataset is cleared by migration `0006` because existing
  challenges predate the naming contract and expire within 24 hours anyway.
