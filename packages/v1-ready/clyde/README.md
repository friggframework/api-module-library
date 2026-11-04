# @friggframework/api-module-clyde

A Frigg API module for [Clyde](https://joinclyde.com) — product protection /
extended warranty for e-commerce merchants. This module lets a Frigg integration
sync product catalogs, pull matched contract SKUs, record orders and contract
sales, and manage claims and vouchers.

## Features

- HTTP Basic authentication (Client Key + Secret) with Clyde-required
  `X-Auth-Timestamp` / `X-Auth-Nonce` headers
- Products: list, get, create, update, delete, bulk create, contracts-for-product
- Contracts: list all matched contracts for the merchant
- Orders: list, get, create, update, cancel, add history event
- Contract sales: list, get, update, cancel
- Claims: list, get, create
- Vouchers: list, get, bulk create, update, delete

## Installation

```bash
npm install @friggframework/api-module-clyde
```

## Authentication

Clyde uses HTTP Basic auth. Credentials from the Clyde Dashboard → **Developers**
are sent as `Authorization: Basic Base64(clientKey:secret)`, plus:

| Header | Content |
|--------|---------|
| `X-Auth-Timestamp` | Unix timestamp (seconds) |
| `X-Auth-Nonce` | Random nonce |
| `Content-Type` | `application/vnd.api+json` |

Docs: https://docs.joinclyde.com/reference/authentication

### Environment variables

```env
CLYDE_CLIENT_KEY=your_clyde_client_key
CLYDE_SECRET=your_clyde_secret
# Optional; defaults to https://api.joinclyde.com
CLYDE_API_BASE_URL=https://api.joinclyde.com
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-clyde');

const api = new Api({
    clientKey: process.env.CLYDE_CLIENT_KEY,
    secret: process.env.CLYDE_SECRET,
});

const products = await api.getProducts({ page: 1 });
const contracts = await api.getContracts();
const order = await api.createOrder({
    data: {
        type: 'order',
        id: '1234567890',
        attributes: {
            /* see Create Order docs */
        },
    },
});
```

## API reference (endpoints covered)

| Method | Path | Client method |
|--------|------|---------------|
| GET | `/products` | `getProducts(params)` |
| GET | `/products/{sku}` | `getProduct(sku)` |
| POST | `/products` | `createProduct(data)` |
| PUT | `/products/{sku}` | `updateProduct(sku, data)` |
| DELETE | `/products/{sku}` | `deleteProduct(sku)` |
| POST | `/products/bulk` | `createProducts(data)` |
| GET | `/products/{sku}/contracts` | `getContractsProduct(sku, params)` |
| GET | `/contracts` | `getContracts()` |
| GET | `/orders` | `getOrders(params)` |
| GET | `/orders/{orderId}` | `getOrderById(orderId)` |
| POST | `/orders` | `createOrder(data)` |
| PUT | `/orders/{orderId}` | `updateOrder(orderId, data)` |
| DELETE | `/orders/{orderId}` | `cancelOrder(orderId)` |
| PUT | `/orders/{orderId}/lineItem/{lineItemId}` | `addOrderHistoryEvent(...)` |
| GET | `/contract-sales` | `getContractSales(params)` |
| GET | `/contract-sales/{id}` | `getContractSaleById(id)` |
| PUT | `/contract-sales/{id}` | `updateContractSale(id, data)` |
| DELETE | `/contract-sales/{id}` | `cancelContractSale(id)` |
| GET | `/claims` | `getClaims(params)` |
| GET | `/contract-sales/{id}/claims/{claimId}` | `getClaimById(...)` |
| POST | `/contract-sales/{id}/claims` | `createClaim(...)` |
| GET | `/vouchers` | `getVouchers()` |
| GET | `/vouchers/{code}` | `getVoucher(code)` |
| POST | `/vouchers/bulk` | `createVouchers(data)` |
| PUT | `/vouchers/{code}` | `updateVoucher(code, data)` |
| DELETE | `/vouchers/{code}` | `deleteVoucher(code)` |

Sources: [Clyde API docs](https://docs.joinclyde.com), [Basic Authentication](https://docs.joinclyde.com/reference/authentication).

## Tests

```bash
cd packages/v1-ready/clyde && npm test
```

Offline unit tests stub `_get` / `_post` / `_put` / `_delete` — no network and
no credentials required. `tests/spec-sync.test.js` asserts every OpenAPI
`operationId` has a matching `Api` method and that the capability manifest
methods do too.
