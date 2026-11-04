const { ApiKeyRequester, ModuleConstants, get } = require('@friggframework/core');

const DEFAULT_POSTHOG_HOST = 'https://us.posthog.com';

/**
 * Normalize a PostHog Cloud host.
 *
 * The host becomes the origin every authenticated call is sent to with the
 * personal API key, so it must be an https posthog.com address (US/EU cloud or
 * a documented subdomain). Blank means US cloud. Rejects userinfo and ports.
 * Returns the origin without a path or trailing slash.
 *
 * Docs: https://posthog.com/docs/api
 */
function normalizePostHogHost(host) {
    const value = typeof host === 'string' ? host.trim() : '';
    if (!value) return DEFAULT_POSTHOG_HOST;
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error(
            'The PostHog host must be a URL such as https://eu.posthog.com'
        );
    }
    const hostname = url.hostname.toLowerCase();
    const isPostHog =
        hostname === 'posthog.com' || hostname.endsWith('.posthog.com');
    if (
        url.protocol !== 'https:' ||
        !isPostHog ||
        url.username ||
        url.password ||
        url.port
    ) {
        throw new Error(
            'The PostHog host must be an https posthog.com address'
        );
    }
    return url.origin;
}

/**
 * PostHog private REST API client.
 *
 * Auth: personal API key as `Authorization: Bearer <key>`.
 *   https://posthog.com/docs/api/personal-api-keys
 *
 * Host: US Cloud `https://us.posthog.com` (default) or EU
 * `https://eu.posthog.com`. Project-scoped paths need `project_id`.
 *
 * Docs: https://posthog.com/docs/api
 * Contract: ./posthog.openapi.yaml (one method per operationId).
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        const raw =
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            get(params, 'apiKey', null);
        const token = raw
            ? String(raw).replace(/^Bearer\s+/i, '').trim()
            : null;

        // Persist the bare key; Bearer prefix is added in addAuthHeaders.
        this.api_key = token;
        this.api_key_name = 'Authorization';

        this.project_id =
            get(params, 'project_id', null) ||
            get(params, 'projectId', null) ||
            null;
        if (this.project_id != null) {
            this.project_id = String(this.project_id).trim();
        }

        const hostParam = get(params, 'host', null);
        this.host = normalizePostHogHost(hostParam);
        this.baseUrl = this.host;

        this.URLs = {
            currentUser: '/api/users/@me/',
            insights: (projectId) =>
                `/api/projects/${projectId}/insights/`,
            insightById: (projectId, insightId) =>
                `/api/projects/${projectId}/insights/${insightId}/`,
            query: (projectId) => `/api/projects/${projectId}/query/`,
            events: (projectId) => `/api/projects/${projectId}/events/`,
            eventById: (projectId, eventId) =>
                `/api/projects/${projectId}/events/${eventId}/`,
            persons: (projectId) => `/api/projects/${projectId}/persons/`,
            personById: (projectId, personId) =>
                `/api/projects/${projectId}/persons/${personId}/`,
            hogFunctions: (projectId) =>
                `/api/projects/${projectId}/hog_functions/`,
            hogFunctionById: (projectId, id) =>
                `/api/projects/${projectId}/hog_functions/${id}/`,
        };
    }

    /**
     * Emit `Authorization: Bearer <key>`. The stored credential is the bare
     * key; the Bearer prefix is added here so it never lives in the DB.
     */
    async addAuthHeaders(headers = {}) {
        const h = { ...headers };
        if (this.api_key) {
            h[this.api_key_name] = `Bearer ${this.api_key}`;
        }
        if (!h['Content-Type']) {
            h['Content-Type'] = 'application/json';
        }
        return h;
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    title: 'PostHog Authentication',
                    type: 'object',
                    required: ['api_key', 'project_id'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'Personal API Key',
                            description:
                                'PostHog personal API key (Settings → Personal API Keys). Sent as Authorization: Bearer.',
                        },
                        project_id: {
                            type: 'string',
                            title: 'Project ID',
                            description:
                                'PostHog project ID (Settings → Project).',
                        },
                        host: {
                            type: 'string',
                            title: 'PostHog Host',
                            description:
                                'PostHog instance URL (leave blank for US cloud).',
                            default: DEFAULT_POSTHOG_HOST,
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Create a personal API key under Settings → Personal API Keys. Scope it to the endpoints you need.',
                    },
                    project_id: {
                        'ui:widget': 'text',
                        'ui:help':
                            'Numeric project ID from Project settings.',
                    },
                    host: {
                        'ui:widget': 'text',
                        'ui:placeholder': DEFAULT_POSTHOG_HOST,
                        'ui:help':
                            'https://us.posthog.com (default) or https://eu.posthog.com. Must be https posthog.com with no userinfo or port.',
                    },
                },
            },
        };
    }

    _projectId(explicit) {
        const pid =
            explicit !== undefined && explicit !== null && explicit !== ''
                ? explicit
                : this.project_id;
        if (pid === undefined || pid === null || pid === '') {
            throw new Error(
                'PostHog project_id is required (constructor, setAuthParams, or per-call argument).'
            );
        }
        return String(pid);
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Get the authenticated user.
     * GET /api/users/@me/
     * Docs: https://posthog.com/docs/api/users
     * Scope: user:read
     */
    async getCurrentUser() {
        return this._get({
            url: this.baseUrl + this.URLs.currentUser,
        });
    }

    // ---- Insights ----------------------------------------------------------

    /**
     * List insights for a project.
     * GET /api/projects/:project_id/insights/
     * Docs: https://posthog.com/docs/api/insights
     * Scope: insight:read
     */
    async listInsights(options = {}) {
        const projectId = this._projectId(options.projectId ?? options.project_id);
        const query = {};
        if (options.limit !== undefined) query.limit = options.limit;
        if (options.offset !== undefined) query.offset = options.offset;
        if (options.saved !== undefined) query.saved = options.saved;
        if (options.search !== undefined) query.search = options.search;
        if (options.short_id !== undefined) query.short_id = options.short_id;
        if (options.favorited !== undefined) query.favorited = options.favorited;

        return this._get({
            url: this.baseUrl + this.URLs.insights(projectId),
            query,
        });
    }

    /**
     * Retrieve one insight.
     * GET /api/projects/:project_id/insights/:id/
     * Scope: insight:read
     */
    async getInsight(insightId, options = {}) {
        const projectId = this._projectId(options.projectId ?? options.project_id);
        return this._get({
            url: this.baseUrl + this.URLs.insightById(projectId, insightId),
        });
    }

    /**
     * Create an insight.
     * POST /api/projects/:project_id/insights/
     * Scope: insight:write
     */
    async createInsight(data, options = {}) {
        const projectId = this._projectId(options.projectId ?? options.project_id);
        return this._post({
            url: this.baseUrl + this.URLs.insights(projectId),
            body: data,
        });
    }

    /**
     * Partially update an insight.
     * PATCH /api/projects/:project_id/insights/:id/
     * Scope: insight:write
     */
    async updateInsight(insightId, data, options = {}) {
        const projectId = this._projectId(options.projectId ?? options.project_id);
        return this._patch({
            url: this.baseUrl + this.URLs.insightById(projectId, insightId),
            body: data,
        });
    }

    // ---- Query (HogQL) -----------------------------------------------------

    /**
     * Run a HogQL (or other) query.
     * POST /api/projects/:project_id/query/
     * Docs: https://posthog.com/docs/api/queries
     * Scope: query:read
     *
     * body.query should be e.g. { kind: 'HogQLQuery', query: 'SELECT ...' }.
     * A string is wrapped as HogQLQuery for convenience.
     */
    async createQuery(queryBody, options = {}) {
        const projectId = this._projectId(options.projectId ?? options.project_id);
        const body =
            typeof queryBody === 'string'
                ? {
                      query: {
                          kind: 'HogQLQuery',
                          query: queryBody,
                      },
                  }
                : queryBody;
        return this._post({
            url: this.baseUrl + this.URLs.query(projectId),
            body,
        });
    }

    // ---- Events (deprecated list surface; kept for compatibility) ----------

    /**
     * List events (deprecated — prefer createQuery / batch exports).
     * GET /api/projects/:project_id/events/
     * Docs: https://posthog.com/docs/api/events
     * Scope: query:read
     */
    async listEvents(options = {}) {
        const projectId = this._projectId(options.projectId ?? options.project_id);
        const query = {};
        if (options.limit !== undefined) query.limit = options.limit;
        if (options.offset !== undefined) query.offset = options.offset;
        if (options.after !== undefined) query.after = options.after;
        if (options.before !== undefined) query.before = options.before;
        if (options.event !== undefined) query.event = options.event;
        if (options.person_id !== undefined) query.person_id = options.person_id;
        if (options.distinct_id !== undefined)
            query.distinct_id = options.distinct_id;

        return this._get({
            url: this.baseUrl + this.URLs.events(projectId),
            query,
        });
    }

    /**
     * Retrieve one event by id.
     * GET /api/projects/:project_id/events/:id/
     * Scope: query:read
     */
    async getEvent(eventId, options = {}) {
        const projectId = this._projectId(options.projectId ?? options.project_id);
        return this._get({
            url: this.baseUrl + this.URLs.eventById(projectId, eventId),
        });
    }

    // ---- Persons -----------------------------------------------------------

    /**
     * List persons.
     * GET /api/projects/:project_id/persons/
     * Docs: https://posthog.com/docs/api/persons
     * Scope: person:read
     * Create via Capture API / SDKs, not this endpoint.
     */
    async listPersons(options = {}) {
        const projectId = this._projectId(options.projectId ?? options.project_id);
        const query = {};
        if (options.limit !== undefined) query.limit = options.limit;
        if (options.offset !== undefined) query.offset = options.offset;
        if (options.search !== undefined) query.search = options.search;
        if (options.email !== undefined) query.email = options.email;
        if (options.distinct_id !== undefined)
            query.distinct_id = options.distinct_id;

        return this._get({
            url: this.baseUrl + this.URLs.persons(projectId),
            query,
        });
    }

    /**
     * Retrieve one person.
     * GET /api/projects/:project_id/persons/:id/
     * Scope: person:read
     */
    async getPerson(personId, options = {}) {
        const projectId = this._projectId(options.projectId ?? options.project_id);
        return this._get({
            url: this.baseUrl + this.URLs.personById(projectId, personId),
        });
    }

    /**
     * Partially update a person.
     * PATCH /api/projects/:project_id/persons/:id/
     * Scope: person:write
     * Prefer Capture `$set` / SDKs for property updates when possible.
     */
    async updatePerson(personId, data, options = {}) {
        const projectId = this._projectId(options.projectId ?? options.project_id);
        return this._patch({
            url: this.baseUrl + this.URLs.personById(projectId, personId),
            body: data,
        });
    }

    // ---- Hog functions (destinations / realtime pipelines) -----------------

    /**
     * List hog functions (incl. destination / webhook-style pipelines).
     * GET /api/projects/:project_id/hog_functions/
     * Docs: https://posthog.com/docs/api/hog-functions
     * Scope: hog_function:read
     */
    async listHogFunctions(options = {}) {
        const projectId = this._projectId(options.projectId ?? options.project_id);
        const query = {};
        if (options.limit !== undefined) query.limit = options.limit;
        if (options.offset !== undefined) query.offset = options.offset;
        if (options.enabled !== undefined) query.enabled = options.enabled;
        if (options.type !== undefined) query.type = options.type;

        return this._get({
            url: this.baseUrl + this.URLs.hogFunctions(projectId),
            query,
        });
    }

    /**
     * Retrieve one hog function.
     * GET /api/projects/:project_id/hog_functions/:id/
     * Scope: hog_function:read
     */
    async getHogFunction(hogFunctionId, options = {}) {
        const projectId = this._projectId(options.projectId ?? options.project_id);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.hogFunctionById(projectId, hogFunctionId),
        });
    }

    /**
     * Create a hog function (e.g. type=destination for webhook-style delivery).
     * POST /api/projects/:project_id/hog_functions/
     * Scope: hog_function:write
     */
    async createHogFunction(data, options = {}) {
        const projectId = this._projectId(options.projectId ?? options.project_id);
        return this._post({
            url: this.baseUrl + this.URLs.hogFunctions(projectId),
            body: data,
        });
    }

    /**
     * Partially update a hog function.
     * PATCH /api/projects/:project_id/hog_functions/:id/
     * Scope: hog_function:write
     */
    async updateHogFunction(hogFunctionId, data, options = {}) {
        const projectId = this._projectId(options.projectId ?? options.project_id);
        return this._patch({
            url:
                this.baseUrl +
                this.URLs.hogFunctionById(projectId, hogFunctionId),
            body: data,
        });
    }

    /**
     * Delete a hog function.
     * DELETE /api/projects/:project_id/hog_functions/:id/
     * Scope: hog_function:write
     */
    async deleteHogFunction(hogFunctionId, options = {}) {
        const projectId = this._projectId(options.projectId ?? options.project_id);
        return this._delete({
            url:
                this.baseUrl +
                this.URLs.hogFunctionById(projectId, hogFunctionId),
        });
    }

    /**
     * Lightweight auth probe used by Definition.testAuthRequest.
     * Not an OpenAPI operationId.
     */
    async testAuth() {
        return this.getCurrentUser();
    }
}

module.exports = {
    Api,
    normalizePostHogHost,
    DEFAULT_POSTHOG_HOST,
};
