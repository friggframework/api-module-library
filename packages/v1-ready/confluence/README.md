# `@friggframework/api-module-confluence`

Frigg v2 API module for **Confluence Cloud** (Atlassian).

## Sources

- REST API v2 intro: https://developer.atlassian.com/cloud/confluence/rest/v2/intro/
- Official OpenAPI: https://dac-static.atlassian.com/cloud/confluence/openapi-v2.v3.json
- OAuth 2.0 (3LO): https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/
- Forge UI Kit: https://developer.atlassian.com/platform/forge/ui-kit/

## Auth

Atlassian OAuth 2.0 (3LO) authorization-code grant.

| Detail | Value |
|---|---|
| Authorize | `https://auth.atlassian.com/authorize` (`audience=api.atlassian.com`, `prompt=consent`) |
| Token | `POST https://auth.atlassian.com/oauth/token` (JSON body with `client_id` / `client_secret`) |
| Data plane | `https://api.atlassian.com/ex/confluence/{cloudId}/wiki/api/v2` |
| Entity id | Site `cloudId` from `GET /oauth/token/accessible-resources` |

Include `offline_access` in scopes to receive a refresh token, and `read:me` for `GET https://api.atlassian.com/me`.

## Covered surface

Spaces (list/get/create), pages (list/get/create/update/delete + list-in-space), blog posts (same), plus identity helpers `listAccessibleResources` / `getCurrentUser` / `resolveCloudId`.

## Skipped

- **Webhook subscription CRUD** — not part of the public Confluence Cloud REST API for 3LO apps (Forge/Connect modules; unsupported private `/wiki/rest/webhooks/1.0/webhook` out of scope).
- Space update/delete — not present on the official v2 Space group as of the curated OpenAPI cut.
- Attachments, comments, labels, whiteboards, databases, folders, and other v2 groups — out of scope for this core cut.

## Files

| File | Role |
|---|---|
| `api.js` / `definition.js` / `index.js` | Client + Frigg Definition |
| `confluence.openapi.yaml` | Curated OpenAPI subset (1:1 with `Api` operationIds) |
| `confluence.capabilities.json` | `capability-manifest/v0.1` |
| `confluence.fenestra.yaml` | Forge UI Kit / Custom UI draft |

## Develop

```bash
cd packages/v1-ready/confluence
npm install
npm test
```

Copy `.env.example` for local OAuth credentials. `frigg auth test .` requires a real Atlassian 3LO app + Confluence Cloud site.
