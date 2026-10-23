# Clockwork Recruiting API Module (`@friggframework/api-module-clockwork-recruiting`)

A [Frigg](https://friggframework.org) API module for [Clockwork Recruiting](https://www.clockworkrecruiting.com) API v3 — the executive-search ATS/CRM. It wraps OAuth-connected access to people, companies, search projects, candidacies, tags, reference data, and webhook subscriptions.

```javascript
const people = await this.clockworkRecruiting.api.listPeople({ limit: 50 });
const project = await this.clockworkRecruiting.api.getProject(projectId);
```

## Authentication

**OAuth 2.0 Authorization Code** against Clockwork's central (firm-less) account host:

| | |
|---|---|
| Authorize | `https://account.clockworkrecruiting.com/oauth/authorize` |
| Token | `https://account.clockworkrecruiting.com/oauth/token` |
| Scope | `read write` |
| Resource base | `https://{firm}.clockworkrecruiting.com/api/v3` |

The firm subdomain is taken from the OAuth callback/`state` (`firm_subdomain`) or decoded from the access-token JWT (`firm_hostname`). Set `CLOCKWORK_STAGE=qa` or `local` to target non-prod hosts.

Public product docs describe per-user API keys as well; this module implements the OAuth path used for marketplace / multi-customer connects. See `.env.example`.

## Environment

| Variable | Purpose |
|---|---|
| `CLOCKWORK_OAUTH_CLIENT_ID` | OAuth client id |
| `CLOCKWORK_OAUTH_CLIENT_SECRET` | OAuth client secret |
| `CLOCKWORK_RECRUITING_REDIRECT_URI` | Dedicated redirect URI (preferred) |
| `CLOCKWORK_STAGE` | `local` \| `qa` \| `prod` (default `prod`) |

## Package layout

- `api.js` / `definition.js` / `index.js`
- `clockwork-recruiting.openapi.yaml` — curated OpenAPI (Clockwork does not publish one publicly)
- `clockwork-recruiting.capabilities.json` — capability-manifest/v0.1
- `extensions/webhooks/` — HubSpot-style Tier 3 webhook receiver
- `mappings/` — ADR-057 `business@1` Company/Contact (UNVALIDATED); no Deal mapping

## Tests

```bash
cd packages/v1-ready/clockwork-recruiting && npm test
```

Offline unit tests stub HTTP. `frigg auth test .` needs sandbox credentials (pending).

## Sources

- Product / API entry: https://api.clockworkrecruiting.com/v3.0 (full developer docs via Clockwork support)
- Support KB: https://support.clockworkrecruiting.com/category/1275-api-integrations
- Connector action reference (third-party): https://docs.stackone.com/connectors/clockwork
