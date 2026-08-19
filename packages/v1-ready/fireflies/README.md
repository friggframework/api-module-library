# @friggframework/api-module-fireflies

Frigg API module for [Fireflies.ai](https://fireflies.ai) — the AI meeting notetaker.
Provides access to meeting transcripts, summaries, and attendee data for use in
Frigg integrations (e.g. matching a call's attendees to a CRM contact by email).

## API shape

Fireflies exposes a **single GraphQL endpoint**:

```
POST https://api.fireflies.ai/graphql
Authorization: Bearer <api key>
Content-Type: application/json

{ "query": "...", "variables": { ... } }
```

Docs: <https://docs.fireflies.ai/graphql-api/authorization>

## Authentication

This is an **API-key** module built on `ApiKeyRequester`. The key is a bearer
token. The module sets `api_key_name = 'Authorization'` and overrides
`addAuthHeaders()` to emit `Authorization: Bearer <key>` — so the stored
credential is the bare key (no `"Bearer "` prefix persisted to the database).

Get your key from **fireflies.ai → Integrations → Fireflies API**.

```env
FIREFLIES_API_KEY=your_fireflies_api_key_here
```

## Usage

```javascript
const { Api } = require('@friggframework/api-module-fireflies');

const api = new Api({ api_key: process.env.FIREFLIES_API_KEY });

// Confirm the key / identify the account
const user = await api.getUser();

// List recent transcripts (all args optional)
const transcripts = await api.listTranscripts({
    limit: 25,
    skip: 0,
    fromDate: '2026-01-01T00:00:00.000Z',
});

// Full transcript: attendees (with emails), summary, sentences
const transcript = await api.getTranscript(transcripts[0].id);

// Just the AI summary
const summary = await api.getTranscriptSummary(transcript.id);

// Keyword search
const hits = await api.searchTranscripts('pricing', { limit: 10 });
```

## Methods

| Method | GraphQL | Purpose |
|---|---|---|
| `getUser()` | `query { user { ... } }` | Authenticated account; used by the auth test |
| `listTranscripts(params)` | `transcripts(limit, skip, fromDate, toDate, organizer_email, participant_email, keyword, mine)` | Page through meetings, newest first |
| `getTranscript(id)` | `transcript(id)` | One meeting with `meeting_attendees` (email), `summary`, `sentences` |
| `getTranscriptSummary(id)` | `transcript(id) { summary }` | AI summary only |
| `searchTranscripts(keyword, params)` | `transcripts(keyword)` | Keyword search wrapper |
| `graphql(query, variables)` | — | Low-level transport; unwraps `data`, throws on `errors[]` |

### Attendee email fields

`meeting_attendees` carries `{ displayName, email, name, phoneNumber, location }`
per attendee; the top-level transcript also carries `organizer_email`,
`host_email`, and a `participants` (email) array. These are what an integration
uses to match a call to a CRM contact.

## Testing

```bash
npm install
npx jest
```

Tests are fully offline — a fake `fetch` is injected and the suite asserts the
GraphQL request body and the `Authorization: Bearer` header.

## License

MIT
