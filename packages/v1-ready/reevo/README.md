# Reevo API Module

A [Frigg](https://friggframework.org) API module for **Reevo** — the AI-native
Revenue OS (CRM). It lets a Frigg app read and write Reevo accounts, contacts,
opportunities, tasks, activities, and sequence enrollments.

## Authentication

Reevo uses a **static API key** sent in the `x-api-key` header (no OAuth). Find
your key under **Settings → API** in your Reevo workspace.

- Base URL: `https://api.reevo.ai/api/v1/public`
- Auth header: `x-api-key: <your key>`
- Docs: https://help.reevo.ai/Data-management-and-migration/Integrations-With-Other-Tools

Set the key locally via `.env`:

```
REEVO_API_KEY=your_reevo_api_key_here
```

## Usage

```js
const { Api } = require('@friggframework/api-module-reevo');

const reevo = new Api({ api_key: process.env.REEVO_API_KEY });

// Upsert an account + contact in one call
await reevo.upsertAccountContact({
    email: 'jane@acme.com',
    first_name: 'Jane',
    last_name: 'Doe',
    company: 'Acme',
    account_website: 'https://acme.com',
});

// Create an opportunity on an account
const opp = await reevo.createOpportunity({
    display_name: 'Acme — Platform License',
    account_id: '…uuid…',
    amount: 25000,
});

// Move it to a new stage (stage changes go through shift_stage, not update)
await reevo.shiftOpportunityStage(opp.id, { target_stage_name: 'Negotiation' });

// Log a call / meeting-intelligence summary as a manual activity
await reevo.createManualActivity({
    metadata: {
        activity_time: '2026-08-19T17:00:00Z',
        subject: 'Discovery call',
        category: 'CALL',
        description: 'Summary + next steps from the recorded call.',
    },
    account_id: '…uuid…',
});
```

## Methods

| Method | Endpoint | Notes |
|---|---|---|
| `upsertAccountContact(body)` | `POST /account_contact?payload_type=json` | Requires `email` |
| `createAccount(body)` | `POST /accounts` | Requires `name` |
| `updateAccount(id, body)` | `PATCH /accounts/{id}` | |
| `getAccount(id)` | `GET /accounts/{id}` | |
| `searchAccounts(body)` | `POST /accounts/search` | Requires `domain_name` |
| `getContact(id)` | `GET /contacts/{id}` | |
| `searchContacts(body)` | `POST /contacts/search` | Requires `contact_email` or `owner_email` |
| `createOpportunity(body)` | `POST /opportunities` | Requires `display_name`, `account_id` |
| `updateOpportunity(id, body)` | `PATCH /opportunities/{id}` | Stage changes use `shiftOpportunityStage` |
| `getOpportunity(id)` | `GET /opportunities/{id}` | |
| `searchOpportunities(body)` | `POST /opportunities/search` | |
| `shiftOpportunityStage(id, body)` | `POST /opportunities/{id}/shift_stage` | Requires `target_stage_name` |
| `createTask(body)` | `POST /tasks` | Requires `title`, `owner_email` |
| `createManualActivity(body)` | `POST /manual_activities` | Requires `metadata.activity_time/subject/description` |
| `searchUsers(body)` | `POST /users/search` | Requires `email` |
| `searchMailboxes(body)` | `POST /mailboxes/search` | Requires `owner_user_email` |
| `createSequenceEnrollment(body)` | `POST /sequence_enrollments` | Requires `contact_email`, `sequence_id` |
| `retrieveAccountAndContact(params)` | `GET /account_and_contact_retrieval` | Exactly one of `contact_email` / `account_domain` / `contact_phone_number` |

`custom_fields` (dict) is accepted on accounts, contacts, and opportunities.
Write permissions on a resource automatically include read.

## OpenAPI spec

Reevo does not publish its own OpenAPI document, so `reevo.openapi.yaml` in this
package is the canonical machine-readable contract — authored from Reevo's
help-docs reference. The client in `api.js` mirrors it 1:1 (one method per
`operationId`). Use the spec to generate typed clients, validate requests, or
drive an `openapi-client-axios` client (see the Marketo module for that
pattern). A test asserts the spec and client stay in sync.

## Testing

```
npm test
```

Tests are fully offline — the API surface is exercised against captured requests
and the auth/definition wiring against stubs (no live Reevo key required).
