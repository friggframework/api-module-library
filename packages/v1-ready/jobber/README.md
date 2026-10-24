# Jobber API Module (`@friggframework/api-module-jobber`)

A [Frigg](https://friggframework.org) API module for [Jobber](https://www.getjobber.com)
— home-service business management. It wraps Jobber's **GraphQL** Developer API
(OAuth 2.0) so a Frigg integration can work with clients, jobs, quotes,
invoices, and inbound webhooks.

Integrations consume it the standard Frigg way:

```javascript
const clients = await this.jobber.api.listClients({ first: 25 });
const job = await this.jobber.api.getJob(encodedId);
```

## Authentication

Jobber uses **OAuth 2.0 authorization-code** grant. Create an app in the
[Developer Center](https://developer.getjobber.com/), configure scopes there,
and set:

| Env | Purpose |
|---|---|
| `JOBBER_CLIENT_ID` | App client id |
| `JOBBER_CLIENT_SECRET` | App client secret (also used to verify webhooks) |
| `REDIRECT_URI` | Shared Frigg redirect base; module uses `{REDIRECT_URI}/jobber` |
| `JOBBER_GRAPHQL_VERSION` | Optional; defaults to `2025-04-16` |

- **Authorize:** `https://api.getjobber.com/api/oauth/authorize`
- **Token:** `https://api.getjobber.com/api/oauth/token`
- **GraphQL:** `POST https://api.getjobber.com/api/graphql`
- **Headers:** `Authorization: Bearer …`, `X-JOBBER-GRAPHQL-VERSION`, `Content-Type: application/json`

Access tokens expire after 60 minutes; refresh tokens are long-lived (and may
rotate). After token exchange the module identifies the account via
`account { id name }`.

Docs: [App Authorization](https://developer.getjobber.com/docs/building_your_app/app_authorization/).

## API Methods

| Method | GraphQL | Purpose |
|---|---|---|
| `getAccount()` | `account` | Authorized account id/name |
| `listClients(params)` | `clients` | Paginated clients |
| `getClient(id)` | `client(id:)` | Single client |
| `createClient(input)` | `clientCreate` | Create client |
| `editClient(clientId, input)` | `clientEdit` | Update client |
| `listJobs(params)` | `jobs` | Paginated jobs |
| `getJob(id)` | `job(id:)` | Single job |
| `createJob(input)` | `jobCreate` | Create job |
| `editJob(jobId, input)` | `jobEdit` | Update job |
| `listQuotes(params)` | `quotes` | Paginated quotes |
| `getQuote(id)` | `quote(id:)` | Single quote |
| `createQuote(input)` | `quoteCreate` | Create quote |
| `editQuote(quoteId, input)` | `quoteEdit` | Update quote |
| `listInvoices(params)` | `invoices` | Paginated invoices |
| `getInvoice(id)` | `invoice(id:)` | Single invoice |
| `editInvoice(invoiceId, input)` | `invoiceEdit` | Update invoice |
| `appDisconnect()` | `appDisconnect` | Disconnect app (marketplace) |
| `graphql(query, variables)` | — | Raw GraphQL transport |

Pagination params: `first` (default 25), `after` (cursor). Always pass
`first`/`last` on collection queries per Jobber rate-limit guidance.

## Webhooks

Webhook **subscriptions are configured in the Developer Center** (not via
GraphQL). This package ships a Tier-3 extension under `extensions/webhooks/`
that:

1. Verifies `X-Jobber-Hmac-SHA256` (HMAC-SHA256 of the raw body with the client secret)
2. Routes by `accountId` → Frigg integration
3. Exposes `JOBBER_WEBHOOK` for consumers to override

Payload shape (apps after 2023-12-08):

```json
{
  "data": {
    "webHookEvent": {
      "topic": "CLIENT_CREATE",
      "appId": "...",
      "accountId": "...",
      "itemId": "...",
      "occurredAt": "..."
    }
  }
}
```

Fetch the object with `getClient` / `getJob` / `getQuote` / `getInvoice` using
`itemId`. Respond within 1 second; delivery is at-least-once.

Docs: [Setting Up Webhooks](https://developer.getjobber.com/docs/using_jobbers_api/setting_up_webhooks/).

## Fenestra

No `jobber.fenestra.yaml`. Jobber's App Marketplace / Developer API does not
document in-product UI extension points (cards, iframes, Block Kit-style
surfaces) comparable to HubSpot UI Extensions or Slack Block Kit. Webhooks +
GraphQL are the integration surface.

## Sources

- https://developer.getjobber.com/docs/
- https://developer.getjobber.com/docs/building_your_app/app_authorization/
- https://developer.getjobber.com/docs/using_jobbers_api/api_queries_and_mutations/
- https://developer.getjobber.com/docs/using_jobbers_api/api_rate_limits/
- https://developer.getjobber.com/docs/using_jobbers_api/setting_up_webhooks/
- https://developer.getjobber.com/docs/changelog/

## Tests

```bash
cd packages/v1-ready/jobber && npm test
```
