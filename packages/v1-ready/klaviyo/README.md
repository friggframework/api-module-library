# Klaviyo API Module (`@friggframework/api-module-klaviyo`)

A [Frigg](https://friggframework.org) API module for [Klaviyo](https://www.klaviyo.com)
— email / SMS / push marketing automation. It wraps the official Klaviyo REST
API so a Frigg integration can manage accounts, profiles, lists, events,
segments, campaigns, metrics, and system webhooks.

Integrations consume it the standard Frigg way:

```javascript
const accounts = await this.klaviyo.api.listAccounts();
const profiles = await this.klaviyo.api.listProfiles({
    filter: "equals(email,'jane@acme.com')",
});
```

## Authentication

**Private API key** (this module). Create a key under **Klaviyo → Settings →
API keys**. Every request sends:

```
Authorization: Klaviyo-API-Key pk_…
revision: 2026-10-15
Accept: application/json
```

- **Base URL:** `https://a.klaviyo.com`
- **Revision:** pinned to `2026-10-15` (override via constructor `revision` or
  `KLAVIYO_REVISION`)
- **Docs:** https://developers.klaviyo.com/en/docs/authenticate_

Set `KLAVIYO_API_KEY` in your environment (see `.env.example`). The module
exposes a JSON-Schema authorization form (`getAuthorizationRequirements`) for
the Frigg auth UI / `frigg auth` CLI.

> **Marketplace note:** Klaviyo requires OAuth (PKCE) to list an app in the
> App Marketplace. Private-key auth is fully supported for server-side `/api`
> calls; OAuth support is tracked as an open question.

## API Methods

| Method | HTTP | Official operationId | Scope |
|---|---|---|---|
| `listAccounts` | `GET /api/accounts/` | `get_accounts` | `accounts:read` |
| `getAccount` | `GET /api/accounts/{id}/` | `get_account` | `accounts:read` |
| `listProfiles` | `GET /api/profiles/` | `get_profiles` | `profiles:read` |
| `getProfile` | `GET /api/profiles/{id}/` | `get_profile` | `profiles:read` |
| `createProfile` | `POST /api/profiles/` | `create_profile` | `profiles:write` |
| `updateProfile` | `PATCH /api/profiles/{id}/` | `update_profile` | `profiles:write` |
| `listLists` | `GET /api/lists/` | `get_lists` | `lists:read` |
| `getList` | `GET /api/lists/{id}/` | `get_list` | `lists:read` |
| `createList` | `POST /api/lists/` | `create_list` | `lists:write` |
| `updateList` | `PATCH /api/lists/{id}/` | `update_list` | `lists:write` |
| `deleteList` | `DELETE /api/lists/{id}/` | `delete_list` | `lists:write` |
| `addProfilesToList` | `POST …/relationships/profiles/` | `add_profiles_to_list` | `lists:write` |
| `removeProfilesFromList` | `DELETE …/relationships/profiles/` | `remove_profiles_from_list` | `lists:write` |
| `listEvents` | `GET /api/events/` | `get_events` | `events:read` |
| `getEvent` | `GET /api/events/{id}/` | `get_event` | `events:read` |
| `createEvent` | `POST /api/events/` | `create_event` | `events:write` |
| `listSegments` | `GET /api/segments/` | `get_segments` | `segments:read` |
| `getSegment` | `GET /api/segments/{id}/` | `get_segment` | `segments:read` |
| `listCampaigns` | `GET /api/campaigns/` | `get_campaigns` | `campaigns:read` |
| `getCampaign` | `GET /api/campaigns/{id}/` | `get_campaign` | `campaigns:read` |
| `listMetrics` | `GET /api/metrics/` | `get_metrics` | `metrics:read` |
| `getMetric` | `GET /api/metrics/{id}/` | `get_metric` | `metrics:read` |
| `listWebhooks` | `GET /api/webhooks/` | `get_webhooks` | `webhooks:read` |
| `getWebhook` | `GET /api/webhooks/{id}/` | `get_webhook` | `webhooks:read` |
| `createWebhook` | `POST /api/webhooks/` | `create_webhook` | `webhooks:write` |
| `updateWebhook` | `PATCH /api/webhooks/{id}/` | `update_webhook` | `webhooks:write` |
| `deleteWebhook` | `DELETE /api/webhooks/{id}/` | `delete_webhook` | `webhooks:write` |
| `listWebhookTopics` | `GET /api/webhook-topics/` | `get_webhook_topics` | `webhooks:read` |
| `getWebhookTopic` | `GET /api/webhook-topics/{id}/` | `get_webhook_topic` | `webhooks:read` |

Write bodies use JSON:API (`Content-Type: application/vnd.api+json`).

## Webhooks (inbound extension)

`extensions/webhooks/` is a Tier 3 Frigg extension (modeled on HubSpot's) for
receiving [system webhooks](https://developers.klaviyo.com/en/docs/working_with_system_webhooks).
Available to Advanced KDP customers and Klaviyo app partners.

- Verifies `Klaviyo-Signature` = HMAC-SHA256(`secret_key`, rawBody + `Klaviyo-Timestamp`) hex
- Resolves owning integration via `meta.klaviyo_account_id`
- Set `KLAVIYO_WEBHOOK_SECRET` to the `secret_key` used when creating the webhook

## Capability manifest

See [`klaviyo.capabilities.json`](./klaviyo.capabilities.json) (`capability-manifest/v0.1`).

Started from lefthook-bots `definitions/manifests/klaviyo.json`. Capabilities kept only
when they map to a real `Api` method (`version` = this package’s `1.0.0`). Dropped
lefthook capabilities (`profile.upsert`, `profile.lists`, `profile.subscribe`,
`profile.unsubscribe`) and other mismatches are listed under `openQuestions` in
the manifest (and in the PR).

## Fenestra

No `klaviyo.fenestra.yaml`. Klaviyo's App Marketplace is API/OAuth oriented
and is not listed in the Fenestra platforms research as having first-class UI
extension points (coded components / iframe SDK) comparable to HubSpot, Slack,
etc. (`specs/fenestra/PLATFORMS.md` on branch `claude/fenestra-spec-draft-Q367t`).

## Testing

```bash
cd packages/v1-ready/klaviyo
npm install
npm test
```

Tests are fully offline — HTTP methods are stubbed. No API key or network
access is required.

## Sources

- Authenticate API requests — https://developers.klaviyo.com/en/docs/authenticate_
- API overview — https://developers.klaviyo.com/en/reference/api_overview
- Official OpenAPI — https://github.com/klaviyo/openapi (revision `2026-10-15`)
- System webhooks — https://developers.klaviyo.com/en/docs/working_with_system_webhooks
- OAuth setup — https://developers.klaviyo.com/en/docs/set_up_oauth

## License

MIT — see [LICENSE.md](./LICENSE.md).
