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

## Customers, payment intents, refunds, payouts

Thin wrappers over stripe-node (v16). The last argument of each is stripe-node's request `options`
(`{ idempotencyKey, stripeAccount }`).

| Method | Stripe call | Docs |
|---|---|---|
| `retrieveCustomer(id, params?, options?)` | `GET /v1/customers/:id` | https://docs.stripe.com/api/customers/retrieve |
| `listCustomers(params?, options?)` | `GET /v1/customers` (`created_gte` is sent as `created[gte]`) | https://docs.stripe.com/api/customers/list |
| `searchCustomers(query, params?, options?)` | `GET /v1/customers/search` (`limit`, `page` in `params`) | https://docs.stripe.com/api/customers/search |
| `createCustomer(params?, options?)` | `POST /v1/customers` | https://docs.stripe.com/api/customers/create |
| `updateCustomer(id, params?, options?)` | `POST /v1/customers/:id` | https://docs.stripe.com/api/customers/update |
| `retrievePaymentIntent(id, params?, options?)` | `GET /v1/payment_intents/:id` (`params.expand`, or pass an array) | https://docs.stripe.com/api/payment_intents/retrieve |
| `retrieveRefund(id, params?, options?)` | `GET /v1/refunds/:id` | https://docs.stripe.com/api/refunds/retrieve |
| `listPayouts(params?, options?)` | `GET /v1/payouts` (`arrivedAfter`/`arrivedBefore` become `arrival_date[gt]`/`[lt]`) | https://docs.stripe.com/api/payouts/list |

Search results are eventually consistent (Stripe docs); do not search for a customer you just created.
