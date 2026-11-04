# @friggframework/api-module-pagerduty

A Frigg API module for [PagerDuty](https://www.pagerduty.com/) — incident
management, on-call, and alerting. This module lets a Frigg integration connect
via OAuth 2.0 and call PagerDuty's REST API for users, incidents, services, and
V3 webhook subscriptions.

## Features

- OAuth 2.0 authorization-code flow (form-urlencoded token exchange + refresh)
- `Accept: application/vnd.pagerduty+json;version=2` on every REST request
- Current user identity (`GET /users/me`) plus account claims from `id_token`
- Users (list/get/create/update)
- Incidents (list/get/create/update)
- Services (list/get/create/update)
- Webhook subscription management + Tier-3 receiver extension
- Capability manifest (`pagerduty.capabilities.json`)

## Sources

- REST overview: https://developer.pagerduty.com/docs/rest-api-overview
- OAuth: https://developer.pagerduty.com/docs/oauth-functionality
- Official OpenAPI (canonical): https://raw.githubusercontent.com/PagerDuty/api-schema/main/reference/REST/openapiv3.json
- OpenAPI repo: https://github.com/PagerDuty/api-schema
- Webhook signature verify: https://developer.pagerduty.com/docs/verifying-signatures

## Installation

```bash
npm install @friggframework/api-module-pagerduty
```

## Authentication

PagerDuty Apps use OAuth 2.0. Register an app under **Integrations → App
Registration**, add OAuth functionality (Classic User OAuth or Scoped OAuth),
and configure the redirect URL.

Classic User OAuth scopes are `read` or `write` (case-sensitive). Scoped OAuth
uses resource scopes such as `incidents.read` / `services.write` and requires
PKCE — this module's default flow is Classic User OAuth confidential-client
(no PKCE), which matches Frigg's `OAuth2Requester`.

### Environment variables

```env
PAGERDUTY_CLIENT_ID=
PAGERDUTY_CLIENT_SECRET=
PAGERDUTY_SCOPE=write
REDIRECT_URI=https://your-app.example/redirect
```

The module's redirect URI is `${REDIRECT_URI}/pagerduty`.

## Tests

```bash
cd packages/v1-ready/pagerduty && npm test
```
