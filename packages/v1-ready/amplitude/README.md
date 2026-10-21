# @friggframework/api-module-amplitude

A Frigg API module for [Amplitude](https://amplitude.com) product analytics.
It covers the Dashboard REST API (event segmentation, user activity, user
search, event list), the Export API, Behavioral Cohorts, and the User Profile
API.

## Features

- HTTP Basic authentication (project API key + secret key)
- Region-aware hosts (US `https://amplitude.com`, EU `https://analytics.eu.amplitude.com`)
- Event segmentation, user activity, user search, event taxonomy list
- Raw event export (ZIP of JSON lines)
- Cohort list + async cohort membership export
- User Profile API on `https://profile-api.amplitude.com` (Enterprise; US only)
- Canonical mapping `mappings/contact.js` → `business@1` Contact (**UNVALIDATED**)

## Installation

```bash
npm install @friggframework/api-module-amplitude
```

## Authentication

Amplitude uses HTTP Basic auth. Credentials are combined as
`Base64(api_key:secret_key)` and sent in the
`Authorization: Basic <token>` header. Create keys under
**Settings → Projects → General**.

### Environment variables

```env
AMPLITUDE_API_KEY=your_project_api_key
AMPLITUDE_SECRET_KEY=your_project_secret_key
# Optional region shortcut: us | eu
AMPLITUDE_REGION=us
# Optional explicit host override for Dashboard/Export/Cohorts
AMPLITUDE_BASE_URL=https://amplitude.com
# Optional User Profile host (default https://profile-api.amplitude.com)
AMPLITUDE_PROFILE_BASE_URL=https://profile-api.amplitude.com
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-amplitude');

const api = new Api({
    api_key: process.env.AMPLITUDE_API_KEY,
    secret_key: process.env.AMPLITUDE_SECRET_KEY,
    region: 'us', // or 'eu'
});

const segments = await api.getEventSegmentation({
    e: JSON.stringify({ event_type: '_active' }),
    start: '20260801',
    end: '20260831',
});

const profile = await api.getUserProfile({
    user_id: 'user-123',
    get_amp_props: true,
    get_cohort_ids: true,
});
```

## API reference (client methods)

| Method | Path | Client method |
|--------|------|---------------|
| GET | `/api/2/events/segmentation` | `getEventSegmentation(params)` |
| GET | `/api/2/useractivity` | `getUserActivity(params)` |
| GET | `/api/2/usersearch` | `searchUsers(params)` |
| GET | `/api/2/events/list` | `listEvents()` |
| GET | `/api/2/export` | `exportEvents(params)` |
| GET | `/api/3/cohorts` | `listCohorts(params)` |
| GET | `/api/5/cohorts/request/{cohortId}` | `requestCohortExport(cohortId, params)` |
| GET | `/api/5/cohorts/request-status/{requestId}` | `getCohortExportStatus(requestId)` |
| GET | `/api/5/cohorts/request/{requestId}/file` | `downloadCohort(requestId)` |
| GET | `/v1/userprofile` (profile-api host) | `getUserProfile(params)` |

The machine-readable contract is `amplitude.openapi.yaml` (operationIds match
client methods 1:1). Dashboard/Export/Cohorts paths are sourced from
[Amplitude's public OpenAPI](https://amplitude.com/openapi.json); User Profile
is documented separately and uses an operation-level server URL.

## Webhooks / Fenestra

Custom monitor webhooks and event/cohort streaming webhooks are configured in
the Amplitude UI (or via the separate Developer API with Bearer auth). They are
**not** part of the Dashboard REST / Export / User Profile surfaces this module
targets, so this package does not ship `extensions/webhooks` or a Fenestra file.

## Sources

- https://amplitude.com/docs/apis/authentication
- https://amplitude.com/docs/apis/analytics/dashboard-rest
- https://amplitude.com/docs/apis/analytics/export
- https://amplitude.com/docs/apis/analytics/behavioral-cohorts
- https://amplitude.com/docs/apis/analytics/user-profile
- https://amplitude.com/openapi.json
- https://amplitude.com/docs/apis
