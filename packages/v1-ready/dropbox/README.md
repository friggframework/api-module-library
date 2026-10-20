# `@friggframework/api-module-dropbox`

Frigg v2 API module for the [Dropbox HTTP API](https://www.dropbox.com/developers/documentation/http/documentation).

## Auth

OAuth 2.0 authorization code with `token_access_type=offline` (refresh tokens).

| Detail | Value |
|---|---|
| Authorize | `https://www.dropbox.com/oauth2/authorize` |
| Token | `https://api.dropboxapi.com/oauth2/token` |
| RPC base | `https://api.dropboxapi.com/2` |
| Content base | `https://content.dropboxapi.com/2` |
| Identity | `POST /users/get_current_account` → `account_id` |

Configure via `.env.example` (`DROPBOX_CLIENT_ID`, `DROPBOX_CLIENT_SECRET`, `DROPBOX_SCOPE`, `REDIRECT_URI`).

## Covered surface

- Account: `getCurrentAccount`, `getSpaceUsage`
- Files/folders: `listFolder`, `listFolderContinue`, `getMetadata`, `createFolderV2`, `deleteV2`, `moveV2`, `copyV2`, `searchV2`
- Content: `downloadFile`, `uploadFile`
- Webhooks: App Console registration + `verifyWebhookSignature` / `handleWebhookChallenge` (no HTTP CRUD — Dropbox does not expose webhook management endpoints)

## Webhooks extension

`extensions/webhooks/` — Tier 3, `useDatabase: false`. Handles GET challenge echo and POST notifications signed with `X-Dropbox-Signature` (HMAC-SHA256 of the raw body using the app secret).

## Tests

```bash
cd packages/v1-ready/dropbox && npm test
```
