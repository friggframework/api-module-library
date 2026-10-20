# Miro API Module (`@friggframework/api-module-miro`)

A [Frigg](https://friggframework.org) API module for [Miro](https://miro.com)
— the visual workspace. It wraps Miro's REST API v2 so a Frigg integration can
authenticate via OAuth, read token/user/team identity, and list/create/update
boards, sticky notes, items, and board members.

```javascript
const boards = await this.miro.api.listBoards({ limit: '25' });
const note = await this.miro.api.createStickyNote(boards.data[0].id, {
    data: { content: 'Follow up', shape: 'square' },
});
```

## Authentication

Miro connected apps use **OAuth 2.0** authorization code:

| Detail | Value |
|---|---|
| Authorize | `https://miro.com/oauth/authorize` |
| Token | `https://api.miro.com/v1/oauth/token` |
| API | `https://api.miro.com` (`/v2/...`, plus `GET /v1/oauth-token`) |
| Header | `Authorization: Bearer <access_token>` |
| Core scopes | `boards:read` `boards:write` (configured on the Miro app) |

Apps choose expiring (1h access + refresh) or non-expiring tokens at creation;
that setting cannot change later. See
[OAuth docs](https://developers.miro.com/docs/getting-started-with-oauth).

Set `MIRO_CLIENT_ID`, `MIRO_CLIENT_SECRET`, and optionally `MIRO_SCOPE`
(see `.env.example`).

## API methods

| Method | HTTP | Purpose |
|---|---|---|
| `getTokenInfo` | `GET /v1/oauth-token` | Token context (user, team, org, scopes) |
| `listBoards` / `getBoard` / `createBoard` / `updateBoard` / `deleteBoard` | boards CRUD | Boards |
| `listBoardItems` / `getBoardItem` | items | Generic board items |
| `createStickyNote` / `getStickyNote` / `updateStickyNote` / `deleteStickyNote` | sticky notes | Sticky note items |
| `listBoardMembers` | members | Board membership |

## Webhooks

Miro **retired** experimental REST board webhooks
(`/v2-experimental/webhooks/board_subscriptions`) effective **2025-12-05**.
There is no documented production REST webhook subscription API to wrap, so
this module does **not** ship `extensions/webhooks/`. Web SDK board events are
in-session only.

## Fenestra

`miro.fenestra.yaml` drafts Miro's UI extension points (app panel, modal,
board item) and optional Mirotone styling, based on the Fenestra 0.1 draft
example for Miro.

## Docs

- REST overview: https://developers.miro.com/reference/overview
- OAuth: https://developers.miro.com/docs/getting-started-with-oauth
- Official OpenAPI: https://github.com/miroapp/api-clients/blob/main/packages/generator/spec.json
- Webhooks retirement: https://developers.miro.com/changelog/removed-experimental-webhooks-support
- Web SDK: https://developers.miro.com/docs/miro-web-sdk-introduction

## Tests

```bash
cd packages/v1-ready/miro && npm test
```
