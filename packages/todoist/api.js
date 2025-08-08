const { OAuth2Requester, get } = require('@friggframework/core');
const { v4: uuidv4 } = require('uuid');

// Todoist REST API client
// Supports API Token and OAuth2 authentication
// Documentation: https://developer.todoist.com/rest/v2/

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = 'https://api.todoist.com/rest/v2';
        this.syncUrl = 'https://api.todoist.com/sync/v9';
        
        // API Token authentication (preferred for most use cases)
        this.apiToken = get(params, 'apiToken', null);
        
        // OAuth2 credentials
        this.client_id = get(params, 'client_id', process.env.TODOIST_CLIENT_ID);
        this.client_secret = get(params, 'client_secret', process.env.TODOIST_CLIENT_SECRET);
        this.access_token = get(params, 'access_token', null);
        
        // OAuth endpoints
        this.authorizationUri = 'https://todoist.com/oauth/authorize';
        this.tokenUri = 'https://todoist.com/oauth/access_token';

        this.URLs = {
            // Projects
            projects: '/projects',
            projectById: (projectId) => `/projects/${projectId}`,
            
            // Sections
            sections: '/sections',
            sectionById: (sectionId) => `/sections/${sectionId}`,
            sectionsByProject: (projectId) => `/sections?project_id=${projectId}`,
            
            // Tasks
            tasks: '/tasks',
            taskById: (taskId) => `/tasks/${taskId}`,
            tasksByProject: (projectId) => `/tasks?project_id=${projectId}`,
            tasksBySection: (sectionId) => `/tasks?section_id=${sectionId}`,
            tasksByLabel: (labelId) => `/tasks?label_id=${labelId}`,
            tasksByFilter: (filter) => `/tasks?filter=${encodeURIComponent(filter)}`,
            taskComments: (taskId) => `/comments?task_id=${taskId}`,
            taskClose: (taskId) => `/tasks/${taskId}/close`,
            taskReopen: (taskId) => `/tasks/${taskId}/reopen`,
            
            // Labels
            labels: '/labels',
            labelById: (labelId) => `/labels/${labelId}`,
            personalLabels: '/labels?is_shared=false',
            sharedLabels: '/labels?is_shared=true',
            
            // Comments
            comments: '/comments',
            commentById: (commentId) => `/comments/${commentId}`,
            commentsByProject: (projectId) => `/comments?project_id=${projectId}`,
            
            // Collaborators
            collaborators: (projectId) => `/projects/${projectId}/collaborators`,
            
            // Sync API endpoints (for advanced features)
            sync: '/sync',
            syncCompleted: '/completed/get_all',
            syncActivity: '/activity/get',
            syncStats: '/completed/get_stats',
            syncBackups: '/backups/get',
            syncQuickAdd: '/quick/add',
            
            // User info
            syncUser: '/user',
            
            // Webhooks (through sync API)
            webhooks: '/webhooks',
        };

        // Request ID for sync API (prevents duplicate requests)
        this.generateRequestId = () => uuidv4();
    }

    // Generate OAuth authorization URL
    getAuthUri(scopes = ['data:read_write']) {
        const params = new URLSearchParams({
            client_id: this.client_id,
            scope: scopes.join(','),
            state: this.state || this.generateRequestId(),
        });
        
        return `${this.authorizationUri}?${params.toString()}`;
    }

    // Exchange authorization code for access token
    async getTokenFromCode(code) {
        const tokenData = {
            client_id: this.client_id,
            client_secret: this.client_secret,
            code: code,
            redirect_uri: this.redirect_uri,
        };

        const options = {
            url: this.tokenUri,
            body: tokenData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        };

        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    // Set access token
    async setTokens(tokenResponse) {
        this.access_token = tokenResponse.access_token;
        
        if (tokenResponse.token_type) {
            this.token_type = tokenResponse.token_type;
        }

        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    // Add authentication headers
    addAuthHeaders(options) {
        let authHeader;
        
        if (this.apiToken) {
            // Use API Token authentication
            authHeader = `Bearer ${this.apiToken}`;
        } else if (this.access_token) {
            // Use OAuth2 access token
            authHeader = `Bearer ${this.access_token}`;
        } else {
            throw new Error('No authentication token available');
        }
        
        options.headers = {
            ...options.headers,
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
    }

    // Add sync API headers (for sync endpoints)
    addSyncHeaders(options) {
        let authHeader;
        
        if (this.apiToken) {
            authHeader = `Bearer ${this.apiToken}`;
        } else if (this.access_token) {
            authHeader = `Bearer ${this.access_token}`;
        } else {
            throw new Error('No authentication token available');
        }
        
        options.headers = {
            ...options.headers,
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
        };
    }

    async _get(options, useSync = false) {
        options.url = (useSync ? this.syncUrl : this.baseUrl) + options.url;
        if (useSync) {
            this.addSyncHeaders(options);
        } else {
            this.addAuthHeaders(options);
        }
        return super._get(options);
    }

    async _post(options, stringify = true, useSync = false) {
        options.url = (useSync ? this.syncUrl : this.baseUrl) + options.url;
        if (useSync) {
            this.addSyncHeaders(options);
        } else {
            this.addAuthHeaders(options);
        }
        return super._post(options, stringify);
    }

    async _put(options, stringify = true) {
        options.url = this.baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._put(options, stringify);
    }

    async _patch(options, stringify = true) {
        options.url = this.baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._patch(options, stringify);
    }

    async _delete(options) {
        options.url = this.baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._delete(options);
    }

    // **************************   Projects   **********************************

    async createProject(projectData) {
        const options = {
            url: this.URLs.projects,
            body: projectData,
        };
        return this._post(options);
    }

    async getProjects() {
        const options = {
            url: this.URLs.projects,
        };
        return this._get(options);
    }

    async getProjectById(projectId) {
        const options = {
            url: this.URLs.projectById(projectId),
        };
        return this._get(options);
    }

    async updateProject(projectId, projectData) {
        const options = {
            url: this.URLs.projectById(projectId),
            body: projectData,
        };
        return this._post(options);
    }

    async deleteProject(projectId) {
        const options = {
            url: this.URLs.projectById(projectId),
        };
        return this._delete(options);
    }

    async getProjectCollaborators(projectId) {
        const options = {
            url: this.URLs.collaborators(projectId),
        };
        return this._get(options);
    }

    // **************************   Sections   **********************************

    async createSection(sectionData) {
        const options = {
            url: this.URLs.sections,
            body: sectionData,
        };
        return this._post(options);
    }

    async getSections(projectId = null) {
        const url = projectId ? this.URLs.sectionsByProject(projectId) : this.URLs.sections;
        const options = {
            url: url,
        };
        return this._get(options);
    }

    async getSectionById(sectionId) {
        const options = {
            url: this.URLs.sectionById(sectionId),
        };
        return this._get(options);
    }

    async updateSection(sectionId, sectionData) {
        const options = {
            url: this.URLs.sectionById(sectionId),
            body: sectionData,
        };
        return this._post(options);
    }

    async deleteSection(sectionId) {
        const options = {
            url: this.URLs.sectionById(sectionId),
        };
        return this._delete(options);
    }

    // **************************   Tasks   **********************************

    async createTask(taskData) {
        const options = {
            url: this.URLs.tasks,
            body: taskData,
        };
        return this._post(options);
    }

    async getTasks(params = {}) {
        let url = this.URLs.tasks;
        
        // Handle different filtering options
        if (params.project_id) {
            url = this.URLs.tasksByProject(params.project_id);
            delete params.project_id;
        } else if (params.section_id) {
            url = this.URLs.tasksBySection(params.section_id);
            delete params.section_id;
        } else if (params.label_id) {
            url = this.URLs.tasksByLabel(params.label_id);
            delete params.label_id;
        } else if (params.filter) {
            url = this.URLs.tasksByFilter(params.filter);
            delete params.filter;
        }
        
        const options = {
            url: url,
            query: params
        };
        return this._get(options);
    }

    async getTaskById(taskId) {
        const options = {
            url: this.URLs.taskById(taskId),
        };
        return this._get(options);
    }

    async updateTask(taskId, taskData) {
        const options = {
            url: this.URLs.taskById(taskId),
            body: taskData,
        };
        return this._post(options);
    }

    async deleteTask(taskId) {
        const options = {
            url: this.URLs.taskById(taskId),
        };
        return this._delete(options);
    }

    async closeTask(taskId) {
        const options = {
            url: this.URLs.taskClose(taskId),
            body: {},
        };
        return this._post(options);
    }

    async reopenTask(taskId) {
        const options = {
            url: this.URLs.taskReopen(taskId),
            body: {},
        };
        return this._post(options);
    }

    // **************************   Labels   **********************************

    async createLabel(labelData) {
        const options = {
            url: this.URLs.labels,
            body: labelData,
        };
        return this._post(options);
    }

    async getLabels(isShared = null) {
        let url = this.URLs.labels;
        
        if (isShared === true) {
            url = this.URLs.sharedLabels;
        } else if (isShared === false) {
            url = this.URLs.personalLabels;
        }
        
        const options = {
            url: url,
        };
        return this._get(options);
    }

    async getLabelById(labelId) {
        const options = {
            url: this.URLs.labelById(labelId),
        };
        return this._get(options);
    }

    async updateLabel(labelId, labelData) {
        const options = {
            url: this.URLs.labelById(labelId),
            body: labelData,
        };
        return this._post(options);
    }

    async deleteLabel(labelId) {
        const options = {
            url: this.URLs.labelById(labelId),
        };
        return this._delete(options);
    }

    // **************************   Comments   **********************************

    async createComment(commentData) {
        const options = {
            url: this.URLs.comments,
            body: commentData,
        };
        return this._post(options);
    }

    async getComments(params = {}) {
        let url = this.URLs.comments;
        
        if (params.task_id) {
            url = this.URLs.taskComments(params.task_id);
            delete params.task_id;
        } else if (params.project_id) {
            url = this.URLs.commentsByProject(params.project_id);
            delete params.project_id;
        }
        
        const options = {
            url: url,
            query: params
        };
        return this._get(options);
    }

    async getCommentById(commentId) {
        const options = {
            url: this.URLs.commentById(commentId),
        };
        return this._get(options);
    }

    async updateComment(commentId, commentData) {
        const options = {
            url: this.URLs.commentById(commentId),
            body: commentData,
        };
        return this._post(options);
    }

    async deleteComment(commentId) {
        const options = {
            url: this.URLs.commentById(commentId),
        };
        return this._delete(options);
    }

    // **************************   Sync API Methods   **********************************

    async getUser() {
        const options = {
            url: this.URLs.syncUser,
        };
        return this._get(options, true);
    }

    async syncData(commands = [], resourceTypes = ['all']) {
        const options = {
            url: this.URLs.sync,
            body: new URLSearchParams({
                token: this.apiToken || this.access_token,
                sync_token: '*',
                resource_types: JSON.stringify(resourceTypes),
                commands: JSON.stringify(commands)
            }),
        };
        return this._post(options, false, true);
    }

    async quickAdd(text) {
        const options = {
            url: this.URLs.syncQuickAdd,
            body: new URLSearchParams({
                token: this.apiToken || this.access_token,
                text: text
            }),
        };
        return this._post(options, false, true);
    }

    async getCompletedTasks(params = {}) {
        const defaultParams = {
            token: this.apiToken || this.access_token,
            ...params
        };
        
        const options = {
            url: this.URLs.syncCompleted,
            body: new URLSearchParams(defaultParams),
        };
        return this._post(options, false, true);
    }

    async getProductivityStats() {
        const options = {
            url: this.URLs.syncStats,
            body: new URLSearchParams({
                token: this.apiToken || this.access_token
            }),
        };
        return this._post(options, false, true);
    }

    async getActivity(params = {}) {
        const defaultParams = {
            token: this.apiToken || this.access_token,
            ...params
        };
        
        const options = {
            url: this.URLs.syncActivity,
            body: new URLSearchParams(defaultParams),
        };
        return this._post(options, false, true);
    }

    async getBackups() {
        const options = {
            url: this.URLs.syncBackups,
            body: new URLSearchParams({
                token: this.apiToken || this.access_token
            }),
        };
        return this._post(options, false, true);
    }

    // **************************   Advanced Features   **********************************

    async moveTaskToProject(taskId, projectId, sectionId = null) {
        const updateData = {
            project_id: projectId
        };
        
        if (sectionId) {
            updateData.section_id = sectionId;
        }
        
        return this.updateTask(taskId, updateData);
    }

    async duplicateTask(taskId, projectId = null) {
        // First get the original task
        const originalTask = await this.getTaskById(taskId);
        
        // Create a new task with similar data
        const duplicateData = {
            content: originalTask.content,
            description: originalTask.description,
            project_id: projectId || originalTask.project_id,
            section_id: originalTask.section_id,
            parent_id: originalTask.parent_id,
            order: originalTask.order,
            label_ids: originalTask.label_ids,
            priority: originalTask.priority,
            due_string: originalTask.due?.string,
            due_date: originalTask.due?.date,
            due_datetime: originalTask.due?.datetime,
            due_lang: originalTask.due?.lang,
            assignee_id: originalTask.assignee_id,
        };
        
        return this.createTask(duplicateData);
    }

    async bulkCreateTasks(tasksData) {
        const commands = tasksData.map((taskData, index) => ({
            type: 'item_add',
            uuid: this.generateRequestId(),
            temp_id: `temp_${index}`,
            args: taskData
        }));
        
        return this.syncData(commands);
    }

    async bulkUpdateTasks(updates) {
        const commands = updates.map(update => ({
            type: 'item_update',
            uuid: this.generateRequestId(),
            args: {
                id: update.id,
                ...update.data
            }
        }));
        
        return this.syncData(commands);
    }

    async bulkDeleteTasks(taskIds) {
        const commands = taskIds.map(taskId => ({
            type: 'item_delete',
            uuid: this.generateRequestId(),
            args: {
                id: taskId
            }
        }));
        
        return this.syncData(commands);
    }

    // **************************   Filters and Search   **********************************

    async getTasksByFilter(filter) {
        const options = {
            url: this.URLs.tasksByFilter(filter),
        };
        return this._get(options);
    }

    async searchTasks(query) {
        // Use filter syntax for searching
        return this.getTasksByFilter(`search: ${query}`);
    }

    async getOverdueTasks() {
        return this.getTasksByFilter('overdue');
    }

    async getTodayTasks() {
        return this.getTasksByFilter('today');
    }

    async getThisWeekTasks() {
        return this.getTasksByFilter('7 days');
    }

    async getTasksByPriority(priority) {
        return this.getTasksByFilter(`p${priority}`);
    }

    async getTasksByAssignee(assigneeId) {
        return this.getTasksByFilter(`assigned by: ${assigneeId}`);
    }

    // **************************   Sharing and Collaboration   **********************************

    async shareProject(projectId, email, messageType = 'invitation') {
        // This would typically be done through the web interface
        // but can be implemented using sync API commands
        const command = {
            type: 'share_project',
            uuid: this.generateRequestId(),
            args: {
                project_id: projectId,
                email: email,
                message_type: messageType
            }
        };
        
        return this.syncData([command]);
    }

    async acceptInvitation(invitationId, invitationSecret) {
        const command = {
            type: 'accept_invitation',
            uuid: this.generateRequestId(),
            args: {
                invitation_id: invitationId,
                invitation_secret: invitationSecret
            }
        };
        
        return this.syncData([command]);
    }

    async rejectInvitation(invitationId, invitationSecret) {
        const command = {
            type: 'reject_invitation',
            uuid: this.generateRequestId(),
            args: {
                invitation_id: invitationId,
                invitation_secret: invitationSecret
            }
        };
        
        return this.syncData([command]);
    }
}

module.exports = { Api };