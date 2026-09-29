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

## Rate limits

Salesforce counts the API calls of an org over a rolling 24 hours ([API request limits and allocations](https://developer.salesforce.com/docs/platform/salesforce-app-limits-cheatsheet/guide/salesforce-app-limits-platform-api.html)). An org over its limit gets a `403` with the error code `REQUEST_LIMIT_EXCEEDED`. Salesforce documents no reset time for it.

`Api.rateLimit` declares that limit for the Frigg Requester. The module drives jsforce, not the Requester, so `api.withLimits(call)` applies the declaration to jsforce calls. It awaits `call()`. When the call fails with `REQUEST_LIMIT_EXCEEDED`, it throws a `RateLimitError` with `reason: 'daily'` and a `retryAt` one hour ahead, because there is no reset time to wait for and the module probes every hour. `cause` keeps the jsforce error. Any other error is rethrown unchanged.

The data methods (`create`, `update`, `upsert`, `list`, `find`, `get`, `delete`, `getGlobalMetadata`) use `withLimits` already. `api.conn` is a plain jsforce connection, so a consumer that calls it directly wraps its own calls:

```javascript
const result = await api.withLimits(() => api.conn.query(soql));
```

Salesforce also returns `REQUEST_LIMIT_EXCEEDED` when too many requests that run for 20 seconds or longer are in flight at once (25 in a production org, 5 in a Developer Edition org). That limit clears in seconds, not in a day. Salesforce documents no field that tells the two apart, so `withLimits` reads the error message: a message that contains "concurrent" (Salesforce sends `ConcurrentPerOrgLongTxn` for it) is reported as `reason: 'concurrency'` with a `retryAt` 30 seconds ahead. Any other message stays a daily limit.

When it throws a `RateLimitError` for a limit that lasts longer than the in-process cap (5 minutes by default: the daily limit, not the 30 second concurrency limit), `withLimits` also has the integration record one rate-limit warning for its users, as the Frigg Requester does. On a core that cannot record the warning, it only throws. A core that does not export `RateLimitError` and `classifyRateLimit` (older than the release that added them) makes `withLimits` rethrow the original jsforce error.
