# Gorgias API Module (`@friggframework/api-module-gorgias`)

A [Frigg](https://friggframework.org) API module for [Gorgias](https://www.gorgias.com)
— the ecommerce helpdesk. It wraps Gorgias's public REST API so a Frigg
integration can read/write tickets, messages, customers, users, tags, and
satisfaction surveys; manage HTTP integrations (webhook-style subscriptions)
and sidebar widgets; and receive HTTP integration callbacks.

Integrations consume it the standard Frigg way:

```javascript
const tickets = await this.gorgias.api.listTickets({ limit: 30 });
const account = await this.gorgias.api.getAccount();
```

## Authentication

### OAuth2 (public apps — required for App Store)

Per-account subdomain. Authorization and token URLs:

- `https://{subdomain}.gorgias.com/oauth/authorize`
- `https://{subdomain}.gorgias.com/oauth/token`

Docs: [Set up OAuth2](https://developers.gorgias.com/docs/set-up-oauth2-app-store),
[Scopes](https://developers.gorgias.com/docs/oauth2-scopes).

Set `GORGIAS_CLIENT_ID`, `GORGIAS_CLIENT_SECRET`, `GORGIAS_SCOPES`, and
`REDIRECT_URI` (see `.env.example`). The Definition collects `subdomain` via
`getAuthorizationRequirements`, then `getToken` exchanges the code with HTTP
Basic client credentials.

### HTTP Basic (private apps only)

Username = account email, password = API key from **Settings → REST API**.
Docs: [Access Tokens](https://developers.gorgias.com/docs/access-tokens-api-keys).

```javascript
api.setBasicAuth({
  subdomain: 'acme',
  api_user_email: 'agent@acme.com',
  api_key: '…',
});
```

## Base URL

`https://{domain}.gorgias.com/api` — every request is account-scoped.

## API Methods (OpenAPI `operationId` ↔ `Api` method)

| Method | HTTP | Purpose |
|---|---|---|
| `getAccount` | `GET /account` | Account identity / auth check |
| `listTickets` / `getTicket` / `createTicket` / `updateTicket` / `deleteTicket` | `/tickets` | Tickets |
| `listMessages` / `getMessage` / `createTicketMessage` | `/messages`, `/tickets/{id}/messages` | Messages |
| `listCustomers` / `getCustomer` / `createCustomer` / `updateCustomer` / `deleteCustomer` | `/customers` | Customers |
| `listUsers` / `getUser` | `/users` | Agents / users (`id=0` = current user) |
| `listTags` / `getTag` | `/tags` | Tags |
| `listSatisfactionSurveys` / `getSatisfactionSurvey` | `/satisfaction-surveys` | CSAT |
| `listIntegrations` / `getIntegration` / `createIntegration` / `updateIntegration` / `deleteIntegration` | `/integrations` | HTTP integrations / webhook subscriptions |
| `listWidgets` / `getWidget` / `createWidget` / `updateWidget` / `deleteWidget` | `/widgets` | Sidebar widgets |

## Extensions

- **`extensions.webhooks`** — Tier 3 receiver for Gorgias HTTP Integration
  callbacks (`POST …/webhooks?account={subdomain}`). Pattern follows HubSpot.
- **`extensions.mapping`** — `mappings/ticket.js` maps Gorgias Ticket fields to
  canonical `support@1` (Merge Ticketing names). Labeled **UNVALIDATED**.

## Capabilities & Fenestra

- `gorgias.capabilities.json` — capability-manifest/v0.1 for wired objects/ops.
- `gorgias.fenestra.yaml` — draft UI surfaces (ticket/customer sidebar widgets +
  HTTP integrations). Validate with the fenestra CLI from branch
  `claude/fenestra-spec-draft-Q367t`.

## Prior work

Upgraded in place from `packages/needs-updating/gorgias` (Manager/models era).
Fixes from that package: hard-coded OAuth `state`, literal `{{subdomain}}` in
the auth URL, and `updateTicket` / get/delete ticket URL helper typos
(`ticketById` vs `ticketsById`).

## Sources

- https://developers.gorgias.com/reference/introduction
- https://developers.gorgias.com/docs/set-up-oauth2-app-store
- https://developers.gorgias.com/docs/access-tokens-api-keys
- https://developers.gorgias.com/docs/create-integrations-and-widgets-programmatically
