# Klaviyo API Module (`@friggframework/api-module-klaviyo`)

A [Frigg](https://friggframework.org) API module for [Klaviyo](https://www.klaviyo.com)
— email / SMS / push marketing automation. It wraps the official Klaviyo REST
API so a Frigg integration can manage accounts, profiles, lists, events,
segments, campaigns, metrics, subscriptions, and system webhooks.

Integrations consume it the standard Frigg way:

```javascript
const accounts = await this.klaviyo.api.listAccounts();
const profiles = await this.klaviyo.api.listProfiles({
    filter: "equals(email,'jane@acme.com')",
});
```

## Authentication

### Primary: OAuth 2.0 + PKCE (App Marketplace)

Matches lefthook-bots `auth: oauth2` and Klaviyo’s marketplace requirement.

| Step | URL |
|---|---|
| Authorize | `https://www.klaviyo.com/oauth/authorize` |
| Token / refresh | `https://a.klaviyo.com/oauth/token` |

- `response_type=code`, `code_challenge_method=S256`, `code_challenge`
- Token exchange: `Authorization: Basic base64(client_id:client_secret)` +
  `grant_type=authorization_code` + `code` + `code_verifier` + `redirect_uri`
- API calls: `Authorization: Bearer <access_token>` + `revision: 2026-10-15`
- Docs: https://developers.klaviyo.com/en/docs/set_up_oauth

Env: `KLAVIYO_CLIENT_ID`, `KLAVIYO_CLIENT_SECRET`, `KLAVIYO_SCOPE`, `REDIRECT_URI`
(see `.env.example`). PKCE `code_verifier` is packed into OAuth `state` so it
survives the browser redirect (same approach as the Salesforce module).

### Alongside: private API key

When `api_key` is set and no `access_token` is present, requests use
`Authorization: Klaviyo-API-Key pk_…` (official private-key scheme). Useful for
non-marketplace installs and offline tests. Docs:
https://developers.klaviyo.com/en/docs/authenticate_

## API Methods

| Method | HTTP | Official operationId |
|---|---|---|
| `listAccounts` / `getAccount` | `GET /api/accounts[/\{id\}]/` | `get_accounts` / `get_account` |
| `listProfiles` / `getProfile` | `GET /api/profiles[/\{id\}]/` | `get_profiles` / `get_profile` |
| `createProfile` / `updateProfile` | `POST` / `PATCH /api/profiles…` | `create_profile` / `update_profile` |
| `createOrUpdateProfile` | `POST /api/profile-import/` | `create_or_update_profile` |
| `getProfileLists` | `GET /api/profiles/{id}/lists/` | `get_lists_for_profile` |
| `subscribeProfiles` | `POST /api/profile-subscription-bulk-create-jobs/` | `bulk_subscribe_profiles` |
| `unsubscribeProfiles` | `POST /api/profile-subscription-bulk-delete-jobs/` | `bulk_unsubscribe_profiles` |
| `listLists` … `deleteList` / add/remove profiles | lists CRUD + relationships | `get_lists` … |
| `listEvents` / `getEvent` / `createEvent` | events | `get_events` … |
| `listSegments` / `getSegment` | segments | `get_segments` … |
| `listCampaigns` / `getCampaign` | campaigns (`filter` required) | `get_campaigns` … |
| `listMetrics` / `getMetric` | metrics | `get_metrics` … |
| `listWebhooks` … `getWebhookTopic` | system webhooks | `get_webhooks` … |

Write bodies use JSON:API (`Content-Type: application/vnd.api+json`).

## Webhooks (inbound extension)

`extensions/webhooks/` is a Tier 3 Frigg extension (modeled on HubSpot's) for
receiving [system webhooks](https://developers.klaviyo.com/en/docs/working_with_system_webhooks).

- Verifies `Klaviyo-Signature` = HMAC-SHA256(`secret_key`, rawBody + `Klaviyo-Timestamp`) hex
- Resolves owning integration via `meta.klaviyo_account_id`
- Manifest events use official common topics:
  `event:klaviyo.subscribed_to_email_marketing`,
  `event:klaviyo.unsubscribed_from_email_marketing`

## Capability manifest

See [`klaviyo.capabilities.json`](./klaviyo.capabilities.json) (`capability-manifest/v0.1`).

Started from lefthook-bots `definitions/manifests/klaviyo.json`. `version` =
package `1.0.0`. `auth: oauth2`. Every capability maps to a real `Api` method.

## Fenestra

No `klaviyo.fenestra.yaml`. Klaviyo’s App Marketplace is API/OAuth oriented and
is not listed in the Fenestra platforms research as having first-class UI
extension points (`specs/fenestra/PLATFORMS.md` on
`claude/fenestra-spec-draft-Q367t`).

## Testing

```bash
cd packages/v1-ready/klaviyo
npm install
npm test
```

Tests are fully offline — HTTP methods are stubbed. No credentials required.

## Sources

- OAuth — https://developers.klaviyo.com/en/docs/set_up_oauth
- Authenticate — https://developers.klaviyo.com/en/docs/authenticate_
- API overview — https://developers.klaviyo.com/en/reference/api_overview
- Official OpenAPI — https://github.com/klaviyo/openapi (revision `2026-10-15`)
- System webhooks — https://developers.klaviyo.com/en/docs/working_with_system_webhooks

## License

MIT — see [LICENSE.md](./LICENSE.md).
