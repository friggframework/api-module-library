# `@friggframework/api-module-dropbox`

Frigg v2 API module for the [Dropbox HTTP API](https://www.dropbox.com/developers/documentation/http/documentation).

## Auth

OAuth 2.0 authorization code with `token_access_type=offline` (refresh tokens). Refresh responses that omit `refresh_token` are handled by `@friggframework/core` `OAuth2Requester.setTokens` (preserves the existing refresh token — same intent as the v1 custom refresh).

| Detail | Value |
|---|---|
| Authorize | `https://www.dropbox.com/oauth2/authorize` |
| Token | `https://api.dropboxapi.com/oauth2/token` |
| RPC base | `https://api.dropboxapi.com/2` |
| Content base | `https://content.dropboxapi.com/2` |
| Identity | `POST /openid/userinfo` → `sub` (account_id); fallback `get_current_account` |

Configure via `.env.example` (`DROPBOX_CLIENT_ID`, `DROPBOX_CLIENT_SECRET`, `DROPBOX_SCOPE`, `REDIRECT_URI`).

## Covered surface

- Identity: `getUserDetails` (OpenID), `getCurrentAccount`, `getSpaceUsage`
- Files/folders: `listFolder`, `listFolderContinue`, `getMetadata`, `createFolderV2`, `deleteV2`, `moveV2`, `copyV2`, `searchV2`
- Sharing: `listSharedFolders`, `listSharedFoldersContinue`
- Content: `downloadFile`, `uploadFile`
- Webhooks: App Console registration + `verifyWebhookSignature` / `handleWebhookChallenge` (no HTTP CRUD — Dropbox does not expose webhook management endpoints)

## Credits / lineage

Ported into Frigg v2 shape from Left Hook’s earlier v1 module (`lefthookhq/dropbox--frigg`). Manager/model code was not copied.

## Webhooks extension

`extensions/webhooks/` — Tier 3, `useDatabase: false`. Handles GET challenge echo and POST notifications signed with `X-Dropbox-Signature` (HMAC-SHA256 of the raw body using the app secret).

## Tests

```bash
cd packages/v1-ready/dropbox && npm test
```
