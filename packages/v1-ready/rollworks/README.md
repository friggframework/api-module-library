# RollWorks API Module (`@friggframework/api-module-rollworks`)

A [Frigg](https://friggframework.org) API module for [RollWorks / AdRoll ABM](https://www.adroll.com/account-based-marketing-platform)
(formerly RollWorks). It wraps the [NextRoll API](https://apidocs.nextroll.com/guides/get-started-rollworks.html)
so a Frigg integration can resolve the connected organization and advertisables,
and manage Target Account Lists (list / get / create / update / delete) plus
domain items on those lists.

Integrations consume it the standard Frigg way:

```javascript
const org = await this.rollworks.api.getOrganization();
this.rollworks.api.setAdvertisableEid(advertisableEid);
const tals = await this.rollworks.api.listTargetAccounts();
```

## Authentication

RollWorks uses **OAuth 2.0** (authorization-code grant) against NextRoll:

- Authorize: `https://services.adroll.com/auth/authorize`
- Token: `https://services.adroll.com/auth/token`
- Header: `Authorization: Bearer {ACCESS_TOKEN}`
- Scope: `all` (the only documented scope)

Register an application on the NextRoll developer site, then set
`ROLLWORKS_CLIENT_ID`, `ROLLWORKS_CLIENT_SECRET`, optional `ROLLWORKS_SCOPE`,
and the shared Frigg `REDIRECT_URI` (the module appends `/rollworks`). See
`.env.example`.

Access tokens expire after 24 hours; refresh tokens expire after one year and
rotate on use.

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getOrganization(params?)` | `GET /api/v1/organization/get` | Connected org identity (`eid`, `name`). |
| `listAdvertisables(params?)` | `GET /api/v1/organization/get_advertisables` | Advertisables for the org. |
| `listTargetAccounts(params?)` | `GET /audience/v1/target_accounts` | List Target Account Lists. |
| `getTargetAccount(talEid, params?)` | `GET /audience/v1/target_accounts/{talEid}` | Get one TAL. |
| `createTargetAccount(data)` | `POST /audience/v1/target_accounts` | Create a TAL (`name`, optional `domains`). |
| `updateTargetAccount(talEid, data)` | `POST /audience/v1/target_accounts/{talEid}` | Update a TAL. |
| `deleteTargetAccount(talEid, params?)` | `DELETE /audience/v1/target_accounts/{talEid}` | Delete a TAL. |
| `listTargetAccountItems(talEid, params?)` | `GET .../tiers/{tier}/items` | List domains (default tier `all`). |
| `addTargetAccountItems(talEid, data)` | `POST .../tiers/{tier}/items` | Upsert domains (`domains[]` or `items[]`). |
| `removeTargetAccountItems(talEid, data)` | `DELETE .../tiers/{tier}/items` | Remove domains. |

Audience endpoints require `advertisable_eid` (instance via
`setAdvertisableEid` / constructor, or per-call override).

## Not covered

- **Webhooks:** NextRoll does not document a webhook-subscription management API
  for AdRoll ABM / RollWorks. Inbound S2S event reporting (`srv.adroll.com`) is
  a different product surface and is out of scope.
- GraphQL Reporting, Playbooks, Email Contact Lists, Ideal Customer Profile, and
  the broader CRUD ad/campaign surface — available in the vendor docs but not
  wired in this module yet.

## Sources

- [AdRoll ABM / RollWorks API overview](https://apidocs.nextroll.com/guides/get-started-rollworks.html)
- [OAuth 2.0](https://apidocs.nextroll.com/guides/oauth.html)
- [CRUD API reference](https://apidocs.nextroll.com/crud-api/reference.html)
- [Audience API reference](https://apidocs.nextroll.com/audience-api/reference.html)
- [Target Account List examples](https://apidocs.nextroll.com/audience-api/examples/tal.html)

## Prior work

Upgraded from the v1 module previously at
`packages/needs-updating/rollworks/` (`@friggframework/api-module-rollworks@0.10.1`),
which already covered organization + Target Account List CRUD against the same
NextRoll endpoints.
