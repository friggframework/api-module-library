# @friggframework/api-module-microsoft-teams

Frigg v2 API module for **Microsoft Teams** via [Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview).

## Auth

OAuth 2.0 authorization code against the Microsoft identity platform (`login.microsoftonline.com/{tenant}/oauth2/v2.0`). Optional client-credentials flow when `getToken` is called without callback params.

Set `TEAMS_CLIENT_ID`, `TEAMS_CLIENT_SECRET`, `TEAMS_SCOPE`, and `REDIRECT_URI` (module appends `/microsoft-teams`). See `.env.example`.

## Surfaces

| Area | Methods |
|------|---------|
| Identity | `getMe`, `getOrganization` |
| Teams | `listJoinedTeams`, `getTeam` |
| Channels | `listChannels`, `getChannel`, `createChannel`, `updateChannel` |
| Messages | `listChannelMessages`, `getChannelMessage`, `sendChannelMessage`, `listChatMessages`, `sendChatMessage` |
| Chats | `listChats`, `getChat` |
| Members | `listTeamMembers` |
| Subscriptions | `createSubscription`, `listSubscriptions`, `getSubscription`, `renewSubscription`, `deleteSubscription` |
| Webhooks | `verifyWebhookClientState` + `extensions/webhooks/` (Graph validationToken + clientState) |

## Files

- `api.js` / `definition.js` / `index.js`
- `microsoft-teams.openapi.yaml` — curated Graph subset (1:1 with client `operationId`s)
- `microsoft-teams.capabilities.json` — `capability-manifest/v0.1`
- `microsoft-teams.fenestra.yaml` — Teams UI platform draft (Adaptive Cards / Tabs / Bots)
- `extensions/webhooks/` — Tier-3 change-notification receiver

## Tests

```bash
cd packages/v1-ready/microsoft-teams && npm test
```

## Sources

- Graph Teams overview: https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview
- Auth (delegated): https://learn.microsoft.com/en-us/graph/auth-v2-user
- Auth (app-only): https://learn.microsoft.com/en-us/graph/auth-v2-service
- Change notifications: https://learn.microsoft.com/en-us/graph/change-notifications-overview
- Official Graph OpenAPI metadata: https://github.com/microsoftgraph/msgraph-metadata
