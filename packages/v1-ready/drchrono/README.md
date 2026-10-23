# DrChrono API Module (`@friggframework/api-module-drchrono`)

A [Frigg](https://friggframework.org) API module for [DrChrono](https://www.drchrono.com)
EHR / practice management. It wraps the **11.0 REST API** (OAuth 2.0) so a Frigg
integration can work with users, doctors, patients, appointments, offices,
billing line items / payments, insurance payers, iframe enablement, and inbound
webhooks.

Integrations consume it the standard Frigg way:

```javascript
const patients = await this.drchrono.api.listPatients({ page_size: 25 });
const patient = await this.drchrono.api.getPatient(patientId);
```

## Authentication

DrChrono uses **OAuth 2.0 authorization-code** with refresh tokens.

| Env | Purpose |
|---|---|
| `DRCHRONO_CLIENT_ID` | API application client id |
| `DRCHRONO_CLIENT_SECRET` | API application client secret |
| `DRCHRONO_REDIRECT_URI` | Dedicated redirect URI (preferred) |
| `REDIRECT_URI` | Fallback base; module uses `{REDIRECT_URI}/drchrono` when dedicated var unset |
| `DRCHRONO_SCOPE` | Optional; defaults to `patients:read patients:write billing:read billing:write` |
| `DRCHRONO_WEBHOOK_SECRET` | Webhook secret token from API app webhook UI |

- **Authorize:** `https://app.drchrono.com/o/authorize/`
- **Token:** `POST https://app.drchrono.com/o/token/` (`application/x-www-form-urlencoded`)
- **API base:** `https://app.drchrono.com`
- **Headers:** `Authorization: Bearer …`

After token exchange the module identifies the account via `GET /api/users/current`
(prefer `practice_group` as `externalId`).

Docs: [API documentation](https://app.drchrono.com/api-docs/v2/documentation),
[scopes](https://app.drchrono.com/api-docs/popup/v3/scope).

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getCurrentUser()` | `GET /api/users/current` | Authenticated user / identity |
| `listDoctors` / `getDoctor` | `/api/doctors` | Doctors |
| `listPatients` / `getPatient` / `createPatient` / `updatePatient` | `/api/patients` | Patients |
| `listAppointments` / `getAppointment` / `createAppointment` / `updateAppointment` | `/api/appointments` | Appointments (needs `calendar:*` scopes) |
| `listOffices` / `getOffice` | `/api/offices` | Offices |
| `listLineItems` / `getLineItem` | `/api/line_items` | Billing line items |
| `listPatientPayments` / `getPatientPayment` / `createPatientPayment` | `/api/patient_payments` | Patient payments |
| `listPatientPaymentLog` / `getPatientPaymentLog` | `/api/patient_payment_log` | Payment log |
| `listBillingProfiles` / `getBillingProfile` | `/api/billing_profiles` | Billing profiles |
| `listInsurances` / `getInsurance` | `/api/insurances` | Insurance payers |
| `listTransactions` / `getTransaction` | `/api/transactions` | Transactions |
| `createIframeIntegration` / `deleteIframeIntegration` | `/api/iframe_integration` | Enable/disable iframe app |

## Webhooks

Subscriptions are configured in the **DrChrono API application webhook UI**
— not via a public subscribe REST surface. This package ships
`extensions/webhooks/` that:

1. Answers the GET ownership challenge (`msg` → HMAC-SHA256 `secret_token`)
2. Verifies POST `X-drchrono-signature` against the configured secret token
3. Routes by `practice_group` / `doctor` → Frigg integration

Docs: [Webhooks](https://app.drchrono.com/api-docs/v2/documentation).

## Capability manifest

See `drchrono.capabilities.json` (`capability-manifest/v0.1`).

## Canonical mapping (ADR-057)

`mappings/contact.js` maps **Patient → Contact** (`business@1`, **UNVALIDATED**).
Appointments, offices, and billing objects are not mapped — they do not
genuinely fit Company / Deal / Invoice without stretching the schema.

## Fenestra

See `drchrono.fenestra.yaml` for patient-chart and clinical-note iframe
extension points (JWT query-param auth; no host JS SDK).

## Tests

```bash
cd packages/v1-ready/drchrono
npm install
npm test
```
