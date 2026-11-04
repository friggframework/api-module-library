# Rippling API Module (`@friggframework/api-module-rippling`)

A [Frigg](https://friggframework.org) API module for [Rippling](https://www.rippling.com)
— the HRIS / workforce platform. It wraps Rippling's **Platform API v2 REST**
surface so a Frigg integration can authenticate via App Shop OAuth, bind a
company, and sync workers, users, departments, work locations, and draft hires.

## Authentication

**App Shop partners (marketplace connected apps):** OAuth 2.0 authorization code.

| Step | URL |
|---|---|
| Authorize | `https://app.rippling.com/apps/PLATFORM/{APP_NAME}/authorize` |
| Token | `POST https://api.rippling.com/api/o/token/` (Basic `client_id:client_secret`) |
| Mark installed | `POST https://api.rippling.com/platform/api/mark_app_installed` |
| REST | `https://rest.ripplingapis.com` + `Rippling-Api-Version: 2024-08-01` |

Partner approval is required to publish an App Shop listing. See
[Installation (OAuth)](https://developer.rippling.com/documentation/developer-portal/v2-guides/installation).

**Customer / internal automation:** Bearer API tokens from Developer → API
credentials against the same REST host (not for acting on behalf of other orgs).

Set `RIPPLING_CLIENT_ID`, `RIPPLING_CLIENT_SECRET`, `RIPPLING_APP_NAME`, and
`RIPPLING_SCOPE` (see `.env.example`).

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `listCompanies` | `GET /companies/` | Bind token → company (identity) |
| `listWorkers` / `getWorker` | `GET /workers[/id]/` | Employment profiles |
| `listUsers` / `getUser` | `GET /users[/id]/` | Person/login profiles |
| `listDepartments` / `getDepartment` | `GET /departments[/id]/` | Departments |
| `createDepartment` / `updateDepartment` | `POST` / `PATCH` | Department writes |
| `listWorkLocations` / `getWorkLocation` | `GET /work-locations[/id]/` | Sites |
| `createWorkLocation` / `updateWorkLocation` | `POST` / `PATCH` | Work location writes |
| `createDraftHires` | `POST /draft-hires/` | Hire create path |
| `markAppInstalled` | `POST` (platform host) | Finalize App Shop install |

## Docs

- [REST API overview](https://developer.rippling.com/documentation/rest-api)
- [HRIS getting started](https://developer.rippling.com/documentation/rest-api/guides/hris-getting-started)
- [Org data getting started](https://developer.rippling.com/documentation/rest-api/guides/org-data-getting-started)
- [App Shop webhooks](https://developer.rippling.com/documentation/developer-portal/v2-guides/webhooks) (portal-configured; no REST subscription API)

## Tests

```bash
cd packages/v1-ready/rippling && npm test
```
