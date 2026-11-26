# Dentrix Ascend API Module (`@friggframework/api-module-dentrixascend`)

A [Frigg](https://friggframework.org) API module for **Dentrix Ascend** — Henry Schein One's cloud dental practice management platform — via the published **Ascend Public API**.

## Authentication

OAuth 2.0 **client credentials** (server-to-server). There is no browser authorization-code redirect on the Public API.

```bash
curl --data "client_id=xxx&client_secret=xxx" \
  "https://prod.hs1api.com/oauth/client_credential/accesstoken?grant_type=client_credentials"
```

Every Public API request then needs:

- `Authorization: Bearer <access_token>`
- `Organization-ID: <org id>`

Discover org ids with `GET https://prod.hs1api.com/orgmapper/LinkedOrgs`.

| Variable | Purpose |
|---|---|
| `DENTRIX_ASCEND_CLIENT_ID` | OAuth client id |
| `DENTRIX_ASCEND_CLIENT_SECRET` | OAuth client secret |
| `DENTRIX_ASCEND_ORGANIZATION_ID` | Default `Organization-ID` header |
| `DENTRIX_ASCEND_BASE_URL` | Optional; default `https://prod.hs1api.com/ascend-gateway/api` |
| `DENTRIX_ASCEND_API_HOST` | Optional; default `https://prod.hs1api.com` (token + OrgMapper) |

Sandbox: use `https://test.hs1api.com` hosts.

## Sources

- [API Consumer Guide](https://papidocs.hs1api.com/publicapi/api-consumer-guide)
- [API Specification (OpenAPI download)](https://papidocs.hs1api.com/publicapi/apispec)
- [StreamAPI webhooks](https://papidocs.hs1api.com/publicapi/apispec) (SNS; register URL via support ticket)

## API methods (curated)

Identity, locations, providers, patients (list/get/create/update), appointments (incl. delete), ledger transactions + patient payments (read), insurance claims, fee schedules, patient procedures, statements, patient insurance plans. See `dentrixascend.openapi.yaml` and `api.js`.

## Webhooks / Fenestra / mappings

- **Webhooks:** StreamAPI delivers CREATE/UPDATE/DELETE over Amazon SNS. There is **no public REST** to create/list/delete subscriptions — open a support ticket with your HTTPS URL. This package does not ship `extensions/webhooks/` receivers yet.
- **Fenestra:** Ascend does not publish partner UI extension points (no iframe/custom-page SDK comparable to Marketplace Custom Pages). No `.fenestra.yaml`.
- **ADR-057 mappings:** Not included. Dental PMS patients/ledger/claims do not cleanly map onto `business@1` Company/Contact/Deal (or support@1 / billing@1 without inventing fit). Revisit if a dental-domain canonical schema is adopted.

## Tests

```bash
cd packages/v1-ready/dentrixascend && npm test
```
