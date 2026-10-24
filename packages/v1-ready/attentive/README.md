# @friggframework/api-module-attentive

Frigg v2 API module for the [Attentive](https://www.attentive.com) SMS/email marketing platform.

## Sources

- Developer docs: https://docs.attentive.com/
- Authentication: https://docs.attentive.com/docs/authentication
- Official OpenAPI: https://docs.attentive.com/openapi/attentive-api-bundled.yaml
- Webhooks: https://docs.attentive.com/docs/webhooks
- Webhook auth: https://docs.attentive.com/docs/webhook-authentication

## Auth

Public apps use **OAuth 2.0 authorization-code**. Authorize at
`https://ui.attentivemobile.com/integrations/oauth-install`, exchange the code at
`POST /v1/authorization-codes/tokens`. Access tokens **do not expire** (no refresh).

Private apps use a Bearer API key against the same REST base — pass the key as
`access_token`.

Identity is `GET /me` → `companyId` / `companyName`.

## Install

```bash
cd packages/v1-ready/attentive
npm install
cp .env.example .env   # fill ATTENTIVE_CLIENT_ID / SECRET / SCOPE
npm test
```

## Exports

```js
const { Api, Definition } = require('@friggframework/api-module-attentive');
```

## Webhooks extension

`extensions/webhooks/` is a Tier-3 DB-free receiver (HubSpot pattern): verify
`x-attentive-hmac-sha256`, resolve by `companyId`, emit `ATTENTIVE_WEBHOOK`.
Set `ATTENTIVE_WEBHOOK_SIGNING_KEY` from the Attentive app Webhooks tab.

## Fenestra

None — Attentive is not listed among Fenestra UI-extension platforms.
