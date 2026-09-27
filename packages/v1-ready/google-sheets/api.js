const { get, OAuth2Requester } = require('@friggframework/core');

/**
 * Quote a sheet (tab) name for use in an A1 range.
 *
 * Google requires quoting for anything that isn't a bare alphanumeric name, and
 * the Family Framework style of tab name — spaces, emoji, punctuation — is
 * exactly the case that breaks unquoted. A literal apostrophe is escaped by
 * doubling it, per the A1 grammar.
 */
function quoteSheetName(sheetName) {
    return `'${String(sheetName).replace(/'/g, "''")}'`;
}

/**
 * Build an A1 range string from a tab and an optional range within it.
 * `buildRange('Issues List', 'B4:B41')` -> `'Issues List'!B4:B41`
 * `buildRange('Issues List')`           -> `'Issues List'`  (the whole tab)
 */
function buildRange(sheetName, a1 = null) {
    const quoted = quoteSheetName(sheetName);
    return a1 ? `${quoted}!${a1}` : quoted;
}

/**
 * A `#` or `?` inside a range (a tab titled "Kids #2" or "Why?", both real
 * Family Framework tab names) is NOT escaped by the single `encodeURI(url)`
 * pass this module deliberately relies on (see the `values` URL builder
 * below): encodeURI treats both as structurally significant — `#` starts a
 * fragment, `?` starts a query string — and leaves them literal, which
 * truncates the request at `#` or splits a path range into a bogus query
 * string at `?`. Percent-encode ONLY these two characters here, before the
 * range reaches encodeURI: encodeURI leaves an existing `%xx` escape alone,
 * so `%23`/`%3F` survive its later pass untouched, while every other
 * character (`'`, `!`, `:`, space) is still left for THAT pass to escape,
 * exactly as before — this does not reintroduce the double-encoding bug the
 * surrounding comment warns about.
 */
