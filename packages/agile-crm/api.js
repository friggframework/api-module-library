const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.agilecrm.com/dev/api';
        
        this.URLs = {
            // Authentication
            userInfo: '/users',
            
            // Contacts
            contacts: '/contacts',
            contactById: (contactId) => `/contacts/${contactId}`,
            
            // Companies
            companies: '/contacts/companies/list',
            companyById: (companyId) => `/contacts/companies/${companyId}`,
            
            // Deals
            deals: '/opportunity',
            dealById: (dealId) => `/opportunity/${dealId}`,
            
            // Tasks
            tasks: '/tasks',
            taskById: (taskId) => `/tasks/${taskId}`,
            
            // Notes
            notes: '/notes',
            noteById: (noteId) => `/notes/${noteId}`
        };
        
        this.authorizationUri = encodeURI(
            `https://api.agilecrm.com/oauth/authorize?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}&scope=${this.scope}`
        );
        this.tokenUri = 'https://api.agilecrm.com/oauth/token';
        
        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }
    
    async getUserDetails() {
        const options = {
            url: this.baseUrl + this.URLs.userInfo,
        };
        return this._get(options);
    }
    
    // **************************   Contacts   **********************************
    
    async createContact(body) {
        const options = {
            url: this.baseUrl + this.URLs.contacts,
            body: body,
        };
        return this._post(options);
    }
    
    async listContacts(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.contacts,
            query: params
        };
        return this._get(options);
    }
    
    async updateContact(id, body) {
        const options = {
            url: this.baseUrl + this.URLs.contactById(id),
            body: body,
        };
        return this._put(options);
    }
    
    async deleteContact(id) {
        const options = {
            url: this.baseUrl + this.URLs.contactById(id),
        };
        return this._delete(options);
    }
    
    async getContactById(id) {
        const options = {
            url: this.baseUrl + this.URLs.contactById(id),
        };
        return this._get(options);
    }
    
    // **************************   Companies   **********************************
    
    async createCompany(body) {
        const options = {
            url: this.baseUrl + this.URLs.companies,
            body: body,
        };
        return this._post(options);
    }
    
    async listCompanies(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.companies,
            query: params
        };
        return this._get(options);
    }
    
    async getCompanyById(id) {
        const options = {
            url: this.baseUrl + this.URLs.companyById(id),
        };
        return this._get(options);
    }
    
    // **************************   Deals   **********************************
    
    async createDeal(body) {
        const options = {
            url: this.baseUrl + this.URLs.deals,
            body: body,
        };
        return this._post(options);
    }
    
    async listDeals(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.deals,
            query: params
        };
        return this._get(options);
    }
    
    async updateDeal(id, body) {
        const options = {
            url: this.baseUrl + this.URLs.dealById(id),
            body: body,
        };
        return this._put(options);
    }
    
    async deleteDeal(id) {
        const options = {
            url: this.baseUrl + this.URLs.dealById(id),
        };
        return this._delete(options);
    }
    
    async getDealById(id) {
        const options = {
            url: this.baseUrl + this.URLs.dealById(id),
        };
        return this._get(options);
    }
}

module.exports = { Api };
