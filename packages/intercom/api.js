const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = 'https://api.intercom.io';
        
        this.URLs = {
            authorization: '/oauth',
            access_token: '/auth/eagle/token',
            
            // Identity
            me: '/me',
            
            // Contacts
            contacts: '/contacts',
            contactById: (contactId) => `/contacts/${contactId}`,
            contactSearch: '/contacts/search',
            
            // Companies
            companies: '/companies',
            companyById: (companyId) => `/companies/${companyId}`,
            companySearch: '/companies/search',
            
            // Conversations
            conversations: '/conversations',
            conversationById: (conversationId) => `/conversations/${conversationId}`,
            conversationSearch: '/conversations/search',
            conversationReply: (conversationId) => `/conversations/${conversationId}/reply`,
            conversationAssign: (conversationId) => `/conversations/${conversationId}/parts`,
            conversationClose: (conversationId) => `/conversations/${conversationId}/parts`,
            conversationOpen: (conversationId) => `/conversations/${conversationId}/parts`,
            conversationSnooze: (conversationId) => `/conversations/${conversationId}/parts`,
            
            // Messages
            messages: '/messages',
            
            // Events
            events: '/events',
            
            // Data Attributes
            dataAttributes: '/data_attributes',
            dataAttributeById: (attributeId) => `/data_attributes/${attributeId}`,
            
            // Tags
            tags: '/tags',
            tagById: (tagId) => `/tags/${tagId}`,
            
            // Segments
            segments: '/segments',
            segmentById: (segmentId) => `/segments/${segmentId}`,
            
            // Notes
            notes: '/notes',
            noteById: (noteId) => `/notes/${noteId}`,
            
            // Teams
            teams: '/teams',
            teamById: (teamId) => `/teams/${teamId}`,
            
            // Admins
            admins: '/admins',
            adminById: (adminId) => `/admins/${adminId}`,
            
            // Articles
            articles: '/articles',
            articleById: (articleId) => `/articles/${articleId}`,
            
            // Collections
            collections: '/help_center/collections',
            collectionById: (collectionId) => `/help_center/collections/${collectionId}`,
            
            // Webhooks
            webhooks: '/subscriptions',
            webhookById: (subscriptionId) => `/subscriptions/${subscriptionId}`,
        };

        this.authorizationUri = encodeURI(
            `https://app.intercom.com/oauth?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&scope=${this.scope}&state=${this.state}`
        );
        this.tokenUri = 'https://api.intercom.io/auth/eagle/token';

        this.access_token = get(params, 'access_token', null);
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    addApiHeaders(options) {
        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Intercom-Version': '2.10',
        };
        options.headers = {
            ...headers,
            ...options.headers,
        };
    }

    async _get(options) {
        this.addApiHeaders(options);
        return super._get(options);
    }

    async _post(options, stringify = true) {
        this.addApiHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify = true) {
        this.addApiHeaders(options);
        return super._patch(options, stringify);
    }

    async _put(options, stringify = true) {
        this.addApiHeaders(options);
        return super._put(options, stringify);
    }

    async _delete(options) {
        this.addApiHeaders(options);
        return super._delete(options);
    }

    // **************************   Identity Methods   **********************************

    async getMe() {
        const options = {
            url: this.baseUrl + this.URLs.me,
        };
        return this._get(options);
    }

    // **************************   Contacts Methods   **********************************

    async getContacts(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.contacts,
            query: params,
        };
        return this._get(options);
    }

    async createContact(contactData) {
        const options = {
            url: this.baseUrl + this.URLs.contacts,
            body: contactData,
        };
        return this._post(options);
    }

    async getContact(contactId) {
        const options = {
            url: this.baseUrl + this.URLs.contactById(contactId),
        };
        return this._get(options);
    }

    async updateContact(contactId, contactData) {
        const options = {
            url: this.baseUrl + this.URLs.contactById(contactId),
            body: contactData,
        };
        return this._put(options);
    }

    async deleteContact(contactId) {
        const options = {
            url: this.baseUrl + this.URLs.contactById(contactId),
        };
        return this._delete(options);
    }

    async searchContacts(searchQuery) {
        const options = {
            url: this.baseUrl + this.URLs.contactSearch,
            body: searchQuery,
        };
        return this._post(options);
    }

    async mergeContacts(leadingContactId, mergeData) {
        const options = {
            url: this.baseUrl + this.URLs.contactById(leadingContactId) + '/merge',
            body: mergeData,
        };
        return this._post(options);
    }

    // **************************   Companies Methods   **********************************

    async getCompanies(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.companies,
            query: params,
        };
        return this._get(options);
    }

    async createCompany(companyData) {
        const options = {
            url: this.baseUrl + this.URLs.companies,
            body: companyData,
        };
        return this._post(options);
    }

    async getCompany(companyId) {
        const options = {
            url: this.baseUrl + this.URLs.companyById(companyId),
        };
        return this._get(options);
    }

    async updateCompany(companyId, companyData) {
        const options = {
            url: this.baseUrl + this.URLs.companyById(companyId),
            body: companyData,
        };
        return this._put(options);
    }

    async deleteCompany(companyId) {
        const options = {
            url: this.baseUrl + this.URLs.companyById(companyId),
        };
        return this._delete(options);
    }

    async searchCompanies(searchQuery) {
        const options = {
            url: this.baseUrl + this.URLs.companySearch,
            body: searchQuery,
        };
        return this._post(options);
    }

    // **************************   Conversations Methods   **********************************

    async getConversations(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.conversations,
            query: params,
        };
        return this._get(options);
    }

    async getConversation(conversationId) {
        const options = {
            url: this.baseUrl + this.URLs.conversationById(conversationId),
        };
        return this._get(options);
    }

    async searchConversations(searchQuery) {
        const options = {
            url: this.baseUrl + this.URLs.conversationSearch,
            body: searchQuery,
        };
        return this._post(options);
    }

    async replyToConversation(conversationId, replyData) {
        const options = {
            url: this.baseUrl + this.URLs.conversationReply(conversationId),
            body: replyData,
        };
        return this._post(options);
    }

    async assignConversation(conversationId, assigneeData) {
        const options = {
            url: this.baseUrl + this.URLs.conversationAssign(conversationId),
            body: {
                message_type: 'assignment',
                type: 'admin',
                ...assigneeData,
            },
        };
        return this._post(options);
    }

    async closeConversation(conversationId, closeData = {}) {
        const options = {
            url: this.baseUrl + this.URLs.conversationClose(conversationId),
            body: {
                message_type: 'close',
                type: 'admin',
                ...closeData,
            },
        };
        return this._post(options);
    }

    async openConversation(conversationId, openData = {}) {
        const options = {
            url: this.baseUrl + this.URLs.conversationOpen(conversationId),
            body: {
                message_type: 'open',
                type: 'admin',
                ...openData,
            },
        };
        return this._post(options);
    }

    async snoozeConversation(conversationId, snoozeUntil) {
        const options = {
            url: this.baseUrl + this.URLs.conversationSnooze(conversationId),
            body: {
                message_type: 'snoozed',
                type: 'admin',
                snoozed_until: snoozeUntil,
            },
        };
        return this._post(options);
    }

    // **************************   Messages Methods   **********************************

    async sendMessage(messageData) {
        const options = {
            url: this.baseUrl + this.URLs.messages,
            body: messageData,
        };
        return this._post(options);
    }

    // **************************   Events Methods   **********************************

    async createEvent(eventData) {
        const options = {
            url: this.baseUrl + this.URLs.events,
            body: eventData,
        };
        return this._post(options);
    }

    async getEvents(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.events,
            query: params,
        };
        return this._get(options);
    }

    // **************************   Data Attributes Methods   **********************************

    async getDataAttributes(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.dataAttributes,
            query: params,
        };
        return this._get(options);
    }

    async createDataAttribute(attributeData) {
        const options = {
            url: this.baseUrl + this.URLs.dataAttributes,
            body: attributeData,
        };
        return this._post(options);
    }

    async getDataAttribute(attributeId) {
        const options = {
            url: this.baseUrl + this.URLs.dataAttributeById(attributeId),
        };
        return this._get(options);
    }

    async updateDataAttribute(attributeId, attributeData) {
        const options = {
            url: this.baseUrl + this.URLs.dataAttributeById(attributeId),
            body: attributeData,
        };
        return this._put(options);
    }

    // **************************   Tags Methods   **********************************

    async getTags() {
        const options = {
            url: this.baseUrl + this.URLs.tags,
        };
        return this._get(options);
    }

    async createTag(tagData) {
        const options = {
            url: this.baseUrl + this.URLs.tags,
            body: tagData,
        };
        return this._post(options);
    }

    async getTag(tagId) {
        const options = {
            url: this.baseUrl + this.URLs.tagById(tagId),
        };
        return this._get(options);
    }

    async deleteTag(tagId) {
        const options = {
            url: this.baseUrl + this.URLs.tagById(tagId),
        };
        return this._delete(options);
    }

    // **************************   Notes Methods   **********************************

    async createNote(noteData) {
        const options = {
            url: this.baseUrl + this.URLs.notes,
            body: noteData,
        };
        return this._post(options);
    }

    async getNote(noteId) {
        const options = {
            url: this.baseUrl + this.URLs.noteById(noteId),
        };
        return this._get(options);
    }

    // **************************   Teams Methods   **********************************

    async getTeams() {
        const options = {
            url: this.baseUrl + this.URLs.teams,
        };
        return this._get(options);
    }

    async getTeam(teamId) {
        const options = {
            url: this.baseUrl + this.URLs.teamById(teamId),
        };
        return this._get(options);
    }

    // **************************   Admins Methods   **********************************

    async getAdmins() {
        const options = {
            url: this.baseUrl + this.URLs.admins,
        };
        return this._get(options);
    }

    async getAdmin(adminId) {
        const options = {
            url: this.baseUrl + this.URLs.adminById(adminId),
        };
        return this._get(options);
    }

    // **************************   Articles Methods   **********************************

    async getArticles(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.articles,
            query: params,
        };
        return this._get(options);
    }

    async createArticle(articleData) {
        const options = {
            url: this.baseUrl + this.URLs.articles,
            body: articleData,
        };
        return this._post(options);
    }

    async getArticle(articleId) {
        const options = {
            url: this.baseUrl + this.URLs.articleById(articleId),
        };
        return this._get(options);
    }

    async updateArticle(articleId, articleData) {
        const options = {
            url: this.baseUrl + this.URLs.articleById(articleId),
            body: articleData,
        };
        return this._put(options);
    }

    async deleteArticle(articleId) {
        const options = {
            url: this.baseUrl + this.URLs.articleById(articleId),
        };
        return this._delete(options);
    }

    // **************************   Collections Methods   **********************************

    async getCollections(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.collections,
            query: params,
        };
        return this._get(options);
    }

    async createCollection(collectionData) {
        const options = {
            url: this.baseUrl + this.URLs.collections,
            body: collectionData,
        };
        return this._post(options);
    }

    async getCollection(collectionId) {
        const options = {
            url: this.baseUrl + this.URLs.collectionById(collectionId),
        };
        return this._get(options);
    }

    async updateCollection(collectionId, collectionData) {
        const options = {
            url: this.baseUrl + this.URLs.collectionById(collectionId),
            body: collectionData,
        };
        return this._put(options);
    }

    async deleteCollection(collectionId) {
        const options = {
            url: this.baseUrl + this.URLs.collectionById(collectionId),
        };
        return this._delete(options);
    }

    // **************************   Webhooks Methods   **********************************

    async getWebhooks() {
        const options = {
            url: this.baseUrl + this.URLs.webhooks,
        };
        return this._get(options);
    }

    async createWebhook(webhookData) {
        const options = {
            url: this.baseUrl + this.URLs.webhooks,
            body: webhookData,
        };
        return this._post(options);
    }

    async getWebhook(subscriptionId) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(subscriptionId),
        };
        return this._get(options);
    }

    async deleteWebhook(subscriptionId) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(subscriptionId),
        };
        return this._delete(options);
    }

    // **************************   Helper Methods   **********************************

    async findContactByEmail(email) {
        const searchQuery = {
            query: {
                field: 'email',
                operator: '=',
                value: email,
            },
        };
        return this.searchContacts(searchQuery);
    }

    async sendMessageToContact(contactId, messageBody, messageType = 'inbound') {
        const messageData = {
            message_type: messageType,
            body: messageBody,
            from: {
                type: 'contact',
                id: contactId,
            },
        };
        return this.sendMessage(messageData);
    }
}

module.exports = { Api };