# PandaDoc API Module (`@friggframework/api-module-pandadoc`)

A [Frigg](https://friggframework.org) API module for [PandaDoc](https://www.pandadoc.com)
— document automation, eSignature, and contract workflows. It wraps the PandaDoc
Public REST API so a Frigg integration can manage documents, templates, contacts,
members, and webhook subscriptions, and open embedded editor/signing sessions.

Integrations consume it the standard Frigg way:

```javascript
const me = await this.pandadoc.api.detailsCurrentMember();
const { results } = await this.pandadoc.api.listDocuments({ status: 1 });
await this.pandadoc.api.sendDocument(documentId, { silent: true });
```

## Authentication

PandaDoc recommends **OAuth 2.0** for all new integrations:

| Step | URL |
|---|---|
| Authorize | `https://app.pandadoc.com/oauth2/authorize` |
| Token | `POST https://api.pandadoc.com/oauth2/access_token` |
| API base | `https://api.pandadoc.com` |

Scopes: `read`, `write`, or space-separated `read write` (`read+write` is deprecated).

Create an application in the [Developer Dashboard](https://app.pandadoc.com/a/#/settings/api-dashboard/configuration).
Set `PANDADOC_CLIENT_ID`, `PANDADOC_CLIENT_SECRET`, `PANDADOC_SCOPE`, and `REDIRECT_URI` (see `.env.example`).

Identity for entity/credential external ids comes from
`GET /public/v1/members/current` — specifically the **workspace** id.

> Legacy `Authorization: API-Key …` auth still exists on the public API but is
> not the path this module uses for new connections.

## Sources

- Docs: https://developers.pandadoc.com/
- Auth: https://developers.pandadoc.com/reference/auth-overview
- Official OpenAPI (v8.23.0): https://developers.pandadoc.com/openapi/pandadoc-public-api.json
- GitHub mirror: https://github.com/PandaDoc/pandadoc-openapi-specification
- Webhook verification: https://developers.pandadoc.com/docs/webhook-verification
- Embedded editor: https://developers.pandadoc.com/docs/editor-embed
- Embedded signing: https://developers.pandadoc.com/docs/embedded-signing

`pandadoc.openapi.yaml` is a curated subset of the official OpenAPI above —
every `operationId` maps 1:1 to an `Api` method. Paths, methods, params,
request/response schemas, auth/scopes, and server URL are taken verbatim from
v8.23.0 (not from older APIs.io copies).

## API Methods (core)

| Method | HTTP | Purpose |
|---|---|---|
| `detailsCurrentMember()` | `GET /public/v1/members/current` | Auth/identity |
| `listMembers` / `detailsMember` | `GET /public/v1/members[/{id}]` | Workspace members |
| `listDocuments` / `createDocument` | `GET/POST /public/v1/documents` | Documents |
| `statusDocument` / `detailsDocument` | `GET …/{id}` / `…/details` | Status & details |
| `updateDocument` / `deleteDocument` | `PATCH/DELETE …/{id}` | Mutate |
| `sendDocument` / `changeDocumentStatus` / `documentRevertToDraft` | send / status / draft | Lifecycle |
| `createDocumentLink` | `POST …/{id}/session` | Embedded signing session |
| `createDocumentEditingSession` | `POST …/{id}/editing-sessions` | Embedded editor E-Token |
| `downloadDocument` | `GET …/{id}/download` | PDF download |
| `listTemplates` / `detailsTemplate` / … | `/public/v1/templates` | Templates |
| `listContacts` / `createContact` / … | `/public/v1/contacts` | Contacts |
| `createWebhookSubscription` / … | `/public/v1/webhook-subscriptions` | Webhooks |

## Webhooks extension

`extensions/webhooks/` is a HubSpot-style Tier 3 bundle:

- Verifies HMAC-SHA256 (`?signature=`) with the subscription shared key
- DB-free receive → resolve (workspace id) → consumer handler

Register subscription URLs with `?workspace_id=<workspace>` — document event
bodies do not include `workspace_id` per PandaDoc docs.

## Capability manifest & Fenestra

- `pandadoc.capabilities.json` — `capability-manifest/v0.1` (objects, events, capabilities → Api methods)
- `pandadoc.fenestra.yaml` — embedded editor + embedded signing UI extension points

## Tests

```bash
cd packages/v1-ready/pandadoc && npm test
```

Includes offline `api` / `definition` tests and `spec-sync` (every OpenAPI
`operationId` has an `Api` method; server URL matches `baseUrl`).
