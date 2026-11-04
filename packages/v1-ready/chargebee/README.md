# `@friggframework/api-module-chargebee`

Frigg API module for [Chargebee](https://www.chargebee.com) **Billing API v2** (Product Catalog v2). Demand-source module for connected-account LTV signals — customers, subscriptions, invoices, transactions/payments, catalog items & item prices, events, and webhook endpoint management.

## Sources

- API docs: https://apidocs.chargebee.com/docs/api
- Auth: https://apidocs.chargebee.com/docs/api/auth?prod_cat_ver=2
- Official OpenAPI: https://github.com/chargebee/openapi (`spec/chargebee_api_v2_pc_v2_spec.yaml`)
- Curated subset mirrored by this client: [`chargebee.openapi.yaml`](./chargebee.openapi.yaml)

## Auth

HTTP Basic: **API key as username, empty password**, scoped to a **site subdomain**:

```text
https://{site}.chargebee.com/api/v2
Authorization: Basic base64({api_key}:)
```

Set `CHARGEBEE_SITE` and `CHARGEBEE_API_KEY`, or complete the Basic auth form (`site` + `api_key`). Entity `externalId` is the site subdomain.

## Install / test

```bash
cd packages/v1-ready/chargebee
npm install
npm test
```

## Canonical mappings (ADR-057)

`extensions.mapping.schemas.billing` maps Chargebee subscription / invoice / transaction → `billing@1` Subscription / Invoice / Payment (Stripe-shaped), with `customer_id` → `business.Company`. Labeled **UNVALIDATED** until the canonical registry exists. This module does **not** compute MRR/LTV.

## Webhooks

- REST: `list/get/create/update/deleteWebhookEndpoint` against `/webhook_endpoints`.
- Inbound: Tier-3 extension under `extensions/webhooks/` (HubSpot-shaped). Chargebee authenticates deliveries with **Basic Auth only** (no HMAC). Register URLs with `?site=<subdomain>`.

## Fenestra

No `chargebee.fenestra.yaml`. Chargebee Hosted Pages / Customer Portal are Chargebee-owned UI surfaces, not third-party UI extension points (unlike Stripe Apps/Elements). See the PR for details.
