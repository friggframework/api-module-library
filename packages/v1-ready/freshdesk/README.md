# `@friggframework/api-module-freshdesk`

Frigg v2 API module for [Freshdesk](https://www.freshworks.com/freshdesk/) REST API v2.

## Auth

HTTP Basic with per-agent API key as username and dummy password `X` (per [official docs](https://developers.freshdesk.com/api/#authentication)).

Required credentials: `domain` (helpdesk subdomain) + `api_key`.

Base URL: `https://{domain}.freshdesk.com/api/v2`

## Covered surfaces

| Object | Methods |
|---|---|
| Account | `getAccount` |
| Agents | `getAuthenticatedAgent`, `listAgents`, `getAgent` |
| Tickets | `listTickets`, `getTicket`, `createTicket`, `updateTicket` |
| Conversations | `listTicketConversations`, `createReply`, `createNote`, `updateConversation` |
| Contacts | `listContacts`, `getContact`, `createContact`, `updateContact` |
| Companies | `listCompanies`, `getCompany`, `createCompany`, `updateCompany` |
| Groups | `listGroups`, `getGroup`, `createGroup`, `updateGroup` |

## Canonical mappings (ADR-057)

- `mappings/ticket.js` → `support@1` (Merge Ticketing names), `validation: UNVALIDATED`
- `mappings/company.js` → `business@1`, `validation: UNVALIDATED`

Exported via `extensions.mapping`.

## Webhooks

Inbound automation webhooks via `extensions/webhooks` (`POST /webhooks`). Freshdesk has no webhook subscription REST API — configure Trigger Webhook / Trigger API in Automations and pass `?domain={subdomain}`.

## Sources

- https://developers.freshdesk.com/api/
- Curated OpenAPI: `freshdesk.openapi.yaml` (vendor does not publish an official OpenAPI file)

## Develop

```bash
cd packages/v1-ready/freshdesk
npm install
npm test
```
