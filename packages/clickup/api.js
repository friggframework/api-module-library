const { OAuth2Requester, get } = require('@friggframework/core');

// ClickUp API v2
// https://clickup.com/api
// Core resources:
// - Teams/Workspaces: https://clickup.com/api/clickupreference/operation/GetAuthorizedTeams/
// - Spaces: https://clickup.com/api/clickupreference/operation/GetSpaces/
// - Folders: https://clickup.com/api/clickupreference/operation/GetFolders/
// - Lists: https://clickup.com/api/clickupreference/operation/GetLists/
// - Tasks: https://clickup.com/api/clickupreference/operation/GetTasks/
// - Users: https://clickup.com/api/clickupreference/operation/GetAuthorizedUser/

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = 'https://api.clickup.com/api/v2';
        
        this.URLs = {
            // Authentication and user info
            user: '/user',
            teams: '/team',
            
            // Workspaces/Teams
            teamById: (teamId) => `/team/${teamId}`,
            
            // Spaces
            teamSpaces: (teamId) => `/team/${teamId}/space`,
            spaceById: (spaceId) => `/space/${spaceId}`,
            
            // Folders
            spaceFolders: (spaceId) => `/space/${spaceId}/folder`,
            folderById: (folderId) => `/folder/${folderId}`,
            
            // Lists
            folderLists: (folderId) => `/folder/${folderId}/list`,
            spaceLists: (spaceId) => `/space/${spaceId}/list`,
            listById: (listId) => `/list/${listId}`,
            
            // Tasks
            listTasks: (listId) => `/list/${listId}/task`,
            taskById: (taskId) => `/task/${taskId}`,
            teamTasks: (teamId) => `/team/${teamId}/task`,
            
            // Comments
            taskComments: (taskId) => `/task/${taskId}/comment`,
            commentById: (commentId) => `/comment/${commentId}`,
            
            // Time Tracking
            taskTimeEntries: (taskId) => `/task/${taskId}/time`,
            teamTimeEntries: (teamId) => `/team/${teamId}/time_entries`,
            
            // Goals
            teamGoals: (teamId) => `/team/${teamId}/goal`,
            goalById: (goalId) => `/goal/${goalId}`,
            
            // Members
            teamMembers: (teamId) => `/team/${teamId}/member`,
            
            // Custom Fields
            listCustomFields: (listId) => `/list/${listId}/field`,
            
            // Webhooks
            teamWebhooks: (teamId) => `/team/${teamId}/webhook`,
            webhookById: (webhookId) => `/webhook/${webhookId}`,
        };

        // ClickUp OAuth2 endpoints
        this.authorizationUri = encodeURI(
            `https://app.clickup.com/api?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}&response_type=code`
        );
        this.tokenUri = 'https://api.clickup.com/api/v2/oauth/token';

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
                client_id: this.client_id,
                client_secret: this.client_secret,
                code: code,
            },
        };

        const response = await this._post(options);
        await this.setTokens(response);
        return response;
    }

    async setTokens(params) {
        this.access_token = get(params, 'access_token');
        // ClickUp doesn't provide refresh tokens in OAuth2 flow
        
        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    addAuthHeaders(options) {
        const authHeaders = {
            'Authorization': `Bearer ${this.access_token}`,
            'Content-Type': 'application/json',
        };
        options.headers = {
            ...authHeaders,
            ...options.headers,
        };
    }

    addJsonHeaders(options) {
        const jsonHeaders = {
            'Content-Type': 'application/json',
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
            url: this.baseUrl + this.URLs.user,
        };
        return this._get(options);
    }

    // **************************   Teams/Workspaces   **********************************

    async getAuthorizedTeams() {
        const options = {
            url: this.baseUrl + this.URLs.teams,
        };
        return this._get(options);
    }

    async getTeamById(teamId) {
        const options = {
            url: this.baseUrl + this.URLs.teamById(teamId),
        };
        return this._get(options);
    }

    // **************************   Spaces   **********************************

    async getTeamSpaces(teamId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.teamSpaces(teamId),
            query: params,
        };
        return this._get(options);
    }

    async createSpace(teamId, body) {
        const options = {
            url: this.baseUrl + this.URLs.teamSpaces(teamId),
            body: body,
        };
        return this._post(options);
    }

    async getSpaceById(spaceId) {
        const options = {
            url: this.baseUrl + this.URLs.spaceById(spaceId),
        };
        return this._get(options);
    }

    async updateSpace(spaceId, body) {
        const options = {
            url: this.baseUrl + this.URLs.spaceById(spaceId),
            body: body,
        };
        return this._put(options);
    }

    async deleteSpace(spaceId) {
        const options = {
            url: this.baseUrl + this.URLs.spaceById(spaceId),
        };
        return this._delete(options);
    }

    // **************************   Folders   **********************************

    async getSpaceFolders(spaceId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.spaceFolders(spaceId),
            query: params,
        };
        return this._get(options);
    }

    async createFolder(spaceId, body) {
        const options = {
            url: this.baseUrl + this.URLs.spaceFolders(spaceId),
            body: body,
        };
        return this._post(options);
    }

    async getFolderById(folderId) {
        const options = {
            url: this.baseUrl + this.URLs.folderById(folderId),
        };
        return this._get(options);
    }

    async updateFolder(folderId, body) {
        const options = {
            url: this.baseUrl + this.URLs.folderById(folderId),
            body: body,
        };
        return this._put(options);
    }

    async deleteFolder(folderId) {
        const options = {
            url: this.baseUrl + this.URLs.folderById(folderId),
        };
        return this._delete(options);
    }

    // **************************   Lists   **********************************

    async getFolderLists(folderId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.folderLists(folderId),
            query: params,
        };
        return this._get(options);
    }

    async getSpaceLists(spaceId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.spaceLists(spaceId),
            query: params,
        };
        return this._get(options);
    }

    async createList(folderId, body) {
        const options = {
            url: this.baseUrl + this.URLs.folderLists(folderId),
            body: body,
        };
        return this._post(options);
    }

    async createSpaceList(spaceId, body) {
        const options = {
            url: this.baseUrl + this.URLs.spaceLists(spaceId),
            body: body,
        };
        return this._post(options);
    }

    async getListById(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
        };
        return this._get(options);
    }

    async updateList(listId, body) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
            body: body,
        };
        return this._put(options);
    }

    async deleteList(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
        };
        return this._delete(options);
    }

    // **************************   Tasks   **********************************

    async getListTasks(listId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.listTasks(listId),
            query: params,
        };
        return this._get(options);
    }

    async getTeamTasks(teamId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.teamTasks(teamId),
            query: params,
        };
        return this._get(options);
    }

    async createTask(listId, body) {
        const options = {
            url: this.baseUrl + this.URLs.listTasks(listId),
            body: body,
        };
        return this._post(options);
    }

    async getTaskById(taskId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.taskById(taskId),
            query: params,
        };
        return this._get(options);
    }

    async updateTask(taskId, body) {
        const options = {
            url: this.baseUrl + this.URLs.taskById(taskId),
            body: body,
        };
        return this._put(options);
    }

    async deleteTask(taskId) {
        const options = {
            url: this.baseUrl + this.URLs.taskById(taskId),
        };
        return this._delete(options);
    }

    // **************************   Comments   **********************************

    async getTaskComments(taskId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.taskComments(taskId),
            query: params,
        };
        return this._get(options);
    }

    async createComment(taskId, body) {
        const options = {
            url: this.baseUrl + this.URLs.taskComments(taskId),
            body: body,
        };
        return this._post(options);
    }

    async updateComment(commentId, body) {
        const options = {
            url: this.baseUrl + this.URLs.commentById(commentId),
            body: body,
        };
        return this._put(options);
    }

    async deleteComment(commentId) {
        const options = {
            url: this.baseUrl + this.URLs.commentById(commentId),
        };
        return this._delete(options);
    }

    // **************************   Time Tracking   **********************************

    async getTaskTimeEntries(taskId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.taskTimeEntries(taskId),
            query: params,
        };
        return this._get(options);
    }

    async createTimeEntry(taskId, body) {
        const options = {
            url: this.baseUrl + this.URLs.taskTimeEntries(taskId),
            body: body,
        };
        return this._post(options);
    }

    async getTeamTimeEntries(teamId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.teamTimeEntries(teamId),
            query: params,
        };
        return this._get(options);
    }

    // **************************   Goals   **********************************

    async getTeamGoals(teamId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.teamGoals(teamId),
            query: params,
        };
        return this._get(options);
    }

    async createGoal(teamId, body) {
        const options = {
            url: this.baseUrl + this.URLs.teamGoals(teamId),
            body: body,
        };
        return this._post(options);
    }

    async getGoalById(goalId) {
        const options = {
            url: this.baseUrl + this.URLs.goalById(goalId),
        };
        return this._get(options);
    }

    async updateGoal(goalId, body) {
        const options = {
            url: this.baseUrl + this.URLs.goalById(goalId),
            body: body,
        };
        return this._put(options);
    }

    async deleteGoal(goalId) {
        const options = {
            url: this.baseUrl + this.URLs.goalById(goalId),
        };
        return this._delete(options);
    }

    // **************************   Members   **********************************

    async getTeamMembers(teamId) {
        const options = {
            url: this.baseUrl + this.URLs.teamMembers(teamId),
        };
        return this._get(options);
    }

    // **************************   Custom Fields   **********************************

    async getListCustomFields(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listCustomFields(listId),
        };
        return this._get(options);
    }

    // **************************   Webhooks   **********************************

    async getTeamWebhooks(teamId) {
        const options = {
            url: this.baseUrl + this.URLs.teamWebhooks(teamId),
        };
        return this._get(options);
    }

    async createWebhook(teamId, body) {
        const options = {
            url: this.baseUrl + this.URLs.teamWebhooks(teamId),
            body: body,
        };
        return this._post(options);
    }

    async updateWebhook(webhookId, body) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(webhookId),
            body: body,
        };
        return this._put(options);
    }

    async deleteWebhook(webhookId) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        };
        return this._delete(options);
    }
}

module.exports = { Api };