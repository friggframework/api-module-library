const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Google Sheets API v4 client (OAuth 2.0).
 *
 * Auth: Bearer access token from Google's authorization-code OAuth flow.
 * Authorize: https://accounts.google.com/o/oauth2/v2/auth
 * Token: https://oauth2.googleapis.com/token
 * API base: https://sheets.googleapis.com/v4
 *
 * Identity uses Google OAuth2 userinfo (not part of the Sheets discovery
 * document): GET https://www.googleapis.com/oauth2/v2/userinfo
 *
 * Official sources:
 *   https://developers.google.com/workspace/sheets/api/reference/rest
 *   https://sheets.googleapis.com/$discovery/rest?version=v4
 *   https://developers.google.com/workspace/sheets/api/scopes
 *   https://developers.google.com/identity/protocols/oauth2
 *
 * The curated machine-readable contract lives in ./google-sheets.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 * getUserDetails is identity-only and intentionally outside that Sheets subset.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://sheets.googleapis.com/v4';
        this.userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        const defaultScope = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
        ].join(' ');

        this.scope =
            this.scope || process.env.GOOGLE_SHEETS_SCOPE || defaultScope;

        const authParams = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            scope: this.scope,
            access_type: 'offline',
            include_granted_scopes: 'true',
            prompt: 'consent',
        });
        if (this.state) authParams.set('state', this.state);

        this.authorizationUri = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;
        this.tokenUri = 'https://oauth2.googleapis.com/token';

        this.URLs = {
            spreadsheets: '/spreadsheets',
            spreadsheetById: (spreadsheetId) =>
                `/spreadsheets/${encodeURIComponent(spreadsheetId)}`,
            spreadsheetBatchUpdate: (spreadsheetId) =>
                `/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
            valuesByRange: (spreadsheetId, range) =>
                `/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}/values/${encodeURIComponent(range)}`,
            valuesAppend: (spreadsheetId, range) =>
                `/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}/values/${encodeURIComponent(range)}:append`,
            valuesClear: (spreadsheetId, range) =>
                `/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}/values/${encodeURIComponent(range)}:clear`,
            valuesBatchGet: (spreadsheetId) =>
                `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet`,
            valuesBatchUpdate: (spreadsheetId) =>
                `/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}/values:batchUpdate`,
            sheetCopyTo: (spreadsheetId, sheetId) =>
                `/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}/sheets/${encodeURIComponent(sheetId)}:copyTo`,
        };
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    /**
     * Build a query string. Supports scalar params and array params serialized
     * as repeated keys (Google Sheets `ranges` on batchGet). The core
     * Requester's built-in query builder can't emit repeated keys.
     */
    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const v of value) {
                    if (v === undefined || v === null) continue;
                    usp.append(key, String(v));
                }
            } else if (typeof value === 'boolean') {
                usp.append(key, value ? 'true' : 'false');
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    addJsonHeaders(options) {
        options.headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
        };
    }

    async _post(options, stringify) {
        const url = options.url ? String(options.url) : '';
        if (url && !url.includes('oauth2.googleapis.com')) {
            this.addJsonHeaders(options);
        }
        return super._post(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // ---- Identity (OAuth2 userinfo; not Sheets discovery) -------------------

    /**
     * Get the authenticated Google user.
     * GET https://www.googleapis.com/oauth2/v2/userinfo
     * Requires userinfo.email / userinfo.profile (or openid) scopes.
     * Response includes id, email, name, picture, etc.
     */
    async getUserDetails() {
        return this._get({
            url: this.userInfoUrl,
        });
    }

    // ---- Spreadsheets ------------------------------------------------------

    /**
     * Create a spreadsheet.
     * POST /v4/spreadsheets
     * Discovery id: sheets.spreadsheets.create
     * Body: Spreadsheet resource (optional properties, sheets, namedRanges…).
     */
    async createSpreadsheet(data = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.spreadsheets,
            body: data,
        });
    }

    /**
     * Returns the spreadsheet at the given ID.
     * GET /v4/spreadsheets/{spreadsheetId}
     * Discovery id: sheets.spreadsheets.get
     * Optional query: ranges, includeGridData, fields
     */
    async getSpreadsheet(spreadsheetId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.spreadsheetById(spreadsheetId) +
                this._buildQuery(params),
        });
    }

    /**
     * Applies one or more updates to the spreadsheet.
     * POST /v4/spreadsheets/{spreadsheetId}:batchUpdate
     * Discovery id: sheets.spreadsheets.batchUpdate
     * Body: { requests: [...], includeSpreadsheetInResponse?, ... }
     */
    async batchUpdateSpreadsheet(spreadsheetId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.spreadsheetBatchUpdate(spreadsheetId),
            body: data,
        });
    }

    // ---- Values ------------------------------------------------------------

    /**
     * Returns a range of values from a spreadsheet.
     * GET /v4/spreadsheets/{spreadsheetId}/values/{range}
     * Discovery id: sheets.spreadsheets.values.get
     * Optional query: majorDimension, valueRenderOption, dateTimeRenderOption
     */
    async getValues(spreadsheetId, range, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.valuesByRange(spreadsheetId, range) +
                this._buildQuery(params),
        });
    }

    /**
     * Sets values in a range of a spreadsheet.
     * PUT /v4/spreadsheets/{spreadsheetId}/values/{range}
     * Discovery id: sheets.spreadsheets.values.update
     * Required query: valueInputOption (RAW | USER_ENTERED)
     * Body: ValueRange { range?, majorDimension?, values }
     */
    async updateValues(spreadsheetId, range, data, params = {}) {
        return this._put({
            url:
                this.baseUrl +
                this.URLs.valuesByRange(spreadsheetId, range) +
                this._buildQuery(params),
            body: data,
        });
    }

    /**
     * Appends values to a spreadsheet.
     * POST /v4/spreadsheets/{spreadsheetId}/values/{range}:append
     * Discovery id: sheets.spreadsheets.values.append
     * Required query: valueInputOption
     * Body: ValueRange
     */
    async appendValues(spreadsheetId, range, data, params = {}) {
        return this._post({
            url:
                this.baseUrl +
                this.URLs.valuesAppend(spreadsheetId, range) +
                this._buildQuery(params),
            body: data,
        });
    }

    /**
     * Clears values from a spreadsheet.
     * POST /v4/spreadsheets/{spreadsheetId}/values/{range}:clear
     * Discovery id: sheets.spreadsheets.values.clear
     * Body may be empty {}.
     */
    async clearValues(spreadsheetId, range, data = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.valuesClear(spreadsheetId, range),
            body: data,
        });
    }

    /**
     * Returns one or more ranges of values from a spreadsheet.
     * GET /v4/spreadsheets/{spreadsheetId}/values:batchGet
     * Discovery id: sheets.spreadsheets.values.batchGet
     * Query: ranges (repeated), majorDimension, valueRenderOption,
     *        dateTimeRenderOption
     */
    async batchGetValues(spreadsheetId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.valuesBatchGet(spreadsheetId) +
                this._buildQuery(params),
        });
    }

    /**
     * Sets values in one or more ranges of a spreadsheet.
     * POST /v4/spreadsheets/{spreadsheetId}/values:batchUpdate
     * Discovery id: sheets.spreadsheets.values.batchUpdate
     * Body: { valueInputOption, data: [ValueRange], ... }
     */
    async batchUpdateValues(spreadsheetId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.valuesBatchUpdate(spreadsheetId),
            body: data,
        });
    }

    // ---- Sheets ------------------------------------------------------------

    /**
     * Copies a single sheet from a spreadsheet to another spreadsheet.
     * POST /v4/spreadsheets/{spreadsheetId}/sheets/{sheetId}:copyTo
     * Discovery id: sheets.spreadsheets.sheets.copyTo
     * Body: { destinationSpreadsheetId }
     */
    async copySheetTo(spreadsheetId, sheetId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.sheetCopyTo(spreadsheetId, sheetId),
            body: data,
        });
    }
}

module.exports = { Api };
