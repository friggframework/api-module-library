const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * Copper CRM Developer API client.
 *
 * Auth (API key): every request must include:
 *   X-PW-AccessToken: <API key>
 *   X-PW-Application: developer_api
 *   X-PW-UserEmail: <email of the token owner>
 *   Content-Type: application/json
 *
 *   curl https://api.copper.com/developer_api/v1/account \
 *     -H "X-PW-AccessToken: YOUR_TOKEN" \
 *     -H "X-PW-Application: developer_api" \
 *     -H "X-PW-UserEmail: you@example.com" \
 *     -H "Content-Type: application/json"
 *
 * Base URL: https://api.copper.com/developer_api/v1
 * Rate limit: 180 requests/minute (rolling); bulk APIs also 3 req/sec.
 *
 * OAuth 2.0 (Authorization Code) is documented for partner integrations
 * and requires registering an application with partners@copper.com — not
 * implemented here (see open questions). Scope when registered:
 * `developer/v1/all`.
 *
 * Docs: https://developer.copper.com/
 *
 * The canonical machine-readable contract lives in ./copper.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 */
const DEFAULT_BASE_URL = 'https://api.copper.com/developer_api/v1';
const APPLICATION_HEADER_VALUE = 'developer_api';

class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        // ApiKeyRequester puts `headers[this.api_key_name] = this.api_key`
        this.api_key_name = 'X-PW-AccessToken';
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'apiKey', null) ||
            get(params, 'access_token', null);

        this.user_email =
            get(params, 'user_email', null) ||
            get(params, 'userEmail', null) ||
            get(params, 'email', null) ||
            get(params, 'USER_EMAIL', null);

        this.baseUrl = get(params, 'base_url', null) || DEFAULT_BASE_URL;

        this.URLs = {
            account: '/account',
            peopleSearch: '/people/search',
            people: '/people',
            personById: (id) => `/people/${id}`,
            companiesSearch: '/companies/search',
            companies: '/companies',
            companyById: (id) => `/companies/${id}`,
            opportunitiesSearch: '/opportunities/search',
            opportunities: '/opportunities',
            opportunityById: (id) => `/opportunities/${id}`,
            leadsSearch: '/leads/search',
            leads: '/leads',
            leadById: (id) => `/leads/${id}`,
            webhooks: '/webhooks',
            webhookById: (id) => `/webhooks/${id}`,
        };
    }

    /**
     * Copper needs three auth headers. ApiKeyRequester only sets the token
     * header; we add Application + UserEmail (and Content-Type) here.
     * @see https://developer.copper.com/introduction/requests.html
     */
    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders(headers);
        next['X-PW-Application'] = APPLICATION_HEADER_VALUE;
        if (this.user_email) {
            next['X-PW-UserEmail'] = this.user_email;
        }
        if (!next['Content-Type']) {
            next['Content-Type'] = 'application/json';
        }
        return next;
    }

    setUserEmail(email) {
        this.user_email = email;
    }

    // ---- Account / identity ------------------------------------------------

    /**
     * Fetch the Copper account for this API key.
     * GET /account
     * https://developer.copper.com/account-and-users/fetch-account-details.html
     *
     * Response: { id, name, primary_timezone, logo_mini_url?, settings? }
     */
    async getAccount() {
        return this._get({
            url: this.baseUrl + this.URLs.account,
        });
    }

    // ---- People ------------------------------------------------------------

    /**
     * List / search people.
     * POST /people/search
     * https://developer.copper.com/people/list-people-search.html
     *
     * Body filters (optional): ids, page_number, page_size, sort_by,
     * sort_direction, name, phone_number, emails, company_ids, …
     * Response: Person[]
     */
    async listPeople(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.peopleSearch,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Fetch a person by id.
     * GET /people/{id}
     * https://developer.copper.com/people/fetch-a-person-by-id.html
     */
    async getPerson(id) {
        return this._get({
            url: this.baseUrl + this.URLs.personById(id),
        });
    }

    /**
     * Create a person.
     * POST /people
     * https://developer.copper.com/people/create-a-new-person.html
     *
     * Body fields include name, emails[], phone_numbers[], address, …
     */
    async createPerson(body) {
        return this._post({
            url: this.baseUrl + this.URLs.people,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update a person (only fields present in the body are applied).
     * PUT /people/{id}
     * https://developer.copper.com/people/update-a-person.html
     */
    async updatePerson(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.personById(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Companies ---------------------------------------------------------

    /**
     * List / search companies.
     * POST /companies/search
     * https://developer.copper.com/companies/list-companies-search.html
     */
    async listCompanies(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.companiesSearch,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Fetch a company by id.
     * GET /companies/{id}
     * https://developer.copper.com/companies/fetch-a-company-by-id.html
     */
    async getCompany(id) {
        return this._get({
            url: this.baseUrl + this.URLs.companyById(id),
        });
    }

    /**
     * Create a company.
     * POST /companies
     * https://developer.copper.com/companies/create-a-new-company.html
     */
    async createCompany(body) {
        return this._post({
            url: this.baseUrl + this.URLs.companies,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update a company.
     * PUT /companies/{id}
     * https://developer.copper.com/companies/update-a-company.html
     */
    async updateCompany(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.companyById(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Opportunities -----------------------------------------------------

    /**
     * List / search opportunities.
     * POST /opportunities/search
     * https://developer.copper.com/opportunities/list-opportunities-search.html
     */
    async listOpportunities(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.opportunitiesSearch,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Fetch an opportunity by id.
     * GET /opportunities/{id}
     * https://developer.copper.com/opportunities/fetch-an-opportunity-by-id.html
     */
    async getOpportunity(id) {
        return this._get({
            url: this.baseUrl + this.URLs.opportunityById(id),
        });
    }

    /**
     * Create an opportunity. Required body field: `name`.
     * POST /opportunities
     * https://developer.copper.com/opportunities/create-a-new-opportunity.html
     */
    async createOpportunity(body) {
        return this._post({
            url: this.baseUrl + this.URLs.opportunities,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update an opportunity.
     * PUT /opportunities/{id}
     * https://developer.copper.com/opportunities/update-an-opportunity.html
     */
    async updateOpportunity(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.opportunityById(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Leads -------------------------------------------------------------

    /**
     * List / search leads.
     * POST /leads/search
     * https://developer.copper.com/leads/list-leads-search.html
     */
    async listLeads(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.leadsSearch,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Fetch a lead by id.
     * GET /leads/{id}
     * https://developer.copper.com/leads/fetch-a-lead-by-id.html
     */
    async getLead(id) {
        return this._get({
            url: this.baseUrl + this.URLs.leadById(id),
        });
    }

    /**
     * Create a lead.
     * POST /leads
     * https://developer.copper.com/leads/create-a-new-lead.html
     */
    async createLead(body) {
        return this._post({
            url: this.baseUrl + this.URLs.leads,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update a lead.
     * PUT /leads/{id}
     * https://developer.copper.com/leads/update-a-lead.html
     */
    async updateLead(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.leadById(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Webhooks (subscription management) --------------------------------

    /**
     * List webhook subscriptions.
     * GET /webhooks
     * https://developer.copper.com/webhooks/list-all-subscriptions.html
     */
    async listWebhooks() {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks,
        });
    }

    /**
     * Create a webhook subscription.
     * POST /webhooks
     * https://developer.copper.com/webhooks/create-new-subscription.html
     *
     * Required body: target (https URL), type
     *   ("lead"|"person"|"company"|"opportunity"|"project"|"task"),
     *   event ("new"|"update"|"delete").
     * Optional: secret{}, headers{}, custom_field_computed_values.
     * Note: activity_log events appear in the overview table but are not
     * listed as valid `type` values on the create endpoint.
     */
    async createWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update a webhook subscription (target / secret / headers /
     * custom_field_computed_values).
     * PUT /webhooks/{id}
     * https://developer.copper.com/webhooks/update-a-subscription.html
     */
    async updateWebhook(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.webhookById(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Delete (unsubscribe) a webhook subscription.
     * DELETE /webhooks/{id}
     * https://developer.copper.com/webhooks/delete-subscription-unsubscribe.html
     */
    async deleteWebhook(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }
}

module.exports = { Api, DEFAULT_BASE_URL, APPLICATION_HEADER_VALUE };
