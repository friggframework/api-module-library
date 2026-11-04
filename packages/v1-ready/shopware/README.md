# Shop-Ware API Module (`@friggframework/api-module-shopware`)

A [Frigg](https://friggframework.org) API module for
[Shop-Ware](https://www.shop-ware.com/) — cloud auto-repair shop management.
It wraps the Shop-Ware Partner API v1 so a Frigg integration can manage
tenants, customers, vehicles, repair orders, shops, staff, payments,
inventory, and webhooks.

Integrations consume it the standard Frigg way:

```javascript
const { results } = await this.shopware.api.listCustomers({
    tenant_id: 69,
    email: 'ada@example.com',
});
const ro = await this.shopware.api.getRepairOrder(123, { tenant_id: 69 });
```

## Authentication

Shop-Ware uses **dual API-key** authentication. Credentials are issued by
Shop-Ware support and sent on every request as:

```bash
curl https://api.shop-ware.com/api/v1/tenants \
  -H "X-Api-Partner-Id: YOUR_PARTNER_ID" \
  -H "X-Api-Secret: YOUR_API_SECRET" \
  -H "Accept: application/json"
```

- **Base URL:** `https://api.shop-ware.com/api/v1`
- **Docs:** https://shop-ware.stoplight.io/docs/public-api
- **OpenAPI:** https://api.shop-ware.com/api-docs/public/v1/swagger.yaml
- Access is granted **per tenant**. `GET /tenants` lists authorized tenants.
- Most resources are under `/tenants/{tenant_id}/…`. Webhooks are partner-scoped
  at `/webhooks`.

Set `SHOPWARE_API_PARTNER_ID`, `SHOPWARE_API_SECRET`, and optionally
`SHOPWARE_TENANT_ID` (see `.env.example`).

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `listTenants` / `getTenant` | `GET /tenants` | Identity / authorized tenants |
| `listCustomers` / `getCustomer` / `createCustomer` / `updateCustomer` | `/tenants/{id}/customers` | Customers |
| `listVehicles` / `getVehicle` / `createVehicle` / `updateVehicle` | `/tenants/{id}/vehicles` | Vehicles |
| `listRepairOrders` / `getRepairOrder` / `createRepairOrder` / `updateRepairOrder` | `/tenants/{id}/repair_orders` | Repair orders |
| `listShops` / `getShop` | `/tenants/{id}/shops` | Shop locations |
| `listStaffs` / `getStaff` | `/tenants/{id}/staffs` | Staff |
| `listPayments` / `getPayment` | `/tenants/{id}/payments` | Payments (read) |
| `listInventories` / `getInventory` | `/tenants/{id}/inventories` | Parts inventory (read) |
| `listWebhooks` / `getWebhook` / `createWebhook` / `updateWebhook` / `deleteWebhook` | `/webhooks` | Webhook CRUD |

## Webhooks

Inbound deliveries are verified by matching the `X-Api-Secret` request header
to the partner secret. The Tier 3 extension under `extensions/webhooks/`
follows the HubSpot pattern (receive → resolve by `payload.tenant_id` →
dispatch).

## Canonical mappings (ADR-057)

- `mappings/contact.js` — `customer` → `business@1` `Contact` (**UNVALIDATED**)
- `mappings/payment.js` — `payment` → `billing@1` `Payment` (**UNVALIDATED**)

Repair orders, vehicles, shops, and staff stay module-native (no clean
Company/Deal/support fit).

## Development

```bash
cd packages/v1-ready/shopware
npm install
npm test
```
