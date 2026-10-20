const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Factorial HR public API client.
 *
 * Auth: OAuth 2.0 authorization-code (company token via resource_owner_type=company).
 *   Marketplace integrations require OAuth; API keys (x-api-key) exist for internal
 *   use but are being phased out for marketplace — this module uses OAuth.
 *
 *   Authorize: https://id.factorialhr.com/oauth/authorize
 *   Token:     https://id.factorialhr.com/api/oauth/token  (form-urlencoded)
 *   Access tokens expire in 1 hour; refresh with grant_type=refresh_token.
 *
 * Base URL (production, pinned version): https://api.factorialhr.com/api/2026-10-01
 * Demo:                                  https://api.eu2.demo.factorial.dev/api/2026-10-01
 *
 * Docs / sources (official only):
 *   https://apidoc.factorialhr.com/
 *   https://apidoc.factorialhr.com/docs/oauth-2
 *   https://apidoc.factorialhr.com/docs/request-an-authorization-code
 *   https://apidoc.factorialhr.com/docs/manage-webhooks
 *   OpenAPI: https://api.factorialhr.com/oas/?version=2026-10-01
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.apiVersion =
            get(params, 'apiVersion', null) ||
            get(params, 'api_version', null) ||
            '2026-10-01';

        const defaultBase = `https://api.factorialhr.com/api/${this.apiVersion}`;
        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            defaultBase;

        this.authBaseUrl =
            get(params, 'authBaseUrl', null) ||
            get(params, 'auth_base_url', null) ||
            'https://id.factorialhr.com';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        this.company_id =
            get(params, 'company_id', null) ||
            get(params, 'companyId', null);

        // Optional API-key fallback for internal/demo scripts (header x-api-key).
        // Marketplace auth path is OAuth; when api_key is set it is sent instead
        // of Bearer (Factorial accepts either).
        this.api_key =
            get(params, 'api_key', null) || get(params, 'apiKey', null);

        this.URLs = {
            credentials: '/resources/api_public/credentials',
            webhookSubscriptions:
                '/resources/api_public/webhook_subscriptions',
            webhookSubscriptionById: (id) =>
                `/resources/api_public/webhook_subscriptions/${id}`,
            legalEntities: '/resources/companies/legal_entities',
            legalEntityById: (id) =>
                `/resources/companies/legal_entities/${id}`,
            employees: '/resources/employees/employees',
            employeeById: (id) => `/resources/employees/employees/${id}`,
            createEmployeeWithContract:
                '/resources/employees/employees/create_with_contract',
            inviteEmployee: '/resources/employees/employees/invite',
            terminateEmployee: '/resources/employees/employees/terminate',
            unterminateEmployee:
                '/resources/employees/employees/unterminate',
            teams: '/resources/teams/teams',
            teamById: (id) => `/resources/teams/teams/${id}`,
            memberships: '/resources/teams/memberships',
            membershipById: (id) => `/resources/teams/memberships/${id}`,
            locations: '/resources/locations/locations',
            locationById: (id) => `/resources/locations/locations/${id}`,
        };

        const scope =
            this.scope ||
            get(params, 'scope', null) ||
            'read write employees company_legal_entities company_locations';

        // Company Token flow requires resource_owner_type=company.
        // @see https://apidoc.factorialhr.com/docs/request-an-authorization-code
        this.authorizationUri = encodeURI(
            `${this.authBaseUrl}/oauth/authorize` +
                `?client_id=${this.client_id}` +
                `&redirect_uri=${this.redirect_uri}` +
                `&response_type=code` +
                `&scope=${scope}` +
                `&state=${this.state}` +
                `&resource_owner_type=company`
        );
        this.tokenUri = `${this.authBaseUrl}/api/oauth/token`;
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    async addAuthHeaders(headers = {}) {
        const next = { ...(headers || {}) };
        next.Accept = next.Accept || 'application/json';
        if (this.api_key) {
            next['x-api-key'] = this.api_key;
            delete next.Authorization;
            return next;
        }
        return super.addAuthHeaders(next);
    }

    jsonHeaders(extra = {}) {
        return {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...extra,
        };
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * List API credentials / authenticated context.
     * GET /resources/api_public/credentials
     * Response items include company_id, name, legal_name, employee_id, …
     * @see https://apidoc.factorialhr.com/reference/get_api-2026-10-01-resources-api-public-credentials
     */
    async listCredentials(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.credentials,
            query,
        });
    }

    /**
     * Resolve company_id from credentials (or cached this.company_id).
     * Caches on the instance when found.
     */
    async resolveCompanyId() {
        if (this.company_id != null && this.company_id !== '') {
            return this.company_id;
        }
        const result = await this.listCredentials();
        const items = Array.isArray(result?.data)
            ? result.data
            : Array.isArray(result)
              ? result
              : [];
        const first = items[0];
        if (first?.company_id == null) {
            throw new Error(
                'Factorial: credentials response did not include company_id. ' +
                    'Ensure the token/key can read api_public credentials.'
            );
        }
        this.company_id = first.company_id;
        return this.company_id;
    }

    // ---- Legal entities ----------------------------------------------------

    /**
     * List legal entities.
     * GET /resources/companies/legal_entities
     * scope: company_legal_entities
     */
    async listLegalEntities(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.legalEntities,
            query,
        });
    }

    /**
     * Get a legal entity.
     * GET /resources/companies/legal_entities/{id}
     */
    async getLegalEntity(id) {
        return this._get({
            url: this.baseUrl + this.URLs.legalEntityById(id),
        });
    }

    /**
     * Create a legal entity.
     * POST /resources/companies/legal_entities
     * body: { company_id, country, legal_name, currency, … }
     */
    async createLegalEntity(body) {
        return this._post({
            url: this.baseUrl + this.URLs.legalEntities,
            headers: this.jsonHeaders(),
            body,
        });
    }

    // ---- Employees ---------------------------------------------------------

    /**
     * List employees.
     * GET /resources/employees/employees
     * Required query params per OpenAPI: only_active, only_managers (booleans).
     * scope: employees
     */
    async listEmployees(query = {}) {
        const q = {
            only_active:
                query.only_active !== undefined ? query.only_active : true,
            only_managers:
                query.only_managers !== undefined
                    ? query.only_managers
                    : false,
            ...query,
        };
        return this._get({
            url: this.baseUrl + this.URLs.employees,
            query: q,
        });
    }

    /**
     * Get an employee.
     * GET /resources/employees/employees/{id}
     */
    async getEmployee(id) {
        return this._get({
            url: this.baseUrl + this.URLs.employeeById(id),
        });
    }

    /**
     * Create an employee with a contract.
     * POST /resources/employees/employees/create_with_contract
     * Required: company_id, first_name, last_name, email
     */
    async createEmployeeWithContract(body) {
        return this._post({
            url: this.baseUrl + this.URLs.createEmployeeWithContract,
            headers: this.jsonHeaders(),
            body,
        });
    }

    /**
     * Update an employee.
     * PUT /resources/employees/employees/{id}
     * Required body field: id
     */
    async updateEmployee(id, body = {}) {
        return this._put({
            url: this.baseUrl + this.URLs.employeeById(id),
            headers: this.jsonHeaders(),
            body: { id, ...body },
        });
    }

    /**
     * Invite an unconfirmed employee.
     * POST /resources/employees/employees/invite
     */
    async inviteEmployee(body) {
        return this._post({
            url: this.baseUrl + this.URLs.inviteEmployee,
            headers: this.jsonHeaders(),
            body,
        });
    }

    /**
     * Terminate an employee.
     * POST /resources/employees/employees/terminate
     */
    async terminateEmployee(body) {
        return this._post({
            url: this.baseUrl + this.URLs.terminateEmployee,
            headers: this.jsonHeaders(),
            body,
        });
    }

    /**
     * Unterminate an employee.
     * POST /resources/employees/employees/unterminate
     */
    async unterminateEmployee(body) {
        return this._post({
            url: this.baseUrl + this.URLs.unterminateEmployee,
            headers: this.jsonHeaders(),
            body,
        });
    }

    // ---- Teams -------------------------------------------------------------

    /** List teams. GET /resources/teams/teams */
    async listTeams(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.teams,
            query,
        });
    }

    /** Get a team. GET /resources/teams/teams/{id} */
    async getTeam(id) {
        return this._get({
            url: this.baseUrl + this.URLs.teamById(id),
        });
    }

    /**
     * Create a team.
     * POST /resources/teams/teams
     * Required: name
     */
    async createTeam(body) {
        return this._post({
            url: this.baseUrl + this.URLs.teams,
            headers: this.jsonHeaders(),
            body,
        });
    }

    /** Update a team. PUT /resources/teams/teams/{id} */
    async updateTeam(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.teamById(id),
            headers: this.jsonHeaders(),
            body,
        });
    }

    /** Delete a team. DELETE /resources/teams/teams/{id} */
    async deleteTeam(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.teamById(id),
        });
    }

    // ---- Team memberships --------------------------------------------------

    /** List memberships. GET /resources/teams/memberships */
    async listMemberships(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.memberships,
            query,
        });
    }

    /** Get a membership. GET /resources/teams/memberships/{id} */
    async getMembership(id) {
        return this._get({
            url: this.baseUrl + this.URLs.membershipById(id),
        });
    }

    /**
     * Create a membership (assign employee to team).
     * POST /resources/teams/memberships
     * Required: team_id, employee_id
     */
    async createMembership(body) {
        return this._post({
            url: this.baseUrl + this.URLs.memberships,
            headers: this.jsonHeaders(),
            body,
        });
    }

    /** Update a membership. PUT /resources/teams/memberships/{id} */
    async updateMembership(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.membershipById(id),
            headers: this.jsonHeaders(),
            body,
        });
    }

    /** Delete a membership. DELETE /resources/teams/memberships/{id} */
    async deleteMembership(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.membershipById(id),
        });
    }

    // ---- Locations ---------------------------------------------------------

    /** List locations. GET /resources/locations/locations */
    async listLocations(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.locations,
            query,
        });
    }

    /** Get a location. GET /resources/locations/locations/{id} */
    async getLocation(id) {
        return this._get({
            url: this.baseUrl + this.URLs.locationById(id),
        });
    }

    /**
     * Create a location.
     * POST /resources/locations/locations
     * Required: name, country, timezone, company_id
     */
    async createLocation(body) {
        return this._post({
            url: this.baseUrl + this.URLs.locations,
            headers: this.jsonHeaders(),
            body,
        });
    }

    /** Update a location. PUT /resources/locations/locations/{id} */
    async updateLocation(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.locationById(id),
            headers: this.jsonHeaders(),
            body,
        });
    }

    /** Delete a location. DELETE /resources/locations/locations/{id} */
    async deleteLocation(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.locationById(id),
        });
    }

    // ---- Webhook subscriptions ---------------------------------------------

    /**
     * List webhook subscriptions.
     * GET /resources/api_public/webhook_subscriptions
     * @see https://apidoc.factorialhr.com/docs/manage-webhooks
     */
    async listWebhookSubscriptions(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookSubscriptions,
            query,
        });
    }

    /**
     * Get a webhook subscription.
     * GET /resources/api_public/webhook_subscriptions/{id}
     */
    async getWebhookSubscription(id) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookSubscriptionById(id),
        });
    }

    /**
     * Create a webhook subscription.
     * POST /resources/api_public/webhook_subscriptions
     * Required: subscription_type, target_url, company_id
     * Optional: name, challenge, enabled, api_version
     */
    async createWebhookSubscription(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookSubscriptions,
            headers: this.jsonHeaders(),
            body,
        });
    }

    /**
     * Update a webhook subscription (e.g. enable/disable).
     * PUT /resources/api_public/webhook_subscriptions/{id}
     */
    async updateWebhookSubscription(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.webhookSubscriptionById(id),
            headers: this.jsonHeaders(),
            body,
        });
    }

    /**
     * Delete a webhook subscription.
     * DELETE /resources/api_public/webhook_subscriptions/{id}
     */
    async deleteWebhookSubscription(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookSubscriptionById(id),
        });
    }

    /**
     * Verify an inbound webhook delivery via the challenge header.
     * Factorial echoes subscription.challenge in x-factorial-wh-challenge
     * (no HMAC signature). Compare header to the challenge you stored.
     * @see https://apidoc.factorialhr.com/docs/manage-webhooks
     * @see https://apidoc.factorialhr.com/docs/payloads-event-types
     */
    verifyWebhookChallenge({ challengeHeader, challenge } = {}) {
        const {
            verifyFactorialChallenge,
        } = require('./extensions/webhooks/signature-verifier');
        return verifyFactorialChallenge({
            challengeHeader,
            challenge,
        });
    }
}

module.exports = { Api };
