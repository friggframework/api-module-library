const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * Klaviyo REST API client.
 *
 * Auth (private key): `Authorization: Klaviyo-API-Key <pk_...>`
 *   Docs: https://developers.klaviyo.com/en/docs/authenticate_
 *
 * Every server-side `/api` call also requires the `revision` header
 * (YYYY-MM-DD). Default matches the GA OpenAPI revision used to curate
 * `klaviyo.openapi.yaml` (https://github.com/klaviyo/openapi).
 *
 * Base URL: https://a.klaviyo.com
 * Content: JSON:API (`application/vnd.api+json` on write; `Accept: application/json`).
 *
 * Official OpenAPI: https://github.com/klaviyo/openapi
 * Developer reference: https://developers.klaviyo.com/en/reference/api_overview
 *
 * This client mirrors `./klaviyo.openapi.yaml` 1:1 (one method per operationId).
 * Official operationIds are snake_case (e.g. `get_profiles`); our curated
 * operationIds are camelCase to match Frigg Api method names.
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            get(params, 'apiKey', null);

        // ApiKeyRequester's default header injection is replaced by addAuthHeaders
        // so we can emit `Klaviyo-API-Key <key>` rather than a bare header value.
        this.api_key_name = 'Authorization';

        this.baseUrl = 'https://a.klaviyo.com';
        this.revision =
            get(params, 'revision', null) ||
            process.env.KLAVIYO_REVISION ||
            '2026-10-15';

        const enc = (id) => encodeURIComponent(String(id));
        this.URLs = {
            accounts: '/api/accounts/',
            accountById: (id) => `/api/accounts/${enc(id)}/`,
            profiles: '/api/profiles/',
            profileById: (id) => `/api/profiles/${enc(id)}/`,
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

    /**
     * Emit `Authorization: Klaviyo-API-Key <key>`. The stored credential is the
     * bare private key; the vendor prefix is added here so it never lives in DB.
     */
    async addAuthHeaders(headers = {}) {
        const h = { ...headers };
        if (this.api_key) {
            h[this.api_key_name] = `Klaviyo-API-Key ${this.api_key}`;
        }
        return h;
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
     * Build a query string. Supports scalar values and arrays (serialized as
     * repeated keys, which Klaviyo uses for sparse fieldsets like
     * `fields[profile]=email&fields[profile]=first_name`). Bracketed param
     * names (`page[cursor]`, `fields[profile]`) are passed through as-is.
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
                // Allow nested objects for convenience: { page: { cursor, size } }
                // → page[cursor]=…&page[size]=…
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

    /**
     * List accounts for the authenticated private key / token.
     * Official operationId: get_accounts. Scope: accounts:read.
     * GET /api/accounts/
     */
    async listAccounts(params = {}) {
        return this._get({
            url: this._url(this.URLs.accounts, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * Get a single account by id.
     * Official operationId: get_account. Scope: accounts:read.
     * GET /api/accounts/{id}/
     */
    async getAccount(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.accountById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    // ---- Profiles ----------------------------------------------------------

    /**
     * List profiles.
     * Official operationId: get_profiles. Scope: profiles:read.
     * GET /api/profiles/
     *
     * Common params: filter, page[cursor], page[size], sort, fields[profile],
     * additional-fields[profile], include.
     */
    async listProfiles(params = {}) {
        return this._get({
            url: this._url(this.URLs.profiles, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * Get a profile by id.
     * Official operationId: get_profile. Scope: profiles:read.
     * GET /api/profiles/{id}/
     */
    async getProfile(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.profileById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * Create a profile (JSON:API body).
     * Official operationId: create_profile. Scope: profiles:write.
     * POST /api/profiles/
     *
     * body example:
     *   { data: { type: 'profile', attributes: { email, first_name, ... } } }
     */
    async createProfile(data) {
        return this._post({
            url: this.baseUrl + this.URLs.profiles,
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /**
     * Update a profile (JSON:API body; id must match path).
     * Official operationId: update_profile. Scope: profiles:write.
     * PATCH /api/profiles/{id}/
     */
    async updateProfile(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.profileById(id),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    // ---- Lists -------------------------------------------------------------

    /**
     * List lists.
     * Official operationId: get_lists. Scope: lists:read.
     * GET /api/lists/
     */
    async listLists(params = {}) {
        return this._get({
            url: this._url(this.URLs.lists, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * Get a list by id.
     * Official operationId: get_list. Scope: lists:read.
     * GET /api/lists/{id}/
     */
    async getList(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.listById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * Create a list.
     * Official operationId: create_list. Scope: lists:write.
     * POST /api/lists/
     * body: { data: { type: 'list', attributes: { name } } }
     */
    async createList(data) {
        return this._post({
            url: this.baseUrl + this.URLs.lists,
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /**
     * Update a list.
     * Official operationId: update_list. Scope: lists:write.
     * PATCH /api/lists/{id}/
     */
    async updateList(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.listById(id),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /**
     * Delete a list.
     * Official operationId: delete_list. Scope: lists:write.
     * DELETE /api/lists/{id}/
     */
    async deleteList(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.listById(id),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * Add profiles to a list (relationship).
     * Official operationId: add_profiles_to_list. Scope: lists:write.
     * POST /api/lists/{id}/relationships/profiles/
     * body: { data: [ { type: 'profile', id } ] }
     */
    async addProfilesToList(listId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.listProfiles(listId),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /**
     * Remove profiles from a list (relationship).
     * Official operationId: remove_profiles_from_list. Scope: lists:write.
     * DELETE /api/lists/{id}/relationships/profiles/
     * body: { data: [ { type: 'profile', id } ] }
     */
    async removeProfilesFromList(listId, data) {
        return this._delete({
            url: this.baseUrl + this.URLs.listProfiles(listId),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    // ---- Events ------------------------------------------------------------

    /**
     * List events.
     * Official operationId: get_events. Scope: events:read.
     * GET /api/events/
     */
    async listEvents(params = {}) {
        return this._get({
            url: this._url(this.URLs.events, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * Get an event by id.
     * Official operationId: get_event. Scope: events:read.
     * GET /api/events/{id}/
     */
    async getEvent(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.eventById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * Create an event (track).
     * Official operationId: create_event. Scope: events:write.
     * POST /api/events/
     */
    async createEvent(data) {
        return this._post({
            url: this.baseUrl + this.URLs.events,
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    // ---- Segments ----------------------------------------------------------

    /**
     * List segments.
     * Official operationId: get_segments. Scope: segments:read.
     * GET /api/segments/
     */
    async listSegments(params = {}) {
        return this._get({
            url: this._url(this.URLs.segments, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * Get a segment by id.
     * Official operationId: get_segment. Scope: segments:read.
     * GET /api/segments/{id}/
     */
    async getSegment(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.segmentById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    // ---- Campaigns ---------------------------------------------------------

    /**
     * List campaigns.
     * Official operationId: get_campaigns. Scope: campaigns:read.
     * GET /api/campaigns/
     * Note: filter is required by the official API (e.g. equals(messages.channel,'email')).
     */
    async listCampaigns(params = {}) {
        return this._get({
            url: this._url(this.URLs.campaigns, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * Get a campaign by id.
     * Official operationId: get_campaign. Scope: campaigns:read.
     * GET /api/campaigns/{id}/
     */
    async getCampaign(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.campaignById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    // ---- Metrics -----------------------------------------------------------

    /**
     * List metrics.
     * Official operationId: get_metrics. Scope: metrics:read.
     * GET /api/metrics/
     */
    async listMetrics(params = {}) {
        return this._get({
            url: this._url(this.URLs.metrics, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * Get a metric by id.
     * Official operationId: get_metric. Scope: metrics:read.
     * GET /api/metrics/{id}/
     */
    async getMetric(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.metricById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    // ---- Webhooks (system webhooks API) ------------------------------------
    // Available to Advanced KDP customers and Klaviyo app partners.
    // Docs: https://developers.klaviyo.com/en/docs/working_with_system_webhooks

    /**
     * List webhooks.
     * Official operationId: get_webhooks. Scope: webhooks:read.
     * GET /api/webhooks/
     */
    async listWebhooks(params = {}) {
        return this._get({
            url: this._url(this.URLs.webhooks, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * Get a webhook by id.
     * Official operationId: get_webhook. Scope: webhooks:read.
     * GET /api/webhooks/{id}/
     */
    async getWebhook(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.webhookById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * Create a webhook.
     * Official operationId: create_webhook. Scope: webhooks:write.
     * POST /api/webhooks/
     *
     * body: {
     *   data: {
     *     type: 'webhook',
     *     attributes: { name, endpoint_url, secret_key, description? },
     *     relationships: { 'webhook-topics': { data: [ { type: 'webhook-topic', id } ] } }
     *   }
     * }
     */
    async createWebhook(data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /**
     * Update a webhook.
     * Official operationId: update_webhook. Scope: webhooks:write.
     * PATCH /api/webhooks/{id}/
     */
    async updateWebhook(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.webhookById(id),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /**
     * Delete a webhook.
     * Official operationId: delete_webhook. Scope: webhooks:write.
     * DELETE /api/webhooks/{id}/
     */
    async deleteWebhook(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(id),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * List webhook topics available for the account.
     * Official operationId: get_webhook_topics. Scope: webhooks:read.
     * GET /api/webhook-topics/
     */
    async listWebhookTopics(params = {}) {
        return this._get({
            url: this._url(this.URLs.webhookTopics, params),
            headers: this._klaviyoHeaders(),
        });
    }

    /**
     * Get a webhook topic by id.
     * Official operationId: get_webhook_topic. Scope: webhooks:read.
     * GET /api/webhook-topics/{id}/
     */
    async getWebhookTopic(id, params = {}) {
        return this._get({
            url: this._url(this.URLs.webhookTopicById(id), params),
            headers: this._klaviyoHeaders(),
        });
    }
}

module.exports = { Api };
