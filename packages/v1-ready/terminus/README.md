# @friggframework/api-module-terminus

Frigg API module for the **Terminus / DemandScience ABM Platform Account Lists API**.

## Auth

API key sent as `Authorization: Bearer <key>`. Keys are issued by a DemandScience / Terminus CSM or Onboarding Specialist (not self-served from a developer console).

## Base URL

`https://api.terminusplatform.com/accountLists/v2`

## Covered methods

| Method | HTTP |
|---|---|
| `listFolders` | `GET /folders` |
| `createFolder` | `POST /folders` |
| `listAccountLists` | `GET /accountLists` |
| `createAccountList` | `POST /accountLists` |
| `addAccountsToList` | `POST /accountLists/{listId}/accounts/add` |
| `removeAccountsFromList` | `POST /accountLists/{listId}/accounts/remove` |

## Docs

- Developer portal (login-gated OpenAPI): https://developer.terminus.com/
- Product: https://demandscience.com/ / https://terminus.com/

## Test

```bash
npm test
```
