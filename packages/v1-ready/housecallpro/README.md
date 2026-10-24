# Housecall Pro API Module (`@friggframework/api-module-housecallpro`)

A [Frigg](https://friggframework.org) API module for [Housecall Pro](https://www.housecallpro.com)
— home-services field management. It wraps the **Public REST API** (OAuth 2.0)
so a Frigg integration can work with company identity, customers, jobs,
estimates, invoices, employees, leads, and inbound webhooks.

Integrations consume it the standard Frigg way:

```javascript
const customers = await this.housecallpro.api.listCustomers({ page_size: 25 });
const job = await this.housecallpro.api.getJob(jobId);
```

## Authentication

Housecall Pro supports **OAuth 2.0 authorization-code** for apps and
**API keys** (`Authorization: Token …`) for Pros. This module implements the
OAuth connected-app path.

| Env | Purpose |
|---|---|
| `HOUSECALLPRO_CLIENT_ID` | App client id |
| `HOUSECALLPRO_CLIENT_SECRET` | App client secret |
| `REDIRECT_URI` | Shared Frigg redirect base; module uses `{REDIRECT_URI}/housecallpro` |
| `HOUSECALLPRO_SCOPE` | Optional; defaults to `public` |
| `HOUSECALLPRO_WEBHOOK_SECRET` | Optional; Webhooks app signing secret |
| `HOUSECALLPRO_COMPANY_ID` | Optional default `X-Company-Id` for multi-location |

- **Authorize:** `https://pro.housecallpro.com/oauth/authorize`
- **Token:** `POST https://api.housecallpro.com/oauth/token` (JSON body)
- **API:** `https://api.housecallpro.com`
- **Headers:** `Authorization: Bearer …`, optional `X-Company-Id`

After token exchange the module identifies the account via `GET /company`.

Docs: [Authentication](https://docs.housecallpro.com/docs/housecall-public-api/b87d37ae48a0d-authentication).

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getCompany()` | `GET /company` | Authenticated company / identity |
| `listCustomers(params)` | `GET /customers` | Paginated customers |
| `getCustomer(id)` | `GET /customers/{id}` | Single customer |
| `createCustomer(data)` | `POST /customers` | Create customer |
| `updateCustomer(id, data)` | `PUT /customers/{id}` | Update customer |
| `listJobs(params)` | `GET /jobs` | Paginated jobs |
| `getJob(id)` | `GET /jobs/{id}` | Single job |
| `createJob(data)` | `POST /jobs` | Create job |
| `updateJobSchedule(id, data)` | `PUT /jobs/{id}/schedule` | Update job schedule |
| `listEmployees(params)` | `GET /employees` | Employees |
| `getEmployee(id)` | `GET /employees/{id}` | Single employee |
| `listEstimates(params)` | `GET /estimates` | Estimates |
| `getEstimate(id)` | `GET /estimates/{id}` | Single estimate |
| `createEstimate(data)` | `POST /estimates` | Create estimate |
| `listInvoices(params)` | `GET /invoices` | Invoices |
| `getInvoice(id)` | `GET /invoices/{id}` | Single invoice |
| `listLeads(params)` | `GET /leads` | Leads |
| `getLead(id)` | `GET /leads/{id}` | Single lead |
| `createLead(data)` | `POST /leads` | Create lead |

## Webhooks

Webhook **subscriptions are configured in the Housecall Pro Webhooks app**
([How to Enable Webhooks](https://help.housecallpro.com/en/articles/5683520-how-to-enable-webhooks))
— not via a verified public subscribe REST surface on Stoplight. This package
ships a Tier-3 extension under `extensions/webhooks/` that:

1. Verifies `Api-Signature` / `Api-Timestamp` (HMAC-SHA256 of `timestamp.body`)
2. Routes by `company_id` → Frigg integration
3. Exposes `HOUSECALLPRO_WEBHOOK` for consumers to override

Docs: [Webhooks](https://docs.housecallpro.com/docs/housecall-public-api/46e9e1be07621-webhooks).

## Capability manifest

See `housecallpro.capabilities.json` (`capability-manifest/v0.1`).

## Fenestra

No `housecallpro.fenestra.yaml`. Fenestra describes platform **UI extension
points** (CRM cards, sidebars, etc.). Housecall Pro's public surface for this
module is a REST API without a documented UI-extension SDK comparable to
HubSpot/Salesforce examples in the Fenestra draft.

## Tests

```bash
cd packages/v1-ready/housecallpro
npm install
npm test
```

## Sources

- https://docs.housecallpro.com/
- https://help.housecallpro.com/en/articles/8505035-api-overview
- https://help.housecallpro.com/en/articles/5683520-how-to-enable-webhooks
