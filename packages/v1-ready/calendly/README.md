# @friggframework/api-module-calendly

Frigg API module for [Calendly](https://calendly.com) REST API v2.

## Auth

OAuth 2.0 authorization-code grant (web clients use HTTP Basic Auth on the
token endpoint). Register an OAuth app at
[developer.calendly.com](https://developer.calendly.com/).

Required environment variables:

- `CALENDLY_CLIENT_ID`
- `CALENDLY_CLIENT_SECRET`
- `CALENDLY_SCOPE` — space-separated scopes (e.g. `users:read event_types:read scheduled_events:read webhooks:read webhooks:write`)
- `REDIRECT_URI` — base redirect URI; the module appends `/calendly`
- `CALENDLY_WEBHOOK_SIGNING_KEY` — OAuth app webhook signing key (for the webhook extension)

## Sources

- API docs: https://developer.calendly.com/
- OpenAPI: https://developer.calendly.com/openapi/calendly-api.yaml
- OAuth OpenAPI: https://developer.calendly.com/openapi/calendly-oauth.yaml
- OAuth discovery: https://calendly.com/.well-known/oauth-authorization-server

## Covered surface

Current user, event types (list/get), scheduled events (list/get), invitees
(list/get), webhook subscriptions (list/get/create/delete).
