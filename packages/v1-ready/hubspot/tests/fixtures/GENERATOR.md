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

Freshness also uses a concrete max-age-days constant (currently 90),
marked PENDING_ARCHITECT in scripts/ci/hubspot-4a-policy.cjs, plus the
API-version pins above. Both are required.
