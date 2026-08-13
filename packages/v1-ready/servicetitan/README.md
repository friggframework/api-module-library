# ServiceTitan API Module

A Frigg API module for the [ServiceTitan v2 API](https://developer.servicetitan.io/docs/overview/).

Covers the surface a customer-messaging integration needs: CRM (customers,
contacts, locations, leads, bookings), JPM (jobs, appointments, notes), Dispatch
(appointment assignments), Accounting (invoices, payments), and Settings
(technicians, business units) — plus V2 webhook signature verification.

## Install

```bash
npm install @friggframework/api-module-servicetitan
```

## Authorization

ServiceTitan uses the OAuth2 **client_credentials** grant, so there is no
redirect flow. A tenant admin supplies four values:

| Field | Where it comes from |
|---|---|
| `tenant_id` | ServiceTitan → Settings → Integrations → API Application Access |
| `app_key` | Generated with your app in the Developer Portal. Sent as `ST-App-Key`. |
| `client_id` | Shown after an admin connects your app under API Application Access |
| `client_secret` | Shown **once** when the app is connected. Regenerate if lost. |
| `environment` | `production` (default) or `integration` |

Credentials are **not** interchangeable between the production and integration
stacks, so `environment` is part of the stored credential and is included in the
entity's `externalId` to stop a sandbox and a production tenant with the same
ID from colliding.

Because there is no redirect, `getAuthorizationRequirements()` returns the
`authFields.js` JSON Schema for the host app to render, and `setAuthParams()`
takes the submitted values.

The quickest way to check a real tenant's credentials is the CLI, which renders
the form and then exercises every `requiredAuthMethods` entry:

```bash
frigg auth test .          # from this package directory
```

Note that `Auther` is **not** exported from `@friggframework/core` on the 2.0
line — module instantiation goes through `ModuleFactory` / `loadInstalledModules`
now, and the CLI above is the supported way to drive an auth flow by hand.

## Path structure

Every v2 resource is tenant-scoped and includes a **literal `tenant` segment**:

```
https://api.servicetitan.io/{module}/v2/tenant/{tenantId}/{resource}
```

Several third-party guides publish `/{module}/v2/{tenantId}/...` without it.
That is wrong and produces 404s. The tests assert the segment is present for
every module namespace precisely because it is the easiest thing to get wrong.

## Two overrides of the base `OAuth2Requester`

This module targets **`@friggframework/core@^2.0.0-next`**. Core's
`OAuth2Requester` is written for the authorization_code grant, and two things in
it are still wrong for client_credentials. Both fail quietly rather than loudly:

1. **`getTokenFromClientCredentials()` posts a JSON body.** ServiceTitan's
   `/connect/token` requires `application/x-www-form-urlencoded`.
2. **`isAuthenticated()` requires `refresh_token` and `refreshTokenExpire`.**
   Neither exists in the client_credentials flow, so it always returns `false`
   and no token is ever treated as valid.

`refreshAuth()` is deliberately **not** overridden. Core 2.0 branches on
`this.grant_type` correctly, so it routes to the overridden
`getTokenFromClientCredentials()` above, and core's own implementation adds
failure logging plus the `DLGT_INVALID_AUTH` notification that a local override
would throw away. The module declares `grant_type = 'client_credentials'` in its
constructor for that routing to work, and two tests pin it — dropping the
declaration fails both.

*(On core 1.x this method read `this.grantType`, which the constructor never
assigned, so it always took the refresh-token path and broke this flow. That is
fixed on the 2.0 line. `isAuthenticated()` on 1.x was worse still: it read
`this.accessToken`/`this.refreshToken`, neither ever assigned.)*

The module also acquires tokens **proactively** in `addAuthHeaders()` rather than
relying on core's 401-then-retry path, because that path only ever refreshes once
per API instance (`refreshCount > 0` → give up) while ServiceTitan tokens expire
every 15 minutes. Tokens are cached to the credential and reused for their full
life, with a 60-second safety buffer.

### One temporary devDependency

`@aws-sdk/client-scheduler` is listed as a devDependency purely so `npm test`
works. `@friggframework/core@2.0.0-next.107` requires it eagerly through
`index.js` (via `application/index.js` → `scheduler-commands.js` →
`infrastructure/scheduler/`) without declaring it, so
`require('@friggframework/core')` throws `Cannot find module` on any clean
install. It resolves inside the frigg monorepo only because
`packages/admin-scripts` declares it and npm hoists it. Fixed on the frigg side
by adding it to core's dependencies; drop this devDependency once a core release
carrying that fix is published.

## Rate limits

60 requests/second per application per tenant for regular APIs; reporting APIs
are limited to a small number of identical reports per minute. Generous enough
that `getAll*()` pagination over a full customer list is fine.

## Webhooks

V2 webhooks are self-serve: subscribe per-app in the Developer Portal
(Create and Manage Applications → Edit → Add Webhook Events). Deliveries are
signed HMAC-SHA256 in the `x-servicetitan-signature` header, and ServiceTitan
retries a non-2xx at 10s, 30s, 60s and 300s. V1 webhooks were deprecated
2026-03-31.

```js
const { verifySignature, getSignatureFromHeaders } = require('@friggframework/api-module-servicetitan');

app.post('/webhook', express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }), (req, res) => {
    const ok = verifySignature({
        rawBody: req.rawBody,                        // MUST be the raw bytes
        signature: getSignatureFromHeaders(req.headers),
        secret: process.env.SERVICETITAN_WEBHOOK_SECRET,
    });
    if (!ok) return res.sendStatus(401);
    res.sendStatus(202);                             // answer before doing work
});
```

**The raw body is not optional.** `JSON.stringify(req.body)` is not
byte-identical to what was signed — key order, whitespace and unicode escaping
all differ — so verification fails for every delivery and looks exactly like a
misconfigured secret. `verifySignature` accepts both hex and base64 signature
encodings, and compares via fixed-width digests so a wrong-length signature
returns `false` instead of throwing out of `crypto.timingSafeEqual`.

Answering 2xx before doing the work matters too: a slow handler turns into
duplicate deliveries via the retry schedule.

## Pagination

List responses are `{ page, pageSize, hasMore, totalCount, data }`.
`getAllCustomers` / `getAllJobs` / `getAllAppointments` / `getAllLocations` walk
every page. Pass `modifiedOnOrAfter` for delta passes:

```js
const changed = await api.getAllCustomers({ modifiedOnOrAfter: since.toISOString() });
```

## Tests

```bash
npm test
```

45 tests, no network and no database — a recording fetch double is injected and
the tests assert on the **request** (URL, method, headers, body), not on a canned
response. A mock that only returns the shape the code wants cannot catch a wrong
tenant path, a missing `ST-App-Key`, or a JSON body sent where form encoding is
required.

Six mutations were run against the suite and all six are caught: dropping the
`tenant/` segment (12 failures), omitting `ST-App-Key` (1), sending the token
request as JSON (5), removing the `isAuthenticated` override (3), dropping the
`grant_type` declaration (2), and making webhook verification always pass (1).

The `refreshAuth` coverage exists because of a gap this found. Removing the
module's old `refreshAuth` override left the suite fully green — not because core
2.0's version works (it does), but because **nothing tested it**. The two tests
added there now assert the grant in the token request body, not just the URL and
content type, since the inherited refresh-token path posts form-encoded to the
same URL and would otherwise satisfy a weaker assertion.
