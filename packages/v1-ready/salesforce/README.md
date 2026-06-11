# salesforce

This is the API Module for salesforce that allows the [Frigg](https://friggframework.org) code to talk to the salesforce
API.

Read more on the [Frigg documentation site](https://docs.friggframework.org/api-modules/list/salesforce

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

### Marketing User requirement

The Salesforce user who authorizes the OAuth connection must be marked as a **Marketing User**. This grants the integration permission to create and manage Campaigns in Salesforce — without it, campaign creation will fail.

To enable it: **Setup → Users → [user] → Edit → Advanced User Details → Marketing User ✓**