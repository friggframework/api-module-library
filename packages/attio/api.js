const {OAuth2Requester} = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.attio.com/v2';
        
        this.URLs = {
            authorization: '/oauth/authorize',
            access_token: '/oauth/token',
            userDetails: '/auth/me',
            objects: '/objects',
            objectById: (objectId) => `/objects/${objectId}`,
            records: (objectId) => `/objects/${objectId}/records`,
            recordById: (objectId, recordId) => `/objects/${objectId}/records/${recordId}`,
            search: (objectId) => `/objects/${objectId}/records/search`,
            attributes: (objectId) => `/objects/${objectId}/attributes`,
            attributeById: (objectId, attributeId) => `/objects/${objectId}/attributes/${attributeId}`,
            workspaces: '/workspaces',
            workspaceById: (workspaceId) => `/workspaces/${workspaceId}`,
            lists: '/lists',
            listById: (listId) => `/lists/${listId}`,
            listRecords: (listId) => `/lists/${listId}/records`,
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
        const options = {
            url: this.baseUrl + this.URLs.records(objectId),
            params,
        };
        return this.get(options);
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

    async searchRecords(objectId, query) {
        const options = {
            url: this.baseUrl + this.URLs.search(objectId),
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

    async listWorkspaces() {
        const options = {
            url: this.baseUrl + this.URLs.workspaces,
        };
        return this.get(options);
    }

    async getWorkspace(workspaceId) {
        const options = {
            url: this.baseUrl + this.URLs.workspaceById(workspaceId),
        };
        return this.get(options);
    }

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

    async getListRecords(listId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.listRecords(listId),
            params,
        };
        return this.get(options);
    }
}

module.exports = {Api}; 