const { BasicAuthRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * BambooHR REST API client.
 *
 * Auth: API key over HTTP Basic — username = API key, password = any string
 * (BambooHR docs conventionally use `x`):
 *   curl -u "{API Key}:x" "https://{companyDomain}.bamboohr.com/api/v1/employees/directory"
 *
 * OAuth 2.0 is also supported by BambooHR (Developer Portal app + Marketplace
 * partnership for published apps) but is not wired here; see open questions.
 *
 * Base URL: https://{companyDomain}.bamboohr.com/api/v1
 * Always send `Accept: application/json` — without it BambooHR defaults to XML
 * on many employee/meta endpoints.
 *
 * Docs: https://documentation.bamboohr.com/docs/getting-started
 * Official OpenAPI: https://openapi.bamboohr.io/main/latest/docs/openapi/public-openapi.yaml
 *
 * The curated contract in ./bamboohr.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 */
class Api extends BasicAuthRequester {
    constructor(params = {}) {
        super(params);

        // BambooHR Basic auth = Base64(apiKey:password). Map onto
        // BasicAuthRequester's username/password which build the header.
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'apiKey', null) ||
            get(params, 'access_token', null);
        this.api_password =
            get(params, 'api_password', null) ||
            get(params, 'password', null) ||
            'x';

        if (this.api_key) this.username = this.api_key;
        this.password = this.api_password;

        this.companyDomain =
            get(params, 'companyDomain', null) ||
            get(params, 'company_domain', null) ||
            null;

        this.baseUrlTemplate = 'https://{companyDomain}.bamboohr.com/api/v1';
        this.baseUrl = this._resolveBaseUrl(this.companyDomain);

        this.URLs = {
            companyInformation: '/company_information',
            employees: '/employees',
            employeeById: (id) => `/employees/${id}`,
            employeesDirectory: '/employees/directory',
            employeesChanged: '/employees/changed',
            metaFields: '/meta/fields',
            webhooks: '/webhooks',
            webhookById: (id) => `/webhooks/${id}`,
            webhookMonitorFields: '/webhooks/monitor_fields',
        };
    }

    _resolveBaseUrl(companyDomain) {
        if (companyDomain) {
            return `https://${companyDomain}.bamboohr.com/api/v1`;
        }
        return this.baseUrlTemplate;
    }

    /**
     * Set / update the BambooHR company subdomain and rebuild baseUrl.
     * @param {string} companyDomain
     */
    setCompanyDomain(companyDomain) {
        this.companyDomain = companyDomain || null;
        this.baseUrl = this._resolveBaseUrl(this.companyDomain);
    }

    /**
     * Set the API key (Basic auth username).
     * @param {string} apiKey
     */
    setApiKey(apiKey) {
        this.api_key = apiKey;
        this.username = apiKey;
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.basic,
            data: {
                jsonSchema: {
                    title: 'BambooHR Authentication',
                    type: 'object',
                    required: ['api_key', 'companyDomain'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                        companyDomain: {
                            type: 'string',
                            title: 'Company Domain',
                            description:
                                'The subdomain in https://{companyDomain}.bamboohr.com',
                        },
                        api_password: {
                            type: 'string',
                            title: 'Basic Auth Password',
                            description:
                                'Any string; BambooHR docs conventionally use "x".',
                            default: 'x',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Generate an API key in BambooHR under the user menu → API Keys. Sent as the Basic auth username.',
                    },
                    companyDomain: {
                        'ui:help':
                            'If you log in at https://mycompany.bamboohr.com, the company domain is "mycompany".',
                        'ui:placeholder': 'mycompany',
                    },
                    api_password: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Optional. BambooHR ignores the Basic auth password value; default is "x".',
                    },
                },
            },
        };
    }

    /**
     * Ensure JSON Accept (and Content-Type on write) so BambooHR does not
     * fall back to XML.
     */
    addJsonHeaders(options = {}) {
        options.headers = {
            Accept: 'application/json',
            ...options.headers,
        };
        return options;
    }

    async _get(options) {
        return super._get(this.addJsonHeaders(options));
    }

    async _post(options, stringify) {
        options.headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        return super._post(this.addJsonHeaders(options), stringify);
    }

    async _put(options) {
        options.headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        return super._put(this.addJsonHeaders(options));
    }

    async _delete(options) {
        return super._delete(this.addJsonHeaders(options));
    }

    // ---- Company / identity ------------------------------------------------

    /**
     * Get company information (legal/display name, address, phone, domain, timezone).
     * GET /company_information
     * Official operationId: get-company-information
     * Supports Basic auth and OAuth scope company:info.
     */
    async getCompanyInformation() {
        return this._get({
            url: this.baseUrl + this.URLs.companyInformation,
        });
    }

    // ---- Employees ---------------------------------------------------------

    /**
     * List employees (cursor-paginated).
     * GET /employees
     * Official operationId: list-employees
     *
     * Optional query: filter, sort, fields, page (cursor page object per docs).
     * Response: { data: Employee[], meta, _links }
     */
    async listEmployees(params = {}) {
        const query = {};
        if (params.filter !== undefined) query.filter = params.filter;
        if (params.sort !== undefined) query.sort = params.sort;
        if (params.fields !== undefined) query.fields = params.fields;
        if (params.page !== undefined) query.page = params.page;

        return this._get({
            url: this.baseUrl + this.URLs.employees,
            query,
        });
    }

    /**
     * Get a single employee by internal id.
     * GET /employees/{id}
     * Official operationId: get-employee
     *
     * Pass id `0` for the authenticated caller's own employee record.
     * Optional query: fields (comma-separated aliases), onlyCurrent.
     */
    async getEmployee(id, params = {}) {
        const query = {};
        if (params.fields !== undefined) query.fields = params.fields;
        if (params.onlyCurrent !== undefined) {
            query.onlyCurrent = params.onlyCurrent;
        }

        return this._get({
            url: this.baseUrl + this.URLs.employeeById(id),
            query,
        });
    }

    /**
     * Create an employee.
     * POST /employees
     * Official operationId: create-employee
     *
     * Body: field alias → value map. At minimum firstName + lastName.
     * Discover aliases via listFields().
     */
    async createEmployee(data) {
        return this._post({
            url: this.baseUrl + this.URLs.employees,
            body: data,
        });
    }

    /**
     * Update an employee.
     * POST /employees/{id}  (BambooHR uses POST, not PATCH, for updates)
     * Official operationId: update-employee
     *
     * Body: field alias → value map of fields to change. Unknown aliases are
     * silently ignored (HTTP 200 with no update) — use listFields() first.
     */
    async updateEmployee(id, data) {
        return this._post({
            url: this.baseUrl + this.URLs.employeeById(id),
            body: data,
        });
    }

    /**
     * Get the published company employee directory.
     * GET /employees/directory
     * Official operationId: get-employees-directory
     *
     * Returns { fields, employees }. Fieldset is company-configured; not a
     * full roster (inactive/excluded employees are omitted).
     */
    async getEmployeesDirectory(params = {}) {
        const query = {};
        if (params.onlyCurrent !== undefined) {
            query.onlyCurrent = params.onlyCurrent;
        }
        return this._get({
            url: this.baseUrl + this.URLs.employeesDirectory,
            query,
        });
    }

    /**
     * Get employee IDs changed since a timestamp.
     * GET /employees/changed
     * Official operationId: get-changed-employee-ids
     *
     * Required query: since (ISO-8601). Optional: type.
     */
    async getChangedEmployeeIds(params = {}) {
        const query = {};
        if (params.since !== undefined) query.since = params.since;
        if (params.type !== undefined) query.type = params.type;
        return this._get({
            url: this.baseUrl + this.URLs.employeesChanged,
            query,
        });
    }

    // ---- Meta / fields -----------------------------------------------------

    /**
     * List all employee fields available in the account.
     * GET /meta/fields
     * Official operationId: list-fields
     */
    async listFields() {
        return this._get({
            url: this.baseUrl + this.URLs.metaFields,
        });
    }

    // ---- Permissioned webhooks ---------------------------------------------

    /**
     * List permissioned webhooks for the authenticated user.
     * GET /webhooks
     * Official operationId: list-webhooks
     */
    async listWebhooks() {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks,
        });
    }

    /**
     * Create a permissioned webhook.
     * POST /webhooks
     * Official operationId: create-webhook
     *
     * Body (NewWebHook): name, url (https), format ('json'|'form-encoded'),
     * optional monitorFields, postFields, includeCompanyDomain, events.
     * Response includes privateKey once — store it for HMAC verification.
     */
    async createWebhook(data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            body: data,
        });
    }

    /**
     * Get a webhook by id.
     * GET /webhooks/{id}
     * Official operationId: get-webhook
     */
    async getWebhook(id) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }

    /**
     * Update a webhook by id.
     * PUT /webhooks/{id}
     * Official operationId: update-webhook
     */
    async updateWebhook(id, data) {
        return this._put({
            url: this.baseUrl + this.URLs.webhookById(id),
            body: data,
        });
    }

    /**
     * Delete a webhook by id.
     * DELETE /webhooks/{id}
     * Official operationId: delete-webhook
     */
    async deleteWebhook(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }

    /**
     * List employee fields that can be monitored by a webhook.
     * GET /webhooks/monitor_fields
     * Official operationId: list-monitor-fields
     */
    async listMonitorFields() {
        return this._get({
            url: this.baseUrl + this.URLs.webhookMonitorFields,
        });
    }
}

module.exports = { Api };
