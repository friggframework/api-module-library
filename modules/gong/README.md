# @friggframework/api-module-gong

A Frigg API module for [Gong](https://www.gong.io) — the Revenue Intelligence
platform that records, transcribes, and analyzes customer-facing conversations.
This module lets a Frigg integration list and retrieve calls, pull detailed call
data (including attendee emails), fetch transcripts, and list users.

## Features

- HTTP Basic authentication (Access Key + Access Key Secret)
- List calls by date range and retrieve a single call
- Detailed call data via `POST /v2/calls/extensive`, exposing `parties[].emailAddress`
  (the field used to match a conversation attendee to a CRM contact)
- Call transcripts via `POST /v2/calls/transcript`
- List/retrieve users
- Company-specific base URL support

## Installation

```bash
npm install @friggframework/api-module-gong
```

## Authentication

Gong uses HTTP Basic auth. Credentials are combined as
`Base64(accessKey:accessKeySecret)` and sent in the
`Authorization: Basic <token>` header. Create an Access Key + Secret under
**Company Settings → API** in Gong (you must be a technical administrator).

The module accepts the Gong-native names `access_key` and `access_key_secret`
and maps them onto the framework's Basic auth `username`/`password`.

### Environment variables

```env
GONG_ACCESS_KEY=your_gong_access_key
GONG_ACCESS_KEY_SECRET=your_gong_access_key_secret
# Optional; defaults to https://api.gong.io/v2
GONG_BASE_URL=https://us-55616.api.gong.io
```

Your company-specific base URL is shown at
`https://app.gong.io/company/api-authentication`.

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-gong');

const api = new Api({
    access_key: process.env.GONG_ACCESS_KEY,
    access_key_secret: process.env.GONG_ACCESS_KEY_SECRET,
    base_url: process.env.GONG_BASE_URL, // optional
});

// List calls in a date range
const calls = await api.listCalls({
    fromDateTime: '2026-08-01T00:00:00Z',
    toDateTime: '2026-08-19T00:00:00Z',
});

// Detailed call data with attendee emails
const detailed = await api.listCallsExtensive({
    filter: { callIds: ['7782342274025502988'] },
    contentSelector: { exposedFields: { parties: true } },
});
// → detailed.calls[0].parties[].emailAddress

// Transcripts
const transcripts = await api.getTranscripts({
    filter: { callIds: ['7782342274025502988'] },
});
```

## API reference (endpoints)

| Method | Path | Client method |
|--------|------|---------------|
| GET | `/v2/calls` | `listCalls(params)` |
| GET | `/v2/calls/{id}` | `getCall(callId)` |
| POST | `/v2/calls/extensive` | `listCallsExtensive(body)` |
| POST | `/v2/calls/transcript` | `getTranscripts(body)` |
| GET | `/v2/users` | `listUsers(params)` |
| GET | `/v2/users/{id}` | `getUser(userId)` |

The machine-readable contract is in [`gong.openapi.yaml`](./gong.openapi.yaml),
kept in sync with `api.js` by `tests/spec-sync.test.js`.

## Notes

- **Rate limits:** 3 requests/second and 10,000 requests/day by default. On
  `429`, respect the `Retry-After` header.
- **API access tier:** Gong's public API requires an API-enabled Gong package;
  Access Keys are created by a technical administrator. If your workspace does
  not have API access, contact Gong to enable it. This module is built to the
  public documentation regardless.
- **Attendee emails:** only `POST /v2/calls/extensive` returns `parties[]` with
  `emailAddress`. The plain `GET /v2/calls` list does not include party emails.
  Transcripts reference speakers by `speakerId`, which you resolve to an email
  via the `parties` returned from the extensive endpoint.

Docs: https://help.gong.io/apidocs/introduction-2

## License

MIT
