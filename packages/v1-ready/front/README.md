# `@friggframework/api-module-front`

Frigg v2 API module for the [Front](https://front.com) Core API.

## Sources

- Core API reference: https://dev.frontapp.com/reference/introduction
- Official OpenAPI: https://github.com/frontapp/front-api-specs (`core-api/core-api.json`)
- OAuth: https://dev.frontapp.com/docs/oauth
- Authentication (Bearer / API tokens): https://dev.frontapp.com/docs/authentication
- Application webhooks: https://dev.frontapp.com/docs/application-webhooks
- Plugin SDK (UI): https://dev.frontapp.com/docs/plugin-overview

`front.openapi.yaml` is Left Hook’s curated subset of the official OpenAPI — one `operationId` per `Api` method.

## Auth

1. **OAuth 2.0** authorization-code (primary; required for public App Store apps). Token exchange uses HTTP Basic (`client_id:client_secret`). Scopes / namespaces / permissions are configured on the Front app feature (not as authorize-query params).
2. **API token** alternate — paste a token from Settings → Developers → API tokens via `setAuthParams({ api_key })` or `FRONT_API_TOKEN`. Same Bearer header as OAuth access tokens.

Env (see `.env.example`):

- `FRONT_CLIENT_ID` / `FRONT_CLIENT_SECRET`
- `REDIRECT_URI` (callback path is `/front`)
- `FRONT_API_TOKEN` (optional alternate)
- `FRONT_WEBHOOK_SECRET` for application-webhook HMAC verification

## Layout

| File | Role |
|---|---|
| `api.js` | `OAuth2Requester` client (Bearer OAuth or API token) |
| `definition.js` | Frigg `Definition` |
| `front.openapi.yaml` | Curated OpenAPI (spec ↔ client sync) |
| `front.capabilities.json` | Capability manifest `v0.1` |
| `front.fenestra.yaml` | Plugin UI extension points (iframe + `@frontapp/plugin-sdk`) |
| `mappings/conversation.js` | ADR-057 mapping → `support@1` (UNVALIDATED) |
| `extensions/webhooks/` | Tier-3 application-webhook receiver (HubSpot-shaped) |

## Tests

```bash
cd packages/v1-ready/front && npm test
```

Offline only — stubs `_get` / `_post` / `_patch` / `_delete`. Live `frigg auth test .` needs sandbox credentials.
