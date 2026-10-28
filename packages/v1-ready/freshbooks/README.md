# FreshBooks API Module (`@friggframework/api-module-freshbooks`)

A [Frigg](https://friggframework.org) API module for the [FreshBooks API](https://www.freshbooks.com/api/start): OAuth 2.0, identity, clients, invoices, payments and webhook callbacks.

```javascript
const { Definition } = require('@friggframework/api-module-freshbooks');

const { clients, pages } = await this.freshbooks.api.listClients(accountId);
```

## Environment

| Variable                   | Purpose                                                         |
| -------------------------- | --------------------------------------------------------------- |
| `FRESHBOOKS_CLIENT_ID`     | OAuth client id                                                 |
| `FRESHBOOKS_CLIENT_SECRET` | OAuth client secret                                             |
| `REDIRECT_URI`             | Base redirect URI; the module uses `${REDIRECT_URI}/freshbooks` |

Scopes are configured on the FreshBooks app, not sent on the authorize URL.

## Authentication

-   Authorize: `https://auth.freshbooks.com/oauth/authorize/`
-   Token: `POST https://api.freshbooks.com/auth/oauth/token` with a JSON body
-   Every request sends `Api-Version: alpha`.
-   **Authorization codes and refresh tokens are single-use, and refresh tokens rotate.** Token requests are sent exactly once and never retried, even on a 401, 429, 5xx or network error; a 401 on a token request does not start a refresh. A retry after a lost 2xx would re-send a grant FreshBooks already consumed and invalidate the connection. Non-token requests keep core's backoff retries.

## Entity and credential

-   **Entity** is keyed by the FreshBooks business `account_id` (`identifiers.externalId`), with the business name in `details.name`. A user with several businesses must pass `account_id` on the auth callback; the module throws with the choices instead of picking one.
-   **Credential** is keyed by the FreshBooks user id and persists `access_token`, `refresh_token` and `freshbooksUserId`, so a refresh does not need a `users/me` call.

## API methods

Every accounting method takes the business `accountId` first.

| Method                                              | HTTP                                                         |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `getUserDetails()`                                  | `GET /auth/api/v1/users/me`                                  |
| `listClients(accountId, { page, perPage })`         | `GET /accounting/account/{id}/users/clients`                 |
| `getClient(accountId, clientId)`                    | `GET .../users/clients/{clientId}`                           |
| `findClientsByEmail(accountId, email)`              | `GET .../users/clients?search[email]=`                       |
| `createClient(accountId, client)`                   | `POST .../users/clients`                                     |
| `updateClient(accountId, clientId, client)`         | `PUT .../users/clients/{clientId}`                           |
| `getInvoice(accountId, invoiceId)`                  | `GET /accounting/account/{id}/invoices/invoices/{invoiceId}` |
| `listClientInvoices(accountId, clientId, perPage)`  | `GET .../invoices/invoices?search[customerid]=`              |
| `getPayment(accountId, paymentId)`                  | `GET /accounting/account/{id}/payments/payments/{paymentId}` |
| `listClientPayments(accountId, clientId, perPage)`  | `GET .../payments/payments?search[clientid]=`                |
| `listCallbacks(accountId, { page, perPage })`       | `GET /events/account/{id}/events/callbacks`                  |
| `getCallback(accountId, callbackId)`                | `GET .../events/callbacks/{callbackId}`                      |
| `createCallback(accountId, { event, uri })`         | `POST .../events/callbacks`                                  |
| `verifyCallback(accountId, callbackId, verifier)`   | `PUT .../events/callbacks/{callbackId}`                      |
| `resendCallbackVerification(accountId, callbackId)` | `PUT .../events/callbacks/{callbackId}`                      |
| `deleteCallback(accountId, callbackId)`             | `DELETE .../events/callbacks/{callbackId}`                   |

Helpers: `webUrls.client(id)`, `webUrls.invoice(accountId, invoiceId)` and `webUrls.invoices(search)` build FreshBooks web app links; `invoiceStatusName(status)` maps a numeric invoice status to its name.

## Tests

```bash
npm test
```

HTTP is mocked with `nock`; no FreshBooks credentials are needed.
