# monday.com API Module (`@friggframework/api-module-monday`)

A [Frigg](https://friggframework.org) API module for [monday.com](https://monday.com)
— the Work OS. It wraps the Platform **GraphQL** API so a Frigg integration can
authenticate via OAuth, read account identity, list/create boards and items,
manage columns, and subscribe to board webhooks.

```javascript
const boards = await this.monday.api.listBoards({ limit: 25 });
const item = await this.monday.api.createItem({
    board_id: boards[0].id,
    item_name: 'Follow up',
    column_values: { status: { label: 'Working on it' } },
});
```

## Authentication

monday.com marketplace / connected apps use **OAuth 2.0** authorization code:

| Detail | Value |
|---|---|
| Authorize | `https://auth.monday.com/oauth2/authorize` |
| Token | `https://auth.monday.com/oauth2/token` |
| API | `POST https://api.monday.com/v2` |
| Header | `Authorization: Bearer <access_token>` |
| Version | `API-Version: 2026-07` (override with `MONDAY_API_VERSION`) |

Classic OAuth access tokens do not expire until the app is uninstalled (no
refresh token). See [OAuth docs](https://developer.monday.com/apps/docs/oauth).

Personal API tokens also work when passed as `access_token` / `api_token`
([Authentication](https://developer.monday.com/api-reference/docs/authentication)).

Set `MONDAY_CLIENT_ID`, `MONDAY_CLIENT_SECRET`, and optionally `MONDAY_SCOPE`
(see `.env.example`).

## API methods

| Method | GraphQL | Purpose |
|---|---|---|
| `getMe` | `me` | Authenticated user + nested account |
| `getAccount` | `account` | Account metadata |
| `listBoards` / `getBoard` / `createBoard` | `boards` / `create_board` | Boards CRUD (read/create) |
| `listColumns` / `createColumn` | `columns` / `create_column` | Board columns |
| `listItems` / `listBoardItems` | `items` / `items_page` | Items by id or board page |
| `createItem` / `changeMultipleColumnValues` / `deleteItem` | mutations | Item write |
| `listWebhooks` / `createWebhook` / `deleteWebhook` | `webhooks` / mutations | Board webhook subscriptions |
| `verifyWebhookSignature` | — | HS256 JWT check vs Signing Secret |

## Webhooks extension

`extensions/webhooks/` (Tier 3, `useDatabase: false`) handles the monday
`challenge` handshake, optional JWT verification, and boardId → integration
routing. Pattern matches `@friggframework/api-module-hubspot`.

## Docs

- Platform API: https://developer.monday.com/api-reference/docs
- OAuth: https://developer.monday.com/apps/docs/oauth
- Webhooks: https://developer.monday.com/api-reference/reference/webhooks
- Apps / UI: https://developer.monday.com/apps/docs/intro

## Tests

```bash
cd packages/v1-ready/monday && npm test
```
