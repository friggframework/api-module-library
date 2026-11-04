const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * CallRail API v3 client.
 *
 * Auth: user-scoped API key sent as:
 *   Authorization: Token token="YOUR_API_KEY"
 *
 * Base URL: https://api.callrail.com/v3
 * Rate limits (default): 1,000/hour and 10,000/day general; SMS send and
 * outbound call have separate lower limits.
 *
 * Docs: https://apidocs.callrail.com/
 *
 * The canonical machine-readable contract lives in ./callrail.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 *
 * Third-party integrations should identify themselves with a Request-From
 * header (lowercased software name, underscores for spaces). Set
 * `request_from` / CALLRAIL_REQUEST_FROM to emit it.
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        // CallRail needs a non-standard Authorization value, so we keep the
        // bare key in `api_key` and format the header in addAuthHeaders().
        this.api_key_name = 'Authorization';
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            get(params, 'apiKey', null);

        this.baseUrl = 'https://api.callrail.com/v3';

        this.request_from =
            get(params, 'request_from', null) ||
            process.env.CALLRAIL_REQUEST_FROM ||
            null;

        this.URLs = {
            accounts: '/a.json',
            accountById: (accountId) => `/a/${accountId}.json`,
            companies: (accountId) => `/a/${accountId}/companies.json`,
            companyById: (accountId, companyId) =>
                `/a/${accountId}/companies/${companyId}.json`,
            calls: (accountId) => `/a/${accountId}/calls.json`,
            callById: (accountId, callId) =>
                `/a/${accountId}/calls/${callId}.json`,
            formSubmissions: (accountId) =>
                `/a/${accountId}/form_submissions.json`,
            formSubmissionById: (accountId, formSubmissionId) =>
                `/a/${accountId}/form_submissions/${formSubmissionId}.json`,
            textMessages: (accountId) => `/a/${accountId}/text-messages.json`,
            textMessageById: (accountId, conversationId) =>
                `/a/${accountId}/text-messages/${conversationId}.json`,
            trackers: (accountId) => `/a/${accountId}/trackers.json`,
            trackerById: (accountId, trackerId) =>
                `/a/${accountId}/trackers/${trackerId}.json`,
            users: (accountId) => `/a/${accountId}/users.json`,
            userById: (accountId, userId) =>
                `/a/${accountId}/users/${userId}.json`,
            integrations: (accountId) => `/a/${accountId}/integrations.json`,
            integrationById: (accountId, integrationId) =>
                `/a/${accountId}/integrations/${integrationId}.json`,
        };
    }

    /**
     * Emit `Authorization: Token token="<key>"` and optional `Request-From`.
     * The stored credential is the bare API key; the Token wrapper is added
     * here so it never lives in the DB.
     */
    async addAuthHeaders(headers) {
        const h = headers || {};
        if (this.api_key) {
            h[this.api_key_name] = `Token token="${this.api_key}"`;
        }
        if (this.request_from) {
            h['Request-From'] = this.request_from;
        }
        return h;
    }

    // ---- Accounts ----------------------------------------------------------

    /**
     * List accounts accessible to the API key.
     * GET /v3/a.json
     * Optional query: page, per_page, sort, order, hipaa_account, fields
     */
    async listAccounts(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.accounts,
            query,
        });
    }

    /**
     * Retrieve a single account.
     * GET /v3/a/{account_id}.json
     */
    async getAccount(accountId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.accountById(accountId),
            query,
        });
    }

    // ---- Companies ---------------------------------------------------------

    /**
     * List companies in an account.
     * GET /v3/a/{account_id}/companies.json
     */
    async listCompanies(accountId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.companies(accountId),
            query,
        });
    }

    /**
     * Retrieve a single company.
     * GET /v3/a/{account_id}/companies/{company_id}.json
     */
    async getCompany(accountId, companyId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.companyById(accountId, companyId),
            query,
        });
    }

    /**
     * Create a company.
     * POST /v3/a/{account_id}/companies.json
     * body: { name (required), time_zone? }
     */
    async createCompany(accountId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.companies(accountId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a company.
     * PUT /v3/a/{account_id}/companies/{company_id}.json
     */
    async updateCompany(accountId, companyId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.companyById(accountId, companyId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Calls -------------------------------------------------------------

    /**
     * List calls in an account.
     * GET /v3/a/{account_id}/calls.json
     * Supports offset/relative pagination, filtering, field selection, search.
     */
    async listCalls(accountId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.calls(accountId),
            query,
        });
    }

    /**
     * Retrieve a single call.
     * GET /v3/a/{account_id}/calls/{call_id}.json
     */
    async getCall(accountId, callId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.callById(accountId, callId),
            query,
        });
    }

    /**
     * Create an outbound phone call.
     * POST /v3/a/{account_id}/calls.json
     * body: { caller_id, customer_phone_number, business_phone_number,
     *         recording_enabled? }
     */
    async createCall(accountId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.calls(accountId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a call (tags, note, lead_status, value, customer_name, spam).
     * PUT /v3/a/{account_id}/calls/{call_id}.json
     */
    async updateCall(accountId, callId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.callById(accountId, callId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Form submissions --------------------------------------------------

    /**
     * List form submissions.
     * GET /v3/a/{account_id}/form_submissions.json
     */
    async listFormSubmissions(accountId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.formSubmissions(accountId),
            query,
        });
    }

    /**
     * Create a form submission.
     * POST /v3/a/{account_id}/form_submissions.json
     * Official docs wrap the payload in `{ form_submission: { ... } }`.
     */
    async createFormSubmission(accountId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.formSubmissions(accountId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a form submission (tags, note, lead_status, value).
     * PUT /v3/a/{account_id}/form_submissions/{form_submission_id}.json
     */
    async updateFormSubmission(accountId, formSubmissionId, data) {
        return this._put({
            url:
                this.baseUrl +
                this.URLs.formSubmissionById(accountId, formSubmissionId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Text messages -----------------------------------------------------

    /**
     * List text message conversations.
     * GET /v3/a/{account_id}/text-messages.json
     */
    async listTextConversations(accountId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.textMessages(accountId),
            query,
        });
    }

    /**
     * Retrieve a single text conversation (messages paginated).
     * GET /v3/a/{account_id}/text-messages/{conversation_id}.json
     */
    async getTextConversation(accountId, conversationId, query = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.textMessageById(accountId, conversationId),
            query,
        });
    }

    /**
     * Send a text message (SMS or MMS via media_url).
     * POST /v3/a/{account_id}/text-messages.json
     * body: { company_id, customer_phone_number, tracking_number, content,
     *         media_url? }
     */
    async sendTextMessage(accountId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.textMessages(accountId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Trackers ----------------------------------------------------------

    /**
     * List trackers (source and session).
     * GET /v3/a/{account_id}/trackers.json
     */
    async listTrackers(accountId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.trackers(accountId),
            query,
        });
    }

    /**
     * Retrieve a single tracker.
     * GET /v3/a/{account_id}/trackers/{tracker_id}.json
     */
    async getTracker(accountId, trackerId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.trackerById(accountId, trackerId),
            query,
        });
    }

    // ---- Users -------------------------------------------------------------

    /**
     * List users in an account.
     * GET /v3/a/{account_id}/users.json
     */
    async listUsers(accountId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.users(accountId),
            query,
        });
    }

    /**
     * Retrieve a single user.
     * GET /v3/a/{account_id}/users/{user_id}.json
     */
    async getUser(accountId, userId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.userById(accountId, userId),
            query,
        });
    }

    // ---- Integrations (webhook subscriptions) ------------------------------

    /**
     * List integrations for a company (company_id query required).
     * GET /v3/a/{account_id}/integrations.json?company_id=...
     * Webhooks are modeled as integrations with type "Webhooks".
     */
    async listIntegrations(accountId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.integrations(accountId),
            query,
        });
    }

    /**
     * Retrieve a single integration.
     * GET /v3/a/{account_id}/integrations/{integration_id}.json
     * Pass fields=signing_key to include the webhook signing secret.
     */
    async getIntegration(accountId, integrationId, query = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.integrationById(accountId, integrationId),
            query,
        });
    }

    /**
     * Create an integration. API-creatable types: "Webhooks" and "Custom".
     * POST /v3/a/{account_id}/integrations.json
     * body: { type, company_id, config }
     * For Webhooks, config keys include pre_call_webhook, post_call_webhook,
     * answered_call_webhook, updated_call_webhook, sms_received_webhook,
     * sms_sent_webhook, form_captured_webhook, post_outbound_call_webhook,
     * updated_outbound_call_webhook (each an array of URLs).
     */
    async createIntegration(accountId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.integrations(accountId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update an integration (state and/or config).
     * PUT /v3/a/{account_id}/integrations/{integration_id}.json
     */
    async updateIntegration(accountId, integrationId, data) {
        return this._put({
            url:
                this.baseUrl +
                this.URLs.integrationById(accountId, integrationId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Disable an integration.
     * DELETE /v3/a/{account_id}/integrations/{integration_id}.json
     * Returns 204 No Content on success.
     */
    async deleteIntegration(accountId, integrationId) {
        return this._delete({
            url:
                this.baseUrl +
                this.URLs.integrationById(accountId, integrationId),
        });
    }
}

module.exports = { Api };
