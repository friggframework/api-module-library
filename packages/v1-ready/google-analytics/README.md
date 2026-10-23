# `@friggframework/api-module-google-analytics`

Frigg v2 API module for the [Google Analytics Data API (v1beta)](https://developers.google.com/analytics/devguides/reporting/data/v1/rest).

## Auth

OAuth 2.0 authorization-code:

| | |
|---|---|
| Authorize | `https://accounts.google.com/o/oauth2/v2/auth` |
| Token | `https://oauth2.googleapis.com/token` |
| Header | `Authorization: Bearer <access_token>` |
| Default scope | `https://www.googleapis.com/auth/analytics.readonly` |

Env vars (see `.env.example`):

- `GOOGLE_ANALYTICS_CLIENT_ID`
- `GOOGLE_ANALYTICS_CLIENT_SECRET`
- `GOOGLE_ANALYTICS_REDIRECT_URI` (preferred) or `${REDIRECT_URI}/google-analytics`
- `GOOGLE_ANALYTICS_SCOPE`

## Endpoints covered

| Method | HTTP |
|---|---|
| `runReport` | `POST /v1beta/properties/{id}:runReport` |
| `batchRunReports` | `POST /v1beta/properties/{id}:batchRunReports` |
| `getMetadata` | `GET /v1beta/properties/{id}/metadata` |

Identity helpers (Google OAuth userinfo, not Data API): `getUserDetails`, `getTokenIdentity`. Auth probe: `testAuth` → `getMetadata('0')`.

## Tests

```bash
cd packages/v1-ready/google-analytics && npm test
```
