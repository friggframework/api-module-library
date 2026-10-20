# FreshBooks API Module (`@friggframework/api-module-freshbooks`)

A [Frigg](https://friggframework.org) API module for [FreshBooks](https://www.freshbooks.com)
— cloud invoicing and accounting. It wraps the FreshBooks public REST API so a
Frigg integration can authenticate via OAuth2, resolve account/business identity,
CRUD core accounting objects, and manage webhook callbacks.

Integrations consume it the standard Frigg way:

```javascript
const clients = await this.freshbooks.api.listClients({ page: 1 });
const invoice = await this.freshbooks.api.createInvoice({
  customerid: 123,
  create_date: '2024-01-15',
});
```

## Authentication

FreshBooks uses **OAuth 2.0 authorization-code** flow
([docs](https://www.freshbooks.com/api/authentication)):

| Step | URL |
|---|---|
| Authorize | `https://auth.freshbooks.com/oauth/authorize/?response_type=code&client_id=…&redirect_uri=…` |
| Token / refresh | `POST https://api.freshbooks.com/auth/oauth/token` |

Verified facts from the official docs:

- Authorization codes expire in **5 minutes**
- Access-token lifetime varies (example responses show `expires_in: 43200`)
- **Refresh tokens rotate**: each refresh returns a new refresh_token and
  invalidates the previous refresh_token and access_token
- `user:profile:read` is added to apps by default
- Accounting paths need `account_id`; many non-accounting paths need `business_id`
  (both come from `/auth/api/v1/users/me` → `business_memberships`)

Set `FRESHBOOKS_CLIENT_ID`, `FRESHBOOKS_CLIENT_SECRET`, optional
`FRESHBOOKS_SCOPE`, and `REDIRECT_URI` (see `.env.example`).

## Rate limits

No daily request cap. Short-term bursts may return **HTTP 429**. List endpoints
silently cap `per_page` at **100**
([docs](https://www.freshbooks.com/api/limits)).

## API methods (OpenAPI-backed)

See `freshbooks.openapi.yaml` (hand-written; FreshBooks has no official OpenAPI).
Every `operationId` has a matching `Api` method (`tests/spec-sync.test.js`).

| Area | Methods |
|---|---|
| Identity | `getUserDetails` / `getUserInfo`, `getUserEmail`, `listBusinessAccounts` / `retrieveAccounts` |
| Clients | `listClients`, `getClient` / `getClientById`, `findClientsByEmail` / `searchClientByEmail`, `createClient`, `updateClient` |
| Invoices | `listInvoices`, `listClientInvoices` / `getClientInvoices`, `getInvoice` / `getInvoiceById`, `createInvoice`, `updateInvoice`, `deleteInvoice` |
| Expenses | `listExpenses`, `getExpense`, `createExpense`, `updateExpense` |
| Categories | `listExpenseCategories`, `getExpenseCategory` (read-only via API) |
| Payments | `listPayments`, `listClientPayments` / `getClientPayments`, `getPayment` / `getPaymentById`, `createPayment`, `updatePayment` |
| Staff | `listStaff`, `getStaff` |
| Other income | `listOtherIncomes`, `getOtherIncome`, `createOtherIncome`, `updateOtherIncome` |
| Bill vendors | `listBillVendors`, `createBillVendor`, `updateBillVendor` |
| Webhooks | `listCallbacks`, `getCallback`, `createCallback` / `createEventCallback`, `verifyCallback` / `verifyEventCallback`, `resendCallbackVerification`, `deleteCallback` / `deleteEventCallback` |

## Webhooks

`extensions/webhooks/` mirrors the HubSpot webhook extension pattern. FreshBooks
signs deliveries with `X-FreshBooks-Hmac-SHA256` using the callback **verifier**
as the HMAC secret ([docs](https://www.freshbooks.com/api/webhooks)).

## Capabilities & Fenestra

- `freshbooks.capabilities.json` — `capability-manifest/v0.1`
- **No** `freshbooks.fenestra.yaml` — FreshBooks is an accounting API without a
  documented in-app UI extension surface (unlike HubSpot UI Extensions / Slack
  Block Kit). Freshsales appears on the Fenestra platform research list; FreshBooks
  does not.

## Sources / prior art

- Official docs: https://www.freshbooks.com/api/
- Prior module in this repo: `packages/needs-updating/freshbooks` (git-moved here)
- Reconciled against Daniel’s module in
  `lefthookhq/freshbooks-integrations` `backend/src/api-modules/freshbooks/`
  (auth JSON token body, single-use grant no-retry, `getUserDetails` /
  `freshbooksUserId`, `findClientsByEmail`, client invoice/payment helpers,
  `getCallback`, `webUrls`, `invoiceStatusName`, multi-business account
  selection). Integration-specific logic was not copied.
- Also reconciled against `lefthookhq/freshbooks--frigg` (older TypeScript
  module): verified `bill_vendors` list/create (+ `updateBillVendor` from
  [Vendors](https://www.freshbooks.com/api/vendors) docs), and compatibility
  aliases (`searchClientByEmail`, `getClientById`, `getClientInvoices`,
  `getInvoiceById`, `getClientPayments`, `getPaymentById`,
  `createEventCallback` / `verifyEventCallback` / `deleteEventCallback`,
  `getUserEmail`, `retrieveAccounts`, `setAccessToken` /
  `setRefreshToken` / `setRedirectUri`). Skipped: `getOtherExpensesCategory`,
  expense body transform helpers, `manager.ts` / Entity wiring, and the stale
  `my.freshbooks.com/service/auth/oauth/authorize` auth URL (current docs use
  `auth.freshbooks.com`).

## Test

```bash
cd packages/v1-ready/freshbooks
npm install
npm test
```
