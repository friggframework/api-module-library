# RingCentral API Module (`@friggframework/api-module-ringcentral`)

A [Frigg](https://friggframework.org) API module for [RingCentral RingEX](https://www.ringcentral.com)
— cloud communications (voice, SMS, fax, meetings). It wraps the official
RingEX REST API so a Frigg integration can read account/extension identity,
list and update extensions, manage the message store and SMS, read call logs,
CRUD address-book contacts, and manage webhook subscriptions.

Integrations consume it the standard Frigg way:

```javascript
const account = await this.ringcentral.api.readAccountInfo('~');
const messages = await this.ringcentral.api.listMessages('~', '~', {
    messageType: 'SMS',
});
await this.ringcentral.api.createSMSMessage('~', '~', {
    from: { phoneNumber: '+15551234567' },
    to: [{ phoneNumber: '+15557654321' }],
    text: 'Hello from Frigg',
});
```

## Sources (authoritative)

- API Reference: https://developers.ringcentral.com/api-reference
- Auth code flow: https://developers.ringcentral.com/guide/authentication/auth-code-flow
- Webhooks: https://developers.ringcentral.com/guide/notifications/webhooks/creating-webhooks
- Official OpenAPI: https://github.com/ringcentral/ringcentral-api-specifications

The curated `ringcentral.openapi.yaml` in this package is Left Hook's subset of
those sources — one `operationId` per `Api` method. Do not invent endpoints.

## Authentication

RingCentral uses **OAuth 2.0 authorization code**. Token exchange and refresh
require HTTP Basic (`client_id:client_secret`). The OAuth `scope` query
parameter is **ignored** by RingCentral; grant the needed app permissions in
the Developer Console (e.g. ReadAccounts, SMS, ReadCallLog, Contacts,
SubscriptionWebhook).

- **Production base URL:** `https://platform.ringcentral.com`
- **Sandbox:** `https://platform.devtest.ringcentral.com` (`RINGCENTRAL_ENVIRONMENT=sandbox`)

Set `RINGCENTRAL_CLIENT_ID`, `RINGCENTRAL_CLIENT_SECRET`, and `REDIRECT_URI`
(see `.env.example`).

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `readAccountInfo(accountId)` | `GET /restapi/v1.0/account/{id}` | Account identity |
| `listExtensions` / `readExtension` / `updateExtension` | list/get/update | Extensions |
| `listAccountPhoneNumbers` | `GET .../phone-number` | Company numbers |
| `listMessages` / `readMessage` / `updateMessage` | message-store | Messages |
| `createSMSMessage` | `POST .../sms` | Send SMS |
| `readUserCallLog` / `readUserCallRecord` | call-log | Call history |
| `listContacts` / `readContact` / `createContact` / `updateContact` | address-book | Contacts |
| `listSubscriptions` / `createSubscription` / `readSubscription` / `updateSubscription` / `deleteSubscription` / `renewSubscription` | `/subscription` | Webhooks |
| `verifyWebhookSignature` | — | Compare `Verification-Token` header |

Path params default to `~` (current authorized account/extension).

## Capability manifest

See `ringcentral.capabilities.json` (`capability-manifest/v0.1`). Every
`capabilities.*.method` maps to a real `Api` method.

## Webhooks extension

`extensions/webhooks/` is a Tier-3 DB-free receiver patterned after HubSpot /
QuickBooks: echo `Validation-Token` on subscription setup, verify optional
`Verification-Token`, resolve `accountId` → integration, then emit
`RINGCENTRAL_WEBHOOK`.

## Fenestra

No `ringcentral.fenestra.yaml`. RingCentral is not listed among Fenestra
platform UI ecosystems (`specs/fenestra/PLATFORMS.md` on branch
`claude/fenestra-spec-draft-Q367t`); Embeddable / App Gallery are out of scope
for a Fenestra UI-extension draft until that platform mapping exists.

## Shape credit

Package layout follows `@friggframework/api-module-fathom` (OpenAPI +
spec-sync + jest). OAuth + capabilities + Tier-3 webhooks follow the
QuickBooks Online module (`cursor/quickbooks-api-module-f3ea`).
