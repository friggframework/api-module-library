const {OAuth2Requester} = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.attio.com/v2';
        
        this.URLs = {
            authorization: '/oauth/authorize',
            access_token: '/oauth/token',
            userDetails: '/self',
            objects: '/objects',
            objectById: (objectId) => `/objects/${objectId}`,
            records: (objectId) => `/objects/${objectId}/records`,
            recordById: (objectId, recordId) => `/objects/${objectId}/records/${recordId}`,
            query: (objectId) => `/objects/${objectId}/records/query`,
            attributes: (objectId) => `/objects/${objectId}/attributes`,
            attributeById: (objectId, attributeId) => `/objects/${objectId}/attributes/${attributeId}`,
            // Note: /workspaces and /workspaces/{id} endpoints don't exist in Attio API
            // Workspaces are referenced via workspace_id in other objects
            // Use /workspace_members endpoint instead if needed
            lists: '/lists',
            listById: (listId) => `/lists/${listId}`,
            listEntries: (listId) => `/lists/${listId}/entries`,
        };
    }

    async getUserDetails() {
        const options = {
            url: this.baseUrl + this.URLs.userDetails,
        };
        return this.get(options);
    }

    async listObjects() {
        const options = {
            url: this.baseUrl + this.URLs.objects,
        };
        return this.get(options);
    }

    async getObject(objectId) {
        const options = {
            url: this.baseUrl + this.URLs.objectById(objectId),
        };
        return this.get(options);
    }

    async listRecords(objectId, params = {}) {
        // Attio uses POST /v2/objects/{object}/records/query, not GET /records
        // Convert params to query body format
        const query = {};

        if (params.limit) {
            query.limit = params.limit;
        }
        if (params.offset !== undefined) {
            query.offset = params.offset;
        }
        if (params.sorts) {
            query.sorts = params.sorts;
        }
        if (params.filter) {
            query.filter = params.filter;
        }

        return this.queryRecords(objectId, query);
    }

    async getRecord(objectId, recordId) {
        const options = {
            url: this.baseUrl + this.URLs.recordById(objectId, recordId),
        };
        return this.get(options);
    }

    async createRecord(objectId, data) {
        const options = {
            url: this.baseUrl + this.URLs.records(objectId),
            headers: {
                'Content-Type': 'application/json',
            },
            body: data,
        };
        return this.post(options);
    }

    async updateRecord(objectId, recordId, data) {
        const options = {
            url: this.baseUrl + this.URLs.recordById(objectId, recordId),
            headers: {
                'Content-Type': 'application/json',
            },
            body: data,
        };
        return this.patch(options);
    }

    async deleteRecord(objectId, recordId) {
        const options = {
            url: this.baseUrl + this.URLs.recordById(objectId, recordId),
        };
        return this.delete(options);
    }

    async queryRecords(objectId, query) {
        const options = {
            url: this.baseUrl + this.URLs.query(objectId),
            headers: {
                'Content-Type': 'application/json',
            },
            body: query,
        };
        return this.post(options);
    }

    async listAttributes(objectId) {
        const options = {
            url: this.baseUrl + this.URLs.attributes(objectId),
        };
        return this.get(options);
    }

    async getAttribute(objectId, attributeId) {
        const options = {
            url: this.baseUrl + this.URLs.attributeById(objectId, attributeId),
        };
        return this.get(options);
    }

    // Note: listWorkspaces() and getWorkspace() methods removed
    // These endpoints don't exist in the Attio API
    // Workspaces are referenced via workspace_id in other API responses
    // Use workspace_members endpoint if you need to work with workspace data

    async listLists() {
        const options = {
            url: this.baseUrl + this.URLs.lists,
        };
        return this.get(options);
    }

    async getList(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
        };
        return this.get(options);
    }

    async getListEntries(listId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.listEntries(listId),
            params,
        };
        return this.get(options);
    }

    // ============================================================================
    // Notes API
    // ============================================================================

    async listNotes(params = {}) {
        const options = {
            url: this.baseUrl + '/notes',
            params,
        };
        return this.get(options);
    }

    async getNote(noteId) {
        const options = {
            url: this.baseUrl + `/notes/${noteId}`,
        };
        return this.get(options);
    }

    async createNote(data) {
        const options = {
            url: this.baseUrl + '/notes',
            headers: {
                'Content-Type': 'application/json',
            },
            body: { data },
        };
        return this.post(options);
    }

    async deleteNote(noteId) {
        const options = {
            url: this.baseUrl + `/notes/${noteId}`,
        };
        return this.delete(options);
    }

    // ============================================================================
    // Webhooks API
    // ============================================================================

    async listWebhooks(params = {}) {
        const options = {
            url: this.baseUrl + '/webhooks',
            params,
        };
        return this.get(options);
    }

    async getWebhook(webhookId) {
        const options = {
            url: this.baseUrl + `/webhooks/${webhookId}`,
        };
        return this.get(options);
    }

    async createWebhook(data) {
        const options = {
            url: this.baseUrl + '/webhooks',
            headers: {
                'Content-Type': 'application/json',
            },
            body: { data },
        };
        return this.post(options);
    }

    async deleteWebhook(webhookId) {
        const options = {
            url: this.baseUrl + `/webhooks/${webhookId}`,
        };
        return this.delete(options);
    }

    // ============================================================================
    // Search API
    // ============================================================================

    async searchRecords(searchParams) {
        const options = {
            url: this.baseUrl + '/objects/records/search',
            headers: {
                'Content-Type': 'application/json',
            },
            body: searchParams,
        };
        return this.post(options);
    }
}

module.exports = {Api}; 