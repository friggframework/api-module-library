# Trello API Module (`@friggframework/api-module-trello`)

A [Frigg](https://friggframework.org) API module for [Trello](https://trello.com)
— Atlassian's boards / lists / cards product. It wraps the public REST API so a
Frigg integration can authenticate a member, list and mutate boards/lists/cards,
read workspaces (organizations), manage labels, and subscribe to webhooks.

Integrations consume it the standard Frigg way:

```javascript
const boards = await this.trello.api.listBoards('me');
const card = await this.trello.api.createCard({
    idList: listId,
    name: 'Follow up',
});
```

## Authentication

Trello uses an **API key + user token** (Trello Auth / Power-Up key):

1. Create (or open) a Power-Up at https://trello.com/apps/admin → **Trello Auth**
   and copy the API key.
2. Authorize a user token:
   `https://trello.com/1/authorize?expiration=never&scope=read,write,account&response_type=token&key={YourAPIKey}`
3. The module sends both on every request as `key` + `token` query parameters,
   matching the official OpenAPI security schemes (`APIKey` / `APIToken` in
   [swagger.v3.json](https://developer.atlassian.com/cloud/trello/swagger.v3.json)).
   The Authorization guide also documents an equivalent
   `Authorization: OAuth oauth_consumer_key="…", oauth_token="…"` header; this
   client follows the OpenAPI schemes (query params).

- **Base URL:** `https://api.trello.com/1`
- **Official OpenAPI:** https://developer.atlassian.com/cloud/trello/swagger.v3.json

Set `TRELLO_API_KEY`, `TRELLO_TOKEN`, and (for webhook signature verification)
`TRELLO_API_SECRET` in your environment (see `.env.example`). The module also
exposes a JSON-Schema authorization form (`getAuthorizationRequirements`) so
key + token can be collected through the Frigg auth UI / `frigg auth` CLI.

No partner approval is required for classic key+token REST access. Atlassian
OAuth 2.0 (3LO) scopes are a separate product surface and are **not** wired in
this module yet — see open questions in the PR.

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getMember(id, params)` | `GET /members/{id}` | Member identity (`me` for the token owner). |
| `listBoards(memberId, params)` | `GET /members/{id}/boards` | Boards for a member. |
| `getBoard(id, params)` | `GET /boards/{id}` | Single board. |
| `createBoard(params)` | `POST /boards/` | Create a board. |
| `updateBoard(id, params)` | `PUT /boards/{id}` | Update a board. |
| `listLists(boardId, params)` | `GET /boards/{id}/lists` | Lists on a board. |
| `getList(id, params)` | `GET /lists/{id}` | Single list. |
| `createList(params)` | `POST /lists` | Create a list (`name`, `idBoard`). |
| `updateList(id, params)` | `PUT /lists/{id}` | Update a list. |
| `listCards(boardId, params)` | `GET /boards/{id}/cards` | Cards on a board. |
| `listListCards(listId, params)` | `GET /lists/{id}/cards` | Cards on a list. |
| `getCard(id, params)` | `GET /cards/{id}` | Single card. |
| `createCard(params)` | `POST /cards` | Create a card (`idList` required). |
| `updateCard(id, params)` | `PUT /cards/{id}` | Update a card. |
| `listOrganizations(memberId, params)` | `GET /members/{id}/organizations` | Workspaces. |
| `getOrganization(id, params)` | `GET /organizations/{id}` | Single workspace. |
| `listLabels(boardId, params)` | `GET /boards/{id}/labels` | Labels on a board. |
| `createLabel(params)` | `POST /labels` | Create a label. |
| `createWebhook(data)` | `POST /webhooks/` | Subscribe to a model. |
| `getWebhook(id)` | `GET /webhooks/{id}` | Get a webhook. |
| `updateWebhook(id, data)` | `PUT /webhooks/{id}` | Update a webhook. |
| `deleteWebhook(id)` | `DELETE /webhooks/{id}` | Delete a webhook. |
| `listTokenWebhooks(token?)` | `GET /tokens/{token}/webhooks` | List webhooks for a token. |
| `createTokenWebhook(data, token?)` | `POST /tokens/{token}/webhooks` | Create under a token. |
| `verifyWebhookSignature(args)` | — | Verify `X-Trello-Webhook` HMAC. |

## Webhooks

Create with `createWebhook` (or `createTokenWebhook`). Trello HEADs
`callbackURL` and expects HTTP 200 before creating. Prefer appending
`?memberId=<externalId>` so the Tier-3 extension can resolve the owning Frigg
entity:

```javascript
await this.trello.api.createWebhook({
    callbackURL: `https://your-frigg-app/webhooks/trello?memberId=${memberId}`,
    idModel: boardId,
    description: 'Frigg board watcher',
});
```

**Signature:** `X-Trello-Webhook` = base64(HMAC-SHA1(api_secret, rawBody + callbackURL)).
Use the Power-Up **application secret** from the Trello Auth tab
(`TRELLO_API_SECRET`).

The `extensions/webhooks/` bundle is a HubSpot/Front-style DB-free receiver
(`HEAD` + `POST /webhooks` → resolve → `TRELLO_WEBHOOK`).

## Capability manifest & Fenestra

- `trello.capabilities.json` — `capability-manifest/v0.1` covering member,
  board, list, card, organization, label, webhook objects and mapped Api methods.
- `trello.fenestra.yaml` — draft Power-Ups UI ecosystem (iframe connector,
  board-buttons / card-buttons / attachment-sections) per
  `specs/fenestra/PLATFORMS.md`.

## Testing

```bash
cd packages/v1-ready/trello
npm install
npm test
```

Tests are fully offline — HTTP methods are stubbed. No API key or network
access is required.

## Sources

- REST API — https://developer.atlassian.com/cloud/trello/rest/
- Official OpenAPI — https://developer.atlassian.com/cloud/trello/swagger.v3.json
- Authorization — https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/
- Webhooks — https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/
- Object definitions — https://developer.atlassian.com/cloud/trello/guides/rest-api/object-definitions/
- Power-Ups — https://developer.atlassian.com/cloud/trello/power-ups/

## License

MIT — see [LICENSE.md](./LICENSE.md).
