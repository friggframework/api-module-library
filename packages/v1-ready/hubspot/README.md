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
