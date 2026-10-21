const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Close CRM (api.close.com) API client — REST API v1.
 *
 * Auth (two official methods):
 *   1. OAuth 2.0 Authorization Code — Bearer access token
 *      Authorize: https://app.close.com/oauth2/authorize/
 *      Token:     https://api.close.com/oauth2/token/
 *      Scopes:    all.full_access offline_access (granted to all OAuth apps)
 *   2. API key — HTTP Basic with the key as username and an empty password
 *
 * Base URL: https://api.close.com/api/v1
 *
 * Docs: https://developer.close.com/
 * Official OpenAPI (experimental): https://api.close.com/api/openapi.json
 *
 * The curated contract in ./close.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 */
const DEFAULT_BASE_URL = 'https://api.close.com/api/v1';
const DEFAULT_AUTHORIZE_URL = 'https://app.close.com/oauth2/authorize/';
const DEFAULT_TOKEN_URL = 'https://api.close.com/oauth2/token/';
const DEFAULT_SCOPE = 'all.full_access offline_access';

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = get(params, 'base_url', null) || DEFAULT_BASE_URL;
        this.tokenUri =
            get(params, 'tokenUri', null) ||
            get(params, 'token_uri', null) ||
            DEFAULT_TOKEN_URL;
        this.scope =
            get(params, 'scope', null) ||
            process.env.CLOSE_SCOPE ||
            DEFAULT_SCOPE;

        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'apiKey', null) ||
            null;

        this.organization_id =
            get(params, 'organization_id', null) ||
            get(params, 'organizationId', null) ||
            null;

        // Build authorize URL (Close docs: client_id + response_type=code;
        // redirect_uri included when set — required by most OAuth hosts).
        const clientId = this.client_id || '';
        const redirect = this.redirect_uri
            ? `&redirect_uri=${encodeURIComponent(this.redirect_uri)}`
            : '';
        const scopeQs = this.scope
            ? `&scope=${encodeURIComponent(this.scope)}`
            : '';
        this.authorizationUri = encodeURI(
            `${DEFAULT_AUTHORIZE_URL}?client_id=${clientId}&response_type=code${redirect}${scopeQs}`
        );

        this.URLs = {
            me: '/me/',
            users: '/user/',
            userById: (id) => `/user/${id}/`,
            leads: '/lead/',
            leadById: (id) => `/lead/${id}/`,
            contacts: '/contact/',
            contactById: (id) => `/contact/${id}/`,
            opportunities: '/opportunity/',
            opportunityById: (id) => `/opportunity/${id}/`,
            activities: '/activity/',
            calls: '/activity/call/',
            callById: (id) => `/activity/call/${id}/`,
            emails: '/activity/email/',
            emailById: (id) => `/activity/email/${id}/`,
            notes: '/activity/note/',
            noteById: (id) => `/activity/note/${id}/`,
            customFieldsLead: '/custom_field/lead/',
            customFieldsContact: '/custom_field/contact/',
            customFieldsOpportunity: '/custom_field/opportunity/',
            customFieldSchema: (objectType) =>
                `/custom_field_schema/${objectType}/`,
            webhooks: '/webhook/',
            webhookById: (id) => `/webhook/${id}/`,
        };
    }

    setApiKey(apiKey) {
        this.api_key = apiKey;
    }

    /**
     * Prefer OAuth Bearer when an access_token is present; otherwise HTTP Basic
     * with the API key as username and an empty password (official Close docs).
     */
    async addAuthHeaders(headers = {}) {
        const next = { ...headers };
        delete next.Authorization;
        if (this.access_token) {
            next.Authorization = `Bearer ${this.access_token}`;
        } else if (this.api_key) {
            next.Authorization = `Basic ${Buffer.from(
                `${this.api_key}:`
            ).toString('base64')}`;
        }
        if (!next['Content-Type'] && !next['content-type']) {
            next['Content-Type'] = 'application/json';
        }
        return next;
    }

    isAuthenticated() {
        return Boolean(
            (this.access_token && String(this.access_token).length > 0) ||
                (this.api_key && String(this.api_key).length > 0)
        );
    }

    /**
     * Close token exchange (docs): form body with client_id, client_secret,
     * grant_type=authorization_code, code — no redirect_uri/scope required.
     * @see https://developer.close.com/api/overview/oauth-authentication.md
     */
    async getTokenFromCode(code) {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('code', code);
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
        await this.setTokens(response);
        if (response && response.organization_id) {
            this.organization_id = response.organization_id;
        }
        return response;
    }

    /**
     * Close refresh (docs): form body with client_id, client_secret,
     * grant_type=refresh_token, refresh_token. Close rotates refresh tokens.
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('refresh_token', refreshTokenObject.refresh_token);
        const response = await this._post(
            {
                body: params,
                url: this.tokenUri,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            },
            false
        );
        await this.setTokens(response);
        if (response && response.organization_id) {
            this.organization_id = response.organization_id;
        }
        return response;
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
            data: {
                jsonSchema: {
                    title: 'Close CRM Authentication',
                    type: 'object',
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'API Key (alternate)',
                            description:
                                'Optional alternate to OAuth. Settings → Developer → API Keys. Sent as HTTP Basic username with an empty password.',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Use OAuth for multi-customer installs. API key is for scripts / internal tools.',
                    },
                },
            },
        };
    }

    // ---- Query helpers -----------------------------------------------------

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params || {})) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const v of value) {
                    if (v === undefined || v === null) continue;
                    usp.append(key, String(v));
                }
            } else if (typeof value === 'object') {
                usp.append(key, JSON.stringify(value));
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    _url(path, query) {
        return this.baseUrl + path + this._buildQuery(query);
    }

    // ---- Identity / users --------------------------------------------------

    /** GET /me/ — official operationId: users_get_me */
    async getMe(params = {}) {
        return this._get({ url: this._url(this.URLs.me, params) });
    }

    /** GET /user/ — official operationId: users_list */
    async listUsers(params = {}) {
        return this._get({ url: this._url(this.URLs.users, params) });
    }

    /** GET /user/{id}/ — official operationId: users_get */
    async getUser(id, params = {}) {
        return this._get({ url: this._url(this.URLs.userById(id), params) });
    }

    // ---- Leads -------------------------------------------------------------

    /** GET /lead/ — official operationId: leads_list */
    async listLeads(params = {}) {
        return this._get({ url: this._url(this.URLs.leads, params) });
    }

    /** GET /lead/{id}/ — official operationId: leads_get */
    async getLead(id, params = {}) {
        return this._get({ url: this._url(this.URLs.leadById(id), params) });
    }

    /** POST /lead/ — official operationId: leads_create */
    async createLead(body) {
        return this._post({
            url: this.baseUrl + this.URLs.leads,
            body,
        });
    }

    /** PUT /lead/{id}/ — official operationId: leads_update (partial update) */
    async updateLead(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.leadById(id),
            body,
        });
    }

    // ---- Contacts ----------------------------------------------------------

    /** GET /contact/ — official operationId: contacts_list */
    async listContacts(params = {}) {
        return this._get({ url: this._url(this.URLs.contacts, params) });
    }

    /** GET /contact/{id}/ — official operationId: contacts_get */
    async getContact(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.contactById(id), params),
        });
    }

    /** POST /contact/ — official operationId: contacts_create */
    async createContact(body) {
        return this._post({
            url: this.baseUrl + this.URLs.contacts,
            body,
        });
    }

    /** PUT /contact/{id}/ — official operationId: contacts_update */
    async updateContact(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.contactById(id),
            body,
        });
    }

    // ---- Opportunities -----------------------------------------------------

    /** GET /opportunity/ — official operationId: opportunities_list */
    async listOpportunities(params = {}) {
        return this._get({
            url: this._url(this.URLs.opportunities, params),
        });
    }

    /** GET /opportunity/{id}/ — official operationId: opportunities_get */
    async getOpportunity(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.opportunityById(id), params),
        });
    }

    /** POST /opportunity/ — official operationId: opportunities_create */
    async createOpportunity(body) {
        return this._post({
            url: this.baseUrl + this.URLs.opportunities,
            body,
        });
    }

    /** PUT /opportunity/{id}/ — official operationId: opportunities_update */
    async updateOpportunity(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.opportunityById(id),
            body,
        });
    }

    // ---- Activities --------------------------------------------------------

    /** GET /activity/ — official operationId: activities_list */
    async listActivities(params = {}) {
        return this._get({ url: this._url(this.URLs.activities, params) });
    }

    /** GET /activity/call/ — official operationId: activities.calls_list */
    async listCalls(params = {}) {
        return this._get({ url: this._url(this.URLs.calls, params) });
    }

    /** GET /activity/call/{id}/ — official operationId: activities.calls_get */
    async getCall(id, params = {}) {
        return this._get({ url: this._url(this.URLs.callById(id), params) });
    }

    /** POST /activity/call/ — official operationId: activities.calls_create */
    async createCall(body) {
        return this._post({
            url: this.baseUrl + this.URLs.calls,
            body,
        });
    }

    /** GET /activity/email/ — official operationId: activities.emails_list */
    async listEmails(params = {}) {
        return this._get({ url: this._url(this.URLs.emails, params) });
    }

    /** GET /activity/email/{id}/ — official operationId: activities.emails_get */
    async getEmail(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.emailById(id), params),
        });
    }

    /** GET /activity/note/ — official operationId: activities.notes_list */
    async listNotes(params = {}) {
        return this._get({ url: this._url(this.URLs.notes, params) });
    }

    /** GET /activity/note/{id}/ — official operationId: activities.notes_get */
    async getNote(id, params = {}) {
        return this._get({ url: this._url(this.URLs.noteById(id), params) });
    }

    /** POST /activity/note/ — official operationId: activities.notes_create */
    async createNote(body) {
        return this._post({
            url: this.baseUrl + this.URLs.notes,
            body,
        });
    }

    // ---- Custom fields -----------------------------------------------------

    /** GET /custom_field/lead/ — official operationId: custom_fields.lead_list */
    async listLeadCustomFields(params = {}) {
        return this._get({
            url: this._url(this.URLs.customFieldsLead, params),
        });
    }

    /** GET /custom_field/contact/ — official operationId: custom_fields.contact_list */
    async listContactCustomFields(params = {}) {
        return this._get({
            url: this._url(this.URLs.customFieldsContact, params),
        });
    }

    /** GET /custom_field/opportunity/ — official operationId: custom_fields.opportunity_list */
    async listOpportunityCustomFields(params = {}) {
        return this._get({
            url: this._url(this.URLs.customFieldsOpportunity, params),
        });
    }

    /**
     * GET /custom_field_schema/{object_type}/
     * official operationId: custom_field_schemas_get
     * object_type: lead | contact | opportunity | activity/<cat_id> | ...
     */
    async getCustomFieldSchema(objectType, params = {}) {
        return this._get({
            url: this._url(this.URLs.customFieldSchema(objectType), params),
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /** GET /webhook/ — official operationId: webhooks_list */
    async listWebhooks(params = {}) {
        return this._get({ url: this._url(this.URLs.webhooks, params) });
    }

    /** GET /webhook/{id}/ — official operationId: webhooks_get */
    async getWebhook(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.webhookById(id), params),
        });
    }

    /**
     * POST /webhook/ — official operationId: webhooks_create
     * Response includes signature_key (hex) used to verify close-sig-hash.
     */
    async createWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            body,
        });
    }

    /** PUT /webhook/{id}/ — official operationId: webhooks_update */
    async updateWebhook(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.webhookById(id),
            body,
        });
    }

    /** DELETE /webhook/{id}/ — official operationId: webhooks_delete */
    async deleteWebhook(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }
}

module.exports = { Api };
