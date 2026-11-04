# PostHog API Module (`@friggframework/api-module-posthog`)

A [Frigg](https://friggframework.org) API module for [PostHog](https://posthog.com)
— product analytics. It wraps PostHog's **private REST API** so a Frigg
integration can authenticate with a personal API key, resolve identity, manage
insights and persons, run HogQL queries, list events, and manage hog-function
destinations (webhook-style realtime pipelines).

Integrations consume it the standard Frigg way:

```javascript
const { Api } = require('@friggframework/api-module-posthog');

const posthog = new Api({
  api_key: process.env.POSTHOG_API_KEY,
  project_id: process.env.POSTHOG_PROJECT_ID,
  // host: 'https://eu.posthog.com', // optional; defaults to US cloud
});

await posthog.getCurrentUser();
await posthog.listInsights({ limit: 10 });
await posthog.createQuery('SELECT count() FROM events LIMIT 10');
```

## Authentication

PostHog private endpoints use a **personal API key** sent as
`Authorization: Bearer <key>`:

```bash
curl https://us.posthog.com/api/users/@me/ \
  -H "Authorization: Bearer $POSTHOG_API_KEY"
```

- **Hosts:** US `https://us.posthog.com` (default), EU `https://eu.posthog.com`
- **Credentials:** `api_key`, `project_id`, optional `host`
- **Env:** `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_HOST` (see `.env.example`)
- Host validation: https only, `posthog.com` / `*.posthog.com`, no userinfo or port

Mint keys under **Settings → Personal API Keys** and grant only the scopes you
need (`user:read`, `insight:read`/`write`, `person:read`/`write`, `query:read`,
`hog_function:read`/`write`, …).

This module does **not** use OAuth. For apps that other PostHog users install,
PostHog documents OAuth separately — out of scope here.

## API Methods

| Method | HTTP | Path |
|---|---|---|
| `getCurrentUser()` | GET | `/api/users/@me/` |
| `listInsights(opts)` | GET | `/api/projects/{id}/insights/` |
| `getInsight(id, opts)` | GET | `/api/projects/{id}/insights/{insight}/` |
| `createInsight(body, opts)` | POST | `/api/projects/{id}/insights/` |
| `updateInsight(id, body, opts)` | PATCH | `/api/projects/{id}/insights/{insight}/` |
| `createQuery(body\|sql, opts)` | POST | `/api/projects/{id}/query/` |
| `listEvents(opts)` | GET | `/api/projects/{id}/events/` (deprecated) |
| `getEvent(id, opts)` | GET | `/api/projects/{id}/events/{event}/` |
| `listPersons(opts)` | GET | `/api/projects/{id}/persons/` |
| `getPerson(id, opts)` | GET | `/api/projects/{id}/persons/{person}/` |
| `updatePerson(id, body, opts)` | PATCH | `/api/projects/{id}/persons/{person}/` |
| `listHogFunctions(opts)` | GET | `/api/projects/{id}/hog_functions/` |
| `getHogFunction(id, opts)` | GET | `/api/projects/{id}/hog_functions/{id}/` |
| `createHogFunction(body, opts)` | POST | `/api/projects/{id}/hog_functions/` |
| `updateHogFunction(id, body, opts)` | PATCH | `/api/projects/{id}/hog_functions/{id}/` |
| `deleteHogFunction(id, opts)` | DELETE | `/api/projects/{id}/hog_functions/{id}/` |

`project_id` comes from the constructor / `setAuthParams`; each method also
accepts a per-call `projectId` / `project_id` override.

## Sources

- [API overview](https://posthog.com/docs/api)
- [Personal API keys](https://posthog.com/docs/api/personal-api-keys)
- [Users](https://posthog.com/docs/api/users)
- [Insights](https://posthog.com/docs/api/insights)
- [Queries](https://posthog.com/docs/api/queries)
- [Events](https://posthog.com/docs/api/events)
- [Persons](https://posthog.com/docs/api/persons)
- [Hog functions](https://posthog.com/docs/api/hog-functions)

Curated OpenAPI: `posthog.openapi.yaml` (operationIds match `Api` methods 1:1).

## Canonical mapping (ADR-057)

`mappings/contact.js` maps PostHog **Person** → `business@1` **Contact**,
exported via `extensions.mapping`, labeled **UNVALIDATED**.

## Fenestra

None. PostHog's relevant extension points for this connector are REST APIs and
hog-function destinations — not an embeddable first-party UI SDK for third-party
product embedding.

## License

MIT — see `LICENSE.md`.
