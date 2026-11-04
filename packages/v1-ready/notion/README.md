# Notion API Module (`@friggframework/api-module-notion`)

A [Frigg](https://friggframework.org) API module for [Notion](https://www.notion.so)
— pages, databases, data sources, blocks, users, search, comments, and inbound
webhooks.

```javascript
const page = await this.notion.api.createPage({
    parent: { data_source_id: dataSourceId },
    properties: { Name: { title: [{ text: { content: 'Hello' } }] } },
});
const me = await this.notion.api.getSelf();
```

## Authentication

Notion **public connections** use **OAuth 2.0** (authorization code). The module
sends users to:

`https://api.notion.com/v1/oauth/authorize?owner=user&client_id=…&redirect_uri=…&response_type=code`

and exchanges the code at `POST /v1/oauth/token` with HTTP Basic
(`client_id:client_secret`) and a JSON body. Every data-plane request sends
`Authorization: Bearer <token>` and `Notion-Version: 2026-03-11`.

- Docs: https://developers.notion.com/guides/get-started/authorization
- Official OpenAPI: https://developers.notion.com/openapi.json

Set `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, and `REDIRECT_URI` (see
`.env.example`). Entity identity is the OAuth `workspace_id`.

## Webhooks

Notion configures webhook **subscriptions in the connection UI** (no public REST
create/list/delete). This package ships a Tier 3 extension under
`extensions/webhooks/` that:

1. Accepts the unsigned `{ verification_token }` handshake
2. Verifies `X-Notion-Signature` (HMAC-SHA256) on event deliveries
3. Resolves `workspace_id` → Frigg integration and emits `NOTION_WEBHOOK`

Store the verification token as `NOTION_WEBHOOK_VERIFICATION_TOKEN`.

## Capability manifest

See `notion.capabilities.json` (`capability-manifest/v0.1`, `version` matches
this package). Started from lefthookhq/lefthook-bots
`definitions/manifests/notion.json`. Every listed capability maps to a
doc-verified `Api` method; `webhook.verify` → `verifyWebhookSignature`.

## Fenestra

No `notion.fenestra.yaml` in this package. Notion is listed as a pending
Iframe/Database platform in the Fenestra draft, but the only documented
in-product UI surface (Link Previews) is **partner-gated** and has no public
third-party component SDK/catalog suitable for a Fenestra document.
