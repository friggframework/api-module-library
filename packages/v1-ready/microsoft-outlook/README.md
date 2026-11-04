# @friggframework/api-module-microsoft-outlook

Frigg v2 API module for **Microsoft Outlook** (mail + calendar) via [Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/overview).

## Auth

OAuth 2.0 authorization code against the [Microsoft identity platform](https://learn.microsoft.com/en-us/graph/auth-v2-user). Optional client-credentials for app-only flows.

Register an Entra ID app, set redirect URI to `{REDIRECT_URI}/microsoft-outlook`, and configure:

| Env | Purpose |
|---|---|
| `OUTLOOK_CLIENT_ID` | Application (client) ID |
| `OUTLOOK_CLIENT_SECRET` | Client secret |
| `OUTLOOK_SCOPE` | Space-separated delegated scopes (defaults in `.env.example`) |
| `OUTLOOK_TENANT_ID` | Tenant (`common` default) |
| `REDIRECT_URI` | Frigg redirect base |
| `OUTLOOK_WEBHOOK_CLIENT_STATE` | Expected Graph subscription `clientState` |

## Covered surface

- Identity: `getMe`, `getOrganization`
- Messages: list / get / create (draft) / update / delete / `sendMail`
- Mail folders: list / get
- Calendars: list / get
- Events: list / get / create / update / delete / `listCalendarView`
- Subscriptions: create / list / get / renew / delete + `verifyWebhookClientState`

See `microsoft-outlook.openapi.yaml` and `microsoft-outlook.capabilities.json`.

## Webhooks

`extensions/webhooks/` receives Graph change notifications (validationToken handshake + clientState verify + tenantId routing), shaped like HubSpot’s Tier-3 webhook extension.

## Test

```bash
cd packages/v1-ready/microsoft-outlook
npm install
npm test
```

## Sources

- [Mail API overview](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview)
- [Calendar API overview](https://learn.microsoft.com/en-us/graph/api/resources/calendar-api-overview)
- [Change notifications](https://learn.microsoft.com/en-us/graph/change-notifications-overview)
- [Official Graph OpenAPI](https://aka.ms/graph/v1.0/openapi.yaml)
