const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.createsend.com/api/v3.3';
        
        this.URLs = {
            // Authentication
            userInfo: '/account',
            
            // Clients
            clients: '/clients',
            clientById: (clientId) => `/clients/${clientId}`,
            clientDetails: (clientId) => `/clients/${clientId}`,
            
            // Lists
            lists: (clientId) => `/clients/${clientId}/lists`,
            listById: (listId) => `/lists/${listId}`,
            listStats: (listId) => `/lists/${listId}/stats`,
            listSegments: (listId) => `/lists/${listId}/segments`,
            
            // Subscribers
            subscribers: (listId) => `/lists/${listId}/subscribers`,
            subscriberByEmail: (listId, email) => `/lists/${listId}/subscribers/${email}`,
            subscriberHistory: (listId, email) => `/lists/${listId}/subscribers/${email}/history`,
            
            // Campaigns
            campaigns: (clientId) => `/clients/${clientId}/campaigns`,
            campaignById: (campaignId) => `/campaigns/${campaignId}`,
            campaignSummary: (campaignId) => `/campaigns/${campaignId}/summary`,
            campaignBounces: (campaignId) => `/campaigns/${campaignId}/bounces`,
            campaignClicks: (campaignId) => `/campaigns/${campaignId}/clicks`,
            campaignOpens: (campaignId) => `/campaigns/${campaignId}/opens`,
            campaignUnsubscribes: (campaignId) => `/campaigns/${campaignId}/unsubscribes`,
            
            // Templates
            templates: (clientId) => `/clients/${clientId}/templates`,
            templateById: (templateId) => `/templates/${templateId}`,
            
            // Segments
            segmentById: (segmentId) => `/segments/${segmentId}`,
            segmentSubscribers: (segmentId) => `/segments/${segmentId}/subscribers`,
            
            // Journey
            journeys: (clientId) => `/clients/${clientId}/journeys`,
            journeyById: (journeyId) => `/journeys/${journeyId}`,
            journeyEmails: (journeyId) => `/journeys/${journeyId}/emails`,
            
            // Transactional
            transactionalSend: '/transactional/classicEmail/send',
            transactionalStats: '/transactional/statistics'
        };
        
        this.authorizationUri = encodeURI(
            `https://api.createsend.com/oauth?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}&scope=${this.scope}`
        );
        this.tokenUri = 'https://api.createsend.com/oauth/token';
        
        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }
    
    async getUserDetails() {
        const options = {
            url: this.baseUrl + this.URLs.userInfo,
        };
        return this._get(options);
    }
    
    // **************************   Clients   **********************************
    
    async listClients() {
        const options = {
            url: this.baseUrl + this.URLs.clients,
        };
        return this._get(options);
    }
    
    async getClientById(clientId) {
        const options = {
            url: this.baseUrl + this.URLs.clientById(clientId),
        };
        return this._get(options);
    }
    
    async createClient(clientData) {
        const options = {
            url: this.baseUrl + this.URLs.clients,
            body: clientData,
        };
        return this._post(options);
    }
    
    async updateClient(clientId, clientData) {
        const options = {
            url: this.baseUrl + this.URLs.clientById(clientId),
            body: clientData,
        };
        return this._put(options);
    }
    
    async deleteClient(clientId) {
        const options = {
            url: this.baseUrl + this.URLs.clientById(clientId),
        };
        return this._delete(options);
    }
    
    // **************************   Lists   **********************************
    
    async listSubscriberLists(clientId) {
        const options = {
            url: this.baseUrl + this.URLs.lists(clientId),
        };
        return this._get(options);
    }
    
    async createList(clientId, listData) {
        const options = {
            url: this.baseUrl + this.URLs.lists(clientId),
            body: listData,
        };
        return this._post(options);
    }
    
    async getListById(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
        };
        return this._get(options);
    }
    
    async updateList(listId, listData) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
            body: listData,
        };
        return this._put(options);
    }
    
    async deleteList(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
        };
        return this._delete(options);
    }
    
    async getListStats(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listStats(listId),
        };
        return this._get(options);
    }
    
    // **************************   Subscribers   **********************************
    
    async listSubscribers(listId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.subscribers(listId),
            query: params
        };
        return this._get(options);
    }
    
    async addSubscriber(listId, subscriberData) {
        const options = {
            url: this.baseUrl + this.URLs.subscribers(listId),
            body: subscriberData,
        };
        return this._post(options);
    }
    
    async getSubscriberByEmail(listId, email) {
        const options = {
            url: this.baseUrl + this.URLs.subscriberByEmail(listId, encodeURIComponent(email)),
        };
        return this._get(options);
    }
    
    async updateSubscriber(listId, email, subscriberData) {
        const options = {
            url: this.baseUrl + this.URLs.subscriberByEmail(listId, encodeURIComponent(email)),
            body: subscriberData,
        };
        return this._put(options);
    }
    
    async unsubscribeSubscriber(listId, email) {
        const options = {
            url: this.baseUrl + this.URLs.subscriberByEmail(listId, encodeURIComponent(email)) + '/unsubscribe',
        };
        return this._post(options, false);
    }
    
    async deleteSubscriber(listId, email) {
        const options = {
            url: this.baseUrl + this.URLs.subscriberByEmail(listId, encodeURIComponent(email)),
        };
        return this._delete(options);
    }
    
    // **************************   Campaigns   **********************************
    
    async listCampaigns(clientId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.campaigns(clientId),
            query: params
        };
        return this._get(options);
    }
    
    async createCampaign(clientId, campaignData) {
        const options = {
            url: this.baseUrl + this.URLs.campaigns(clientId),
            body: campaignData,
        };
        return this._post(options);
    }
    
    async getCampaignById(campaignId) {
        const options = {
            url: this.baseUrl + this.URLs.campaignById(campaignId),
        };
        return this._get(options);
    }
    
    async sendCampaign(campaignId, sendData) {
        const options = {
            url: this.baseUrl + this.URLs.campaignById(campaignId) + '/send',
            body: sendData,
        };
        return this._post(options);
    }
    
    async getCampaignSummary(campaignId) {
        const options = {
            url: this.baseUrl + this.URLs.campaignSummary(campaignId),
        };
        return this._get(options);
    }
    
    async getCampaignBounces(campaignId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.campaignBounces(campaignId),
            query: params
        };
        return this._get(options);
    }
    
    async getCampaignClicks(campaignId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.campaignClicks(campaignId),
            query: params
        };
        return this._get(options);
    }
    
    async getCampaignOpens(campaignId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.campaignOpens(campaignId),
            query: params
        };
        return this._get(options);
    }
    
    // **************************   Templates   **********************************
    
    async listTemplates(clientId) {
        const options = {
            url: this.baseUrl + this.URLs.templates(clientId),
        };
        return this._get(options);
    }
    
    async createTemplate(clientId, templateData) {
        const options = {
            url: this.baseUrl + this.URLs.templates(clientId),
            body: templateData,
        };
        return this._post(options);
    }
    
    async getTemplateById(templateId) {
        const options = {
            url: this.baseUrl + this.URLs.templateById(templateId),
        };
        return this._get(options);
    }
    
    async updateTemplate(templateId, templateData) {
        const options = {
            url: this.baseUrl + this.URLs.templateById(templateId),
            body: templateData,
        };
        return this._put(options);
    }
    
    async deleteTemplate(templateId) {
        const options = {
            url: this.baseUrl + this.URLs.templateById(templateId),
        };
        return this._delete(options);
    }
    
    // **************************   Transactional   **********************************
    
    async sendTransactionalEmail(emailData) {
        const options = {
            url: this.baseUrl + this.URLs.transactionalSend,
            body: emailData,
        };
        return this._post(options);
    }
    
    async getTransactionalStats(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.transactionalStats,
            query: params
        };
        return this._get(options);
    }
}

module.exports = { Api };
