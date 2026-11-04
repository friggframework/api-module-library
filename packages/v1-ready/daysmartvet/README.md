# `@friggframework/api-module-daysmartvet`

Frigg v2 API module for [DaySmart Vet](https://www.daysmartvet.com/) (formerly Vetter) — veterinary practice management.

## Auth

OAuth 2.0 **client credentials** against the published DaySmart Vet API:

| | |
|---|---|
| Token | `POST {domain}/oauth/access_token` |
| Grant | `client_credentials` |
| Scope | `APIService` |
| REST auth | `Authorization: Bearer <token>` + `x-api-key: <client_secret>` |
| Clinic key | Path segment `/api/1.0.0/{apiKey}/…` |

| Environment | Domain |
|---|---|
| Production | `https://ulimfxq67h.execute-api.us-west-2.amazonaws.com/api` |
| Sandbox | `https://ulimfxq67h.execute-api.us-west-2.amazonaws.com/sandbox` |

Official docs: https://sandbox.vettersoftware.com/docs/

## Env

```bash
DAYSMARTVET_CLIENT_ID=
DAYSMARTVET_CLIENT_SECRET=
DAYSMARTVET_API_KEY=          # clinic API key used in REST paths
DAYSMARTVET_ENVIRONMENT=production   # or sandbox
```

## Covered objects

Clinic identity, clients (CRUD minus delete), patients (CRUD minus delete), appointments (CRUD minus delete), invoices (list/get), payments (list), payment types, species, breeds.

## Develop

```bash
cd packages/v1-ready/daysmartvet
npm install
npm test
```
