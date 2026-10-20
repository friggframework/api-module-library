# TriNet API Module (`@friggframework/api-module-trinet`)

A [Frigg](https://friggframework.org) API module for the
[TriNet HR Platform](https://developers.zenefits.com/) (formerly Zenefits
Platform API). It wraps the public Core + Platform + Time Off REST surfaces so a
Frigg integration can provision from companies, people, and employments, update
install/subscription lifecycle status, and verify inbound webhooks.

```javascript
const me = await this.trinet.api.getMe({ includes: 'company' });
const people = await this.trinet.api.listPeople({ status: 'active', limit: 50 });
const person = await this.trinet.api.getPerson(people.data.data[0].id);
```

## Authentication

TriNet uses **OAuth 2.0 authorization code** (admin-only). Developers must
register an application with TriNet and request scopes before going live;
redirect URIs are whitelisted during Beta.

```bash
# Step 1 — authorize
https://secure.trinet.com/oauth2/platform-authorize/?client_id=…&state=…&response_type=code&scope=platform+companies+people&redirect_uri=…

# Step 2 — exchange code
curl -X POST https://secure.trinet.com/oauth2/token/ \
  -d 'grant_type=authorization_code&code=…&client_id=…&client_secret=…&redirect_uri=…'
```

Access tokens expire after **30 days** (`expires_in: 2592000`) and refresh with
`grant_type=refresh_token`. API calls use `Authorization: Bearer <token>` against
`https://api.trinet.com`.

The `platform` scope is mandatory. Set `TRINET_CLIENT_ID`, `TRINET_CLIENT_SECRET`,
`TRINET_SCOPE`, and `REDIRECT_URI` (see `.env.example`).

Entity `externalId` is the TriNet **company id** from `GET /core/me` (or
`GET /core/companies`), which matches `data.company.id` on webhook payloads.

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getMe` | `GET /core/me` | Auth identity / scopes |
| `listCompanies` / `getCompany` | `/core/companies` | Companies |
| `listPeople` / `getPerson` / `listCompanyPeople` | `/core/people` | People |
| `listEmployments` / `getEmployment` / `listPersonEmployments` | `/core/employments` | Employments |
| `listDepartments` / `getDepartment` / `listCompanyDepartments` | `/core/departments` | Departments |
| `listLocations` / `getLocation` / `listCompanyLocations` | `/core/locations` | Locations |
| `listApplications` / `getApplication` | `/platform/applications` | Applications |
| `listCompanyInstalls` / `getCompanyInstall` | `/platform/company_installs` | Installs |
| `setCompanyInstallStatus` | `POST …/status_changes/` | Install lifecycle |
| `setPersonSubscriptionStatus` | `POST …/status_changes/` | Subscription lifecycle |
| `listVacationRequests` / `getVacationRequest` | `/time_off/vacation_requests` | PTO |
| `verifyWebhookSignature` | — | Offline HMAC verification |

## Webhooks

TriNet delivers signed HTTPS POSTs to URLs configured at application setup
(there is **no** public REST webhook subscription CRUD). Verify with
`verifyWebhookSignature` (or the `extensions/webhooks` Tier-3 bundle):

- Header: `Signature` (hex HMAC-SHA256 of the raw body)
- Secret: application webhook shared secret (≠ OAuth client secret)
- Tenant key: `data.company.id` on the JSON body

Store the secret in `TRINET_WEBHOOK_SHARED_SECRET`.

## Skipped (not in this module)

- Company / employee bank accounts (sensitive; optional follow-up)
- Custom fields / custom field values
- Labor groups / labor group types
- Platform write APIs for custom fields and flows (beyond status changes)
- Module UI / Data Store (TriNet-hosted UI collection — not Frigg Fenestra)
- Separate TriNet DCP / PEO / HRIS SwaggerHub APIs (`developers.trinet.com`)

## Testing

```bash
npm install
npm test
```

Tests are fully offline — HTTP methods are stubbed. No sandbox credentials required.

## Sources

- Developer Hub — https://developers.zenefits.com/
- Getting started — https://developers.zenefits.com/reference/getting-started
- Auth — https://developers.zenefits.com/reference/auth
- Scopes — https://developers.zenefits.com/reference/permissions
- Webhooks — https://developers.zenefits.com/reference/webhooks
- Events — https://developers.zenefits.com/reference/events

## License

MIT — see [LICENSE.md](./LICENSE.md).
