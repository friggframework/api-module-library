# `@friggframework/api-module-slack`

Frigg v2 API module for the [Slack Web API](https://docs.slack.dev/apis/web-api).

## Auth

OAuth 2.0 authorization code (`https://slack.com/oauth/v2/authorize` → `oauth.v2.access`). Bot token (`xoxb-…`) is the primary credential; optional `user_scope` populates `authed_user` without replacing the bot token. Workspace identity is `team_id` from `auth.test` / the token response.

See `.env.example` for `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SCOPE`, `SLACK_USER_SCOPE`, `SLACK_SIGNING_SECRET`, and `REDIRECT_URI`.

## Surface

| Area | Methods |
|---|---|
| Auth | `authTest`, `listTeams` |
| Conversations | list/get/create/invite/history/members/rename/archive |
| Chat | `postMessage`, `updateMessage`, `deleteMessage`, `postEphemeral`, `getMessagePermalink` |
| Users | `listUsers`, `getUser`, `lookupUserByEmail`, `getUserProfile` |
| Files | `listFiles`, `getFile` |
| Events | `listEventAuthorizations` |
| Views | `openView`, `publishView`, `updateView`, `pushView` |
| Webhooks | `verifyWebhookSignature` + Tier-3 `extensions/webhooks/` |

Curated OpenAPI: `slack.openapi.yaml`. Capability manifest: `slack.capabilities.json`. Block Kit UI surface: `slack.fenestra.yaml` (Fenestra 0.1.0 draft).

## Tests

```bash
cd packages/v1-ready/slack && npm test
```

`frigg auth test .` requires real Slack app credentials (pending).
