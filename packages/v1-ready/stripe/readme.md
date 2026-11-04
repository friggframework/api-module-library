# Stripe

This is the API Module for Stripe that allows the [Frigg](https://friggframework.org) code to talk to the Stripe API.

Read more on the [Frigg documentation site](https://docs.friggframework.org/api-modules/list/stripe) (soon to come)

## Webhook signature verification

`Api#verifyWebhookSignature({ headers, body, rawBody, now, tolerance })` checks `Stripe-Signature`
([docs](https://docs.stripe.com/webhooks#verify-manually)): header `t=<ts>,v1=<sig>`, hex HMAC-SHA256 of
`${t}.${raw body}` keyed with the endpoint's `whsec_` secret; any matching `v1` passes (secret rolling), `v0` is
ignored, default tolerance 300 s (`tolerance: 0` means "use the default", never "no check"). Never throws.

- Secret: `params.webhookSecret` (a string or an array of secrets) or `STRIPE_WEBHOOK_SECRET`. This is the webhook
  endpoint secret, not the API key.
- Pass `rawBody`.
