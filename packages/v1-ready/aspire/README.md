# Aspire API Module (`@friggframework/api-module-aspire`)

A [Frigg](https://friggframework.org) API module for [Aspire](https://youraspire.com)
— field service management. It wraps the Aspire Cloud External API so a Frigg
integration can authenticate with client credentials and work with companies,
contacts, invoices, opportunities, and payment terms.

```javascript
const { Api } = require('@friggframework/api-module-aspire');
const api = new Api({
    client_id: process.env.ASPIRE_CLIENT_ID,
    client_secret: process.env.ASPIRE_CLIENT_SECRET,
});
await api.getTokenFromClientCredentials();
const companies = await api.getCompanies({ top: 25 });
```

## Authentication

Aspire uses **client credentials** against a custom JSON token endpoint (not a
standard OAuth authorize redirect):

1. Create credentials in Aspire: **Administration → Application → API**.
2. `POST /Authorization` with `{ ClientId, Secret }` → `{ Token, RefreshToken }`.
3. Send `Authorization: Bearer <Token>` on subsequent calls.

Tokens are valid for **24 hours**. This module sets `grant_type` to
`client_credentials` so framework refresh re-mints via `/Authorization`.
`refreshToken()` also wraps `POST /Authorization/RefreshToken`.

- **Production base URL:** `https://cloud-api.youraspire.com`
- **Sandbox:** `https://cloudsandbox-api.youraspire.com`
- Override with `ASPIRE_API_BASE_URL` (see `.env.example`).

Docs: [Authentication & Authorization](https://guide.youraspire.com/apidocs/authentication-authorization-2.md),
[Swagger](https://cloud-api.youraspire.com/swagger/index.html).

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getTokenFromClientCredentials()` | `POST /Authorization` | Mint Token + RefreshToken |
| `refreshToken()` | `POST /Authorization/RefreshToken` | Rotate tokens |
| `getCompanies(params)` | `GET /Companies` | List companies (OData) |
| `createCompany(data)` | `POST /Companies` | Create company |
| `updateCompany(data)` | `PUT /Companies` | Update company |
| `getContacts(params)` | `GET /Contacts` | List contacts (OData) |
| `createContact(data)` | `POST /Contacts` | Create contact |
| `updateContact(data)` | `PUT /Contacts` | Update contact |
| `getInvoices(params)` | `GET /Invoices` | List invoices (OData, read-only) |
| `getOpportunities(params)` | `GET /Opportunities` | List opportunities (OData) |
| `createOpportunity(data)` | `POST /Opportunities` | Create opportunity |
| `getPaymentTerms(params)` | `GET /PaymentTerms` | List payment terms (OData) |

OData helpers accept `filter`, `skip`, `top`, `select`, `orderby`, `expand`
(and `$pageNumber` / `$limit` when needed). Convenience helpers include
`getContact`, `getOpportunity`, `getModifiedCompanies`, `getAllCompanies`, etc.

## Webhooks / Fenestra

The official External API Swagger has **no webhook subscription endpoints**.
Aspire also does not publish a public UI-extension / iframe SDK, so this package
ships neither `extensions/webhooks/` nor a Fenestra file.

## Tests

```bash
cd packages/v1-ready/aspire && npm test
```
