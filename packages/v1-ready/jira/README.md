# `@friggframework/api-module-jira`

Jira Cloud platform REST API v3 module for the Frigg Framework.

## Auth

OAuth 2.0 (3LO) via Atlassian Developer Console.

| Detail | Value |
|---|---|
| Authorize | `https://auth.atlassian.com/authorize` (`audience=api.atlassian.com`, `prompt=consent`) |
| Token | `https://auth.atlassian.com/oauth/token` (JSON body) |
| API base | `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3` |
| Default scopes | `read:jira-user read:jira-work write:jira-work manage:jira-webhook offline_access` |

`cloudId` is discovered from [accessible-resources](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/) and persisted on the credential.

## Docs

- [REST API intro](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
- [OAuth 2.0 (3LO)](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)
- [Webhooks](https://developer.atlassian.com/cloud/jira/platform/webhooks/)
- [Official OpenAPI](https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json)

## Local test

```bash
cd packages/v1-ready/jira
npm install
npm test
```

Copy `.env.example` for `frigg auth test .` once sandbox OAuth credentials are available.