function escapeRangeForUrl(range) {
    return String(range).replace(/#/g, '%23').replace(/\?/g, '%3F');
}

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);

        this.baseUrl = 'https://sheets.googleapis.com';
        this.userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';

        this.URLs = {
            spreadsheets: '/v4/spreadsheets',
            spreadsheetById: (spreadsheetId) =>
                `/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`,
            // NOT encodeURIComponent(range) — @friggframework/core's Requester
            // (_rawRequest) runs `encodeURI(url)` over the WHOLE url exactly
            // once, unconditionally, on every request. A range already
            // percent-encoded here gets its `%` re-escaped to `%25` by that
            // pass, so `'Issues List'!B4:B41` (correctly encodeURIComponent'd
            // to `'Issues%20List'!B4%3AB41`) went out on the wire as
            // `'Issues%2520List'!B4%253AB41` — a 400 from Google on any tab
            // name with a space, and on every range at all (the colon is
            // encoded too). The raw range interpolated here is exactly what
            // `encodeURI` needs to see to do the (correct, one-time) escaping
            // itself: it leaves `'`, `!` and `:` alone (Google expects those
            // literal in an A1 range) and escapes a space to %20, which is
            // the one thing `getValues`'s own tests below actually exercise
            // end to end via the real Requester (see tests/wire.test.js).
            values: (spreadsheetId, range) =>
                `/v4/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}/values/${escapeRangeForUrl(range)}`,
            valuesAppend: (spreadsheetId, range) =>
                `/v4/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}/values/${escapeRangeForUrl(range)}:append`,
            valuesClear: (spreadsheetId, range) =>
                `/v4/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}/values/${escapeRangeForUrl(range)}:clear`,
            valuesBatchGet: (spreadsheetId) =>
                `/v4/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}/values:batchGet`,
            valuesBatchUpdate: (spreadsheetId) =>
                `/v4/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}/values:batchUpdate`,
            batchUpdate: (spreadsheetId) =>
                `/v4/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}:batchUpdate`,
        };

        this.tokenUri = 'https://oauth2.googleapis.com/token';

        /* eslint-disable camelcase */
        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        /* eslint-enable camelcase */
    }

    setState(state) {
        this.state = state;
    }

    getAuthorizationUri() {
        return encodeURI(
            `https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&scope=${this.scope}&access_type=offline&include_granted_scopes=true&state=${this.state}&prompt=consent`
        );
    }

    // --- identity -----------------------------------------------------------

    /**
     * The Sheets API has no "who am I" endpoint, so identity comes from the
     * OpenID userinfo endpoint. This is why `openid` and `email` belong in the
     * default scope string — without them there is no stable external id to
     * key a credential on.
     */
    async getUserDetails() {
        return this._get({ url: this.userInfoUrl });
    }

    async getTokenIdentity() {
        const userInfo = await this.getUserDetails();
        return { identifier: userInfo.id, name: userInfo.email };
    }

    // --- spreadsheets -------------------------------------------------------

    /**
     * Metadata for a spreadsheet. `ranges` may be passed to limit which sheets
     * come back; `includeGridData` pulls cell data and is expensive — leave it
     * false and use getValues unless you need formatting.
     */
    async getSpreadsheet(
        spreadsheetId,
        { ranges, includeGridData, fields } = {}
    ) {
        // `ranges` needs the same repeated-key treatment as batchGetValues
        // below: core's Requester query serializer has no array support (an
        // array value is stringified into one comma-joined `ranges=A,B`,
        // which Google reads as a single unmatched range), and it needs the
        // same `#`/`?` escaping `values`/`valuesAppend`/`valuesClear` do — so
        // this builds its own query string, exactly like batchGetValues,
        // rather than handing an array to `options.query`.
        if (ranges) {
            const list = Array.isArray(ranges) ? ranges : [ranges];
            const parts = list.map((r) => `ranges=${escapeRangeForUrl(r)}`);
            if (includeGridData !== undefined)
                parts.push(`includeGridData=${includeGridData}`);
            if (fields) parts.push(`fields=${encodeURIComponent(fields)}`);
            return this._get({
                url: `${this.baseUrl}${this.URLs.spreadsheetById(
                    spreadsheetId
                )}?${parts.join('&')}`,
            });
        }
        const query = {};
        if (includeGridData !== undefined)
            query.includeGridData = includeGridData;
        if (fields) query.fields = fields;
        return this._get({
            url: this.baseUrl + this.URLs.spreadsheetById(spreadsheetId),
            query,
        });
    }

    /**
     * Just the tab names and ids, without dragging every cell across the wire.
     * This is the call to use when mapping a workbook you did not create.
     */
    async listSheets(spreadsheetId) {
        const response = await this.getSpreadsheet(spreadsheetId, {
            fields: 'sheets.properties',
        });
        return (response.sheets || []).map((sheet) => sheet.properties);
    }

    async createSpreadsheet(body) {
        return this._post({
            url: this.baseUrl + this.URLs.spreadsheets,
            body,
        });
    }

    /**
     * Every tab's cell VALUES and FORMULAS together, in ONE call, via
     * `spreadsheets.get(includeGridData=true)` — scoped by `fields` to just
     * title + the two cell properties that matter, so this stays cheap next
     * to the full-fidelity warning on `getSpreadsheet`. This is the one
     * Sheets endpoint that returns both a cell's value and its formula
     * together: reading both any other way costs a values call (this
     * module's own `UNFORMATTED_VALUE` default) PLUS a second call in
     * `FORMULA` render mode — and that second call is genuinely ambiguous,
     * because FORMULA mode echoes a non-formula cell's own value back with
     * nothing to mark it as "not a formula" (see `toFormulaGrid` below, for
     * a caller stuck making that second call anyway).
     *
     * `userEnteredValue.formulaValue` has no ambiguity problem: Google sets
     * that key ONLY on an actual formula cell, so "no `formulaValue`" simply
     * means "not a formula" — nothing to guess. `effectiveValue` is what a
     * formula cell evaluated to, or a literal cell's own value either way —
     * the includeGridData equivalent of `getValues`' UNFORMATTED_VALUE.
     *
     * Returns `[{ title, grid, formulas }]`, one entry per sheet, sheet
     * order preserved, an empty spreadsheet's row/col holes read as `[]`
     * rather than throwing — same "never guess into shape" posture as the
     * rest of this module, just with nothing left needing a guess.
     */
    async getSheetsWithGridData(spreadsheetId) {
        const res = await this._get({
            url: this.baseUrl + this.URLs.spreadsheetById(spreadsheetId),
            query: {
                includeGridData: true,
                fields: 'sheets(properties.title,data.rowData.values(userEnteredValue,effectiveValue))',
            },
        });
        return (res.sheets ?? []).map((sheet) => {
            const rows = sheet.data?.[0]?.rowData ?? [];
            const grid = [];
            const formulas = [];
            for (const row of rows) {
                const cells = row.values ?? [];
                grid.push(cells.map((cell) => extractExtendedValue(cell?.effectiveValue)));
                formulas.push(
                    cells.map((cell) => cell?.userEnteredValue?.formulaValue ?? null)
                );
            }
            return { title: sheet.properties.title, grid, formulas };
        });
    }

    // --- values -------------------------------------------------------------

    /**
     * Read a range.
     *
     * `valueRenderOption` defaults to UNFORMATTED_VALUE rather than Google's
     * own FORMATTED_VALUE default: the API default returns locale-formatted
     * STRINGS, so a number read and written back can change type and a date can
     * change shape. Anything doing a round trip wants the unformatted value.
     * Pass 'FORMULA' to read formulas instead of their results.
     *
     * Google truncates trailing empty rows and columns, and omits `values`
     * entirely for an empty range. The response is passed through as-is —
     * padding a ragged grid is a decision for the caller, not this module.
     */
    async getValues(
        spreadsheetId,
        range,
        {
            valueRenderOption = 'UNFORMATTED_VALUE',
            dateTimeRenderOption,
            majorDimension,
        } = {}
    ) {
        const query = { valueRenderOption };
        if (dateTimeRenderOption)
            query.dateTimeRenderOption = dateTimeRenderOption;
        if (majorDimension) query.majorDimension = majorDimension;
        return this._get({
            url: this.baseUrl + this.URLs.values(spreadsheetId, range),
            query,
        });
    }

    /**
     * `options.query` (core's Requester) serializes every key with exactly
     * one `encodeURIComponent` pass and no array support — an array value is
     * coerced to a string first, so `{ ranges: ["'A'", "'B'"] }` went out as
     * one comma-joined `ranges=%27A%27%2C%27B%27`, which Google reads as a
     * single (unmatched) range rather than two. Google's own API wants the
     * key REPEATED (`ranges=A&ranges=B`). There is no way to ask core's
     * query mechanism for that, so this builds the query string itself and
     * puts it straight on the url — `_rawRequest`'s single `encodeURI(url)`
     * pass still does the one correct escape over the whole thing (see the
     * `values`/`valuesAppend`/`valuesClear` URL builders above for the same
     * reasoning applied to a single range in the path instead of the query).
     */
    async batchGetValues(
        spreadsheetId,
        ranges,
        { valueRenderOption = 'UNFORMATTED_VALUE', dateTimeRenderOption } = {}
    ) {
        const parts = ranges.map((r) => `ranges=${escapeRangeForUrl(r)}`);
        parts.push(`valueRenderOption=${valueRenderOption}`);
        if (dateTimeRenderOption)
            parts.push(`dateTimeRenderOption=${dateTimeRenderOption}`);
        return this._get({
            url: `${this.baseUrl}${this.URLs.valuesBatchGet(
                spreadsheetId
            )}?${parts.join('&')}`,
        });
    }

    /**
     * Overwrite a range.
     *
     * `valueInputOption` is required by the API — a PUT without it is a 400 —
     * so it is explicit here rather than left to a default. RAW stores exactly
     * what you send; USER_ENTERED parses it the way typing it would, which
     * turns "=A1" into a formula and "1/2" into a date. RAW is the default
     * because a sync writing user content should not have it reinterpreted.
     */
    async updateValues(
        spreadsheetId,
        range,
        values,
        {
            valueInputOption = 'RAW',
            includeValuesInResponse,
            majorDimension,
        } = {}
    ) {
        const query = { valueInputOption };
        if (includeValuesInResponse !== undefined) {
            query.includeValuesInResponse = includeValuesInResponse;
        }
        const body = { range, values };
        if (majorDimension) body.majorDimension = majorDimension;
        return this._put({
            url: this.baseUrl + this.URLs.values(spreadsheetId, range),
            query,
            body,
        });
    }

    /** Several ranges in one request — one round trip, one revision bump. */
    async batchUpdateValues(
        spreadsheetId,
        data,
        { valueInputOption = 'RAW' } = {}
    ) {
        return this._post({
            url: this.baseUrl + this.URLs.valuesBatchUpdate(spreadsheetId),
            body: { valueInputOption, data },
        });
    }

    /**
     * Append after the last row of the table containing `range`.
     * `insertDataOption` defaults to INSERT_ROWS: Google's own default
     * (OVERWRITE) writes over whatever follows the table, which is data loss on
     * any sheet that has a second block below the first.
     */
    async appendValues(
        spreadsheetId,
        range,
        values,
        { valueInputOption = 'RAW', insertDataOption = 'INSERT_ROWS' } = {}
    ) {
        return this._post({
            url: this.baseUrl + this.URLs.valuesAppend(spreadsheetId, range),
            query: { valueInputOption, insertDataOption },
            body: { range, values },
        });
    }

    /** Clear values only. Formatting, validation and notes survive. */
    async clearValues(spreadsheetId, range) {
        return this._post({
            url: this.baseUrl + this.URLs.valuesClear(spreadsheetId, range),
            body: {},
        });
    }

    // --- structure ----------------------------------------------------------

    /** Structural changes: add/delete/rename sheets, formatting, filters. */
    async batchUpdate(spreadsheetId, requests, options = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.batchUpdate(spreadsheetId),
            body: { requests, ...options },
        });
    }

    async addSheet(spreadsheetId, properties) {
        return this.batchUpdate(spreadsheetId, [{ addSheet: { properties } }]);
    }

    async deleteSheet(spreadsheetId, sheetId) {
        return this.batchUpdate(spreadsheetId, [{ deleteSheet: { sheetId } }]);
    }
}

