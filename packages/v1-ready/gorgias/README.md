# Gorgias API Module (`@friggframework/api-module-gorgias`)

A [Frigg](https://friggframework.org) API module for [Gorgias](https://gorgias.com)
— the e-commerce helpdesk. It wraps Gorgias's REST API so a Frigg integration
can authenticate via OAuth 2.0, manage tickets and customers, configure HTTP
integrations (outbound ticket-event webhooks), and create sidebar widgets.

Upgraded from the v1 package formerly at `packages/needs-updating/gorgias`.

## Authentication

Gorgias public apps use **OAuth 2.0** (authorization code). Every host is
per-account:

| Detail | Value |
|---|---|
| Authorize | `https://{subdomain}.gorgias.com/oauth/authorize` |
| Token | `https://{subdomain}.gorgias.com/oauth/token` (HTTP Basic) |
| Access token TTL | 24 hours |
| Refresh token | Non-expiring (request `offline` scope) |
| Identity | `GET /api/account` → `domain` |

The auth form collects the helpdesk **subdomain** before redirect. Set
`GORGIAS_CLIENT_ID`, `GORGIAS_CLIENT_SECRET`, `GORGIAS_SCOPE`, and
`REDIRECT_URI` (see `.env.example`).

Docs:

- [Introduction](https://developers.gorgias.com/reference/introduction)
- [OAuth2 apps](https://developers.gorgias.com/docs/oauth2-authentication-for-creating-apps-with-gorgias)
- [Scopes](https://developers.gorgias.com/docs/oauth2-scopes)

## API methods

| Method | HTTP | Purpose |
|---|---|---|
| `getAccount()` | `GET /api/account` | Account identity / settings |
| `listTickets(query)` | `GET /api/tickets` | List tickets (paginated) |
| `getTicket(id)` | `GET /api/tickets/{id}` | Retrieve a ticket |
| `createTicket(body)` | `POST /api/tickets` | Create a ticket (`messages` required) |
| `updateTicket(id, body)` | `PUT /api/tickets/{id}` | Update a ticket |
| `deleteTicket(id)` | `DELETE /api/tickets/{id}` | Delete a ticket |
| `listCustomers(query)` | `GET /api/customers` | List customers |
| `getCustomer(id)` | `GET /api/customers/{id}` | Retrieve a customer |
| `createCustomer(body)` | `POST /api/customers` | Create a customer |
| `updateCustomer(id, body)` | `PUT /api/customers/{id}` | Update a customer |
| `deleteCustomer(id)` | `DELETE /api/customers/{id}` | Delete a customer |
| `listIntegrations(query)` | `GET /api/integrations` | List integrations (use `type=http`) |
| `getIntegration(id)` | `GET /api/integrations/{id}` | Retrieve an integration |
| `createIntegration(body)` | `POST /api/integrations` | Create HTTP integration / webhook |
| `updateIntegration(id, body)` | `PUT /api/integrations/{id}` | Update an integration |
| `deleteIntegration(id)` | `DELETE /api/integrations/{id}` | Delete an integration |
| `listWidgets(query)` | `GET /api/widgets` | List sidebar widgets |
| `getWidget(id)` | `GET /api/widgets/{id}` | Retrieve a widget |
| `createWidget(body)` | `POST /api/widgets` | Create a sidebar widget |
| `updateWidget(id, body)` | `PUT /api/widgets/{id}` | Update a widget |
| `deleteWidget(id)` | `DELETE /api/widgets/{id}` | Delete a widget |

## Webhooks

Gorgias has **no** dedicated `/webhooks` resource. Outbound delivery on ticket
events is configured via **HTTP integrations** (`type: http`) with
`http.triggers` such as `ticket-created`, `ticket-updated`, and
`ticket-message-created`. See
[Create integrations and widgets](https://developers.gorgias.com/docs/create-integrations-and-widgets-programmatically).

## Package layout

- `api.js` / `definition.js` / `index.js` — Frigg v2 module surface
- `gorgias.openapi.yaml` — curated OpenAPI subset (1:1 with client methods)
- `gorgias.capabilities.json` — `capability-manifest/v0.1`
- `gorgias.fenestra.yaml` — draft UI-extension surface for sidebar widgets

## Tests

```bash
cd packages/v1-ready/gorgias
npm install
npm test
```
