# ProcurementExpress API Module (`@friggframework/api-module-procurement-express`)

A [Frigg](https://friggframework.org) API module for
[ProcurementExpress](https://www.procurementexpress.com) — purchase-order and
AP workflows. It wraps the documented REST API so a Frigg integration can work
with purchase orders, invoices, suppliers, budgets, departments, products, tax
rates, companies, and webhook subscriptions.

```javascript
const user = await this.procurementExpress.api.getCurrentUser();
const pos = await this.procurementExpress.api.listPurchaseOrders({ page: 1 });
const supplier = await this.procurementExpress.api.createSupplier({
    name: 'Acme Supplies',
    email: 'ap@example.com',
});
```

## Authentication

ProcurementExpress authenticates API calls with an **`authentication_token`**
header. Multi-company accounts should also send **`app_company_id`**.

```bash
curl 'https://app.procurementexpress.com/api/v1/currentuser' \
  -H "authentication_token: YOUR_TOKEN" \
  -H "app_company_id: 1"
```

- **Base URL (module default):** `https://app.procurementexpress.com/api/v1`
- Override with `PROCUREMENT_EXPRESS_BASE_URL` (see `.env.example`).
- Credentials persisted: `authenticationToken`, `companyId`.

The module exposes a JSON-Schema authorization form
(`getAuthorizationRequirements`) so the token (and optional company id) can be
collected through the Frigg auth UI / `frigg auth` CLI.

Official docs also describe an OAuth2 password grant at `/oauth/token` for
Bearer access to `/api/v3/...` resources. This module implements the
token-header path used for API-key style integrations; it does **not** use an
OAuth redirect URI.

## Sources of truth

| Artifact | Source |
|---|---|
| Endpoints / fields | Official docs: https://docs.procurementexpress.com/ |
| Vendor OpenAPI | None published — curated `./procurement-express.openapi.yaml` |
| Capabilities | `./procurement-express.capabilities.json` (`capability-manifest/v0.1`) |
| Canonical mappings | `./mappings/company.js` → `business@1` Supplier→Company, **UNVALIDATED** |
| UI (Fenestra) | None — PE has no documented in-app UI extension SDK |

**Path version note:** The docs title the surface “V1 API documentation” while
many resource examples are shown under `/api/v3/...`. Identity
(`/currentuser`) and several approval-flow paths are documented under
`/api/v1/...`. This module defaults to `/api/v1` per the library brief; point
`PROCUREMENT_EXPRESS_BASE_URL` at `/api/v3` if your tenant requires it.

## API methods (curated)

| Method | HTTP | Purpose |
|---|---|---|
| `getCurrentUser` / `updateCurrentUser` | `/currentuser` | Identity |
| `listCompanies` / `getCompany` / `createCompany` | `/companies` | Buyer orgs |
| `listPurchaseOrders` / `getPurchaseOrder` / `createPurchaseOrder` | `/purchase_orders` | POs |
| `approvePurchaseOrder` / `rejectPurchaseOrder` | `…/approve\|reject` (GET + token) | Approvals |
| `cancelPurchaseOrder` / `archivePurchaseOrder` | `…/cancel\|archive` | Lifecycle |
| `listInvoices` / `getInvoice` / `createInvoice` / `updateInvoice` | `/invoices` | Invoices |
| `approveInvoice` / `rejectInvoice` | `…/approve\|reject` (PUT) | Invoice approvals |
| `listSuppliers` / `getSupplier` / `createSupplier` / `updateSupplier` | `/suppliers` | Vendors |
| `listDepartments` / `getDepartment` / `createDepartment` / `updateDepartment` | `/departments` | Departments |
| `listBudgets` / `getBudget` / `createBudget` / `updateBudget` | `/budgets` | Budgets |
| `listProducts` / `getProduct` / `createProduct` / `updateProduct` | `/products` | Catalog |
| `listTaxRates` / `getTaxRate` / `createTaxRate` / `updateTaxRate` | `/tax_rates` | Tax |
| `listWebhooks` / `getWebhook` / `createWebhook` / `updateWebhook` | `/webhooks` | Subscriptions |

### Skipped (documented but not wired)

Approval-flow CRUD/runs/reruns; compliance / SAM.gov; payments; receiving items;
PO comments / forwards / mark-as-paid; invoice accept/cancel/archive/dearchive;
chart of accounts; currencies; webhook **delete** (not documented); OAuth
Bearer `/api/v3` client path.

## Webhooks extension

`extensions/webhooks/` mirrors HubSpot’s two-phase pattern
(`PROCUREMENT_EXPRESS_WEBHOOK_RECEIVED` → resolve → `PROCUREMENT_EXPRESS_WEBHOOK`).
PE deliveries may use HTTP Basic Auth configured on the subscription; set
`PROCUREMENT_EXPRESS_WEBHOOK_BASIC_USER` / `_PASSWORD` to enforce it. There is
no documented HMAC signature header.

Supported event types (vendor docs): `new_po`, `po_approved`, `po_delivered`,
`po_paid`, `po_cancelled`, `po_update`.

## Canonical mappings (ADR-057)

Via `extensions.mapping` → `business@1` (UNVALIDATED):

- `mappings/company.js` — Supplier → Company

Purchase orders and invoices do not fit `business@1` Company/Contact/Deal.
`billing@1` / `support@1` are not available as published schemas here, so those
objects are intentionally unmapped.

## Tests

```bash
cd packages/v1-ready/procurement-express && npm test
```

Includes `spec-sync` (every OpenAPI `operationId` has an `Api` method; server
URL equals `baseUrl`; every capability `method` exists on `Api`).

## Credit

Ported from cleared module sources (generic Api / definition / webhook shapes
only). Client-specific names, fields, and coupling were stripped. OpenAPI,
capabilities, and tests were written against the official vendor docs.
