# ActiveCampaign API Module (`@friggframework/api-module-activecampaign`)

A [Frigg](https://friggframework.org) API module for [ActiveCampaign](https://www.activecampaign.com)
— email marketing, marketing automation, and CRM. It wraps ActiveCampaign API
v3 so a Frigg integration can manage contacts, CRM accounts, tags, and webhook
subscriptions.

Integrations consume it the standard Frigg way:

```javascript
const { contacts } = await this.activecampaign.api.listContacts({ limit: 100 });
await this.activecampaign.api.createContact({
    contact: { email: 'a@b.com', firstName: 'Ada' },
});
```

## Authentication

ActiveCampaign uses **API-key** authentication against an **account-specific**
base URL. Both values come from **Settings → Developer**:

| Field | Header / use |
|---|---|
| API Access Key | Sent as `Api-Token` on every request |
| API Access URL | Host for all calls; client appends `/api/3` |

```bash
curl -H "Api-Token: YOUR_KEY" https://youraccountname.api-us1.com/api/3/users/me
```

Docs do **not** guarantee `api-us1.com` for every account — always paste the
full URL from the Developer tab. See
[Authentication](https://developers.activecampaign.com/reference/authentication)
and [Base URL](https://developers.activecampaign.com/reference/url).

Set `ACTIVECAMPAIGN_API_KEY` and `ACTIVECAMPAIGN_API_URL` (see `.env.example`),
or collect them through the module's JSON-Schema auth form
(`getAuthorizationRequirements` / `frigg auth`).

## API Methods

| Method | HTTP | Docs |
|---|---|---|
| `getUser()` | `GET /users/me` | [link](https://developers.activecampaign.com/reference/get-user-loggedin) |
| `listContacts(query)` | `GET /contacts` | [link](https://developers.activecampaign.com/reference/list-all-contacts) |
| `getContact(id)` | `GET /contacts/{id}` | [link](https://developers.activecampaign.com/reference/get-contact) |
| `createContact(body)` | `POST /contacts` | [link](https://developers.activecampaign.com/reference/create-a-new-contact) |
| `updateContact(id, body)` | `PUT /contacts/{id}` | [link](https://developers.activecampaign.com/reference/update-a-contact-new) |
| `deleteContact(id)` | `DELETE /contacts/{id}` | [link](https://developers.activecampaign.com/reference/delete-contact) |
| `bulkContactImport(body)` | `POST /import/bulk_import` | [link](https://developers.activecampaign.com/reference/bulk-import-contacts) |
| `listAccounts(query)` / `getAccount` / `createAccount` / `updateAccount` | accounts | [list](https://developers.activecampaign.com/reference/list-all-accounts) |
| `bulkDeleteAccounts(ids)` | `POST /accounts/bulk_delete?ids[]=` | [link](https://developers.activecampaign.com/reference/bulk-delete-accounts) |
| `listAccountContacts` / `get` / `create` / `update` / `delete` | accountContacts | [create](https://developers.activecampaign.com/reference/create-an-account-1) |
| `listTags` / `createTag` / `deleteTag` | tags | [list](https://developers.activecampaign.com/reference/retrieve-all-tags) |
| `createContactTag` / `deleteContactTag` | contactTags | [add](https://developers.activecampaign.com/reference/create-contact-tag) |
| `listWebhooks` / `getWebhook` / `createWebhook` / `updateWebhook` / `deleteWebhook` | webhooks | [create](https://developers.activecampaign.com/reference/create-webhook) |

Request bodies follow ActiveCampaign's nested resource shape
(`{ contact: { … } }`, `{ account: { … } }`, `{ webhook: { … } }`, etc.).

## Capability manifest

`activecampaign.capabilities.json` (`capability-manifest/v0.1`) declares the
wired objects (`contact`, `account`, `tag`, `webhook`) and maps every
capability to an `Api` method. Version matches `package.json`.

## Fenestra

None. ActiveCampaign is not listed as a Fenestra UI-extension host in
`specs/fenestra/PLATFORMS.md` (branch `claude/fenestra-spec-draft-Q367t`). This
module is REST + API-key + webhook **subscription** management only.

## Tests

```bash
cd packages/v1-ready/activecampaign && npm test
```

Offline Jest suite: request-shape unit tests, definition/auth wiring, and
OpenAPI ↔ client `operationId` sync.

## Prior work

Upgraded from the v1 package previously at
`packages/needs-updating/activecampaign/` (Mongoose models + `manager.js`).
Working, doc-verified methods (contacts, accounts, tags, accountContacts,
bulk import, `/users/me`) were kept and rewritten onto `ApiKeyRequester` + a
Frigg v2 `Definition`.
