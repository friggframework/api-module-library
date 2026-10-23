# Huggg API Module (`@friggframework/api-module-huggg`)

A [Frigg](https://friggframework.org) API module for [Huggg](https://huggg.me)
— employee gifting and rewards. It wraps Huggg's public REST API so a Frigg
integration can list products/brands, read wallets, create and cancel
transactions/hugggs, search hugggs, and create bank-payment orders.

## Authentication

**Primary (wired in `Definition`):** API key sent as `X-Huggg-API-Key`.

```bash
curl https://api.huggg.me/v3/products/ -H "X-Huggg-API-Key: YOUR_API_KEY"
```

Docs: https://docs.huggg.me/endpoints/authentication/api-keys/overview/

**Also on `Api` (not wired in Definition):** OAuth2 password grant
(`client_credentials` → `password` → `refresh_token`) documented at
https://docs.huggg.me/endpoints/authentication/overview/. Helpers:
`getTokenFromClientCredentials`, `getTokenFromUsernamePassword`,
`refreshAccessToken`.

- **Base URL:** `https://api.huggg.me` (sandbox: `https://beta.api.huggg.me`)
- Set `HUGGG_API_KEY` (see `.env.example`)

## Sources

| Source | URL |
|---|---|
| Integration docs (V2 + auth + bank payments + search) | https://docs.huggg.me/ |
| Official V3 OpenAPI (products, brands, themes) | https://documentation.huggg.me/ |
| Product site | https://huggg.me |

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `listProducts(params)` | `GET /v3/products/` | Catalogue list |
| `getProduct(id)` | `GET /v3/products/{id}` | Product by id |
| `listBrands(params)` | `GET /v3/brands/` | Brand list |
| `getBrand(id)` | `GET /v3/brands/{id}` | Brand by id |
| `getProductSegments(id)` | `GET /api/v2/products/{id}/segments` | Product segments |
| `getTeamWallets(teamId)` | `GET /api/v2/teams/{teamId}/wallets` | Team wallet |
| `createTransaction(body, params)` | `POST /api/v2/transactions` | Purchase hugggs |
| `getTransaction(id)` | `GET /api/v2/transactions/{id}` | Transaction by id |
| `cancelTransaction(id)` | `POST /api/v2/transactions/{id}/cancel` | Cancel transaction hugggs |
| `getHugggsFromTransaction(id, params)` | `GET /api/v2/transactions/{id}/hugggs` | Hugggs on a transaction |
| `getHuggg(id, params)` | `GET /api/v2/hugggs/{id}` | Huggg by id/shortcode |
| `cancelHuggg(id)` | `POST /api/v2/hugggs/{id}/cancel` | Cancel a huggg |
| `searchHugggs(body)` | `POST /v3/searches/hugggs` | Search / poll hugggs |
| `createBankPaymentOrder(body)` | `POST /v3/bank-payments/orders` | Create bank-payment order |
| `getBankPaymentOrder(id)` | `GET /v3/bank-payments/orders/{id}` | Get bank-payment order |

## Tests

```bash
cd packages/v1-ready/huggg && npm test
```

Offline unit tests stub `_get` / `_post`. Live `frigg auth test .` needs a real
sandbox API key (pending credentials).

## Related files

- `huggg.openapi.yaml` — curated OpenAPI (1:1 with `api.js` operationIds)
- `huggg.capabilities.json` — capability-manifest/v0.1
- Prior v1 module lived at `packages/needs-updating/huggg/` (Mongoose manager);
  this package replaces it.
