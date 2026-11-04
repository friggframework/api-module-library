# `@friggframework/api-module-vitally`

Vitally REST API module for the Frigg Framework — customer-success accounts, users/contacts, health scores, tasks (CTAs), notes/conversations (timeline), custom traits, NPS responses, and admins.

## Sources

- [REST API Overview](https://docs.vitally.io/en/articles/9880649-rest-api-overview)
- [REST API collection](https://docs.vitally.io/en/collections/10410457-rest-api)

Vitally does **not** publish a provider OpenAPI. `vitally.openapi.yaml` is a Frigg-curated contract transcribed from the Help Center.

## Auth

HTTP Basic: API key as username, **empty** password.

```
Authorization: Basic base64(<api_key>:)
```

Create keys under **Settings → Integrations → Vitally REST API**.

| Field | Env | Notes |
|---|---|---|
| `api_key` | `VITALLY_API_KEY` | Required |
| `subdomain` | `VITALLY_SUBDOMAIN` | US: builds `https://{subdomain}.rest.vitally.io/resources` |
| `base_url` | `VITALLY_BASE_URL` | Optional override; EU: `https://rest.vitally-eu.io/resources` |

## Install / test

```bash
cd packages/v1-ready/vitally
npm install
npm test
```

## Mappings (ADR-057, UNVALIDATED)

- `mappings/company.js` / `mappings/contact.js` → `business@1`
- `mappings/account-health.js` → Frigg-owned `AccountHealth@1` (sameAs-only)

Wired via `extensions.mapping` on the package export.

## Fenestra

None. Vitally’s integration surface for this connector is the REST API (plus in-app Data Out destinations). There is no documented first-party embeddable UI extension SDK comparable to Slack Block Kit or HubSpot UI extensions.

## Webhooks

No official REST API for webhook subscription management was found. Inbound webhook handling is therefore not shipped in this module.
