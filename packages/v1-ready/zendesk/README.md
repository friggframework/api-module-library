# `@friggframework/api-module-zendesk`

Frigg v2 API module for the [Zendesk Support (Ticketing) API](https://developer.zendesk.com/api-reference/ticketing/introduction/).

## Auth

OAuth 2.0 authorization-code against the account subdomain:

- Authorize: `https://{subdomain}.zendesk.com/oauth/authorizations/new`
- Token: `https://{subdomain}.zendesk.com/oauth/tokens` (JSON body)
- API: `Authorization: Bearer {access_token}` on host `https://{subdomain}.zendesk.com` (official OAS server template `https://{subdomain}.{domain}.com`), paths under `/api/v2/...`

The auth form collects the Zendesk **subdomain** before redirect. See `.env.example`.

For marketplace / multi-account distribution Zendesk requires a **global OAuth client** ([docs](https://developer.zendesk.com/documentation/marketplace/building-a-marketplace-app/set-up-a-global-oauth-client/)).

## Covered surfaces

| Area | Methods |
|---|---|
| Identity | `getCurrentUser` |
| Tickets | `listTickets`, `getTicket`, `createTicket`, `updateTicket`, `addTicketComment`, `deleteTicket`, `listTicketComments`, `searchTickets` |
| Ticket fields | `listTicketFields`, `getTicketField` |
| Incremental exports | `listIncrementalTickets` (cursor), `listIncrementalUsers` (cursor), `listIncrementalOrganizations` (time-based) |
| Users | `listUsers`, `getUser`, `createUser`, `updateUser`, `deleteUser` |
| Organizations | `listOrganizations`, `getOrganization`, `createOrganization`, `updateOrganization`, `deleteOrganization` |
| Groups | `listGroups` |
| Webhooks | `listWebhooks`, `getWebhook`, `createWebhook`, `updateWebhook`, `deleteWebhook`, `getWebhookSigningSecret`; `Api.verifyWebhookSignature` (static) |

List helpers accept cursor aliases (`pageSize` / `after` / `before` → `page[size]` / `page[after]` / `page[before]`). HTTP 429 responses honor Zendesk's `Retry-After` header (seconds) on top of the core Requester back-off ladder.

Inbound webhook verification lives under `extensions/webhooks/` (HubSpot-style Tier-3 bundle).

Canonical mapping: `mappings/ticket.js` maps Zendesk tickets onto a Merge-aligned Ticket under `support@1` via `extensions.mapping` (**UNVALIDATED** until the Frigg canonical registry exists; ADR-057).

## Files

- `api.js` / `definition.js` / `index.js`
- `mappings/ticket.js` — ADR-057 Ticket mapping (`support@1`, UNVALIDATED)
- `zendesk.openapi.yaml` — curated OpenAPI subset (1:1 with `api.js`)
- `zendesk.capabilities.json` — `capability-manifest/v0.1` (covers lefthook-bots draft capabilities)
- `zendesk.fenestra.yaml` — Support app UI locations (ZAF)
- `tests/` — offline Jest (api, definition, spec-sync, mapping, webhooks)

## Develop

```bash
cd packages/v1-ready/zendesk
npm install
npm test
```
