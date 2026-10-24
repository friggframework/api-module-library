# Digitail API Module (`@friggframework/api-module-digitail`)

A [Frigg](https://friggframework.org) API module for [Digitail](https://digitail.io)
— veterinary practice management (PIMS). It wraps Digitail's public REST API so a
Frigg integration can connect clinics via OAuth 2.0 (PKCE), sync pet parents and
pets, manage appointments, read invoices/sales, and list medical records.

```javascript
const me = await this.digitail.api.getAuthMe({ 'include[]': ['clinic'] });
const parents = await this.digitail.api.listPetParents({ page: 1 });
```

## Authentication

Digitail uses **OAuth 2.0 Authorization Code Grant with PKCE**. Access is
review-based ([getting access](https://documentation.digitail.io/getting-access)).

| | Production | Sandbox (default for new partners) |
|---|---|---|
| Authorize | `https://vet.digitail.io/oauth/authorize` | `https://developer.digitail.io/oauth/authorize` |
| Token | `https://vet.digitail.io/oauth/token` | `https://developer.digitail.io/oauth/token` |
| API | `https://vet.digitail.io/api/v1` | `https://developer.digitail.io/api/v1` |

Override hosts with `DIGITAIL_OAUTH_HOST` + `DIGITAIL_API_BASE_URL` when using sandbox.

Requests send `Authorization: Bearer <access_token>`. Multi-clinic users may set
`X-ClinicId` via `api.setClinicId(id)` or `DIGITAIL_CLINIC_ID`.

Env vars (see `.env.example`):

- `DIGITAIL_CLIENT_ID` / `DIGITAIL_CLIENT_SECRET`
- `DIGITAIL_REDIRECT_URI` (dedicated; must match the registered callback)
- Optional: `DIGITAIL_API_BASE_URL`, `DIGITAIL_OAUTH_HOST`, `DIGITAIL_CLINIC_ID`

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getAuthMe(params)` | `GET /auth/me` | Logged-in vet (+ clinic/employee includes) |
| `listClinics(params)` | `GET /clinics` | Clinics for the authenticated user |
| `listPetParents` / `getPetParent` / `createPetParent` / `updatePetParent` | `/pet-parents` | Pet owners (clients) |
| `listPets` / `getPet` / `createPet` | `/pets` | Patients (pets); create is multipart |
| `listAppointments` / `getAppointment` / `createAppointment` | `/appointments` | Scheduling |
| `listInvoices` / `getInvoice` | `/invoices` | Invoices |
| `getSale` | `GET /sales/{id}` | Sale (+ nested payments via `include`) |
| `listRecords` | `GET /records` | Medical records |

## Webhooks

Digitail does **not** offer webhooks. The API is pull-based; poll list endpoints
(and use `filter[last_fetched]` / `filter[updated_from]` where documented).
See [technical considerations](https://documentation.digitail.io/technical-considerations).

## Docs

- https://documentation.digitail.io/
- Auth: https://documentation.digitail.io/6-ex-authentication
