const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Google multi-API OAuth2 client (Gmail, Calendar, Drive, Docs, Sheets,
 * Analytics, Search Console, Ads) under one consent.
 *
 * Auth: Bearer access token from Google's authorization-code OAuth flow.
 *   Authorize: https://accounts.google.com/o/oauth2/v2/auth
 *   Token:     https://oauth2.googleapis.com/token
 *   Userinfo:  https://openidconnect.googleapis.com/v1/userinfo
 *
 * Default API host (`baseUrl`) is https://www.googleapis.com. Named proxy
 * bases (docs, sheets, analytics*, googleads, searchconsole) live on their
 * own hosts — callers pick a base by name, never by free-form host.
 *
 * Official sources:
 *   https://developers.google.com/identity/protocols/oauth2/web-server
 *   https://developers.google.com/identity/protocols/oauth2/scopes
 *   https://developers.google.com/identity/openid-connect/openid-connect
 *   https://developers.google.com/gmail/api/reference/rest
 *   https://developers.google.com/calendar/api/v3/reference
 *   https://developers.google.com/drive/api/reference/rest/v3
 *   https://developers.google.com/docs/api/reference/rest
 *   https://developers.google.com/sheets/api/reference/rest
 *   https://developers.google.com/analytics/devguides/reporting/data/v1/rest
 *   https://developers.google.com/analytics/devguides/config/admin/v1/rest
 *   https://developers.google.com/webmaster-tools/v1/api_reference_index
 *   https://developers.google.com/google-ads/api/rest/auth
 *
 * The curated machine-readable contract lives in ./google.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 * getUserInfo is identity-only (OpenID Connect host) and intentionally
 * outside the www.googleapis.com server entry.
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL =
    'https://openidconnect.googleapis.com/v1/userinfo';

/**
 * Named base URLs for multi-host Google APIs. Gmail (/gmail/v1), Calendar
 * (/calendar/v3), Drive (/drive/v3), and Search Console Webmasters
 * (/webmasters/v3) are served from `default`. Other products live on their
 * own hosts.
 */
const GOOGLE_PROXY_BASE_URLS = {
    default: 'https://www.googleapis.com',
    docs: 'https://docs.googleapis.com',
    sheets: 'https://sheets.googleapis.com',
    analyticsdata: 'https://analyticsdata.googleapis.com',
    analyticsadmin: 'https://analyticsadmin.googleapis.com',
    googleads: 'https://googleads.googleapis.com',
    searchconsole: 'https://searchconsole.googleapis.com',
};

/** Host that may receive the optional Ads developer-token header. */
const GOOGLE_ADS_HOST = 'googleads.googleapis.com';

/** Google Ads REST API version pinned to the current discovery document. */
const GOOGLE_ADS_API_VERSION = 'v26';

/**
 * Default scopes for one consent covering the products this module wraps.
 * `openid email profile` supply the stable account identity (`sub`, email).
 * Official list: https://developers.google.com/identity/protocols/oauth2/scopes
 */
const DEFAULT_GOOGLE_SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/adwords',
];

const DEFAULT_GOOGLE_SCOPE = DEFAULT_GOOGLE_SCOPES.join(' ');

class Api extends OAuth2Requester {
    static requesterType = 'oauth2';

