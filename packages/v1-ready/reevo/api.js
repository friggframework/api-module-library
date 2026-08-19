const { ApiKeyRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Reevo public API client.
 *
 * Reevo is an AI-native Revenue OS (CRM). Its public API is a flat, API-key
 * authenticated REST surface: every request carries an `x-api-key` header and
 * hits `https://api.reevo.ai/api/v1/public`.
 *
 * Docs: https://help.reevo.ai/Data-management-and-migration/Integrations-With-Other-Tools
 *
 * The canonical machine-readable contract lives in ./reevo.openapi.yaml — this
 * client mirrors it 1:1 (one method per operationId). Keep them in sync.
 */
class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);

        // Reevo authenticates with a static API key in the `x-api-key` header.
        // ApiKeyRequester.addAuthHeaders() injects `headers[this.api_key_name] = this.api_key`.
        this.api_key_name = 'x-api-key';
        this.api_key = get(params, 'api_key', null);

        this.baseUrl = 'https://api.reevo.ai/api/v1/public';

        this.URLs = {
            accountContact: '/account_contact',
            accounts: '/accounts',
            accountById: (accountId) => `/accounts/${accountId}`,
            accountsSearch: '/accounts/search',
            contactById: (contactId) => `/contacts/${contactId}`,
            contactsSearch: '/contacts/search',
            opportunities: '/opportunities',
            opportunityById: (opportunityId) => `/opportunities/${opportunityId}`,
            opportunitiesSearch: '/opportunities/search',
            opportunityShiftStage: (opportunityId) =>
                `/opportunities/${opportunityId}/shift_stage`,
            tasks: '/tasks',
            manualActivities: '/manual_activities',
            usersSearch: '/users/search',
            mailboxesSearch: '/mailboxes/search',
            sequenceEnrollments: '/sequence_enrollments',
            accountAndContactRetrieval: '/account_and_contact_retrieval',
        };
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
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
                        'ui:help':
                            'Find your Reevo API key under Settings → API in your Reevo workspace. It is sent as the x-api-key header.',
                        'ui:placeholder': 'Your Reevo API Key',
                    },
                },
            },
        };
    }

    // ---- Accounts & Contacts (combined upsert) ------------------------------

    /**
     * Upsert an account and contact together in one call. Requires `email`.
     * Reevo expects the `payload_type=json` query parameter for JSON bodies.
     */
    async upsertAccountContact(body) {
        const options = {
            url: this.baseUrl + this.URLs.accountContact,
            query: { payload_type: 'json' },
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._post(options);
    }

    // ---- Accounts -----------------------------------------------------------

    async createAccount(body) {
        const options = {
            url: this.baseUrl + this.URLs.accounts,
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._post(options);
    }

    async updateAccount(accountId, body) {
        const options = {
            url: this.baseUrl + this.URLs.accountById(accountId),
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._patch(options);
    }

    async getAccount(accountId) {
        const options = {
            url: this.baseUrl + this.URLs.accountById(accountId),
        };
        return this._get(options);
    }

    /** Search accounts by domain. Requires `domain_name`. */
    async searchAccounts(body) {
        const options = {
            url: this.baseUrl + this.URLs.accountsSearch,
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._post(options);
    }

    // ---- Contacts -----------------------------------------------------------

    async getContact(contactId) {
        const options = {
            url: this.baseUrl + this.URLs.contactById(contactId),
        };
        return this._get(options);
    }

    /** Search contacts. Requires at least one of `contact_email` or `owner_email`. */
    async searchContacts(body) {
        const options = {
            url: this.baseUrl + this.URLs.contactsSearch,
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._post(options);
    }

    // ---- Opportunities ------------------------------------------------------

    /** Create an opportunity. Requires `display_name` and `account_id`. */
    async createOpportunity(body) {
        const options = {
            url: this.baseUrl + this.URLs.opportunities,
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._post(options);
    }

    async updateOpportunity(opportunityId, body) {
        const options = {
            url: this.baseUrl + this.URLs.opportunityById(opportunityId),
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._patch(options);
    }

    async getOpportunity(opportunityId) {
        const options = {
            url: this.baseUrl + this.URLs.opportunityById(opportunityId),
        };
        return this._get(options);
    }

    async searchOpportunities(body) {
        const options = {
            url: this.baseUrl + this.URLs.opportunitiesSearch,
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._post(options);
    }

    /**
     * Move an opportunity to a new stage. Requires `target_stage_name`.
     * Stage changes cannot be made through updateOpportunity — they go here.
     */
    async shiftOpportunityStage(opportunityId, body) {
        const options = {
            url: this.baseUrl + this.URLs.opportunityShiftStage(opportunityId),
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._post(options);
    }

    // ---- Tasks & Activities -------------------------------------------------

    /** Create a task. Requires `title` and `owner_email`. */
    async createTask(body) {
        const options = {
            url: this.baseUrl + this.URLs.tasks,
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._post(options);
    }

    /**
     * Log a manual activity (e.g. a logged call, conversation-intelligence
     * summary, or meeting note). Requires `metadata.activity_time`,
     * `metadata.subject`, and `metadata.description`.
     */
    async createManualActivity(body) {
        const options = {
            url: this.baseUrl + this.URLs.manualActivities,
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._post(options);
    }

    // ---- Users, Mailboxes & Sequences --------------------------------------

    /** Look up a Reevo user. Requires `email`. */
    async searchUsers(body) {
        const options = {
            url: this.baseUrl + this.URLs.usersSearch,
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._post(options);
    }

    /** Look up a user's mailbox. Requires `owner_user_email`. */
    async searchMailboxes(body) {
        const options = {
            url: this.baseUrl + this.URLs.mailboxesSearch,
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._post(options);
    }

    /** Enroll a contact in a sequence. Requires `contact_email` and `sequence_id`. */
    async createSequenceEnrollment(body) {
        const options = {
            url: this.baseUrl + this.URLs.sequenceEnrollments,
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._post(options);
    }

    // ---- Combined retrieval -------------------------------------------------

    /**
     * Retrieve an account and its contact by exactly one identifier.
     * Provide one (and only one) of: `contact_email`, `account_domain`,
     * `contact_phone_number`. Phone numbers must be URL-encoded (`+` → `%2B`).
     */
    async retrieveAccountAndContact(params = {}) {
        const keys = ['contact_email', 'account_domain', 'contact_phone_number'];
        const provided = keys.filter((k) => get(params, k, null) !== null);
        if (provided.length !== 1) {
            throw new Error(
                `retrieveAccountAndContact requires exactly one of ${keys.join(
                    ', '
                )} (received ${provided.length}).`
            );
        }
        const options = {
            url: this.baseUrl + this.URLs.accountAndContactRetrieval,
            query: { [provided[0]]: params[provided[0]] },
        };
        return this._get(options);
    }

    // ---- Auth check ---------------------------------------------------------

    /**
     * Lightweight authenticated request used to validate the API key.
     * A valid key returns 200 (an empty match set is fine); an invalid key
     * returns 401, which the requester surfaces as an error.
     */
    async testAuth() {
        return this.searchAccounts({
            domain_name: 'frigg-connection-test.invalid',
            limit: 1,
            offset: 0,
        });
    }
}

module.exports = { Api };
