# Personio API Module (`@friggframework/api-module-personio`)

A [Frigg](https://friggframework.org) API module for [Personio](https://www.personio.com)
— the HRIS platform. It wraps Personio's public **v2** REST API so a Frigg
integration can manage persons, absence periods, attendance periods, and webhook
subscriptions.

```javascript
const people = await this.personio.api.listPersons({ status: 'ACTIVE', limit: 50 });
const person = await this.personio.api.getPerson(people._data[0].id);
```

## Authentication

Personio uses **OAuth 2.0 Client Credentials**:

```bash
curl -X POST https://api.personio.de/v2/auth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'grant_type=client_credentials' \
  --data 'client_id=YOUR_CLIENT_ID' \
  --data 'client_secret=YOUR_CLIENT_SECRET'
```

Create credentials under **Marketplace → Connected integrations → Create custom
integration**. Tokens default to a 24-hour TTL and are sent as
`Authorization: Bearer <access_token>`.

The module also collects a **Company ID** (matches `company_id` on webhook
payloads) so Frigg can route inbound webhooks to the correct tenant.

Set `PERSONIO_CLIENT_ID`, `PERSONIO_CLIENT_SECRET`, and optionally
`PERSONIO_SCOPE` / `PERSONIO_COMPANY_ID` (see `.env.example`).

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getToken` / `getTokenFromClientCredentials` | `POST /v2/auth/token` | Mint a Bearer token |
| `listPersons` / `getPerson` / `createPerson` / `updatePerson` / `deletePerson` | `/v2/persons` | Person CRUD |
| `listAbsencePeriods` / `getAbsencePeriod` / `createAbsencePeriod` / `updateAbsencePeriod` / `deleteAbsencePeriod` | `/v2/absence-periods` | Absence CRUD |
| `listAbsenceTypes` / `getAbsenceType` | `/v2/absence-types` | Absence type catalog |
| `listAttendancePeriods` / `getAttendancePeriod` / `createAttendancePeriod` / `updateAttendancePeriod` / `deleteAttendancePeriod` | `/v2/attendance-periods` | Attendance CRUD |
| `listWebhooks` / `getWebhook` / `createWebhook` / `updateWebhook` / `deleteWebhook` | `/v2/webhooks` | Webhook subscription CRUD |
| `rotateWebhookSigningSecret` | `POST /v2/webhooks/{id}/signing-secret` | Rotate signing secret |
| `verifyWebhookSignature` | — | Offline HMAC verification |

## Webhooks

Personio delivers signed POSTs to your HTTPS endpoint. Verify with
`verifyWebhookSignature` (or the `extensions/webhooks` Tier-3 bundle):

- Headers: `X-Personio-Webhook-Timestamp`, `X-Personio-Webhook-Signature`
- Signed string: `{timestamp}.{raw_body}`
- Algorithm: HMAC-SHA256, lowercase hex, secret used verbatim
- Tenant key: `company_id` on the JSON body

Store the secret returned once from `createWebhook` /
`rotateWebhookSigningSecret` in `PERSONIO_WEBHOOK_SIGNING_SECRET` (comma-separate
active + retiring during rotation).

## Skipped (not in this module)

- Recruiting API (separate access token / XML career feed)
- Custom Reports / Reports v2
- Documents, org units, workplaces, cost centers, payroll, projects
- Webhook activity / events / redelivery / ping / test-event convenience endpoints
- Legacy Personnel Data **v1** `/v1/company/employees` surface (superseded by v2 persons)

## Testing

```bash
npm install
npm test
```

Tests are fully offline — HTTP methods are stubbed. No sandbox credentials required.

## Sources

- Developer Hub — https://developer.personio.de/
- Getting started — https://developer.personio.de/docs/getting-started-with-the-personio-api
- Auth token — https://developer.personio.de/reference/post_v2-auth-token
- OpenAPI index — https://developer.personio.de/openapi
- Webhooks — https://developer.personio.de/docs/webhooks

## License

MIT — see [LICENSE.md](./LICENSE.md).
