# BambooHR API Module (`@friggframework/api-module-bamboohr`)

A [Frigg](https://friggframework.org) API module for [BambooHR](https://www.bamboohr.com)
— the HRIS platform. It wraps BambooHR's public REST API so a Frigg integration
can read company identity, list/get/create/update employees, discover fields,
and manage permissioned webhooks.

Integrations consume it the standard Frigg way:

```javascript
const company = await this.bamboohr.api.getCompanyInformation();
const page = await this.bamboohr.api.listEmployees({ fields: 'workEmail' });
const employee = await this.bamboohr.api.getEmployee('42', {
    fields: 'firstName,lastName,workEmail',
});
```

## Authentication

BambooHR supports **API key** authentication over HTTP Basic Auth. Generate a
key in BambooHR under the user menu → **API Keys**. The module sends:

```bash
curl -u "{API Key}:x" \
  "https://{companyDomain}.bamboohr.com/api/v1/company_information" \
  -H "Accept: application/json"
```

- **Username:** API key
- **Password:** any string (BambooHR docs conventionally use `x`)
- **Base URL:** `https://{companyDomain}.bamboohr.com/api/v1`
- Always send `Accept: application/json` (otherwise many endpoints default to XML)

Set `BAMBOOHR_API_KEY` and `BAMBOOHR_COMPANY_DOMAIN` (see `.env.example`). The
module also exposes a JSON-Schema authorization form
(`getAuthorizationRequirements`) so credentials can be collected through the
Frigg auth UI / `frigg auth` CLI.

OAuth 2.0 (Developer Portal app + Marketplace partnership) is documented by
BambooHR but not wired in this module yet — see open questions on the PR.

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getCompanyInformation()` | `GET /company_information` | Company identity (domain, names, address). |
| `listEmployees(params)` | `GET /employees` | Cursor-paginated employee roster. |
| `getEmployee(id, params)` | `GET /employees/{id}` | Single employee (`0` = self). |
| `createEmployee(data)` | `POST /employees` | Create employee (min: firstName, lastName). |
| `updateEmployee(id, data)` | `POST /employees/{id}` | Update fields (POST, not PATCH). |
| `getEmployeesDirectory(params)` | `GET /employees/directory` | Published directory (not full roster). |
| `getChangedEmployeeIds(params)` | `GET /employees/changed` | IDs changed since `since`. |
| `listFields()` | `GET /meta/fields` | Discover field aliases. |
| `listWebhooks()` | `GET /webhooks` | List permissioned webhooks. |
| `createWebhook(data)` | `POST /webhooks` | Create webhook (returns `privateKey` once). |
| `getWebhook(id)` | `GET /webhooks/{id}` | Get webhook. |
| `updateWebhook(id, data)` | `PUT /webhooks/{id}` | Update webhook. |
| `deleteWebhook(id)` | `DELETE /webhooks/{id}` | Delete webhook. |
| `listMonitorFields()` | `GET /webhooks/monitor_fields` | Fields usable in `monitorFields`. |

## Webhooks extension

`extensions/webhooks/` follows the HubSpot Tier-3 pattern (DB-free receive →
resolve → consumer handler). BambooHR signs deliveries with HMAC-SHA256 over
`rawBody + timestamp` using the webhook `privateKey` (`X-BambooHR-Signature` /
`X-BambooHR-Timestamp`). Set `BAMBOOHR_WEBHOOK_PRIVATE_KEY` from the value
returned by `createWebhook`.

## Sources

- Getting started / auth: https://documentation.bamboohr.com/docs/getting-started
- API reference: https://documentation.bamboohr.com/reference
- Webhooks: https://documentation.bamboohr.com/docs/webhooks
- Official OpenAPI: https://openapi.bamboohr.io/main/latest/docs/openapi/public-openapi.yaml

## Tests

```bash
cd packages/v1-ready/bamboohr && npm test
```