/**
 * A Sheets `ExtendedValue` (`{numberValue|stringValue|boolValue|formulaValue|
 * errorValue}`, at most one key present) reduced to the plain scalar
 * `getValues` would have handed back. `errorValue` has no scalar to carry —
 * the cell errored, not "empty" — so it reads as null rather than inventing
 * a value Google never returned.
 */
function extractExtendedValue(extendedValue) {
    if (!extendedValue) return null;
    if ('numberValue' in extendedValue) return extendedValue.numberValue;
    if ('stringValue' in extendedValue) return extendedValue.stringValue;
    if ('boolValue' in extendedValue) return extendedValue.boolValue;
    return null;
}

/**
 * Clean up a `getValues(..., { valueRenderOption: 'FORMULA' })` grid.
 *
 * Google's FORMULA render mode has no separate "is this a formula" marker —
 * a non-formula cell's own value comes back unchanged (`"Groceries"`, `42`,
 * `true`), indistinguishable on the wire from a formula cell except by
 * looking at the value itself. So the only safe rule is: a value that is
 * itself a string starting with `=` is a formula; anything else (a number, a
 * boolean, a plain string, null) is not one and becomes null. A raw
 * pass-through of this response is not a `FormulaGrid` — it is Google's
 * literal values dressed up as formulas, which is exactly the shape a
 * downstream cell policy (deciding whether a cell may be overwritten) would
 * misread as "this cell holds a formula" for ordinary data.
 */
function toFormulaGrid(rows) {
    return rows.map((row) =>
        row.map((cell) => (typeof cell === 'string' && cell.startsWith('=') ? cell : null))
    );
}

module.exports = { Api, buildRange, quoteSheetName, toFormulaGrid };
