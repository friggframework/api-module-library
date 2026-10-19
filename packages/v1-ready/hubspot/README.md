# hubspot

This is the API Module for hubspot that allows the [Frigg](https://friggframework.org) code to talk to the hubspot API.

Read more on the [Frigg documentation site](https://docs.friggframework.org/api-modules/list/hubspot).

## Webhooks (Integration Extension)

HubSpot webhooks are **app-level**, not account-level: one HubSpot app has a single
webhook target URL, and every connected portal (account) fires events to that same
URL. A Frigg app, by contrast, runs many per-portal integration records behind one
deployment. Bridging the two means every integration that wants HubSpot webhooks has
to write the same plumbing — an HTTP receiver, signature verification, a portal-ID
lookup to find the right integration record, and a hand-off to a queue worker.

This module ships that plumbing once as a **Tier 3 Integration Extension** —
`hubspot.extensions.webhooks` — so an integration just plugs it in and writes the
business logic. The extension is a reusable bundle of `{ routes, events }` that the
Frigg framework merges into the consuming integration's definition. See the framework
[EXTENSIONS.md](https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md)
for the full Tier 3 contract.

### How the app-level / account-level split is handled

| Concern | Where it lives | Identity used |
|---|---|---|
| Signature verification | Extension receiver (`HUBSPOT_WEBHOOK_RECEIVED`) | App client secret (`HUBSPOT_CLIENT_SECRET`) |
| Portal → integration routing | `findIntegrationByEntityExternalId` via friggCommands | Inbound `portalId` from the payload |
| Per-account business logic | Your bound `HUBSPOT_WEBHOOK` handler | Per-portal OAuth credentials (loaded by the worker) |

At request time HubSpot POSTs the whole app's events to the receiver. The receiver is
**DB-free** (`useDatabase: false`): it verifies the v3 signature and enqueues one
`HUBSPOT_WEBHOOK_RESOLVE` job per event — no database access. In the queue worker (which
has the database), the resolve step looks up each event's `portalId` → owning integration
and re-enqueues a `HUBSPOT_WEBHOOK` job bound to that integration id. The worker hydrates
that integration with its own per-portal credentials and runs your handler. Keeping the
lookup in the worker is what lets the public receiver endpoint stay DB-free.

> **Make your `HUBSPOT_WEBHOOK` handler idempotent.** Delivery is at-least-once: the
> two SQS hops (resolve → webhook) and HubSpot's own retry-on-non-2xx mean a given
> event can be delivered more than once. Key your processing on a stable identifier
> (e.g. `objectId` + `subscriptionType` + `occurredAt`) so duplicates are no-ops.

### Enabling it on an integration

Bind the extension on your integration's `static Definition.extensions` and map the
`HUBSPOT_WEBHOOK` event to a method on your class:

```javascript
const { IntegrationBase, createFriggCommands } = require('@friggframework/core');
const hubspot = require('@friggframework/api-module-hubspot');

class HubSpotIntegration extends IntegrationBase {
    static Definition = {
        name: 'hubspot',
        modules: { hubspot: { definition: hubspot.Definition } },
        extensions: {
            hubspotWebhooks: {
                extension: hubspot.extensions.webhooks,
                handlers: { HUBSPOT_WEBHOOK: 'onHubSpotEvent' },
            },
        },
    };

    constructor(params) {
        super(params);
        // Required: the receiver resolves portalId → integration through commands.
        this.commands = createFriggCommands({ integrationClass: HubSpotIntegration });
    }

    async onHubSpotEvent({ data }) {
        // Pure business logic. Signature verification, portalId lookup, and
        // queue dispatch are already done — `data.body` is the HubSpot event.
        const { subscriptionType, objectId } = data.body;
        if (subscriptionType === 'contact.creation') {
            await this.syncContact(objectId);
        }
    }
}
```

The framework mounts the receiver route **under your binding key**, on its own
DB-free Lambda function:

```
POST /api/<integration-name>-integration/<bindingKey>/webhooks
```

So the binding `hubspotWebhooks` above yields
`POST /api/hubspot-integration/hubspotWebhooks/webhooks`. Pick a clean binding key
(e.g. `hubspot` → `.../hubspot/webhooks`) and register that URL as the app's webhook
target in your HubSpot app settings. Namespacing by the binding key means a second
module's webhooks extension (e.g. Clockwork) can live on the same integration without
colliding.

### Configuration

| Env var | Purpose |
|---|---|
| `HUBSPOT_CLIENT_SECRET` | App client secret used to verify the `X-HubSpot-Signature-V3` header. The receiver rejects with `401` if it is unset or the signature does not match. |

### What the bundle contributes

- `useDatabase: false` — the receiver route runs without a DB connection.
- **Route:** `POST /webhooks` (namespaced to `/{bindingKey}/webhooks`) → `HUBSPOT_WEBHOOK_RECEIVED`.
- **`HUBSPOT_WEBHOOK_RECEIVED`** — DB-free receiver: verifies the v3 signature and
  enqueues one `HUBSPOT_WEBHOOK_RESOLVE` per event (in parallel). Events missing a
  `portalId` are skipped. No database access.
- **`HUBSPOT_WEBHOOK_RESOLVE`** — queue event (worker, DB): reverse-looks up
  `portalId` → integration id and re-enqueues a `HUBSPOT_WEBHOOK` bound to it. Events
  whose portal maps to no integration are skipped; an ambiguous resolution (one external
  id owned by multiple integrations) throws rather than risk cross-tenant routing.
- **`HUBSPOT_WEBHOOK`** — queue event (worker, hydrated integration): default no-op;
  override via `binding.handlers.HUBSPOT_WEBHOOK` to run your per-event logic with the
  correct per-account context.

## Webhook signature verification

`Api#verifyWebhookSignature({ headers, body, rawBody, method, url, now })` checks HubSpot's v3 signature
([docs](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/request-validation)):
base64 HMAC-SHA256 of `METHOD + URI + body + X-HubSpot-Request-Timestamp`, keyed with the **app client secret**;
deliveries older than 5 minutes are rejected. Returns `true` only for a genuine delivery; never throws.

- Secret: `params.webhookSecret`, else the Api's `client_secret` / `HUBSPOT_CLIENT_SECRET`.
- URI: HubSpot signs the full public URL it called. The runtime does not pass it, so provide `url` per call or
  configure `params.webhookUrl` / `HUBSPOT_WEBHOOK_URL`. `method` defaults to `POST`.
- Pass `rawBody` (the exact bytes received); a re-serialised parsed body will usually not match.

## Additional API methods

All methods take positional arguments and return the parsed HubSpot response unless noted. Tests:
`tests/newMethods.test.js` (nock, asserts the captured request).

| Method | Request | Notes |
|---|---|---|
| `searchContacts({ email, phone, lastContactedBefore, limit, properties, after })` | `POST /crm/v3/objects/contacts/search` | Filters ANDed; `lastContactedBefore` filters `notes_last_contacted` LT |
| `upsertContactByEmail(email, properties)` | `POST /crm/v3/objects/contacts/batch/upsert` (`idProperty: 'email'`) | Returns the single upserted contact. HubSpot does not support partial upserts keyed on email |
| `listDealsForContact(contactId, open?)` | `GET /crm/v4/objects/contacts/{id}/associations/deals`, then deals `batch/read` | Returns full deals; `open` true/false filters on `hs_is_closed` |
| `listContactsForDeal(dealId)` | `GET /crm/v4/objects/deals/{id}/associations/contacts`, then contacts `batch/read` | Returns full contacts |
| `createTask(properties, contactId?)` | `POST /crm/v3/objects/tasks` | Associates to contact (type 204) |
| `createCallEngagement(properties, contactId?)` | `POST /crm/v3/objects/calls` | Associates to contact (type 194) |
| `createNote(properties, contactId?, dealId?)` | `POST /crm/v3/objects/notes` | Associates to contact (202) and/or deal (214) |
| `getTaskById(id, properties?)` | `GET /crm/v3/objects/tasks/{id}` | |
| `updateTask(id, properties)` | `PATCH /crm/v3/objects/tasks/{id}` | |
| `searchTasks({ dueBefore, status, ownerId, limit, properties, after })` | `POST /crm/v3/objects/tasks/search` | `dueBefore` -> `hs_timestamp` LT, `status` -> `hs_task_status`, `ownerId` -> `hubspot_owner_id` |
| `listOwners()` | `GET /crm/v3/owners` | Pages to exhaustion; returns the array |
| `getOwnerByEmail(email)` | `GET /crm/v3/owners?email=` | First match or `null` |
| `listDealStages(pipelineId?)` | `GET /crm/v3/pipelines/deals[/{pipelineId}]` | Array of stages, each with `pipelineId`; all pipelines when omitted |
| `listSubscriptionDefinitions()` | `GET /communication-preferences/v3/definitions` | Returns the definitions array |
| `unsubscribeEmail(emailAddress, subscriptionId, legalBasis?, legalBasisExplanation?)` | `POST /communication-preferences/v3/unsubscribe` | Needs `communication_preferences.write` scope; Marketing Hub Enterprise |

New scopes these methods need beyond the contact/deal ones: `crm.objects.owners.read`, `crm.objects.contacts.write`,
`crm.schemas.*` as already used, `communication_preferences.read` / `.write`, and tasks/calls/notes need the
`crm.objects.contacts.*` + `sales-email-read` style engagement scopes for their object type.
