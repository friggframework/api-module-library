# Close CRM API Module (`@friggframework/api-module-close`)

A [Frigg](https://friggframework.org) API module for [Close](https://close.com)
CRM (REST API v1). It wraps leads, contacts, opportunities, activities
(calls / emails / notes), users, custom fields, and webhook subscriptions.

```javascript
const me = await this.close.api.getMe();
const { data: leads } = await this.close.api.listLeads({ _limit: 50 });
const { data: opps } = await this.close.api.listOpportunities({
    lead_id: leads[0].id,
});
```

## Authentication

Close supports two official methods
([docs](https://developer.close.com/api/overview.md)):

1. **OAuth 2.0** (recommended for multi-customer) — authorize at
   `https://app.close.com/oauth2/authorize/`, exchange at
   `https://api.close.com/oauth2/token/`, call API with
   `Authorization: Bearer <access_token>`. Scopes granted to all OAuth apps:
   `all.full_access offline_access`.
2. **API key** — HTTP Basic with the key as username and an empty password
   (`Authorization: Basic base64(api_key:)`).

- **Base URL:** `https://api.close.com/api/v1`
- Env vars: see `.env.example` (`CLOSE_CLIENT_ID`, `CLOSE_CLIENT_SECRET`,
  `CLOSE_API_KEY`, `REDIRECT_URI`).

## Sources of truth

| Artifact | Source |
|---|---|
| Endpoints / schemas | Official OpenAPI (experimental): https://api.close.com/api/openapi.json |
| Human docs | https://developer.close.com/ |
| Curated module spec | `./close.openapi.yaml` (subset; one `operationId` per `Api` method) |
| Capabilities | `./close.capabilities.json` (`capability-manifest/v0.1`) |
| Canonical mappings | `./mappings/{company,contact,deal}.js` → `business@1`, **UNVALIDATED** |
| UI (Fenestra draft) | `./close.fenestra.yaml` (Integration Links) |

## API methods (curated)

| Method | HTTP | Purpose |
|---|---|---|
| `getMe` | `GET /me/` | Current user + organizations |
| `listUsers` / `getUser` | `GET /user/` | Org users |
| `listLeads` / `getLead` / `createLead` / `updateLead` | `/lead/` | Companies/orgs |
| `listContacts` / `getContact` / `createContact` / `updateContact` | `/contact/` | People |
| `listOpportunities` / `getOpportunity` / `createOpportunity` / `updateOpportunity` | `/opportunity/` | Deals |
| `listActivities` | `GET /activity/` | All activity types |
| `listCalls` / `getCall` / `createCall` | `/activity/call/` | Calls |
| `listEmails` / `getEmail` | `/activity/email/` | Emails |
| `listNotes` / `getNote` / `createNote` | `/activity/note/` | Notes |
| `listLeadCustomFields` / `listContactCustomFields` / `listOpportunityCustomFields` | `/custom_field/…/` | Custom field defs |
| `getCustomFieldSchema` | `GET /custom_field_schema/{object_type}/` | Field schema |
| `listWebhooks` / `getWebhook` / `createWebhook` / `updateWebhook` / `deleteWebhook` | `/webhook/` | Subscriptions |

Skipped (available in vendor OpenAPI, not wired here): CRM object deletes,
SMS/WhatsApp/meetings/custom activities, tasks, files, smart views, reports,
integration_link CRUD (documented in Fenestra only), event log, and most
write endpoints beyond the table above.

## Webhooks

`extensions/webhooks` follows the HubSpot two-phase pattern (`useDatabase: false`
receiver → resolve → bound handler). Close signs deliveries with
`close-sig-hash` / `close-sig-timestamp` (HMAC-SHA256 over `timestamp + body`
using the hex `signature_key` from `createWebhook`).

## Mappings (ADR-057)

`extensions.mapping` exports UNVALIDATED `business@1` maps:

- **Lead → Company** (`mappings/company.js`)
- **Contact → Contact** (`mappings/contact.js`)
- **Opportunity → Deal** (`mappings/deal.js`) with Apideck-style
  `lossReason` / `lossReasonId` / `wonReason` / `wonReasonId` via
  `status_type` conditionals (Close has no dedicated reason catalog fields).

## Tests

```bash
cd packages/v1-ready/close && npm test
```

Offline Jest suite: `api.test.js`, `definition.test.js`, `spec-sync.test.js`.
`frigg auth test .` needs sandbox credentials (not included).
