# Jotform API Module (`@friggframework/api-module-jotform`)

A [Frigg](https://friggframework.org) API module for [Jotform](https://www.jotform.com)
— the online form builder. It wraps Jotform's public REST API so a Frigg
integration can read account identity, manage forms and submissions, and
register per-form webhooks.

Integrations consume it the standard Frigg way:

```javascript
const forms = await this.jotform.api.listForms({ limit: 50 });
const { content: questions } = await this.jotform.api.listFormQuestions(formId);
await this.jotform.api.createFormWebhook(formId, 'https://hook.example.com');
```

## Authentication

Jotform uses **API-key** authentication. Create a key under
**My Account → API**, and the module sends it on every request as the
`APIKEY` header (official docs also accept `apiKey` as a query parameter):

```bash
curl https://api.jotform.com/user -H "APIKEY: YOUR_API_KEY"
```

| Detail | Value |
|---|---|
| Header | `APIKEY: <key>` |
| Default base URL | `https://api.jotform.com` |
| EU | `https://eu-api.jotform.com` |
| HIPAA | `https://hipaa-api.jotform.com` |
| Docs | https://api.jotform.com/docs/ |
| Create a key | https://www.jotform.com/help/253-how-to-create-a-jotform-api-key/ |

Set `JOTFORM_API_KEY` (and optionally `JOTFORM_BASE_URL`) in your environment
(see `.env.example`), or collect them through the module's JSON-Schema auth
form (`getAuthorizationRequirements` / `frigg auth`). Use a **Full Access**
key for create/update/delete.

Daily call limits depend on plan (Starter 1,000 / Bronze 10,000 / Silver
50,000 / Gold 100,000 / Enterprise unlimited) — see
[Daily API Call Limits](https://www.jotform.com/help/416-daily-api-call-limits/).

## API Methods

| Method | HTTP | Purpose |
|---|---|---|
| `getUser()` | `GET /user` | Account identity (username, email, plan). |
| `listForms(params)` | `GET /user/forms` | List forms (`offset`, `limit`, `filter`, `orderby`). |
| `getForm(formId)` | `GET /form/{id}` | Form metadata. |
| `createForm(fields)` | `POST /form` | Create form (form-urlencoded nested fields). |
| `deleteForm(formId)` | `DELETE /form/{id}` | Delete a form. |
| `updateFormProperties(formId, props)` | `POST /form/{id}/properties` | Update title/styles/etc. |
| `listFormQuestions(formId)` | `GET /form/{id}/questions` | Question definitions (needed to map submission answers). |
| `listFormSubmissions(formId, params)` | `GET /form/{id}/submissions` | Submissions for one form. |
| `listUserSubmissions(params)` | `GET /user/submissions` | Submissions across the account. |
| `getSubmission(id)` | `GET /submission/{id}` | One submission. |
| `createFormSubmission(formId, answers)` | `POST /form/{id}/submissions` | Create a submission (`submission[qid]=…`). |
| `updateSubmission(id, answers)` | `POST /submission/{id}` | Edit a submission. |
| `deleteSubmission(id)` | `DELETE /submission/{id}` | Delete a submission. |
| `listFormWebhooks(formId)` | `GET /form/{id}/webhooks` | List webhook URLs. |
| `createFormWebhook(formId, url)` | `POST /form/{id}/webhooks` | Register `webhookURL`. |
| `deleteFormWebhook(formId, webhookId)` | `DELETE /form/{id}/webhooks/{id}` | Remove a webhook. |

Paths follow the official Node SDK (`https://api.jotform.com` + `/user`,
`/form/…`, `/submission/…`). Write endpoints use
`application/x-www-form-urlencoded` as documented.

## Capability manifest

`jotform.capabilities.json` (`capability-manifest/v0.1`) declares the wired
objects (`user`, `form`, `submission`, `question`, `webhook`) and maps every
capability to an `Api` method. Version matches `package.json`.

## Fenestra

None. Jotform is not listed as a Fenestra UI-extension host in
`specs/fenestra/PLATFORMS.md` (branch `claude/fenestra-spec-draft-Q367t`).
This module is REST + API-key + per-form webhook **subscription** management
only.

## Tests

```bash
cd packages/v1-ready/jotform && npm test
```

Offline Jest suite: request-shape unit tests, definition/auth wiring, and
OpenAPI ↔ client `operationId` sync.

## Prior work

No prior package existed under `packages/` (including `needs-updating`).
Shaped like `packages/v1-ready/fathom/` with capability-manifest patterns from
sibling v2 modules (e.g. ActiveCampaign).
