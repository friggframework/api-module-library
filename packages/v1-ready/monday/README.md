# @friggframework/api-module-monday

Frigg v2 API module for **monday.com Platform GraphQL API v2** with a CRM-boards focus (boards, items, webhooks, Emails & Activities timeline).

## Auth

- OAuth 2.0 authorization code (`https://auth.monday.com/oauth2/authorize` → token at `/oauth2/token`)
- Dedicated redirect: `MONDAY_REDIRECT_URI`
- Classic marketplace tokens do not expire and have no refresh token
- GraphQL: `POST https://api.monday.com/v2` with `API-Version` (default `2026-07`)

## Install / test

```bash
cd packages/v1-ready/monday
npm install
npm test
```

## Docs

- https://developer.monday.com/api-reference/docs
- https://developer.monday.com/apps/docs/oauth
