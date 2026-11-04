# Outreach API Module (`@friggframework/api-module-outreach`)

A [Frigg](https://friggframework.org) API module for [Outreach](https://www.outreach.io)
— the sales engagement platform. It wraps Outreach's public REST API (JSON:API
1.0) so a Frigg integration can manage accounts, prospects, tasks, users, and
webhook subscriptions.

Integrations consume it the standard Frigg way:

```javascript
const prospects = await this.outreach.api.listProspects({
    query: { 'page[size]': 50, count: false },
});
const account = await this.outreach.api.createAccount({
    data: { type: 'account', attributes: { name: 'Acme' } },
});
```

## Authentication

Outreach uses **OAuth 2.0 authorization code**. Register an app in the
[Outreach Developer Portal](https://developers.outreach.io/), then set:

| Env var | Purpose |
|---|---|
| `OUTREACH_CLIENT_ID` | Application identifier |
| `OUTREACH_CLIENT_SECRET` | Application secret |
| `OUTREACH_SCOPE` | Space-separated scopes (e.g. `accounts.read prospects.all tasks.all users.read webhooks.all`) |
| `REDIRECT_URI` | Frigg redirect base; module uses `${REDIRECT_URI}/outreach` |

- **Authorize:** `https://api.outreach.io/oauth/authorize`
- **Token:** `https://api.outreach.io/oauth/token`
- **Access token TTL:** 2 hours; **refresh token TTL:** 14 days (rotating)
- **API base:** `https://api.outreach.io/api/v2`
- **Content-Type:** `application/vnd.api+json`
- **Rate limit:** 10,000 requests/hour per user (general)

Scopes are `resource.action` pairs and are **not additive** (`write` does not
grant `read`). See https://developers.outreach.io/api/getting-started.

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getApiRoot()` | `GET /` | Token + organization attributes (identity) |
| `listAccounts` / `getAccount` / `createAccount` / `updateAccount` / `deleteAccount` | `/accounts` | Accounts CRUD |
| `listProspects` / `getProspect` / `createProspect` / `updateProspect` / `deleteProspect` | `/prospects` | Prospects CRUD |
| `listTasks` / `getTask` / `createTask` / `updateTask` / `deleteTask` | `/tasks` | Tasks CRUD |
| `listUsers` / `getUser` | `/users` | Users read |
| `listWebhooks` / `getWebhook` / `createWebhook` / `updateWebhook` / `deleteWebhook` | `/webhooks` | Webhook subscription management |
| `cleanupWebhook(cleanupToken)` | `POST /webhooks/cleanup` | Remove a webhook after token revocation |
| `verifyWebhookSignature({ headers, body, rawBody, secret })` | — | HMAC-SHA256 hex verify |

Request/response bodies follow JSON:API (`{ data: { type, id?, attributes, relationships } }`).

## Webhooks

Create a webhook with `createWebhook`:

```javascript
await this.outreach.api.createWebhook({
    data: {
        type: 'webhook',
        attributes: {
            url: 'https://your-frigg-app/webhooks/outreach/<externalId>',
            resource: 'prospect',
            action: 'updated',
            payloadVersion: 2,
        },
    },
});
```

- Delivery header `Outreach-Webhook-Signature` = HMAC-SHA256-hex(`secret`, raw body)
  when `attributes.secret` is set.
- Payload: `{ data, meta: { deliveredAt, eventName } }` (v2 adds `beforeUpdate`).
- The Tier 3 extension under `extensions/webhooks/` verifies the signature and
  resolves the owning integration via a per-install `:externalId` path param
  (official samples do not include an org id in the body).

## UI extensions (Fenestra)

Outreach supports Shell / Tab / Tile **web widget** iframes. See
`outreach.fenestra.yaml` and
https://developers.outreach.io/client-extensions/web-widget-extensions.

## Testing

```bash
npm install
npm test
```

Tests are fully offline — HTTP methods are stubbed. No sandbox credentials
required.

## Sources

- Getting started — https://developers.outreach.io/api/getting-started
- Making requests — https://developers.outreach.io/api/making-requests
- REST reference — https://developers.outreach.io/api/reference.md
- Webhooks — https://developers.outreach.io/api/webhooks
- Machine-readable OpenAPI — https://api.outreach.io/api/v2/schema/openapi.json
- Web widgets — https://developers.outreach.io/client-extensions/web-widget-extensions

## License

MIT — see [LICENSE.md](./LICENSE.md).
