# pipedrive

This is the API Module for pipedrive that allows the [Frigg](https://friggframework.org) code to talk to the pipedrive API.

Read more on the [Frigg documentation site](https://docs.friggframework.org/api-modules/list/pipedrive

## Webhook verification

Pipedrive does **not** sign webhook bodies; the only authentication is the optional HTTP Basic credentials set on the
webhook ([docs](https://pipedrive.readme.io/docs/guide-for-webhooks)). `Api#verifyWebhookSignature({ headers })`
checks the `Authorization: Basic ...` header against the configured pair in constant time. Never throws.

- Create the webhook with `http_auth_user` / `http_auth_password`, and use HTTPS.
- Credentials: `params.webhookUsername` / `params.webhookPassword`, or `PIPEDRIVE_WEBHOOK_USERNAME` /
  `PIPEDRIVE_WEBHOOK_PASSWORD`. With nothing configured it returns `false` (an unauthenticated webhook cannot be
  told from a forgery). There is no timestamp, so dedupe on `meta.id`.
