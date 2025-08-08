const { OAuth2Requester, get } = require('@friggframework/core');

// Miro REST API v2 client
// Supports OAuth2 authentication
// Documentation: https://developers.miro.com/reference/api-reference

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = 'https://api.miro.com/v2';
        this.client_id = get(params, 'client_id', process.env.MIRO_CLIENT_ID);
        this.client_secret = get(params, 'client_secret', process.env.MIRO_CLIENT_SECRET);
        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        
        // OAuth endpoints
        this.authorizationUri = 'https://miro.com/oauth/authorize';
        this.tokenUri = 'https://api.miro.com/v1/oauth/token';

        this.URLs = {
            // Boards
            boards: '/boards',
            boardById: (boardId) => `/boards/${boardId}`,
            
            // Board Items
            boardItems: (boardId) => `/boards/${boardId}/items`,
            boardItemById: (boardId, itemId) => `/boards/${boardId}/items/${itemId}`,
            
            // Specific Item Types
            stickyNotes: (boardId) => `/boards/${boardId}/sticky_notes`,
            stickyNoteById: (boardId, itemId) => `/boards/${boardId}/sticky_notes/${itemId}`,
            shapes: (boardId) => `/boards/${boardId}/shapes`,
            shapeById: (boardId, itemId) => `/boards/${boardId}/shapes/${itemId}`,
            texts: (boardId) => `/boards/${boardId}/texts`,
            textById: (boardId, itemId) => `/boards/${boardId}/texts/${itemId}`,
            images: (boardId) => `/boards/${boardId}/images`,
            imageById: (boardId, itemId) => `/boards/${boardId}/images/${itemId}`,
            documents: (boardId) => `/boards/${boardId}/documents`,
            documentById: (boardId, itemId) => `/boards/${boardId}/documents/${itemId}`,
            embeds: (boardId) => `/boards/${boardId}/embeds`,
            embedById: (boardId, itemId) => `/boards/${boardId}/embeds/${itemId}`,
            frames: (boardId) => `/boards/${boardId}/frames`,
            frameById: (boardId, itemId) => `/boards/${boardId}/frames/${itemId}`,
            connectors: (boardId) => `/boards/${boardId}/connectors`,
            connectorById: (boardId, itemId) => `/boards/${boardId}/connectors/${itemId}`,
            
            // Tags
            tags: (boardId) => `/boards/${boardId}/tags`,
            tagById: (boardId, tagId) => `/boards/${boardId}/tags/${tagId}`,
            
            // Teams
            teams: '/teams',
            teamById: (teamId) => `/teams/${teamId}`,
            teamMembers: (teamId) => `/teams/${teamId}/members`,
            teamMemberById: (teamId, memberId) => `/teams/${teamId}/members/${memberId}`,
            
            // Organizations
            organizations: '/organizations',
            organizationById: (orgId) => `/organizations/${orgId}`,
            organizationMembers: (orgId) => `/organizations/${orgId}/members`,
            organizationMemberById: (orgId, memberId) => `/organizations/${orgId}/members/${memberId}`,
            organizationTeams: (orgId) => `/organizations/${orgId}/teams`,
            
            // Enterprise (Admin APIs)
            enterprise: '/enterprise',
            enterpriseUsers: '/enterprise/users',
            enterpriseUserById: (userId) => `/enterprise/users/${userId}`,
            enterpriseAuditLogs: '/enterprise/audit-logs',
            
            // App Cards and Data
            appCards: (boardId) => `/boards/${boardId}/app_cards`,
            appCardById: (boardId, itemId) => `/boards/${boardId}/app_cards/${itemId}`,
            
            // Comments
            boardComments: (boardId) => `/boards/${boardId}/comments`,
            itemComments: (boardId, itemId) => `/boards/${boardId}/items/${itemId}/comments`,
            commentById: (boardId, commentId) => `/boards/${boardId}/comments/${commentId}`,
            
            // Webhooks
            webhooks: '/webhooks',
            webhookById: (webhookId) => `/webhooks/${webhookId}`,
            
            // Templates
            templates: '/templates',
            templateById: (templateId) => `/templates/${templateId}`,
            
            // User info
            userInfo: '/users/me',
        };

        // Default scopes
        this.scope = get(params, 'scope', 'boards:read boards:write');
    }

    // Generate OAuth authorization URL
    getAuthUri(scopes = null) {
        const requestedScopes = scopes || this.scope;
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id,
            redirect_uri: this.redirect_uri,
            scope: requestedScopes,
            state: this.state || 'random_state_string',
        });
        
        return `${this.authorizationUri}?${params.toString()}`;
    }

    // Exchange authorization code for access token
    async getTokenFromCode(code) {
        const tokenData = {
            grant_type: 'authorization_code',
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
                'Accept': 'application/json',
            },
        };

        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    // Refresh access token
    async refreshAccessToken() {
        if (!this.refresh_token) {
            throw new Error('No refresh token available');
        }

        const tokenData = {
            grant_type: 'refresh_token',
            client_id: this.client_id,
            client_secret: this.client_secret,
            refresh_token: this.refresh_token,
        };

        const options = {
            url: this.tokenUri,
            body: tokenData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
        };

        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    // Set access and refresh tokens
    async setTokens(tokenResponse) {
        this.access_token = tokenResponse.access_token;
        if (tokenResponse.refresh_token) {
            this.refresh_token = tokenResponse.refresh_token;
        }
        
        if (tokenResponse.expires_in) {
            this.accessTokenExpire = new Date(Date.now() + tokenResponse.expires_in * 1000);
        }

        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    // Add authentication headers
    addAuthHeaders(options) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${this.access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
    }

    async _get(options) {
        options.url = this.baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._get(options);
    }

    async _post(options, stringify = true) {
        options.url = this.baseUrl + options.url;
        this.addAuthHeaders(options);
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

    // **************************   User Info   **********************************

    async getUserInfo() {
        const options = {
            url: this.URLs.userInfo,
        };
        return this._get(options);
    }

    // **************************   Boards   **********************************

    async createBoard(boardData) {
        const options = {
            url: this.URLs.boards,
            body: boardData,
        };
        return this._post(options);
    }

    async getBoards(params = {}) {
        const options = {
            url: this.URLs.boards,
            query: params
        };
        return this._get(options);
    }

    async getBoardById(boardId) {
        const options = {
            url: this.URLs.boardById(boardId),
        };
        return this._get(options);
    }

    async updateBoard(boardId, boardData) {
        const options = {
            url: this.URLs.boardById(boardId),
            body: boardData,
        };
        return this._patch(options);
    }

    async deleteBoard(boardId) {
        const options = {
            url: this.URLs.boardById(boardId),
        };
        return this._delete(options);
    }

    async copyBoard(boardId, copyData) {
        const options = {
            url: `${this.URLs.boardById(boardId)}/copy`,
            body: copyData,
        };
        return this._post(options);
    }

    async shareBoardWithTeam(boardId, teamShareData) {
        const options = {
            url: `${this.URLs.boardById(boardId)}/share`,
            body: teamShareData,
        };
        return this._post(options);
    }

    // **************************   Board Items (Generic)   **********************************

    async getBoardItems(boardId, params = {}) {
        const options = {
            url: this.URLs.boardItems(boardId),
            query: params
        };
        return this._get(options);
    }

    async getBoardItemById(boardId, itemId) {
        const options = {
            url: this.URLs.boardItemById(boardId, itemId),
        };
        return this._get(options);
    }

    async updateBoardItem(boardId, itemId, itemData) {
        const options = {
            url: this.URLs.boardItemById(boardId, itemId),
            body: itemData,
        };
        return this._patch(options);
    }

    async deleteBoardItem(boardId, itemId) {
        const options = {
            url: this.URLs.boardItemById(boardId, itemId),
        };
        return this._delete(options);
    }

    // **************************   Sticky Notes   **********************************

    async createStickyNote(boardId, stickyNoteData) {
        const options = {
            url: this.URLs.stickyNotes(boardId),
            body: stickyNoteData,
        };
        return this._post(options);
    }

    async getStickyNotes(boardId, params = {}) {
        const options = {
            url: this.URLs.stickyNotes(boardId),
            query: params
        };
        return this._get(options);
    }

    async getStickyNoteById(boardId, itemId) {
        const options = {
            url: this.URLs.stickyNoteById(boardId, itemId),
        };
        return this._get(options);
    }

    async updateStickyNote(boardId, itemId, stickyNoteData) {
        const options = {
            url: this.URLs.stickyNoteById(boardId, itemId),
            body: stickyNoteData,
        };
        return this._patch(options);
    }

    async deleteStickyNote(boardId, itemId) {
        const options = {
            url: this.URLs.stickyNoteById(boardId, itemId),
        };
        return this._delete(options);
    }

    // **************************   Shapes   **********************************

    async createShape(boardId, shapeData) {
        const options = {
            url: this.URLs.shapes(boardId),
            body: shapeData,
        };
        return this._post(options);
    }

    async getShapes(boardId, params = {}) {
        const options = {
            url: this.URLs.shapes(boardId),
            query: params
        };
        return this._get(options);
    }

    async getShapeById(boardId, itemId) {
        const options = {
            url: this.URLs.shapeById(boardId, itemId),
        };
        return this._get(options);
    }

    async updateShape(boardId, itemId, shapeData) {
        const options = {
            url: this.URLs.shapeById(boardId, itemId),
            body: shapeData,
        };
        return this._patch(options);
    }

    async deleteShape(boardId, itemId) {
        const options = {
            url: this.URLs.shapeById(boardId, itemId),
        };
        return this._delete(options);
    }

    // **************************   Text Items   **********************************

    async createText(boardId, textData) {
        const options = {
            url: this.URLs.texts(boardId),
            body: textData,
        };
        return this._post(options);
    }

    async getTexts(boardId, params = {}) {
        const options = {
            url: this.URLs.texts(boardId),
            query: params
        };
        return this._get(options);
    }

    async getTextById(boardId, itemId) {
        const options = {
            url: this.URLs.textById(boardId, itemId),
        };
        return this._get(options);
    }

    async updateText(boardId, itemId, textData) {
        const options = {
            url: this.URLs.textById(boardId, itemId),
            body: textData,
        };
        return this._patch(options);
    }

    async deleteText(boardId, itemId) {
        const options = {
            url: this.URLs.textById(boardId, itemId),
        };
        return this._delete(options);
    }

    // **************************   Images   **********************************

    async createImage(boardId, imageData) {
        const options = {
            url: this.URLs.images(boardId),
            body: imageData,
        };
        return this._post(options);
    }

    async getImages(boardId, params = {}) {
        const options = {
            url: this.URLs.images(boardId),
            query: params
        };
        return this._get(options);
    }

    async getImageById(boardId, itemId) {
        const options = {
            url: this.URLs.imageById(boardId, itemId),
        };
        return this._get(options);
    }

    async updateImage(boardId, itemId, imageData) {
        const options = {
            url: this.URLs.imageById(boardId, itemId),
            body: imageData,
        };
        return this._patch(options);
    }

    async deleteImage(boardId, itemId) {
        const options = {
            url: this.URLs.imageById(boardId, itemId),
        };
        return this._delete(options);
    }

    // **************************   Frames   **********************************

    async createFrame(boardId, frameData) {
        const options = {
            url: this.URLs.frames(boardId),
            body: frameData,
        };
        return this._post(options);
    }

    async getFrames(boardId, params = {}) {
        const options = {
            url: this.URLs.frames(boardId),
            query: params
        };
        return this._get(options);
    }

    async getFrameById(boardId, itemId) {
        const options = {
            url: this.URLs.frameById(boardId, itemId),
        };
        return this._get(options);
    }

    async updateFrame(boardId, itemId, frameData) {
        const options = {
            url: this.URLs.frameById(boardId, itemId),
            body: frameData,
        };
        return this._patch(options);
    }

    async deleteFrame(boardId, itemId) {
        const options = {
            url: this.URLs.frameById(boardId, itemId),
        };
        return this._delete(options);
    }

    // **************************   Connectors   **********************************

    async createConnector(boardId, connectorData) {
        const options = {
            url: this.URLs.connectors(boardId),
            body: connectorData,
        };
        return this._post(options);
    }

    async getConnectors(boardId, params = {}) {
        const options = {
            url: this.URLs.connectors(boardId),
            query: params
        };
        return this._get(options);
    }

    async getConnectorById(boardId, itemId) {
        const options = {
            url: this.URLs.connectorById(boardId, itemId),
        };
        return this._get(options);
    }

    async updateConnector(boardId, itemId, connectorData) {
        const options = {
            url: this.URLs.connectorById(boardId, itemId),
            body: connectorData,
        };
        return this._patch(options);
    }

    async deleteConnector(boardId, itemId) {
        const options = {
            url: this.URLs.connectorById(boardId, itemId),
        };
        return this._delete(options);
    }

    // **************************   Tags   **********************************

    async createTag(boardId, tagData) {
        const options = {
            url: this.URLs.tags(boardId),
            body: tagData,
        };
        return this._post(options);
    }

    async getTags(boardId) {
        const options = {
            url: this.URLs.tags(boardId),
        };
        return this._get(options);
    }

    async getTagById(boardId, tagId) {
        const options = {
            url: this.URLs.tagById(boardId, tagId),
        };
        return this._get(options);
    }

    async updateTag(boardId, tagId, tagData) {
        const options = {
            url: this.URLs.tagById(boardId, tagId),
            body: tagData,
        };
        return this._patch(options);
    }

    async deleteTag(boardId, tagId) {
        const options = {
            url: this.URLs.tagById(boardId, tagId),
        };
        return this._delete(options);
    }

    // **************************   Teams   **********************************

    async getTeams() {
        const options = {
            url: this.URLs.teams,
        };
        return this._get(options);
    }

    async getTeamById(teamId) {
        const options = {
            url: this.URLs.teamById(teamId),
        };
        return this._get(options);
    }

    async getTeamMembers(teamId) {
        const options = {
            url: this.URLs.teamMembers(teamId),
        };
        return this._get(options);
    }

    async getTeamMemberById(teamId, memberId) {
        const options = {
            url: this.URLs.teamMemberById(teamId, memberId),
        };
        return this._get(options);
    }

    async updateTeamMember(teamId, memberId, memberData) {
        const options = {
            url: this.URLs.teamMemberById(teamId, memberId),
            body: memberData,
        };
        return this._patch(options);
    }

    async removeTeamMember(teamId, memberId) {
        const options = {
            url: this.URLs.teamMemberById(teamId, memberId),
        };
        return this._delete(options);
    }

    // **************************   Comments   **********************************

    async createComment(boardId, commentData, itemId = null) {
        const url = itemId ? this.URLs.itemComments(boardId, itemId) : this.URLs.boardComments(boardId);
        const options = {
            url: url,
            body: commentData,
        };
        return this._post(options);
    }

    async getComments(boardId, itemId = null, params = {}) {
        const url = itemId ? this.URLs.itemComments(boardId, itemId) : this.URLs.boardComments(boardId);
        const options = {
            url: url,
            query: params
        };
        return this._get(options);
    }

    async getCommentById(boardId, commentId) {
        const options = {
            url: this.URLs.commentById(boardId, commentId),
        };
        return this._get(options);
    }

    async updateComment(boardId, commentId, commentData) {
        const options = {
            url: this.URLs.commentById(boardId, commentId),
            body: commentData,
        };
        return this._patch(options);
    }

    async deleteComment(boardId, commentId) {
        const options = {
            url: this.URLs.commentById(boardId, commentId),
        };
        return this._delete(options);
    }

    // **************************   Webhooks   **********************************

    async createWebhook(webhookData) {
        const options = {
            url: this.URLs.webhooks,
            body: webhookData,
        };
        return this._post(options);
    }

    async getWebhooks() {
        const options = {
            url: this.URLs.webhooks,
        };
        return this._get(options);
    }

    async getWebhookById(webhookId) {
        const options = {
            url: this.URLs.webhookById(webhookId),
        };
        return this._get(options);
    }

    async updateWebhook(webhookId, webhookData) {
        const options = {
            url: this.URLs.webhookById(webhookId),
            body: webhookData,
        };
        return this._patch(options);
    }

    async deleteWebhook(webhookId) {
        const options = {
            url: this.URLs.webhookById(webhookId),
        };
        return this._delete(options);
    }

    // **************************   Templates   **********************************

    async getTemplates(params = {}) {
        const options = {
            url: this.URLs.templates,
            query: params
        };
        return this._get(options);
    }

    async getTemplateById(templateId) {
        const options = {
            url: this.URLs.templateById(templateId),
        };
        return this._get(options);
    }

    async createBoardFromTemplate(templateId, boardData) {
        const options = {
            url: `${this.URLs.templateById(templateId)}/create-board`,
            body: boardData,
        };
        return this._post(options);
    }

    // **************************   Advanced Features   **********************************

    // Bulk operations
    async bulkCreateItems(boardId, itemsData) {
        const options = {
            url: `${this.URLs.boardItems(boardId)}/bulk`,
            body: { data: itemsData },
        };
        return this._post(options);
    }

    async bulkUpdateItems(boardId, itemsData) {
        const options = {
            url: `${this.URLs.boardItems(boardId)}/bulk`,
            body: { data: itemsData },
        };
        return this._patch(options);
    }

    async bulkDeleteItems(boardId, itemIds) {
        const options = {
            url: `${this.URLs.boardItems(boardId)}/bulk`,
            body: { data: itemIds.map(id => ({ id })) },
        };
        return this._delete(options);
    }

    // Search within board
    async searchBoardItems(boardId, query, params = {}) {
        const searchParams = {
            ...params,
            query: query
        };
        
        const options = {
            url: this.URLs.boardItems(boardId),
            query: searchParams
        };
        return this._get(options);
    }

    // Export board
    async exportBoard(boardId, format = 'pdf', params = {}) {
        const options = {
            url: `${this.URLs.boardById(boardId)}/export`,
            body: {
                format: format,
                ...params
            },
        };
        return this._post(options);
    }

    // Get board analytics/stats
    async getBoardStats(boardId) {
        const options = {
            url: `${this.URLs.boardById(boardId)}/stats`,
        };
        return this._get(options);
    }

    // Collaboration features
    async getBoardCollaborators(boardId) {
        const options = {
            url: `${this.URLs.boardById(boardId)}/members`,
        };
        return this._get(options);
    }

    async inviteCollaborator(boardId, invitationData) {
        const options = {
            url: `${this.URLs.boardById(boardId)}/members`,
            body: invitationData,
        };
        return this._post(options);
    }

    async updateCollaboratorPermissions(boardId, memberId, permissionsData) {
        const options = {
            url: `${this.URLs.boardById(boardId)}/members/${memberId}`,
            body: permissionsData,
        };
        return this._patch(options);
    }

    async removeCollaborator(boardId, memberId) {
        const options = {
            url: `${this.URLs.boardById(boardId)}/members/${memberId}`,
        };
        return this._delete(options);
    }

    // Board versions/snapshots
    async createBoardSnapshot(boardId, snapshotData) {
        const options = {
            url: `${this.URLs.boardById(boardId)}/snapshots`,
            body: snapshotData,
        };
        return this._post(options);
    }

    async getBoardSnapshots(boardId) {
        const options = {
            url: `${this.URLs.boardById(boardId)}/snapshots`,
        };
        return this._get(options);
    }

    async restoreBoardSnapshot(boardId, snapshotId) {
        const options = {
            url: `${this.URLs.boardById(boardId)}/snapshots/${snapshotId}/restore`,
            body: {},
        };
        return this._post(options);
    }
}

module.exports = { Api };