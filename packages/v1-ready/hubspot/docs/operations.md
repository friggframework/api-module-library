# Operating behavior and limitations

## Pagination, rate limits and errors

The wrapper generally returns one provider response per call. For contacts, pass
`limit`, `properties`, and then the previous page's `paging.next.after` to
`listContacts()`. The first page omits an empty cursor. Passing `properties`
avoids an extra property-discovery request. `listDeals()` merges the supplied
page object into its query and fetches all deal properties before the page request.
Some methods accept query strings rather than objects; use the exact signature in
the [reference](reference.md). There is no universal auto-pagination helper.

This module defines no provider-specific rate-limit policy. The installed Frigg
Requester handles HTTP transport and any generic retries. Apply bounded retries
and provider-aware pacing in the application, especially around writes and batch
calls. Do not infer newer Frigg behavior from this package's declared dependency
range. HubSpot scope, product entitlement, quota and transport errors can reject
calls. Returned shapes and empty-body behavior vary by method; see the reference
and [HubSpot API usage guidance](https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines).

## Webhook extension

The package exports `extensions.webhooks`, a reusable integration extension with
a DB-free receiver and queued portal-to-integration resolution. Bind it using
the Frigg extension contract:

```javascript
extensions: {
    hubspotWebhooks: {
        extension: hubspot.extensions.webhooks,
        handlers: {HUBSPOT_WEBHOOK: 'onHubSpotEvent'},
    },
}
```

The consuming integration must provide `createFriggCommands({integrationClass})`
as its `commands`, a queue worker, a HubSpot module binding and an idempotent
`onHubSpotEvent({data})` handler. The complete source-package README includes the
integration class example. This fragment is a binding, not a standalone app.

Register the app-level target URL in HubSpot, including the integration name and
binding key: `POST /api/<integration-name>-integration/hubspotWebhooks/webhooks`.
Set `HUBSPOT_CLIENT_SECRET` on the receiver. The shipped verifier requires the v3
signature and timestamp headers, computes HMAC-SHA256 over method, reconstructed
URI, raw body and timestamp, compares the base64 signature, and allows at most
five minutes of timestamp skew in either direction. Preserve the raw request
body and correct public URI through the HTTP adapter. Do not disable validation
to accommodate a proxy mismatch. See
[HubSpot request validation](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/request-validation).

`HUBSPOT_WEBHOOK_RECEIVED` verifies the request and queues resolution per event.
The worker resolves `portalId` to the owning integration and queues
`HUBSPOT_WEBHOOK` with that integration's credentials. Missing portals or unmatched
integrations are skipped; ambiguous integration resolution throws. Delivery may
repeat: deduplicate business operations using event identifiers or a stable
composite key. This package ships no separate provider-side project artifact.

## Known source limitations

The pilot records the actual wrapper rather than promising every exported method
is production-ready. In this source, `updateDeal()` references a URL key that is
not defined, `createTimelineEvent()` passes positional arguments to an options
object helper, and `getCustomObjectSchema()` ignores its `query` argument.
Legacy contact-list and owner endpoints coexist with newer APIs. Review the
release-specific reference before use. Fixing these behaviors needs separate code
changes and validation; this documentation work does not silently change them.
