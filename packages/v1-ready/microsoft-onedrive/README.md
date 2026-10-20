# Microsoft OneDrive (`@friggframework/api-module-microsoft-onedrive`)

Frigg v2 API module for OneDrive via [Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/resources/onedrive). `moduleName`: `microsoft-onedrive`.

## Auth

OAuth 2.0 authorization code against the [Microsoft identity platform](https://learn.microsoft.com/en-us/graph/auth-v2-user).

| Env | Purpose |
|---|---|
| `MICROSOFT_ONEDRIVE_CLIENT_ID` | Azure AD application (client) id |
| `MICROSOFT_ONEDRIVE_CLIENT_SECRET` | Client secret |
| `MICROSOFT_ONEDRIVE_SCOPE` | Space-separated Graph scopes (include `offline_access`) |
| `MICROSOFT_ONEDRIVE_TENANT_ID` | Optional tenant segment (`common` default) |
| `REDIRECT_URI` | Base redirect host; module appends `/microsoft-onedrive` |
| `MICROSOFT_ONEDRIVE_WEBHOOK_CLIENT_STATE` | Opaque `clientState` for Graph change notifications |

Recommended delegated scopes (from Graph permission tables for the covered endpoints): `offline_access`, `User.Read`, `Files.ReadWrite` (or `Files.ReadWrite.All` when broader access is required). Exact least-privilege sets vary by operation — see each operation on Microsoft Learn.

Register an app in the [Microsoft Entra admin center](https://learn.microsoft.com/en-us/graph/auth-register-app-v2). No partner/network approval is required for standard delegated Files permissions on Graph; admin consent may be required in some tenants for `Files.ReadWrite.All`.

## Covered surface

- Identity: `getUser`
- Drives: `getMyDrive`, `listMyDrives`, `getDrive`
- Drive items: `listDriveItemChildren`, `getDriveItem`, `createFolder` (optional `@microsoft.graph.conflictBehavior`), `updateDriveItem`, `deleteDriveItem`, `uploadDriveItemContent` (`PUT .../items/{driveItem-id}/content`), `createUploadSession`, `uploadByPath` / `createUploadSessionByPath` (Learn path addressing), `searchDriveItems` (`GET .../search(q='...')`)
- Subscriptions: `listSubscriptions`, `getSubscription`, `createSubscription`, `updateSubscription`, `deleteSubscription`

Webhook receiver: `extensions/webhooks/` (Graph validationToken handshake + `clientState` check). Notifications do not identify changed files — call [delta](https://learn.microsoft.com/en-us/graph/api/driveitem-delta) after receiving.

## Develop

```bash
cd packages/v1-ready/microsoft-onedrive
npm install
npm test
```

## Sources

- OneDrive / files Graph overview: https://learn.microsoft.com/en-us/graph/api/resources/onedrive
- Official Graph OpenAPI: https://raw.githubusercontent.com/microsoftgraph/msgraph-metadata/master/openapi/v1.0/openapi.yaml (also https://aka.ms/graph/v1.0/openapi.yaml)
- Auth: https://learn.microsoft.com/en-us/graph/auth-v2-user
- Webhooks: https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/using-webhooks
- Change notifications: https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
- Graph Explorer: https://developer.microsoft.com/en-us/graph/graph-explorer

Path templates and `{drive-id}` / `{driveItem-id}` / `{subscription-id}` parameter names match the vendor OpenAPI.

### Docs-only helpers (Learn, not vendor OpenAPI)

Colon path templates are real Graph behavior documented on Learn but **absent** from the vendor OpenAPI. This module exposes them as extra Api helpers (also listed in the curated OpenAPI with `x-frigg-docs-only: true`):

| Helper | HTTP | Docs |
|---|---|---|
| `uploadByPath(driveId, itemPath, content)` | `PUT /drives/{drive-id}/root:/{path}:/content` | [driveitem-put-content](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content) |
| `createUploadSessionByPath(driveId, itemPath, data)` | `POST /drives/{drive-id}/root:/{path}:/createUploadSession` | [driveitem-createuploadsession](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession) |

Vendor-aligned alternatives remain: `uploadDriveItemContent` / `createUploadSession` on `/items/{driveItem-id}/…`.

`createFolder` accepts optional `@microsoft.graph.conflictBehavior` (`fail` \| `replace` \| `rename`) per [driveitem-post-children](https://learn.microsoft.com/en-us/graph/api/driveitem-post-children) (on the body or as the 4th argument). That annotation is also not in the vendor OpenAPI schema.
