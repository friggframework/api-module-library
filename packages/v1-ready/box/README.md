# Box API Module (`@friggframework/api-module-box`)

A [Frigg](https://friggframework.org) API module for [Box](https://www.box.com)
— the content cloud. It wraps Box's Platform REST API so a Frigg integration
can authenticate via OAuth 2.0, read/write files and folders, search content,
and manage V2 webhooks.

Integrations consume it the standard Frigg way:

```javascript
const me = await this.box.api.getCurrentUser();
const items = await this.box.api.listFolderItems('0', { limit: 100 });
const file = await this.box.api.getFile(fileId);
```

## Authentication

Box uses **OAuth 2.0 authorization code**. Create a User (OAuth 2.0) app in the
[Box Developer Console](https://app.box.com/developers/console), configure the
redirect URI and scopes, then set:

| Env var | Purpose |
|---|---|
| `BOX_CLIENT_ID` | OAuth client id |
| `BOX_CLIENT_SECRET` | OAuth client secret |
| `BOX_SCOPE` | Space-separated scopes (default `root_readwrite manage_webhook`) |
| `REDIRECT_URI` | Shared Frigg redirect base; module appends `/box` |

- **Authorize:** `https://account.box.com/api/oauth2/authorize`
- **Token:** `https://api.box.com/oauth2/token` (form-urlencoded)
- **API base:** `https://api.box.com/2.0`
- **Upload base:** `https://upload.box.com/api/2.0`

Official guides: [OAuth 2.0](https://developer.box.com/guides/authentication/oauth2),
[scopes](https://developer.box.com/guides/api-calls/permissions-and-errors/scopes).

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getCurrentUser(params)` | `GET /users/me` | Connected user (entity identity). |
| `getFolder(folderId, params)` | `GET /folders/{id}` | Folder metadata (`"0"` = root). |
| `listFolderItems(folderId, params)` | `GET /folders/{id}/items` | List children (offset or marker). |
| `createFolder(data)` | `POST /folders` | Create folder. |
| `updateFolder(folderId, data)` | `PUT /folders/{id}` | Update folder. |
| `deleteFolder(folderId, params)` | `DELETE /folders/{id}` | Delete folder. |
| `getFile(fileId, params)` | `GET /files/{id}` | File metadata. |
| `updateFile(fileId, data)` | `PUT /files/{id}` | Update file. |
| `deleteFile(fileId)` | `DELETE /files/{id}` | Delete file. |
| `downloadFile(fileId, params)` | `GET /files/{id}/content` | Download (redirect). |
| `uploadFile({ attributes, file, ... })` | `POST upload…/files/content` | Multipart upload. |
| `searchContent(params)` | `GET /search` | Search files/folders. |
| `listWebhooks` / `createWebhook` / `getWebhook` / `updateWebhook` / `deleteWebhook` | `/webhooks` | V2 webhook CRUD. |
| `verifyWebhookSignature({ req, … })` | — | Local HMAC verification. |

Paths and parameters come from Box's official OpenAPI
([box/box-openapi](https://github.com/box/box-openapi)); see `box.openapi.yaml`.

## Webhooks

V2 webhooks are created via `POST /webhooks` against a file or folder target.
Signature verification follows
[Box's guide](https://developer.box.com/guides/webhooks/v2/signatures-v2/):
HMAC-SHA256 of `body + BOX-DELIVERY-TIMESTAMP`, compared to
`BOX-SIGNATURE-PRIMARY` / `BOX-SIGNATURE-SECONDARY` (10-minute skew).

The Tier-3 extension at `extensions/webhooks/` receives `POST /webhooks`,
verifies the signature (DB-free), resolves `created_by.id` → integration, and
emits `BOX_WEBHOOK` for consumers.

Set `BOX_WEBHOOK_PRIMARY_KEY` / `BOX_WEBHOOK_SECONDARY_KEY` from the Developer
Console → Webhooks → Manage signature keys.

## Capability manifest & Fenestra

- `box.capabilities.json` — `capability-manifest/v0.1` (objects, events, Api methods).
- `box.fenestra.yaml` — draft covering Box UI Elements (Explorer, Picker, Preview,
  Sidebar, Uploader). The REST module does not implement the browser SDK.

## Tests

```bash
cd packages/v1-ready/box && npm test
```

Offline Jest suites cover Api URL construction, Definition auth methods,
OpenAPI↔client sync, and webhook signature/receive flow.
