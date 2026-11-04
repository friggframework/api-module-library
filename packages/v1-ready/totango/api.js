const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * Totango REST API client (Customer Success / account health).
 *
 * Auth: personal access token sent as the `app-token` request header.
 *   curl https://api.totango.com/api/v1/search/accounts \
 *     -H "app-token: YOUR_TOKEN" --data 'query={...}'
 *
 * Base URL (US): https://api.totango.com
 * Base URL (EU): https://api-eu1.totango.com
 * Rate limit: 100 requests/minute per token.
 *
 * Docs index: https://support.totango.com/hc/en-us/sections/360005893212-Totango-API
 * Official OpenAPI (Customer Data Hub only):
 *   https://int-hub.totango.com/integration-hub-api_openApi.json
 *
 * The curated contract in ./totango.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 */
const DEFAULT_BASE_URL = 'https://api.totango.com';
const DEFAULT_CDH_BASE_URL = 'https://int-hub.totango.com/api/v1';

class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        // ApiKeyRequester puts `headers[this.api_key_name] = this.api_key`
        this.api_key_name = 'app-token';
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'app_token', null) ||
            get(params, 'access_token', null) ||
            get(params, 'apiKey', null);

        this.baseUrl =
            get(params, 'base_url', null) ||
            get(params, 'baseUrl', null) ||
            process.env.TOTANGO_BASE_URL ||
            DEFAULT_BASE_URL;

        // Customer Data Hub (official OpenAPI) — separate host from Search/Events.
        this.cdhBaseUrl =
            get(params, 'cdh_base_url', null) ||
            get(params, 'cdhBaseUrl', null) ||
            process.env.TOTANGO_CDH_BASE_URL ||
            DEFAULT_CDH_BASE_URL;

        this.URLs = {
            searchAccounts: '/api/v1/search/accounts',
            searchUsers: '/api/v1/search/users',
            whoami: '/api/v1/users/whoami',
            events: '/api/v2/events',
            searchEvents: '/api/v2/events/search',
            teams: (teamId) => `/api/v2/teams/${teamId}`,
            accountPlanSummary: (accountId) =>
                `/api/v3/accounts/${accountId}/plan_summary`,
            tasks: '/api/v3/tasks',
            taskById: (taskId) => `/api/v3/tasks/${taskId}`,
            activityTypes: '/api/v3/activity-types',
            touchpointTypes: '/api/v3/touchpoint-types',
            touchpointTags: '/api/v3/touchpoint-tags',
            cdhBatchStatus: (batchId) => `/status/${batchId}`,
        };
    }

    // ---- HTTP helpers ------------------------------------------------------

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const v of value) {
                    if (v === undefined || v === null) continue;
                    usp.append(key, String(v));
                }
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    /**
     * Totango Search / Events Search take an application/x-www-form-urlencoded
     * body with a `query` field whose value is a JSON object (stringified).
     */
    _formBody(fields = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(fields)) {
            if (value === undefined || value === null) continue;
            if (typeof value === 'object' && !(value instanceof Date)) {
                usp.append(key, JSON.stringify(value));
            } else {
                usp.append(key, String(value));
            }
        }
        return usp;
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Current system user (OAuth scope table: system_user:read).
     * GET /api/v1/users/whoami
     * Response schema is not published in support articles — treat as opaque.
     */
    async getWhoAmI() {
        return this._get({
            url: this.baseUrl + this.URLs.whoami,
        });
    }

    // ---- Accounts / companies (Search) -------------------------------------

    /**
     * Search accounts.
     * POST /api/v1/search/accounts
     *
     * Body (form): query = {
     *   terms (mandatory), fields (mandatory),
     *   count? (max 1000), offset?, sort_by?, sort_order?, scope?
     * }
     *
     * Account id is always returned as `name`; display name as `display_name`.
     * Health is requested via fields, e.g.
     *   {"type":"string","term":"health",...}
     *   {"type":"health_trend",...}
     *
     * Docs: https://support.totango.com/hc/en-us/articles/204174135-Search-API-accounts-and-users
     */
    async searchAccounts(query = {}) {
        // Second arg false: body is already URLSearchParams (not JSON).
        return this._post(
            {
                url: this.baseUrl + this.URLs.searchAccounts,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: this._formBody({ query }),
            },
            false
        );
    }

    /**
     * Convenience: search accounts requesting health + health_trend fields
     * (the documented read path for account health scores — there is no
     * dedicated health-score REST resource).
     */
    async searchAccountsWithHealth(query = {}) {
        const fields = Array.isArray(query.fields) ? [...query.fields] : [];
        const hasHealth = fields.some(
            (f) => f && f.type === 'string' && f.term === 'health'
        );
        const hasTrend = fields.some((f) => f && f.type === 'health_trend');
        if (!hasHealth) {
            fields.push({
                type: 'string',
                term: 'health',
                field_display_name: 'Health rank',
            });
        }
        if (!hasTrend) {
            fields.push({
                type: 'health_trend',
                field_display_name: 'Health last change',
            });
        }
        return this.searchAccounts({
            terms: query.terms || [
                { type: 'string', term: 'status_group', in_list: ['paying'] },
            ],
            count: query.count ?? 1000,
            offset: query.offset ?? 0,
            scope: query.scope || 'all',
            sort_by: query.sort_by,
            sort_order: query.sort_order,
            ...query,
            fields,
        });
    }

    // ---- Users / contacts (Search) -----------------------------------------

    /**
     * Search users (end-users / contacts on accounts).
     * POST /api/v1/search/users
     *
     * Docs: https://support.totango.com/hc/en-us/articles/204174135-Search-API-accounts-and-users
     */
    async searchUsers(query = {}) {
        return this._post(
            {
                url: this.baseUrl + this.URLs.searchUsers,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: this._formBody({ query }),
            },
            false
        );
    }

    // ---- Timeline / activities / tasks (events) ----------------------------

    /**
     * List timeline events for an account (touchpoints=note, tasks, alerts).
     * GET /api/v2/events?account_id={account_id}
     *
     * Docs: https://support.totango.com/hc/en-us/articles/115000597266-Touchpoints-API
     */
    async listEvents(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.events +
                this._buildQuery(params),
        });
    }

    /**
     * Search timeline events (notes, tasks, health-change alerts, campaigns).
     * POST /api/v2/events/search
     *
     * Body (form): query = { terms, fields: [], count, offset }, account_id?
     * event_type values: "note" | "campaign_touch" | "alert" | "task"
     *
     * Docs: https://support.totango.com/hc/en-us/articles/360048132792-Search-API-events
     */
    async searchEvents(query = {}, { account_id } = {}) {
        const form = {
            query: {
                offset: query.offset ?? 0,
                count: query.count ?? 1000,
                terms: query.terms,
                ...query,
                // Docs: fields must always be [].
                fields: [],
            },
        };
        if (account_id !== undefined && account_id !== null) {
            form.account_id = account_id;
        }
        return this._post(
            {
                url: this.baseUrl + this.URLs.searchEvents,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: this._formBody(form),
            },
            false
        );
    }

    /**
     * Convenience: search events of type "task" (documented read path for
     * tasks — Tasks API documents create/update/delete only).
     */
    async searchTasks(query = {}, opts = {}) {
        const terms = Array.isArray(query.terms) ? [...query.terms] : [];
        const hasTaskType = terms.some(
            (t) =>
                t &&
                t.type === 'event_property' &&
                t.name === 'event_type' &&
                t.eq === 'task'
        );
        if (!hasTaskType) {
            terms.push({
                type: 'event_property',
                name: 'event_type',
                eq: 'task',
            });
        }
        return this.searchEvents({ ...query, terms }, opts);
    }

    // ---- Account plan / health-adjacent ------------------------------------

    /**
     * Get account plan summary.
     * GET /api/v3/accounts/{account-id}/plan_summary
     *
     * Docs: https://support.totango.com/hc/en-us/articles/23255228587284-Accounts-Plan-API
     */
    async getAccountPlanSummary(accountId) {
        return this._get({
            url: this.baseUrl + this.URLs.accountPlanSummary(accountId),
        });
    }

    // ---- Tasks (write; read via events) ------------------------------------

    /**
     * Create a task.
     * POST /api/v3/tasks
     * Docs: https://support.totango.com/hc/en-us/articles/23797766837652-Tasks-API
     */
    async createTask(data) {
        return this._post({
            url: this.baseUrl + this.URLs.tasks,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a task.
     * PUT /api/v3/tasks/{task-id}
     */
    async updateTask(taskId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.taskById(taskId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Delete a task.
     * DELETE /api/v3/tasks/{task-id}
     *
     * Note: the Tasks API support article's delete curl sample uses
     * `--request PUT` while the OAuth scopes table lists DELETE. This client
     * follows the OAuth table (DELETE). See open questions in the PR.
     */
    async deleteTask(taskId, data = {}) {
        // Requester._delete does not forward a body; Tasks API may require
        // account_id in the body. Use _request so DELETE can carry JSON.
        return this._request(this.baseUrl + this.URLs.taskById(taskId), {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data || {}),
        });
    }

    // ---- Definitions (custom-field / CTA adjacent) -------------------------

    /**
     * List activity types (flow IDs used by tasks/touchpoints).
     * GET /api/v3/activity-types
     */
    async listActivityTypes() {
        return this._get({
            url: this.baseUrl + this.URLs.activityTypes,
        });
    }

    /**
     * List touchpoint types.
     * GET /api/v3/touchpoint-types
     */
    async listTouchpointTypes() {
        return this._get({
            url: this.baseUrl + this.URLs.touchpointTypes,
        });
    }

    /**
     * List touchpoint tags (reasons).
     * GET /api/v3/touchpoint-tags
     */
    async listTouchpointTags() {
        return this._get({
            url: this.baseUrl + this.URLs.touchpointTags,
        });
    }

    // ---- Teams -------------------------------------------------------------

    /**
     * Get team detail.
     * GET /api/v2/teams/{team-id}
     * Docs: https://support.totango.com/hc/en-us/articles/23799082988436-Teams-API
     */
    async getTeam(teamId) {
        return this._get({
            url: this.baseUrl + this.URLs.teams(teamId),
        });
    }

    // ---- Customer Data Hub (official OpenAPI — status read) ----------------

    /**
     * Get CDH batch processing status.
     * GET {cdhBaseUrl}/status/{batchId}
     * Auth on CDH OpenAPI: Authorization: "app-token <token>" (space-separated),
     * which differs from Search/Events (`app-token` header).
     * Official OpenAPI: https://int-hub.totango.com/integration-hub-api_openApi.json
     */
    async getBatchStatus(batchId) {
        const previous = this.addAuthHeaders.bind(this);
        this.addAuthHeaders = async (headers = {}) => ({
            ...headers,
            Authorization: `app-token ${this.api_key}`,
        });
        try {
            return await this._get({
                url: this.cdhBaseUrl + this.URLs.cdhBatchStatus(batchId),
            });
        } finally {
            this.addAuthHeaders = previous;
        }
    }
}

module.exports = { Api };
