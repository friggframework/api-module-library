const { Requester, get } = require('@friggframework/core');

class Api extends Requester {
    constructor(params) {
        super(params);
        this.appId = get(params, 'app_id', process.env.ALGOLIA_APP_ID);
        this.apiKey = get(params, 'api_key', process.env.ALGOLIA_API_KEY);
        this.baseUrl = `https://${this.appId}.algolia.net/1`;
        
        this.URLs = {
            // Search
            search: '/search',
            multipleQueries: '/indexes/*/queries',
            
            // Indexes
            indexes: '/indexes',
            indexByName: (indexName) => `/indexes/${indexName}`,
            indexSettings: (indexName) => `/indexes/${indexName}/settings`,
            
            // Objects
            objects: (indexName) => `/indexes/${indexName}/objects`,
            objectById: (indexName, objectId) => `/indexes/${indexName}/objects/${objectId}`,
            batch: (indexName) => `/indexes/${indexName}/batch`,
            
            // Synonyms
            synonyms: (indexName) => `/indexes/${indexName}/synonyms`,
            synonymById: (indexName, synonymId) => `/indexes/${indexName}/synonyms/${synonymId}`,
            
            // Rules
            rules: (indexName) => `/indexes/${indexName}/rules`,
            ruleById: (indexName, ruleId) => `/indexes/${indexName}/rules/${ruleId}`,
            
            // Analytics
            analytics: '/analytics',
            analyticsTopQueries: '/analytics/2/searches',
            
            // Insights
            insights: '/events'
        };
    }
    
    addAuthHeaders(options) {
        const authHeaders = {
            'X-Algolia-Application-Id': this.appId,
            'X-Algolia-API-Key': this.apiKey,
            'Content-Type': 'application/json'
        };
        options.headers = {
            ...authHeaders,
            ...options.headers,
        };
    }
    
    async _get(options) {
        this.addAuthHeaders(options);
        return super._get(options);
    }
    
    async _post(options, stringify = true) {
        this.addAuthHeaders(options);
        return super._post(options, stringify);
    }
    
    async _put(options, stringify = true) {
        this.addAuthHeaders(options);
        return super._put(options, stringify);
    }
    
    async _delete(options) {
        this.addAuthHeaders(options);
        return super._delete(options);
    }
    
    // **************************   Search   **********************************
    
    async search(indexName, query, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.indexByName(indexName),
            body: {
                query: query,
                ...params
            },
        };
        return this._post(options);
    }
    
    async multipleQueries(queries) {
        const options = {
            url: this.baseUrl + this.URLs.multipleQueries,
            body: {
                requests: queries
            },
        };
        return this._post(options);
    }
    
    // **************************   Indexes   **********************************
    
    async listIndexes() {
        const options = {
            url: this.baseUrl + this.URLs.indexes,
        };
        return this._get(options);
    }
    
    async createIndex(indexName) {
        const options = {
            url: this.baseUrl + this.URLs.indexByName(indexName),
            body: {},
        };
        return this._post(options);
    }
    
    async deleteIndex(indexName) {
        const options = {
            url: this.baseUrl + this.URLs.indexByName(indexName),
        };
        return this._delete(options);
    }
    
    async getIndexSettings(indexName) {
        const options = {
            url: this.baseUrl + this.URLs.indexSettings(indexName),
        };
        return this._get(options);
    }
    
    async updateIndexSettings(indexName, settings) {
        const options = {
            url: this.baseUrl + this.URLs.indexSettings(indexName),
            body: settings,
        };
        return this._put(options);
    }
    
    // **************************   Objects   **********************************
    
    async addObject(indexName, object, objectId = null) {
        const url = objectId 
            ? this.baseUrl + this.URLs.objectById(indexName, objectId)
            : this.baseUrl + this.URLs.objects(indexName);
        
        const options = {
            url: url,
            body: object,
        };
        return objectId ? this._put(options) : this._post(options);
    }
    
    async getObject(indexName, objectId, attributesToRetrieve = null) {
        const options = {
            url: this.baseUrl + this.URLs.objectById(indexName, objectId),
        };
        
        if (attributesToRetrieve) {
            options.query = { attributesToRetrieve: attributesToRetrieve.join(',') };
        }
        
        return this._get(options);
    }
    
    async updateObject(indexName, objectId, object) {
        const options = {
            url: this.baseUrl + this.URLs.objectById(indexName, objectId),
            body: object,
        };
        return this._put(options);
    }
    
    async deleteObject(indexName, objectId) {
        const options = {
            url: this.baseUrl + this.URLs.objectById(indexName, objectId),
        };
        return this._delete(options);
    }
    
    async batchObjects(indexName, requests) {
        const options = {
            url: this.baseUrl + this.URLs.batch(indexName),
            body: {
                requests: requests
            },
        };
        return this._post(options);
    }
    
    // **************************   Analytics   **********************************
    
    async getAnalytics(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.analytics,
            query: params
        };
        return this._get(options);
    }
    
    async getTopQueries(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.analyticsTopQueries,
            query: params
        };
        return this._get(options);
    }
}

module.exports = { Api };
