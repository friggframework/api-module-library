# `@friggframework/api-module-shopify`

Frigg v2 API module for the [Shopify Admin API](https://shopify.dev/docs/api/admin-graphql).

## Auth

OAuth 2.0 authorization-code grant **per shop** (offline access token). The merchant’s `*.myshopify.com` domain is collected before the authorize redirect. Token exchange uses `expiring=1` (required for new public apps calling GraphQL Admin). API requests send `X-Shopify-Access-Token`.

Official docs:

- [Authenticate a standalone or API-only app](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps)
- [Access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens)

## Transport

GraphQL Admin API at:

`https://{shop}.myshopify.com/admin/api/2026-10/graphql.json`

(REST Admin is [legacy](https://shopify.dev/docs/api/admin-rest); this module does not call REST.)

## Covered capabilities

| Method | GraphQL |
| --- | --- |
| `getShop` / `getUserDetails` | `shop` |
| `listCustomers` / `getCustomer` / `searchCustomers` / `createCustomer` / `updateCustomer` | `customers`, `customer`, `customerCreate`, `customerUpdate` |
| `listOrders` / `getOrder` / `updateOrder` | `orders`, `order`, `orderUpdate` |
| `listFulfillmentOrders` / `createFulfillment` | `order.fulfillmentOrders`, `fulfillmentCreate` |
| `listAbandonedCheckouts` | `abandonedCheckouts` |
| `getVariantByInventoryItemId` | `inventoryItem` |
| `listLocations` | `locations` |
| `createWebhook` / `deleteWebhook` / `listWebhookSubscriptions` | `webhookSubscriptionCreate`, `webhookSubscriptionDelete`, `webhookSubscriptions` |
| `verifyWebhookSignature` | HMAC of raw body with client secret (`X-Shopify-Hmac-Sha256`) |

Responses are normalized to the REST-shaped field names the Frigg capability manifest expects (e.g. `first_name`, `customers`, `nextPageInfo`) while the wire protocol remains GraphQL.

## Env

See `.env.example`.

## Test

```bash
npm test --workspace=@friggframework/api-module-shopify
```
