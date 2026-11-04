# QuickBooks Online API Module (`@friggframework/api-module-quickbooks`)

A [Frigg](https://friggframework.org) API module for
[QuickBooks Online](https://quickbooks.intuit.com) Accounting. It wraps Intuit's
OAuth 2.0 + REST Accounting API so a Frigg integration can manage customers,
invoices, payments, sales/refund receipts, deposits, and receive app-level
webhooks routed by `realmId`.

This is a fresh v2 module. The legacy v1 package at
`packages/needs-updating/qbo` is left untouched.

## Authentication

QuickBooks Online uses **OAuth 2.0** (authorization code).

| Detail | Value |
|---|---|
| Authorize | `https://appcenter.intuit.com/connect/oauth2` |
| Token | `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer` (HTTP Basic) |
| Default scope | `com.intuit.quickbooks.accounting` |
| Access token TTL | ~1 hour |
| Refresh token | Rotates — persist the new value on every refresh |
| Company id | `realmId` on the OAuth callback; required in every Accounting path |

Set `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_SCOPE`,
`REDIRECT_URI`, and optionally `QUICKBOOKS_ENVIRONMENT=sandbox` (see
`.env.example`).

## Base URL & versioning

- Production: `https://quickbooks.api.intuit.com`
- Sandbox: `https://sandbox-quickbooks.api.intuit.com`
- `minorversion` pinned to **75** (override with `QUICKBOOKS_MINOR_VERSION`)

Rate limits (production, per Intuit): **500 requests/minute** and **10 concurrent**
requests per `realmId`.

## API methods

| Method | HTTP | Purpose |
|---|---|---|
| `getCompanyInfo()` | `GET /v3/company/{realmId}/companyinfo/{realmId}` | Auth test / display name |
| `query(sql)` | `GET /v3/company/{realmId}/query` | SQL-like query |
| `getCustomer(id)` | `GET .../customer/{id}` | Read customer |
| `queryCustomers({ where })` | query | Customer WHERE query |
| `listCustomers({ changedSince, startPosition, maxResults })` | query | Paged customer list |
| `createCustomer(customer)` | `POST .../customer` | Create |
| `updateCustomer(customer)` | `POST .../customer?sparse=true` | Sparse update (Id + SyncToken) |
| `createInvoice(invoice)` / `getInvoice(id)` / `sendInvoice(id, sendTo?)` | invoice | Create / read / email |
| `getPayment(id)` | `GET .../payment/{id}` | Read payment |
| `createSalesReceipt(salesReceipt)` | `POST .../salesreceipt` | Create sales receipt |
| `createRefundReceipt(refundReceipt)` | `POST .../refundreceipt` | Create refund receipt |
| `createDeposit(deposit)` | `POST .../deposit` | Create deposit |
| `listItems({ type })` / `listAccounts({ accountType })` | query | Option lists |
| `verifyWebhookSignature({ headers, body, rawBody })` | — | HMAC verify |

Sources: [Intuit QBO docs](https://developer.intuit.com/app/developer/qbo/docs/develop),
[OAuth 2.0](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0),
[Webhooks](https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks).

## Webhooks

Intuit webhooks are **app-level** (configured in the developer portal, not via
REST). The Tier-3 extension under `extensions/webhooks/` verifies
`intuit-signature` (HMAC-SHA256 of the raw body with the verifier token) and
routes by company id:

- Legacy payload: `eventNotifications[].realmId`
- CloudEvents: `intuitaccountid`

Set `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN`.

## Capability manifest

`quickbooks.capabilities.json` follows `capability-manifest/v0.1` (see ADR-020).
Reconciled with lefthook-bots `definitions/manifests/quickbooks.json`: every draft
capability maps to a doc-verified `Api` method already in this package (plus
`webhook.verify` → `verifyWebhookSignature`). Version equals this package
version (`1.0.0`). `args` were added so Frigg can bind positional signatures;
no draft capabilities were dropped.

## Fenestra

No `quickbooks.fenestra.yaml`. QuickBooks Online is not in the Fenestra platform
UI-extension research list (`specs/fenestra/PLATFORMS.md`); this module covers
REST + OAuth + webhooks only.

## Tests

```bash
cd packages/v1-ready/quickbooks && npm install && npm test
```

`frigg auth test .` needs real sandbox credentials — pending.

## Credits

- Shape copied from `@friggframework/api-module-fathom`
- Webhook extension patterned on `@friggframework/api-module-hubspot`
- Capability draft: lefthook-bots `definitions/manifests/quickbooks.json`
  (same shape as friggframework/frigg definitions capabilities)
- Replaces (does not modify) `packages/needs-updating/qbo`
