# GitHub API Module (`@friggframework/api-module-github`)

A [Frigg](https://friggframework.org) API module for the [GitHub REST API](https://docs.github.com/en/rest).
It wraps the official `api.github.com` surface so a Frigg integration can read
the authenticated user and orgs, list/get/create/update repositories, issues,
and pull requests, and manage repository webhooks.

Integrations consume it the standard Frigg way:

```javascript
const user = await this.github.api.getAuthenticatedUser();
const repos = await this.github.api.listReposForAuthenticatedUser({
    visibility: 'all',
});
const issue = await this.github.api.createIssue('owner', 'repo', {
    title: 'Hello from Frigg',
});
```

## Authentication

GitHub **OAuth App** authorization-code flow:

1. Redirect the user to `https://github.com/login/oauth/authorize`
2. Exchange the `code` at `https://github.com/login/oauth/access_token`
   (`Accept: application/json`)
3. Call the API with `Authorization: Bearer <token>`, plus
   `Accept: application/vnd.github+json` and
   `X-GitHub-Api-Version: 2022-11-28`

Register an OAuth App under GitHub Developer Settings. Set:

| Env var | Purpose |
|---|---|
| `GITHUB_CLIENT_ID` | OAuth App client id |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret |
| `GITHUB_SCOPE` | Space-delimited scopes (see below) |
| `REDIRECT_URI` | App callback base; module appends `/github` |
| `GITHUB_WEBHOOK_SECRET` | Shared secret for inbound webhook HMAC (extension) |

Recommended scopes for the surfaces this module covers
([docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)):
`read:user user:email repo admin:repo_hook read:org`. Trim to least privilege.

GitHub Apps (installation tokens) and fine-grained PATs are **not** wired in
this module yet — see open questions in the PR.

## API Methods

| Method | HTTP | Official operationId |
|---|---|---|
| `getAuthenticatedUser()` | `GET /user` | `users/get-authenticated` |
| `listOrganizationsForAuthenticatedUser(query)` | `GET /user/orgs` | `orgs/list-for-authenticated-user` |
| `listReposForAuthenticatedUser(query)` | `GET /user/repos` | `repos/list-for-authenticated-user` |
| `createRepositoryForAuthenticatedUser(data)` | `POST /user/repos` | `repos/create-for-authenticated-user` |
| `getRepository(owner, repo)` | `GET /repos/{owner}/{repo}` | `repos/get` |
| `updateRepository(owner, repo, data)` | `PATCH /repos/{owner}/{repo}` | `repos/update` |
| `listRepositoryIssues(owner, repo, query)` | `GET /repos/{owner}/{repo}/issues` | `issues/list-for-repo` |
| `getIssue(owner, repo, issueNumber)` | `GET /repos/{owner}/{repo}/issues/{issue_number}` | `issues/get` |
| `createIssue(owner, repo, data)` | `POST /repos/{owner}/{repo}/issues` | `issues/create` |
| `updateIssue(owner, repo, issueNumber, data)` | `PATCH .../issues/{issue_number}` | `issues/update` |
| `listPullRequests(owner, repo, query)` | `GET /repos/{owner}/{repo}/pulls` | `pulls/list` |
| `getPullRequest(owner, repo, pullNumber)` | `GET .../pulls/{pull_number}` | `pulls/get` |
| `createPullRequest(owner, repo, data)` | `POST .../pulls` | `pulls/create` |
| `updatePullRequest(owner, repo, pullNumber, data)` | `PATCH .../pulls/{pull_number}` | `pulls/update` |
| `listRepositoryWebhooks(owner, repo, query)` | `GET .../hooks` | `repos/list-webhooks` |
| `getRepositoryWebhook(owner, repo, hookId)` | `GET .../hooks/{hook_id}` | `repos/get-webhook` |
| `createRepositoryWebhook(owner, repo, data)` | `POST .../hooks` | `repos/create-webhook` |
| `updateRepositoryWebhook(owner, repo, hookId, data)` | `PATCH .../hooks/{hook_id}` | `repos/update-webhook` |
| `deleteRepositoryWebhook(owner, repo, hookId)` | `DELETE .../hooks/{hook_id}` | `repos/delete-webhook` |

## Webhooks extension

`extensions/webhooks/` is a Tier-3 receiver modeled on the HubSpot webhook
extension: verify `X-Hub-Signature-256`, enqueue resolve, reverse-lookup the
owning integration by `repository.owner.id`, then dispatch `GITHUB_WEBHOOK`.

## Sources

- REST docs: https://docs.github.com/en/rest
- OAuth apps: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- Official OpenAPI: https://github.com/github/rest-api-description
- Webhook signatures: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries

## Tests

```bash
cd packages/v1-ready/github && npm install && npm test
```
