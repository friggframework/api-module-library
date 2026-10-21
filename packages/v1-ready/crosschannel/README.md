# @friggframework/api-module-crosschannel

Frigg v2 API module for the **Listrak Cross Channel** REST API.

Posts custom cross-channel events and reads event configuration schemas used by Journey Hub automations across email, SMS, push, and web.

## Sources

| Resource | URL |
|---|---|
| Interactive docs | https://api.listrak.com/crosschannel/v1/docs |
| Agent-friendly docs | https://api-docs.tools.listrak.com/cross-channel/llms.txt |
| Official OpenAPI | https://api-docs.tools.listrak.com/cross-channel/openapi.json |
| Authentication | https://api-docs.tools.listrak.com/cross-channel/guides/authentication.md |

## Auth

OAuth 2.0 **client_credentials** (no browser redirect, no refresh token).

```http
POST https://auth.listrak.com/OAuth2/Token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=…&client_secret=…
```

Use credentials from an Integration of type **Cross Channel** (Integrations → Integration Management). Email/SMS credentials are not interchangeable.

Env vars (see `.env.example`):

- `CROSSCHANNEL_CLIENT_ID`
- `CROSSCHANNEL_CLIENT_SECRET`
- optional `CROSSCHANNEL_BASE_URL`, `CROSSCHANNEL_TOKEN_URI`

## Endpoints

| Method | Path | Client |
|---|---|---|
| GET | `/eventConfigurations` | `getEventConfigurations` |
| GET | `/eventConfigurations/{eventUID}` | `getSchemaByEventUid` |
| POST | `/eventConfigurations/{eventUID}/events` | `postEvents` |

## Local test

```bash
cd packages/v1-ready/crosschannel
npm install
npm test
```
