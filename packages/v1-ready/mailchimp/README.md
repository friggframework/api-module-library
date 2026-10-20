# Mailchimp API Module (`@friggframework/api-module-mailchimp`)

A [Frigg](https://friggframework.org) API module for the
[Mailchimp Marketing API](https://mailchimp.com/developer/marketing/api/)
(v3.0). It wraps account identity, audiences/lists, members, campaigns, and
list webhook management so a Frigg integration can connect a Mailchimp account
and sync core marketing objects.

Integrations consume it the standard Frigg way:

```javascript
const lists = await this.mailchimp.api.listLists({ count: 10 });
await this.mailchimp.api.createMember(listId, {
    email_address: 'user@example.com',
    status: 'subscribed',
});
```

## Authentication

**Primary (Marketplace):** OAuth 2.0 authorization code.

| Step | URL |
|---|---|
| Authorize | `https://login.mailchimp.com/oauth2/authorize` |
| Token | `https://login.mailchimp.com/oauth2/token` |
| Metadata (DC discovery) | `GET https://login.mailchimp.com/oauth2/metadata` with `Authorization: OAuth <token>` |

- Access tokens **do not expire**; there is no `refresh_token`.
- After code exchange the client calls metadata and sets `server_prefix` (`dc`)
  so API calls go to `https://{dc}.api.mailchimp.com/3.0`.
- Docs: [OAuth 2 guide](https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/),
  [OAuth concepts](https://mailchimp.com/developer/marketing/api-concepts/authentication/oauth-2/).

**Secondary:** API key (`Authorization: Bearer <api_key>`). The key suffix
after `-` is the data center (e.g. `…-us6`). See
[Fundamentals](https://mailchimp.com/developer/marketing/docs/fundamentals/).

Set `MAILCHIMP_CLIENT_ID` / `MAILCHIMP_CLIENT_SECRET` (and optional
`MAILCHIMP_API_KEY`) — see `.env.example`.

## Base URL

- Default (matches current API reference examples): `https://api.mailchimp.com/3.0`
- With `server_prefix`: `https://{dc}.api.mailchimp.com/3.0`

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getAccount(params)` | `GET /` | Account identity + resource links |
| `ping()` | `GET /ping` | Auth health check |
| `listLists` / `getList` / `createList` / `updateList` | `/lists` | Audiences |
| `listMembers` / `getMember` / `createMember` / `updateMember` / `upsertMember` | `/lists/{id}/members` | Contacts |
| `listCampaigns` / `getCampaign` / `createCampaign` / `updateCampaign` | `/campaigns` | Campaigns |
| `listWebhooks` / `getWebhook` / `createWebhook` / `updateWebhook` / `deleteWebhook` | `/lists/{id}/webhooks` | List webhooks |

`Api.subscriberHash(email)` helpers MD5(lowercase email) for member path params.

The OpenAPI subset in `mailchimp.openapi.yaml` is the 1:1 contract for these
methods (`tests/spec-sync.test.js`).

## Capability manifest

See `mailchimp.capabilities.json` (`capability-manifest/v0.1`). Every
`capabilities.*.method` maps to a real `Api` method.

## Webhooks extension

Tier 3 bundle at `extensions/webhooks/` (HubSpot-shaped):

1. `MAILCHIMP_WEBHOOK_RECEIVED` — verifies `X-Mailchimp-Signature` when
   `MAILCHIMP_WEBHOOK_SECRET` is set, then queues resolve.
2. `MAILCHIMP_WEBHOOK_RESOLVE` — looks up integration by `account_id`.
3. `MAILCHIMP_WEBHOOK` — default no-op; override via `binding.handlers`.

Classic payloads include `data.list_id` but not `account_id`. When calling
`createWebhook`, append `?account_id={account_id}` (from `getAccount`) to the
callback URL.

Signature algorithm (official):
`HMAC-SHA256(signing_secret, "{timestamp}.{raw_body}")` vs
`X-Mailchimp-Signature: t={ts},v1={hex}` — reject if skew > 5 minutes.

## Fenestra

No `mailchimp.fenestra.yaml`. The Marketing API and Registered Apps / Marketplace
flow do not expose in-app UI extension points of the kind Fenestra describes
(unlike HubSpot/Shopify app UI). OAuth + REST + list webhooks are the
integration surface.

## Identity

`getEntityDetails` / `getCredentialDetails` use `account_id` from `GET /`.

## Testing

```bash
cd packages/v1-ready/mailchimp
npm install
npm test
```

`frigg auth test .` requires real sandbox credentials — not faked here.

## Sources

- https://mailchimp.com/developer/marketing/api/
- https://mailchimp.com/developer/marketing/docs/fundamentals/
- https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/
- https://mailchimp.com/developer/marketing/guides/sync-audience-data-webhooks/
