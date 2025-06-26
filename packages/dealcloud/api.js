const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.dealcloud.com/rest/v4';
        
        this.URLs = {
            // Authentication
            userInfo: '/users/me',
            
            // Entities
            entities: '/entities',
            entityById: (entityId) => `/entities/${entityId}`,
            
            // Entry Lists (records)
            entryLists: '/entrylists',
            entryListById: (entryListId) => `/entrylists/${entryListId}`,
            entriesInList: (entryListId) => `/entrylists/${entryListId}/entries`,
            
            // Entries (records)
            entries: '/entries',
            entryById: (entryId) => `/entries/${entryId}`,
            
            // Custom Fields
            customFields: '/customfields',
            customFieldById: (fieldId) => `/customfields/${fieldId}`,
            
            // Files
            files: '/files',
            fileById: (fileId) => `/files/${fileId}`,
            
            // Lists
            lists: '/lists',
            listById: (listId) => `/lists/${listId}`
        };
        
        this.authorizationUri = encodeURI(
            `https://api.dealcloud.com/oauth/authorize?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}&scope=${this.scope}`
        );
        this.tokenUri = 'https://api.dealcloud.com/oauth/token';
        
        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }
    
    async getUserDetails() {
        const options = {
            url: this.baseUrl + this.URLs.userInfo,
        };
        return this._get(options);
    }
    
    // **************************   Entities   **********************************
    
    async createEntity(body) {
        const options = {
            url: this.baseUrl + this.URLs.entities,
            body: body,
        };
        return this._post(options);
    }
    
    async listEntities(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.entities,
            query: params
        };
        return this._get(options);
    }
    
    async updateEntity(id, body) {
        const options = {
            url: this.baseUrl + this.URLs.entityById(id),
            body: body,
        };
        return this._put(options);
    }
    
    async getEntityById(id) {
        const options = {
            url: this.baseUrl + this.URLs.entityById(id),
        };
        return this._get(options);
    }
    
    // **************************   Entry Lists   **********************************
    
    async createEntryList(body) {
        const options = {
            url: this.baseUrl + this.URLs.entryLists,
            body: body,
        };
        return this._post(options);
    }
    
    async listEntryLists(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.entryLists,
            query: params
        };
        return this._get(options);
    }
    
    async getEntryListById(id) {
        const options = {
            url: this.baseUrl + this.URLs.entryListById(id),
        };
        return this._get(options);
    }
    
    async getEntriesInList(entryListId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.entriesInList(entryListId),
            query: params
        };
        return this._get(options);
    }
    
    // **************************   Entries   **********************************
    
    async createEntry(body) {
        const options = {
            url: this.baseUrl + this.URLs.entries,
            body: body,
        };
        return this._post(options);
    }
    
    async listEntries(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.entries,
            query: params
        };
        return this._get(options);
    }
    
    async updateEntry(id, body) {
        const options = {
            url: this.baseUrl + this.URLs.entryById(id),
            body: body,
        };
        return this._put(options);
    }
    
    async deleteEntry(id) {
        const options = {
            url: this.baseUrl + this.URLs.entryById(id),
        };
        return this._delete(options);
    }
    
    async getEntryById(id) {
        const options = {
            url: this.baseUrl + this.URLs.entryById(id),
        };
        return this._get(options);
    }
}

module.exports = { Api };
