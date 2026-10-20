const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Klaviyo REST API client.
 *
 * Primary auth (App Marketplace / lefthook manifest): OAuth 2.0 authorization
 * code + PKCE (S256).
 *   Authorize: https://www.klaviyo.com/oauth/authorize
 *   Token:     https://a.klaviyo.com/oauth/token  (Basic client_id:client_secret)
 *   API calls: Authorization: Bearer <access_token>
 *   Docs: https://developers.klaviyo.com/en/docs/set_up_oauth
 *
 * Secondary auth (cleanly alongside): private API key.
 *   Authorization: Klaviyo-API-Key <pk_...>
 *   Docs: https://developers.klaviyo.com/en/docs/authenticate_
 *   Used when `api_key` is set and no `access_token` is present.
 *
 * Every server-side `/api` call also requires the `revision` header
 * (YYYY-MM-DD). Default matches the GA OpenAPI revision used to curate
 * `klaviyo.openapi.yaml` (https://github.com/klaviyo/openapi).
 *
 * Base URL: https://a.klaviyo.com
 * Content: JSON:API (`application/vnd.api+json` on write; `Accept: application/json`).
 *
 * This client mirrors `./klaviyo.openapi.yaml` 1:1 (one method per operationId).
 */
class Api extends OAuth2Requester {
    // Pack PKCE verifier into OAuth `state` so it survives the redirect (same
    // idea as the Salesforce module; Klaviyo requires code_verifier on token
    // exchange and the in-memory verifier is gone after the browser round-trip).
    static STATE_VERIFIER_DELIMITER = '~';

    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://a.klaviyo.com';
        this.tokenUri = 'https://a.klaviyo.com/oauth/token';
        this.authorizeBase = 'https://www.klaviyo.com/oauth/authorize';

        this.revision =
            get(params, 'revision', null) ||
            process.env.KLAVIYO_REVISION ||
            '2026-10-15';

        // Optional private-key path (non-OAuth installs / local tests).
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'apiKey', null) ||
            null;

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        this.code_verifier = get(params, 'code_verifier', null);

        // Built on each getAuthorizationUri() so PKCE is fresh per install.
        this.authorizationUri = null;

        const enc = (id) => encodeURIComponent(String(id));
        this.URLs = {
            accounts: '/api/accounts/',
            accountById: (id) => `/api/accounts/${enc(id)}/`,
            profiles: '/api/profiles/',
            profileById: (id) => `/api/profiles/${enc(id)}/`,
            profileImport: '/api/profile-import/',
            profileLists: (id) => `/api/profiles/${enc(id)}/lists/`,
            profileSubscribeJobs:
                '/api/profile-subscription-bulk-create-jobs/',
            profileUnsubscribeJobs:
                '/api/profile-subscription-bulk-delete-jobs/',
            lists: '/api/lists/',
            listById: (id) => `/api/lists/${enc(id)}/`,
            listProfiles: (id) =>
                `/api/lists/${enc(id)}/relationships/profiles/`,
            events: '/api/events/',
            eventById: (id) => `/api/events/${enc(id)}/`,
            segments: '/api/segments/',
            segmentById: (id) => `/api/segments/${enc(id)}/`,
            campaigns: '/api/campaigns/',
            campaignById: (id) => `/api/campaigns/${enc(id)}/`,
            metrics: '/api/metrics/',
            metricById: (id) => `/api/metrics/${enc(id)}/`,
            webhooks: '/api/webhooks/',
            webhookById: (id) => `/api/webhooks/${enc(id)}/`,
            webhookTopics: '/api/webhook-topics/',
            webhookTopicById: (id) => `/api/webhook-topics/${enc(id)}/`,
        };
    }

    // ---- Auth --------------------------------------------------------------

    /**
     * Generate a PKCE code_verifier / S256 code_challenge pair per
     * https://developers.klaviyo.com/en/docs/set_up_oauth
     */
    static generatePkce() {
        const base64URLEncode = (buf) =>
            buf
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
        const codeVerifier = base64URLEncode(crypto.randomBytes(32));
        const codeChallenge = base64URLEncode(
            crypto.createHash('sha256').update(codeVerifier).digest()
        );
        return { codeVerifier, codeChallenge };
    }

    /**
     * Build a fresh authorization URL with PKCE (S256). Packs the verifier
     * into `state` (optionally prefixed with the caller's state) so
     * getToken can restore it after redirect.
     */
    getAuthorizationUri() {
        const { codeVerifier, codeChallenge } = Api.generatePkce();
        this.code_verifier = codeVerifier;

        const callerState = this.state || null;
        const packedState = callerState
            ? `${callerState}${Api.STATE_VERIFIER_DELIMITER}${codeVerifier}`
            : codeVerifier;

        const url = new URL(this.authorizeBase);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('client_id', this.client_id || '');
        url.searchParams.set('redirect_uri', this.redirect_uri || '');
        url.searchParams.set('scope', this.scope || '');
        url.searchParams.set('state', packedState);
        url.searchParams.set('code_challenge_method', 'S256');
        url.searchParams.set('code_challenge', codeChallenge);

        this.authorizationUri = url.toString();
        return this.authorizationUri;
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
        };
    }

    /**
     * Restore `code_verifier` from the OAuth `state` query param returned by
     * Klaviyo after authorization.
     */
    restorePkceFromState(state) {
        if (!state) return;
        const raw = String(state);
        const at = raw.lastIndexOf(Api.STATE_VERIFIER_DELIMITER);
        this.code_verifier = at === -1 ? raw : raw.slice(at + 1);
    }

    /**
     * Exchange authorization code for tokens. Klaviyo requires:
     *   - Authorization: Basic base64(client_id:client_secret)
     *   - body: grant_type, code, code_verifier, redirect_uri
     * (application/x-www-form-urlencoded)
     */
    async getTokenFromCode(code) {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', this.redirect_uri);
        if (this.code_verifier) {
            params.append('code_verifier', this.code_verifier);
        }

        const options = {
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(
                    `${this.client_id}:${this.client_secret}`
                ).toString('base64')}`,
            },
            url: this.tokenUri,
        };

        // Don't send a stale Bearer on the token endpoint.
        this.access_token = undefined;
        const response = await this._post(options, false);
        this.code_verifier = null;
        await this.setTokens(response);
        return response;
    }

    /**
     * Refresh access token. Klaviyo requires Basic Auth + grant_type=refresh_token
     * (no client_id/secret in body). Docs: set_up_oauth § Request refresh tokens.
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshTokenObject.refresh_token);

        const options = {
            body: params,
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(
                    `${this.client_id}:${this.client_secret}`
                ).toString('base64')}`,
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    /**
     * Prefer OAuth Bearer; fall back to private API key when no access_token.
     */
    async addAuthHeaders(headers = {}) {
        const h = { ...headers };
        delete h.Authorization;
        if (this.access_token) {
            h.Authorization = `Bearer ${this.access_token}`;
        } else if (this.api_key) {
            h.Authorization = `Klaviyo-API-Key ${this.api_key}`;
        }
        return h;
    }

    setApiKey(apiKey) {
        this.api_key = apiKey;
    }

    isAuthenticated() {
        if (this.access_token) return true;
        if (this.api_key) return true;
        return false;
    }

    /** Headers required on every Klaviyo `/api` request. */
    _klaviyoHeaders(extra = {}) {
        return {
            Accept: 'application/json',
            revision: this.revision,
            ...extra,
        };
    }

    /** JSON:API write headers. */
    _jsonApiHeaders() {
        return this._klaviyoHeaders({
            'Content-Type': 'application/vnd.api+json',
        });
    }

    /**
     * Build a query string. Supports scalars, arrays (repeated keys), and
     * nested objects → `key[nested]=value` (page[cursor], fields[profile]).
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
            } else if (typeof value === 'object') {
                for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    if (nestedValue === undefined || nestedValue === null) {
                        continue;
                    }
                    usp.append(`${key}[${nestedKey}]`, String(nestedValue));
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

    // ---- Accounts (identity) -----------------------------------------------

    /** Official operationId: get_accounts. Scope: accounts:read. */
    async listAccounts(params = {}) {
        return this._get({
            url: this._url(this.URLs.accounts, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /** Official operationId: get_account. Scope: accounts:read. */
    async getAccount(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.accountById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    // ---- Profiles ----------------------------------------------------------

    /** Official operationId: get_profiles. Scope: profiles:read. */
    async listProfiles(params = {}) {
        return this._get({
            url: this._url(this.URLs.profiles, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /** Official operationId: get_profile. Scope: profiles:read. */
    async getProfile(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.profileById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    /** Official operationId: create_profile. Scope: profiles:write. */
    async createProfile(data) {
        return this._post({
            url: this.baseUrl + this.URLs.profiles,
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /** Official operationId: update_profile. Scope: profiles:write. */
    async updateProfile(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.profileById(id),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /**
     * Create or update a profile (upsert).
     * Official operationId: create_or_update_profile. Scope: profiles:write.
     * POST /api/profile-import/
     * body: { data: { type: 'profile', attributes: {…}, id? } }
     */
    async createOrUpdateProfile(data) {
        return this._post({
            url: this.baseUrl + this.URLs.profileImport,
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /**
     * Get list memberships for a profile.
     * Official operationId: get_lists_for_profile.
     * Scopes: lists:read, profiles:read.
     * GET /api/profiles/{id}/lists/
     */
    async getProfileLists(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.profileLists(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * Bulk-subscribe profiles (email/SMS/push/WhatsApp).
     * Official operationId: bulk_subscribe_profiles.
     * Scopes: subscriptions:write (+ lists:write when attaching a list).
     * POST /api/profile-subscription-bulk-create-jobs/
     */
    async subscribeProfiles(data) {
        return this._post({
            url: this.baseUrl + this.URLs.profileSubscribeJobs,
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /**
     * Bulk-unsubscribe profiles.
     * Official operationId: bulk_unsubscribe_profiles.
     * Scope: subscriptions:write.
     * POST /api/profile-subscription-bulk-delete-jobs/
     * Caution (vendor docs): profiles not in the specified list are globally
     * unsubscribed.
     */
    async unsubscribeProfiles(data) {
        return this._post({
            url: this.baseUrl + this.URLs.profileUnsubscribeJobs,
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    // ---- Lists -------------------------------------------------------------

    /** Official operationId: get_lists. Scope: lists:read. */
    async listLists(params = {}) {
        return this._get({
            url: this._url(this.URLs.lists, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /** Official operationId: get_list. Scope: lists:read. */
    async getList(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.listById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    /** Official operationId: create_list. Scope: lists:write. */
    async createList(data) {
        return this._post({
            url: this.baseUrl + this.URLs.lists,
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /** Official operationId: update_list. Scope: lists:write. */
    async updateList(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.listById(id),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /** Official operationId: delete_list. Scope: lists:write. */
    async deleteList(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.listById(id),
            headers: this._klaviyoHeaders(),
        });
    }

    /** Official operationId: add_profiles_to_list. Scope: lists:write. */
    async addProfilesToList(listId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.listProfiles(listId),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /** Official operationId: remove_profiles_from_list. Scope: lists:write. */
    async removeProfilesFromList(listId, data) {
        return this._delete({
            url: this.baseUrl + this.URLs.listProfiles(listId),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    // ---- Events ------------------------------------------------------------

    /** Official operationId: get_events. Scope: events:read. */
    async listEvents(params = {}) {
        return this._get({
            url: this._url(this.URLs.events, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /** Official operationId: get_event. Scope: events:read. */
    async getEvent(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.eventById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    /** Official operationId: create_event. Scope: events:write. */
    async createEvent(data) {
        return this._post({
            url: this.baseUrl + this.URLs.events,
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    // ---- Segments ----------------------------------------------------------

    /** Official operationId: get_segments. Scope: segments:read. */
    async listSegments(params = {}) {
        return this._get({
            url: this._url(this.URLs.segments, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /** Official operationId: get_segment. Scope: segments:read. */
    async getSegment(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.segmentById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    // ---- Campaigns ---------------------------------------------------------

    /**
     * Official operationId: get_campaigns. Scope: campaigns:read.
     * Official API requires `filter` (e.g. equals(messages.channel,'email')).
     */
    async listCampaigns(params = {}) {
        return this._get({
            url: this._url(this.URLs.campaigns, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /** Official operationId: get_campaign. Scope: campaigns:read. */
    async getCampaign(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.campaignById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    // ---- Metrics -----------------------------------------------------------

    /** Official operationId: get_metrics. Scope: metrics:read. */
    async listMetrics(params = {}) {
        return this._get({
            url: this._url(this.URLs.metrics, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /** Official operationId: get_metric. Scope: metrics:read. */
    async getMetric(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.metricById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /** Official operationId: get_webhooks. Scope: webhooks:read. */
    async listWebhooks(params = {}) {
        return this._get({
            url: this._url(this.URLs.webhooks, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /** Official operationId: get_webhook. Scope: webhooks:read. */
    async getWebhook(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.webhookById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    /** Official operationId: create_webhook. Scope: webhooks:write. */
    async createWebhook(data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /** Official operationId: update_webhook. Scope: webhooks:write. */
    async updateWebhook(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.webhookById(id),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /** Official operationId: delete_webhook. Scope: webhooks:write. */
    async deleteWebhook(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(id),
            headers: this._klaviyoHeaders(),
        });
    }

    /** Official operationId: get_webhook_topics. Scope: webhooks:read. */
    async listWebhookTopics(params = {}) {
        return this._get({
            url: this._url(this.URLs.webhookTopics, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /** Official operationId: get_webhook_topic. Scope: webhooks:read. */
    async getWebhookTopic(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.webhookTopicById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }
}

module.exports = { Api };
