# Frigg API Module Slack

A quick description of Slack.

Expected environment variables

```
SLACK_CLIENT_ID="Slack app client ID"
SLACK_CLIENT_SECRET="Slack app client secret"
SLACK_SCOPE="Slack bot scopes, comma separated"
SLACK_USER_SCOPE="Slack user scopes, comma separated"
```

## Webhook signature verification

`Api#verifyWebhookSignature({ headers, body, rawBody, now })` implements Slack's signing-secret check
([docs](https://docs.slack.dev/authentication/verifying-requests-from-slack)): `v0=` + hex HMAC-SHA256 of
`v0:{X-Slack-Request-Timestamp}:{raw body}`, rejecting requests more than 5 minutes from now. Returns `true` only
for a genuine request; never throws.

- Secret: `params.webhookSecret` or `SLACK_SIGNING_SECRET` (the app's Signing Secret, not the client secret).
- Pass `rawBody`; interactivity payloads are form-encoded and must be hashed as received.

## Listing users

`Api#listUsers(query = {})` calls `GET /users.list` ([docs](https://docs.slack.dev/reference/methods/users.list); needs
`users:read`, plus `users:read.email` to see emails). `query` takes `limit`, `cursor` (pass
`response_metadata.next_cursor` from the previous page until it is empty), `include_locale` and `team_id` (org tokens).
