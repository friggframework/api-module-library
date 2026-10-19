# Linear

This is the API Module for Linear that allows the [Frigg](https://friggframework.org) code to talk to the Linear API.

Read more on the [Frigg documentation site](https://docs.friggframework.org/api-modules/list/linear

## API methods

Each method sends one documented GraphQL operation through the SDK's `client.client.rawRequest`
([GraphQL docs](https://linear.app/developers/graphql),
[schema](https://github.com/linear/linear/blob/master/packages/sdk/src/schema.graphql)) and returns the
unwrapped object (mutations check `success` and throw if it is false). Arguments are positional.

| Method | GraphQL | Returns |
|---|---|---|
| `issue(id)` | `issue(id:)` (UUID or `ENG-142`) | issue |
| `issueByIdentifier(identifier)` | `issue(id:)`, identifier format checked | issue |
| `searchIssues(teamId, stateType, updatedBefore, first)` | `issues(filter:, first:)`; filters `team.id`, `state.type`, `updatedAt < updatedBefore` | issue[] (first page; default size 50) |
| `issueCreate(teamId, title, description, priority, stateName, labelIds)` | `issueCreate(input:)`; `stateName` is looked up to a `stateId` on the team first | issue |
| `issueUpdate(id, input)` | `issueUpdate(id:, input:)` (`IssueUpdateInput`, e.g. `stateId`, `labelIds`) | issue |
| `commentCreate(issueId, body)` | `commentCreate(input:)` | comment |
| `attachmentLinkURL(issueId, url, title)` | `attachmentLinkURL(issueId:, url:, title:)` | attachment |
| `teams()` | `teams` (all pages) | team[] |
| `workflowStates(teamId, name)` | `workflowStates(filter:)` (all pages; optional exact name) | workflowState[] |

`graphql(query, variables)` is available for anything else.

## Webhook signature verification

`Api#verifyWebhookSignature({ headers, body, rawBody, now })` checks `Linear-Signature`
([docs](https://linear.app/developers/webhooks)): hex HMAC-SHA256 of the raw body keyed with the webhook signing
secret, and the body's `webhookTimestamp` (ms) must be within 60 s of now. Never throws.

- Secret: `params.webhookSecret` or `LINEAR_WEBHOOK_SECRET`.
- Pass `rawBody`.
