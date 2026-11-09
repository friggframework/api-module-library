# Synthetic fixture generator

These fixtures are generator-built doubles. They were not captured from a
live HubSpot account and have no capture chain.

- Origin: `synthetic`
- Tool: manual transcription from official HubSpot developer documentation
- Command: none (no generator program; JSON examples were transcribed by hand)
- When: 2026-11-09, America/New_York
- Operator: Frigg Module Builder (local prep; not a live provider session)
- Docs retrieved: see each fixture's `sourceDocUrl` and `sourceDocRetrievedAt` in provenance.json

Freshness is tied to the provider API version and endpoint each fixture was
transcribed against. Those contracts must continue to match
`packages/v1-ready/hubspot/api.js` (`tokenUri`, `URLs.access_token`,
`URLs.tokenIntrospect`, `URLs.userDetails`, `URLs.contacts`). A version or
endpoint mismatch fails 4a (rev1 §4.1 / T-C4-9).

Freshness uses the adopted `FRESHNESS_MAX_AGE_DAYS = 90` bound
(Architect-pinned in rev2 §P2-FRESHNESS) AND the API-version pins above.
Both are required. Synthetic fixtures are not on the 90-day clock; they
still require the API-version pin.
