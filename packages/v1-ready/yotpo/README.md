# Yotpo API Module (`@friggframework/api-module-yotpo`)

A [Frigg](https://friggframework.org) API module for [Yotpo](https://www.yotpo.com)
Core API (v3). It wraps the store-scoped REST surface so a Frigg integration can
sync products, customers, orders, and fulfillments, and manage webhook
subscriptions (target → filter → subscription).

```javascript
await this.yotpo.api.createOrder({
    order: {
        external_id: '1001',
        order_date: '2026-03-25T13:57:05Z',
        customer: { email: 'buyer@example.com' },
        line_items: [{ external_product_id: 'sku-1', quantity: 1 }],
    },
});
```

## Authentication

Yotpo Core API uses **store ID (app key) + API secret** to mint an access token,
then sends that token on every request as `X-Yotpo-Token`:

```bash
curl -X POST "https://api.yotpo.com/core/v3/stores/YOUR_STORE_ID/access_tokens" \
  -H "Content-Type: application/json" \
  -d '{ "secret": "YOUR_SECRET" }'
# → { "access_token": "..." }

curl "https://api.yotpo.com/core/v3/stores/YOUR_STORE_ID/products" \
  -H "X-Yotpo-Token: YOUR_ACCESS_TOKEN"
```

- **Base URL:** `https://api.yotpo.com`
- **Paths:** `/core/v3/stores/{store_id}/...`
- **Rate limit:** 5 requests/second per store (`429` + `RateLimit-*` headers)

Find credentials in Yotpo admin → Profile → Store Settings → General Settings
([docs](https://support.yotpo.com/docs/finding-your-yotpo-app-key-and-secret-key)).

Set `YOTPO_STORE_ID` / `YOTPO_API_SECRET` for local use (see `.env.example`).
The module also exposes a JSON-Schema authorization form
(`getAuthorizationRequirements`) so credentials can be collected through the
Frigg auth UI / `frigg auth` CLI. `setAuthParams` exchanges secret → token via
`generateAccessToken`.

Account identity is the `store_id` itself (no `/me` endpoint on Core API).

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `generateAccessToken()` | `POST .../access_tokens` | Mint `X-Yotpo-Token` |
| `listProducts(params)` | `GET .../products` | List / page products |
| `getProduct(id)` | `GET .../products/{id}` | Get product by Yotpo id |
| `createProduct(data)` | `POST .../products` | Create product |
| `updateProduct(id, data)` | `PATCH .../products/{id}` | Update product |
| `listOrders(params)` | `GET .../orders` | List / page orders |
| `getOrder(id)` | `GET .../orders/{id}` | Get order by Yotpo id |
| `createOrder(data)` | `POST .../orders` | Create order |
| `updateOrder(id, data)` | `PATCH .../orders/{id}` | Update order |
| `listOrderFulfillments(orderId)` | `GET .../orders/{id}/fulfillments` | List fulfillments |
| `createOrderFulfillment(orderId, data)` | `POST .../orders/{id}/fulfillments` | Create fulfillment |
| `listCustomers(params)` | `GET .../customers` | List / filter customers |
| `createCustomer(data)` | `PATCH .../customers` | Create or update customer |
| `createWebhookTarget(data)` | `POST .../webhooks/targets` | Register callback URL |
| `listWebhookTargets()` | `GET .../webhooks/targets` | List targets |
| `createWebhookFilter(data)` | `POST .../webhooks/filters` | Register event filter |
| `listWebhookFilters()` | `GET .../webhooks/filters` | List filters |
| `createWebhookSubscription(data)` | `POST .../webhooks/subscriptions` | Bind target + filter |
| `listWebhookSubscriptions()` | `GET .../webhooks/subscriptions` | List subscriptions |
| `deleteWebhookSubscription(id)` | `DELETE .../webhooks/subscriptions/{id}` | Delete subscription |

## Webhooks

Yotpo Core webhooks are a three-step subscribe flow (target → filter →
subscription). Topics are documented at
https://core-api.yotpo.com/docs/topics. Deliveries include a
`WebhookMessageIdPerTarget` header for deduplication; Yotpo does **not**
document an HMAC signature scheme comparable to HubSpot/Square, so this module
does not ship an `extensions/webhooks/` receiver — only the Core API subscription
management methods.

## Out of scope (other Yotpo products)

- **Loyalty & Referrals API** (`loyalty.yotpo.com`) — separate API key + GUID
- **UGC / Reviews API** — product-specific review endpoints
- **App Developer API** (`developers.yotpo.com`) — OAuth2 for public apps
- Product variants, collections, aggregated order info — Core endpoints not
  modeled in this curated subset (can be added later)

## Testing

```bash
cd packages/v1-ready/yotpo
npm install
npm test
```

Tests are fully offline — HTTP methods are stubbed. No Yotpo credentials required.

## Sources

- Core API welcome — https://core-api.yotpo.com/reference/welcome
- Authentication — https://core-api.yotpo.com/reference/authentication
- Generate access token — https://core-api.yotpo.com/reference/yotpo-authentication
- Products / Orders / Customers / Fulfillments / Webhooks — https://core-api.yotpo.com/reference/llms.txt
- Webhook guide — https://core-api.yotpo.com/docs/about-webhook-events

## License

MIT — see [LICENSE.md](./LICENSE.md).
