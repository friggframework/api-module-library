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
| Tickets | `listTickets`, `getTicket`, `createTicket`, `updateTicket`, `deleteTicket`, `listTicketComments` |
| Users | `listUsers`, `getUser`, `createUser`, `updateUser`, `deleteUser` |
| Organizations | `listOrganizations`, `getOrganization`, `createOrganization`, `updateOrganization`, `deleteOrganization` |
| Webhooks | `listWebhooks`, `getWebhook`, `createWebhook`, `updateWebhook`, `deleteWebhook`, `getWebhookSigningSecret` |

Inbound webhook verification lives under `extensions/webhooks/` (HubSpot-style Tier-3 bundle).

## Files

- `api.js` / `definition.js` / `index.js`
- `zendesk.openapi.yaml` — curated OpenAPI subset (1:1 with `api.js`)
- `zendesk.capabilities.json` — `capability-manifest/v0.1` (compared to lefthook-bots draft; unimplemented draft entries listed under `skipped`)
- `zendesk.fenestra.yaml` — Support app UI locations (ZAF)
- `tests/` — offline Jest (api, definition, spec-sync, webhooks)

## Develop

```bash
cd packages/v1-ready/zendesk
npm install
npm test
```
