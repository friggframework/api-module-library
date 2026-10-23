# @friggframework/api-module-paychex

A [Frigg](https://friggframework.org) API module for **Paychex Flex External API**
(payroll / HRIS).

## Sources

Official Paychex Developer Program docs and OpenAPI only (no invented endpoints):

- [External API documentation](https://developer.paychex.com/documentation)
- [Official OpenAPI](https://developer.paychex.com/sites/default/files/apidocument/openapi-merge-develop.210-public_0.json)
- [Overview / REST + OAuth 2.0](https://developer.paychex.com/resources/overview)
- [Partner program](https://developer.paychex.com/partner) (API access requires partner approval)

## Auth

OAuth 2.0 **client credentials**. Token exchange uses
`application/x-www-form-urlencoded` against `{baseUrl}/auth/oauth/v2/token`
with `grant_type=client_credentials`, `client_id`, and `client_secret`.

Access tokens expire in ~600 seconds. There is **no refresh_token** — remint
with client credentials. Production API keys require Paychex partner approval
and sandbox provisioning.

## Base URL

| Environment | Base URL |
| --- | --- |
| Production | `https://api.paychex.com` |

Override with `PAYCHEX_BASE_URL` or constructor `baseUrl`.

## Covered endpoints

| Method | HTTP | Path |
| --- | --- | --- |
| `getTokenFromClientCredentials` | POST | `/auth/oauth/v2/token` |
| `listCompanies` / `getCompany` | GET | `/companies[/{companyId}]` |
| `listCompanyWorkers` / `createCompanyWorkers` | GET/POST | `/companies/{companyId}/workers` |
| `getWorker` / `updateWorker` | GET/PATCH | `/workers/{workerId}` |
| `listCompanyPayPeriods` / `getCompanyPayPeriod` | GET | `/companies/{companyId}/payperiods[/{payperiodId}]` |
| `listWebhookDomains` | GET | `/management/domains` |
| `listWebhooks` / `createWebhook` | GET/POST | `/management/hooks` |
| `getWebhook` / `deleteWebhook` | GET/DELETE | `/management/hooks/{hookId}` |

Skipped (not in this curated subset): checks / pay components, jobs, locations,
organizations, worker communications/contacts/compensation/taxes/documents,
`/management/requestclientaccess`, and other non-core surfaces.

## Webhooks extension

`extensions/webhooks/` mirrors HubSpot's Tier-3 pattern. Paychex authenticates
*to* the subscriber URI using the hook's `authentication` object (`NO_AUTH`,
`BASIC_AUTH`, `APIKEY`, `OAUTH2`, `OAUTH2_BASIC`). When
`PAYCHEX_WEBHOOK_API_KEY` is set, the receiver verifies APIKEY delivery.

## Fenestra

No `paychex.fenestra.yaml`. Paychex Flex External API is a backend payroll/HRIS
REST API; it does not expose host UI extension points (cards, tabs, blocks) of
the kind described by the draft Fenestra spec.

## Env

```bash
PAYCHEX_CLIENT_ID=
PAYCHEX_CLIENT_SECRET=
PAYCHEX_BASE_URL=              # optional; default https://api.paychex.com
PAYCHEX_WEBHOOK_API_KEY=       # optional; for APIKEY inbound verification
```

## Install / test

```bash
cd packages/v1-ready/paychex
npm install
npm test
```
