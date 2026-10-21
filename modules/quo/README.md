# @friggframework/api-module-quo

Frigg API module for **Quo** — the business phone / calling product formerly known as **OpenPhone**. The REST API still lives at `api.openphone.com`; the docs have moved to [quo.com/docs](https://www.quo.com/docs).

## Features

- **API-key authentication** (`ApiKeyRequester`) — the key is sent **raw** in the `Authorization` header (no `Bearer` prefix).
- Calls: list, get by ID, recordings, transcripts, summaries.
- Messages: list, get, send.
- Contacts, phone numbers, users.
- Webhooks: list/get/create (calls, messages, call-summaries, call-transcripts)/delete.

## Installation

```bash
npm install @friggframework/api-module-quo
```

## Configuration

```env
# Your Quo / OpenPhone API key (Settings -> API)
QUO_API_KEY=op_xxx

# Optional base URL override (defaults to https://api.openphone.com/v1)
QUO_BASE_URL=https://api.openphone.com/v1
```

## Authentication

The Quo API **does not use a Bearer token**. The key goes directly in the header:

```
Authorization: <api-key>
```

This module sets `api_key_name = 'Authorization'` and stores the raw key, so `ApiKeyRequester.addAuthHeaders` produces exactly that.

## Usage

```javascript
const { Api } = require('@friggframework/api-module-quo');

const api = new Api({ api_key: process.env.QUO_API_KEY });

// List calls for a given Quo number + external participant
const calls = await api.listCalls({
    phoneNumberId: 'PN123abc',
    participants: ['+15555550123'],
    maxResults: 50,
});

// Enrich a single call
const call = await api.getCall('AC...');
const recordings = await api.getCallRecordings('AC...');   // GET /call-recordings/{id}
const transcript = await api.getCallTranscript('AC...');   // GET /call-transcripts/{id}
const summary = await api.getCallSummary('AC...');         // GET /call-summaries/{id}

// Messages
const messages = await api.listMessages({
    phoneNumberId: 'PN123abc',
    participants: ['+15555550123'],
});
```

## Endpoint reference

Base URL: `https://api.openphone.com/v1`

| Method | Path | Client method |
|---|---|---|
| GET | `/calls` | `listCalls(query)` |
| GET | `/calls/{id}` | `getCall(id)` |
| GET | `/call-recordings/{callId}` | `getCallRecordings(callId)` |
| GET | `/call-transcripts/{id}` | `getCallTranscript(callId)` |
| GET | `/call-summaries/{callId}` | `getCallSummary(callId)` |
| GET | `/messages` | `listMessages(query)` |
| GET | `/messages/{id}` | `getMessage(id)` |
| POST | `/messages` | `sendMessage(body)` |
| GET | `/contacts` | `listContacts(query)` |
| GET | `/phone-numbers` | `listPhoneNumbers(query)` |
| GET | `/users` | `listUsers(query)` |
| GET/POST/DELETE | `/webhooks*` | `listWebhooks` / `create*Webhook` / `deleteWebhook` |

**List parameters** (`listCalls` / `listMessages`): `phoneNumberId` (required, `^PN...`), `participants[]` (E.164; max 1 for calls, 10 for messages), `userId` (`^US...`), `maxResults` (1–100), `pageToken`, `createdAfter`, `createdBefore`.

### Phone-number matching (for CRM sync)

Quo/phone data keys on **phone number**, not email. Call objects carry `participants` (E.164) and `direction`; the external party's number is the participant that is not the workspace's own Quo number. Downstream integrations that resolve a CRM record should match on that phone number (e.g. Reevo's `retrieveAccountAndContact({ contact_phone_number })`, URL-encoding `+` as `%2B`).

## Doc sources

- Authentication: https://www.quo.com/docs/mdx/api-reference/authentication.md
- List calls: https://www.quo.com/docs/mdx/api-reference/calls/list-calls.md
- Call recordings / transcripts / summaries: `.../calls/get-recordings-for-a-call.md`, `.../calls/get-a-transcription-for-a-call.md`, `.../calls/get-a-summary-for-a-call.md`
- List messages: https://www.quo.com/docs/mdx/api-reference/messages/list-messages.md

## License

MIT
