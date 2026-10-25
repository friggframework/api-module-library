# First successful call

Install `{{PACKAGE}}@{{VERSION}}` with a compatible Frigg dependency
(`{{FRIGG_RANGE}}`). Obtain an OAuth access token for an account whose app has
`crm.objects.contacts.read`, following [OAuth setup](authentication.md).

Set `HUBSPOT_ACCESS_TOKEN` in your shell or secret manager, then run this read-only
example in a Node application:

```javascript
const {Api} = require('{{PACKAGE}}');

async function main() {
    const api = new Api({access_token: process.env.HUBSPOT_ACCESS_TOKEN});
    const page = await api.listContacts({limit: 1, properties: ['email']});
    console.log(page.results.map(contact => contact.id));
}

main().catch(() => {
    console.error('HubSpot contact read failed');
    process.exitCode = 1;
});
```

A successful call resolves to one provider response, normally with `results` and
an optional `paging.next.after` cursor. An empty account can return an empty
`results` array. Providing `properties` avoids the module's additional property
discovery request. This example uses an already-issued token; it does not exchange
an authorization code or configure automatic refresh persistence.

The adjacent `first-call.cjs` is used by the offline fixture test. That check
exercises this module's method with a fake Requester and verifies URL and query
selection, omitted first-page cursors, and the returned fixture. It does not test
a live HubSpot account or the installed Frigg OAuth implementation.

For a Frigg application, register `Definition` through the application's module
binding and use the managed authorization flow so credentials can be persisted.
Treat access tokens and contact data as secrets or customer data; avoid logging
responses from production accounts merely to verify a connection.
