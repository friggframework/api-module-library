# Marketo API Module (`@friggframework/api-module-marketo`)

A [Frigg](https://friggframework.org) API module for [Adobe Marketo Engage](https://business.adobe.com/products/marketo/adobe-marketo.html).
It wraps the Marketo REST API so a Frigg integration can authenticate with a
Custom Service, sync leads, and manage static-list membership.

Integrations consume it the standard Frigg way:

```javascript
const leads = await this.marketo.api.getLeadsByFilterType({
    filterType: 'email',
    filterValues: 'jane@acme.com',
});
await this.marketo.api.syncLeads({
    action: 'createOrUpdate',
    lookupField: 'email',
    input: [{ email: 'jane@acme.com', firstName: 'Jane' }],
});
```

## Authentication

Marketo uses **OAuth 2.0 client credentials** (two-legged). Create an API-Only
user + Custom Service under **Admin → Integration → LaunchPoint**, then read
the REST/Identity hosts from **Admin → Integration → Web Services**.

```bash
curl "https://{munchkinId}.mktorest.com/identity/oauth/token?\
grant_type=client_credentials&client_id=CLIENT_ID&client_secret=CLIENT_SECRET"
```

Every REST call sends `Authorization: Bearer <access_token>`. Tokens last about
one hour; the module remints via client credentials (there is no refresh_token).

- **REST base:** `https://{munchkinId}.mktorest.com/rest`
- **Identity:** `https://{munchkinId}.mktorest.com/identity`

Set `MARKETO_CLIENT_ID` / `MARKETO_CLIENT_SECRET` (see `.env.example`). The
Munchkin ID is collected through the authorization form
(`getAuthorizationRequirements`) together with the client credentials.

Official auth docs:
https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/rest/authentication

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getLeadById(id, params)` | `GET /v1/lead/{id}.json` | Fetch one lead |
| `getLeadsByFilterType(params)` | `GET /v1/leads.json` | Filter leads (`filterType` + `filterValues`) |
| `syncLeads(body)` | `POST /v1/leads.json` | Create / update up to 300 leads |
| `deleteLeads(body)` | `POST /v1/leads/delete.json` | Delete up to 300 leads by id |
| `describeLeads()` | `GET /v1/leads/describe2.json` | Field metadata / searchable filters |
| `getLists(params)` | `GET /v1/lists.json` | Browse static lists |
| `getListById(id)` | `GET /v1/lists/{id}.json` | Fetch one list |
| `getLeadsByListId(listId, params)` | `GET /v1/lists/{listId}/leads.json` | List members |
| `addToList(listId, leadIds)` | `POST /v1/lists/{listId}/leads.json` | Add members |
| `removeFromList(listId, leadIds)` | `DELETE /v1/lists/{listId}/leads.json` | Remove members |
| `isMemberOfList(listId, leadIds)` | `GET .../ismember.json` | Membership check |

## Skipped (intentionally)

- **Webhook subscription REST** — Marketo webhooks are Smart Campaign outbound
  HTTP actions, not a REST subscribe/unsubscribe API.
- **Bulk import/export** (`/bulk/v1/...`) — deferred; not needed for the core
  lead-database surface.
- **Asset APIs** (programs, emails, forms, `/asset/v1/staticLists`) — out of
  scope for this cut.

## Contract files

- `marketo.openapi.yaml` — curated OpenAPI subset (1:1 with `api.js` methods)
- `marketo.capabilities.json` — capability manifest (`capability-manifest/v0.1`)

## Testing

```bash
cd packages/v1-ready/marketo
npm test
```

Live auth (`frigg auth test .`) requires sandbox credentials (pending).

## Prior art

Upgraded from the v1 package previously at `packages/needs-updating/marketo`
(client credentials + leads/list helpers, Mongoose Credential/Entity/Manager).
Mongoose-era code was removed; verified REST methods were kept and expanded.
