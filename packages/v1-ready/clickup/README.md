# `@friggframework/api-module-clickup`

Frigg v2 API module for the [ClickUp](https://clickup.com) public REST API v2.

## Auth

| Detail | Value |
|---|---|
| Method | OAuth 2.0 authorization code (marketplace apps) |
| Authorize | `https://app.clickup.com/api?client_id=…&redirect_uri=…` |
| Token | `POST https://api.clickup.com/api/v2/oauth/token` (JSON: `client_id`, `client_secret`, `code`) |
| Data plane | `Authorization: Bearer {access_token}` (personal tokens: raw `pk_…`) |

Docs: https://developer.clickup.com/docs/authentication

## Covered surface

- Identity: authorized user + authorized workspaces (teams)
- Hierarchy: spaces, folders, lists (folder + folderless)
- Tasks: list / get / create / update
- Webhooks: create / list / update / delete + `verifyWebhookSignature`
- Tier 3 webhook receiver: `extensions/webhooks/`

## Files

| File | Role |
|---|---|
| `api.js` | `OAuth2Requester` client |
| `definition.js` | Frigg `Definition` |
| `clickup.openapi.yaml` | Curated OpenAPI subset (synced to Api methods) |
| `clickup.capabilities.json` | Capability manifest `v0.1` |
| `extensions/webhooks/` | HubSpot-shaped inbound webhook extension |

## Tests

```bash
cd packages/v1-ready/clickup && npm test
```

## Env

See `.env.example`.
