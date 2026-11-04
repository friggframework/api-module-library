# `@friggframework/api-module-tekmetric`

Frigg v2 API module for the [Tekmetric](https://www.tekmetric.com/) partner REST API (auto repair shop management).

## Auth

OAuth 2.0 **client credentials**:

1. `POST /oauth/token` with HTTP Basic (`client_id:client_secret`) and form body `grant_type=client_credentials`
2. Call the API with `Authorization: Bearer <access_token>`

Request partner credentials at https://api.tekmetric.com/. Official docs (gated): https://api.tekmetric.com/docs

| Env | Purpose |
|---|---|
| `TEKMETRIC_CLIENT_ID` | OAuth client id |
| `TEKMETRIC_CLIENT_SECRET` | OAuth client secret |
| `TEKMETRIC_ENVIRONMENT` | Optional. Default `production` (`https://shop.tekmetric.com/api/v1`). Set to `sandbox` for the sandbox host. |
| `TEKMETRIC_BASE_URL` | Optional full base override (wins over `TEKMETRIC_ENVIRONMENT`) |
| `TEKMETRIC_API_KEY` | Optional pre-issued bearer access token (source-module alias) |

Client-credentials has **no redirect URI**.

## Covered objects

Shops, customers, vehicles, repair orders, jobs, appointments, employees — list/get plus documented create/update/delete where the official docs nav lists them.

## Development

```bash
cd packages/v1-ready/tekmetric
npm test
```
