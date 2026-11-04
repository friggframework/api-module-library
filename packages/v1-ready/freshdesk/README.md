# `@friggframework/api-module-freshdesk`

Frigg v2 API module for [Freshdesk](https://www.freshworks.com/freshdesk/) (Freshworks helpdesk).

## Auth

HTTP Basic with a per-agent **API key** as the username and the documented dummy password `X`:

```bash
curl -u YOUR_API_KEY:X -H "Content-Type: application/json" \
  https://YOUR_DOMAIN.freshdesk.com/api/v2/tickets
```

Find the key under **Profile picture → Profile settings**. Form fields: `domain`, `api_key`.

Docs: https://developers.freshdesk.com/api/#authentication

## Base URL

`https://{domain}.freshdesk.com/api/v2`

## Covered endpoints

| Method | HTTP |
|---|---|
| `getAccount` | `GET /account` |
| `getAuthenticatedAgent` | `GET /agents/me` |
| `listAgents` / `getAgent` | `GET /agents`, `GET /agents/{id}` |
| `listTickets` / `getTicket` / `createTicket` / `updateTicket` | tickets CRUD (no delete) |
| `listContacts` / `getContact` / `createContact` / `updateContact` | contacts CRUD (no delete) |
| `listCompanies` / `getCompany` / `createCompany` / `updateCompany` | companies CRUD (no delete) |

## Skipped

- **Webhook subscription REST** — outbound webhooks are Automation rule actions (Trigger Webhook / Trigger API), not a create/list/delete subscription API.
- Conversations / replies, deletes, and most admin resources — deferred.

## Files

- `api.js` / `definition.js` / `index.js` — Frigg `{ Api, Definition }` exports
- `freshdesk.openapi.yaml` — curated OpenAPI subset (Freshdesk publishes no official OpenAPI)
- `freshdesk.capabilities.json` — `capability-manifest/v0.1`
- `freshdesk.fenestra.yaml` — Freshworks Marketplace iframe placeholders (draft)

## Test

```bash
cd packages/v1-ready/freshdesk && npm test
```

Offline Jest only (HTTP methods stubbed). Live `frigg auth test .` needs sandbox credentials.
