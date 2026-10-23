# `@friggframework/api-module-etsy`

Frigg v2 API module for the **Etsy Open API v3**.

## Auth

- OAuth 2.0 Authorization Code + **PKCE (S256)**
- Authorize: `https://www.etsy.com/oauth/connect`
- Token / refresh: `https://api.etsy.com/v3/public/oauth/token`
- Every API request: `x-api-key: <ETSY_KEYSTRING>:<ETSY_SHARED_SECRET>`
- Scoped requests: `Authorization: Bearer <access_token>`

Env:

| Variable | Purpose |
|---|---|
| `ETSY_KEYSTRING` | App API keystring (`client_id`) |
| `ETSY_SHARED_SECRET` | Shared secret (`client_secret`) |
| `ETSY_SCOPE` | Space-separated scopes |
| `ETSY_REDIRECT_URI` | Registered HTTPS redirect URI |
| `ETSY_WEBHOOK_SIGNING_SECRET` | Portal `whsec_…` for inbound webhooks |

## Sources

- Authentication: https://developers.etsy.com/documentation/essentials/authentication
- Reference: https://developers.etsy.com/documentation/reference/
- Webhooks: https://developers.etsy.com/documentation/essentials/webhooks
- Official OAS: https://www.etsy.com/openapi/generated/oas/3.0.0.json

## Webhooks

Inbound delivery + signature verification live under `extensions/webhooks/`.
**Subscription CRUD is portal-only** (Developer Portal → Webhook portal); there
is no webhook management surface in the official OpenAPI.

## Canonical mappings (ADR-057)

None. Etsy's core objects (Shop, Listing, Receipt/order, Transaction, Payment)
are marketplace inventory and order primitives. They do not map cleanly onto
`business@1` Company / Contact / Deal (or support@1 / billing@1) without
inventing fields, so mappings are omitted per ADR-057.

## Fenestra

None. Etsy does not expose third-party UI extension points (cards, iframes, or
in-admin components) comparable to HubSpot UI Extensions or Close Integration
Links. Webhook endpoints are configured in the Developer Portal, not as
in-product UI.

## Test

```bash
cd packages/v1-ready/etsy && npm test
```
