# AES API Module (`@friggframework/api-module-aes`)

A [Frigg](https://friggframework.org) API module for **AES ConductorLink**
([Auction Conductor](https://auctionconductor.com) / Auction & Event Solutions).
It wraps the ConductorLink HTTP API so a Frigg integration can manage events,
contributors, event contributors, packages, sales, and payments.

Integrations consume it the standard Frigg way:

```javascript
const events = await this.aes.api.getOrganizationEvents();
const contributors = await this.aes.api.getContributors(eventId);
```

## Authentication

AES uses **API-key** authentication. Obtain an organization key from AES
(`contactus@aesauctions.com`). The module sends it on every request as the
`AES_API_KEY` header (see the ConductorLink C# sample).

```bash
curl -X POST https://auctionconductor.com/API/getOrganizationEvents \
  -H "AES_API_KEY: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

- **Production base URL:** `https://auctionconductor.com`
- **QA staging:** `https://actestserver.com`
- Override via `AES_BASE_URL` or constructor `baseUrl`
- Entity `externalId` is `md5(api_key)`

Set `AES_API_KEY` in your environment (see `.env.example`).

## API Methods

All vendor calls are **HTTP POST** with JSON bodies under `/API/…`.

| Method | Path | Purpose |
|---|---|---|
| `getEvent(eventId)` | `/API/getEvent` | Resolve an event by id |
| `getOrganizationEvents()` | `/API/getOrganizationEvents` | List org events |
| `getContributor(id)` | `/API/getContributor` | Get contributor |
| `getContributors(eventId)` | `/API/getContributors` | List event contributors |
| `createContributor(data)` | `/API/createContributor` | Create contributor |
| `updateContributor(data)` | `/API/updateContributor` | Update contributor |
| `deleteContributor(id)` | `/API/deleteContributor` | Delete contributor |
| `getEventContributor(id)` | `/API/getEventContributor` | Get event-scoped contributor |
| `createEventContributor(data)` | `/API/createEventContributor` | Create event contributor |
| `updateEventContributor(data)` | `/API/updateEventContributor` | Update event contributor |
| `deleteEventContributor(id)` | `/API/deleteEventContributor` | Delete event contributor |
| `associateEventContributors(data)` | `/API/associateEventContributors` | Household / group association |
| `getActivity(eventContributorId)` | `/API/getActivity` | Contributor activity |
| `getSales(eventId)` | `/API/getSales` | Event sales (post-event) |
| `getPayments(eventId, types?)` | `/API/getPayments` | Event payments |
| `getPackages(eventId)` | `/API/getPackages` | List packages |
| `getPackageCategories(eventId)` | `/API/getPackageCategories` | List package categories |
| `lockEvent(eventId, lock?)` | `/API/lockEvent` | Lock/unlock for final sync |

Helper: `Api.parseAESDate('/Date(ms)/')` parses Microsoft JSON dates.

## Webhooks

AES can notify your application when a Contributor checks out from the **event
Microsite** only. Webhook destination is configured with AES (not via a
documented ConductorLink subscribe/list/delete REST API), so this module does
not ship `createWebhook` or `extensions/webhooks`. Sales entered in Auction
Conductor / Event Conductor / Event Manager must be pulled with the API calls
above.

## Fenestra

AES / Auction Conductor does not document third-party UI extension points
(iframe cards, custom pages, or component SDKs) comparable to HubSpot UI
Extensions or GoHighLevel Custom Pages. No `aes.fenestra.yaml` is included.

## Testing

```bash
npm install
npm test
```

Tests are fully offline — HTTP methods are stubbed. No API key or network
access is required.

## Sources

- ConductorLink API Guide — https://help.aesauctions.com/article/3tz5rgz6lo-aes-conductor-link-api-guide
- Get Contributors (`/API/GetContributors`) — https://help.aesauctions.com/article/otb8613u2y-aes-release-notes-version-6-0
- Suite 8.0 API additions (`getPayments`, `getSales`, `lockEvent`, `associateEventContributors`) — https://help.aesauctions.com/article/yqhwlrb4us-aes-suite-8-0
- Suite 12.0 household fields / webhook note — https://help.aesauctions.com/article/xv2crp7r13-aes-suite-12-0

## License

MIT — see [LICENSE.md](./LICENSE.md).
