# `@friggframework/api-module-kit`

Kit (formerly ConvertKit) API v4 connector for the Frigg Framework.

## Auth

- **OAuth 2.0** authorization-code + refresh (App Store apps)
  - Authorize: `https://api.kit.com/v4/oauth/authorize`
  - Token: `https://api.kit.com/v4/oauth/token` (`Content-Type: application/json`)
  - API calls: `Authorization: Bearer <access_token>`
- Env: `KIT_CLIENT_ID`, `KIT_CLIENT_SECRET`, `KIT_REDIRECT_URI`, optional `KIT_SCOPE` (default `public`)
- Credential stores: `access_token`, `refresh_token` (refresh tokens are **single-use**)

Personal V4 API keys (`X-Kit-Api-Key`) are supported on the client for automation, but App Store apps should use OAuth.

## Base URL

`https://api.kit.com/v4`

## Docs

- Overview: https://developers.kit.com/api-reference/overview
- Official OpenAPI: https://developers.kit.com/api-reference/v4.json
- Auth: https://developers.kit.com/api-reference/authentication
- OAuth: https://developers.kit.com/api-reference/oauth-refresh-token-flow
- Webhooks: https://developers.kit.com/webhooks/overview

## Local test

```bash
cd packages/v1-ready/kit
npm install
npm test
```
