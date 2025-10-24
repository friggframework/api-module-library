const {OAuth2Requester} = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.attio.com/v2';

        // OAuth2 endpoints with required query parameters
        this.authorizationUri = encodeURI(
            `https://app.attio.com/authorize?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&scope=${this.scope}&state=${this.state}`
        );
        this.tokenUri = 'https://app.attio.com/oauth/token';

        this.URLs = {
            userDetails: '/self',
            objects: '/objects',
            objectById: (objectId) => `/objects/${objectId}`,
            records: (objectId) => `/objects/${objectId}/records`,
            recordById: (objectId, recordId) => `/objects/${objectId}/records/${recordId}`,
            query: (objectId) => `/objects/${objectId}/records/query`,
            attributes: (objectId) => `/objects/${objectId}/attributes`,
            attributeById: (objectId, attributeId) => `/objects/${objectId}/attributes/${attributeId}`,
            lists: '/lists',
            listById: (listId) => `/lists/${listId}`,
            listEntries: (listId) => `/lists/${listId}/entries`,
            webhookById: (webhookId) => `/webhooks/${webhookId}`,
        };
    }

    async getUserDetails() {
        const options = {
            url: this.baseUrl + this.URLs.userDetails,
        };
        return this._get(options);
    }

    async listObjects() {
        const options = {
            url: this.baseUrl + this.URLs.objects,
        };
        return this._get(options);
    }

    async getObject(objectId) {
        const options = {
            url: this.baseUrl + this.URLs.objectById(objectId),
        };
        return this._get(options);
    }

    async listRecords(objectId, params = {}) {
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
        return this._get(options);
    }

    async createRecord(objectId, data) {
        const options = {
            url: this.baseUrl + this.URLs.records(objectId),
            headers: {
                'Content-Type': 'application/json',
            },
            body: data,
        };
        return this._post(options);
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
        return this._delete(options);
    }

    async queryRecords(objectId, query) {
        const options = {
            url: this.baseUrl + this.URLs.query(objectId),
            headers: {
                'Content-Type': 'application/json',
            },
            body: query,
        };
        return this._post(options);
    }

    async listAttributes(objectId) {
        const options = {
            url: this.baseUrl + this.URLs.attributes(objectId),
        };
        return this._get(options);
    }

    async getAttribute(objectId, attributeId) {
        const options = {
            url: this.baseUrl + this.URLs.attributeById(objectId, attributeId),
        };
        return this._get(options);
    }

    async listLists() {
        const options = {
            url: this.baseUrl + this.URLs.lists,
        };
        return this._get(options);
    }

    async getList(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
        };
        return this._get(options);
    }

    async getListEntries(listId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.listEntries(listId),
            params,
        };
        return this._get(options);
    }

    async listNotes(params = {}) {
        const options = {
            url: this.baseUrl + '/notes',
            params,
        };
        return this._get(options);
    }

    async getNote(noteId) {
        const options = {
            url: this.baseUrl + `/notes/${noteId}`,
        };
        return this._get(options);
    }

    async createNote(data) {
        const options = {
            url: this.baseUrl + '/notes',
            headers: {
                'Content-Type': 'application/json',
            },
            body: { data },
        };
        return this._post(options);
    }

    async deleteNote(noteId) {
        const options = {
            url: this.baseUrl + `/notes/${noteId}`,
        };
        return this._delete(options);
    }

    async listWebhooks(params = {}) {
        const options = {
            url: this.baseUrl + '/webhooks',
            params,
        };
        return this._get(options);
    }

    async getWebhook(webhookId) {
        const options = {
            url: this.baseUrl + `/webhooks/${webhookId}`,
        };
        return this._get(options);
    }

    async createWebhook(data) {
        const options = {
            url: this.baseUrl + '/webhooks',
            headers: {
                'Content-Type': 'application/json',
            },
            body: { data },
        };
        return this._post(options);
    }

    async deleteWebhook(webhookId) {
        const options = {
            url: this.baseUrl + `/webhooks/${webhookId}`,
        };
        return this._delete(options);
    }

    async updateWebhook(webhookId, data) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(webhookId),
            headers: {
                'Content-Type': 'application/json',
            },
            body: { data },
        };
        return this.patch(options);
    }

    async searchRecords(searchParams) {
        const options = {
            url: this.baseUrl + '/objects/records/search',
            headers: {
                'Content-Type': 'application/json',
            },
            body: searchParams,
        };
        return this._post(options);
    }
}

module.exports = {Api}; 