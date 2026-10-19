# Asana

This is the API Module for Asana that allows the [Frigg](https://friggframework.org) code to talk to the Asana API.

Read more on the [Frigg documentation website](https://docs.friggframework.org/api-modules/list/asana) (soon to come)

## Webhook signature verification

`Api#verifyWebhookSignature({ headers, body, rawBody })` checks `X-Hook-Signature`
([docs](https://developers.asana.com/docs/webhooks-guide)): hex HMAC-SHA256 of the raw body, keyed with the
`X-Hook-Secret` Asana sends during the webhook handshake. Heartbeats are signed too. Returns `true` only for a
genuine delivery; never throws.

- Secret: `params.webhookSecret` (the handshake secret of **this** webhook, so persist it per installation) or
  `ASANA_WEBHOOK_SECRET`.
- Asana defines no timestamp, so there is no replay window; dedupe on the event.
- The guide does not state the digest encoding; hex matches Asana's reference servers.
