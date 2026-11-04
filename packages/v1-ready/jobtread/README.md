# JobTread API Module (`@friggframework/api-module-jobtread`)

A [Frigg](https://friggframework.org) API module for [JobTread](https://www.jobtread.com)
— construction / field-service software. It wraps JobTread's **Pave** query API so a
Frigg integration can manage organizations, accounts (customers/vendors), locations,
jobs, documents (invoices/orders/bills/bid requests), and webhook subscriptions.

Integrations consume it the standard Frigg way:

```javascript
const grant = await this.jobtread.api.getCurrentGrant();
const orgId = grant.currentGrant.organization.id;
const accounts = await this.jobtread.api.listAccounts({
    organizationId: orgId,
    size: 25,
});
```

## Authentication

JobTread uses a **grant key**. Create one under
**Settings → Integrations → API → Grants**
(`app.jobtread.com/settings/integrations/api/grants`). The key is shown once.

Unlike header-based API keys, JobTread places the credential in the JSON body:

```bash
curl https://api.jobtread.com/pave \
  -H 'Content-Type: application/json' \
  -d '{
    "query": {
      "$": { "grantKey": "YOUR_GRANT_KEY" },
      "currentGrant": { "id": {}, "organization": { "id": {}, "name": {} } }
    }
  }'
```

- **Base URL:** `https://api.jobtread.com/pave`
- **Grant inactivity:** keys expire after **3 months of inactivity** (per JobTread / partner docs).
- **Rate limits:** exist per grant key; exact numbers are not published on the public schema.

Set `JOBTREAD_GRANT_KEY` in your environment (see `.env.example`). The module exposes a
JSON-Schema authorization form (`getAuthorizationRequirements`) for the Frigg auth UI /
`frigg auth` CLI.

## Official sources

| Source | URL |
|---|---|
| Open API product page | https://www.jobtread.com/integrations/open-api |
| In-app API docs | https://app.jobtread.com/docs |
| Live schema introspection | `POST https://api.jobtread.com/pave` with `{ "query": { "schema": { "$": { "path": "root", "expand": true } } } }` |
| Unauthenticated version probe | `{ "query": { "version": {} } }` |

This module was built only from those official surfaces (plus the introspectable
schema). No third-party client code was copied.

## API Methods

| Method | Pave operation | Purpose |
|---|---|---|
| `getCurrentGrant()` | `currentGrant` | Auth/identity — grant, org, user |
| `getOrganization(id)` | `organization` | Single organization |
| `listAccounts({ organizationId, … })` | `organization.accounts` | List customers/vendors |
| `getAccount(id)` | `account` | Single account |
| `createAccount(input)` | `createAccount` / `createdAccount` | Create customer or vendor |
| `updateAccount(input)` | `updateAccount` | Update account |
| `listLocations({ organizationId, … })` | `organization.locations` | List locations |
| `getLocation(id)` | `location` | Single location |
| `createLocation(input)` | `createLocation` / `createdLocation` | Create location (needed before jobs) |
| `updateLocation(input)` | `updateLocation` | Update location |
| `listJobs({ organizationId, … })` | `organization.jobs` | List jobs |
| `getJob(id)` | `job` | Single job |
| `createJob(input)` | `createJob` / `createdJob` | Create job (`locationId` required) |
| `updateJob(input)` | `updateJob` | Update job |
| `listDocuments({ organizationId, … })` | `organization.documents` | List documents |
| `getDocument(id)` | `document` | Single document |
| `createDocument(input)` | `createDocument` / `createdDocument` | Create document |
| `updateDocument(input)` | `updateDocument` | Update document |
| `listWebhooks({ organizationId, … })` | `organization.webhooks` | List webhook subscriptions |
| `getWebhook(id)` | `webhook` | Single webhook |
| `createWebhook(input)` | `createWebhook` / `createdWebhook` | Subscribe (`organizationId`, `url`, `eventTypes`) |
| `deleteWebhook(id)` | `deleteWebhook` | Remove subscription |

List helpers accept optional Pave connection args from the schema: `size`, `page`,
`where`, `sortBy`, `with`, `expressions`, `group`.

### Document types

From the public `documentType` oneOf: `bidRequest`, `customerInvoice`,
`customerOrder`, `vendorBill`, `vendorOrder`. There is no separate Quote object in
the schema — commercial docs are these document types.

### Job creation order

Per the official `createJob` schema description: **a location is required to create
a job; a customer is required to create a location.** Typical flow:
`createAccount` → `createLocation` → `createJob`.

## Webhooks

- **Subscribe via API:** `createWebhook({ organizationId, url, eventTypes })`.
- **eventTypes** come from the public `eventType` oneOf (`jobCreated`,
  `accountUpdated`, `documentSent`, … — 43 values in the live schema).
- **Inbound payload shape and signature verification** are not published on the
  introspectable schema. The Tier-3 extension under `extensions/webhooks/`
  acknowledges deliveries and queues resolve work without inventing HMAC checks.

## Capability manifest

See `jobtread.capabilities.json` (`capability-manifest/v0.1`). Every capability
`method` maps to a real `Api` method (enforced by `tests/spec-sync.test.js`).

## Fenestra

No `jobtread.fenestra.yaml`. JobTread is not listed among platforms with UI
extension points in the Fenestra draft
(`specs/fenestra/PLATFORMS.md` on branch `claude/fenestra-spec-draft-Q367t`),
and JobTread does not publish a first-party UI-extension SDK comparable to
HubSpot/Slack/etc. This module is API + webhook subscription only.

## Tests

```bash
cd packages/v1-ready/jobtread
npm test
```

Offline unit tests stub HTTP. `frigg auth test .` requires a real sandbox grant
key and is marked pending until credentials are available.
