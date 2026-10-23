const {
    BasicAuthRequester,
    ModuleConstants,
    get,
} = require('@friggframework/core');

/**
 * UKG Pro HCM Core REST API client.
 *
 * Auth: HTTP Basic (service-account username:password) plus the tenant
 * `US-Customer-Api-Key` header. Core REST APIs are only accessible with a
 * web service account.
 *
 *   curl "https://{hostname}/personnel/v1/person-details?page=1&per_Page=10" \
 *     -H "Authorization: Basic $(echo -n 'user:pass' | base64)" \
 *     -H "US-Customer-Api-Key: XXXXX"
 *
 * Base URL is tenant-specific (datacenter + prod/test). Admins find it under
 * System Configuration > Security > Web Services. Default below matches the
 * documented example host shape; override via `base_url` / `baseUrl`.
 *
 * Docs:
 *   https://developer.ukg.com/hcm/reference/welcome-to-the-ukg-pro-api
 *   https://developer.ukg.com/hcm/docs/web-service-account
 *   https://developer.ukg.com/general/docs/authentication-and-authorization
 *
 * The curated contract in ./ukg-pro.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 */
class Api extends BasicAuthRequester {
    constructor(params = {}) {
        super(params);

        this.username =
            get(params, 'username', null) || get(params, 'user_name', null);
        this.password = get(params, 'password', null);
        this.customer_api_key =
            get(params, 'customer_api_key', null) ||
            get(params, 'customerApiKey', null) ||
            get(params, 'api_key', null);

        const base =
            get(params, 'base_url', null) ||
            get(params, 'baseUrl', null) ||
            get(params, 'hostname', null) ||
            'https://servicet.ultipro.com';
        this.setBaseUrl(base);

        this.URLs = {
            companyDetails: '/configuration/v1/company-details',
            personDetails: '/personnel/v1/person-details',
            personDetailsByEmployee: (employeeId) =>
                `/personnel/v1/person-details/${employeeId}`,
            personDetailsByCompanyEmployee: (companyId, employeeId) =>
                `/personnel/v1/companies/${companyId}/employees/${employeeId}/person-details`,
            employmentDetails: '/personnel/v1/employment-details',
            employmentDetailsByCompanyEmployee: (companyId, employeeId) =>
                `/personnel/v1/companies/${companyId}/employees/${employeeId}/employment-details`,
            compensationDetails: '/personnel/v1/compensation-details',
            compensationDetailsByCompanyEmployee: (companyId, employeeId) =>
                `/personnel/v1/companies/${companyId}/employees/${employeeId}/compensation-details`,
        };
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.basic,
            data: {
                jsonSchema: {
                    title: 'UKG Pro Authentication',
                    type: 'object',
                    required: [
                        'username',
                        'password',
                        'customer_api_key',
                        'base_url',
                    ],
                    properties: {
                        username: {
                            type: 'string',
                            title: 'Service account username',
                        },
                        password: {
                            type: 'string',
                            title: 'Service account password',
                        },
                        customer_api_key: {
                            type: 'string',
                            title: 'Customer API Key',
                        },
                        base_url: {
                            type: 'string',
                            title: 'Service base URL',
                        },
                    },
                },
                uiSchema: {
                    username: {
                        'ui:help':
                            'UKG Pro HCM web service account username (System Configuration > Security > Service Account Administration).',
                    },
                    password: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Password for the web service account. Sent as HTTP Basic Authorization.',
                    },
                    customer_api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Five-character Customer API Key from System Configuration > Security > Web Services. Sent as the US-Customer-Api-Key header.',
                        'ui:placeholder': 'XXXXX',
                    },
                    base_url: {
                        'ui:help':
                            'Tenant service hostname as HTTPS origin, e.g. https://servicet.ultipro.com (no trailing slash, no /services path).',
                        'ui:placeholder': 'https://servicet.ultipro.com',
                    },
                },
            },
        };
    }

    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders(headers);
        if (this.customer_api_key) {
            // Official guides use US-Customer-Api-Key; generated OpenAPI
            // samples use US-CUSTOMER-API-KEY (HTTP header names are
            // case-insensitive).
            next['US-Customer-Api-Key'] = this.customer_api_key;
        }
        return next;
    }

    isAuthenticated() {
        return !!(
            this.username &&
            String(this.username).trim().length > 0 &&
            this.password &&
            String(this.password).length > 0 &&
            this.customer_api_key &&
            String(this.customer_api_key).trim().length > 0 &&
            this.baseUrl
        );
    }

    setCustomerApiKey(key) {
        this.customer_api_key = key;
    }

    setBaseUrl(url) {
        this.baseUrl = String(url || '').replace(/\/+$/, '');
        this.baseURL = this.baseUrl;
        // Persisted credential field name (matches auth form / env).
        this.base_url = this.baseUrl;
    }

    // ---- Company / identity ------------------------------------------------

    /**
     * List master and component company details.
     * GET /configuration/v1/company-details
     *
     * @see https://developer.ukg.com/hcm/reference/companydetails_getcompanydetails
     */
    async listCompanyDetails(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.companyDetails,
            query,
        });
    }

    // ---- Person details ----------------------------------------------------

    /**
     * List person details (paginated).
     * GET /personnel/v1/person-details
     *
     * @see https://developer.ukg.com/hcm/reference/get_personnel-v1-person-details
     */
    async listPersonDetails(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.personDetails,
            query,
        });
    }

    /**
     * Get person details for one employee (tenant-wide lookup by employeeId).
     * GET /personnel/v1/person-details/{employeeId}
     *
     * @see https://developer.ukg.com/hcm/docs/version-history-doc
     */
    async getPersonDetailsByEmployeeId(employeeId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.personDetailsByEmployee(employeeId),
            query,
        });
    }

    /**
     * Get a single person detail record for a company + employee.
     * GET /personnel/v1/companies/{companyId}/employees/{employeeId}/person-details
     *
     * @see https://developer.ukg.com/hcm/reference/get_personnel-v1-companies-companyid-employees-employeeid-person-details
     */
    async getPersonDetails(companyId, employeeId, query = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.personDetailsByCompanyEmployee(
                    companyId,
                    employeeId
                ),
            query,
        });
    }

    // ---- Employment details ------------------------------------------------

    /**
     * List employment details (paginated).
     * GET /personnel/v1/employment-details
     *
     * @see https://developer.ukg.com/hcm/reference/get_personnel-v1-employment-details
     */
    async listEmploymentDetails(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.employmentDetails,
            query,
        });
    }

    /**
     * Get employment details for a company + employee.
     * GET /personnel/v1/companies/{companyId}/employees/{employeeId}/employment-details
     *
     * @see https://developer.ukg.com/hcm/reference/get_personnel-v1-companies-companyid-employees-employeeid-employment-details
     */
    async getEmploymentDetails(companyId, employeeId, query = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.employmentDetailsByCompanyEmployee(
                    companyId,
                    employeeId
                ),
            query,
        });
    }

    // ---- Compensation details ----------------------------------------------

    /**
     * List compensation details (paginated).
     * GET /personnel/v1/compensation-details
     *
     * @see https://developer.ukg.com/hcm/reference/get_personnel-v1-compensation-details
     */
    async listCompensationDetails(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.compensationDetails,
            query,
        });
    }

    /**
     * Get compensation details for a company + employee.
     * GET /personnel/v1/companies/{companyId}/employees/{employeeId}/compensation-details
     *
     * @see https://developer.ukg.com/hcm/docs/version-history-doc
     */
    async getCompensationDetails(companyId, employeeId, query = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.compensationDetailsByCompanyEmployee(
                    companyId,
                    employeeId
                ),
            query,
        });
    }

    /**
     * Lightweight authenticated request used to validate credentials.
     * Hits company-details (identity) with a single page.
     */
    async testAuth() {
        return this.listCompanyDetails({ page: 1, per_Page: 1 });
    }
}

module.exports = { Api };
