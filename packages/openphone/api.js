const { ApiKeyRequester, get } = require('@friggframework/core');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.openphone.com';

        // API key is expected to be passed as a parameter
        this.api_key = get(params, 'api_key', null);

        this.URLs = {
            // Calls endpoints
            calls: '/v1/calls',
            callById: (callId) => `/v1/calls/${callId}`,
            callRecordings: (callId) => `/v1/call-recordings/${callId}`,
            callSummary: (callId) => `/v1/call-summaries/${callId}`,
            callTranscript: (callId) => `/v1/call-transcripts/${callId}`,

            // Messages endpoints
            messages: '/v1/messages',
            messageById: (messageId) => `/v1/messages/${messageId}`,

            // Contacts endpoints
            contacts: '/v1/contacts',
            contactById: (contactId) => `/v1/contacts/${contactId}`,
            contactCustomFields: '/v1/contact-custom-fields',

            // Conversations endpoints
            conversations: '/v1/conversations',

            // Phone Numbers endpoints
            phoneNumbers: '/v1/phone-numbers',

            // Webhooks endpoints
            webhooks: '/v1/webhooks',
            webhookById: (webhookId) => `/v1/webhooks/${webhookId}`,
            messageWebhooks: '/v1/webhooks/messages',
            callWebhooks: '/v1/webhooks/calls',
            callSummaryWebhooks: '/v1/webhooks/call-summaries',
            callTranscriptWebhooks: '/v1/webhooks/call-transcripts',
        };
    }

    // Calls API methods
    async getCalls(options = {}) {
        const query = this._cleanParams({
            phoneNumberId: options.phoneNumberId,
            userId: options.userId,
            participants: options.participants,
            since: options.since,
            createdAfter: options.createdAfter,
            createdBefore: options.createdBefore,
            maxResults: options.maxResults || 10,
            pageToken: options.pageToken
        });

        return this._get({
            url: this.baseUrl + this.URLs.calls,
            query
        });
    }

    async getCallById(callId) {
        return this._get({
            url: this.baseUrl + this.URLs.callById(callId)
        });
    }

    async getCallRecordings(callId) {
        return this._get({
            url: this.baseUrl + this.URLs.callRecordings(callId)
        });
    }

    async getCallSummary(callId) {
        return this._get({
            url: this.baseUrl + this.URLs.callSummary(callId)
        });
    }

    async getCallTranscript(callId) {
        return this._get({
            url: this.baseUrl + this.URLs.callTranscript(callId)
        });
    }

    // Messages API methods
    async getMessages(options = {}) {
        const query = this._cleanParams({
            phoneNumberId: options.phoneNumberId,
            userId: options.userId,
            participants: options.participants,
            since: options.since,
            createdAfter: options.createdAfter,
            createdBefore: options.createdBefore,
            maxResults: options.maxResults || 10,
            pageToken: options.pageToken
        });

        return this._get({
            url: this.baseUrl + this.URLs.messages,
            query
        });
    }

    async getMessageById(messageId) {
        return this._get({
            url: this.baseUrl + this.URLs.messageById(messageId)
        });
    }

    async sendMessage(body) {
        return this._post({
            url: this.baseUrl + this.URLs.messages,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    // Contacts API methods
    async getContacts(options = {}) {
        const query = this._cleanParams({
            externalIds: options.externalIds,
            sources: options.sources,
            maxResults: options.maxResults || 10,
            pageToken: options.pageToken
        });

        return this._get({
            url: this.baseUrl + this.URLs.contacts,
            query
        });
    }

    async getContactById(contactId) {
        return this._get({
            url: this.baseUrl + this.URLs.contactById(contactId)
        });
    }

    async createContact(body) {
        return this._post({
            url: this.baseUrl + this.URLs.contacts,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async updateContact(contactId, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.contactById(contactId),
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async deleteContact(contactId) {
        return this._delete({
            url: this.baseUrl + this.URLs.contactById(contactId)
        });
    }

    async getContactCustomFields() {
        return this._get({
            url: this.baseUrl + this.URLs.contactCustomFields
        });
    }

    // Conversations API methods
    async getConversations(options = {}) {
        const query = this._cleanParams({
            phoneNumber: options.phoneNumber,
            phoneNumbers: options.phoneNumbers,
            userId: options.userId,
            createdAfter: options.createdAfter,
            createdBefore: options.createdBefore,
            excludeInactive: options.excludeInactive,
            updatedAfter: options.updatedAfter,
            updatedBefore: options.updatedBefore,
            maxResults: options.maxResults || 10,
            pageToken: options.pageToken
        });

        return this._get({
            url: this.baseUrl + this.URLs.conversations,
            query
        });
    }

    // Phone Numbers API methods
    async getPhoneNumbers(options = {}) {
        const query = this._cleanParams({
            userId: options.userId
        });

        return this._get({
            url: this.baseUrl + this.URLs.phoneNumbers,
            query
        });
    }

    // Webhooks API methods
    async getWebhooks(options = {}) {
        const query = this._cleanParams({
            userId: options.userId
        });

        return this._get({
            url: this.baseUrl + this.URLs.webhooks,
            query
        });
    }

    async getWebhookById(webhookId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(webhookId)
        });
    }

    async deleteWebhook(webhookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(webhookId)
        });
    }

    async createMessageWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.messageWebhooks,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async createCallWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.callWebhooks,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async createCallSummaryWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.callSummaryWebhooks,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async createCallTranscriptWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.callTranscriptWebhooks,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    // Helper methods
    async getCurrentUser() {
        const phoneNumbers = await this.getPhoneNumbers();
        return phoneNumbers.data && phoneNumbers.data.length > 0
            ? phoneNumbers.data[0].users[0]
            : null;
    }

    _cleanParams(params) {
        const cleaned = {};
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                cleaned[key] = params[key];
            }
        });
        return cleaned;
    }

    addAuthHeaders(headers) {
        if (this.api_key) {
            headers.Authorization = this.api_key;
        }
        return headers;
    }
}

module.exports = { Api }; 