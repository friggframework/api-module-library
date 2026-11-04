# @friggframework/api-module-revio

Frigg v2 API module for the [Rev.io](https://rev.io) REST API (usage-based billing and customer management).

## Auth

HTTP Basic: `Authorization: Basic Base64(username@client_code:password)`.

See [Basic Authentication](https://developers.rev.io/docs/basic-authentication).

## Docs

- Getting Started: https://developers.rev.io/docs/getting-started
- API reference: https://developers.rev.io/reference
- Webhooks: https://developers.rev.io/docs/webhooks

## Develop

```bash
cd packages/v1-ready/revio
npm install
npm test
```

Copy `.env.example` to `.env` and set `REVIO_USERNAME`, `REVIO_PASSWORD`, and `REVIO_CLIENT_CODE` for live auth tests (`frigg auth test .` — pending sandbox credentials).
