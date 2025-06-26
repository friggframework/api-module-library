const { Requester, get } = require('@friggframework/core');

class Api extends Requester {
    constructor(params) {
        super(params);
        this.apiKey = get(params, 'api_key', process.env.CONVERTKIT_API_KEY);
        this.apiSecret = get(params, 'api_secret', process.env.CONVERTKIT_API_SECRET);
        this.baseUrl = 'https://api.convertkit.com/v3';
        
        this.URLs = {
            // Account
            account: '/account',
            
            // Subscribers
            subscribers: '/subscribers',
            subscriberById: (subscriberId) => `/subscribers/${subscriberId}`,
            subscriberTags: (subscriberId) => `/subscribers/${subscriberId}/tags`,
            
            // Forms
            forms: '/forms',
            formById: (formId) => `/forms/${formId}`,
            formSubscriptions: (formId) => `/forms/${formId}/subscribe`,
            formSubscribers: (formId) => `/forms/${formId}/subscriptions`,
            
            // Landing Pages
            landingPages: '/landing_pages',
            landingPageById: (pageId) => `/landing_pages/${pageId}`,
            
            // Tags
            tags: '/tags',
            tagById: (tagId) => `/tags/${tagId}`,
            tagSubscriptions: (tagId) => `/tags/${tagId}/subscribe`,
            tagUnsubscriptions: (tagId) => `/tags/${tagId}/unsubscribe`,
            tagSubscribers: (tagId) => `/tags/${tagId}/subscriptions`,
            
            // Sequences
            sequences: '/sequences',
            sequenceById: (sequenceId) => `/sequences/${sequenceId}`,
            sequenceSubscriptions: (sequenceId) => `/sequences/${sequenceId}/subscribe`,
            sequenceSubscribers: (sequenceId) => `/sequences/${sequenceId}/subscriptions`,
            
            // Broadcasts
            broadcasts: '/broadcasts',
            broadcastById: (broadcastId) => `/broadcasts/${broadcastId}`,
            broadcastStats: (broadcastId) => `/broadcasts/${broadcastId}/stats`,
            
            // Custom Fields
            customFields: '/custom_fields',
            customFieldById: (fieldId) => `/custom_fields/${fieldId}`,
            
            // Segments
            segments: '/segments',
            segmentById: (segmentId) => `/segments/${segmentId}`,
            
            // Purchases
            purchases: '/purchases',
            purchaseById: (purchaseId) => `/purchases/${purchaseId}`,
            
            // Webhooks
            webhooks: '/automations/hooks',
            webhookById: (webhookId) => `/automations/hooks/${webhookId}`
        };
    }
    
