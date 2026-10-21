# Open Dental API Module (`@friggframework/api-module-opendental`)

A [Frigg](https://friggframework.org) API module for [Open Dental](https://www.opendental.com/)
API Service — the cloud-hosted REST API for Open Dental practice management.
It wraps patients, appointments, procedure logs, statements, payments, claims,
insurance plans, fee schedules, aging reports, and API event subscriptions.

Integrations consume it the standard Frigg way:

```javascript
const patients = await this.opendental.api.listPatientsSimple({ LName: 'Smith' });
const appts = await this.opendental.api.listAppointments({
    dateStart: '2026-01-01',
    dateEnd: '2026-01-31',
});
```

## Authentication

Open Dental uses **two API keys** combined into a single Authorization header
([Developer Setup](https://www.opendental.com/site/apisetup.html)):

```http
Authorization: ODFHIR {DeveloperKey}/{CustomerKey}
```

- **Developer key** — from the Open Dental Developer Portal
- **Customer key** — generated in the portal and enabled by the office under
  Setup → Advanced Setup → API

Set `OPENDENTAL_DEVELOPER_KEY` and `OPENDENTAL_CUSTOMER_KEY` (see `.env.example`).
The module also exposes a JSON-Schema authorization form
(`getAuthorizationRequirements`) so both keys can be collected through the
Frigg auth UI / `frigg auth` CLI.

- **Base URL:** `https://api.opendental.com/api/v1`
- **Pagination:** `Offset` / `Limit` (hard max 100)

## Identity

There is no `/practices` resource in the official API. Entity `externalId` is a
sha256 fingerprint of the Customer API Key. Display name prefers preference
`PracticeTitle` via `GET /preferences?PrefName=PracticeTitle`.

## API Methods (curated core)

| Method | HTTP | Docs |
|---|---|---|
| `listPreferences` / `getPreference` | `GET /preferences` | [Preferences](https://www.opendental.com/site/apipreferences.html) |
| `listClinics` | `GET /clinics` | [Clinics](https://www.opendental.com/site/apiclinics.html) |
| `listPatients` / `listPatientsSimple` / `getPatient` / `createPatient` / `updatePatient` | `/patients` | [Patients](https://www.opendental.com/site/apipatients.html) |
| `getPatientBalances` | `GET /accountmodules/{PatNum}/PatientBalances` | [AccountModules](https://www.opendental.com/site/apiaccountmodules.html) |
| `listAppointments` / `getAppointment` / `createAppointment` / `updateAppointment` | `/appointments` | [Appointments](https://www.opendental.com/site/apiappointments.html) |
| `listProcedureLogs` / `getProcedureLog` | `/procedurelogs` | [ProcedureLogs](https://www.opendental.com/site/apiprocedurelogs.html) |
| `listStatements` / `getStatement` | `/statements` | [Statements](https://www.opendental.com/site/apistatements.html) |
| `listPayments` / `createPayment` / `updatePayment` | `/payments` | [Payments](https://www.opendental.com/site/apipayments.html) |
| `listAging` | `GET /reports/Aging` | [Reports](https://www.opendental.com/site/apireports.html) |
| `listClaims` / `getClaim` | `/claims` | [Claims](https://www.opendental.com/site/apiclaims.html) |
| `listInsPlans` / `getInsPlan` / `listPatPlans` | `/insplans`, `/patplans` | [InsPlans](https://www.opendental.com/site/apiinsplans.html) |
| `listFeeScheds` / `listFees` / `getFee` | `/feescheds`, `/fees` | [Fees](https://www.opendental.com/site/apifees.html) |
| `listSubscriptions` / `createSubscription` / `updateSubscription` / `deleteSubscription` | `/subscriptions` | [Subscriptions](https://www.opendental.com/site/apisubscriptions.html) |

See `opendental.openapi.yaml` for the curated OpenAPI subset (one `operationId`
per `Api` method).

## API Events (webhooks)

Create subscriptions with `createSubscription`. Inbound events POST to your
endpoint with the Customer API Key in `Authorization`, plus `Workstation` and
`Event-Type` headers ([API Events](https://www.opendental.com/site/apievents.html)).
There is no HMAC signature. The `extensions/webhooks/` bundle verifies /
resolves those deliveries (HubSpot-style receive → resolve → consumer handler).

## Canonical schema (ADR-057)

**No mappings shipped.** Open Dental’s core objects (patients, appointments,
procedure logs, dental claims, fee schedules) do not genuinely fit
`business@1` Company/Contact/Deal, `support@1`, or `billing@1` without forcing
dental PMS records into CRM/support/billing shapes. Per ADR-057, mappings are
omitted rather than labeled speculative.

## Fenestra

**None.** Open Dental’s public surface for this module is the REST API Service
plus API Events. There is no documented UI-extension SDK comparable to the
Fenestra draft examples.

## Development

```bash
cd packages/v1-ready/opendental
npm install
npm test
```

## Sources

- [API Developer Setup](https://www.opendental.com/site/apisetup.html)
- [API Specification (PDF)](https://www.opendental.com/resources/OpenDentalAPI.pdf)
- [API Specification index](https://www.opendental.com/site/apispecification.html)
- [Subscriptions](https://www.opendental.com/site/apisubscriptions.html)
- [API Events](https://www.opendental.com/site/apievents.html)

Ported and corrected from Left Hook-owned module code cleared for reuse
(generic Api / definition / webhook surface only; client-specific coupling
removed). Official docs override the source where they disagree (notably the
`ODFHIR DeveloperKey/CustomerKey` Authorization format and several resource
paths).
