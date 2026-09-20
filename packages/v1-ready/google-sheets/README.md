# Google Sheets

The API Module for Google Sheets, letting [Frigg](https://friggframework.org) read
and write spreadsheets on a user's behalf.

Sheets pairs naturally with
[`@friggframework/api-module-google-drive`](../google-drive): **this module has no
way to find a spreadsheet.** The Sheets API addresses documents by id and offers no
list or search endpoint. Use Drive to locate the file, then Sheets to read it.

## Install

```bash
npm install @friggframework/api-module-google-sheets
```

## Credentials

A Google Cloud project with the **Google Sheets API** enabled, and an OAuth 2.0
Client ID of type _Web application_ whose authorised redirect URI is
`{REDIRECT_URI}/google-sheets`.

```bash
GOOGLE_SHEETS_CLIENT_ID=...
GOOGLE_SHEETS_CLIENT_SECRET=...
GOOGLE_SHEETS_SCOPE="openid email https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file"
REDIRECT_URI=https://your-app.example.com/redirect
```

### Which scopes, and what they cost

| Scope                            | Grants                                              | Google's tier     |
| -------------------------------- | --------------------------------------------------- | ----------------- |
| `openid`, `email`                | The account id this module keys credentials on      | Non-sensitive     |
| `.../auth/drive.file`            | Only files the user opened or picked for your app   | **Non-sensitive** |
| `.../auth/spreadsheets`          | Read and write every spreadsheet the user can reach | Sensitive         |
| `.../auth/spreadsheets.readonly` | Read every spreadsheet                              | Sensitive         |

`openid email` are not optional here. The Sheets API has no "who am I" endpoint, so
identity comes from `oauth2/v2/userinfo`; without them there is no stable external
id to key a credential on and every reconnection looks like a new account.

Prefer **`drive.file` alone** where the user picks the file: it is non-sensitive, so
it needs no verification at all, and it is the narrowest thing that works. Reach for
`spreadsheets` only when your app must open documents the user never picked. Both
Sensitive scopes are free but require Google verification (a few days); no scope
here is _Restricted_, so none of them triggers a CASA security assessment.

## Use

```js
const { Api, buildRange } = require('@friggframework/api-module-google-sheets');

const api = new Api({ access_token, refresh_token, client_id, client_secret });

// Find out what is in the workbook without downloading every cell.
const sheets = await api.listSheets(spreadsheetId);
// -> [{ sheetId: 0, title: '🚫 Issues List', index: 0, ... }, ...]

// Read. buildRange handles the quoting that tab names with spaces need.
const { values } = await api.getValues(
    spreadsheetId,
    buildRange('🚫 Issues List', 'B4:B41')
);

// Write.
await api.updateValues(spreadsheetId, buildRange('🚫 Issues List', 'B4:B5'), [
    ['Dishwasher'],
    ['Car insurance renewal'],
]);

// Several ranges, one round trip and one revision bump.
await api.batchUpdateValues(spreadsheetId, [
    {
        range: buildRange('Quarterly Goals', 'C2:C5'),
        values: [[1], [2], [3], [4]],
    },
    {
        range: buildRange('Health Score', 'A2:G2'),
        values: [['2026-09-20', 'Walk', 1, 1, 1, 0, 0]],
    },
]);
```

### Methods

| Method                                                  | What it does                                          |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `getUserDetails()` / `getTokenIdentity()`               | The connected Google account                          |
| `getSpreadsheet(id, {ranges, includeGridData, fields})` | Metadata, optionally cells                            |
| `listSheets(id)`                                        | Tab properties only — the cheap way to map a workbook |
| `createSpreadsheet(body)`                               | New spreadsheet                                       |
| `getValues(id, range, opts)`                            | One range                                             |
| `batchGetValues(id, ranges, opts)`                      | Several ranges, one request                           |
| `updateValues(id, range, values, opts)`                 | Overwrite a range                                     |
| `batchUpdateValues(id, data, opts)`                     | Several ranges, one request                           |
| `appendValues(id, range, values, opts)`                 | Append after the last row of a table                  |
| `clearValues(id, range)`                                | Clear values; formatting and notes survive            |
| `batchUpdate(id, requests, opts)`                       | Structural changes                                    |
| `addSheet(id, properties)` / `deleteSheet(id, sheetId)` | Add or remove a tab                                   |

## Defaults that differ from Google's, deliberately

Three of this module's defaults are **not** the API's own. Each was chosen because
the API default fails quietly rather than loudly.

-   **`valueRenderOption` is `UNFORMATTED_VALUE`** (Google: `FORMATTED_VALUE`). The
    API default returns locale-formatted _strings_, so `1000` comes back as `"1,000"`
    and a date as `"9/20/2026"`. Read-modify-write with that default changes the type
    of every cell it touches. Pass `'FORMULA'` to read formulas rather than results.
-   **`valueInputOption` is `RAW`** (Google: none — a write without it is a 400). With
    `USER_ENTERED`, text beginning `=` becomes a live formula and `1/2` becomes a
    date. A sync writing back what a person typed must not reinterpret it. Pass
    `'USER_ENTERED'` when you _want_ parsing.
-   **`insertDataOption` is `INSERT_ROWS`** on append (Google: `OVERWRITE`). The API
    default writes over whatever follows the table, which on a sheet with a second
    block below the first is silent data loss.

## Other things worth knowing

-   **Trailing empty cells are truncated, and an empty range omits `values`
    entirely.** A 10-row read can return 3 rows, or no `values` key at all. This
    module passes the response through unchanged — padding a ragged grid is the
    caller's decision, and guessing here would hide the difference between "empty"
    and "absent".
-   **Tab names need quoting in A1 notation**, and an apostrophe inside one is
    escaped by doubling it. `buildRange` and `quoteSheetName` do both. Skipping it
    does not always error — an unquoted name can address a _different_ sheet.
-   **`refresh_token` is issued only on first consent.** `getAuthorizationUri` sends
    `access_type=offline&prompt=consent` so it is always returned; `OAuth2Requester`
    keeps the stored one when a refresh response omits it.
-   **The granted `scope` is persisted** on the credential. Google honours
    incremental auth, so a user can return with fewer scopes than were asked for, and
    this is the only evidence of it.

## Test the auth flow without deploying

```bash
frigg auth test .          # opens the browser, captures and saves tokens
frigg auth list            # what is saved
frigg auth get google-sheets --export
```

## Tests

```bash
npm test
```

They assert on the **request** — URL, query, body — rather than on a mocked
response, because no assertion about a stubbed return value can catch a call
asking Google for the wrong thing.
