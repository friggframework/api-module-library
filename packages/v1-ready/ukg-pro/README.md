# UKG Pro API Module (`@friggframework/api-module-ukg-pro`)

A [Frigg](https://friggframework.org) API module for [UKG Pro HCM](https://www.ukg.com/products/ukg-pro)
Core REST. It wraps the official personnel and configuration endpoints so a
Frigg integration can read company, person, employment, and compensation data.

```javascript
const people = await this.ukgPro.api.listPersonDetails({ page: 1, per_Page: 50 });
const person = await this.ukgPro.api.getPersonDetails('C0014', people[0].employeeId);
```

## Authentication

UKG Pro HCM **Core REST** uses **HTTP Basic Authentication** plus a tenant
**Customer API Key**:

```bash
curl "https://{hostname}/personnel/v1/person-details?page=1&per_Page=10" \
  -H "Authorization: Basic $(echo -n 'USERNAME:PASSWORD' | base64)" \
  -H "US-Customer-Api-Key: YOUR_CUSTOMER_API_KEY"
```

- Create a **web service account** under System Configuration → Security →
  Service Account Administration and grant View permissions for the web
  services you need (Employee Person Details, Personnel Integration,
  Employee Compensation Details, Company Configuration Integration).
- Copy the **Customer API Key** and service hostname from System Configuration
  → Security → Web Services.

Set `UKG_PRO_USERNAME`, `UKG_PRO_PASSWORD`, `UKG_PRO_CUSTOMER_API_KEY`, and
`UKG_PRO_BASE_URL` (see `.env.example`).

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `listCompanyDetails` | `GET /configuration/v1/company-details` | Tenant / company identity |
| `listPersonDetails` | `GET /personnel/v1/person-details` | List person records |
| `getPersonDetailsByEmployeeId` | `GET /personnel/v1/person-details/{employeeId}` | Person by employee ID |
| `getPersonDetails` | `GET /personnel/v1/companies/{companyId}/employees/{employeeId}/person-details` | Person by company + employee |
| `listEmploymentDetails` | `GET /personnel/v1/employment-details` | List employment records |
| `getEmploymentDetails` | `GET /personnel/v1/companies/{companyId}/employees/{employeeId}/employment-details` | Employment by company + employee |
| `listCompensationDetails` | `GET /personnel/v1/compensation-details` | List compensation records |
| `getCompensationDetails` | `GET /personnel/v1/companies/{companyId}/employees/{employeeId}/compensation-details` | Compensation by company + employee |

## Skipped (not in this module)

- **Create / update person or employment via Core REST** — not offered on the
  Core REST surface; writes go through SOAP services (Employee Person Service,
  Employee Employment Information Service, Employee New Hire Service) or
  Import Tools.
- **UKG Webhooks Premium API** (`/webhooks/v1/subscriptions`) — separate
  product, OAuth 2.0 client-credentials + `global-tenant-id`, Premium SKU.
- Recruiting / Onboarding REST (separate OAuth token flow).
- People Fabric (beta GraphQL / data-dictionary).
- Pro WFM `/api/v1/commons/persons` surface.
- Payroll, audit, org-levels, code tables, and other configuration domains.

## Testing

```bash
npm install
npm test
```

Tests are fully offline — HTTP methods are stubbed. No sandbox credentials
required.

## Sources

- [Welcome to the UKG Pro HCM API](https://developer.ukg.com/hcm/reference/welcome-to-the-ukg-pro-api)
- [Web Service Account / auth](https://developer.ukg.com/hcm/docs/web-service-account)
- [Authentication overview](https://developer.ukg.com/general/docs/authentication-and-authorization)
- [Person details](https://developer.ukg.com/hcm/reference/get_personnel-v1-person-details)
- [Employment details](https://developer.ukg.com/hcm/reference/get_personnel-v1-employment-details)
- [Compensation details](https://developer.ukg.com/hcm/reference/get_personnel-v1-compensation-details)
- [Company details](https://developer.ukg.com/hcm/reference/companydetails_getcompanydetails)
- [Webhooks Premium (skipped)](https://developer.ukg.com/proplatform/docs/welcome-to-the-webhooks-api)
