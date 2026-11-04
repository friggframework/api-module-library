# Left Hook API Module (`@friggframework/api-module-lefthook-api`)

A [Frigg](https://friggframework.org) API module for the **Left Hook Core API**
(`https://api.lefthook.com`). It wraps auth verification, companies, deals,
invoices, milestones, bank accounts, metrics/snapshots, sync status, and
domain-model change requests (including webhook registration).

Integrations consume it the standard Frigg way:

```javascript
const companies = await this['lefthook-api'].api.listCompanies();
const ok = await this['lefthook-api'].api.verifyAuth();
```

## Authentication

Left Hook uses **API-key** authentication. The module sends the key on every
request as:

```bash
curl https://api.lefthook.com/v1/auth/verify \
  -H "Authorization: Bearer YOUR_API_KEY"
```

- **Base URL:** `https://api.lefthook.com`
- **Env:** `LEFTHOOK_API_KEY` (see `.env.example`)

The module exposes a JSON-Schema authorization form
(`getAuthorizationRequirements`) so the key can be collected through the Frigg
auth UI / `frigg auth` CLI.

## API Methods (summary)

| Area | Methods |
|---|---|
| Auth | `verifyAuth` |
| Companies | `listCompanies`, `getCompany`, `createCompany`, `updateCompany` |
| Invoices | `listInvoices`, `getInvoice`, `createInvoice`, `updateInvoice`, `syncInvoiceFromXero` |
| Deals | `listDeals`, `getDeal`, `createDeal`, `updateDeal`, `syncDealFromHubSpot` |
| Milestones | `listMilestones`, `getMilestone`, `createMilestone`, `updateMilestone`, `syncMilestoneFromClickUp` |
| Bank | `listBankAccounts`, `getBankAccount`, `syncBankAccountFromMercury`, `createBalanceSnapshot` |
| Metrics | `getAllMetrics`, `getDeliveryMetrics`, `getGTMMetrics`, `getFinanceMetrics` |
| Snapshots | `createDeliverySnapshot`, `createGTMSnapshot`, `createFinanceSnapshot` |
| Sync status | `createSyncStatus`, `updateSyncStatus` |
| Change requests | `listChangeRequests`, `getChangeRequest`, `createChangeRequest`, `updateChangeRequest`, `submitChangeRequest`, `approveChangeRequest`, `rejectChangeRequest`, `withdrawChangeRequest`, `markChangeRequestMerged`, `updateChangeRequestExternalRef`, `registerChangeRequestWebhook` |
| Domain model | `listDomainModelContent`, `getDomainModelCategory`, `getDomainModelItem`, `getDomainModelHistory`, `getDomainModelVersion` |

`lefthook-api.openapi.yaml` is the 1:1 source of truth for OpenAPI `operationId`s
(convenience helpers like `getDomainModelCategory` share paths with listed
operations).

## Tests

```bash
cd packages/v1-ready/lefthook-api && npm test
```

Offline only — HTTP is stubbed. Live `frigg auth test .` needs sandbox
credentials (not included).

## Sources

- Cleared Left Hook-owned module port (Sean) from `lefthookhq/lefthook.com`
  `@ 98f3433b7b536eac1120a3e195fa666852de9c07`, path
  `apps/frigg-internal/backend/src/api-modules/lefthook-api`
- No public OpenAPI / developer hub for `api.lefthook.com` at authoring time
  (`api.lefthook.com` does not resolve publicly from this environment)
