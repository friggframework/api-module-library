const { OAuth2Requester, get } = require('@friggframework/core');

// GitLab REST API v4
// https://docs.gitlab.com/ee/api/
// Core resources:
// - Projects: https://docs.gitlab.com/ee/api/projects.html
// - Issues: https://docs.gitlab.com/ee/api/issues.html
// - Merge Requests: https://docs.gitlab.com/ee/api/merge_requests.html
// - Users: https://docs.gitlab.com/ee/api/users.html
// - Groups: https://docs.gitlab.com/ee/api/groups.html
// - Pipelines: https://docs.gitlab.com/ee/api/pipelines.html

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        // Support both GitLab.com and self-hosted instances
        this.baseUrl = get(params, 'baseUrl') || 'https://gitlab.com';
        this.apiBaseUrl = `${this.baseUrl}/api/v4`;
        
        this.URLs = {
            // User and authentication
            user: '/user',
            users: '/users',
            userById: (userId) => `/users/${userId}`,
            
            // Projects
            projects: '/projects',
            projectById: (projectId) => `/projects/${projectId}`,
            userProjects: '/projects?membership=true',
            projectSearch: '/projects?search=',
            
            // Issues
            issues: '/issues',
            projectIssues: (projectId) => `/projects/${projectId}/issues`,
            issueById: (projectId, issueId) => `/projects/${projectId}/issues/${issueId}`,
            
            // Merge Requests
            mergeRequests: '/merge_requests',
            projectMergeRequests: (projectId) => `/projects/${projectId}/merge_requests`,
            mergeRequestById: (projectId, mergeRequestId) => `/projects/${projectId}/merge_requests/${mergeRequestId}`,
            
            // Groups
            groups: '/groups',
            groupById: (groupId) => `/groups/${groupId}`,
            groupProjects: (groupId) => `/groups/${groupId}/projects`,
            
            // Pipelines
            projectPipelines: (projectId) => `/projects/${projectId}/pipelines`,
            pipelineById: (projectId, pipelineId) => `/projects/${projectId}/pipelines/${pipelineId}`,
            
            // Commits
            projectCommits: (projectId) => `/projects/${projectId}/repository/commits`,
            commitById: (projectId, commitId) => `/projects/${projectId}/repository/commits/${commitId}`,
            
            // Branches
            projectBranches: (projectId) => `/projects/${projectId}/repository/branches`,
            branchById: (projectId, branchName) => `/projects/${projectId}/repository/branches/${branchName}`,
            
            // Milestones
            projectMilestones: (projectId) => `/projects/${projectId}/milestones`,
            milestoneById: (projectId, milestoneId) => `/projects/${projectId}/milestones/${milestoneId}`,
            
            // Labels
            projectLabels: (projectId) => `/projects/${projectId}/labels`,
            
            // Webhooks
            projectHooks: (projectId) => `/projects/${projectId}/hooks`,
            hookById: (projectId, hookId) => `/projects/${projectId}/hooks/${hookId}`,
        };

        // GitLab OAuth2 endpoints
        this.authorizationUri = encodeURI(
            `${this.baseUrl}/oauth/authorize?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&state=${this.state}&scope=${this.scope}`
        );
        this.tokenUri = `${this.baseUrl}/oauth/token`;

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
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

    // **************************   User Info   **********************************

    async getUserDetails() {
        const options = {
            url: this.apiBaseUrl + this.URLs.user,
        };
        return this._get(options);
    }

    async getUsers(params = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.users,
            query: params,
        };
        return this._get(options);
    }

    async getUserById(userId) {
        const options = {
            url: this.apiBaseUrl + this.URLs.userById(userId),
        };
        return this._get(options);
    }

    // **************************   Projects   **********************************

    async createProject(body) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projects,
            body: body,
        };
        return this._post(options);
    }

    async listProjects(params = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projects,
            query: params,
        };
        return this._get(options);
    }

    async listUserProjects(params = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.userProjects,
            query: params,
        };
        return this._get(options);
    }

    async searchProjects(searchTerm, params = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectSearch + encodeURIComponent(searchTerm),
            query: params,
        };
        return this._get(options);
    }

    async getProjectById(projectId) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectById(projectId),
        };
        return this._get(options);
    }

    async updateProject(projectId, body) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectById(projectId),
            body: body,
        };
        return this._put(options);
    }

    async deleteProject(projectId) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectById(projectId),
        };
        return this._delete(options);
    }

    // **************************   Issues   **********************************

    async createIssue(projectId, body) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectIssues(projectId),
            body: body,
        };
        return this._post(options);
    }

    async listIssues(params = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.issues,
            query: params,
        };
        return this._get(options);
    }

    async listProjectIssues(projectId, params = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectIssues(projectId),
            query: params,
        };
        return this._get(options);
    }

    async getIssueById(projectId, issueId) {
        const options = {
            url: this.apiBaseUrl + this.URLs.issueById(projectId, issueId),
        };
        return this._get(options);
    }

    async updateIssue(projectId, issueId, body) {
        const options = {
            url: this.apiBaseUrl + this.URLs.issueById(projectId, issueId),
            body: body,
        };
        return this._put(options);
    }

    async deleteIssue(projectId, issueId) {
        const options = {
            url: this.apiBaseUrl + this.URLs.issueById(projectId, issueId),
        };
        return this._delete(options);
    }

    // **************************   Merge Requests   **********************************

    async createMergeRequest(projectId, body) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectMergeRequests(projectId),
            body: body,
        };
        return this._post(options);
    }

    async listMergeRequests(params = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.mergeRequests,
            query: params,
        };
        return this._get(options);
    }

    async listProjectMergeRequests(projectId, params = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectMergeRequests(projectId),
            query: params,
        };
        return this._get(options);
    }

    async getMergeRequestById(projectId, mergeRequestId) {
        const options = {
            url: this.apiBaseUrl + this.URLs.mergeRequestById(projectId, mergeRequestId),
        };
        return this._get(options);
    }

    async updateMergeRequest(projectId, mergeRequestId, body) {
        const options = {
            url: this.apiBaseUrl + this.URLs.mergeRequestById(projectId, mergeRequestId),
            body: body,
        };
        return this._put(options);
    }

    async acceptMergeRequest(projectId, mergeRequestId, body = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.mergeRequestById(projectId, mergeRequestId) + '/merge',
            body: body,
        };
        return this._put(options);
    }

    // **************************   Groups   **********************************

    async createGroup(body) {
        const options = {
            url: this.apiBaseUrl + this.URLs.groups,
            body: body,
        };
        return this._post(options);
    }

    async listGroups(params = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.groups,
            query: params,
        };
        return this._get(options);
    }

    async getGroupById(groupId) {
        const options = {
            url: this.apiBaseUrl + this.URLs.groupById(groupId),
        };
        return this._get(options);
    }

    async updateGroup(groupId, body) {
        const options = {
            url: this.apiBaseUrl + this.URLs.groupById(groupId),
            body: body,
        };
        return this._put(options);
    }

    async deleteGroup(groupId) {
        const options = {
            url: this.apiBaseUrl + this.URLs.groupById(groupId),
        };
        return this._delete(options);
    }

    async listGroupProjects(groupId, params = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.groupProjects(groupId),
            query: params,
        };
        return this._get(options);
    }

    // **************************   Pipelines   **********************************

    async listProjectPipelines(projectId, params = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectPipelines(projectId),
            query: params,
        };
        return this._get(options);
    }

    async getPipelineById(projectId, pipelineId) {
        const options = {
            url: this.apiBaseUrl + this.URLs.pipelineById(projectId, pipelineId),
        };
        return this._get(options);
    }

    async createPipeline(projectId, body) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectPipelines(projectId),
            body: body,
        };
        return this._post(options);
    }

    async retryPipeline(projectId, pipelineId) {
        const options = {
            url: this.apiBaseUrl + this.URLs.pipelineById(projectId, pipelineId) + '/retry',
        };
        return this._post(options);
    }

    async cancelPipeline(projectId, pipelineId) {
        const options = {
            url: this.apiBaseUrl + this.URLs.pipelineById(projectId, pipelineId) + '/cancel',
        };
        return this._post(options);
    }

    // **************************   Commits   **********************************

    async listProjectCommits(projectId, params = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectCommits(projectId),
            query: params,
        };
        return this._get(options);
    }

    async getCommitById(projectId, commitId) {
        const options = {
            url: this.apiBaseUrl + this.URLs.commitById(projectId, commitId),
        };
        return this._get(options);
    }

    // **************************   Branches   **********************************

    async listProjectBranches(projectId, params = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectBranches(projectId),
            query: params,
        };
        return this._get(options);
    }

    async getBranchById(projectId, branchName) {
        const options = {
            url: this.apiBaseUrl + this.URLs.branchById(projectId, encodeURIComponent(branchName)),
        };
        return this._get(options);
    }

    async createBranch(projectId, body) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectBranches(projectId),
            body: body,
        };
        return this._post(options);
    }

    async deleteBranch(projectId, branchName) {
        const options = {
            url: this.apiBaseUrl + this.URLs.branchById(projectId, encodeURIComponent(branchName)),
        };
        return this._delete(options);
    }

    // **************************   Milestones   **********************************

    async listProjectMilestones(projectId, params = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectMilestones(projectId),
            query: params,
        };
        return this._get(options);
    }

    async createMilestone(projectId, body) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectMilestones(projectId),
            body: body,
        };
        return this._post(options);
    }

    async getMilestoneById(projectId, milestoneId) {
        const options = {
            url: this.apiBaseUrl + this.URLs.milestoneById(projectId, milestoneId),
        };
        return this._get(options);
    }

    async updateMilestone(projectId, milestoneId, body) {
        const options = {
            url: this.apiBaseUrl + this.URLs.milestoneById(projectId, milestoneId),
            body: body,
        };
        return this._put(options);
    }

    // **************************   Labels   **********************************

    async listProjectLabels(projectId, params = {}) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectLabels(projectId),
            query: params,
        };
        return this._get(options);
    }

    async createLabel(projectId, body) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectLabels(projectId),
            body: body,
        };
        return this._post(options);
    }

    // **************************   Webhooks   **********************************

    async listProjectHooks(projectId) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectHooks(projectId),
        };
        return this._get(options);
    }

    async createWebhook(projectId, body) {
        const options = {
            url: this.apiBaseUrl + this.URLs.projectHooks(projectId),
            body: body,
        };
        return this._post(options);
    }

    async updateWebhook(projectId, hookId, body) {
        const options = {
            url: this.apiBaseUrl + this.URLs.hookById(projectId, hookId),
            body: body,
        };
        return this._put(options);
    }

    async deleteWebhook(projectId, hookId) {
        const options = {
            url: this.apiBaseUrl + this.URLs.hookById(projectId, hookId),
        };
        return this._delete(options);
    }
}

module.exports = { Api };