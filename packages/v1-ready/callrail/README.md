# CallRail API Module (`@friggframework/api-module-callrail`)

A [Frigg](https://friggframework.org) API module for [CallRail](https://www.callrail.com)
— call tracking and conversation intelligence. It wraps CallRail's public REST
API v3 so a Frigg integration can list accounts/companies, sync calls and form
submissions, send texts, read trackers/users, and manage webhook integrations.

```javascript
const { accounts } = await this.callrail.api.listAccounts();
const { calls } = await this.callrail.api.listCalls(accountId, {
    company_id: companyId,
});
```

## Authentication

CallRail uses **user-scoped API keys** (not OAuth) for the v3 REST API. Create a
key under **Integrations → API Keys**. Every request sends:

```http
Authorization: Token token="YOUR_API_KEY"
```

- **Base URL:** `https://api.callrail.com/v3`
- **Docs:** https://apidocs.callrail.com/
- **Rate limits (default):** 1,000/hour and 10,000/day (SMS send and outbound
  call have separate lower caps).

Set `CALLRAIL_API_KEY` in your environment (see `.env.example`). Optionally set
`CALLRAIL_REQUEST_FROM` so third-party integrations identify themselves via the
`Request-From` header.

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `listAccounts` / `getAccount` | `GET /a.json`, `GET /a/{id}.json` | Account identity |
| `listCompanies` / `getCompany` / `createCompany` / `updateCompany` | `/a/{id}/companies…` | Companies |
| `listCalls` / `getCall` / `createCall` / `updateCall` | `/a/{id}/calls…` | Calls |
| `listFormSubmissions` / `createFormSubmission` / `updateFormSubmission` | `/a/{id}/form_submissions…` | Forms |
| `listTextConversations` / `getTextConversation` / `sendTextMessage` | `/a/{id}/text-messages…` | SMS/MMS |
| `listTrackers` / `getTracker` | `/a/{id}/trackers…` | Tracking numbers |
| `listUsers` / `getUser` | `/a/{id}/users…` | Users |
| `listIntegrations` / `getIntegration` / `createIntegration` / `updateIntegration` / `deleteIntegration` | `/a/{id}/integrations…` | Webhook subscriptions (`type: Webhooks`) |

## Webhooks

CallRail models webhooks as **Integrations** with `type: "Webhooks"`. Create one
per company with URL arrays in `config` (`post_call_webhook`,
`sms_received_webhook`, etc.). Payloads are signed with HMAC-SHA1; the
`Signature` header is verified using the company `signing_key` returned on
create (or via `fields=signing_key`).

## Capability manifest

See `callrail.capabilities.json` (`capability-manifest/v0.1`).

## Fenestra

No `callrail.fenestra.yaml`. CallRail's public developer surface is REST +
webhooks only; there are no documented third-party UI extension points
(sidebars, widgets, iframes) for Frigg Fenestra to declare.

## Tests

```bash
cd packages/v1-ready/callrail && npm test
```
