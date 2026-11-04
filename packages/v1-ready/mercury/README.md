# Mercury API Module (`@friggframework/api-module-mercury`)

A [Frigg](https://friggframework.org) API module for [Mercury](https://mercury.com)
— business banking. It wraps Mercury Banking API v1 so a Frigg integration can
list accounts, read transactions, and manage webhook subscriptions.

Integrations consume it the standard Frigg way:

```javascript
const { accounts } = await this.mercury.api.getAccounts();
const txns = await this.mercury.api.listAccountTransactions(accountId, {
    start: '2026-01-01',
});
```

## Authentication

Mercury uses an **API token**. Create one under **Settings → Tokens**. Prefer a
read-only token unless you need write scopes. This module sends the token as:

```bash
curl https://api.mercury.com/api/v1/accounts \
  -H "Authorization: Bearer secret-token:mercury_…"
```

Official docs also accept HTTP Basic with the token as username and an empty
password; Bearer is the form used here.

- **Base URL:** `https://api.mercury.com/api/v1`
- **Env:** `MERCURY_API_KEY` (see `.env.example`)

There is no OAuth flow and no dedicated redirect URI.

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getAccounts(query)` | `GET /accounts` | List accounts (paginated). |
| `getAccount(accountId)` | `GET /account/{id}` | Get one account. |
| `listAccountTransactions(accountId, query)` | `GET /account/{id}/transactions` | List transactions for one account. |
| `getTransaction(accountId, transactionId)` | `GET /account/{id}/transaction/{txnId}` | Get one transaction. |
| `listTransactions(query)` | `GET /transactions` | List transactions across accounts. |
| `getWebhooks(query)` | `GET /webhooks` | List webhook endpoints. |
| `getWebhook(id)` | `GET /webhooks/{id}` | Get one webhook endpoint. |
| `createWebhook(data)` | `POST /webhooks` | Create webhook (returns `secret` once). |
| `updateWebhook(id, data)` | `POST /webhooks/{id}` | Update webhook (Mercury uses POST, not PATCH). |
| `deleteWebhook(id)` | `DELETE /webhooks/{id}` | Delete webhook. |

Method names match official OpenAPI `operationId`s (`mercury.openapi.yaml`).

## Webhooks

REST subscription management is on `/webhooks`. Inbound deliveries are verified
with HMAC-SHA256 over `timestamp.rawBody` using the `Mercury-Signature` header
(`t=<unix>,v1=<hex>`). See `extensions/webhooks/`.

Mercury event payloads do not include an organization id — register callback
URLs with `?externalId=<entityExternalId>` (the account id persisted by
`definition.js`). Store the create-time `secret` as `MERCURY_WEBHOOK_SECRET`.

Webhooks are **not available in Mercury's sandbox** (per official docs).

## Sources

- Getting started: https://docs.mercury.com/docs/getting-started
- Accounts: https://docs.mercury.com/reference/getaccounts
- Transactions: https://docs.mercury.com/reference/listaccounttransactions
- Webhooks: https://docs.mercury.com/reference/webhooks

## Tests

```bash
cd packages/v1-ready/mercury && npm test
```

Offline only — HTTP is stubbed. Spec-sync asserts every OpenAPI `operationId`
has a matching `Api` method and that `servers[0].url` equals `baseUrl`.
