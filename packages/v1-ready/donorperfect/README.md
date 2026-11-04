# DonorPerfect API Module (`@friggframework/api-module-donorperfect`)

A [Frigg](https://friggframework.org) API module for [DonorPerfect Online](https://www.donorperfect.com)
(DPO, SofterWare) — the nonprofit CRM / fundraising system. It wraps the public
**XML API** so a Frigg integration can authenticate with an API key, look up and
save donors, create gifts, list gifts for a donor, and resolve DPCODES values.

Integrations consume it the standard Frigg way:

```javascript
const { donors } = await this.donorperfect.api.findDonorByEmail('ada@example.com');
const { donorId } = await this.donorperfect.api.saveDonor({
    donorId: 0,
    values: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
});
```

## Authentication

DonorPerfect uses **API-key** authentication. There is **no header auth** and no
OAuth on the public XML API. Every call is a form-encoded `POST` to
`<baseUrl>/xmlrequest.asp` with the key appended as `apikey=` in the body.

Generate a key in DonorPerfect under **Settings → User Management →** open a
dedicated integration user → **API Self Service → Generate New Key**.

- **Base URL:** `https://www.donorperfect.net/prod` (override with `DONORPERFECT_BASE_URL`)
- **Endpoint:** `/xmlrequest.asp`
- **Identity:** MD5 of the API key exactly as stored (keys contain `%2f` / `%2b`)

Set `DONORPERFECT_API_KEY` in your environment (see `.env.example`). The module
exposes a JSON-Schema authorization form (`getAuthorizationRequirements`) so the
key can be collected through the Frigg auth UI / `frigg auth` CLI.

> The vendor manual samples use GET query strings; this client uses POST because
> GET fails with HTTP 414 past ~8KB, and a full-set donor update re-sends the
> unbounded narrative field.

## Official docs

| Source | Link |
|---|---|
| XML API user manual (PDF) | https://www.softerware.com/doclib/dp/manuals/dpo_sup_manual_xml_api_documentation.pdf |
| API access fact sheet | https://www.donorperfect.com/factsheets/api-access-feature/ |

There is **no vendor-published OpenAPI**. `donorperfect.openapi.yaml` is the
curated subset this client implements (one `operationId` per `Api` method).

## API Methods

| Method | DPO action | Purpose |
|---|---|---|
| `testAuthRequest()` | `select top 1 donor_id from dp` | Auth probe |
| `listDonors({ top, afterDonorId })` | dynamic SELECT on `dp` | List/page donors (≤500/page) |
| `getDonorById(id)` | SELECT from `dp` | Get one donor |
| `findDonorByEmail(email)` | SELECT on `dp.email` | Lookup by email |
| `findDonorByPhone(home, mobile)` | SELECT on phone digits | Lookup by last-10 phone digits |
| `saveDonor({ donorId, values })` | `dp_savedonor` | Create (`donorId=0`) or update |
| `saveGift({ values })` | `dp_savegift` | Create a gift (create-only) |
| `listGiftsByDonorId(id)` | `dp_gifts` | List gifts for a donor |
| `findGiftsByReference(ref)` | SELECT on `dpgift.reference` | Lookup by reference |
| `getCodes(fieldName)` | SELECT on `dpcodes` | Resolve code-list values |

### Skipped (intentionally)

Pledges (`dp_savepledge`), contacts (`dp_savecontact`), UDF / flags / tributes /
payment methods, and the long tail of supplemental procedures in the manual.
Webhook subscription management is **not documented** on the public XML API, so
this package ships **no** `extensions/webhooks/`.

## Capability manifest

See `donorperfect.capabilities.json` (`capability-manifest/v0.1`). Every
capability `method` maps to a real `Api` method (enforced in
`tests/spec-sync.test.js`).

## ADR-057 mappings

`extensions.mapping` (UNVALIDATED):

- Individual donors (`org_rec` ≠ `Y`) → `Contact` (`business@1`)
- Organization donors (`org_rec` = `Y`) → `Company` (`business@1`)

**Gift is not mapped.** A DPO gift is a posted donation, not a pipeline Deal
(`business@1`), support ticket, or billing Invoice/Payment with enough field
overlap to claim a genuine fit under ADR-057. Prefer pair-specific integration
rules if a gift sync is needed.

## Fenestra

**None.** DonorPerfect does not publish a first-party embeddable UI-extension
SDK comparable to HubSpot UI Extensions or Slack Block Kit. This module is API
only.

## Tests

```bash
cd packages/v1-ready/donorperfect && npm test
```

All tests are offline (stubbed `fetch`). Live `frigg auth test .` needs a real
sandbox API key.
