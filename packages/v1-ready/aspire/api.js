const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Aspire Cloud (External) API client.
 *
 * Auth: client credentials via POST /Authorization with JSON body
 *   { ClientId, Secret } → { Token, RefreshToken }.
 * Subsequent calls use Authorization: Bearer <Token>.
 *
 * Tokens are valid for 24 hours. The framework grant_type is forced to
 * `client_credentials` so refreshAuth() re-runs POST /Authorization (Aspire
 * refresh tokens can rotate/revoke silently). A dedicated refreshToken()
 * method also wraps the vendor POST /Authorization/RefreshToken endpoint.
 *
 * Base URL (production): https://cloud-api.youraspire.com
 * Sandbox: https://cloudsandbox-api.youraspire.com
 * Override with ASPIRE_API_BASE_URL or constructor `baseUrl`.
 *
 * Docs:
 *   https://guide.youraspire.com/apidocs
 *   https://guide.youraspire.com/apidocs/authentication-authorization-2.md
 *   https://cloud-api.youraspire.com/swagger/v1/swagger.json
 *
 * Webhook subscription management is NOT offered on the public External API
 * (no webhook paths in the official Swagger).
 */
const DEFAULT_BASE_URL = 'https://cloud-api.youraspire.com';

class Api extends OAuth2Requester {
    constructor(params = {}) {
        // snake_case client_id / client_secret so CORE_ENCRYPTION_SCHEMA can
        // encrypt client_secret when persisted on the Credential record.
        super({
            ...params,
            grant_type: 'client_credentials',
        });

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            process.env.ASPIRE_API_BASE_URL ||
            DEFAULT_BASE_URL;

        this.client_id =
            get(params, 'client_id', null) ||
            get(params, 'clientId', null) ||
            process.env.ASPIRE_CLIENT_ID ||
            '';
        this.client_secret =
            get(params, 'client_secret', null) ||
            get(params, 'clientSecret', null) ||
            process.env.ASPIRE_CLIENT_SECRET ||
            '';

        this.access_token =
            get(params, 'access_token', null) ||
            get(params, 'accessToken', null) ||
            null;
        this.refresh_token =
            get(params, 'refresh_token', null) ||
            get(params, 'refreshToken', null) ||
            null;

        // Aspire mints tokens via a custom JSON endpoint, not a standard
        // OAuth tokenUri — but keep grant_type=client_credentials so the
        // framework routes refreshAuth() to getTokenFromClientCredentials().
        this.grant_type = 'client_credentials';
        this.isRefreshable = true;

        this.URLs = {
            authorization: '/Authorization',
            refreshToken: '/Authorization/RefreshToken',
            companies: '/Companies',
            contacts: '/Contacts',
            invoices: '/Invoices',
            opportunities: '/Opportunities',
            paymentTerms: '/PaymentTerms',
        };
    }

