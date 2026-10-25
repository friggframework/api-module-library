# OAuth setup and credential lifecycle

Create or configure a HubSpot OAuth app, register its redirect URI, and enable the
scopes required for the methods you will call. The first-call example requires
`crm.objects.contacts.read`; property discovery, other CRM objects, CMS features,
and webhooks can require different scopes or account subscriptions. Consult the
[HubSpot OAuth guide](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/overview)
for the app generation you use.

Configure these values before importing the module:

| Variable | Used by the module |
|---|---|
| `HUBSPOT_CLIENT_ID` | OAuth client ID |
| `HUBSPOT_CLIENT_SECRET` | Code exchange, token introspection, and webhook signature verification |
| `HUBSPOT_SCOPE` | Space-separated scopes included in the authorization URL |
| `REDIRECT_URI` | Base callback URI; `Definition` appends `/hubspot` |

Register the complete callback URI, including `/hubspot`, in HubSpot. Avoid a
trailing slash on `REDIRECT_URI` that would create a double slash. The definition
reads environment values at module load time. The `Api` constructor can instead
receive `client_id`, `client_secret`, `scope`, `redirect_uri`, `state`,
`access_token`, and `refresh_token` through the Frigg OAuth2Requester.

`getAuthUri()` returns the constructed authorization URL. The application must
generate, persist and verify OAuth state and route the callback; this method does
not implement that callback. The definition exchanges the returned code through
the inherited `getTokenFromCode()` and persists `access_token` and `refresh_token`
on the credential.

This source sets the token endpoint to `/oauth/2026-03/token` and introspects tokens
through `/oauth/2026-03/token/introspect`. `getUserDetails()` combines
`/integrations/v1/me` with token introspection and therefore requires client
credentials as well as the token. It is not the minimal read-only first-call path.
See the [HubSpot OAuth endpoint migration](https://developers.hubspot.com/changelog/v1-oauth-api-deprecation)
for provider changes.

Refresh behavior is inherited from the installed Frigg OAuth2Requester. Use Frigg's
managed credential flow to persist refreshed credentials rather than discarding
them in an ephemeral `Api` instance. The module declares Frigg `{{FRIGG_RANGE}}`;
it does not independently promise a concurrency strategy or refresh schedule.
Reauthorize revoked or inactive grants and keep credentials out of URLs, logs,
fixtures and source control. `introspectToken()` rejects when HubSpot returns an
inactive token.
