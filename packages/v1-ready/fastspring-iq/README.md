# FastSpring IQ API Module (`@friggframework/api-module-fastspring-iq`)

A [Frigg](https://friggframework.org) API module for [FastSpring IQ](https://iq.fastspring.com)
— interactive quotes (CPQ). It wraps the FastSpring IQ REST API so a Frigg
integration can manage quotes, companies, contacts, activities, templates,
published quotes, and webhook subscriptions.

```javascript
const org = await this['fastspring-iq'].api.getMyOrganization();
const quotes = await this['fastspring-iq'].api.listQuotes({
    includes: 'summary,company',
});
```

## Authentication

FastSpring IQ uses **API-key** authentication. Send the key on every request as
the `api_key` header:

```bash
curl https://api-iq.fastspring.com/my-organization -H "api_key: YOUR_API_KEY"
```

- **Base URL:** `https://api-iq.fastspring.com`
- **Docs:** [FastSpring IQ API (v1.8.12) Postman collection](https://documenter.getpostman.com/view/5578104/T1DjkKg1)
- Rotate keys via `POST /auth/rotatekey`.

This module is **not** the FastSpring commerce API (`https://api.fastspring.com`,
HTTP Basic).

Set `FASTSPRING_IQ_API_KEY` in your environment (see `.env.example`).

## Sources

- Official Postman collection: https://documenter.getpostman.com/view/5578104/T1DjkKg1
- Interactive quotes product docs: https://fastspring.com/docs/create-and-send-an-interactive-quote/

## API surface

See `fastspring-iq.openapi.yaml` (one `operationId` per `Api` method) and
`fastspring-iq.capabilities.json` for the capability manifest.

Core objects: organization (identity), quotes, companies, contacts, activities,
webhooks (subscription CRUD), plus templates and published quotes.

## Fenestra

No `fastspring-iq.fenestra.yaml`. FastSpring IQ does not expose a documented
in-app UI extension / marketplace UI surface for third-party cards or panels
(unlike HubSpot UI extensions). Webhook delivery is REST-managed only.

## Tests

```bash
cd packages/v1-ready/fastspring-iq && npm test
```

Offline unit tests stub HTTP; live `frigg auth test` needs sandbox credentials.