    getAuthorizationRequirements() {
        return {
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Aspire API Authorization',
                    type: 'object',
                    required: ['clientId', 'secret'],
                    properties: {
                        clientId: {
                            type: 'string',
                            title: 'Client ID',
                        },
                        secret: {
                            type: 'string',
                            title: 'Secret',
                        },
                    },
                },
                uiSchema: {
                    secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Aspire API secret from Administration > Application > API',
                    },
                },
            },
        };
    }

    // ---------------------------------------------------------------------------
    // Authentication
    // ---------------------------------------------------------------------------

    /**
     * Mint access + refresh tokens.
     * POST /Authorization
     * Body: { ClientId, Secret }
     * Response: { Token, RefreshToken }
     *
     * @see https://guide.youraspire.com/apidocs/authorization-6
     */
    async getTokenFromClientCredentials() {
        if (!this.client_id || !this.client_secret) {
            throw new Error(
                'Aspire: client_id and client_secret are required ' +
                    '(persisted on credential or set via ASPIRE_CLIENT_ID / ASPIRE_CLIENT_SECRET)'
            );
        }
        const response = await this._post({
            url: `${this.baseUrl}${this.URLs.authorization}`,
            headers: { 'Content-Type': 'application/json' },
            body: { ClientId: this.client_id, Secret: this.client_secret },
        });
        await this.setTokens({
            access_token: response.Token,
            refresh_token: response.RefreshToken,
        });
        return response;
    }

    /** Alias used by Definition.getToken / capability manifest. */
    async getToken() {
        return this.getTokenFromClientCredentials();
    }

    /** Back-compat alias from the source port. */
    async authenticate() {
        return this.getTokenFromClientCredentials();
    }

    /**
     * Refresh via the vendor refresh endpoint.
     * POST /Authorization/RefreshToken
     * Body: { RefreshToken }
     * Response: { Token, RefreshToken }
     *
     * Note: framework refreshAuth() with grant_type=client_credentials re-runs
     * getTokenFromClientCredentials() instead of this method (preferred when
     * refresh tokens rotate/revoke silently).
     *
     * @see https://guide.youraspire.com/apidocs/authentication-authorization-2.md
     */
    async refreshToken(refreshToken) {
        const token =
            (typeof refreshToken === 'string' && refreshToken) ||
            this.refresh_token;
        if (!token) {
            throw new Error(
                'Aspire: refresh_token is required to call POST /Authorization/RefreshToken'
            );
        }
        const response = await this._post({
            url: `${this.baseUrl}${this.URLs.refreshToken}`,
            headers: { 'Content-Type': 'application/json' },
            body: { RefreshToken: token },
        });
        await this.setTokens({
            access_token: response.Token,
            refresh_token: response.RefreshToken,
        });
        return response;
    }

    isAuthenticated() {
        return !!(
            this.access_token ||
            (this.client_id && this.client_secret)
        );
    }

    // ---------------------------------------------------------------------------
    // OData helpers
    // ---------------------------------------------------------------------------

    buildQueryString(params = {}) {
        const parts = [];
        if (params.filter !== undefined && params.filter !== null) {
            parts.push(`$filter=${params.filter}`);
        }
        if (params.skip !== undefined && params.skip !== null) {
            parts.push(`$skip=${params.skip}`);
        }
        if (params.top !== undefined && params.top !== null) {
            parts.push(`$top=${params.top}`);
        }
        if (params.select !== undefined && params.select !== null) {
            parts.push(`$select=${params.select}`);
        }
        if (params.orderby !== undefined && params.orderby !== null) {
            parts.push(`$orderby=${params.orderby}`);
        }
        if (params.expand !== undefined && params.expand !== null) {
            parts.push(`$expand=${params.expand}`);
        }
        if (params.pageNumber !== undefined && params.pageNumber !== null) {
            parts.push(`$pageNumber=${params.pageNumber}`);
        }
        if (params.limit !== undefined && params.limit !== null) {
            parts.push(`$limit=${params.limit}`);
        }
        return parts.length > 0 ? `?${parts.join('&')}` : '';
    }

    async paginateAll(fetchPage, pageSize = 100) {
        const results = [];
        let skip = 0;
        let page;
        do {
            page = await fetchPage(skip, pageSize);
            if (!Array.isArray(page)) break;
            results.push(...page);
            skip += pageSize;
        } while (page.length === pageSize);
        return results;
    }

    // ---------------------------------------------------------------------------
    // Companies
    // ---------------------------------------------------------------------------

    /**
     * List companies (OData).
     * GET /Companies
     * @see https://guide.youraspire.com/apidocs/companies-12
     * @see swagger Companies_Get
     */
    async getCompanies(params = {}) {
        const qs = this.buildQueryString(params);
        return this._get({
            url: `${this.baseUrl}${this.URLs.companies}${qs}`,
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * Create a company.
     * POST /Companies
     * Body: { CompanyName (required), DeniedTimeEmail?, Active? }
     */
    async createCompany(data) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.companies}`,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a company.
     * PUT /Companies
     * Body: { CompanyID (required), CompanyName (required), DeniedTimeEmail?, Active? }
     */
    async updateCompany(data) {
        return this._put({
            url: `${this.baseUrl}${this.URLs.companies}`,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    async getModifiedCompanies(since, skip = 0, top = 100) {
        return this.getCompanies({
            filter: `ModifiedDateTime gt ${since.toISOString()}`,
            skip,
            top,
        });
    }

    async getAllCompanies(pageSize = 100) {
        return this.paginateAll(
            (skip, top) => this.getCompanies({ skip, top }),
            pageSize
        );
    }

    // ---------------------------------------------------------------------------
    // Contacts
    // ---------------------------------------------------------------------------

    /**
     * List contacts (OData).
     * GET /Contacts
     * @see swagger Contacts_Get
     */
    async getContacts(params = {}) {
        const qs = this.buildQueryString(params);
        return this._get({
            url: `${this.baseUrl}${this.URLs.contacts}${qs}`,
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * Create a contact.
     * POST /Contacts
     * Body: ContactInsertRequest { Contact, HomeAddress?, OfficeAddress?, ContactTags?, PayScheduleID? }
     */
    async createContact(data) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.contacts}`,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a contact.
     * PUT /Contacts
     * Body: ContactUpdateRequest
     */
    async updateContact(data) {
        return this._put({
            url: `${this.baseUrl}${this.URLs.contacts}`,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    get contactExpand() {
        return (
            'OfficeAddress($select=AddressID,AddressLine1,AddressLine2,City,StateProvinceCode,ZipCode),' +
            'HomeAddress($select=AddressID,AddressLine1,AddressLine2,City,StateProvinceCode,ZipCode)'
        );
    }

    async getContactsByCompany(companyId) {
        return this.getContacts({
            filter: `CompanyID eq ${companyId}`,
            expand: this.contactExpand,
        });
    }

    /** Convenience: filter GET /Contacts by ContactID. */
    async getContact(contactId) {
        const results = await this.getContacts({
            filter: `ContactID eq ${contactId}`,
        });
        return Array.isArray(results) && results.length > 0 ? results[0] : null;
    }

    async getModifiedContacts(since, skip = 0, top = 100) {
        return this.getContacts({
            filter: `ModifiedDate gt ${since.toISOString()}`,
            skip,
            top,
        });
    }

    async getAllContacts(params = {}) {
        return this.getContacts({
            skip: params.skip,
            top: params.top,
        });
    }

    // ---------------------------------------------------------------------------
    // Invoices
    // ---------------------------------------------------------------------------

    /**
     * List invoices (OData). Read-only on the External API.
     * GET /Invoices
     * @see swagger Invoices_Get
     */
    async getInvoices(params = {}) {
        const qs = this.buildQueryString(params);
        return this._get({
            url: `${this.baseUrl}${this.URLs.invoices}${qs}`,
            headers: { Accept: 'application/json' },
        });
    }

    async getModifiedInvoices(since, skip = 0, top = 100) {
        return this.getInvoices({
            filter: `LastModifiedDateTime gt ${since.toISOString()}`,
            skip,
            top,
        });
    }

    async getAllInvoices(pageSize = 100) {
        return this.paginateAll(
            (skip, top) => this.getInvoices({ skip, top }),
            pageSize
        );
    }

    // ---------------------------------------------------------------------------
    // Opportunities
    // ---------------------------------------------------------------------------

    /**
     * List opportunities (OData).
     * GET /Opportunities
     * @see swagger Opportunities_Get
     */
    async getOpportunities(params = {}) {
        const qs = this.buildQueryString(params);
        return this._get({
            url: `${this.baseUrl}${this.URLs.opportunities}${qs}`,
            headers: { Accept: 'application/json' },
        });
    }

    /** Convenience: filter GET /Opportunities by OpportunityID. */
    async getOpportunity(opportunityId) {
        const results = await this.getOpportunities({
            filter: `OpportunityID eq ${opportunityId}`,
        });
        return Array.isArray(results) && results.length > 0 ? results[0] : null;
    }

    /**
     * Create an opportunity.
     * POST /Opportunities
     * Body: OpportunityInsertRequest
     * @see swagger Opportunities_Create
     */
    async createOpportunity(data) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.opportunities}`,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---------------------------------------------------------------------------
    // PaymentTerms
    // ---------------------------------------------------------------------------

    /**
     * List payment terms (OData). Read-only.
     * GET /PaymentTerms
     * @see swagger PaymentTerms_Get
     */
    async getPaymentTerms(params = {}) {
        // Back-compat: numeric id → filter helper (source port shape).
        if (typeof params === 'number') {
            const results = await this.getPaymentTerms({
                filter: `PaymentTermsID eq ${params}`,
            });
            return Array.isArray(results) && results.length > 0
                ? results[0]
                : null;
        }
        const qs = this.buildQueryString(params || {});
        return this._get({
            url: `${this.baseUrl}${this.URLs.paymentTerms}${qs}`,
            headers: { Accept: 'application/json' },
        });
    }
}

module.exports = { Api };
