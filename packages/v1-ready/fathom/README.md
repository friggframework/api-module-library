# Fathom API Module (`@friggframework/api-module-fathom`)

A [Frigg](https://friggframework.org) API module for [Fathom](https://fathom.video)
— the AI meeting recorder. It wraps Fathom's public REST API so a Frigg
integration can list meetings/recordings, pull transcripts and summaries, read
team members, and register webhooks.

Integrations consume it the standard Frigg way:

```javascript
const meetings = await this.fathom.api.listMeetings({ include_summary: true });
const { transcript } = await this.fathom.api.getTranscript(recordingId);
```

## Authentication

Fathom uses **API-key** authentication. Generate a key in Fathom under
**User Settings → API Access**, and the module sends it on every request as the
`X-Api-Key` header:

```bash
curl https://api.fathom.ai/external/v1/meetings -H "X-Api-Key: YOUR_API_KEY"
```

- **Base URL:** `https://api.fathom.ai/external/v1`
- **Rate limit:** 60 requests/minute across all of an account's API keys.

Set `FATHOM_API_KEY` in your environment (see `.env.example`). The module also
exposes a JSON-Schema authorization form (`getAuthorizationRequirements`) so the
key can be collected through the Frigg auth UI / `frigg auth` CLI.

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `listMeetings(params)` | `GET /meetings` | List meetings/recordings (paginated via `next_cursor`). |
| `listAllMeetings(params, opts)` | — | Convenience: follows `next_cursor` and returns a flat array. |
| `getTranscript(recordingId, params)` | `GET /recordings/{id}/transcript` | Transcript segments (or async POST to `destination_url`). |
| `getSummary(recordingId, params)` | `GET /recordings/{id}/summary` | Markdown-formatted call summary. |
| `listTeamMembers(params)` | `GET /team_members` | People on the Fathom account (optional `cursor`, `team`). |
| `createWebhook(data)` | `POST /webhooks` | Register a webhook for new meeting content. |

### `listMeetings` parameters (all optional)

`cursor`, `created_after`, `created_before`, `meeting_type`,
`include_transcript`, `include_summary`, `include_action_items`,
`include_highlights`, `include_crm_matches`, `calendar_invitees_domains_type`,
and the array filters `recorded_by[]` (emails), `teams[]`,
`calendar_invitees_domains[]`. Array values are serialized with the `key[]`
repeated-key convention.

### Meeting shape (fields used by consumers)

```jsonc
{
  "recording_id": 12345,
  "title": "Acme <> Left Hook",
  "meeting_title": "Discovery call",
  "meeting_type": "external",
  "url": "https://fathom.video/calls/12345",
  "share_url": "https://fathom.video/share/...",
  "created_at": "2026-08-11T18:00:00Z",
  "scheduled_start_time": "2026-08-11T18:00:00Z",
  "scheduled_end_time": "2026-08-11T18:30:00Z",
  "recording_start_time": "2026-08-11T18:01:00Z",
  "recording_end_time": "2026-08-11T18:29:00Z",
  "calendar_invitees": [
    { "name": "Jane Buyer", "email": "jane@acme.com",
      "email_domain": "acme.com", "is_external": true,
      "matched_speaker_display_name": "Jane" }
  ],
  "recorded_by": { "name": "Sean", "email": "sean@lefthook.co",
                   "email_domain": "lefthook.co", "team": "Left Hook" }
}
```

Attendee emails live on `calendar_invitees[].email` (with `is_external` and
`email_domain`), which is what you match against a CRM/Reevo contact. The
recorder is `recorded_by.email`.

### Transcript shape

```jsonc
{
  "transcript": [
    { "speaker": { "display_name": "Jane",
                   "matched_calendar_invitee_email": "jane@acme.com" },
      "text": "...", "timestamp": "00:01:12" }
  ]
}
```

### Summary shape

```jsonc
{ "summary": { "template_name": "General", "markdown_formatted": "## ..." } }
```

## Webhooks (this integration is webhook-driven)

Create a webhook with `createWebhook`:

```javascript
await this.fathom.api.createWebhook({
    destination_url: 'https://your-frigg-app/webhooks/fathom',
    triggered_for: ['my_recordings', 'shared_external_recordings'],
    include_summary: true,
    include_transcript: true,
    include_action_items: true,
});
```

- `triggered_for` (required, ≥1): `my_recordings`,
  `shared_external_recordings`, `my_shared_with_team_recordings`,
  `shared_team_recordings`.
- At least one of `include_transcript`, `include_summary`,
  `include_action_items`, `include_crm_matches` must be `true`.
- The response includes a `secret` (`whsec_...`) used to verify delivery
  signatures.

**Event:** `new-meeting-content-ready` — delivered after a meeting is processed.
The payload carries the same meeting fields listed above (recording id, titles,
timestamps, `share_url`, `calendar_invitees[]`, `recorded_by`) plus the opted-in
`summary` / `transcript` / `action_items`.

**Signature verification:** each delivery carries `webhook-id`,
`webhook-timestamp`, and `webhook-signature` headers. Verify by HMAC-SHA256 over
`{id}.{timestamp}.{rawBody}` using the base64-decoded portion of the webhook
secret after the `whsec_` prefix, comparing in constant time within a 5-minute
timestamp tolerance (Svix-style signing).

## Documented-endpoint notes

The public REST API documents **list** meetings only (no single-meeting `GET`
by id) — fetch a specific recording's content via the transcript/summary
endpoints keyed on `recording_id`. There is **no `/me` identity endpoint**, so
the module derives account identity from the first meeting's `recorded_by`,
falling back to a stable label. `list-webhooks` / `delete-webhook` are not
documented at the time of writing, so only `createWebhook` is modeled.

## Testing

```bash
npm install
npm test
```

Tests are fully offline — HTTP methods are stubbed and assertions are made on the
request options the module builds. No API key or network access is required.

## Sources

- Fathom Developer Hub — https://developers.fathom.ai/
- List meetings — https://developers.fathom.ai/api-reference/meetings/list-meetings
- Get transcript — https://developers.fathom.ai/api-reference/recordings/get-transcript
- Get summary — https://developers.fathom.ai/api-reference/recordings/get-summary
- List team members — https://developers.fathom.ai/api-reference/team-members/list-team-members
- Create a webhook — https://developers.fathom.ai/api-reference/webhooks/create-a-webhook
- Webhooks overview — https://developers.fathom.ai/webhooks

## License

MIT — see [LICENSE.md](./LICENSE.md).
