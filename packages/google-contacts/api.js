const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://people.googleapis.com';
        
        this.URLs = {
            me: '/user/profile',
            list: '/items',
            create: '/items',
            update: '/items/:id',
            delete: '/items/:id'
        };
        
        this.authorizationUri = 'https://people.googleapis.com/oauth/authorize';
        this.accessTokenUri = 'https://people.googleapis.com/oauth/token';
    }

    static Definition = {
        DISPLAY_NAME: 'Google Contacts',
        MODULE_NAME: 'google-contacts',
        CATEGORY: 'CRM',
        USES_OAUTH: true
    };

    // OAuth2 Implementation
    async getAuthorizationRequirements() {
        return {
            url: this.authorizationUri,
            type: 'oauth2',
            scope: this.scope || 'read write'
        };
    }

    async getTokenFromCode(code) {
        const body = {
            grant_type: 'authorization_code',
            code: code,
            client_id: this.clientId,
            client_secret: this.clientSecret,
            redirect_uri: this.redirectUri
        };
        
        const options = {
            body: body,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };
        
        return this.post(this.accessTokenUri, options);
    }

    // API Methods
    async getCurrentUser() {
        return this.get(this.URLs.me);
    }

    async listItems(params = {}) {
        return this.get(this.URLs.list, { params });
    }

    async createItem(data) {
        return this.post(this.URLs.create, data);
    }

    async updateItem(id, data) {
        const url = this.URLs.update.replace(':id', id);
        return this.put(url, data);
    }

    async deleteItem(id) {
        const url = this.URLs.delete.replace(':id', id);
        return this.delete(url);
    }
}

module.exports = { Api };