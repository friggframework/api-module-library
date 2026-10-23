# PayJunction API Module (`@friggframework/api-module-payjunction`)

A [Frigg](https://friggframework.org) API module for [PayJunction](https://www.payjunction.com)
— payment processing for merchants. It wraps PayJunction's REST API so a Frigg
integration can read merchant identity, manage customers, process/search
transactions, send invoices, inspect settlements/deposits/terminals, and
register webhook subscriptions.

## Authentication

This module ports the **OAuth2 authorization-code** flow used by the Left Hook
source module:

1. Authorize at `https://www.payjunction.com/trinity/oauth/authorize`
2. Exchange / refresh tokens at `…/trinity/oauth/token` with
   **HTTP Basic** `client_id:client_secret`
3. Call the API with `Authorization: Bearer <access_token>` **and**
   `X-PJ-Application-Key: <app_key>`

**Note:** PayJunction's public developer portal documents **HTTP Basic**
(`apiLogin:apiPassword`) + Application Key instead of Bearer OAuth. Treat the
Trinity OAuth paths and `read write` scope as partner/UNVALIDATED until
confirmed with PayJunction.

| Env | Purpose |
|---|---|
| `PAYJUNCTION_CLIENT_ID` | OAuth client id |
| `PAYJUNCTION_CLIENT_SECRET` | OAuth client secret |
| `PAYJUNCTION_APP_KEY` | Application key header |
| `PAYJUNCTION_SCOPE` | Defaults to `read write` |
| `PAYJUNCTION_REDIRECT_URI` | Dedicated redirect (preferred) |
| `REDIRECT_URI` | Fallback → `${REDIRECT_URI}/payjunction` |
| `PAYJUNCTION_SANDBOX=true` | Use Labs hosts (`*.payjunctionlabs.com`) |

## Base URLs

| Environment | API | Auth (OAuth / SDK) |
|---|---|---|
| Production | `https://api.payjunction.com` | `https://www.payjunction.com` |
| Labs | `https://api.payjunctionlabs.com` | `https://www.payjunctionlabs.com` |

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getMerchant()` | `GET /merchant` | Merchant profile / Pj-Merchant id |
| `listTransactions(params)` | `GET /transactions` | Search transactions |
| `getTransaction(id)` | `GET /transactions/{id}` | Retrieve transaction |
| `createTransaction(data)` | `POST /transactions` | CHARGE / REFUND / VERIFY (form) |
| `getTransactionReceipt(id, format)` | `GET /transactions/{id}/receipts/latest` | Latest receipt |
| `listCustomers(params)` | `GET /customers` | List customers |
| `getCustomer(id)` | `GET /customers/{id}` | Retrieve customer |
| `createCustomer(data)` | `POST /customers` | Create customer (form) |
| `updateCustomer(id, data)` | `PUT /customers/{id}` | Update customer (form) |
| `listInvoices(params)` | `GET /invoices` | List invoices |
| `getInvoice(id)` | `GET /invoices/{id}` | Retrieve invoice |
| `createInvoice(data)` | `POST /invoices` | Create + send invoice (form) |
| `listSettlements(params)` | `GET /settlements` | List settlements |
| `getSettlement(id)` | `GET /settlements/{id}` | Retrieve settlement |
| `listDeposits(params)` | `GET /deposits` | List deposits |
| `getDeposit(id)` | `GET /deposits/{id}` | Retrieve deposit |
| `listTerminals()` | `GET /terminals` | List terminals / accounts |
| `listSmartTerminals()` | `GET /smartterminals` | List Smart Terminals |
| `listWebhooks()` | `GET /webhooks` | List webhook subscriptions |
| `createWebhook(data)` | `POST /webhooks` | Subscribe (event, url, secret?) |
| `updateWebhook(id, data)` | `PUT /webhooks/{id}` | Update subscription |
| `deleteWebhook(id)` | `DELETE /webhooks/{id}` | Delete subscription |

## Webhooks

Inbound delivery is handled by `extensions/webhooks/` (HubSpot-style Tier 3
bundle): verify `X-Pj-Signature` (HMAC-SHA256 of the JSON body), resolve
`Pj-Merchant` → integration, then emit `PAYJUNCTION_WEBHOOK`.

Subscription events: `CUSTOMER`, `DEPOSIT`, `SETTLEMENT`,
`SMARTTERMINAL_REQUEST`, `TRANSACTION`, `TRANSACTION_SIGNATURE`.

## Canonical mappings (ADR-057)

UNVALIDATED mappings under `mappings/` and `extensions.mapping`:

- Merchant → `business@1` Company
- Customer → `business@1` Contact
- Invoice → `billing@1` Invoice
- Transaction → `billing@1` Payment

## Fenestra

`payjunction.fenestra.yaml` documents the browser tokenization SDK
(`trinity/js/sdk.js` → `createToken` → `tokenId` for `createTransaction`).

## Tests

```bash
cd packages/v1-ready/payjunction
npm test
```

Offline Jest suite: `api.test.js`, `definition.test.js`, `spec-sync.test.js`.

## Sources

- https://developer.payjunction.com/
- https://developer.payjunction.com/hc/en-us/articles/218162588-User-Authentication
- https://developer.payjunction.com/hc/en-us/articles/216477387-Application-Keys
- https://developer.payjunction.com/hc/en-us/articles/115004486287-Available-Webhooks
- https://developer.payjunction.com/hc/en-us/articles/4404249724571-PayJunction-JavaScript-SDK

Ported from Left Hook–owned module code (generic Api / definition / webhook
surface only; client-specific references stripped).
