# HiBob API Module (`@friggframework/api-module-hibob`)

A [Frigg](https://friggframework.org) API module for [HiBob / Bob](https://www.hibob.com)
— the HRIS platform. It wraps Bob's public **v1** REST API so a Frigg
integration can search/create/update people, read field/list metadata, manage
time off, and receive inbound webhooks v2.

```javascript
const people = await this.hibob.api.searchPeople({
    fields: ['root.id', 'root.email', 'root.firstName'],
});
const person = await this.hibob.api.getPerson(people.employees[0].id);
```

## Authentication

Customer integrations use **API Service Users** with HTTP Basic Auth:

```bash
curl https://api.hibob.com/v1/profiles \
  -H "Authorization: Basic $(printf '%s' 'SERVICE_USER_ID:TOKEN' | base64)"
```

Create a service user in Bob, add it to a permission group, and grant the
field/category permissions your integration needs. See
[API Service users](https://apidocs.hibob.com/docs/api-service-users) and
[Authorization](https://apidocs.hibob.com/reference/authorization).

**Marketplace partners** building distributed OAuth apps use OAuth 2.0 instead
(partner approval required). This module implements the service-user path.

Set `HIBOB_SERVICE_USER_ID`, `HIBOB_SERVICE_USER_TOKEN`, and optionally
`HIBOB_COMPANY_ID` / `HIBOB_BASE_URL` (see `.env.example`).

Entity `externalId` is Bob's `companyId` (from People search or the optional
auth field) so inbound webhooks can be routed by `body.companyId`.

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `searchPeople` | `POST /people/search` | Bulk-read employees |
| `getPerson` | `POST /people/{identifier}` | Read one employee |
| `createPerson` | `POST /people` | Create employee |
| `updatePerson` | `PUT /people/{identifier}` | Update fields (PATCH semantics) |
| `listProfiles` | `GET /profiles` | Public profiles of active employees |
| `listEmployeeFields` | `GET /company/people/fields` | Field metadata |
| `listNamedLists` / `getNamedList` | `/company/named-lists` | Named lists (site, department, …) |
| `listTimeOffChanges` | `GET /timeoff/requests/changes` | Time off deltas |
| `getTimeOffRequest` / `createTimeOffRequest` / `cancelTimeOffRequest` | `/timeoff/employees/{id}/requests` | Request CRUD |
| `listWhosOut` / `listOutToday` | `/timeoff/whosout`, `/outtoday` | Who's out |
| `getTimeOffBalance` | `GET /timeoff/employees/{id}/balance` | Balance |
| `listPolicyTypes` | `GET /timeoff/policy-types` | Policy type names |
| `verifyWebhookSignature` | (offline) | Bob-Signature HMAC-SHA512 |

## Webhooks

Customer webhook **subscriptions are configured in the Bob UI** — there is no
public REST create/list/delete for service-user integrations. The
`extensions/webhooks/` bundle receives deliveries: verify `Bob-Signature`,
resolve tenant by `companyId`, emit `HIBOB_WEBHOOK`.

Set `HIBOB_WEBHOOK_SIGNING_SECRET` to the secret from Bob's webhook
configuration.

## Docs

- https://apidocs.hibob.com/
- https://apidocs.hibob.com/llms.txt
- Capability manifest: `hibob.capabilities.json`
- OpenAPI subset: `hibob.openapi.yaml`
