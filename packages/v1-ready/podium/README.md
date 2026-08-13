# Podium API Module

A Frigg API module for the [Podium v4 API](https://docs.podium.com/docs/getting-started) —
contacts, outbound SMS/email, review invitations, locations, and message
webhooks.

## Install

```bash
npm install @friggframework/api-module-podium
```

## Read this before using it: what is verified and what is not

Podium's API **reference** pages sit behind a `developer.podium.com` login and
return 404 to anonymous requests. So this module distinguishes two tiers, and the
distinction is recorded in `api.js` next to the paths themselves.

**Verified** — taken from Podium's own published sample apps
([podium-api-sample-messages](https://github.com/podium/podium-api-sample-messages),
[podium-api-sample-contacts](https://github.com/podium/podium-api-sample-contacts)),
which are executable evidence:

- Base URL `https://api.podium.com/v4`
- `POST /messages` with body `{ channel: { identifier, type }, body, locationUid }`
- `GET /contacts`, `POST /contacts`
- Token endpoint `https://accounts.podium.com/oauth/token`, taking a **JSON**
  body — not the form encoding almost every other OAuth2 server wants, and not
  what `@friggframework/core`'s `OAuth2Requester` sends by default

**Inferred** — from the endpoint slugs Podium's changelog links to
(`contactget`, `contactupdate`, `contactdelete`, `messagesend`,
`review_invitecreate`). `review_invite` → `/review_invites` follows the same
singular-slug-to-plural-path rule as `contact` → `/contacts`, but it has not
been confirmed:

- `PUT /contacts/{uid}`, `DELETE /contacts/{uid}`
- `POST /review_invites`
- `GET /reviews`, `GET /locations`, `/webhooks`

Every path is overridable so a correction ships as config, not a release:

```js
const api = new Api({ ...creds, paths: { reviewInvites: '/review_invitations' } });
```

or via `PODIUM_BASE_URL` / `PODIUM_TOKEN_URI` / `PODIUM_AUTHORIZATION_URI`.

**Confirm the inferred paths against the reference as soon as the developer
account is approved.** There is also a documented conflict on the token host:
Podium's getting-started page gives `https://api.podium.com/oauth/token`, its
working sample code uses `https://accounts.podium.com/oauth/token`. The sample
is the default here because it is code that runs.

## Getting access

Podium developer access is an **application, not a signup** — apply at
developer.podium.com and expect a few days for review. Scope names are not
published publicly; take them from your app's own configuration in the portal and
set `PODIUM_SCOPE` (space-separated).

## Authorization

Standard OAuth2 authorization code flow.

```bash
PODIUM_CLIENT_ID=...
PODIUM_CLIENT_SECRET=...
PODIUM_SCOPE="read_contacts write_contacts write_messages"
REDIRECT_URI=https://your-app.example.com/redirect
```

Podium requires HTTPS for redirect targets, including in local development.

On authorization the entity caches the organization's location list, because
**every** message send and review invitation must name a `locationUid` and a
Podium organization can hold many.

## Usage

```js
const { Api } = require('@friggframework/api-module-podium');

await api.sendMessage({
    identifier: '8001119232',
    channelType: 'phone',            // or 'email'
    body: 'Your appointment is today between 2pm and 4pm.',
    locationUid: 'b405e23a-2d8e-5000-909c-d1759dd40000',
});

// Review invitations are two steps by design: mint the link, then deliver it.
// That is what lets a review request reuse the customer's existing thread.
const invite = await api.createReviewInvite({ contactUid, locationUid });
await api.sendMessage({ identifier, body: `Mind leaving a review? ${invite.url}`, locationUid });
```

## Webhooks

Podium delivers `message.sent`, `message.received` and `message.failed` events.
Per Podium's docs the partner webhook URL is configured **by Podium**, not
self-serve, so `createWebhook()` may 404 for a given app.

**Podium publishes no webhook signing scheme.** Rather than ship an HMAC verifier
that would look like security while verifying nothing, this module protects the
inbound endpoint with a high-entropy token in the URL path — a real control, and
the standard fallback for providers without signing:

```js
const { generatePathToken, verifyPathToken, normalizeMessageEvent } = require('@friggframework/api-module-podium');

const token = generatePathToken();      // 256 bits; store with the integration
// POST /webhooks/podium/:integrationId/:pathToken
if (!verifyPathToken(req.params.pathToken, storedToken)) return res.sendStatus(401);
const message = normalizeMessageEvent(req.body);
```

Replace this with signature verification if and when Podium documents one.

`normalizeMessageEvent` reads identity from the `channel` and conversation
fields and **not** from the payload's `contact` and `sender` objects, which
Podium's own docs mark as deprecated and slated for removal. It also labels
`direction` — needed because a `message.failed` event is neither side of the
conversation, and an outbound event is usually an echo of something the
integration itself just sent.

## Tests

```bash
npm test
```

34 tests, no network. A recording fetch double is injected and the tests assert
on the **request**, so the exact `sendMessage` payload shape, the JSON token
body, and the omission of undefined query keys are all pinned.

Six mutations were run and all six are caught, including flattening the message
`channel` object, posting the token request form-encoded, and letting a path
override wipe the remaining defaults.

One of those mutations initially survived: the "omits absent lookup keys" test
used `toEqual`, which treats an `undefined`-valued key as absent, so it passed
against exactly the bug it guarded. It now uses `toStrictEqual` and asserts
`Object.keys()`. Worth remembering — `Requester._request` iterates the query with
`for...in`, so a present-but-undefined key is serialized as the literal string
`"undefined"`.
