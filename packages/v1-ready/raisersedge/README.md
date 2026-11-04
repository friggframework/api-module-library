# `@friggframework/api-module-raisersedge`

Blackbaud **Raiser's Edge NXT** API module for the Frigg Framework. Talks to the
[SKY API](https://developer.blackbaud.com/skyapi) over OAuth 2.0 (authorization
code) for constituents, gifts, events, fundraising (funds/appeals), and webhook
subscriptions.

## Auth

| Detail | Value |
| --- | --- |
| Method | OAuth 2.0 authorization code |
| Authorize | `https://oauth2.sky.blackbaud.com/authorization` |
| Token | `https://oauth2.sky.blackbaud.com/token` |
| API base | `https://api.sky.blackbaud.com` |
| Headers | `Authorization: Bearer …`, `Bb-Api-Subscription-Key` |
| Redirect | `RAISERSEDGE_REDIRECT_URI` |
| Env | `BLACKBAUD_CONSUMER_KEY`, `BLACKBAUD_CONSUMER_SECRET`, `BLACKBAUD_SCOPE`, `BLACKBAUD_SUBSCRIPTION_KEY` |

Token exchange omits `scope`. Refresh maps `refresh_token_expires_in` →
`refreshTokenExpire` and persists `environment_id` from the token response.

## Develop

```bash
cp .env.example .env
npm install
npm test
```

## Docs

- SKY API overview: https://developer.blackbaud.com/skyapi
- Raiser's Edge NXT: https://developer.blackbaud.com/skyapi/products/renxt
- Authorization: https://developer.blackbaud.com/skyapi/docs/authorization
- Webhooks: https://developer.blackbaud.com/skyapi/docs/webhooks
- SKY Add-ins: https://developer.blackbaud.com/skyapi/docs/addins/overview
