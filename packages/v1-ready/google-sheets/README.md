# @friggframework/api-module-google-sheets

Frigg v2 API module for the [Google Sheets API v4](https://developers.google.com/workspace/sheets/api/reference/rest).

## Auth

OAuth 2.0 authorization code (`OAuth2Requester`).

| Env | Purpose |
|---|---|
| `GOOGLE_SHEETS_CLIENT_ID` | OAuth client ID |
| `GOOGLE_SHEETS_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_SHEETS_SCOPE` | Space-delimited scopes (default includes `spreadsheets` + userinfo) |
| `REDIRECT_URI` | Base redirect; module appends `/google-sheets` |

## Develop

```bash
cd packages/v1-ready/google-sheets
npm install
npm test
```

## Sources

- REST reference: https://developers.google.com/workspace/sheets/api/reference/rest
- Discovery document: https://sheets.googleapis.com/$discovery/rest?version=v4
- Scopes: https://developers.google.com/workspace/sheets/api/scopes
- OAuth 2.0 for Google APIs: https://developers.google.com/identity/protocols/oauth2
