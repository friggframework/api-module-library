# Linear

This is the API Module for Linear that allows the [Frigg](https://friggframework.org) code to talk to the Linear API.

Read more on the [Frigg documentation site](https://docs.friggframework.org/api-modules/list/linear

## Webhook signature verification

`Api#verifyWebhookSignature({ headers, body, rawBody, now })` checks `Linear-Signature`
([docs](https://linear.app/developers/webhooks)): hex HMAC-SHA256 of the raw body keyed with the webhook signing
secret, and the body's `webhookTimestamp` (ms) must be within 60 s of now. Never throws.

- Secret: `params.webhookSecret` or `LINEAR_WEBHOOK_SECRET`.
- Pass `rawBody`.
