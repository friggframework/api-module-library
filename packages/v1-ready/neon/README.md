# Neon CRM API Module (`@friggframework/api-module-neon`)

A [Frigg](https://friggframework.org) API module for [Neon CRM](https://www.neonone.com/neon-crm)
(API v2). It wraps constituent accounts, donations, campaigns, legacy events /
registrations, property lookups, and webhook subscriptions.

```javascript
const profile = await this.neon.api.getOrganizationProfile();
const { accounts } = await this.neon.api.listAccounts({ pageSize: 50 });
const donation = await this.neon.api.createDonation({
    accountId: '123',
    amount: 50,
});
```

## Authentication

Neon CRM API v2 uses **HTTP Basic**
([docs](https://developer.neoncrm.com/authentication/)):

- Username: Organization ID (Settings → Organization Profile)
- Password: API key for a system user (Settings → User Settings → API Keys)
- Header: `NEON-API-VERSION: 2.11` (module default; current as of vendor docs)

Base URLs ([docs](https://developer.neoncrm.com/api-v2/)):

| Environment | Base URL |
|---|---|
| Production / sandbox | `https://api.neoncrm.com/v2` |
| Trial | `https://trial.neoncrm.com/v2` |

Env vars: see `.env.example` (`NEON_ORG_ID`, `NEON_API_KEY`, `NEON_ENVIRONMENT`).

## Sources of truth

| Artifact | Source |
|---|---|
| Endpoints | Official interactive reference: https://developer.neoncrm.com/api-v2/ |
| Auth / versioning | https://developer.neoncrm.com/authentication/ · https://developer.neoncrm.com/versioning/ |
| Webhooks | https://developer.neoncrm.com/webhooks/ |
| Curated module spec | `./neon.openapi.yaml` (subset; one `operationId` per `Api` method) |
| Capabilities | `./neon.capabilities.json` (`capability-manifest/v0.1`) |
| Canonical mappings | `./mappings/{company,contact}.js` → `business@1`, **UNVALIDATED** |
| UI (Fenestra) | None — Neon has no in-product third-party UI extension SDK (Partner Directory listing only) |

## API methods (curated)

| Method | HTTP | Purpose |
|---|---|---|
| `getOrganizationProfile` | `GET /properties/organizationProfile` | Org identity |
| `listAccounts` / `getAccount` / `createAccount` / `updateAccount` / `patchAccount` | `/accounts` | Constituents |
| `searchAccounts` | `POST /accounts/search` | Criteria search (1 concurrent) |
| `createDonation` / `getDonation` / `listAccountDonations` / `searchDonations` | `/donations` | Donations |
| `listCampaigns` / `getCampaign` | `/campaigns` | Campaigns |
| `listFunds` / `listPurposes` / `listCountries` / `listStateProvinces` | `/properties/*` | Lookups |
| `listEvents` / `createEvent` / `getEvent` | `/events` | Legacy events |
| `createEventRegistration` / `getEventRegistration` / `listEventRegistrations` | `/eventRegistrations` | Registrations |
| `listWebhooks` / `createWebhook` / `getWebhook` / `updateWebhook` / `patchWebhook` / `deleteWebhook` | `/webhooks` | Subscriptions |

Skipped (available in vendor API, not wired here): activities, addresses CRUD,
households, memberships, orders/store, pledges/recurring/soft credits beyond
read-via-account, custom fields/objects, Next Gen events, and most property
enumerations beyond funds/purposes/countries/stateProvinces/organizationProfile.

## Webhooks

`extensions/webhooks` follows the HubSpot two-phase pattern (`useDatabase: false`
receiver → resolve → bound handler). Neon deliveries include `organizationId`
(matched to entity `externalId` = Org ID). Neon does not document an HMAC
signature; optional notify-URL Basic auth is verified when
`NEON_WEBHOOK_USERNAME` / `NEON_WEBHOOK_PASSWORD` are set.

## Mappings (ADR-057)

`extensions.mapping` exports UNVALIDATED `business@1` maps:

- **Individual Account → Contact** (`mappings/contact.js`)
- **Organization Account → Company** (`mappings/company.js`)

No Deal / support@1 / billing@1 maps — Neon donations and memberships are not
sales opportunities or invoices, and there is no ticket object in the curated
surface.

## Tests

```bash
cd packages/v1-ready/neon && npm test
```

Offline Jest suite: `api.test.js`, `definition.test.js`, `spec-sync.test.js`.
`frigg auth test .` needs sandbox credentials (not included).
