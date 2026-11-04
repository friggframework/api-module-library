# Segment API Module (`@friggframework/api-module-segment`)

A [Frigg](https://friggframework.org) API module for [Twilio Segment](https://segment.com)
— Public API (workspace resources) and Unify Profile API (user/account traits,
events, external IDs). Demand-source CDP connector.

```javascript
const { data } = await this.segment.api.listSources({
    pagination: { count: 50 },
});
const traits = await this.segment.api.getProfileTraits('user_id:123');
```

## Authentication

| Surface | Auth | How to mint |
|---|---|---|
| **Public API** | `Authorization: Bearer <token>` | Settings → Access Management → Tokens ([docs](https://docs.segmentapis.com/tag/Authentication/)) |
| **Profile API** | HTTP Basic, token as username, empty password | Unify → Unify settings → API access ([docs](https://www.twilio.com/docs/segment/unify/profile-api)) |

Base URLs (US defaults; EU hosts documented by Segment):

- Public: `https://api.segmentapis.com`
- Profile: `https://profiles.segment.com/v1/spaces/{spaceId}`

## Sources

- Public API docs + OpenAPI **73.6.0**: https://docs.segmentapis.com/
- Profile API: https://www.twilio.com/docs/segment/unify/profile-api
- Curated Public API contract: `segment.openapi.yaml` (Profile methods omitted — different host/auth)
- Capability manifest: `segment.capabilities.json` (`capability-manifest/v0.1`)
- ADR-057 mappings (`business@1`, **UNVALIDATED**): `mappings/contact.js`, `mappings/company.js` via `extensions.mapping`

## API methods (READ-first)

### Public API

| Method | HTTP |
|---|---|
| `getWorkspace` | `GET /` |
| `listSources` / `getSource` | `GET /sources`, `GET /sources/{id}` |
| `listConnectedDestinationsFromSource` | `GET /sources/{id}/connected-destinations` |
| `listDestinations` / `getDestination` | `GET /destinations`, `GET /destinations/{id}` |
| `listSubscriptionsFromDestination` / `getSubscriptionFromDestination` | `GET /destinations/{id}/subscriptions[...]` |
| `listWarehouses` / `getWarehouse` | `GET /warehouses`, `GET /warehouses/{id}` |
| `listTrackingPlans` / `getTrackingPlan` | `GET /tracking-plans`, `GET /tracking-plans/{id}` |
| `listFunctions` / `getFunction` | `GET /functions`, `GET /functions/{id}` |
| `listSpaces` | `GET /spaces` |

### Profile API

| Method | Path |
|---|---|
| `getProfileTraits` | `.../collections/users/profiles/{externalId}/traits` |
| `getProfileEvents` | `.../collections/users/profiles/{externalId}/events` |
| `getProfileExternalIds` | `.../collections/users/profiles/{externalId}/external_ids` |
| `getAccountProfileTraits` | `.../collections/accounts/profiles/{externalId}/traits` |

## Webhooks

Inbound handling for **Webhooks (Actions)** (or a Destination Function that
POSTs the same payload) lives under `extensions/webhooks/`. Signature:
`X-Signature` = hex-encoded HMAC-SHA1(shared secret, raw body).

## Fenestra

No `segment.fenestra.yaml`. Segment’s extension surfaces for this connector are
API + Destination Functions / Webhooks Actions — not an embeddable first-party
UI SDK (unlike Slack Block Kit or HubSpot UI extensions).

## Tests

```bash
cd packages/v1-ready/segment && npm test
```
