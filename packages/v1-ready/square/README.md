# @friggframework/api-module-square

A Frigg API module for [Square](https://developer.squareup.com/) — the commerce
platform for payments, customers, invoices, and seller operations. This module
lets a Frigg integration connect via OAuth 2.0 and call Square's Connect API for
merchants/locations, customers, payments, invoices, and webhook subscriptions.

## Features

- OAuth 2.0 authorization-code flow (JSON `ObtainToken` / refresh)
- `Square-Version` request header (default from Square's published OpenAPI)
- Merchants & locations (list/get/create/update)
- Customers (list/get/create/update)
- Payments (list/get/create/update)
- Invoices (list/get/create/update)
- Webhook subscription management + Tier-3 receiver extension
- Capability manifest (`square.capabilities.json`) and Fenestra draft (`square.fenestra.yaml`)

## Sources

- Docs: https://developer.squareup.com/docs
- OAuth: https://developer.squareup.com/docs/oauth-api/overview
- OpenAPI: https://github.com/square/connect-api-specification (`api.json`)
- Webhooks verify: https://developer.squareup.com/docs/webhooks/step3validate

## Installation

```bash
npm install @friggframework/api-module-square
```

## Authentication

Square uses OAuth 2.0. Create an application in the
[Developer Console](https://developer.squareup.com/apps), configure the redirect
URL, and request the permission scopes your integration needs.

### Environment variables

```env
SQUARE_CLIENT_ID=
SQUARE_CLIENT_SECRET=
SQUARE_SCOPE=MERCHANT_PROFILE_READ CUSTOMERS_READ CUSTOMERS_WRITE PAYMENTS_READ PAYMENTS_WRITE INVOICES_READ INVOICES_WRITE
REDIRECT_URI=https://your-app.example/redirect
# Optional sandbox host:
# SQUARE_BASE_URL=https://connect.squareupsandbox.com
# SQUARE_VERSION=2026-09-16
```

The module's redirect URI is `${REDIRECT_URI}/square`.

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-square');

const api = new Api({
    client_id: process.env.SQUARE_CLIENT_ID,
    client_secret: process.env.SQUARE_CLIENT_SECRET,
    redirect_uri: `${process.env.REDIRECT_URI}/square`,
    scope: process.env.SQUARE_SCOPE,
    access_token: '...',
    refresh_token: '...',
});

const me = await api.retrieveMerchant('me');
const customers = await api.listCustomers({ limit: 50 });
```

## Webhooks extension

`extensions/webhooks/` is a HubSpot-style Tier-3 bundle:

- Verifies `x-square-hmacsha256-signature` (HMAC-SHA256 over `notificationUrl + body`)
- Resolves `merchant_id` → Frigg integration
- Env: `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_WEBHOOK_NOTIFICATION_URL`

## Tests

```bash
cd packages/v1-ready/square && npm test
```

## License

MIT
