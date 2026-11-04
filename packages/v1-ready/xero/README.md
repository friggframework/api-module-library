# Xero API Module (`@friggframework/api-module-xero`)

A [Frigg](https://friggframework.org) API module for [Xero](https://www.xero.com)
Accounting. It wraps Xero's OAuth 2.0 + Accounting REST API so a Frigg
integration can select a tenant, read organisation identity, and
list/get/create/update contacts, invoices, accounts, payments, and items.

Integrations consume it the standard Frigg way:

```javascript
const contacts = await this.xero.api.getContacts({ page: 1 });
const { Invoices } = await this.xero.api.getInvoices({ statuses: 'AUTHORISED' });
```

## Sources (official only)

- Accounting OpenAPI: https://github.com/XeroAPI/Xero-OpenAPI/blob/master/xero_accounting.yaml
- Identity OpenAPI: https://github.com/XeroAPI/Xero-OpenAPI/blob/master/xero-identity.yaml
- OAuth 2.0 auth flow: https://developer.xero.com/documentation/guides/oauth2/auth-flow/
- Connections / tenants: https://developer.xero.com/documentation/guides/oauth2/auth-flow/
- Webhooks: https://developer.xero.com/documentation/guides/webhooks/overview/
- Accounting API docs: https://developer.xero.com/documentation/api/accounting/overview

`xero.openapi.yaml` in this package is a **curated subset** of the official
Accounting OpenAPI covering exactly the endpoints implemented in `api.js`.

## Authentication

Xero uses **OAuth 2.0 authorization code** with refresh tokens
(`offline_access`). After the code exchange, call **GET /Connections** on the
Identity host to list authorised organisations; every Accounting request must
send the chosen connection's `tenantId` as the `xero-tenant-id` header
(not the connection `id`).

| Endpoint | URL |
|---|---|
| Authorize | `https://login.xero.com/identity/connect/authorize` |
| Token | `https://identity.xero.com/connect/token` |
| Connections | `GET https://api.xero.com/Connections` |
| Accounting base | `https://api.xero.com/api.xro/2.0` |

Default scopes (override with `XERO_SCOPE`):

```
openid profile email offline_access accounting.transactions accounting.contacts accounting.settings
```

See `.env.example` for `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `REDIRECT_URI`.

The definition persists `access_token` / `refresh_token` / `accessTokenExpire`
on the credential and `tenantId` on the entity. `getEntityDetails` picks an
`ORGANISATION` connection (or an explicit `callbackParams.tenantId`) and uses
`OrganisationID` as `externalId`.

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getConnections(params)` | `GET /Connections` (Identity) | List authorised tenants |
| `deleteConnection(id)` | `DELETE /Connections/{id}` | Disconnect a tenant |
| `getOrganisations()` | `GET /Organisation` | Organisation details for current tenant |
| `getContacts(params)` | `GET /Contacts` | List contacts |
| `getContact(id)` | `GET /Contacts/{id}` | Get one contact |
| `createContacts(body)` | `PUT /Contacts` | Create contacts (bulk) |
| `updateContact(id, body)` | `POST /Contacts/{id}` | Update a contact |
| `getInvoices(params)` | `GET /Invoices` | List invoices |
| `getInvoice(id)` | `GET /Invoices/{id}` | Get one invoice |
| `createInvoices(body)` | `PUT /Invoices` | Create invoices (bulk) |
| `updateInvoice(id, body)` | `POST /Invoices/{id}` | Update an invoice |
| `getAccounts(params)` | `GET /Accounts` | Chart of accounts |
| `getAccount(id)` | `GET /Accounts/{id}` | Get one account |
| `createAccount(body)` | `PUT /Accounts` | Create an account |
| `updateAccount(id, body)` | `POST /Accounts/{id}` | Update an account |
| `getPayments(params)` | `GET /Payments` | List payments |
| `getPayment(id)` | `GET /Payments/{id}` | Get one payment |
| `createPayment(body)` | `POST /Payments` | Create a payment |
| `getItems(params)` | `GET /Items` | List items |
| `getItem(id)` | `GET /Items/{id}` | Get one item |
| `createItems(body)` | `PUT /Items` | Create items (bulk) |
| `updateItem(id, body)` | `POST /Items/{id}` | Update an item |
| `deleteItem(id)` | `DELETE /Items/{id}` | Delete an item |

Helpers (not in the Accounting OpenAPI subset): `getTenants` (= `getConnections`),
`getOrganisation` (first org), `setTenant(tenantId)`.

### Skipped (intentionally)

The official Accounting OpenAPI is large (bank transactions, credit notes,
purchase orders, journals, reports, attachments, payroll, etc.). This v1 module
covers the **core objects an integration needs** for identity + CRM/AR sync.
Remaining Accounting / Payroll / Files / Projects APIs are open for follow-up.

**Webhook subscription management** is **not** offered by Xero's Accounting API —
subscriptions are created in the [Developer Portal](https://developer.xero.com/app/manage).
This package still ships `extensions/webhooks/` to **receive and verify**
deliveries (`x-xero-signature` HMAC-SHA256).

## Capabilities & Fenestra

- `xero.capabilities.json` — capability-manifest/v0.1 (objects + capabilities
  map 1:1 to `Api` methods).
- **No `xero.fenestra.yaml`**: Xero is not a UI-extension host platform in the
  Fenestra research list (`specs/fenestra/PLATFORMS.md` on branch
  `claude/fenestra-spec-draft-Q367t`). Accounting APIs here; no in-product
  card/iframe/component extension surface comparable to HubSpot/Salesforce.

## Webhooks extension

```
extensions/webhooks/
  index.js               # routes + lifecycle events
  handlers.js            # RECEIVED → RESOLVE → XERO_WEBHOOK
  signature-verifier.js  # x-xero-signature
  lookup.js              # tenantId → integration (fail on ambiguous)
```

Set `XERO_WEBHOOK_KEY` to the portal signing key. Respond to Intent to Receive
with HTTP 200 only when the signature verifies.

## Tests

```bash
cd packages/v1-ready/xero && npm test
```

Includes `api`, `definition`, `spec-sync` (every OpenAPI `operationId` has an
`Api` method; `servers[0].url === baseUrl`), and webhook unit tests.

`frigg auth test .` needs real Xero sandbox credentials — **pending credentials**.
