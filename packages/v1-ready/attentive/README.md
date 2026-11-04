# `@friggframework/api-module-attentive`

Frigg v2 API module for the [Attentive](https://www.attentive.com) REST API (SMS/email marketing).

## Sources

- Docs: https://docs.attentive.com/
- Auth: https://docs.attentive.com/docs/authentication
- Reference (OpenAPI fragments per endpoint): https://docs.attentive.com/openapi/reference/overview/
- Webhooks: https://docs.attentive.com/docs/overview

## Auth

| Detail | Value |
|---|---|
| Primary | OAuth 2.0 authorization-code (public / distributed apps) |
| Alternate | Private-app API key as `Authorization: Bearer` via `setAuthParams({ api_key })` or `ATTENTIVE_API_KEY` |
| Authorize | `https://ui.attentivemobile.com/integrations/oauth-install` |
| Token | `POST https://api.attentivemobile.com/v1/authorization-codes/tokens` |
| Identity | `GET /me` → `companyId` |

## Layout

Mirrors `packages/v1-ready/fathom/` with HubSpot-style `extensions/webhooks/` and ADR-057 `extensions.mapping` (`mappings/contact.js` → `business@1`, **UNVALIDATED**).

## Develop

```bash
cd packages/v1-ready/attentive
npm install
npm test
```

## Prior work

Upgraded from the v0 ModuleManager package formerly at `packages/needs-updating/attentive`.
