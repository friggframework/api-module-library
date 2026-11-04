# `@friggframework/api-module-servicenow`

Frigg v2 API module for **ServiceNow** (Table API + Attachment API metadata). Demand-source module for ITSM / support ticket signal.

## Sources (official only)

| Topic | Link |
|---|---|
| Table API | https://developer.servicenow.com/print_page.do?category=null&identifier=c_TableAPI&module=api&release=yokohama |
| Attachment API | https://developer.servicenow.com/print_page.do?category=null&identifier=c_AttachmentAPI&module=api&release=yokohama |
| REST API list | https://developer.servicenow.com/print_page.do?category=null&identifier=restListPage&module=api&release=yokohama |
| OAuth authorization code | https://www.servicenow.com/docs/r/yokohama/platform-security/authentication/c_OAuthAuthorizationCodeFlow.html |
| OAuth token parameters | https://www.servicenow.com/docs/r/yokohama/platform-security/authentication/r_OAuthAPIRequestParameters.html |
| Create OAuth endpoint | https://docs.servicenow.com/bundle/yokohama-platform-security/page/administer/security/task/t_CreateEndpointforExternalClients.html |
| Export OpenAPI (per instance) | https://www.servicenow.com/docs/bundle/yokohama-api-reference/page/integrate/inbound-rest/task/export-openapi-specification.html |
| Outbound REST scripting | https://www.servicenow.com/docs/r/yokohama/api-reference/web-services/c_ScriptingOutboundREST.html |
| Flow Designer REST step | https://www.servicenow.com/docs/r/yokohama/build-workflows/workflow-studio/rest-request-action-designer.html |
| CSM case table | `sn_customerservice_case` — https://www.servicenow.com/docs/r/xanadu/customer-service-management/r_TIWCustomerService.html |
| CSM account table | `customer_account` — https://www.servicenow.com/docs/r/customer-service-management/b2b-account-data-model.html |

There is **no single public static Table API OpenAPI URL**; instances can export OpenAPI from REST API Explorer. `servicenow.openapi.yaml` is a curated subset matching `api.js` 1:1.

## Auth

**Primary: OAuth 2.0 authorization code** against the connected instance:

- Authorize: `https://{instance}.service-now.com/oauth_auth.do`
- Token: `https://{instance}.service-now.com/oauth_token.do` (`application/x-www-form-urlencoded`)
- API calls: `Authorization: Bearer <access_token>`

Register an OAuth client on the instance (System OAuth → Application Registry → “Create an OAuth API endpoint for external clients”).

Env: `SERVICENOW_CLIENT_ID`, `SERVICENOW_CLIENT_SECRET`, optional `SERVICENOW_SCOPE`, `REDIRECT_URI` (module appends `/servicenow`).

**Alternate: HTTP Basic** with instance username/password (officially supported on ServiceNow REST APIs). Provide `instance` + `username` + `password` via `setAuthParams` / `getToken` without an OAuth code.

## Covered objects

| Object | Table / path | Methods |
|---|---|---|
| Incident | `incident` | list, get, create, update (PATCH) |
| Catalog request | `sc_request` | list, get |
| Requested item | `sc_req_item` | list, get |
| Problem | `problem` | list, get |
| Change | `change_request` | list, get |
| User | `sys_user` | list, get |
| Company | `core_company` | list, get |
| CSM account | `customer_account` | list, get |
| CSM case | `sn_customerservice_case` | list, get, create, update |
| Attachment metadata | `/api/now/attachment` | list, get |

List query params (official): `sysparm_query`, `sysparm_limit`, `sysparm_offset`, `sysparm_fields`, `sysparm_display_value`.

## Webhooks (no subscribe REST API)

ServiceNow **does not** offer a Table/ITSM REST endpoint to register outbound webhooks the way HubSpot or Zendesk do. Do **not** invent a Frigg `createWebhook` / subscribe method.

Official outbound pattern (instance-configured):

1. **Outbound REST Message** + `RESTMessageV2` from a **Business Rule** (or other script) on record change  
2. **Flow Designer / Workflow Studio REST step** (Integration Hub) posting to an external URL  

Frigg can still **receive** those POSTs on an app route, but subscription management lives in ServiceNow, not in this module. There is intentionally **no** `extensions/webhooks/` bundle (contrast HubSpot Tier-3 in `packages/v1-ready/hubspot/extensions/webhooks/`).

## Canonical mappings (ADR-057)

- `mappings/ticket.js` → `support@1` (incident + case → Ticket), **UNVALIDATED**
- `mappings/company.js` → `business@1` (core_company + customer_account → Company), **UNVALIDATED**

Exposed via `extensions.mapping` from `index.js`.

## Fenestra

**None.** This module is a REST Table/Attachment client. ServiceNow UI Builder / Workspace extensions are in-platform UI work, not extension points exposed by the Table API for a third-party Frigg connector.

## Tests

```bash
cd packages/v1-ready/servicenow && npm install && npm test
```

`frigg auth test .` requires a real instance + OAuth (or basic) credentials — not faked.
