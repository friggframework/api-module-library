const { OAuth2Requester, get } = require('@friggframework/core');

/** Official OpenAPI exploded array query param base names (serialized as `name[]`). */
const ARRAY_QUERY_KEYS = new Set([
    'statuses',
    'service_ids',
    'team_ids',
    'user_ids',
    'urgencies',
    'include',
]);

/**
 * PagerDuty REST API client (OAuth 2.0).
 *
 * Auth: Bearer access token from PagerDuty's authorization-code OAuth flow
 * (Classic User OAuth or Scoped OAuth). Token exchange is
 * application/x-www-form-urlencoded against identity.pagerduty.com.
 *
 * Base URL: https://api.pagerduty.com
 * Required Accept header: application/vnd.pagerduty+json;version=2
 *
 * Official sources:
 *   https://developer.pagerduty.com/docs/rest-api-overview
 *   https://developer.pagerduty.com/docs/oauth-functionality
 *   https://github.com/PagerDuty/api-schema (reference/REST/openapiv3.json)
 *
 * The canonical machine-readable contract lives in ./pagerduty.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://api.pagerduty.com';
        this.acceptHeader = 'application/vnd.pagerduty+json;version=2';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        this.account_id = get(params, 'account_id', null);
        this.subdomain = get(params, 'subdomain', null);

        const scope =
            this.scope || process.env.PAGERDUTY_SCOPE || 'write';

        const authParams = new URLSearchParams({
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            response_type: 'code',
            scope,
        });
        if (this.state) authParams.set('state', this.state);

        this.authorizationUri = `https://identity.pagerduty.com/oauth/authorize?${authParams.toString()}`;
        this.tokenUri = 'https://identity.pagerduty.com/oauth/token';

        this.URLs = {
            currentUser: '/users/me',
            users: '/users',
            userById: (userId) => `/users/${userId}`,
            incidents: '/incidents',
            incidentById: (incidentId) => `/incidents/${incidentId}`,
            services: '/services',
            serviceById: (serviceId) => `/services/${serviceId}`,
            webhookSubscriptions: '/webhook_subscriptions',
            webhookSubscriptionById: (subscriptionId) =>
                `/webhook_subscriptions/${subscriptionId}`,
        };
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    /**
     * Decode a JWT payload without verifying the signature. Used only to
     * read account_id / subdomain / user_id from PagerDuty's id_token
     * (signed by PagerDuty; we already trust the token endpoint response).
     */
    _decodeJwtPayload(jwt) {
        if (!jwt || typeof jwt !== 'string') return null;
        const parts = jwt.split('.');
        if (parts.length < 2) return null;
        try {
            const json = Buffer.from(parts[1], 'base64url').toString('utf8');
            return JSON.parse(json);
        } catch (e) {
            return null;
        }
    }

    /**
     * After setTokens, capture account identity claims from id_token when
     * PagerDuty returns one (Classic / Scoped OAuth).
     */
    async setTokens(params) {
        await super.setTokens(params);
        const idToken = get(params, 'id_token', null);
        const claims = this._decodeJwtPayload(idToken);
        if (claims?.account_id) this.account_id = claims.account_id;
        if (claims?.subdomain) this.subdomain = claims.subdomain;
        if (claims?.user_id) this.user_id = claims.user_id;
    }

    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders(headers);
        next.Accept = this.acceptHeader;
        return next;
    }

    addJsonHeaders(options) {
        options.headers = {
            'Content-Type': 'application/json',
            Accept: this.acceptHeader,
            ...options.headers,
        };
    }

    async _post(options, stringify) {
        // Token endpoint uses form-urlencoded; REST bodies are JSON.
        if (options.url && !String(options.url).includes('/oauth/')) {
            this.addJsonHeaders(options);
        }
        return super._post(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    /**
     * Official OpenAPI names exploded array query params with a literal `[]`
     * suffix (e.g. `statuses[]`, `include[]`). Keys already ending in `[]`
     * are left alone; known array keys without the suffix are normalized.
     *
     * `sort_by` on listIncidents is style=form explode=false (comma-joined).
     *
     * Built as a query string and appended to the URL because core Requester
     * stringifies array values and cannot emit repeated `key[]=` params.
     */
    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [rawKey, value] of Object.entries(params || {})) {
            if (value === undefined || value === null) continue;

            let key = rawKey;
            if (
                !key.endsWith('[]') &&
                ARRAY_QUERY_KEYS.has(key) &&
                (Array.isArray(value) || typeof value === 'string')
            ) {
                key = `${key}[]`;
            }

            if (Array.isArray(value)) {
                if (key === 'sort_by') {
                    // listIncidents: style=form, explode=false
                    if (value.length) usp.append('sort_by', value.join(','));
                } else {
                    for (const v of value) {
                        if (v === undefined || v === null) continue;
                        usp.append(key, String(v));
                    }
                }
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    _url(path, params) {
        return this.baseUrl + path + this._buildQuery(params);
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * getCurrentUser — GET /users/me
     * Optional params: include[] (contact_methods, notification_rules, …).
     * Official: user-level API key or OAuth user token only.
     */
    async getCurrentUser(params = {}) {
        return this._get({
            url: this._url(this.URLs.currentUser, params),
        });
    }

    // ---- Users -------------------------------------------------------------

    /** listUsers — GET /users */
    async listUsers(params = {}) {
        return this._get({
            url: this._url(this.URLs.users, params),
        });
    }

    /** getUser — GET /users/{id} */
    async getUser(userId, params = {}) {
        return this._get({
            url: this._url(this.URLs.userById(userId), params),
        });
    }

    /**
     * createUser — POST /users
     * Official OpenAPI requires the `From` header (email of a valid user).
     * Pass `{ from: 'admin@example.com' }` as the second argument.
     */
    async createUser(data, { from } = {}) {
        const headers = {};
        if (from) headers.From = from;
        return this._post({
            url: this.baseUrl + this.URLs.users,
            headers,
            body: data,
        });
    }

    /** updateUser — PUT /users/{id} */
    async updateUser(userId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.userById(userId),
            body: data,
        });
    }

    // ---- Incidents ---------------------------------------------------------

    /** listIncidents — GET /incidents */
    async listIncidents(params = {}) {
        return this._get({
            url: this._url(this.URLs.incidents, params),
        });
    }

    /** getIncident — GET /incidents/{id} */
    async getIncident(incidentId, params = {}) {
        return this._get({
            url: this._url(this.URLs.incidentById(incidentId), params),
        });
    }

    /**
     * createIncident — POST /incidents
     * Official OpenAPI requires the `From` header (email of a valid user).
     * Pass `{ from: 'responder@example.com' }` as the second argument.
     */
    async createIncident(data, { from } = {}) {
        const headers = {};
        if (from) headers.From = from;
        return this._post({
            url: this.baseUrl + this.URLs.incidents,
            headers,
            body: data,
        });
    }

    /**
     * updateIncident — PUT /incidents/{id}
     * Official OpenAPI requires the `From` header (`from_header`, required).
     */
    async updateIncident(incidentId, data, { from } = {}) {
        const headers = {};
        if (from) headers.From = from;
        return this._put({
            url: this.baseUrl + this.URLs.incidentById(incidentId),
            headers,
            body: data,
        });
    }

    // ---- Services ----------------------------------------------------------

    /** listServices — GET /services */
    async listServices(params = {}) {
        return this._get({
            url: this._url(this.URLs.services, params),
        });
    }

    /** getService — GET /services/{id} */
    async getService(serviceId, params = {}) {
        return this._get({
            url: this._url(this.URLs.serviceById(serviceId), params),
        });
    }

    /** createService — POST /services */
    async createService(data) {
        return this._post({
            url: this.baseUrl + this.URLs.services,
            body: data,
        });
    }

    /** updateService — PUT /services/{id} */
    async updateService(serviceId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.serviceById(serviceId),
            body: data,
        });
    }

    // ---- Webhook subscriptions (V3) ----------------------------------------

    /** listWebhookSubscriptions — GET /webhook_subscriptions */
    async listWebhookSubscriptions(params = {}) {
        return this._get({
            url: this._url(this.URLs.webhookSubscriptions, params),
        });
    }

    /** getWebhookSubscription — GET /webhook_subscriptions/{id} */
    async getWebhookSubscription(subscriptionId) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.webhookSubscriptionById(subscriptionId),
        });
    }

    /**
     * createWebhookSubscription — POST /webhook_subscriptions
     * Response includes delivery_method.secret once — store it to verify
     * X-PagerDuty-Signature on inbound deliveries.
     */
    async createWebhookSubscription(data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookSubscriptions,
            body: data,
        });
    }

    /** updateWebhookSubscription — PUT /webhook_subscriptions/{id} */
    async updateWebhookSubscription(subscriptionId, data) {
        return this._put({
            url:
                this.baseUrl +
                this.URLs.webhookSubscriptionById(subscriptionId),
            body: data,
        });
    }

    /** deleteWebhookSubscription — DELETE /webhook_subscriptions/{id} */
    async deleteWebhookSubscription(subscriptionId) {
        return this._delete({
            url:
                this.baseUrl +
                this.URLs.webhookSubscriptionById(subscriptionId),
        });
    }
}

module.exports = { Api };
