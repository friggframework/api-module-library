# Totango API Module (`@friggframework/api-module-totango`)

A [Frigg](https://friggframework.org) API module for [Totango](https://www.totango.com)
— customer success / account health. It wraps Totango's documented REST surfaces
so a Frigg integration can search accounts and users, read health via Search
fields, list/search timeline events (touchpoints, tasks, health-change alerts),
manage tasks, and read definition lists (activity types, touchpoint types/tags).

Integrations consume it the standard Frigg way:

```javascript
const accounts = await this.totango.api.searchAccountsWithHealth({
    terms: [{ type: 'string', term: 'status_group', in_list: ['paying'] }],
    count: 100,
    offset: 0,
    scope: 'all',
});
const events = await this.totango.api.listEvents({ account_id: '19934' });
```

## Authentication

Totango personal access tokens are sent as the `app-token` header on
`api.totango.com` / `api-eu1.totango.com`:

```bash
curl 'https://api.totango.com/api/v1/search/accounts' \
  -H 'app-token: YOUR_TOKEN' \
  --data 'query={"terms":[...],"fields":[...],"count":1,"offset":0}'
```

Create a token under **Profile → Edit Profile → Integration → Create Token**.

- **Base URL (US):** `https://api.totango.com`
- **Base URL (EU):** `https://api-eu1.totango.com`
- **Rate limit:** 100 requests/minute per token

Totango also offers OAuth applications (`api-gw-us.totango.com` /
`api-gw-eu1.totango.com`). This module wires **personal access token** auth only;
OAuth is listed as an open question for a follow-up.

Set `TOTANGO_APP_TOKEN` (and optionally `TOTANGO_BASE_URL`) — see `.env.example`.

## Sources (official only)

| Topic | URL |
| --- | --- |
| API index | https://support.totango.com/hc/en-us/sections/360005893212-Totango-API |
| Personal access token | https://support.totango.com/hc/en-us/articles/203036939-Personal-Access-Token-and-Service-ID |
| Search accounts/users | https://support.totango.com/hc/en-us/articles/204174135-Search-API-accounts-and-users |
| Search events | https://support.totango.com/hc/en-us/articles/360048132792-Search-API-events |
| Touchpoints / timeline | https://support.totango.com/hc/en-us/articles/115000597266-Touchpoints-API |
| Tasks | https://support.totango.com/hc/en-us/articles/23797766837652-Tasks-API |
| OAuth + endpoint/scope table | https://support.totango.com/hc/en-us/articles/14475645271956-Create-and-manage-OAuth-applications |
| Customer Data Hub OpenAPI | https://int-hub.totango.com/integration-hub-api_openApi.json |

## API Methods

| Method | HTTP | Purpose |
| --- | --- | --- |
| `getWhoAmI()` | `GET /api/v1/users/whoami` | Current system user (schema unpublished) |
| `searchAccounts(query)` | `POST /api/v1/search/accounts` | Search accounts (form `query` JSON) |
| `searchAccountsWithHealth(query)` | same | Convenience: adds health + health_trend fields |
| `searchUsers(query)` | `POST /api/v1/search/users` | Search users/contacts |
| `listEvents(params)` | `GET /api/v2/events` | Timeline for one account |
| `searchEvents(query, opts)` | `POST /api/v2/events/search` | Search notes/tasks/alerts |
| `searchTasks(query, opts)` | same | Convenience: filter `event_type=task` |
| `getAccountPlanSummary(id)` | `GET /api/v3/accounts/{id}/plan_summary` | Plan summary |
| `createTask` / `updateTask` / `deleteTask` | Tasks API | Write tasks (read via events) |
| `listActivityTypes` / `listTouchpointTypes` / `listTouchpointTags` | `GET /api/v3/...` | Definitions |
| `getTeam(teamId)` | `GET /api/v2/teams/{id}` | Team detail |
| `getBatchStatus(batchId)` | `GET {cdh}/status/{batchId}` | CDH batch status (official OAS) |

## Mappings (ADR-057, UNVALIDATED)

- `mappings/company.js` — Account → `Company` (`business@1`)
- `mappings/contact.js` — User → `Contact` (`business@1`)
- `mappings/account-health.js` — Account health fields → `AccountHealth` (ours, sameAs-only)

Exported on `extensions.mapping`.

## Webhooks & Fenestra

**Webhooks:** Totango documents outbound SuccessPlay “Call a webhook” actions and
CDH connector notification webhooks configured in the product UI. There is **no**
documented REST API to subscribe/list/delete inbound webhook subscriptions, so
this module does **not** ship `extensions/webhooks/` (unlike HubSpot).

**Fenestra:** Totango’s marketplace is SuccessBLOC content templates; Virtual
Collections pull *external* data into Totango widgets. There is no documented
third-party UI extension SDK for embedding partner UI inside Totango, so no
`totango.fenestra.yaml` is included.

## Capability manifest

See `totango.capabilities.json` (`capability-manifest/v0.1`). Every capability
`method` maps to a real `Api` method.

## Tests

```bash
cd packages/v1-ready/totango && npm test
```

Offline unit tests cover Api URL/auth construction, Definition identity
fallbacks, OpenAPI↔client sync, and capability→method wiring.
