# `@friggframework/api-module-airtable`

Frigg API module for the [Airtable Web API](https://airtable.com/developers/web/api/introduction).

## Auth

- **OAuth 2.0** authorization-code + **PKCE (S256)** for third-party / marketplace connections.
- Token URL: `https://airtable.com/oauth2/v1/token` (HTTP Basic + form body).
- Authorize URL: `https://airtable.com/oauth2/v1/authorize`.
- Personal access tokens also work as `Authorization: Bearer` when passed as `access_token` (no refresh).

Register an OAuth integration at [airtable.com/create/oauth](https://airtable.com/create/oauth). Production use requires Terms of Service URL, Privacy Policy URL, and Support Email.

Recommended scopes (space-delimited in `AIRTABLE_SCOPE`):

```
data.records:read data.records:write schema.bases:read webhook:manage user.email:read
```

## Covered endpoints

| Method | Path |
|--------|------|
| `getWhoami` | `GET /meta/whoami` |
| `listBases` | `GET /meta/bases` |
| `getBaseSchema` | `GET /meta/bases/{baseId}/tables` |
| `listRecords` | `GET /{baseId}/{tableIdOrName}` |
| `getRecord` | `GET /{baseId}/{tableIdOrName}/{recordId}` |
| `createRecords` | `POST /{baseId}/{tableIdOrName}` |
| `updateRecord` | `PATCH /{baseId}/{tableIdOrName}/{recordId}` |
| `updateRecords` | `PATCH /{baseId}/{tableIdOrName}` |
| `deleteRecord` | `DELETE /{baseId}/{tableIdOrName}/{recordId}` |
| `listWebhooks` | `GET /bases/{baseId}/webhooks` |
| `createWebhook` | `POST /bases/{baseId}/webhooks` |
| `deleteWebhook` | `DELETE /bases/{baseId}/webhooks/{webhookId}` |
| `refreshWebhook` | `POST /bases/{baseId}/webhooks/{webhookId}/refresh` |
| `listWebhookPayloads` | `GET /bases/{baseId}/webhooks/{webhookId}/payloads` |
| `toggleWebhookNotifications` | `POST /bases/{baseId}/webhooks/{webhookId}/enableNotifications` |

Skipped (not required for core sync): comments, create/update base/table/field, attachment upload, Sync CSV, SCIM, enterprise collaborator APIs.

## Webhooks

Airtable sends a small notification ping to `notificationUrl`; clients then call `listWebhookPayloads`. Store `macSecretBase64` from `createWebhook` to verify `X-Airtable-Content-MAC`. Webhooks expire after 7 days unless refreshed.

See `extensions/webhooks/` for the Tier-3 receiver (HubSpot-shaped).

## Local test

```bash
cd packages/v1-ready/airtable
npm install
npm test
```

## Env

See `.env.example`.
