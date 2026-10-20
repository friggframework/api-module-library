# Namely API Module (`@friggframework/api-module-namely`)

A [Frigg](https://friggframework.org) API module for [Namely](https://namely.com)
— mid-market HCM / HRIS. It wraps Namely's public REST API v1 so a Frigg
integration can read and write employee profiles, discover the profile field
schema, list groups / teams / job titles, and poll home-feed events.

Integrations consume it the standard Frigg way:

```javascript
const page = await this.namely.api.listProfiles({
    page: 1,
    per_page: 50,
    'filter[user_status]': 'active',
});
const me = await this.namely.api.getCurrentProfile();
```

## Authentication

Namely is **multi-tenant**. Every request targets a customer subdomain:

```text
https://{company}.namely.com/api/v1
```

This module authenticates with a **Personal Access Token** (Bearer), which is
what Namely documents for a customer's own custom integration:

```bash
curl https://acme.namely.com/api/v1/profiles/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Collect `company` (subdomain) + `access_token` via the Frigg auth form
(`getAuthorizationRequirements`) or set `NAMELY_COMPANY` /
`NAMELY_ACCESS_TOKEN` (see `.env.example`).

Partner / marketplace apps should register an **OAuth 2.0** application inside
the customer tenant (`/api/v1/oauth2/authorize` + `/api/v1/oauth2/token`)
instead of a PAT — see open questions in the PR. OAuth access tokens use the
same Bearer header, so `setAccessToken` works for either credential type.

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getCompanyInfo()` | `GET /companies/info` | Company name, permalink, logos (auth optional). |
| `getCurrentProfile()` / `testAuth()` | `GET /profiles/me` | Authenticated user's profile. |
| `listProfiles(query)` | `GET /profiles` | Paginated profiles (`page` / `per_page`, filters). |
| `getProfile(id)` | `GET /profiles/{id}` | One profile. |
| `createProfile(data)` | `POST /profiles` | Create profile (`profiles[]` envelope). |
| `updateProfile(id, data)` | `PUT /profiles/{id}` | Update profile (omitted fields preserved). |
| `listProfileFields()` | `GET /profiles/fields` | Tenant profile field schema (incl. custom). |
| `listGroups()` / `getGroup(id)` | `GET /groups` | Departments, office locations, etc. |
| `listGroupTypes()` / `getGroupType(id)` | `GET /group_types` | Group type catalog. |
| `listTeams()` / `getTeam(id)` | `GET /teams` | Teams. |
| `listJobTitles()` / `getJobTitle(id)` | `GET /job_titles` | Job titles. |
| `createJobTitle(data)` / `updateJobTitle(id, data)` | `POST` / `PUT` | Job title write. |
| `listJobTiers()` / `getJobTier(id)` | `GET /job_tiers` | Job tiers (parent of a title). |
| `listEvents(query)` / `getEvent(id)` | `GET /events` | Home-feed events (poll; no webhook API). |

## Webhooks

**None.** The official Namely REST API does not expose webhook subscription
management. Use `listEvents` to poll the home feed, or SCIM/IdP tooling for
identity-change flows (out of scope for this module).

## Testing

```bash
npm install
npm test
```

Tests are fully offline — HTTP methods are stubbed and assertions are made on the
request options the module builds. No token or network access is required.

## Sources

- Namely API developer portal — https://developers.namely.com/
- Authentication — https://developers.namely.com/docs/namely-api/ZG9jOjE1NTkwMDU5-authentication
- Profiles endpoints — https://developers.namely.com/docs/namely-api/ZG9jOjM1MDA2ODMw-profiles-endpoints
- Groups and Teams — https://developers.namely.com/docs/namely-api/ZG9jOjM1MDA2ODI1-groups-and-teams-endpoints
- Official Swagger 2.0 (Stoplight) — curated into `namely.openapi.yaml`

## License

MIT — see [LICENSE.md](./LICENSE.md).
