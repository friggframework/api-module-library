const { get, ApiKeyRequester } = require('@friggframework/core');

/**
 * Quo (formerly OpenPhone) API client.
 *
 * Auth: API key sent RAW in the `Authorization` header (no `Bearer` prefix).
 *   Authorization: <api-key>
 *
 * Base URL: https://api.openphone.com/v1
 * Docs: https://www.quo.com/docs/api-reference/authentication
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        // Quo/OpenPhone uses the Authorization header with the raw key.
        this.api_key_name = 'Authorization';

        // Accept either `api_key` or `access_token` (Frigg credential persistence
        // uses access_token for API-key modules by convention).
        const apiKey =
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            process.env.QUO_API_KEY ||
            null;
        if (apiKey) {
            this.setApiKey(apiKey);
        }

        this.baseUrl = get(params, 'baseUrl', null) ||
            process.env.QUO_BASE_URL ||
            'https://api.openphone.com/v1';

        this.URLs = {
            // Calls
            calls: '/calls',
            callById: (id) => `/calls/${id}`,
            callRecordings: (callId) => `/call-recordings/${callId}`,
            callTranscript: (callId) => `/call-transcripts/${callId}`,
            callSummary: (callId) => `/call-summaries/${callId}`,
            // Messages
            messages: '/messages',
            messageById: (id) => `/messages/${id}`,
            // Contacts
            contacts: '/contacts',
            contactById: (id) => `/contacts/${id}`,
            // Phone numbers
            phoneNumbers: '/phone-numbers',
            phoneNumberById: (id) => `/phone-numbers/${id}`,
            // Users
            users: '/users',
            userById: (id) => `/users/${id}`,
            // Webhooks
            webhooks: '/webhooks',
            webhookById: (id) => `/webhooks/${id}`,
            webhookCalls: '/webhooks/calls',
            webhookMessages: '/webhooks/messages',
            webhookCallSummaries: '/webhooks/call-summaries',
            webhookCallTranscripts: '/webhooks/call-transcripts',
        };
    }

    // ---- Phone numbers / users (used for auth test + resolving IDs) ----

    async listPhoneNumbers(query = {}) {
        return this._get({ url: this.baseUrl + this.URLs.phoneNumbers, query });
    }

    async getPhoneNumber(id) {
        return this._get({ url: this.baseUrl + this.URLs.phoneNumberById(id) });
    }

    async listUsers(query = {}) {
        return this._get({ url: this.baseUrl + this.URLs.users, query });
    }

    async getUser(id) {
        return this._get({ url: this.baseUrl + this.URLs.userById(id) });
    }

    // ---- Calls ----

    /**
     * List calls.
     * @param {object} query - phoneNumberId (required, ^PN...), participants[]
     *   (E.164, max 1), userId (^US...), maxResults (1-100), pageToken,
     *   createdAfter, createdBefore.
     */
    async listCalls(query = {}) {
        return this._get({ url: this.baseUrl + this.URLs.calls, query });
    }

    async getCall(id) {
        return this._get({ url: this.baseUrl + this.URLs.callById(id) });
    }

    async getCallRecordings(callId) {
        return this._get({ url: this.baseUrl + this.URLs.callRecordings(callId) });
    }

    async getCallTranscript(callId) {
        return this._get({ url: this.baseUrl + this.URLs.callTranscript(callId) });
    }

    async getCallSummary(callId) {
        return this._get({ url: this.baseUrl + this.URLs.callSummary(callId) });
    }

    // ---- Messages ----

    /**
     * List messages.
     * @param {object} query - phoneNumberId (required, ^PN...), participants[]
     *   (E.164, max 10), userId, maxResults (1-100), pageToken,
     *   createdAfter, createdBefore.
     */
    async listMessages(query = {}) {
        return this._get({ url: this.baseUrl + this.URLs.messages, query });
    }

    async getMessage(id) {
        return this._get({ url: this.baseUrl + this.URLs.messageById(id) });
    }

    async sendMessage(body) {
        return this._post({
            url: this.baseUrl + this.URLs.messages,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Contacts ----

    async listContacts(query = {}) {
        return this._get({ url: this.baseUrl + this.URLs.contacts, query });
    }

    async getContact(id) {
        return this._get({ url: this.baseUrl + this.URLs.contactById(id) });
    }

    async createContact(body) {
        return this._post({
            url: this.baseUrl + this.URLs.contacts,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Webhooks ----

    async listWebhooks(query = {}) {
        return this._get({ url: this.baseUrl + this.URLs.webhooks, query });
    }

    async getWebhook(id) {
        return this._get({ url: this.baseUrl + this.URLs.webhookById(id) });
    }

    async createCallWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookCalls,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    async createMessageWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookMessages,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    async createCallSummaryWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookCallSummaries,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    async createCallTranscriptWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookCallTranscripts,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    async deleteWebhook(id) {
        return this._delete({ url: this.baseUrl + this.URLs.webhookById(id) });
    }
}

module.exports = { Api };
