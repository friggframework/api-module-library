# `@friggframework/api-module-factorial`

Frigg v2 API module for [Factorial HR](https://factorialhr.com/).

## Sources (official only)

- Developer portal: https://apidoc.factorialhr.com/
- Authentication: https://apidoc.factorialhr.com/docs/authentication
- OAuth company token: https://apidoc.factorialhr.com/docs/request-an-authorization-code
- Webhooks: https://apidoc.factorialhr.com/docs/manage-webhooks
- OpenAPI: https://api.factorialhr.com/oas/?version=2026-10-01

## Auth

OAuth 2.0 **authorization code** with `resource_owner_type=company` (Company Token).

| Detail | Value |
|---|---|
| Authorize | `https://id.factorialhr.com/oauth/authorize` |
| Token | `https://id.factorialhr.com/api/oauth/token` (form-urlencoded) |
| Access token TTL | 1 hour (refresh with `refresh_token`) |
| Marketplace | OAuth required (API keys phased out for marketplace) |

Optional `api_key` (`x-api-key`) is supported on the client for internal/demo scripts.

## Covered surface

Credentials (identity), legal entities, employees (list/get/create-with-contract/update/invite/terminate/unterminate), teams, memberships, locations, webhook subscriptions.

Pinned API version: **2026-10-01**.

## Local test

```bash
cd packages/v1-ready/factorial
npm install
npm test
```
