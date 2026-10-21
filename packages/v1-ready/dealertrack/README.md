# `@friggframework/api-module-dealertrack`

Frigg v2 API module for [Dealertrack](https://us.dealertrack.com/) (Cox Automotive DMS).

## Sources

- Cox Automotive Integration Platform: https://developer.coxautoinc.com/
- Opentrack program overview: https://us.dealertrack.com/resources/dealertrack-dms-opentrack-integration/
- Opentrack Service API (SOAP, partner-gated): https://ot.dms.dealertrack.com/ServiceAPI.asmx
- Opentrack Customer API (SOAP, partner-gated): https://ot.dms.dealertrack.com/CustomerAPI.asmx
- Opentrack integration terms: https://www.coxautoinc.com/terms/wp-content/uploads/sites/3/Dealertrack-Open-track-Integration-Agreement-v4-10-16-19.pdf

Dealertrack does **not** publish an open, self-service REST OpenAPI. This module ports Left Hook–cleared OAuth2 + REST client notes (`https://api.dealertrack.com/v1`, scopes `service customers repairs payments`) into Frigg v2 shape. Confirm paths against partner docs once sandbox credentials are available.

## Auth

| Detail | Value |
|---|---|
| Method | OAuth 2.0 authorization-code + `refresh_token` |
| Authorize | `https://auth.dealertrack.com/oauth/authorize` |
| Token | `https://auth.dealertrack.com/oauth/token` |
| Default scope | `service customers repairs payments` |
| Identity | `GET /dealer` → `id` as entity/credential `externalId` |
| Env | `DEALERTRACK_CLIENT_ID`, `DEALERTRACK_CLIENT_SECRET`, `DEALERTRACK_SCOPE`, `DEALERTRACK_REDIRECT_URI` (preferred; else `${REDIRECT_URI}/dealertrack`) |

## Layout

Mirrors `packages/v1-ready/fathom/`. ADR-057 `extensions.mapping` (`mappings/business.js` → `business@1` Company/Contact, **UNVALIDATED**). No webhook extension (no public webhook subscription API verified). No Fenestra file (no documented UI extension points; not listed in Fenestra `PLATFORMS.md`).

## Develop

```bash
cd packages/v1-ready/dealertrack
npm install
npm test
```

Tests are fully offline — HTTP methods are stubbed. No sandbox credentials required for unit tests.

## License

MIT — see [LICENSE.md](./LICENSE.md).
