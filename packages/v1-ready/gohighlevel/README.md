# GoHighLevel API Module (`@friggframework/api-module-gohighlevel`)

A [Frigg](https://friggframework.org) API module for
[GoHighLevel](https://www.gohighlevel.com) / LeadConnector API v2. It wraps the
Marketplace OAuth REST API so a Frigg integration can manage contacts,
businesses, opportunities, locations, users, and inbound Marketplace webhooks.

Integrations consume it the standard Frigg way:

```javascript
const contacts = await this.gohighlevel.api.listContacts({ limit: 20 });
const deal = await this.gohighlevel.api.getOpportunity(opportunityId);
```

## Authentication

GoHighLevel Marketplace apps use **OAuth 2.0 Authorization Code** with
**Location-scoped** tokens:

| Step | URL |
|---|---|
| Authorize | `https://marketplace.gohighlevel.com/v2/oauth/chooselocation` |
| Token / refresh | `https://services.leadconnectorhq.com/oauth/token` |

- Send `user_type=Location` on code exchange **and** refresh.
- Do **not** send `scope` on the token exchange (belongs to authorize only).
- Refresh tokens are **single-use and rotate** — persist every new `refresh_token`.
- Identity / entity key: `locationId` from the token response.
- Every API call needs the `Version` header (default `2021-07-28`).

Set `GOHIGHLEVEL_CLIENT_ID`, `GOHIGHLEVEL_CLIENT_SECRET`, `GOHIGHLEVEL_SCOPE`,
and redirect URI (see `.env.example`).

## API Methods (curated)

| Method | HTTP | Purpose |
|---|---|---|
| `getLocation` | `GET /locations/{id}` | Sub-account details |
| `listUsers` / `getUser` | `GET /users/` … | Users |
| `listContacts` / `getContact` / `createContact` / `updateContact` | `/contacts/` | Contacts CRUD |
| `getDuplicateContact` | `GET /contacts/search/duplicate` | Duplicate lookup |
| `listContactNotes` / `createContactNote` / `updateContactNote` | `/contacts/{id}/notes` | Notes |
| `listBusinesses` / `getBusiness` / `createBusiness` / `updateBusiness` | `/businesses` | Businesses |
| `listOpportunities` | `GET /opportunities/search` | Search / list deals |
| `getOpportunity` / `createOpportunity` / `updateOpportunity` | `/opportunities` | Opportunity CRUD |
| `updateOpportunityStatus` | `PUT /opportunities/{id}/status` | Status change |
| `listPipelines` | `GET /opportunities/pipelines` | Pipelines |

Webhook **subscription** CRUD is not offered on the public REST API for
Marketplace apps — configure the webhook URL and events in the Marketplace app
UI. Inbound delivery is handled by `extensions/webhooks` (Ed25519
`X-GHL-Signature` verification).

## Docs

- https://marketplace.gohighlevel.com/docs/
- https://marketplace.gohighlevel.com/docs/Authorization/Scopes
- https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide

## Tests

```bash
cd packages/v1-ready/gohighlevel && npm test
```
