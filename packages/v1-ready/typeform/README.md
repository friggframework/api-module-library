# `@friggframework/api-module-typeform`

Frigg v2 API module for [Typeform](https://www.typeform.com/developers/) — Create, Responses, and Webhooks APIs over OAuth 2.0.

## Auth

OAuth 2.0 authorization code. Register an app under **Developer Apps** in the Typeform admin panel, then set:

| Env | Purpose |
|---|---|
| `TYPEFORM_CLIENT_ID` | OAuth client id |
| `TYPEFORM_CLIENT_SECRET` | OAuth client secret |
| `TYPEFORM_SCOPE` | Space-delimited scopes (include `offline` for refresh tokens) |
| `REDIRECT_URI` | Shared Frigg redirect base; module appends `/typeform` |
| `TYPEFORM_BASE_URL` | Optional — EU host `https://api.eu.typeform.com` |

Authorize: `https://api.typeform.com/oauth/authorize`  
Token: `https://api.typeform.com/oauth/token` (form-urlencoded)

## Covered surface

| Area | Methods |
|---|---|
| Account | `getMe` |
| Forms | `listForms`, `getForm`, `createForm`, `updateForm`, `deleteForm` |
| Responses | `listResponses` |
| Webhooks | `listWebhooks`, `getWebhook`, `createOrUpdateWebhook`, `deleteWebhook` |

See `typeform.openapi.yaml` (1:1 with `api.js`) and `typeform.capabilities.json`.

## Webhooks extension

`extensions/webhooks/` mirrors the HubSpot Tier-3 pattern: verify `Typeform-Signature` (HMAC-SHA256), enqueue resolve, then consumer handler. Set `TYPEFORM_WEBHOOK_SECRET` to the webhook `secret`.

## Tests

```bash
cd packages/v1-ready/typeform && npm test
```
