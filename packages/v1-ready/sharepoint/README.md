# Microsoft SharePoint (`@friggframework/api-module-microsoft-sharepoint`)

Frigg v2 API module for SharePoint via [Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/resources/sharepoint). `moduleName`: `microsoft-sharepoint`.

## Auth

OAuth 2.0 authorization code against the [Microsoft identity platform](https://learn.microsoft.com/en-us/graph/auth-v2-user).

| Env | Purpose |
|---|---|
| `SHAREPOINT_CLIENT_ID` | Azure AD application (client) id |
| `SHAREPOINT_CLIENT_SECRET` | Client secret |
| `SHAREPOINT_SCOPE` | Space-separated Graph scopes (include `offline_access`) |
| `SHAREPOINT_TENANT_ID` | Optional tenant segment (`common` default) |
| `REDIRECT_URI` | Base redirect host; module appends `/microsoft-sharepoint` |
| `SHAREPOINT_WEBHOOK_CLIENT_STATE` | Opaque `clientState` for Graph change notifications |

Recommended delegated scopes (from Graph permission tables for the covered endpoints): `offline_access`, `User.Read`, `Sites.Read.All` / `Sites.ReadWrite.All`, `Files.ReadWrite.All`. Exact least-privilege sets vary by operation — see each operation on Microsoft Learn.

## Covered surface

- Identity: `getUser`, `getOrganization`
- Sites: `listSites`, `getSite` (sites are read-only on Graph)
- Drives: `listDrives`, `getDrive`
- Drive items: `listDriveItemChildren`, `getDriveItem`, `uploadDriveItemContent`, `updateDriveItem`, `createUploadSession`
- Lists: `listLists`, `getList`
- List items: `listListItems`, `getListItem`, `createListItem`, `updateListItemFields`
- Subscriptions: `listSubscriptions`, `getSubscription`, `createSubscription`, `updateSubscription`, `deleteSubscription`

Webhook receiver: `extensions/webhooks/` (Graph validationToken handshake + `clientState` check).

## Develop

```bash
cd packages/v1-ready/sharepoint
npm install
npm test
```

## Sources

- SharePoint Graph overview: https://learn.microsoft.com/en-us/graph/api/resources/sharepoint
- Auth: https://learn.microsoft.com/en-us/graph/auth-v2-user
- Change notifications: https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
- Graph Explorer: https://developer.microsoft.com/en-us/graph/graph-explorer
