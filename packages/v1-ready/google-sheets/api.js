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

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);

        this.baseUrl = 'https://sheets.googleapis.com';
        this.userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';

        this.URLs = {
            spreadsheets: '/v4/spreadsheets',
            spreadsheetById: (spreadsheetId) =>
                `/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`,
            values: (spreadsheetId, range) =>
                `/v4/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}/values/${encodeURIComponent(range)}`,
            valuesAppend: (spreadsheetId, range) =>
                `/v4/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}/values/${encodeURIComponent(range)}:append`,
            valuesClear: (spreadsheetId, range) =>
                `/v4/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}/values/${encodeURIComponent(range)}:clear`,
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
        const query = {};
        if (ranges) query.ranges = ranges;
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

    async batchGetValues(
        spreadsheetId,
        ranges,
        { valueRenderOption = 'UNFORMATTED_VALUE', dateTimeRenderOption } = {}
    ) {
        const query = { ranges, valueRenderOption };
        if (dateTimeRenderOption)
            query.dateTimeRenderOption = dateTimeRenderOption;
        return this._get({
            url: this.baseUrl + this.URLs.valuesBatchGet(spreadsheetId),
            query,
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

module.exports = { Api, buildRange, quoteSheetName };
