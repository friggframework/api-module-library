# @friggframework/api-module-axiscare

A [Frigg](https://friggframework.org) API module for the **AxisCare** home-care
operations API.

- **Base URL:** `https://{siteNumber}.axiscare.com`
- **Auth:** Bearer API token — `Authorization: Bearer <API_KEY>` (Admin → API token)
- **Version header:** `X-AxisCare-Api-Version: 2023-10-01` (required; vendor OpenAPI enum)
- **Docs:** [AxisCare API](https://static.axiscare.com/api/documentation.html)
- **Vendor OpenAPI:** [api.yaml](https://static.axiscare.com/api/stoplight/reference/api.yaml)

## Install

```bash
npm install @friggframework/api-module-axiscare
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-axiscare');

const axiscare = new Api({
    api_key: process.env.AXISCARE_API_KEY,
    siteNumber: process.env.AXISCARE_SITE_NUMBER,
});

await axiscare.listClients({ limit: 50 });
await axiscare.getClient(123);
const page = await axiscare.listVisits({
    startDate: '2024-01-01',
    endDate: '2024-01-31',
});
if (page.nextPage) {
    await axiscare.getFromUrl(page.nextPage);
}
```

## Authentication

This is an API-key (Bearer) module. The interactive auth UI renders the form from
`getAuthorizationRequirements()` (`api_key` + `siteNumber`). Credentials persist
`api_key` and `siteNumber`. The module prefixes `Bearer` at request time and
strips a pre-existing prefix on re-hydration so the header is never doubled.

## API surface

| Method | HTTP | Path |
|---|---|---|
| `listClients` / `createClient` | GET/POST | `/api/clients` |
| `getClient` / `updateClient` | GET/PATCH | `/api/clients/{id}` |
| `listClientResponsibleParties` | GET | `/api/clients/{id}/responsibleParties` |
| `getClientResponsibleParty` / `updateClientResponsibleParty` | GET/PUT | `/api/clients/{id}/responsibleParties/{n}` |
| `listLeads` / `createLead` | GET/POST | `/api/leads` |
| `getLead` / `updateLead` | GET/PATCH | `/api/leads/{id}` |
| `listLeadResponsibleParties` | GET | `/api/leads/{id}/responsibleParties` |
| `getLeadResponsibleParty` / `updateLeadResponsibleParty` | GET/PUT | `/api/leads/{id}/responsibleParties/{n}` |
| `listCaregivers` / `createCaregiver` | GET/POST | `/api/caregivers` |
| `getCaregiver` / `updateCaregiver` | GET/PATCH | `/api/caregivers/{id}` |
| `listApplicants` / `createApplicant` | GET/POST | `/api/applicants` |
| `getApplicant` | GET | `/api/applicants/{id}` |
| `listVisits` / `createVisit` | GET/POST | `/api/visits` |
| `getVisit` / `updateVisit` / `deleteVisit` | GET/PATCH/DELETE | `/api/visits/{id}` |
| `listCallLogs` / `createCallLog` | GET/POST | `/api/call-logs` |
| `getCallLog` / `updateCallLog` | GET/PATCH | `/api/call-logs/{id}` |
| `getFromUrl` | GET | absolute `nextPage` URL |

## Webhooks & UI extensions

AxisCare documents inbound webhook *events* (e.g. `client.created`) configured
in the AxisCare admin UI after support enables the feature. There is **no**
public REST API to create or manage webhook subscriptions, so this module does
not ship subscription helpers or a HubSpot-style `extensions/webhooks` receiver
bundle. AxisCare also has no documented third-party UI extension SDK, so there
is no Fenestra file.

## Canonical mappings (ADR-057)

No `extensions.mapping` is included. AxisCare’s primary objects (care clients,
caregivers, visits, applicants, care leads) are home-care operational records
and do not genuinely fit `business@1` Company / Contact / Deal, `support@1`, or
`billing@1` without stretching. Secondary CRM-like objects (contacts,
organizations) exist on the vendor API but are outside this module’s curated
surface and have not been validated against a canonical schema.

## Tests

```bash
cd packages/v1-ready/axiscare && npm test
```
