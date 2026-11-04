# `@friggframework/api-module-churnzero`

Frigg v2 API module for the [ChurnZero](https://churnzero.com) **REST API** (OData v4).

## Sources

| Resource | URL |
|---|---|
| REST API reference | https://app.churnzero.net/developers |
| Official OpenAPI | https://app.churnzero.net/developers/churnzero_oas.json |
| REST API section | https://support.churnzero.com/hc/en-us/sections/360009277731-REST-API |
| Power BI / OData guide | https://support.churnzero.com/hc/en-us/articles/360044874111-Using-the-REST-API-with-Microsoft-Power-BI |

## Auth

HTTP **Basic**: ChurnZero **username** + user **API Key** (key as password). Tenant `base_url` is required:

`https://{tenant}.{region}app.churnzero.net/public/v1`

## Scope

Read-priority OData entities used for customer-success / account-health signal: Account, Contact, UserAccount, ChurnScore, ChurnScoreCalculation, Task, Event, Note, Meeting, Message.

See `churnzero.openapi.yaml` (curated subset; one `operationId` per `Api` method) and `churnzero.capabilities.json`.

## Mappings (ADR-057, UNVALIDATED)

- `mappings/company.js` / `mappings/contact.js` → `business@1`
- `mappings/account-health.js` → `AccountHealth` (**sameAs-only**, Frigg URI)

Wired through `extensions.mapping` in `index.js`.

## Fenestra / webhooks

- **Fenestra:** none — ChurnZero does not document third-party UI extension points comparable to Canvas Kit / CRM cards.
- **Webhooks:** no REST subscription CRUD in the official OpenAPI; outbound callbacks are Play UI steps only.

## Tests

```bash
cd packages/v1-ready/churnzero && npm test
```

`frigg auth test .` requires real sandbox credentials (not faked here). See `.env.example` for variable names.