    addAuthParams(options) {
        // ConvertKit uses API key and secret as query parameters
        const authParams = {
            api_key: this.apiKey,
            api_secret: this.apiSecret
        };
        
        options.query = {
            ...authParams,
            ...options.query,
        };
        
        const jsonHeaders = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        };
    }
    
    async _get(options) {
        this.addAuthParams(options);
        return super._get(options);
    }
    
    async _post(options, stringify = true) {
        this.addAuthParams(options);
        return super._post(options, stringify);
    }
    
    async _put(options, stringify = true) {
        this.addAuthParams(options);
        return super._put(options, stringify);
    }
    
    async _delete(options) {
        this.addAuthParams(options);
        return super._delete(options);
    }
    
    // **************************   Account   **********************************
    
    async getAccount() {
        const options = {
            url: this.baseUrl + this.URLs.account,
        };
        return this._get(options);
    }
    
    // **************************   Subscribers   **********************************
    
    async listSubscribers(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.subscribers,
            query: params
        };
        return this._get(options);
    }
    
    async getSubscriberById(subscriberId) {
        const options = {
            url: this.baseUrl + this.URLs.subscriberById(subscriberId),
        };
        return this._get(options);
    }
    
    async updateSubscriber(subscriberId, subscriberData) {
        const options = {
            url: this.baseUrl + this.URLs.subscriberById(subscriberId),
            body: subscriberData,
        };
        return this._put(options);
    }
    
    async unsubscribeSubscriber(subscriberId) {
        const options = {
            url: this.baseUrl + this.URLs.subscriberById(subscriberId) + '/unsubscribe',
        };
        return this._put(options, false);
    }
    
    async tagSubscriber(subscriberId, tagData) {
        const options = {
            url: this.baseUrl + this.URLs.subscriberTags(subscriberId),
            body: tagData,
        };
        return this._post(options);
    }
    
    async untagSubscriber(subscriberId, tagData) {
        const options = {
            url: this.baseUrl + this.URLs.subscriberTags(subscriberId),
            body: tagData,
        };
        return this._delete(options);
    }
    
    // **************************   Forms   **********************************
    
    async listForms() {
        const options = {
            url: this.baseUrl + this.URLs.forms,
        };
        return this._get(options);
    }
    
    async getFormById(formId) {
        const options = {
            url: this.baseUrl + this.URLs.formById(formId),
        };
        return this._get(options);
    }
    
    async subscribeToForm(formId, subscriberData) {
        const options = {
            url: this.baseUrl + this.URLs.formSubscriptions(formId),
            body: subscriberData,
        };
        return this._post(options);
    }
    
    async getFormSubscribers(formId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.formSubscribers(formId),
            query: params
        };
        return this._get(options);
    }
    
    // **************************   Landing Pages   **********************************
    
    async listLandingPages() {
        const options = {
            url: this.baseUrl + this.URLs.landingPages,
        };
        return this._get(options);
    }
    
    async getLandingPageById(pageId) {
        const options = {
            url: this.baseUrl + this.URLs.landingPageById(pageId),
        };
        return this._get(options);
    }
    
    // **************************   Tags   **********************************
    
    async listTags() {
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
    
    async getTagById(tagId) {
        const options = {
            url: this.baseUrl + this.URLs.tagById(tagId),
        };
        return this._get(options);
    }
    
    async subscribeToTag(tagId, subscriberData) {
        const options = {
            url: this.baseUrl + this.URLs.tagSubscriptions(tagId),
            body: subscriberData,
        };
        return this._post(options);
    }
    
    async unsubscribeFromTag(tagId, subscriberData) {
        const options = {
            url: this.baseUrl + this.URLs.tagUnsubscriptions(tagId),
            body: subscriberData,
        };
        return this._post(options);
    }
    
    async getTagSubscribers(tagId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.tagSubscribers(tagId),
            query: params
        };
        return this._get(options);
    }
    
    // **************************   Sequences   **********************************
    
    async listSequences() {
        const options = {
            url: this.baseUrl + this.URLs.sequences,
        };
        return this._get(options);
    }
    
    async getSequenceById(sequenceId) {
        const options = {
            url: this.baseUrl + this.URLs.sequenceById(sequenceId),
        };
        return this._get(options);
    }
    
    async subscribeToSequence(sequenceId, subscriberData) {
        const options = {
            url: this.baseUrl + this.URLs.sequenceSubscriptions(sequenceId),
            body: subscriberData,
        };
        return this._post(options);
    }
    
    async getSequenceSubscribers(sequenceId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.sequenceSubscribers(sequenceId),
            query: params
        };
        return this._get(options);
    }
    
    // **************************   Broadcasts   **********************************
    
    async listBroadcasts() {
        const options = {
            url: this.baseUrl + this.URLs.broadcasts,
        };
        return this._get(options);
    }
    
    async createBroadcast(broadcastData) {
        const options = {
            url: this.baseUrl + this.URLs.broadcasts,
            body: broadcastData,
        };
        return this._post(options);
    }
    
    async getBroadcastById(broadcastId) {
        const options = {
            url: this.baseUrl + this.URLs.broadcastById(broadcastId),
        };
        return this._get(options);
    }
    
    async getBroadcastStats(broadcastId) {
        const options = {
            url: this.baseUrl + this.URLs.broadcastStats(broadcastId),
        };
        return this._get(options);
    }
    
    // **************************   Custom Fields   **********************************
    
    async listCustomFields() {
        const options = {
            url: this.baseUrl + this.URLs.customFields,
        };
        return this._get(options);
    }
    
    async createCustomField(fieldData) {
        const options = {
            url: this.baseUrl + this.URLs.customFields,
            body: fieldData,
        };
        return this._post(options);
    }
    
    async updateCustomField(fieldId, fieldData) {
        const options = {
            url: this.baseUrl + this.URLs.customFieldById(fieldId),
            body: fieldData,
        };
        return this._put(options);
    }
    
    async deleteCustomField(fieldId) {
        const options = {
            url: this.baseUrl + this.URLs.customFieldById(fieldId),
        };
        return this._delete(options);
    }
    
    // **************************   Purchases   **********************************
    
    async createPurchase(purchaseData) {
        const options = {
            url: this.baseUrl + this.URLs.purchases,
            body: purchaseData,
        };
        return this._post(options);
    }
    
    async listPurchases(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.purchases,
            query: params
        };
        return this._get(options);
    }
    
    async getPurchaseById(purchaseId) {
        const options = {
            url: this.baseUrl + this.URLs.purchaseById(purchaseId),
        };
        return this._get(options);
    }
}

module.exports = { Api };
