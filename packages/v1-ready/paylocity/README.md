# `@friggframework/api-module-paylocity`

Frigg v2 API module for the [Paylocity](https://www.paylocity.com/) WebLink / Web Services API (`/api/v2`).

## Auth

OAuth 2.0 **client credentials** with fixed scope `WebLinkAPI`:

```bash
curl --request POST \
  --url https://api.paylocity.com/IdentityServer/connect/token \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'client_id=…' \
  --data-urlencode 'client_secret=…' \
  --data-urlencode 'grant_type=client_credentials' \
  --data-urlencode 'scope=WebLinkAPI'
```

Sandbox uses `https://dc1demogw.paylocity.com/IdentityServer/connect/token`. Credentials require Paylocity partner/customer approval — see [Getting Started](https://developer.paylocity.com/integrations/docs/getting-started).

Every resource path requires a Paylocity `companyId` (≤9 chars).

## Covered endpoints

| Method | HTTP |
|---|---|
| `listEmployees` | `GET /companies/{companyId}/employees` |
| `getEmployee` | `GET /companies/{companyId}/employees/{employeeId}` |
| `createEmployee` | `POST /companies/{companyId}/employees` |
| `updateEmployee` | `PATCH /companies/{companyId}/employees/{employeeId}` |
| `listCompanyCodes` | `GET /companies/{companyId}/codes/{codeResource}` |
| `getCompanyOpenApi` | `GET /companies/{companyId}/openapi` |

## Skipped

- **Webhook subscription REST** — delivery URLs are configured via Paylocity access requests, not a public subscription API.
- Newer CoreHR demographic APIs, closed-beta status searches, payroll/time & labor product surfaces.

## Tests

```bash
cd packages/v1-ready/paylocity && npm test
```

Offline Jest suite (api + definition + OpenAPI/capability spec-sync). Live `frigg auth test .` needs sandbox credentials.
