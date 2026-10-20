# Figma API Module (`@friggframework/api-module-figma`)

A [Frigg](https://friggframework.org) API module for the [Figma REST API](https://developers.figma.com/docs/rest-api/).
It wraps the curated subset of endpoints an integration needs: identity, files,
projects/folders, comments, and Webhooks V2.

```javascript
const me = await this.figma.api.getMe();
const file = await this.figma.api.getFile(fileKey, { depth: 1 });
const { comments } = await this.figma.api.getComments(fileKey);
```

## Authentication

Figma recommends **OAuth 2** (authorization code) for apps acting on behalf of
users. Token exchange and refresh use HTTP Basic
(`Authorization: Basic base64(client_id:client_secret)`):

| Step | URL |
|---|---|
| Authorize | `https://www.figma.com/oauth` |
| Token | `https://api.figma.com/v1/oauth/token` |
| Refresh | `https://api.figma.com/v1/oauth/refresh` |

- **Base URL:** `https://api.figma.com`
- Register an OAuth app at [figma.com/developers/apps](https://www.figma.com/developers/apps)
- **Public** OAuth apps require Figma review before end-user authorization;
  **private** apps are limited to the associated team/org.
- Set `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET`, and `REDIRECT_URI` (see `.env.example`).

Personal and plan access tokens can also be used as a Bearer `access_token` for
local tooling; the Frigg definition is wired for the OAuth flow.

## API Methods

Method names match official OpenAPI `operationId`s
([figma/rest-api-spec](https://github.com/figma/rest-api-spec)).

| Method | HTTP | Purpose |
|---|---|---|
| `getMe()` | `GET /v1/me` | Current user (id, handle, email, img_url). |
| `getFile(fileKey, query)` | `GET /v1/files/{key}` | File JSON document. |
| `getFileMeta(fileKey)` | `GET /v1/files/{key}/meta` | File metadata. |
| `getComments(fileKey, query)` | `GET /v1/files/{key}/comments` | List comments. |
| `postComment(fileKey, data)` | `POST /v1/files/{key}/comments` | Create a comment. |
| `deleteComment(fileKey, id)` | `DELETE /v1/files/{key}/comments/{id}` | Delete a comment. |
| `getTeamProjects(teamId)` | `GET /v1/teams/{id}/projects` | List projects (legacy). |
| `getProjectFiles(projectId, query)` | `GET /v1/projects/{id}/files` | Files in a project. |
| `getProjectMeta(projectId)` | `GET /v1/projects/{id}/meta` | Project metadata. |
| `getTeamFolders(teamId)` | `GET /v2/teams/{id}/folders` | List folders. |
| `getFolderFiles(folderId)` | `GET /v2/folders/{id}/files` | Files in a folder. |
| `getFolderMeta(folderId)` | `GET /v2/folders/{id}/meta` | Folder metadata. |
| `getWebhooks(query)` | `GET /v2/webhooks` | List webhooks by context or plan. |
| `postWebhook(data)` | `POST /v2/webhooks` | Create a webhook. |
| `getWebhook(id)` | `GET /v2/webhooks/{id}` | Get a webhook. |
| `putWebhook(id, data)` | `PUT /v2/webhooks/{id}` | Update a webhook. |
| `deleteWebhook(id)` | `DELETE /v2/webhooks/{id}` | Delete a webhook. |
| `getTeamWebhooks(teamId)` | `GET /v2/teams/{id}/webhooks` | List team webhooks. |
| `getWebhookRequests(id)` | `GET /v2/webhooks/{id}/requests` | Recent delivery attempts. |

### Skipped (not in this curated subset)

Images/renders, versions, components/styles, variables, dev resources, activity
logs, library analytics, and other enterprise/admin surfaces. Add them when an
integration needs them — always from the official OpenAPI, never invented.

There is **no update-comment** endpoint in the public REST API (only create/delete).

## Webhooks extension

`extensions/webhooks/` is a HubSpot-style Tier 3 receiver:

- `POST /webhooks` → verify `body.passcode` against `FIGMA_WEBHOOK_PASSCODE` → enqueue resolve
- Worker resolves tenant when `figma_user_id` is present, then emits `FIGMA_WEBHOOK`

Figma verifies deliveries via the passcode field in the JSON body (not a
signature header). See
[webhooks security](https://developers.figma.com/docs/rest-api/webhooks-security/).

## Capability manifest & Fenestra

- `figma.capabilities.json` — `capability-manifest/v0.1` describing auth and
  objects (`user`, `file`, `project`, `folder`, `comment`, `webhook`) with
  tagged fields. Every declared method maps to an `Api` method.
- `figma.fenestra.yaml` — draft UI ecosystem description for Figma’s Plugin /
  Widget platform (iframe + main-thread dual context). Validated against the
  draft Fenestra schema on branch `claude/fenestra-spec-draft-Q367t`.

## Sources

- https://developers.figma.com/docs/rest-api/
- https://developers.figma.com/docs/rest-api/authentication/
- https://developers.figma.com/docs/rest-api/oauth-apps/
- https://developers.figma.com/docs/rest-api/scopes/
- https://developers.figma.com/docs/rest-api/webhooks/
- https://github.com/figma/rest-api-spec

## Tests

```bash
cd packages/v1-ready/figma && npm test
```
