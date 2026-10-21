# Planhat API Module (`@friggframework/api-module-planhat`)

A [Frigg](https://friggframework.org) API module for [Planhat](https://www.planhat.com)
— customer success / account health. It wraps Planhat's Main REST API so a Frigg
integration can list and manage companies, endusers (contacts), tasks (CTAs),
conversations (timeline), custom fields, and team users. Health scores are read
from Company fields (`h`, `hProfile`, `csmScore`).

Integrations consume it the standard Frigg way:

```javascript
const companies = await this.planhat.api.listCompanies({ limit: 100 });
const health = await this.planhat.api.getCompanyHealth(companyId);
```

## Authentication

Planhat uses a **Private App API Access Token**. Create one under
**Settings → Private Apps**. The module sends it on every request as:

```bash
curl https://api.planhat.com/companies \
  -H "Authorization: Bearer YOUR_API_ACCESS_TOKEN"
```

Docs also allow Basic auth with a trailing colon after the token; this module
uses Bearer only.

- **Base URL:** `https://api.planhat.com`
- **Soft quota:** 200 calls/minute on the main API (hard limit 150 rps).

Set `PLANHAT_API_TOKEN` in your environment (see `.env.example`).

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `listCompanies(query)` | `GET /companies` | List companies (limit/offset). |
| `getCompany(id)` | `GET /companies/{id}` | Get one company (health fields included). |
| `listLeanCompanies(query)` | `GET /leancompanies` | Lightweight id/name list. |
| `createCompany(body)` / `updateCompany(id, body)` | `POST` / `PUT` | Write companies. |
| `getCompanyHealth(id)` | — | Convenience projection of company health fields. |
| `listEndusers` / `getEnduser` / `createEnduser` / `updateEnduser` | `/endusers` | Contacts. |
| `listTasks` / `getTask` / `createTask` / `updateTask` | `/tasks` | CTAs / tasks. |
| `listConversations` / `getConversation` / … | `/conversations` | Timeline / activities. |
| `listCustomFields` / `getCustomField` | `/customfields` | Custom field definitions. |
| `listUsers` / `getUser` | `/users` | Team users (also used for identity). |

## Out of scope

- **Analytics API** (`https://analytics.planhat.com`) — user activities and
  dimension metrics use a separate Tenant Token.
- **Webhook subscription REST CRUD** — Planhat configures webhooks in
  Automations only; there is no documented Main API for subscription management.
- **Fenestra** — Planhat does not document third-party UI extension points
  (cards / iframes / sidebar apps) for marketplace embeds.

## Docs

- https://www.planhat.com/developers/api/introduction
- https://www.planhat.com/developers/api/authentication-limits
- https://www.planhat.com/developers/api/company
