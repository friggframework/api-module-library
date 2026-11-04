# `@friggframework/api-module-copper`

Frigg v2 API module for [Copper CRM](https://www.copper.com) (Developer API).

## Sources

- Developer hub: https://developer.copper.com/
- Authentication: https://developer.copper.com/introduction/authentication.html
- Request headers: https://developer.copper.com/introduction/requests.html
- Account: https://developer.copper.com/account-and-users/fetch-account-details.html
- People / Companies / Opportunities / Leads search + CRUD pages under the same docs site
- Webhooks: https://developer.copper.com/webhooks/overview.html

Copper does not publish a single downloadable full OpenAPI document for the Developer API. `copper.openapi.yaml` is a hand-curated subset covering exactly the endpoints implemented in `api.js`.

## Auth

API key auth (no partner registration required):

| Header | Value |
|---|---|
| `X-PW-AccessToken` | API key from System settings → API Keys |
| `X-PW-Application` | `developer_api` |
| `X-PW-UserEmail` | Email of the token owner |
| `Content-Type` | `application/json` |

Form fields: `api_key`, `user_email`. Identity: `GET /account` → `id` / `name`.

OAuth 2.0 Authorization Code (`scope=developer/v1/all`) is documented for partner integrations and requires registering with `partners@copper.com` — not implemented in this module yet.

## Covered surface

- Account: `getAccount`
- People: `listPeople`, `getPerson`, `createPerson`, `updatePerson`
- Companies: `listCompanies`, `getCompany`, `createCompany`, `updateCompany`
- Opportunities: `listOpportunities`, `getOpportunity`, `createOpportunity`, `updateOpportunity`
- Leads: `listLeads`, `getLead`, `createLead`, `updateLead`
- Webhooks: `listWebhooks`, `createWebhook`, `updateWebhook`, `deleteWebhook`
- Inbound receiver: `extensions/webhooks/` (Tier 3, optional secret/header check)

## Local test

```bash
cd packages/v1-ready/copper
npm install
npm test
```

## Env

See `.env.example` (`COPPER_API_KEY`, `COPPER_USER_EMAIL`, optional webhook secret/header).
