# @friggframework/api-module-otter

A [Frigg](https://friggframework.org) API module for the **Otter.ai Public API**.

## Is there really an Otter.ai API?

Yes — now. Otter.ai spent years with **no** official public developer API; the
only option was an unofficial, reverse-engineered community client
([omerdn1/otter.ai-api](https://github.com/omerdn1/otter.ai-api)), and Otter's own
help center answered "Does Otter offer an open API?" with a no.

That changed. Otter shipped an official **Public API** (help-center article last
updated **April 23, 2026**), available for **Enterprise** workspaces. This module
targets that official API.

- **Base URL:** `https://api.otter.ai/v1`
- **Auth:** Bearer token — `Authorization: Bearer <API_KEY>`. Create a key in
  Otter under **Integrations → Developer → Create key**.
- **Availability:** Enterprise workspaces only. If you do not see the Developer
  tab, contact your Otter account manager.
- **Scope:** read channels, conversations, transcripts, audio, action items,
  insights, outlines, and workspace details; plus workspace webhooks
  (`conversation.completed`, `conversation.shared`).

Sources: [Otter.ai Public API (Help Center)](https://help.otter.ai/hc/en-us/articles/36130822688279-Otter-ai-Public-API),
[Workspace Webhooks](https://help.otter.ai/hc/en-us/articles/35634832371735-Workspace-Webhooks).

## Install

```bash
npm install @friggframework/api-module-otter
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/api-module-otter');

const otter = new Api({ api_token: process.env.OTTER_API_KEY });

await otter.getWorkspace();
await otter.listChannels();
const { conversations, next_cursor } = await otter.listConversations({ page_size: 25 });
const convo = await otter.getConversation('conv-123', { include: ['transcript', 'action_items'] });
```

In an integration, consume it through the standard Frigg pattern:

```javascript
const convo = await this.otter.api.getConversation(id, { include: 'all' });
```

## Authentication

This is an API-key (Bearer) module. The interactive `frigg auth` CLI and the
hosted auth UI render the form declared by `getAuthorizationRequirements()`
(a single masked `api_token` field). The raw token is persisted on the
credential as `api_token`; the module adds the `Authorization: Bearer` prefix at
request time, so re-hydration never double-prefixes.

## API surface

| Method | HTTP | Path |
|---|---|---|
| `getWorkspace()` | GET | `/workspace` |
| `listChannels(query)` | GET | `/channels` |
| `listConversations(query)` | GET | `/conversations` |
| `getConversation(id, {include})` | GET | `/conversations/{id}` |
| `getConversationTranscript(id)` | GET | `/conversations/{id}/transcript` |
| `getConversationAudio(id)` | GET | `/conversations/{id}/audio` |
| `testAuth()` | GET | `/workspace` |

`listConversations` returns results in reverse chronological order with
cursor-based pagination. `getConversation`'s `include` accepts any of
`transcript`, `action_items`, `insights`, `outline`, or `all`.

Conversation records expose `abstract_summary`, `action_items`, `insights`,
`outline`, `transcript`, `conf_join_url`, and `calendar_guests` — the emails of
users invited to the calendar event, which is how a consuming integration links
a conversation to a CRM contact.

## License

MIT
