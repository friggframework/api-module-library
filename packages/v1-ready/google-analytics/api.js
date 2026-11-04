const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Google Analytics Data API (v1beta) client.
 *
 * Auth: OAuth 2.0 authorization-code. Tokens are sent as
 *   Authorization: Bearer <access_token>
 *
 * Authorize: https://accounts.google.com/o/oauth2/v2/auth
 * Token:     https://oauth2.googleapis.com/token
 * Base URL:  https://analyticsdata.googleapis.com/v1beta
 *
 * Default scope: https://www.googleapis.com/auth/analytics.readonly
 * (also accepts https://www.googleapis.com/auth/analytics)
 *
 * Official docs / discovery:
 *   https://developers.google.com/analytics/devguides/reporting/data/v1/rest
 *   https://analyticsdata.googleapis.com/$discovery/rest?version=v1beta
 *
 * The curated contract lives in ./google-analytics.openapi.yaml — this
 * client mirrors it 1:1 (one method per operationId). Keep them in sync.
 *
 * Ported from Left Hook-owned module code (generic Api surface only);
 * client-specific coupling stripped.
 */
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GA_API_URL = 'https://analyticsdata.googleapis.com/v1beta';
const DEFAULT_SCOPE =
    'https://www.googleapis.com/auth/analytics.readonly';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

class Api extends OAuth2Requester {
    static requesterType = 'oauth2';

    constructor(params = {}) {
        const clientId =
            get(params, 'client_id', null) ||
            process.env.GOOGLE_ANALYTICS_CLIENT_ID;
        const clientSecret =
            get(params, 'client_secret', null) ||
            process.env.GOOGLE_ANALYTICS_CLIENT_SECRET;
        const redirectUri =
            get(params, 'redirect_uri', null) ||
            process.env.GOOGLE_ANALYTICS_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/google-analytics`
                : null);
        const scope =
            get(params, 'scope', null) ||
            process.env.GOOGLE_ANALYTICS_SCOPE ||
            DEFAULT_SCOPE;

        super({
            ...params,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            scope,
        });

        this.baseUrl = GA_API_URL;
        this.tokenUri = GOOGLE_TOKEN_URL;
        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.URLs = {
            runReport: (propertyId) =>
                `/properties/${propertyId}:runReport`,
            batchRunReports: (propertyId) =>
                `/properties/${propertyId}:batchRunReports`,
            metadata: (propertyId) => `/properties/${propertyId}/metadata`,
        };
    }

    getAuthorizationUri() {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            scope: this.scope || DEFAULT_SCOPE,
            access_type: 'offline',
            prompt: 'consent',
            state: this.state || '',
        });
        this.authorizationUri = `${GOOGLE_AUTH_URL}?${params.toString()}`;
        return this.authorizationUri;
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
        };
    }

    async addAuthHeaders(headers = {}) {
        const next = { ...headers };
        if (this.access_token) {
            next.Authorization = `Bearer ${this.access_token}`;
        }
        if (!next['Content-Type']) {
            next['Content-Type'] = 'application/json';
        }
        return next;
    }

    /**
     * Normalize a property id to the bare numeric (or string) id used in
     * path segments. Accepts `1234`, `properties/1234`, or a full resource
     * name; strips a leading `properties/` if present.
     */
    _propertyId(propertyId) {
        if (propertyId === 0 || propertyId === '0') return '0';
        const s = String(propertyId || '').replace(/^properties\//, '');
        return s;
    }

    // ---- Identity (Google OAuth userinfo; not part of Data API) ------------

    /**
     * GET https://www.googleapis.com/oauth2/v2/userinfo
     * Requires an OpenID / userinfo scope on the token (see .env.example).
     * Used for entity/credential identity — Data API has no /me endpoint.
     */
    async getUserDetails() {
        return this._get({ url: USERINFO_URL });
    }

    async getTokenIdentity() {
        const user = await this.getUserDetails();
        return {
            identifier: user.id || user.email,
            name: user.name || user.email || user.id,
            email: user.email,
        };
    }

    // ---- Reports -----------------------------------------------------------

    /**
     * POST /v1beta/properties/{property}:runReport
     * https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
     */
    async runReport(propertyId, reportRequest = {}) {
        const id = this._propertyId(propertyId);
        return this._post({
            url: this.baseUrl + this.URLs.runReport(id),
            body: reportRequest,
        });
    }

    /**
     * POST /v1beta/properties/{property}:batchRunReports
     * Body: { requests: RunReportRequest[] } (max 5).
     * https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/batchRunReports
     */
    async batchRunReports(propertyId, requests = []) {
        const id = this._propertyId(propertyId);
        return this._post({
            url: this.baseUrl + this.URLs.batchRunReports(id),
            body: { requests },
        });
    }

    // ---- Metadata ----------------------------------------------------------

    /**
     * GET /v1beta/properties/{property}/metadata
     * Property id `0` returns universal dimensions/metrics (no custom).
     * https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/getMetadata
     */
    async getMetadata(propertyId) {
        const id = this._propertyId(propertyId);
        return this._get({
            url: this.baseUrl + this.URLs.metadata(id),
        });
    }

    /**
     * Lightweight auth probe using universal metadata (property id 0),
     * which the official docs document as valid for common dimensions/metrics.
     */
    async testAuth() {
        return this.getMetadata('0');
    }
}

module.exports = { Api };
