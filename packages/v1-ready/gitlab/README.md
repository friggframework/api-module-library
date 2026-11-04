# `@friggframework/api-module-gitlab`

Frigg v2 API module for the [GitLab REST API v4](https://docs.gitlab.com/api/rest/).

## Auth

OAuth 2.0 authorization-code (with refresh). Register an application under
**User Settings → Applications** (or a group/instance app) with redirect URI
`${REDIRECT_URI}/gitlab` and scopes that include at least `api` and `read_user`.

- Docs: [OAuth provider](https://docs.gitlab.com/integration/oauth_provider/), [OAuth API](https://docs.gitlab.com/api/oauth2/)
- Tokens are sent as `Authorization: Bearer <token>`
- Vendor OpenAPI also documents `PRIVATE-TOKEN` (PAT); the curated
  `gitlab.openapi.yaml` declares oauth2, bearer, and PRIVATE-TOKEN schemes.

Self-Managed / Dedicated: set `GITLAB_HOST` (or pass `host` to the Api) so OAuth
and API calls target `{host}/oauth/*` and `{host}/api/v4`.

## Vendor OpenAPI

Curated contract is diffed against:

- https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/openapi/openapi_v2.yaml  
  (`host: gitlab.com`, paths prefixed `/api/v4/...` → composed base
  `https://gitlab.com/api/v4`)
- https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/openapi/openapi_v3.yaml  
  (fills gaps: `GET /api/v4/user`, oauth2/bearer security schemes)

## Covered surface

| Area | Methods |
| --- | --- |
| Identity | `getCurrentUser` |
| Projects | `listProjects`, `getProject`, `createProject`, `updateProject` |
| Issues | `listIssues`, `getIssue`, `createIssue`, `updateIssue` |
| Merge requests | `listMergeRequests`, `getMergeRequest`, `createMergeRequest`, `updateMergeRequest` |
| Project webhooks | `listProjectHooks`, `getProjectHook`, `createProjectHook`, `updateProjectHook`, `deleteProjectHook` |
| Inbound verify | `verifyWebhookSignature` (Standard Webhooks HMAC or `X-Gitlab-Token`) |

The OpenAPI file `gitlab.openapi.yaml` is the curated 1:1 contract for those
methods. Capability manifest: `gitlab.capabilities.json`.

## Webhooks

Tier-3 extension under `extensions/webhooks/` (HubSpot-style DB-free receive →
resolve → handle). Prefer `signing_token` (`whsec_…`) when creating hooks;
legacy `token` → `X-Gitlab-Token` is still verified as a fallback.

## Fenestra

No `gitlab.fenestra.yaml`. GitLab does not expose a third-party declarative UI
framework comparable to Slack Block Kit; integrations are API + webhooks +
settings forms.

## Tests

```bash
cd packages/v1-ready/gitlab && npm test
```
