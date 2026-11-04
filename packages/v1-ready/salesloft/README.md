# Salesloft API Module (`@friggframework/api-module-salesloft`)

A [Frigg](https://friggframework.org) API module for [Salesloft](https://salesloft.com)
— the sales engagement platform. It wraps Salesloft's public REST API so a Frigg
integration can manage people, accounts, users, tasks, and webhook subscriptions.

```javascript
const people = await this.salesloft.api.listPeople({ per_page: 50 });
const person = await this.salesloft.api.createPerson({
    email_address: 'buyer@acme.com',
    first_name: 'Ada',
    last_name: 'Lovelace',
});
```

## Authentication

Salesloft partners use **OAuth 2.0 Authorization Code**:

| Step | URL |
|---|---|
| Authorize | `https://accounts.salesloft.com/oauth/authorize` |
| Token | `https://accounts.salesloft.com/oauth/token` |

API requests send `Authorization: Bearer <access_token>`. Refresh tokens are
supported (`grant_type=refresh_token`); Salesloft revokes the previous refresh
token when a new one is issued.

Docs: [OAuth - Authorization Code](https://developers.salesloft.com/docs/platform/api-basics/oauth-authentication/)

Set `SALESLOFT_CLIENT_ID`, `SALESLOFT_CLIENT_SECRET`, and `REDIRECT_URI` (see
`.env.example`). Customer-only API keys exist but are **not** used by this
partner module.

## Base URL & conventions

- **Base URL:** `https://api.salesloft.com/v2` (no `.json` path suffix)
- **Envelope:** `{ data, metadata }` ([request/response format](https://developers.salesloft.com/docs/platform/api-basics/request-response-format/))
- **Pagination:** `page` (1-based), `per_page` (1–100)
- **Rate limit:** 600 cost/minute team-wide

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getMe()` | `GET /me` | Authenticated user |
| `getTeam()` | `GET /team` | Authenticated team (entity externalId) |
| `listPeople(params)` | `GET /people` | List people |
| `getPerson(id)` | `GET /people/{id}` | Fetch person |
| `createPerson(person)` | `POST /people` | Create person |
| `updatePerson(id, person)` | `PUT /people/{id}` | Update person |
| `deletePerson(id)` | `DELETE /people/{id}` | Delete person |
| `listAccounts(params)` | `GET /accounts` | List accounts |
| `getAccount(id)` | `GET /accounts/{id}` | Fetch account |
| `createAccount(account)` | `POST /accounts` | Create account |
| `updateAccount(id, account)` | `PUT /accounts/{id}` | Update account |
| `deleteAccount(id)` | `DELETE /accounts/{id}` | Delete account |
| `listUsers(params)` | `GET /users` | List users |
| `getUser(id)` | `GET /users/{id}` | Fetch user (id or guid) |
| `updateUser(id, user)` | `PUT /users/{id}` | Update user |
| `listTasks(params)` | `GET /tasks` | List tasks |
| `getTask(id)` | `GET /tasks/{id}` | Fetch task |
| `createTask(task)` | `POST /tasks` | Create task |
| `updateTask(id, task)` | `PUT /tasks/{id}` | Update task |
| `deleteTask(id)` | `DELETE /tasks/{id}` | Delete task |
| `listWebhookSubscriptions(params)` | `GET /webhook_subscriptions` | List subscriptions |
| `getWebhookSubscription(id)` | `GET /webhook_subscriptions/{id}` | Fetch subscription |
| `createWebhookSubscription(data)` | `POST /webhook_subscriptions` | Create subscription |
| `updateWebhookSubscription(id, data)` | `PUT /webhook_subscriptions/{id}` | Update subscription |
| `deleteWebhookSubscription(id)` | `DELETE /webhook_subscriptions/{id}` | Delete subscription |
| `verifyWebhookSignature({ body, signature, callbackToken })` | — | Verify `x-salesloft-signature` |

## Webhooks

Salesloft delivers signed POSTs with:

- `x-salesloft-event` — event type (e.g. `person_created`)
- `x-salesloft-signature` — HMAC-SHA1 hex of the body keyed by `callback_token`

The Tier 3 extension under `extensions/webhooks/` verifies the signature and
routes events through `SALESLOFT_WEBHOOK_RECEIVED` → `SALESLOFT_WEBHOOK_RESOLVE`
→ `SALESLOFT_WEBHOOK` (override via `binding.handlers`).

Event types: https://developers.salesloft.com/docs/platform/webhooks/event-types/

## Frontend Integrations (Fenestra)

Salesloft also exposes iframe UI extension points (Full Page, Person/Account
Smart Panels, Email & Template Editor, Custom Steps). See
`salesloft.fenestra.yaml` and
https://developers.salesloft.com/docs/platform/frontend-integrations/.

## Sources

- https://developers.salesloft.com/
- https://developers.salesloft.com/docs/api/salesloft-platform/
- Prior v1 module at `packages/needs-updating/salesloft` (upgraded in this package)

## Tests

```bash
npm test
```
