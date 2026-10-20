const crypto = require('crypto');
const {
    BasicAuthRequester,
    ModuleConstants,
    get,
} = require('@friggframework/core');

/**
 * HiBob (Bob) public API client.
 *
 * Auth (customer / service-user integrations): HTTP Basic.
 *   Authorization: Basic Base64(serviceUserId:token)
 *   Docs: https://apidocs.hibob.com/docs/api-service-users
 *         https://apidocs.hibob.com/reference/authorization
 *
 * Marketplace partners building distributed OAuth apps use OAuth 2.0 instead
 * (partner approval required) — not implemented here. See open questions.
 *
 * Base URL: https://api.hibob.com/v1 (sandbox: https://api.sandbox.hibob.com/v1)
 * Docs: https://apidocs.hibob.com/
 *
 * The curated contract in ./hibob.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 *
 * Webhook *subscriptions* are configured in the Bob UI — there is no public
 * REST create/list/delete for customer webhook subscriptions. This client
 * exposes `verifyWebhookSignature` for inbound v2 deliveries (Bob-Signature,
 * HMAC-SHA512). Partner OAuth apps use a different webhook model.
 */
class Api extends BasicAuthRequester {
    constructor(params = {}) {
        super(params);

        // Service-user Basic auth = Base64(id:token). Accept Bob-native names
        // and map onto BasicAuthRequester's username/password.
        this.service_user_id =
            get(params, 'service_user_id', null) ||
            get(params, 'serviceUserId', null) ||
            get(params, 'username', null);
        this.service_user_token =
            get(params, 'service_user_token', null) ||
            get(params, 'serviceUserToken', null) ||
            get(params, 'password', null) ||
            get(params, 'token', null);

        if (this.service_user_id) this.username = this.service_user_id;
        if (this.service_user_token) this.password = this.service_user_token;

        // Optional company id (webhook routing / empty-company identity).
        this.company_id =
            get(params, 'company_id', null) || get(params, 'companyId', null);
        if (this.company_id != null && this.company_id !== '') {
            this.company_id = String(this.company_id);
        }

        this.baseUrl =
            get(params, 'base_url', null) ||
            get(params, 'baseUrl', null) ||
            'https://api.hibob.com/v1';

        this.URLs = {
            peopleSearch: '/people/search',
            people: '/people',
            personById: (identifier) => `/people/${identifier}`,
            profiles: '/profiles',
            employeeFields: '/company/people/fields',
            namedLists: '/company/named-lists',
            namedListByName: (listName) => `/company/named-lists/${listName}`,
            timeOffChanges: '/timeoff/requests/changes',
            timeOffRequest: (employeeId, requestId) =>
                `/timeoff/employees/${employeeId}/requests/${requestId}`,
            timeOffRequests: (employeeId) =>
                `/timeoff/employees/${employeeId}/requests`,
            timeOffWhosOut: '/timeoff/whosout',
            timeOffOutToday: '/timeoff/outtoday',
            timeOffBalance: (employeeId) =>
                `/timeoff/employees/${employeeId}/balance`,
            timeOffPolicyTypes: '/timeoff/policy-types',
        };
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.basic,
            data: {
                jsonSchema: {
                    title: 'HiBob Authentication',
                    type: 'object',
                    required: ['service_user_id', 'service_user_token'],
                    properties: {
                        service_user_id: {
                            type: 'string',
                            title: 'Service User ID',
                        },
                        service_user_token: {
                            type: 'string',
                            title: 'Service User Token',
                        },
                        company_id: {
                            type: 'string',
                            title: 'Company ID (optional)',
                        },
                        base_url: {
                            type: 'string',
                            title: 'Base URL (optional)',
                        },
                    },
                },
                uiSchema: {
                    service_user_id: {
                        'ui:help':
                            'Create a Service User in Bob (System settings → Integrations → Service Users). The ID is the Basic Auth username.',
                        'ui:placeholder': 'Service user ID',
                    },
                    service_user_token: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Service user token (Basic Auth password). Pair with the ID as Base64(id:token) in the Authorization header.',
                        'ui:placeholder': 'Service user token',
                    },
                    company_id: {
                        'ui:help':
                            'Optional. Matches `companyId` on webhook payloads. When omitted, derived from People search responses. Needed for empty companies / webhook routing.',
                        'ui:placeholder': 'e.g. 637323',
                    },
                    base_url: {
                        'ui:help':
                            'Optional. Defaults to https://api.hibob.com/v1. Sandbox: https://api.sandbox.hibob.com/v1.',
                        'ui:placeholder': 'https://api.hibob.com/v1',
                    },
                },
            },
        };
    }

    // ---- People ------------------------------------------------------------

    /**
     * Search / bulk-read employees.
     * POST /people/search
     *
     * body (all optional): { fields[], filters[], showInactive, humanReadable }
     * - No pagination — returns all matching employees the service user can see.
     * - filters: only root.id / root.email with operator "equals" (omit property
     *   entirely when not filtering; empty filters can 400).
     * - Default fields cover root / about / employment / work categories.
     *
     * Response includes employees[].companyId (used for account identity).
     */
    async searchPeople(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.peopleSearch,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Read one employee by backend id or email.
     * POST /people/{identifier}
     *
     * body (optional): { fields[], humanReadable }
     */
    async getPerson(identifier, body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.personById(identifier),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Create an employee.
     * POST /people
     *
     * Required body fields per docs: email, firstName, surname, and
     * work: { site, startDate }. Optional: work.department, work.title, plus
     * any field from Fields metadata.
     */
    async createPerson(body) {
        return this._post({
            url: this.baseUrl + this.URLs.people,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update specific employee fields (PUT behaves like PATCH).
     * PUT /people/{identifier}
     */
    async updatePerson(identifier, body) {
        return this._put({
            url: this.baseUrl + this.URLs.personById(identifier),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Read the public profile section of all active employees.
     * GET /profiles
     */
    async listProfiles() {
        return this._get({
            url: this.baseUrl + this.URLs.profiles,
        });
    }

    // ---- Metadata ----------------------------------------------------------

    /**
     * Get all employee field metadata (no field permissions required).
     * GET /company/people/fields
     */
    async listEmployeeFields() {
        return this._get({
            url: this.baseUrl + this.URLs.employeeFields,
        });
    }

    /**
     * Get all company named lists.
     * GET /company/named-lists
     */
    async listNamedLists(params = {}) {
        const query = {};
        if (params.includeArchived !== undefined) {
            query.includeArchived = params.includeArchived;
        }
        return this._get({
            url: this.baseUrl + this.URLs.namedLists,
            query,
        });
    }

    /**
     * Get a specific company named list by name.
     * GET /company/named-lists/{listName}
     */
    async getNamedList(listName, params = {}) {
        const query = {};
        if (params.includeArchived !== undefined) {
            query.includeArchived = params.includeArchived;
        }
        return this._get({
            url: this.baseUrl + this.URLs.namedListByName(listName),
            query,
        });
    }

    // ---- Time off ----------------------------------------------------------

    /**
     * Get time off request changes in a date range.
     * GET /timeoff/requests/changes
     * Required query: since. Optional: to, includePending.
     */
    async listTimeOffChanges(params = {}) {
        const query = {};
        if (params.since) query.since = params.since;
        if (params.to) query.to = params.to;
        if (params.includePending !== undefined) {
            query.includePending = params.includePending;
        }
        return this._get({
            url: this.baseUrl + this.URLs.timeOffChanges,
            query,
        });
    }

    /**
     * Get details of an existing time off request.
     * GET /timeoff/employees/{id}/requests/{requestId}
     */
    async getTimeOffRequest(employeeId, requestId, params = {}) {
        const query = {};
        if (params.includeDailyDurations !== undefined) {
            query.includeDailyDurations = params.includeDailyDurations;
        }
        return this._get({
            url:
                this.baseUrl +
                this.URLs.timeOffRequest(employeeId, requestId),
            query,
        });
    }

    /**
     * Submit a new time off request.
     * POST /timeoff/employees/{id}/requests
     *
     * Body is one of several request-type shapes (days, hours, portionOnRange,
     * etc.) per the official OpenAPI oneOf.
     */
    async createTimeOffRequest(employeeId, body) {
        return this._post({
            url: this.baseUrl + this.URLs.timeOffRequests(employeeId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Cancel an existing time off request.
     * DELETE /timeoff/employees/{id}/requests/{requestId}
     */
    async cancelTimeOffRequest(employeeId, requestId) {
        return this._delete({
            url:
                this.baseUrl +
                this.URLs.timeOffRequest(employeeId, requestId),
        });
    }

    /**
     * Who's out for a date range.
     * GET /timeoff/whosout
     * Query: from, to (and optional includeHourly, includePrivate,
     * includePending, includeWorkingRequests).
     */
    async listWhosOut(params = {}) {
        const query = {};
        for (const key of [
            'from',
            'to',
            'includeHourly',
            'includePrivate',
            'includePending',
            'includeWorkingRequests',
        ]) {
            if (params[key] !== undefined) query[key] = params[key];
        }
        return this._get({
            url: this.baseUrl + this.URLs.timeOffWhosOut,
            query,
        });
    }

    /**
     * Who's out today (or on a specified date).
     * GET /timeoff/outtoday
     */
    async listOutToday(params = {}) {
        const query = {};
        for (const key of [
            'today',
            'includeHourly',
            'includePrivate',
            'siteId',
        ]) {
            if (params[key] !== undefined) query[key] = params[key];
        }
        return this._get({
            url: this.baseUrl + this.URLs.timeOffOutToday,
            query,
        });
    }

    /**
     * Get time off balance for an employee.
     * GET /timeoff/employees/{id}/balance
     * Required query: policyType, date.
     */
    async getTimeOffBalance(employeeId, params = {}) {
        const query = {};
        if (params.policyType) query.policyType = params.policyType;
        if (params.date) query.date = params.date;
        return this._get({
            url: this.baseUrl + this.URLs.timeOffBalance(employeeId),
            query,
        });
    }

    /**
     * List all policy type names.
     * GET /timeoff/policy-types
     */
    async listPolicyTypes() {
        return this._get({
            url: this.baseUrl + this.URLs.timeOffPolicyTypes,
        });
    }

    // ---- Auth check / identity helpers ------------------------------------

    /**
     * Lightweight authenticated request used to validate credentials.
     * GET /profiles returns 200 for valid service users.
     */
    async testAuth() {
        return this.listProfiles();
    }

    /**
     * Resolve Bob companyId for entity/credential identity and webhook routing.
     * Prefers an explicitly configured company_id; otherwise reads companyId
     * from the first employee returned by People search (documented on the
     * employee response schema).
     */
    async resolveCompanyId() {
        if (this.company_id) return String(this.company_id);

        const result = await this.searchPeople({
            fields: ['root.id'],
            showInactive: true,
        });
        const employees = Array.isArray(result?.employees)
            ? result.employees
            : [];
        const first = employees[0];
        const companyId =
            first?.companyId ??
            first?.['/root/companyId'] ??
            first?.company_id;
        if (companyId !== undefined && companyId !== null && companyId !== '') {
            this.company_id = String(companyId);
            return this.company_id;
        }
        return null;
    }

    // ---- Webhook signature (inbound; subscriptions are UI-only) ------------

    /**
     * Verify a Bob webhook signature (HMAC-SHA512, Base64).
     *
     * Official algorithm (https://apidocs.hibob.com/reference/getting-started-webhooks):
     *   signature = Base64(HMAC-SHA512(secret, raw_body))
     *   header: Bob-Signature
     *
     * Accepts comma-separated secrets (rotation) and case-insensitive headers.
     * Prefer req.rawBody — re-serializing JSON breaks the HMAC.
     *
     * @param {Object} args
     * @param {Object} args.req - Express-like request ({ headers, body, rawBody? })
     * @param {string|string[]} args.secret
     * @returns {{ valid: boolean, reason?: string }}
     */
    verifyWebhookSignature({ req, secret }) {
        const secrets = (
            Array.isArray(secret) ? secret : String(secret || '').split(',')
        )
            .map((s) => String(s || '').trim())
            .filter(Boolean);
        if (!secrets.length) {
            return { valid: false, reason: 'missing signing secret' };
        }
        if (!req || typeof req !== 'object') {
            return { valid: false, reason: 'missing request' };
        }

        const headers = req.headers || {};
        const signatureHeader = getHeader(headers, 'bob-signature');
        if (!signatureHeader) {
            return { valid: false, reason: 'missing bob-signature header' };
        }

        const body = extractBodyString(req);
        const provided = String(signatureHeader)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

        for (const sec of secrets) {
            const expected = crypto
                .createHmac('sha512', sec)
                .update(body, 'utf8')
                .digest('base64');
            for (const sig of provided) {
                if (safeCompareBase64(expected, sig)) {
                    return { valid: true };
                }
            }
        }
        return { valid: false, reason: 'signature mismatch' };
    }
}

function getHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    if (headers[name] !== undefined) return headers[name];
    const lower = name.toLowerCase();
    if (headers[lower] !== undefined) return headers[lower];
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lower) return headers[key];
    }
    return undefined;
}

function extractBodyString(req) {
    if (typeof req.rawBody === 'string') return req.rawBody;
    if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
    if (req.body === undefined || req.body === null) return '';
    if (typeof req.body === 'string') return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
    return JSON.stringify(req.body);
}

function safeCompareBase64(expected, provided) {
    if (typeof expected !== 'string' || typeof provided !== 'string') {
        return false;
    }
    try {
        const a = Buffer.from(expected, 'utf8');
        const b = Buffer.from(provided, 'utf8');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch (_err) {
        return false;
    }
}

module.exports = { Api };
