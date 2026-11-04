# Changelog

## 1.0.0

- Upgrade Marketo module to Frigg v2 API-module shape under `packages/v1-ready/marketo`
- OAuth 2.0 client credentials via `OAuth2Requester` (Marketo query-param token endpoint)
- Lead Database: get/filter/sync/delete/describe leads; lists + list membership
- Add `marketo.openapi.yaml`, `marketo.capabilities.json`, offline Jest suite (api / definition / spec-sync)
- Drop Mongoose Credential/Entity/Manager and unused bulk OpenAPI client
