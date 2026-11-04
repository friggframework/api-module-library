# ModMed API Module (`@friggframework/api-module-modmed`)

A [Frigg](https://friggframework.org) API module for [ModMed](https://www.modmed.com)
Certified FHIR R4 (SMART on FHIR). It wraps the Certified API so a Frigg
integration can authenticate via OAuth 2.0 authorization code, resolve the
connected practitioner/practice, and read Patients, Practitioners, Locations,
Encounters, Coverages, and Organizations.

Integrations consume it the standard Frigg way:

```javascript
const patients = await this.modmed.api.listPatients({ _count: 20 });
const practitioner = await this.modmed.api.getPractitioner(id);
```

## Authentication

ModMed Certified FHIR uses **OAuth 2.0 SMART App Launch**
(`authorization_code` + `refresh_token`):

| Purpose | URL |
| --- | --- |
| Authorize | `https://sso.ema.md/auth/realms/fhir/protocol/openid-connect/auth` |
| Token | `https://sso.ema.md/auth/realms/fhir/protocol/openid-connect/token` |
| FHIR base (`aud`) | Practice-specific; demonstration default `https://fhirmp.mmi.prod.fhir.ema-api.com/fhir/r4` |

Docs: [Authentication](https://portal.api.modmed.com/reference/authentication-2).

Set `MODMED_CLIENT_ID`, `MODMED_CLIENT_SECRET`, and preferably
`MODMED_REDIRECT_URI` (see `.env.example`). The auth form also collects the
practice `fhir_base` (OAuth `aud`).

## API Methods

| Method | HTTP | Purpose |
| --- | --- | --- |
| `getMetadata()` | `GET /metadata` | CapabilityStatement (auth test) |
| `getCurrentUser()` | GET `fhirUser` or Practitioner search | Identity helper |
| `listPatients` / `getPatient` | `GET /Patient` | Patients |
| `listPractitioners` / `getPractitioner` | `GET /Practitioner` | Providers |
| `listPractitionerRoles` / `getPractitionerRole` | `GET /PractitionerRole` | Roles |
| `listLocations` / `getLocation` | `GET /Location` | Facilities |
| `listEncounters` / `getEncounter` | `GET /Encounter` | Visits |
| `listCoverages` / `getCoverage` | `GET /Coverage` | Insurance |
| `listOrganizations` / `getOrganization` | `GET /Organization` | Organizations |

## Not in this module

- **EMA Proprietary FHIR v2** (`/ema/fhir/v2`, firm prefix, `x-api-key` +
  password/client_credentials) — separate auth surface.
- Billing resources documented only on the proprietary API: `ChargeItem`,
  `Account`, `Appointment`, and any `Invoice` / `PaymentReconciliation` /
  `Claim` paths that are not listed under Certified FHIR.
- Webhook subscription management — not offered on the Certified portal docs.

## Canonical mappings (ADR-057)

No `extensions.mapping` for `business@1` / `support@1` / `billing@1`. FHIR
Patient/Practitioner/Encounter are clinical resources and do not map cleanly
onto CRM Company/Contact/Deal or billing Invoice/Payment without inventing
field semantics. Skip per ADR-057.

## Fenestra

`modmed.fenestra.yaml` drafts SMART Standalone + EHR Launch extension points
(provider + patient portal). Status: UNVALIDATED.

## Tests

```bash
cd packages/v1-ready/modmed && npm test
```
