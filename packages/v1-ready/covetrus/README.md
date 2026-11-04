# `@friggframework/api-module-covetrus`

Frigg v2 API module for **Covetrus Pulse** via **Covetrus Connect** (`https://api.covetrus.com/v1`).

## Auth

OAuth 2.0 authorization code + refresh:

| | |
|---|---|
| Authorize | `https://auth.covetrus.com/oauth/authorize` |
| Token | `https://auth.covetrus.com/oauth/token` |
| Default scope | `clients invoices payments` |
| Redirect | `COVETRUS_REDIRECT_URI` (or `${REDIRECT_URI}/covetrus`) |

Env vars: see `.env.example`.

## Docs

Official REST/OpenAPI docs are **not public** — they ship inside the Covetrus Technology Integration Partner Program / Connect Developers Tool Kit after a signed partner agreement:

- [Technology Integration Partner Program](https://covetrus.com/covetrus-platform/workflow-and-productivity-tools/technology-integration-hub/)
- [Covetrus NA API host](https://api.covetrus.com/)

`covetrus.openapi.yaml` is a curated subset mirroring `api.js` (one `operationId` per client method), seeded from a Left Hook–cleared port. Re-verify against partner docs when credentials are available.

## Tests

```bash
cd packages/v1-ready/covetrus && npm test
```

Offline only (HTTP stubbed). `frigg auth test .` needs partner sandbox credentials.
