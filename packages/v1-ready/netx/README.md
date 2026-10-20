# @friggframework/api-module-netx

Frigg v2 API module for [NetX](https://www.netx.net/) Digital Asset Management.

Talks to the per-tenant JSON-RPC API documented at [developer.netx.net](https://developer.netx.net/).

## Auth

OAuth 2 authorization-code against the customer's NetX instance. Requests use:

```http
Authorization: apiToken <access_token>
```

At connect time the user supplies their instance URL (`baseUrl`, e.g. `https://acme.netx.net`).

## Covered surface

| Method | NetX API |
| --- | --- |
| `getSelf` | JSON-RPC `getSelf` |
| `getAssets` / `getAssetsByFolder` / `getAssetsByQuery` / `updateAsset` | assets |
| `importAsset` | `POST /api/import/asset` |
| `createFolder` / `getFolderById` / `getFoldersByParent` | folders |
| `setWebhook` / `getWebhooks` / `deleteWebhook` | webhooks |

See `netx.openapi.yaml` and `netx.capabilities.json` for the curated subset.

## Test

```bash
cd packages/v1-ready/netx && npm test
```
