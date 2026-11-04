# Workday API Module (`@friggframework/api-module-workday`)

A [Frigg](https://friggframework.org) API module for [Workday](https://www.workday.com)
HCM REST APIs — workers, supervisory organizations, absence/time-off, and
staffing Change Job events.

```javascript
const workers = await this.workday.api.listWorkers({ limit: 20, search: 'log' });
const me = await this.workday.api.getWorker('me');
await this.workday.api.requestTimeOff(workerId, body);
```

## Authentication

Workday uses **OAuth 2.0**. This module supports two official modes:

| Mode | Token URL | REST base | When to use |
|---|---|---|---|
| `extend` (default) | `https://auth.api.workday.com/v1/token` with `Authorization: ID …` | `https://api.workday.com/{service}/{version}` | Developer Site API Clients / Extend |
| `integrations` | `https://{tenantHostname}/ccx/oauth2/{tenant}/token` with `Basic …` | `https://{tenantHostname}/api/{service}/{version}/{tenant}` | API Client for Integrations + ISU refresh token |

Grants: `refresh_token` (preferred), Extend `client_credentials` + `tenant_alias`,
and authorization-code exchange via `getTokenFromCode`.

Docs:

- [REST API Fundamentals](https://developer.workday.com/documentation/GUID-85810465-bcfb-4fdf-a26d-55eaff3968a8-enHYPHENus/WorkdayRESTAPIFundamentals)
- [Client Credentials](https://developer.workday.com/documentation/vle1524593542839)
- [Authorization Code](https://developer.workday.com/documentation/yai1528997518068/AuthenticateUsingtheAuthorizationCodeGrantType)
- [Refresh Token](https://developer.workday.com/documentation/cqa1553122177664/RequestaNewAccessTokenwithaRefreshToken)

Set env vars from `.env.example`. Entity `externalId` is `tenant_alias`.

## API Methods

| Method | HTTP | Service |
|---|---|---|
| `listWorkers` / `getWorker` / `getCurrentWorker` | `GET /workers`, `GET /workers/{id}` | Common |
| `listSupervisoryOrganizations` / `getSupervisoryOrganization` | `GET /supervisoryOrganizations[/{id}]` | Common |
| `listSupervisoryOrganizationWorkers` | `GET /supervisoryOrganizations/{id}/workers` | Common |
| `createJobChange` / `submitJobChange` | `POST …/jobChanges`, `POST …/submit` | Staffing |
| `listEligibleAbsenceTypes` | `GET …/eligibleAbsenceTypes` | Absence v5 |
| `listTimeOffDetails` / `getTimeOffDetail` | `GET …/timeOffDetails` | Absence v5 |
| `requestTimeOff` | `POST …/requestTimeOff` | Absence v5 |
| `listLeavesOfAbsence` | `GET …/leavesOfAbsence` | Absence v5 |
| `listBalances` / `getBalance` | `GET /balances[/{id}]` | Absence v5 |

## Skipped / out of scope

- SOAP Hire Employee / Human_Resources (no REST create-worker)
- Full Change Job PATCH subresource surface (only initiate + submit)
- SOAP External Integrations / event notification subscription CRUD (no public REST webhook API)
- Graph API, WQL, RaaS, Financials, Recruiting, Payroll beyond absence balances

## Contract files

- `workday.openapi.yaml` — curated OpenAPI (1:1 with `api.js` operationIds)
- `workday.capabilities.json` — `capability-manifest/v0.1`
- `workday.fenestra.yaml` — draft Fenestra UI description (Workday Extend)

## Tests

```bash
cd packages/v1-ready/workday && npm test
```
