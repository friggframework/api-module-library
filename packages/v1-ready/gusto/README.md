# @friggframework/api-module-gusto

A [Frigg](https://friggframework.org) API module for **Gusto App Integrations**
(HRIS / payroll).

## Sources

- [Introduction](https://docs.gusto.com/app-integrations/docs/introduction)
- [OAuth2](https://docs.gusto.com/app-integrations/docs/oauth2)
- [Authentication](https://docs.gusto.com/app-integrations/docs/authentication)
- [Scopes](https://docs.gusto.com/app-integrations/docs/scopes)
- [Webhooks](https://docs.gusto.com/app-integrations/docs/webhooks)
- API reference under https://docs.gusto.com/app-integrations/reference/

## Auth

OAuth2 authorization-code. The admin selects one company during authorize;
tokens are company-scoped (strict access since `v2023-05-01`). Token exchange
uses **JSON** bodies against `{baseUrl}/oauth/token`. Access tokens expire in
2 hours; refresh tokens are single-use and rotate.

Webhook subscription CRUD requires a **system-level** Bearer token
(`system_access_token` / Developer Portal organization token). Company OAuth
tokens cover companies, employees, and payrolls.

Scopes are assigned to the application in the Developer Portal / during Gusto
review — they are **not** passed on the authorize URL.

## Base URL

| Environment | Base URL |
| --- | --- |
| Production | `https://api.gusto.com` |
| Demo / sandbox | `https://api.gusto-demo.com` |

Override with `GUSTO_BASE_URL` or constructor `baseUrl`. Every request sends
`X-Gusto-API-Version` (default `2026-06-15`).

## Covered endpoints

| Method | HTTP | Path |
| --- | --- | --- |
| `getTokenInfo` | GET | `/v1/token_info` |
| `getCompany` / `updateCompany` | GET/PUT | `/v1/companies/{company_id}` |
| `listEmployees` / `createEmployee` | GET/POST | `/v1/companies/{company_id}/employees` |
| `getEmployee` / `updateEmployee` | GET/PUT | `/v1/employees/{employee_id}` |
| `listPayrolls` | GET | `/v1/companies/{company_id}/payrolls` |
| `getPayroll` | GET | `/v1/companies/{company_id}/payrolls/{payroll_id}` |
| `listWebhookSubscriptions` / `createWebhookSubscription` | GET/POST | `/v1/webhook_subscriptions` |
| `getWebhookSubscription` / `updateWebhookSubscription` / `deleteWebhookSubscription` | GET/PUT/DELETE | `/v1/webhook_subscriptions/{uuid}` |
| `verifyWebhookSubscription` | PUT | `/v1/webhook_subscriptions/{uuid}/verify` |

Skipped (not in this curated subset): partner-managed company provisioning,
payroll create/submit/calculate flows, contractors, benefits, jobs/
compensations writes, locations, forms, and the Events polling API.

## Webhooks extension

`extensions/webhooks/` mirrors HubSpot's Tier-3 pattern: verify
`X-Gusto-Signature` (HMAC-SHA256 with the subscription `verification_token`),
enqueue resolve by `resource_uuid`, then deliver `GUSTO_WEBHOOK`.

## Fenestra

No `gusto.fenestra.yaml`. Gusto App Integrations is a backend payroll/HRIS REST
API; it does not expose host UI extension points (cards, tabs, blocks) of the
kind Fenestra describes.

## Env

```bash
GUSTO_CLIENT_ID=
GUSTO_CLIENT_SECRET=
GUSTO_SCOPE=          # documented for operators; not sent on authorize
GUSTO_BASE_URL=       # optional; default https://api.gusto.com
REDIRECT_URI=         # Frigg callback root; module appends /gusto
GUSTO_WEBHOOK_VERIFICATION_TOKEN=  # for inbound signature checks
```

## Install / test

```bash
npm install
npm test
```
