# `@friggframework/api-module-google`

Frigg v2 API module for Google's multi-product OAuth surface: Gmail, Calendar,
Drive, Docs, Sheets, Analytics (Data + Admin), Search Console, and Google Ads
under one consent.

## Auth

- Authorize: `https://accounts.google.com/o/oauth2/v2/auth` (`access_type=offline`, `prompt=consent`)
- Token: `https://oauth2.googleapis.com/token`
- Identity: `GET https://openidconnect.googleapis.com/v1/userinfo` (`sub` → entity `externalId`)
- Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, optional `GOOGLE_SCOPE`, optional `GOOGLE_ADS_DEVELOPER_TOKEN`

## Docs

- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)

## Tests

```bash
cd packages/v1-ready/google && npm test
```
