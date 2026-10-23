# Intercom API Module (`@friggframework/api-module-intercom`)

A [Frigg](https://friggframework.org) API module for [Intercom](https://www.intercom.com)
— customer messaging and support. It wraps Intercom's public REST API (**v2.17**) so
a Frigg integration can identify the workspace, manage contacts / conversations /
companies / admins / tags, verify inbound webhooks, and (optionally) render
Canvas Kit UI via the Fenestra draft.

```javascript
const me = await this.intercom.api.getMe();
const { data } = await this.intercom.api.listContacts();
await this.intercom.api.replyConversation(conversationId, {
    message_type: 'comment',
    type: 'admin',
    admin_id: me.id,
    body: 'Thanks for reaching out.',
});
```

## Authentication

Public marketplace apps use **OAuth 2.0** (authorization code via Intercom's
Eagle token endpoint). Private apps may use a workspace **Access Token**; both
are sent as `Authorization: Bearer <token>` with `Intercom-Version: 2.17`.

| Step | Detail |
|---|---|
| Authorize | `https://app.intercom.com/oauth?client_id=…&state=…` (EU/AU hosts available) |
| Token | `POST https://api.intercom.io/auth/eagle/token` with `code`, `client_id`, `client_secret` |
| Refresh | Not issued — re-authorize when the token is revoked |
| Scopes | Selected in Developer Hub Authorization settings (not authorize-query params) |
| Identity | `GET /me` → `app.id_code` as entity/credential `externalId` |

Set `INTERCOM_CLIENT_ID`, `INTERCOM_CLIENT_SECRET`, and `REDIRECT_URI` (see
`.env.example`). Public apps require Intercom app review for requested scopes.

## API methods

| Method | HTTP | Purpose |
|---|---|---|
| `getMe()` | `GET /me` | Admin + workspace identity |
| `listContacts` / `getContact` / `createContact` / `updateContact` | contacts | Contacts CRUD (list/get/create/update) |
| `listConversations` / `getConversation` / `createConversation` / `updateConversation` / `replyConversation` | conversations | Conversations + reply |
| `listAdmins` / `getAdmin` | admins | Teammates |
| `listCompanies` / `getCompany` / `createOrUpdateCompany` | companies | Companies |
| `listTags` / `getTag` / `createTag` | tags | Tags |
| `verifyWebhookSignature` | — | Local HMAC-SHA1 (`X-Hub-Signature`) |

Webhook **topic subscriptions** are configured in the Developer Hub — Intercom
does not expose REST CRUD for them in OpenAPI 2.17.

## Webhooks extension

`extensions/webhooks/` follows the HubSpot Tier-3 pattern (`useDatabase: false`):
verify signature → resolve workspace `app_id` → `INTERCOM_WEBHOOK`.

## Testing

```bash
npm install
npm test
```

Tests are fully offline — HTTP methods are stubbed. No credentials required.

## Sources

- Official OpenAPI 2.17 (pinned — newest stable under `descriptions/`) — https://raw.githubusercontent.com/intercom/Intercom-OpenAPI/main/descriptions/2.17/api.intercom.io.yaml
- REST API reference — https://developers.intercom.com/docs/references/rest-api/api.intercom.io
- Official OpenAPI repo — https://github.com/intercom/Intercom-OpenAPI
- Authentication — https://developers.intercom.com/docs/build-an-integration/learn-more/authentication
- OAuth setup — https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/setting-up-oauth
- Webhooks — https://developers.intercom.com/docs/webhooks/setting-up-webhooks
- Webhook signatures — https://developers.intercom.com/docs/webhooks/webhook-signatures
- Canvas Kit — https://developers.intercom.com/docs/canvas-kit

## License

MIT — see [LICENSE.md](./LICENSE.md).
