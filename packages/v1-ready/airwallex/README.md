# Airwallex API Module (`@friggframework/api-module-airwallex`)

A [Frigg](https://friggframework.org) API module for [Airwallex](https://www.airwallex.com)
— global accounts, treasury, payment acceptance, and card issuing. It wraps a
curated subset of the Airwallex Client API so a Frigg integration can authenticate,
read the connected account, manage balances/transfers/beneficiaries, payment
acceptance objects, issuing cards, and webhook subscriptions.

Integrations consume it the standard Frigg way:

```javascript
const account = await this.airwallex.api.getAccount();
const balances = await this.airwallex.api.listCurrentBalances();
```

## Authentication

Airwallex Client API auth exchanges an **API key** + **client id** for a
short-lived bearer token:

```bash
curl -X POST https://api.sandbox.airwallex.com/api/v1/authentication/login \
  -H "x-api-key: YOUR_API_KEY" \
  -H "x-client-id: YOUR_CLIENT_ID"
```

Use the returned `token` as `Authorization: Bearer <token>` on subsequent calls.
Tokens last ~30 minutes; reuse until `expires_at`. Optional `x-login-as` selects
an account when a scoped key is linked to multiple accounts.

- **Production base URL:** `https://api.airwallex.com`
- **Sandbox base URL:** `https://api.sandbox.airwallex.com`

Set `AIRWALLEX_CLIENT_ID`, `AIRWALLEX_API_KEY`, and optionally `AIRWALLEX_BASE_URL`
(see `.env.example`). The module also exposes a JSON Schema authorization form
(`getAuthorizationRequirements`) so credentials can be collected through the
Frigg auth UI / `frigg auth` CLI.

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `login()` | `POST /api/v1/authentication/login` | Mint bearer token from api key + client id. |
| `getAccount()` | `GET /api/v1/account` | Connected account (identity). |
| `listCurrentBalances(params)` | `GET /api/v1/balances/current` | Current wallet balances. |
| `listBalanceHistory(params)` | `GET /api/v1/balances/history` | Balance history. |
| `listFinancialTransactions(params)` | `GET /api/v1/financial_transactions` | List financial transactions. |
| `getFinancialTransaction(id)` | `GET /api/v1/financial_transactions/{id}` | Get one financial transaction. |
| `listBeneficiaries(params)` | `GET /api/v1/beneficiaries` | List beneficiaries. |
| `getBeneficiary(id)` | `GET /api/v1/beneficiaries/{id}` | Get beneficiary. |
| `createBeneficiary(data)` | `POST /api/v1/beneficiaries/create` | Create beneficiary. |
| `updateBeneficiary(id, data)` | `POST /api/v1/beneficiaries/{id}/update` | Update beneficiary. |
| `listTransfers(params)` | `GET /api/v1/transfers` | List transfers. |
| `getTransfer(id)` | `GET /api/v1/transfers/{id}` | Get transfer. |
| `createTransfer(data)` | `POST /api/v1/transfers/create` | Create transfer. |
| `listCustomers(params)` | `GET /api/v1/pa/customers` | List PA customers. |
| `getCustomer(id)` | `GET /api/v1/pa/customers/{id}` | Get PA customer. |
| `createCustomer(data)` | `POST /api/v1/pa/customers/create` | Create PA customer. |
| `updateCustomer(id, data)` | `POST /api/v1/pa/customers/{id}/update` | Update PA customer. |
| `listPaymentAttempts(params)` | `GET /api/v1/pa/payment_attempts` | List payment attempts. |
| `getPaymentAttempt(id)` | `GET /api/v1/pa/payment_attempts/{id}` | Get payment attempt. |
| `createPaymentLink(data)` | `POST /api/v1/pa/payment_links/create` | Create payment link. |
| `getPaymentLink(id)` | `GET /api/v1/pa/payment_links/{id}` | Get payment link. |
| `notifyPaymentLinkShopper(id, data)` | `POST /api/v1/pa/payment_links/{id}/notify_shopper` | Email/notify shopper. |
| `listCharges(params)` | `GET /api/v1/charges` | List charges. |
| `getCharge(id)` | `GET /api/v1/charges/{id}` | Get charge. |
| `listCards(params)` | `GET /api/v1/issuing/cards` | List issuing cards. |
| `getCard(id)` | `GET /api/v1/issuing/cards/{id}` | Get card. |
| `createCard(data)` | `POST /api/v1/issuing/cards/create` | Create card. |
| `listCardLimits(id)` | `GET /api/v1/issuing/cards/{id}/limits` | Remaining card limits. |
| `createCardholder(data)` | `POST /api/v1/issuing/cardholders/create` | Create cardholder. |
| `listWebhooks(params)` | `GET /api/v1/webhooks` | List webhooks. |
| `getWebhook(id)` | `GET /api/v1/webhooks/{id}` | Get webhook. |
| `createWebhook(data)` | `POST /api/v1/webhooks/create` | Create webhook. |
| `updateWebhook(id, data)` | `POST /api/v1/webhooks/{id}/update` | Update webhook. |
| `deleteWebhook(id)` | `POST /api/v1/webhooks/{id}/delete` | Delete webhook. |

## Capability manifest & Fenestra

- `airwallex.capabilities.json` — capability-manifest/v0.1 declaring objects and
  Api methods for account, balances, beneficiaries, transfers, PA customers,
  payment attempts/links, charges, cards, and webhooks.
- **No `airwallex.fenestra.yaml`.** Airwallex documents Embedded Components and
  a Partner OAuth surface for connecting business accounts, but it does not
  expose Frigg-style UI extension points (cards/blocks in a host app) comparable
  to HubSpot UI extensions. Fenestra is omitted until such host UI surfaces exist.

## Testing

```bash
cd packages/v1-ready/airwallex
npm install
npm test
```

Tests are fully offline — HTTP methods are stubbed and assertions are made on the
request options the module builds. No API key or network access is required.

`frigg auth test .` needs real sandbox credentials and is marked pending until
those are available.

## Sources

- Airwallex API reference — https://www.airwallex.com/docs/api
- Obtain access token — https://www.airwallex.com/docs/api/authentication/api_access_token/login
- Manage API keys — https://www.airwallex.com/docs/developer-tools/api/manage-api-keys
- Official OpenAPI — https://github.com/airwallex/airwallex-openapi
- Webhooks — https://www.airwallex.com/docs/developer-tools/webhooks

## Prior work

Upgraded from the v1 package previously at `packages/needs-updating/airwallex/`
(Mongoose `manager.js` / credential models removed; working, doc-verified methods
kept and paths aligned to the current OpenAPI — e.g. beneficiary update is
`POST /api/v1/beneficiaries/{id}/update`).

## License

MIT — see [LICENSE.md](./LICENSE.md).
