# Stack API Module (`@friggframework/api-module-stack`)

A [Frigg](https://friggframework.org) API module for [Stack Global](https://www.stackglobal.io)
— a sales-enablement platform for sales-cycle / playbook definition and
CRM-native coaching. It wraps Stack's partner integration HTTP surface so a
Frigg integration can authorize, read company data, read sales cycles, and list
team members.

Integrations consume it the standard Frigg way:

```javascript
const company = await this.stack.api.getCompany();
const members = await this.stack.api.getTeamMembers();
const cycle = await this.stack.api.getSalesCycle();
```

## Authentication

Stack partner integrations use a **static Bearer secret** (no OAuth). The module
sends it on every request as:

```bash
curl "$STACK_BASE_URL/integration/company?companyId=123&type=partner" \
  -H "Authorization: Bearer YOUR_STACK_SECRET"
```

| Env | Purpose |
| --- | --- |
| `STACK_SECRET` | Partner secret → `Authorization: Bearer …` |
| `STACK_BASE_URL` | API host (required for production; no vendor-published default) |

The auth form also collects optional `companyId` and `integrationType`, which are
persisted on the entity and sent as query/body fields on `/integration/*` calls.

## Endpoints covered

| Client method | HTTP | Path |
| --- | --- | --- |
| `authorize` | `POST` | `/integration/authorize` |
| `browserExtensionAuth` | `POST` | `/integration/authorize` (convenience) |
| `getSalesCycle` | `GET` | `/integration/salesCycle` |
| `getCompany` | `GET` | `/integration/company` |
| `getTeamMembers` | `GET` | `/integration/company/members` |

## Vendor documentation status

Stack Global does **not** publish a public developer OpenAPI or REST reference.
`stack.openapi.yaml` is a curated subset mirroring `api.js` 1:1, ported from
Left Hook-owned module code cleared for this library. Response schemas are
opaque / UNVERIFIED until Stack publishes an official contract.

Product context: https://www.stackglobal.io/

## Canonical mappings (ADR-057)

UNVALIDATED mappings under `extensions.mapping` for `business@1`:

- `company` → `Company`
- `member` → `Contact`

**Skipped:** sales cycle → `Deal`. A Stack sales cycle is a process/playbook
template, not a deal/opportunity instance.

## Fenestra

No `stack.fenestra.yaml`. Stack's documented UI surface is CRM-native
(HubSpot / Salesforce) rather than a third-party UI extension SDK that partners
implement inside Stack. See the PR for details.

## Capability manifest

See `stack.capabilities.json` (`capability-manifest/v0.1`). Every capability
points at a real `Api` method.

## Tests

```bash
cd packages/v1-ready/stack && npm test
```

Includes `spec-sync` (every OpenAPI `operationId` has an `Api` method; server URL
equals the client default `baseUrl`).
