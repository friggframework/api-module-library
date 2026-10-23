# Shopmonkey API Module (`@friggframework/api-module-shopmonkey`)

A [Frigg](https://friggframework.org) API module for [Shopmonkey](https://www.shopmonkey.io)
— cloud shop management for auto, tire, and powersports shops. It wraps
Shopmonkey's public REST API v3 so a Frigg integration can work with customers,
vehicles, work orders, payments, inventory parts, appointments, and webhooks.

Docs: https://shopmonkey.dev/

## Authentication

Shopmonkey uses **API-key** authentication. Create a key under
**Settings → Integration → API Keys**. The module sends it as:

```bash
curl https://api.shopmonkey.cloud/v3/auth/api_key/status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

- **Base URL:** `https://api.shopmonkey.cloud/v3`
- **Env:** `SHOPMONKEY_API_KEY` (see `.env.example`)

API keys inherit the creating admin's permissions. Keys are minted in the web
app (not via the API).

## Core methods

| Area | Methods |
|---|---|
| Auth / identity | `getApiKeyStatus`, `getCurrentUser`, `listUsers`, `getUser` |
| Company | `getCompany`, `updateCompany` |
| Customers | `searchCustomers`, `getCustomer`, `createCustomer`, `updateCustomer`, `softDeleteCustomer`, `listCustomerOrders`, `listCustomerVehicles` |
| Vehicles | `getVehicle`, `createVehicle`, `updateVehicle`, `softDeleteVehicle`, `listVehicleOrders` |
| Orders | `listOrders`, `getOrder`, `createOrder`, `updateOrder`, `softDeleteOrder`, `getOrderPdf` |
| Payments | `searchPayments`, `recordManualPayment`, `deleteManualPayment` |
| Inventory | `searchInventoryParts`, `getInventoryPart`, `createInventoryPart`, `updateInventoryPart` |
| Appointments | `listAppointments`, `getAppointment`, `createAppointment`, `updateAppointment`, `deleteAppointment` |
| Webhooks | `getWebhook`, `createWebhook`, `updateWebhook`, `deleteWebhook` |

Full contract: `shopmonkey.openapi.yaml` (one `operationId` per `Api` method).

## Webhooks

Inbound deliveries follow the [Webhook Standard](https://shopmonkey.dev/webhooks)
(`webhook-id`, `webhook-timestamp`, `webhook-signature`). Extension bundle:
`extensions/webhooks/`. Set `SHOPMONKEY_WEBHOOK_SECRET` to verify HMAC.

There is **no** documented list-all webhooks endpoint — manage by id after create.

## Tests

```bash
cd packages/v1-ready/shopmonkey && npm test
```

## Credits

Ported from Left Hook–owned Shopmonkey module code (generic Api / definition /
webhook surface), then re-shaped to match `packages/v1-ready/fathom/` and
verified against https://shopmonkey.dev/.
