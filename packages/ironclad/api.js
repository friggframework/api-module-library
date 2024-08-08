const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        // The majority of the properties for OAuth are default loaded by OAuth2Requester.
        // This includes the `client_id`, `client_secret`, `scopes`, and `redirect_uri`.

        this.URLs = {
            userInfo: '/oauth/userinfo',
            webhooks: '/public/api/v1/webhooks',
            webhookByID: (webhookId) => `/public/api/v1/webhooks/${webhookId}`,
            workflows: '/public/api/v1/workflows',
            workflowsByID: (workflowId) =>
                `/public/api/v1/workflows/${workflowId}`,
            workflowSchemas: '/public/api/v1/workflow-schemas',
            workflowSchemaByID: (schemaId) =>
                `/public/api/v1/workflow-schemas/${schemaId}`,
            workflowMetadata: (workflowId) =>
                `/public/api/v1/workflows/${workflowId}/attributes`,
            workflowComment: (workflowId) =>
                `/public/api/v1/workflows/${workflowId}/comments`,
            workflowCommentByID: (workflowId, commentId) =>
                `/public/api/v1/workflows/${workflowId}/comments/${commentId}`,
            records: '/public/api/v1/records',
            recordByID: (recordId) => `/public/api/v1/records/${recordId}`,
            recordSchemas: '/public/api/v1/records/metadata',
            workflowParticipantsByID: (workflowId) =>
                `/public/api/v1/workflows/${workflowId}/participants`,
            userByID: (userId) => `/scim/v2/Users/${userId}`,
        };

        this.subdomain = get(params, 'subdomain', null);

        this.baseUrl = this.getBaseUrl();

        const authUriParams = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id,
            redirect_uri: this.redirect_uri,
            state: this.state,
            scope: this.scope,
        });
        this.authorizationUri = `${this.baseUrl}/oauth/authorize?${authUriParams.toString()}`;

        this.tokenUri = `${this.baseUrl}/oauth/token`;
    }

    getBaseUrl() {
        let baseUrl = 'https://';
        if (this.subdomain) {
            baseUrl += `${this.subdomain}.`;
        }
        baseUrl += 'ironcladapp.com';
        return baseUrl;
    }

    async getTokenFromCode(code) {
        // The token request will fail if Bearer header is applied
        // Therefore,  there happens to be an access_token, remove it
        delete this.access_token;
        return super.getTokenFromCode(code);
    }

    addJsonHeaders(options) {
        const jsonHeaders = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        };
    }
    async _post(options, stringify) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    async getUserDetails() {
        const options = {
            url: this.baseUrl + this.URLs.userInfo,
        };

        return this._get(options);
    }

    async listWebhooks() {
        const options = {
            url: this.baseUrl + this.URLs.webhooks,
        };
        const response = await this._get(options);
        return response;
    }

    async createWebhook(events, targetURL) {
        const options = {
            url: this.baseUrl + this.URLs.webhooks,
            headers: {
                'content-type': 'application/json',
            },
            body: {
                events,
                targetURL,
            },
        };
        const response = await this._post(options);
        return response;
    }

    async updateWebhook(webhookId, events = null, targetURL = null) {
        const options = {
            url: this.baseUrl + this.URLs.webhookByID(webhookId),
            headers: {
                'content-type': 'application/json',
            },
            body: {},
        };

        if (events.length > 0) {
            options.body.events = events;
        }

        if (targetURL) {
            options.body.targetURL = targetURL;
        }

        const response = await this._patch(options);
        return response;
    }

    async deleteWebhook(webhookId) {
        const options = {
            url: this.baseUrl + this.URLs.webhookByID(webhookId),
        };
        const response = await this._delete(options);
        return response;
    }

    async listAllWorkflows(params) {
        const options = {
            url: this.baseUrl + this.URLs.workflows,
            query: params,
        };
        const response = await this._get(options);
        return response;
    }

    async retrieveWorkflow(id) {
        const options = {
            url: this.baseUrl + this.URLs.workflowsByID(id),
        };
        const response = await this._get(options);
        return response;
    }

    async createWorkflow(body) {
        const options = {
            url: this.baseUrl + this.URLs.workflows,
            headers: {
                'content-type': 'application/json',
            },
            body,
        };
        const response = await this._post(options);
        return response;
    }

    async listAllWorkflowSchemas(params, asUserEmail, asUserId) {
        const options = {
            url: this.baseUrl + this.URLs.workflowSchemas,
            query: params,
            headers: {},
        };
        if (asUserEmail) {
            options.headers['x-as-user-email'] = asUserEmail;
        }
        if (asUserId) {
            options.headers['x-as-user-id'] = asUserId;
        }
        const response = await this._get(options);
        return response;
    }

    async retrieveWorkflowSchema(params, id) {
        const options = {
            url: this.baseUrl + this.URLs.workflowSchemaByID(id),
            query: params,
        };
        const response = await this._get(options);
        return response;
    }

    async listAllWorkflowApprovals(id) {
        const options = {
            url: this.baseUrl + this.URLs.workflowsByID(id) + '/approvals',
        };
        const response = await this._get(options);
        return response;
    }

    async listAllWorkflowSignatures(id) {
        const options = {
            url: this.baseUrl + this.URLs.workflowsByID(id) + '/signatures',
        };
        const response = await this._get(options);
        return response;
    }

    async updateWorkflowApprovals(id, roleID, body) {
        const options = {
            url:
                this.baseUrl +
                this.URLs.workflowsByID(id) +
                '/approvals/' +
                roleID,
            headers: {
                'content-type': 'application/json',
            },
            body,
        };
        const response = await this._patch(options);
        return response;
    }

    async revertWorkflowToReviewStep(id, body) {
        const options = {
            url:
                this.baseUrl +
                this.URLs.workflowsByID(id) +
                '/revert-to-review',
            headers: {
                'content-type': 'application/json',
            },
            body,
        };
        const response = await this._patch(options);
        return response;
    }

    async createWorkflowComment(id, body) {
        const options = {
            url: this.baseUrl + this.URLs.workflowComment(id),
            headers: {
                'content-type': 'application/json',
            },
            body,
        };
        const response = await this._post(options);
        return response;
    }

    async getWorkflowComment(workflowId, commentId) {
        const options = {
            url:
                this.baseUrl +
                this.URLs.workflowCommentByID(workflowId, commentId),
            headers: {
                'content-type': 'application/json',
            },
        };
        const response = await this._get(options);
        return response;
    }

    async retrieveWorkflowDocument(workflowID, documentKey) {
        const options = {
            url:
                this.baseUrl +
                this.URLs.workflowsByID(workflowID) +
                `/document/${documentKey}/download`,
        };
        const response = await this._get(options);
        return response;
    }

    async updateWorkflow(id, body) {
        const options = {
            url: this.baseUrl + this.URLs.workflowMetadata(id),
            headers: {
                'content-type': 'application/json',
            },
            body,
        };
        const response = await this._patch(options);
        return response;
    }

    async listAllRecords() {
        const options = {
            url: this.baseUrl + this.URLs.records,
        };
        const response = await this._get(options);
        return response;
    }

    async createRecord(body) {
        const options = {
            url: this.baseUrl + this.URLs.records,
            headers: {
                'content-type': 'application/json',
            },
            body,
        };
        const response = await this._post(options);
        return response;
    }

    async listAllRecordSchemas() {
        const options = {
            url: this.baseUrl + this.URLs.recordSchemas,
        };
        const response = await this._get(options);
        return response;
    }

    async retrieveRecord(recordId) {
        const options = {
            url: this.baseUrl + this.URLs.recordByID(recordId),
        };
        const response = await this._get(options);
        return response;
    }

    async updateRecord(recordId, body) {
        const options = {
            url: this.baseUrl + this.URLs.recordByID(recordId),
            headers: {
                'content-type': 'application/json',
            },
            body,
        };
        const response = await this._patch(options);
        return response;
    }

    async deleteRecord(recordId) {
        const options = {
            url: this.baseUrl + this.URLs.recordByID(recordId),
        };
        const response = await this._delete(options);
        return response;
    }

    async getWorkflowParticipants(workflowId) {
        // TODO: Handle pagination for this api call
        const options = {
            url: this.baseUrl + this.URLs.workflowParticipantsByID(workflowId),
        };
        const response = await this._get(options);
        return response;
    }

    async getUser(userId) {
        const options = {
            url: this.baseUrl + this.URLs.userByID(userId),
        };
        const response = await this._get(options);
        return response;
    }
}

module.exports = { Api };
