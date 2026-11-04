# @friggframework/api-module-adp

Frigg v2 API module for **ADP Workforce Now** (Worker Management + Event Notifications).

## Auth

OAuth 2.0 **client credentials** with **mutual TLS**:

1. `POST https://accounts.adp.com/auth/oauth/v2/token` with HTTP Basic (`client_id`:`client_secret`) and `grant_type=client_credentials`
2. Present the ADP-issued X.509 client certificate on token and API calls
3. Call `https://api.adp.com/...` with `Authorization: Bearer <access_token>`

Credentials and certificate PEMs are collected via `getAuthorizationRequirements` / `setAuthParams` (UI type `apiKey` because there is no browser redirect).

## Docs

- [ADP Developer Resources](https://developers.adp.com/)
- [Worker Management API Guide for ADP Workforce Now](https://marketplace-cdn.adp.com/dev-portal/pdf/protected/Worker_Management_API_Guide_for_ADP_Workforce_Now)
- [Data Connector authorization](https://marketplace-cdn.adp.com/dev-portal/pdf/Understanding_the_Data_Connector_App_Authorization_Process)
- [Event notifications](https://marketplace-cdn.adp.com/dev-portal/pdf/ADP_Marketplace_ESI_-_Event_notifications)

## Develop

```bash
cd packages/v1-ready/adp
npm install
npm test
```

Sandbox credentials are not bundled. Set `ADP_CLIENT_ID`, `ADP_CLIENT_SECRET`, `ADP_SSL_CERT`, `ADP_SSL_KEY` (and optional `ADP_SSL_PASSPHRASE`) for live `frigg auth test`.
