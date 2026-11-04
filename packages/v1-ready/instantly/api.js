const { ApiKeyRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Instantly API v2 client.
 *
 * Instantly (instantly.ai) is an email outreach / cold-email platform.
 * API v2 authenticates with a workspace API key sent as a bearer token:
 *
 *   Authorization: Bearer <api_key>
 *
 * Base URL: https://api.instantly.ai/api/v2
 *
 * Auth design note:
 * ApiKeyRequester.addAuthHeaders() sets `headers[this.api_key_name] = this.api_key`.
 * Instantly needs the value prefixed with "Bearer", so we override addAuthHeaders()
 * to emit `Authorization: Bearer <key>` from the raw key. The persisted credential
 * stays the bare key (no "Bearer " prefix).
 *
 * Official docs: https://developer.instantly.ai/
 * Official OpenAPI: https://api.instantly.ai/openapi/api_v2.json
 *
 * The curated contract in ./instantly.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 *
 * Ported from Left Hook-owned Instantly module code (API key + campaigns /
 * accounts surface), reshaped to the v1-ready ApiKeyRequester pattern and
 * expanded against the vendor OpenAPI for leads, lead lists, webhooks, and
 * workspace identity.
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        const apiKey =
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            get(params, 'apiKey', null);

        this.api_key_name = 'Authorization';
        if (apiKey) {
            this.setApiKey(apiKey);
        }

        this.baseUrl = 'https://api.instantly.ai/api/v2';

        this.URLs = {
            workspaceCurrent: '/workspaces/current',
            campaigns: '/campaigns',
            campaignById: (id) => `/campaigns/${id}`,
            campaignAnalytics: '/campaigns/analytics',
            campaignAnalyticsDaily: '/campaigns/analytics/daily',
            accounts: '/accounts',
            accountByEmail: (email) => `/accounts/${encodeURIComponent(email)}`,
            leads: '/leads',
            leadsList: '/leads/list',
            leadById: (id) => `/leads/${id}`,
            leadLists: '/lead-lists',
            leadListById: (id) => `/lead-lists/${id}`,
            webhooks: '/webhooks',
            webhookById: (id) => `/webhooks/${id}`,
        };
    }

    /**
     * Emit `Authorization: Bearer <key>`. The stored credential is the bare
     * key; the "Bearer " prefix is added here so it never lives in the DB.
     */
    async addAuthHeaders(headers) {
        const h = headers || {};
        if (this.api_key) {
            h[this.api_key_name] = `Bearer ${this.api_key}`;
        }
        return h;
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    title: 'Instantly Authentication',
                    type: 'object',
                    required: ['api_key'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Create an API v2 key in Instantly under Settings → Integrations → API. Sent as Authorization: Bearer <key>. Docs: https://developer.instantly.ai/getting-started/authorization',
                        'ui:placeholder': 'Your Instantly API key',
                    },
                },
            },
        };
    }

    setApiKey(apiKey) {
        const raw = apiKey ? String(apiKey).replace(/^Bearer\s+/i, '').trim() : null;
        this.api_key = raw;
    }

    _jsonHeaders() {
        return { 'Content-Type': 'application/json' };
    }

    // ---- Workspace (identity) ----------------------------------------------

    /**
     * Get the current workspace for the API key.
     * GET /workspaces/current
     * Scopes: workspaces:read | workspaces:all | all:read | all:all
     */
    async getWorkspace() {
        return this._get({
            url: this.baseUrl + this.URLs.workspaceCurrent,
        });
    }

    // ---- Campaigns ---------------------------------------------------------

    /**
     * List campaigns.
     * GET /campaigns
     * Common query: limit, starting_after, search, status, tag_ids, …
     * Scopes: campaigns:read | campaigns:all | all:read | all:all
     */
    async listCampaigns(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.campaigns,
            query: params,
        });
    }

    /**
     * Get a campaign by id.
     * GET /campaigns/{id}
     */
    async getCampaign(id) {
        return this._get({
            url: this.baseUrl + this.URLs.campaignById(id),
        });
    }

    /**
     * Create a campaign.
     * POST /campaigns
     * Body requires name + campaign_schedule (see vendor OpenAPI).
     * Scopes: campaigns:create | campaigns:all | all:create | all:all
     */
    async createCampaign(body) {
        return this._post({
            url: this.baseUrl + this.URLs.campaigns,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Patch a campaign.
     * PATCH /campaigns/{id}
     * Scopes: campaigns:update | campaigns:all | all:update | all:all
     */
    async patchCampaign(id, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.campaignById(id),
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Get campaign analytics (one campaign via `id`, or all when omitted).
     * GET /campaigns/analytics
     */
    async getCampaignAnalytics(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.campaignAnalytics,
            query: params,
        });
    }

    /**
     * Get daily campaign analytics.
     * GET /campaigns/analytics/daily
     * Common query: campaign_id, start_date, end_date
     */
    async getDailyCampaignAnalytics(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.campaignAnalyticsDaily,
            query: params,
        });
    }

    // ---- Accounts (sending mailboxes) --------------------------------------

    /**
     * List email accounts used to send campaigns.
     * GET /accounts
     * Scopes: accounts:read | accounts:all | all:read | all:all
     */
    async listAccounts(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.accounts,
            query: params,
        });
    }

    /**
     * Get an account by email address.
     * GET /accounts/{email}
     */
    async getAccount(email) {
        return this._get({
            url: this.baseUrl + this.URLs.accountByEmail(email),
        });
    }

    /**
     * Create an account.
     * POST /accounts
     * Scopes: accounts:create | accounts:all | all:create | all:all
     */
    async createAccount(body) {
        return this._post({
            url: this.baseUrl + this.URLs.accounts,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Patch an account by email.
     * PATCH /accounts/{email}
     * Scopes: accounts:update | accounts:all | all:update | all:all
     */
    async patchAccount(email, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.accountByEmail(email),
            headers: this._jsonHeaders(),
            body,
        });
    }

    // ---- Leads -------------------------------------------------------------

    /**
     * List leads (POST — Instantly uses POST for complex filters).
     * POST /leads/list
     * Scopes: leads:read | leads:all | all:read | all:all
     */
    async listLeads(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.leadsList,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Get a lead by id.
     * GET /leads/{id}
     */
    async getLead(id) {
        return this._get({
            url: this.baseUrl + this.URLs.leadById(id),
        });
    }

    /**
     * Create a lead.
     * POST /leads
     * Scopes: leads:create | leads:all | all:create | all:all
     */
    async createLead(body) {
        return this._post({
            url: this.baseUrl + this.URLs.leads,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Patch a lead.
     * PATCH /leads/{id}
     * Scopes: leads:update | leads:all | all:update | all:all
     */
    async patchLead(id, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.leadById(id),
            headers: this._jsonHeaders(),
            body,
        });
    }

    // ---- Lead lists --------------------------------------------------------

    /**
     * List lead lists.
     * GET /lead-lists
     * Scopes: lead_lists:read | lead_lists:all | all:read | all:all
     */
    async listLeadLists(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.leadLists,
            query: params,
        });
    }

    /**
     * Get a lead list by id.
     * GET /lead-lists/{id}
     */
    async getLeadList(id) {
        return this._get({
            url: this.baseUrl + this.URLs.leadListById(id),
        });
    }

    /**
     * Create a lead list.
     * POST /lead-lists
     * Scopes: lead_lists:create | lead_lists:all | all:create | all:all
     */
    async createLeadList(body) {
        return this._post({
            url: this.baseUrl + this.URLs.leadLists,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Patch a lead list.
     * PATCH /lead-lists/{id}
     * Scopes: lead_lists:update | lead_lists:all | all:update | all:all
     */
    async patchLeadList(id, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.leadListById(id),
            headers: this._jsonHeaders(),
            body,
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * List webhook subscriptions.
     * GET /webhooks
     * Scopes: webhooks:read | webhooks:all | all:read | all:all
     */
    async listWebhooks(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks,
            query: params,
        });
    }

    /**
     * Get a webhook by id.
     * GET /webhooks/{id}
     */
    async getWebhook(id) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }

    /**
     * Create a webhook.
     * POST /webhooks
     * Body requires target_hook_url; optional campaign, name, event_type, headers.
     * Scopes: webhooks:create | webhooks:all | all:create | all:all
     */
    async createWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Patch a webhook.
     * PATCH /webhooks/{id}
     * Scopes: webhooks:update | webhooks:all | all:update | all:all
     */
    async patchWebhook(id, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.webhookById(id),
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Delete a webhook.
     * DELETE /webhooks/{id}
     * Scopes: webhooks:delete | webhooks:all | all:delete | all:all
     */
    async deleteWebhook(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }

    // ---- Auth probe --------------------------------------------------------

    /**
     * Prove the API key works by fetching the current workspace.
     * Prefers /workspaces/current over listing campaigns so identity is available
     * even on empty workspaces (when the key has workspaces:read).
     */
    async testAuth() {
        return this.getWorkspace();
    }
}

module.exports = { Api };
