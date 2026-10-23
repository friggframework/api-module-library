# Mailchimp API Module (`@friggframework/api-module-mailchimp`)

A [Frigg](https://friggframework.org) API module for the
[Mailchimp Marketing API](https://mailchimp.com/developer/marketing/api/)
aligned to the official codegen Swagger **3.0.91**:

https://raw.githubusercontent.com/mailchimp/mailchimp-client-lib-codegen/main/spec/marketing.json

Integrations consume it the standard Frigg way:

```javascript
const lists = await this.mailchimp.api.getLists({ count: 10 });
await this.mailchimp.api.postListsIdMembers(listId, {
    email_address: 'user@example.com',
    status: 'subscribed',
});
```

## Authentication

Two schemes (both declared in `mailchimp.openapi.yaml`):

| Path | Header | Notes |
|---|---|---|
| **OAuth access token** | `Authorization: Bearer <access_token>` | Marketing API calls ([OAuth guide](https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/)) |
| **OAuth metadata** | `Authorization: OAuth <access_token>` | `GET login.mailchimp.com/oauth2/metadata` only |
| **API key** | `Authorization: Basic base64(anystring:<api_key>)` | Vendor swagger `basicAuth` (API-key path) |

**OAuth 2 (Marketplace):** authorization code on `login.mailchimp.com`
(not part of the Marketing swagger host). Access tokens do not expire; there
is no `refresh_token`. After code exchange the client calls metadata to
discover `dc` and set `server_prefix`.

| Step | URL |
|---|---|
| Authorize | `https://login.mailchimp.com/oauth2/authorize` |
| Token | `https://login.mailchimp.com/oauth2/token` |
| Metadata | `GET https://login.mailchimp.com/oauth2/metadata` |

Env: see `.env.example`.

## Base URL

Vendor swagger: `host: server.api.mailchimp.com`, `basePath: /3.0`
→ default `https://server.api.mailchimp.com/3.0` (`server` = DC placeholder).

With known DC: `https://{dc}.api.mailchimp.com/3.0`.

## API Methods (vendor operationIds)

| Method | HTTP | Purpose |
|---|---|---|
| `getRoot` | `GET /` | Account identity + resource links |
| `getPing` | `GET /ping` | Auth health check |
| `getLists` / `postLists` / `getListsId` / `patchListsId` | `/lists` | Audiences |
| `getListsIdMembers` / `postListsIdMembers` / `getListsIdMembersId` / `patchListsIdMembersId` / `putListsIdMembersId` | `/lists/{id}/members` | Contacts |
| `getCampaigns` / `postCampaigns` / `getCampaignsId` / `patchCampaignsId` | `/campaigns` | Campaigns |
| `getListsIdWebhooks` / `postListsIdWebhooks` / `getListsIdWebhooksId` / `patchListsIdWebhooksId` / `deleteListsIdWebhooksId` | `/lists/{id}/webhooks` | List webhooks |

`Api.subscriberHash(email)` helpers MD5(lowercase email) for member path params.

OpenAPI subset: `mailchimp.openapi.yaml` (`tests/spec-sync.test.js`).

## Capability manifest

`mailchimp.capabilities.json` (`capability-manifest/v0.1`). Every
`capabilities.*.method` is a vendor operationId implemented on `Api`.

## Webhooks extension

Tier 3 bundle at `extensions/webhooks/` (HubSpot-shaped). Classic payloads
include `data.list_id` but not `account_id` — append `?account_id=` when
calling `postListsIdWebhooks`. Signature verification follows the developer
guide (`X-Mailchimp-Signature`); note marketing.json v3.0.91 webhook schemas
omit `signing_secret` / `signing_enabled`.

## Fenestra

No `mailchimp.fenestra.yaml` — no in-app UI extension points for Marketing API.

## Testing

```bash
cd packages/v1-ready/mailchimp
npm install
npm test
```

## Sources

- Official Swagger: https://raw.githubusercontent.com/mailchimp/mailchimp-client-lib-codegen/main/spec/marketing.json
- https://mailchimp.com/developer/marketing/api/
- https://mailchimp.com/developer/marketing/docs/fundamentals/
- https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/
- https://mailchimp.com/developer/marketing/guides/sync-audience-data-webhooks/
