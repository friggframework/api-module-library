# `@friggframework/api-module-instantly`

Instantly API v2 module for the Frigg Framework — workspaces, campaigns, sending accounts, leads, lead lists, campaign analytics, and webhook subscriptions.

## Sources

- [Developer docs](https://developer.instantly.ai/)
- [Authorization](https://developer.instantly.ai/getting-started/authorization)
- [Official OpenAPI](https://api.instantly.ai/openapi/api_v2.json)

`instantly.openapi.yaml` is a Frigg-curated subset transcribed from the vendor OpenAPI (paths relative to `https://api.instantly.ai/api/v2`).

## Auth

API key as bearer token:

```
Authorization: Bearer <api_key>
```

Create keys under **Settings → Integrations → API**. Env: `INSTANTLY_API_KEY`.

Instantly’s documented OAuth flow connects Google/Microsoft **sending accounts** into a workspace. It is **not** the auth method for this module, so no redirect URI env var is used.

## Install / test

```bash
cd packages/v1-ready/instantly
npm install
npm test
```

## Mappings (ADR-057, UNVALIDATED)

- `mappings/contact.js` → Instantly **Lead** → `business@1` **Contact**

Skipped (no genuine fit):

- **Company / Deal** — Instantly Campaign is an email sequence, Account is a sending mailbox; Lead’s `company_name` / `company_domain` are attributes on Contact, not first-class Company/Deal records.
- **support@1 / billing@1** — no matching Instantly objects in this curated surface.

## Fenestra

None. Instantly’s integration surface for this connector is the REST API (+ webhook delivery). There is no documented first-party embeddable UI extension SDK comparable to Slack Block Kit or HubSpot UI extensions.

## Webhooks

REST webhook subscription management is covered (`list/get/create/patch/delete` on `/webhooks`). Inbound delivery verification handlers are not shipped in this module (HubSpot-style `extensions/webhooks/` can be added when a Frigg integration needs them).
