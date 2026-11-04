# Gainsight CS API Module (`@friggframework/api-module-gainsight`)

A [Frigg](https://friggframework.org) API module for [Gainsight CS (NXT)](https://www.gainsight.com/) REST APIs — companies, people/contacts, users, Cockpit CTAs/tasks, timeline activities, custom/scorecard objects, and Data Management metadata.

Integrations consume it the standard Frigg way:

```javascript
const companies = await this.gainsight.api.queryCompanies({
    select: ['Name', 'Status', 'ARR'],
    limit: 100,
});
const person = await this.gainsight.api.getPersonByEmail('jane@acme.com');
const ctas = await this.gainsight.api.listCtas({ /* filters */ });
```

## Authentication

Gainsight CS uses an **Access Key** sent as the `accesskey` request header. Admins generate it under **Administration → Connectors 2.0 → Gainsight API** (`Access_Key`). The key does not expire.

You must also supply the tenant **customer domain** (e.g. `https://acme.gainsightcloud.com`) used as the API host for `/v1` and `/v2` paths.

```bash
curl https://acme.gainsightcloud.com/v1/meta/services/objects/list \
  -H "accesskey: YOUR_ACCESS_KEY" \
  -H "Content-Type: application/json"
```

Set `GAINSIGHT_ACCESS_KEY` and `GAINSIGHT_BASE_URL` (see `.env.example`).

## Sources (official only)

- [API and Developer Docs](https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs)
- [Generate REST API Key](https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs/Generate_REST_API/Generate_REST_API_Key)
- [Company API](https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs/Company_and_Relationship_API/Company_API_Documentation)
- [People API](https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs/Person_API/People_API_Documentation)
- [User Management APIs](https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs/User_Management_APIs/User_Management_APIs)
- [CTA API](https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs/Cockpit_API/Call_To_Action_(CTA)_API_Documentation)
- [Task APIs](https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs/Cockpit_API/Task_APIs)
- [Timeline APIs](https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs/Timeline_API/Timeline_APIs)
- [Custom Object API](https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs/Custom_Object_API/Gainsight_Custom_Object_API_Documentation)
- [Data Management APIs](https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs/Data_Management_APIs/Data_Management_APIs)
- [Scorecard FAQs](https://support.gainsight.com/gainsight_nxt/05Scorecards/FAQs/Scorecard_FAQs) (no direct Scorecard API; read via Custom Object API)

There is **no official Gainsight CS OpenAPI**; `gainsight.openapi.yaml` is a curated 1:1 mirror of `api.js`.

## API Methods (highlights)

| Method | HTTP | Purpose |
|---|---|---|
| `queryCompanies(body)` | `POST /v1/data/objects/query/Company` | Read companies |
| `createCompanies` / `updateCompanies` / `deleteCompany` | POST/PUT/DELETE | Company write |
| `getPersonByEmail` / `getPersonByGsid` / `upsertPeople` | GET/GET/PUT | People |
| `listUsers` / `createUsers` / `updateUsers` | POST/POST/PUT | GsUser |
| `listObjects` / `describeObject` | GET | Metadata / custom fields |
| `queryCustomObject` (+ create/update/delete) | POST/… | Custom + scorecard health reads |
| `listCtas` / `createCta` / `updateCta` | POST/POST/PUT | Cockpit CTAs |
| `listTasks` / `createTask` / `updateTask` | GET/POST/PUT | Cockpit tasks |
| `queryTimelineActivities` / `createTimelineActivities` / `getTimelineJobStatus` | POST/POST/GET | Timeline |

## Mappings (ADR-057, UNVALIDATED)

- `mappings/company.js` → `business@1` Company
- `mappings/contact.js` → `business@1` Contact (Person)
- `mappings/account-health.js` → `AccountHealth@1` (**sameAs-only**, ours: `https://friggframework.org/canonical/AccountHealth`)

Exposed via `extensions.mapping` from `index.js`.

## Capabilities & Fenestra

- Manifest: `gainsight.capabilities.json` (`capability-manifest/v0.1`)
- **No Fenestra file** — Gainsight CS / Horizon Experience does not publish a third-party UI extension SDK comparable to Zendesk Apps.

## Webhooks

**Not implemented.** The Gainsight [Events API](https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs/Events_API/Events_API) publishes events *into* Gainsight. There is no documented outbound webhook subscription management API for CS NXT.

## Tests

```bash
cd packages/v1-ready/gainsight && npm test
```

Includes `api`, `definition`, `spec-sync`, and `mapping` suites (fully offline).
