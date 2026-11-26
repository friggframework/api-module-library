# Google Workspace (`@friggframework/api-module-google-workspace`)

Frigg v2 API module for [Google Drive API v3](https://developers.google.com/workspace/drive/api/reference/rest/v3) and [Google Calendar API v3](https://developers.google.com/workspace/calendar/api/v3/reference). `moduleName`: `google-workspace`.

Sibling packages `google-drive` and `google-calendar` already exist in this library; this module is the combined Workspace surface in the v2 (`Api` + `Definition`) shape. Prefer it when an integration needs both Drive and Calendar.

## Auth

OAuth 2.0 authorization code against Google Identity (`access_type=offline`, `prompt=consent` for a refresh token).

| Env | Purpose |
|---|---|
| `GOOGLE_WORKSPACE_CLIENT_ID` | Google Cloud OAuth client id |
| `GOOGLE_WORKSPACE_CLIENT_SECRET` | Client secret |
| `GOOGLE_WORKSPACE_SCOPE` | Space-separated scopes (defaults include Drive, Calendar, userinfo) |
| `GOOGLE_WORKSPACE_REDIRECT_URI` | Dedicated redirect URI (preferred) |
| `REDIRECT_URI` | Fallback base; module appends `/google-workspace` when dedicated URI unset |
| `GOOGLE_WORKSPACE_WEBHOOK_CHANNEL_TOKEN` | Optional channel token for push-notification verification |

Identity: `GET https://www.googleapis.com/oauth2/v2/userinfo` → `id` as entity/credential `externalId`.

## Covered surface

- Identity: `getUserDetails`
- Drive about / drives: `getAbout`, `listDrives`
- Files: `listFiles`, `getFile`, `createFile` (metadata), `updateFile`, `exportFile`
- Drive push: `getChangesStartPageToken`, `watchFile`, `watchChanges`, `stopDriveChannel`
- Calendars: `listCalendars`, `getCalendar`
- Events: `listEvents`, `getEvent`, `createEvent`, `updateEvent`
- Calendar push: `watchCalendarEvents`, `stopCalendarChannel`

Webhook receiver: `extensions/webhooks/` (verifies `X-Goog-Channel-Token`). Notifications do not include resource bodies — call `getFile` / changes / `listEvents` after receiving.

## Canonical mappings (ADR-057)

None. Drive files and Calendar events do not map cleanly onto `business@1` (Company/Contact/Deal), `support@1`, or `billing@1`.

## Develop

```bash
cd packages/v1-ready/google-workspace
npm install
npm test
```

## Sources

- Drive REST: https://developers.google.com/workspace/drive/api/reference/rest/v3
- Calendar REST: https://developers.google.com/workspace/calendar/api/v3/reference
- Drive discovery: https://www.googleapis.com/discovery/v1/apis/drive/v3/rest
- Calendar discovery: https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest
- OAuth: https://developers.google.com/identity/protocols/oauth2
- Drive push: https://developers.google.com/workspace/drive/api/guides/push
- Calendar push: https://developers.google.com/workspace/calendar/api/guides/push
- Workspace Add-ons: https://developers.google.com/workspace/add-ons/concepts/workspace-addons
