const { OAuth2Requester, get } = require('@friggframework/core');

// Jira Cloud REST API v3
// https://developer.atlassian.com/cloud/jira/platform/rest/v3/
// Core resources:
// - Projects: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/
// - Issues: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/
// - Users: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-users/
// - Dashboards: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-dashboards/
// - Workflows: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-workflows/

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = get(params, 'baseUrl') || 'https://api.atlassian.com';
        this.cloudId = get(params, 'cloudId', null);
        
        this.URLs = {
            // Authentication and user info
            userInfo: '/oauth/token/accessible-resources',
            myself: '/rest/api/3/myself',
            
            // Projects
            projects: '/rest/api/3/project',
            projectById: (projectId) => `/rest/api/3/project/${projectId}`,
            projectSearch: '/rest/api/3/project/search',
            
            // Issues
            issues: '/rest/api/3/issue',
            issueById: (issueId) => `/rest/api/3/issue/${issueId}`,
            issueSearch: '/rest/api/3/search',
            issueTransitions: (issueId) => `/rest/api/3/issue/${issueId}/transitions`,
            issueComments: (issueId) => `/rest/api/3/issue/${issueId}/comment`,
            
            // Users
            users: '/rest/api/3/users/search',
            userById: (userId) => `/rest/api/3/user?accountId=${userId}`,
            
            // Dashboards
            dashboards: '/rest/api/3/dashboard',
            dashboardById: (dashboardId) => `/rest/api/3/dashboard/${dashboardId}`,
            
            // Issue Types
            issueTypes: '/rest/api/3/issuetype',
            
            // Priorities
            priorities: '/rest/api/3/priority',
            
            // Statuses
            statuses: '/rest/api/3/status',
        };

        this.authorizationUri = encodeURI(
            `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${this.client_id}&scope=${this.scope}&redirect_uri=${this.redirect_uri}&state=${this.state}&response_type=code&prompt=consent`
        );
        this.tokenUri = 'https://auth.atlassian.com/oauth/token';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }

    // Set the Jira cloud ID for API calls
    setCloudId(cloudId) {
        this.cloudId = cloudId;
        this.baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    async getTokenFromCode(code) {
        const options = {
            url: this.tokenUri,
            form: {
                grant_type: 'authorization_code',
                client_id: this.client_id,
                client_secret: this.client_secret,
                code: code,
                redirect_uri: this.redirect_uri,
            },
        };

        const response = await this._post(options);
        await this.setTokens(response);
        return response;
    }

    async setTokens(params) {
        this.access_token = get(params, 'access_token');
        this.refresh_token = get(params, 'refresh_token');

        const accessExpiresIn = get(params, 'expires_in', null);
        if (accessExpiresIn) {
            this.accessTokenExpire = new Date(Date.now() + accessExpiresIn * 1000);
        }

        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    addAuthHeaders(options) {
        const authHeaders = {
            'Authorization': `Bearer ${this.access_token}`,
            'Accept': 'application/json',
        };
        options.headers = {
            ...authHeaders,
            ...options.headers,
        };
    }

    addJsonHeaders(options) {
        const jsonHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        };
    }

    async _post(options, stringify = true) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify = true) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _put(options, stringify = true) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // **************************   Authentication & User Info   **********************************

    async getAccessibleResources() {
        const options = {
            url: this.baseUrl + this.URLs.userInfo,
        };
        return this._get(options);
    }

    async getUserDetails() {
        if (!this.cloudId) {
            const resources = await this.getAccessibleResources();
            if (resources && resources.length > 0) {
                this.setCloudId(resources[0].id);
            }
        }

        const options = {
            url: this.baseUrl + this.URLs.myself,
        };
        return this._get(options);
    }

    // **************************   Projects   **********************************

    async createProject(body) {
        const options = {
            url: this.baseUrl + this.URLs.projects,
            body: body,
        };
        return this._post(options);
    }

    async listProjects(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.projects,
            query: params,
        };
        return this._get(options);
    }

    async searchProjects(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.projectSearch,
            query: params,
        };
        return this._get(options);
    }

    async getProjectById(projectId) {
        const options = {
            url: this.baseUrl + this.URLs.projectById(projectId),
        };
        return this._get(options);
    }

    async updateProject(projectId, body) {
        const options = {
            url: this.baseUrl + this.URLs.projectById(projectId),
            body: body,
        };
        return this._put(options);
    }

    async deleteProject(projectId) {
        const options = {
            url: this.baseUrl + this.URLs.projectById(projectId),
        };
        return this._delete(options);
    }

    // **************************   Issues   **********************************

    async createIssue(body) {
        const options = {
            url: this.baseUrl + this.URLs.issues,
            body: body,
        };
        return this._post(options);
    }

    async searchIssues(jql, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.issueSearch,
            query: {
                jql: jql,
                ...params,
            },
        };
        return this._get(options);
    }

    async getIssueById(issueId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.issueById(issueId),
            query: params,
        };
        return this._get(options);
    }

    async updateIssue(issueId, body) {
        const options = {
            url: this.baseUrl + this.URLs.issueById(issueId),
            body: body,
        };
        return this._put(options);
    }

    async deleteIssue(issueId) {
        const options = {
            url: this.baseUrl + this.URLs.issueById(issueId),
        };
        return this._delete(options);
    }

    async getIssueTransitions(issueId) {
        const options = {
            url: this.baseUrl + this.URLs.issueTransitions(issueId),
        };
        return this._get(options);
    }

    async transitionIssue(issueId, transitionData) {
        const options = {
            url: this.baseUrl + this.URLs.issueTransitions(issueId),
            body: transitionData,
        };
        return this._post(options);
    }

    async addCommentToIssue(issueId, commentBody) {
        const options = {
            url: this.baseUrl + this.URLs.issueComments(issueId),
            body: {
                body: commentBody,
            },
        };
        return this._post(options);
    }

    async getIssueComments(issueId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.issueComments(issueId),
            query: params,
        };
        return this._get(options);
    }

    // **************************   Users   **********************************

    async searchUsers(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.users,
            query: params,
        };
        return this._get(options);
    }

    async getUserById(accountId) {
        const options = {
            url: this.baseUrl + this.URLs.userById(accountId),
        };
        return this._get(options);
    }

    // **************************   Dashboards   **********************************

    async listDashboards(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.dashboards,
            query: params,
        };
        return this._get(options);
    }

    async getDashboardById(dashboardId) {
        const options = {
            url: this.baseUrl + this.URLs.dashboardById(dashboardId),
        };
        return this._get(options);
    }

    // **************************   Metadata   **********************************

    async getIssueTypes() {
        const options = {
            url: this.baseUrl + this.URLs.issueTypes,
        };
        return this._get(options);
    }

    async getPriorities() {
        const options = {
            url: this.baseUrl + this.URLs.priorities,
        };
        return this._get(options);
    }

    async getStatuses() {
        const options = {
            url: this.baseUrl + this.URLs.statuses,
        };
        return this._get(options);
    }
}

module.exports = { Api };