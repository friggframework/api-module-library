# salesforce

This is the API Module for salesforce that allows the [Frigg](https://friggframework.org) code to talk to the salesforce
API.

Read more on the [Frigg documentation site](https://docs.friggframework.org/api-modules/list/salesforce)


## Salesforce Connected App Setup

This module requires a Salesforce Connected App to authenticate via OAuth 2.0.

### App type: use "New Connected App" (not "External Client App")

Salesforce offers two app types — the choice matters for cross-org OAuth:

- **New Connected App** (`Setup → Apps → External Client Apps → Settings → New Connected App`) — supports OAuth across **multiple Salesforce orgs**. This is what you need so that users from any org can authorize the integration.
- **External Client App** (created directly under `Setup → Apps → External Client Apps`) — only works **within the same org** it was created in. Do not use this type for a multi-tenant integration.

### Required OAuth scopes

When configuring the Connected App, add both of the following scopes:

- **Full access (`full`)**
- **Perform requests at any time (`refresh_token, offline_access`)**

### Refresh token expiry

In the Connected App's OAuth policies, set **Refresh Token Policy** to **"Refresh token is valid until revoked"**. This prevents the refresh token from expiring on a schedule and breaking the integration unexpectedly.

### Integration user

For production and customer orgs, create a **dedicated integration user** in Salesforce rather than authorizing as a real person. This isolates the integration's permissions and prevents the connection from breaking if an employee's account is deactivated.

For development and testing, you can authorize with your own Salesforce account.

### Conditional permissions

The integration user needs additional permissions depending on which Salesforce objects your integration touches. Grant only what applies:

| Salesforce objects | Required permission |
| --- | --- |
| **Campaigns, CampaignMembers** | Enable the **Marketing User** checkbox on the user record (**Setup → Users → [user] → Edit → Advanced User Details → Marketing User ✓**). This is a feature gate separate from object-level CRUD — even a user with full Edit on Campaigns cannot insert a Campaign without it. |
| **Contacts, Accounts, Leads, Opportunities** | Standard API access is sufficient. No additional flags needed beyond the base integration user profile. |

> **Open question — license compatibility:** The Marketing User flag historically consumes a Marketing User feature license. It is currently unconfirmed whether this flag can be assigned to a Salesforce Integration User license (which is stripped-down and cheaper). If your integration creates Campaigns and you plan to use an Integration license, verify this in a Developer org before advising customers — it may require a full Salesforce seat instead.

## Capability-manifest methods

Added to `Api` to back the `unimplemented` capabilities in `salesforce.capabilities.json`. All take positional
arguments, like the existing `create(object, data)` / `get(object, id)`.

| Method | Request | Docs |
| --- | --- | --- |
| `updateLead(id, fields)` | `PATCH /sobjects/Lead/{id}` | [Update a record](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_update_fields.htm) |
| `updateEvent(id, fields)` | `PATCH /sobjects/Event/{id}` | same |
| `updateOpportunity(id, fields)` | `PATCH /sobjects/Opportunity/{id}` | same |
| `searchPeopleByEmail(email)` | `GET /search?q=FIND {email} IN EMAIL FIELDS RETURNING Lead(...), Contact(...)`; resolves to `{ leads, contacts }` | [Search](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_search.htm) |
| `createContentVersion(title, pathOnClient, versionData, firstPublishLocationId)` | `POST /sobjects/ContentVersion` | [ContentVersion](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_contentversion.htm) |
| `createContentNote(title, content, linkedEntityId)` | `POST /sobjects/ContentNote`, then `POST /sobjects/ContentDocumentLink` | [ContentNote](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_contentnote.htm) |
| `listUsers(activeOnly)` | SOQL `SELECT ... FROM User [WHERE IsActive = true]` | [Query](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_query.htm) |

Notes:

- The update methods put the id into the body as `Id` for jsforce, which moves it into the URL; the PATCH body holds only
  `fields`. A missing id throws before any request is sent.
- `searchPeopleByEmail` escapes SOSL reserved characters in the term, so it cannot break out of `FIND {...}`.
- `createContentVersion`: `versionData` is a base64 string (a `Buffer` is encoded for you). The JSON create path is
  limited to small files; Salesforce's multipart upload is not used.
- `createContentNote`: plain text is HTML-escaped (newlines become `<br>`) and base64-encoded as `Content`. The note
  is then linked to `linkedEntityId` with `ShareType: 'V'`; the result carries `contentDocumentLinkId`. If the link call
  fails the note already exists.
- `listUsers` selects `Id, Username, Name, FirstName, LastName, Email, IsActive, Title`, limited to 2000 rows.
- **Not implemented:** the `webhook` capability (`verifyWebhookSignature`). Salesforce has no signed push webhook:
  Change Data Capture arrives over Pub/Sub / CometD and Outbound Messages are unsigned.

Tests: `npx jest test/capability-methods.test.js` (real jsforce, requests captured with nock).
