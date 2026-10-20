# Canva API Module (`@friggframework/api-module-canva`)

A [Frigg](https://friggframework.org) API module for [Canva Connect](https://www.canva.dev/docs/connect/)
— Canva's OAuth REST API for designs, folders, assets, exports, and identity.

Integrations consume it the standard Frigg way:

```javascript
const { items } = await this.canva.api.listDesigns({ ownership: 'owned' });
const design = await this.canva.api.getDesign(designId);
await this.canva.api.createFolder({ name: 'Campaign', parent_folder_id: 'root' });
```

## Authentication

Canva Connect uses **OAuth 2.0 authorization code + PKCE (S256)** with refresh
tokens. Token exchange uses **HTTP Basic Auth** (`client_id:client_secret`) as
recommended by Canva.

| Step | URL |
|---|---|
| Authorize | `https://www.canva.com/api/oauth/authorize` |
| Token | `POST https://api.canva.com/rest/v1/oauth/token` |
| User | `GET https://api.canva.com/rest/v1/users/me` |

Docs: https://www.canva.dev/docs/connect/authentication/

Create an integration in the [Canva Developer Portal](https://www.canva.com/developers/),
enable scopes, set redirect URLs, and generate a client secret. Public distribution
of an integration goes through Canva's app review process.

Set `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_SCOPE`, and `REDIRECT_URI`
(see `.env.example`). Scopes must be **explicit** — `asset:write` does not grant
`asset:read`.

PKCE: call `api.getAuthUri()` (or `getAuthorizationRequirements()`) to generate
and store a `code_verifier`, then pass that verifier back with the authorization
`code` to `getToken` / `getTokenFromCode`.

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `usersMe()` | `GET /v1/users/me` | Current `team_user` (`user_id`, `team_id`). |
| `getUserProfile()` | `GET /v1/users/me/profile` | Display name (`profile:read`). |
| `userInfo()` | `GET /v1/oidc/userinfo` | OIDC claims (`openid` + `profile`/`email`). |
| `listDesigns(params)` | `GET /v1/designs` | List designs (`design:meta:read`). |
| `getDesign(id)` | `GET /v1/designs/{id}` | Design metadata. |
| `createDesign(data)` | `POST /v1/designs` | Create a design (`design:content:write`). |
| `createDesignExportJob(data)` | `POST /v1/exports` | Start export (`design:content:read`). |
| `getDesignExportJob(id)` | `GET /v1/exports/{id}` | Poll export job. |
| `createFolder(data)` | `POST /v1/folders` | Create folder (`folder:write`). |
| `getFolder(id)` | `GET /v1/folders/{id}` | Folder metadata. |
| `updateFolder(id, data)` | `PATCH /v1/folders/{id}` | Rename folder. |
| `deleteFolder(id)` | `DELETE /v1/folders/{id}` | Delete folder. |
| `listFolderItems(id, params)` | `GET /v1/folders/{id}/items` | List folder contents. |
| `moveFolderItem(data)` | `POST /v1/folders/move` | Move an item. |
| `getAsset(id)` | `GET /v1/assets/{id}` | Asset metadata (`asset:read`). |
| `updateAsset(id, data)` | `PATCH /v1/assets/{id}` | Update name/tags. |
| `deleteAsset(id)` | `DELETE /v1/assets/{id}` | Delete asset. |
| `createAssetUploadJob(binary, meta)` | `POST /v1/asset-uploads` | Upload job. |
| `getAssetUploadJob(id)` | `GET /v1/asset-uploads/{id}` | Poll upload job. |
| `getSigningPublicKeys()` | `GET /v1/connect/keys` | JWKS for webhook verification. |
| `introspectToken(token)` / `revokeTokens(token)` | OAuth | Token introspection / revoke. |
| `exchangeAccessToken(body)` | OAuth | Code or refresh exchange. |

## Webhooks

Canva only supports **outgoing** webhooks configured in the Developer Portal
(no subscription CRUD API). Enable `collaboration:event` (plus related scopes
per notification type). Use `getSigningPublicKeys()` to verify signatures.
Docs: https://www.canva.dev/docs/connect/webhooks/

## Sources

- Connect docs: https://www.canva.dev/docs/connect/
- Official OpenAPI (vendor source of truth): https://www.canva.dev/sources/connect/api/latest/api.yml
- Scopes: https://www.canva.dev/docs/connect/appendix/scopes/
- Starter kit: https://github.com/canva-sdks/canva-connect-api-starter-kit

`canva.openapi.yaml` is extracted from that official description for the
operations this module implements. Paths, methods, parameters, request/response
schemas, security/scopes, and `servers[0].url` match the vendor file. The only
intentional deltas are camelCase aliases of `CreateAssetUploadJob` /
`GetAssetUploadJob` → `createAssetUploadJob` / `getAssetUploadJob` for Api
method parity (enforced by `tests/spec-sync.test.js`).

## Tests

```bash
cd packages/v1-ready/canva
npm install
npm test
```

## Capability manifest

See `canva.capabilities.json` (`capability-manifest/v0.1`). REST capabilities
map 1:1 to `Api` methods. The Apps SDK UI surface is declared as capability
`ui.appsSdk` with `spec: { kind: "fenestra", ref: "./canva.fenestra.yaml" }`
per [ADR-020](https://github.com/friggframework/frigg/blob/next/docs/architecture-decisions/020-capabilities.md).

## Fenestra

`canva.fenestra.yaml` describes Canva Apps SDK UI extension points (sidebar /
modal + App UI Kit), listed in Fenestra `PLATFORMS.md` on branch
`claude/fenestra-spec-draft-Q367t`. Validate with:

```bash
node specs/fenestra/tools/bin/fenestra.js validate packages/v1-ready/canva/canva.fenestra.yaml
```

This API module implements **Canva Connect** REST (Outside Canva OAuth). The
Apps SDK UI surface is a separate product; it is referenced from the capability
manifest (`ui.appsSdk`) rather than implemented as `Api` methods.
