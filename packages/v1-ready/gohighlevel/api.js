const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * GoHighLevel (LeadConnector) API client — Marketplace / OAuth API v2.
 *
 * Auth: OAuth 2.0 Authorization Code with Location-scoped tokens.
 *   Authorize: https://marketplace.gohighlevel.com/v2/oauth/chooselocation
 *   Token / refresh: https://services.leadconnectorhq.com/oauth/token
 *   Send user_type=Location on exchange and refresh.
 *   Refresh tokens are single-use and rotate — persist every new refresh_token.
 *
 * Base URL: https://services.leadconnectorhq.com
 * Version header: 2021-07-28 (override via GOHIGHLEVEL_API_VERSION / params.apiVersion)
 *
 * Docs:
 *   https://marketplace.gohighlevel.com/docs/
 *   https://marketplace.gohighlevel.com/docs/Authorization/Scopes
 *   https://marketplace.gohighlevel.com/docs/ghl/oauth/get-access-token
 *   https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide
 *
 * The curated contract in ./gohighlevel.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 */
const DEFAULT_BASE_URL = 'https://services.leadconnectorhq.com';
const DEFAULT_AUTHORIZE_URL =
    'https://marketplace.gohighlevel.com/v2/oauth/chooselocation';
const DEFAULT_TOKEN_URL = `${DEFAULT_BASE_URL}/oauth/token`;
const DEFAULT_API_VERSION = '2021-07-28';
const DEFAULT_SCOPE = [
    'contacts.readonly',
    'contacts.write',
    'businesses.readonly',
    'businesses.write',
    'opportunities.readonly',
    'opportunities.write',
    'locations.readonly',
    'users.readonly',
].join(' ');

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = get(params, 'baseUrl', null) || DEFAULT_BASE_URL;
        this.tokenUri =
            get(params, 'tokenUri', null) ||
            get(params, 'token_uri', null) ||
            DEFAULT_TOKEN_URL;
        this.apiVersion =
            get(params, 'apiVersion', null) ||
            process.env.GOHIGHLEVEL_API_VERSION ||
            DEFAULT_API_VERSION;

        this.client_id =
            this.client_id ||
            get(params, 'client_id', null) ||
            process.env.GOHIGHLEVEL_CLIENT_ID;
        this.client_secret =
            this.client_secret ||
            get(params, 'client_secret', null) ||
            process.env.GOHIGHLEVEL_CLIENT_SECRET;
        this.redirect_uri =
            this.redirect_uri ||
            get(params, 'redirect_uri', null) ||
            process.env.GOHIGHLEVEL_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/gohighlevel`
                : null);

        const scope =
            get(params, 'scope', null) ||
            process.env.GOHIGHLEVEL_SCOPE ||
            DEFAULT_SCOPE;
        this.scopes = String(scope)
            .split(/[\s,]+/)
            .filter(Boolean);

        // locationId is the stable tenant key for Sub-Account (Location) tokens.
        this.locationId =
            get(params, 'locationId', null) ||
            get(params, 'location_id', null) ||
            null;

        // Marketplace authorize URL. version_id (Marketplace App ID = client_id
        // prefix before the first "-") is required or chooselocation rejects with
        // "No integration found with the ID".
        const appId = (this.client_id || '').split('-')[0];
        const redirect = this.redirect_uri
            ? `&redirect_uri=${this.redirect_uri}`
            : '';
        const scopeQs = this.scopes.length
            ? `&scope=${this.scopes.join(' ')}`
            : '';
        const versionQs = appId ? `&version_id=${appId}` : '';
        this.authorizationUri = encodeURI(
            `${DEFAULT_AUTHORIZE_URL}?response_type=code&client_id=${
                this.client_id || ''
            }${redirect}${scopeQs}${versionQs}`
        );

        this.URLs = {
            contacts: '/contacts/',
            contactById: (id) => `/contacts/${id}`,
            contactDuplicate: '/contacts/search/duplicate',
            contactNotes: (contactId) => `/contacts/${contactId}/notes`,
            contactNoteById: (contactId, noteId) =>
                `/contacts/${contactId}/notes/${noteId}`,
            businesses: '/businesses',
            businessById: (id) => `/businesses/${id}`,
            opportunitiesSearch: '/opportunities/search',
            opportunities: '/opportunities',
            opportunityById: (id) => `/opportunities/${id}`,
            opportunityStatus: (id) => `/opportunities/${id}/status`,
            opportunityPipelines: '/opportunities/pipelines',
            locationById: (id) => `/locations/${id}`,
            users: '/users/',
            userById: (id) => `/users/${id}`,
        };
    }

    _headers(extra = {}) {
        return {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Version: this.apiVersion,
            ...extra,
        };
    }

    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders(headers);
        if (!next.Version) next.Version = this.apiVersion;
        if (!next.Accept) next.Accept = 'application/json';
        return next;
    }

    /**
     * GHL access tokens are JWTs; oauthMeta.scopes lists granted scopes when present.
     * Returns null when the claim cannot be read (undocumented claim).
     */
    grantedScopes() {
        if (typeof this.access_token !== 'string') return null;
        const payload = this.access_token.split('.')[1];
        if (!payload) return null;
        try {
            const claims = JSON.parse(
                Buffer.from(payload, 'base64url').toString('utf8')
            );
            const scopes = claims?.oauthMeta?.scopes;
            return Array.isArray(scopes) ? scopes : null;
        } catch {
            return null;
        }
    }

    /**
     * Exchange authorization code. Appends user_type=Location.
     * Do NOT send `scope` on the code exchange — GHL's token endpoint rejects it
     * (scope belongs to the authorize step).
     * @see https://marketplace.gohighlevel.com/docs/ghl/oauth/get-access-token
     */
    async getTokenFromCode(code) {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        if (this.redirect_uri) params.append('redirect_uri', this.redirect_uri);
        params.append('code', code);
        params.append('user_type', 'Location');
        const response = await this._post(
            {
                body: params,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                url: this.tokenUri,
            },
            false
        );
        // No fallback to this.locationId: a re-auth arrives with it already seeded
        // from the entity, and adopting it would bind an Agency-scoped token to a
        // Location credential it cannot serve.
        if (!response.locationId) {
            const { access_token, refresh_token, ...rest } = response;
            throw new Error(
                `GoHighLevel token response has no locationId — only a Sub-Account token carries one. Response: ${JSON.stringify(
                    rest
                )}`
            );
        }
        this.locationId = response.locationId;
        await this.setTokens(response);
        return response;
    }

    /**
     * Refresh access token. Appends user_type=Location.
     * Refresh tokens are single-use and rotate — persist response.refresh_token.
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('refresh_token', refreshTokenObject.refresh_token);
        if (this.redirect_uri) params.append('redirect_uri', this.redirect_uri);
        params.append('user_type', 'Location');
        const response = await this._post(
            {
                body: params,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                url: this.tokenUri,
            },
            false
        );
        this.locationId = response.locationId || this.locationId;
        await this.setTokens(response);
        return response;
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri
                ? this.getAuthorizationUri()
                : this.authorizationUri,
            type: 'oauth2',
            data: {},
        };
    }

    // ---- Identity / location / users ---------------------------------------

    /** GET /locations/{locationId} — scope: locations.readonly */
    async getLocation(locationId = this.locationId) {
        if (!locationId) {
            throw new Error('getLocation requires locationId');
        }
        return this._get({
            url: `${this.baseUrl}${this.URLs.locationById(locationId)}`,
            headers: this._headers(),
            query: {},
        });
    }

    /** GET /users/ — scope: users.readonly */
    async listUsers(params = {}) {
        const query = { ...params };
        if (this.locationId && query.locationId === undefined) {
            query.locationId = this.locationId;
        }
        return this._get({
            url: `${this.baseUrl}${this.URLs.users}`,
            headers: this._headers(),
            query,
        });
    }

    /** GET /users/{userId} — scope: users.readonly */
    async getUser(userId) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.userById(userId)}`,
            headers: this._headers(),
            query: {},
        });
    }

    // ---- Contacts ----------------------------------------------------------

    /**
     * GET /contacts/ — scope: contacts.readonly
     * Cursor pagination: startAfter (ms), startAfterId from prior page.
     */
    async listContacts(params = {}) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.contacts}`,
            headers: this._headers(),
            query: { locationId: this.locationId, ...params },
        });
    }

    /** GET /contacts/{contactId} — scope: contacts.readonly */
    async getContact(contactId) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.contactById(contactId)}`,
            headers: this._headers(),
            query: {},
        });
    }

    /** POST /contacts/ — scope: contacts.write (body must include locationId) */
    async createContact(data = {}) {
        const body = {
            locationId: this.locationId,
            ...data,
        };
        return this._post({
            url: `${this.baseUrl}${this.URLs.contacts}`,
            headers: this._headers(),
            body,
        });
    }

    /**
     * PUT /contacts/{contactId} — scope: contacts.write
     * GHL's documented update verb is PUT (not PATCH).
     */
    async updateContact(contactId, data = {}) {
        return this._put({
            url: `${this.baseUrl}${this.URLs.contactById(contactId)}`,
            headers: this._headers(),
            body: data,
        });
    }

    /**
     * GET /contacts/search/duplicate — scope: contacts.readonly
     * @see https://marketplace.gohighlevel.com/docs/ghl/contacts/get-duplicate-contact
     */
    async getDuplicateContact(params = {}) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.contactDuplicate}`,
            headers: this._headers(),
            query: { locationId: this.locationId, ...params },
        });
    }

    /** GET /contacts/{contactId}/notes — scope: contacts.readonly */
    async listContactNotes(contactId) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.contactNotes(contactId)}`,
            headers: this._headers(),
            query: {},
        });
    }

    /** POST /contacts/{contactId}/notes — scope: contacts.write */
    async createContactNote(contactId, data = {}) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.contactNotes(contactId)}`,
            headers: this._headers(),
            body: data,
        });
    }

    /** PUT /contacts/{contactId}/notes/{noteId} — scope: contacts.write */
    async updateContactNote(contactId, noteId, data = {}) {
        return this._put({
            url: `${this.baseUrl}${this.URLs.contactNoteById(
                contactId,
                noteId
            )}`,
            headers: this._headers(),
            body: data,
        });
    }

    // ---- Businesses (companies) --------------------------------------------

    /** GET /businesses — scope: businesses.readonly */
    async listBusinesses(params = {}) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.businesses}`,
            headers: this._headers(),
            query: { locationId: this.locationId, ...params },
        });
    }

    /** GET /businesses/{businessId} — scope: businesses.readonly */
    async getBusiness(businessId) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.businessById(businessId)}`,
            headers: this._headers(),
            query: {},
        });
    }

    /** POST /businesses — scope: businesses.write */
    async createBusiness(data = {}) {
        const body = {
            locationId: this.locationId,
            ...data,
        };
        return this._post({
            url: `${this.baseUrl}${this.URLs.businesses}`,
            headers: this._headers(),
            body,
        });
    }

    /** PUT /businesses/{businessId} — scope: businesses.write */
    async updateBusiness(businessId, data = {}) {
        return this._put({
            url: `${this.baseUrl}${this.URLs.businessById(businessId)}`,
            headers: this._headers(),
            body: data,
        });
    }

    // ---- Opportunities (deals) ---------------------------------------------

    /**
     * GET /opportunities/search — scope: opportunities.readonly
     * Primary list/search surface (locationId required).
     * @see https://marketplace.gohighlevel.com/docs/ghl/opportunities/search-opportunity
     */
    async searchOpportunities(params = {}) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.opportunitiesSearch}`,
            headers: this._headers(),
            query: { locationId: this.locationId, ...params },
        });
    }

    /** Alias used by capability manifest sync.list */
    async listOpportunities(params = {}) {
        return this.searchOpportunities(params);
    }

    /** GET /opportunities/{id} — scope: opportunities.readonly */
    async getOpportunity(opportunityId) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.opportunityById(opportunityId)}`,
            headers: this._headers(),
            query: {},
        });
    }

    /** POST /opportunities — scope: opportunities.write */
    async createOpportunity(data = {}) {
        const body = {
            locationId: this.locationId,
            ...data,
        };
        return this._post({
            url: `${this.baseUrl}${this.URLs.opportunities}`,
            headers: this._headers(),
            body,
        });
    }

    /** PUT /opportunities/{id} — scope: opportunities.write */
    async updateOpportunity(opportunityId, data = {}) {
        return this._put({
            url: `${this.baseUrl}${this.URLs.opportunityById(opportunityId)}`,
            headers: this._headers(),
            body: data,
        });
    }

    /** PUT /opportunities/{id}/status — scope: opportunities.write */
    async updateOpportunityStatus(opportunityId, data = {}) {
        return this._put({
            url: `${this.baseUrl}${this.URLs.opportunityStatus(opportunityId)}`,
            headers: this._headers(),
            body: data,
        });
    }

    /** GET /opportunities/pipelines — scope: opportunities.readonly */
    async listPipelines(params = {}) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.opportunityPipelines}`,
            headers: this._headers(),
            query: { locationId: this.locationId, ...params },
        });
    }

    async testAuthRequest() {
        if (this.locationId) {
            return this.getLocation(this.locationId);
        }
        return this.listContacts({ limit: 1 });
    }
}

module.exports = { Api };