    constructor(params = {}) {
        super({
            ...params,
            client_id: get(params, 'client_id', process.env.GOOGLE_CLIENT_ID),
            client_secret: get(
                params,
                'client_secret',
                process.env.GOOGLE_CLIENT_SECRET
            ),
            redirect_uri: get(params, 'redirect_uri', null),
            scope: get(params, 'scope', DEFAULT_GOOGLE_SCOPE),
        });

        this.baseUrl = GOOGLE_PROXY_BASE_URLS.default;
        this.userInfoUrl = GOOGLE_USERINFO_URL;
        this.tokenUri = GOOGLE_TOKEN_URL;
        this.proxyBaseUrls = { ...GOOGLE_PROXY_BASE_URLS };
        this.adsApiVersion = GOOGLE_ADS_API_VERSION;

        // Ads developer token is an app secret (not per-user). Optional /
        // ignored by Ads servers after the 2026-09-09 sunset; still sent when
        // configured for older clients.
        this.developer_token =
            params.developer_token ??
            process.env.GOOGLE_ADS_DEVELOPER_TOKEN ??
            null;

        this.access_token = get(params, 'access_token', this.access_token);
        this.refresh_token = get(params, 'refresh_token', this.refresh_token);

        this.URLs = {
            // Gmail
            gmailMessages: (userId = 'me') =>
                `/gmail/v1/users/${encodeURIComponent(userId)}/messages`,
            gmailMessage: (userId, id) =>
                `/gmail/v1/users/${encodeURIComponent(
                    userId
                )}/messages/${encodeURIComponent(id)}`,
            gmailLabels: (userId = 'me') =>
                `/gmail/v1/users/${encodeURIComponent(userId)}/labels`,
            gmailWatch: (userId = 'me') =>
                `/gmail/v1/users/${encodeURIComponent(userId)}/watch`,
            // Calendar
            calendarList: '/calendar/v3/users/me/calendarList',
            calendarEvents: (calendarId) =>
                `/calendar/v3/calendars/${encodeURIComponent(
                    calendarId
                )}/events`,
            calendarEvent: (calendarId, eventId) =>
                `/calendar/v3/calendars/${encodeURIComponent(
                    calendarId
                )}/events/${encodeURIComponent(eventId)}`,
            calendarEventsWatch: (calendarId) =>
                `/calendar/v3/calendars/${encodeURIComponent(
                    calendarId
                )}/events/watch`,
            // Drive
            driveFiles: '/drive/v3/files',
            driveFile: (fileId) =>
                `/drive/v3/files/${encodeURIComponent(fileId)}`,
            driveChanges: '/drive/v3/changes',
            driveChangesStartPageToken: '/drive/v3/changes/startPageToken',
            driveChangesWatch: '/drive/v3/changes/watch',
            channelsStop: '/calendar/v3/channels/stop',
            // Docs (docs.googleapis.com)
            docsDocuments: '/v1/documents',
            docsDocument: (documentId) =>
                `/v1/documents/${encodeURIComponent(documentId)}`,
            docsBatchUpdate: (documentId) =>
                `/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
            // Sheets (sheets.googleapis.com)
            sheetsSpreadsheets: '/v4/spreadsheets',
            sheetsSpreadsheet: (spreadsheetId) =>
                `/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`,
            sheetsBatchUpdate: (spreadsheetId) =>
                `/v4/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}:batchUpdate`,
            sheetsValues: (spreadsheetId, range) =>
                `/v4/spreadsheets/${encodeURIComponent(
                    spreadsheetId
                )}/values/${encodeURIComponent(range)}`,
            // Analytics Admin / Data
            analyticsAccounts: '/v1beta/accounts',
            // property resource name is `properties/{id}` (slash must remain).
            analyticsRunReport: (propertyId) => {
                const raw = String(propertyId);
                const prop = raw.startsWith('properties/')
                    ? raw
                    : `properties/${encodeURIComponent(raw)}`;
                return `/v1beta/${prop}:runReport`;
            },
            // Search Console (webmasters on www)
            searchConsoleSites: '/webmasters/v3/sites',
            searchConsoleSearchAnalytics: (siteUrl) =>
                `/webmasters/v3/sites/${encodeURIComponent(
                    siteUrl
                )}/searchAnalytics/query`,
            // Google Ads
            adsListAccessibleCustomers: `/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`,
            adsSearch: (customerId) =>
                `/${GOOGLE_ADS_API_VERSION}/customers/${encodeURIComponent(
                    customerId
                )}/googleAds:search`,
        };
    }

    getAuthorizationUri() {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            scope: this.scope,
            access_type: 'offline',
            prompt: 'consent',
            include_granted_scopes: 'true',
            state: this.state || '',
        });
        return `${GOOGLE_AUTH_URL}?${params.toString()}`;
    }

    getAuthUri() {
        return this.getAuthorizationUri();
    }

    getAuthorizationRequirements() {
        return { url: this.getAuthorizationUri(), type: 'oauth2' };
    }

    /**
     * Resolve a named proxy base (ADR-052-style). Unknown names fall back to
     * `default` (www.googleapis.com).
     */
    resolveBaseUrl(baseName = 'default') {
        return (
            this.proxyBaseUrls[baseName] || this.proxyBaseUrls.default
        );
    }

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

    async addAuthHeaders(headers) {
        const withAuth = { ...headers };
        if (this.access_token) {
            withAuth.Authorization = `Bearer ${this.access_token}`;
        }
        return withAuth;
    }

    async _request(url, options = {}, attempt = 0) {
        let host;
        try {
            host = new URL(url).hostname;
        } catch {
            host = null;
        }
        if (host === GOOGLE_ADS_HOST && this.developer_token) {
            options = {
                ...options,
                headers: {
                    ...options.headers,
                    'developer-token': this.developer_token,
                },
            };
        }
        return super._request(url, options, attempt);
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

    async _patch(options, stringify) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    // ---- Identity (OpenID Connect; outside www.googleapis.com) -------------

    /**
     * OpenID Connect userinfo.
     * GET https://openidconnect.googleapis.com/v1/userinfo
     * Response: { sub, email, email_verified, name, picture, ... }
     */
    async getUserInfo() {
        return this._get({ url: this.userInfoUrl });
    }

    // ---- Gmail -------------------------------------------------------------

    /**
     * List messages.
     * GET /gmail/v1/users/{userId}/messages
     */
    async listMessages(userId = 'me', params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.gmailMessages(userId) +
                this._buildQuery(params),
        });
    }

    /**
     * Get a message.
     * GET /gmail/v1/users/{userId}/messages/{id}
     */
    async getMessage(userId, id, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.gmailMessage(userId, id) +
                this._buildQuery(params),
        });
    }

    /**
     * List labels.
     * GET /gmail/v1/users/{userId}/labels
     */
    async listLabels(userId = 'me') {
        return this._get({
            url: this.baseUrl + this.URLs.gmailLabels(userId),
        });
    }

    /**
     * Start Gmail push notifications (Cloud Pub/Sub).
     * POST /gmail/v1/users/{userId}/watch
     * Body: { topicName, labelIds?, labelFilterBehavior? }
     */
    async watchMailbox(userId = 'me', data) {
        return this._post({
            url: this.baseUrl + this.URLs.gmailWatch(userId),
            body: data,
        });
    }

    // ---- Calendar ----------------------------------------------------------

    /**
     * List calendars on the user's calendar list.
     * GET /calendar/v3/users/me/calendarList
     */
    async listCalendars(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.calendarList + this._buildQuery(params),
        });
    }

    /**
     * List events on a calendar.
     * GET /calendar/v3/calendars/{calendarId}/events
     */
    async listEvents(calendarId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.calendarEvents(calendarId) +
                this._buildQuery(params),
        });
    }

    /**
     * Get an event.
     * GET /calendar/v3/calendars/{calendarId}/events/{eventId}
     */
    async getEvent(calendarId, eventId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.calendarEvent(calendarId, eventId) +
                this._buildQuery(params),
        });
    }

    /**
     * Create an event.
     * POST /calendar/v3/calendars/{calendarId}/events
     */
    async createEvent(calendarId, data, params = {}) {
        return this._post({
            url:
                this.baseUrl +
                this.URLs.calendarEvents(calendarId) +
                this._buildQuery(params),
            body: data,
        });
    }

    /**
     * Update an event (full replace).
     * PUT /calendar/v3/calendars/{calendarId}/events/{eventId}
     */
    async updateEvent(calendarId, eventId, data, params = {}) {
        return this._put({
            url:
                this.baseUrl +
                this.URLs.calendarEvent(calendarId, eventId) +
                this._buildQuery(params),
            body: data,
        });
    }

    /**
     * Delete an event.
     * DELETE /calendar/v3/calendars/{calendarId}/events/{eventId}
     */
    async deleteEvent(calendarId, eventId, params = {}) {
        return this._delete({
            url:
                this.baseUrl +
                this.URLs.calendarEvent(calendarId, eventId) +
                this._buildQuery(params),
        });
    }

    /**
     * Watch for changes to events on a calendar (HTTPS channel).
     * POST /calendar/v3/calendars/{calendarId}/events/watch
     * Body: { id, type: 'web_hook', address, token?, expiration? }
     */
    async watchEvents(calendarId, data, params = {}) {
        return this._post({
            url:
                this.baseUrl +
                this.URLs.calendarEventsWatch(calendarId) +
                this._buildQuery(params),
            body: data,
        });
    }

    /**
     * Stop a push notification channel (Calendar / Drive shared shape).
     * POST /calendar/v3/channels/stop
     * Body: { id, resourceId }
     */
    async stopChannel(data) {
        return this._post({
            url: this.baseUrl + this.URLs.channelsStop,
            body: data,
        });
    }

    // ---- Drive -------------------------------------------------------------

    /**
     * List files.
     * GET /drive/v3/files
     */
    async listFiles(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.driveFiles + this._buildQuery(params),
        });
    }

    /**
     * Get a file's metadata.
     * GET /drive/v3/files/{fileId}
     */
    async getFile(fileId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.driveFile(fileId) +
                this._buildQuery(params),
        });
    }

    /**
     * Create a file (metadata-only; media upload uses /upload/drive/v3).
     * POST /drive/v3/files
     */
    async createFile(data, params = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.driveFiles + this._buildQuery(params),
            body: data,
        });
    }

    /**
     * Update file metadata.
     * PATCH /drive/v3/files/{fileId}
     */
    async updateFile(fileId, data, params = {}) {
        return this._patch({
            url:
                this.baseUrl +
                this.URLs.driveFile(fileId) +
                this._buildQuery(params),
            body: data,
        });
    }

    /**
     * Get the starting pageToken for listing changes.
     * GET /drive/v3/changes/startPageToken
     */
    async getChangesStartPageToken(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.driveChangesStartPageToken +
                this._buildQuery(params),
        });
    }

    /**
     * List changes for a user.
     * GET /drive/v3/changes
     */
    async listChanges(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.driveChanges +
                this._buildQuery(params),
        });
    }

    /**
     * Watch for changes to a user's Drive.
     * POST /drive/v3/changes/watch
     * Body: Channel { id, type: 'web_hook', address, ... }; query: pageToken
     */
    async watchChanges(data, params = {}) {
        return this._post({
            url:
                this.baseUrl +
                this.URLs.driveChangesWatch +
                this._buildQuery(params),
            body: data,
        });
    }

    // ---- Docs (docs.googleapis.com) ----------------------------------------

    /**
     * Create a document.
     * POST https://docs.googleapis.com/v1/documents
     */
    async createDocument(data = {}) {
        return this._post({
            url: this.resolveBaseUrl('docs') + this.URLs.docsDocuments,
            body: data,
        });
    }

    /**
     * Get a document.
     * GET https://docs.googleapis.com/v1/documents/{documentId}
     */
    async getDocument(documentId, params = {}) {
        return this._get({
            url:
                this.resolveBaseUrl('docs') +
                this.URLs.docsDocument(documentId) +
                this._buildQuery(params),
        });
    }

    /**
     * Apply updates to a document.
     * POST https://docs.googleapis.com/v1/documents/{documentId}:batchUpdate
     */
    async batchUpdateDocument(documentId, data) {
        return this._post({
            url:
                this.resolveBaseUrl('docs') +
                this.URLs.docsBatchUpdate(documentId),
            body: data,
        });
    }

    // ---- Sheets (sheets.googleapis.com) ------------------------------------

    /**
     * Create a spreadsheet.
     * POST https://sheets.googleapis.com/v4/spreadsheets
     */
    async createSpreadsheet(data = {}) {
        return this._post({
            url:
                this.resolveBaseUrl('sheets') + this.URLs.sheetsSpreadsheets,
            body: data,
        });
    }

    /**
     * Get a spreadsheet.
     * GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}
     */
    async getSpreadsheet(spreadsheetId, params = {}) {
        return this._get({
            url:
                this.resolveBaseUrl('sheets') +
                this.URLs.sheetsSpreadsheet(spreadsheetId) +
                this._buildQuery(params),
        });
    }

    /**
     * Apply one or more updates to a spreadsheet.
     * POST .../spreadsheets/{spreadsheetId}:batchUpdate
     */
    async batchUpdateSpreadsheet(spreadsheetId, data) {
        return this._post({
            url:
                this.resolveBaseUrl('sheets') +
                this.URLs.sheetsBatchUpdate(spreadsheetId),
            body: data,
        });
    }

    /**
     * Get values from a range.
     * GET .../spreadsheets/{spreadsheetId}/values/{range}
     */
    async getValues(spreadsheetId, range, params = {}) {
        return this._get({
            url:
                this.resolveBaseUrl('sheets') +
                this.URLs.sheetsValues(spreadsheetId, range) +
                this._buildQuery(params),
        });
    }

    /**
     * Update values in a range.
     * PUT .../spreadsheets/{spreadsheetId}/values/{range}
     */
    async updateValues(spreadsheetId, range, data, params = {}) {
        return this._put({
            url:
                this.resolveBaseUrl('sheets') +
                this.URLs.sheetsValues(spreadsheetId, range) +
                this._buildQuery(params),
            body: data,
        });
    }

    // ---- Analytics ---------------------------------------------------------

    /**
     * List Analytics Admin accounts.
     * GET https://analyticsadmin.googleapis.com/v1beta/accounts
     */
    async listAnalyticsAccounts(params = {}) {
        return this._get({
            url:
                this.resolveBaseUrl('analyticsadmin') +
                this.URLs.analyticsAccounts +
                this._buildQuery(params),
        });
    }

    /**
     * Run a Google Analytics Data API report.
     * POST https://analyticsdata.googleapis.com/v1beta/properties/{property}:runReport
     */
    async runReport(propertyId, data) {
        return this._post({
            url:
                this.resolveBaseUrl('analyticsdata') +
                this.URLs.analyticsRunReport(propertyId),
            body: data,
        });
    }

    // ---- Search Console ----------------------------------------------------

    /**
     * List Search Console sites.
     * GET /webmasters/v3/sites
     */
    async listSites() {
        return this._get({
            url: this.baseUrl + this.URLs.searchConsoleSites,
        });
    }

    /**
     * Query Search Analytics.
     * POST /webmasters/v3/sites/{siteUrl}/searchAnalytics/query
     */
    async querySearchAnalytics(siteUrl, data) {
        return this._post({
            url:
                this.baseUrl + this.URLs.searchConsoleSearchAnalytics(siteUrl),
            body: data,
        });
    }

    // ---- Google Ads --------------------------------------------------------

    /**
     * List customers accessible to the authenticated user.
     * GET https://googleads.googleapis.com/v26/customers:listAccessibleCustomers
     */
    async listAccessibleCustomers() {
        return this._get({
            url:
                this.resolveBaseUrl('googleads') +
                this.URLs.adsListAccessibleCustomers,
        });
    }

    /**
     * Search Google Ads (GAQL).
     * POST https://googleads.googleapis.com/v26/customers/{customerId}/googleAds:search
     * Body: { query, pageToken?, pageSize? }
     * Optional header: login-customer-id (manager account).
     */
    async searchGoogleAds(customerId, data, headers = {}) {
        return this._post({
            url:
                this.resolveBaseUrl('googleads') +
                this.URLs.adsSearch(customerId),
            body: data,
            headers,
        });
    }
}

module.exports = {
    Api,
    DEFAULT_GOOGLE_SCOPES,
    DEFAULT_GOOGLE_SCOPE,
    GOOGLE_PROXY_BASE_URLS,
    GOOGLE_ADS_HOST,
    GOOGLE_ADS_API_VERSION,
};
