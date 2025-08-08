const { OAuth2Requester, get } = require('@friggframework/core');

// Box API v2.0
// https://developer.box.com/
// Core resources: files, folders, users, collaborations

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = 'https://api.box.com/2.0';
        
        this.URLs = {
            // Users
            me: '/users/me',
            
            // Files
            files: '/files',
            fileById: (fileId) => `/files/${fileId}`,
            fileContent: (fileId) => `/files/${fileId}/content`,
            
            // Folders
            folders: '/folders',
            folderById: (folderId) => `/folders/${folderId}`,
            folderItems: (folderId) => `/folders/${folderId}/items`,
            
            // Search
            search: '/search',
        };

        this.authorizationUri = encodeURI(
            `https://account.box.com/api/oauth2/authorize?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}`
        );
        this.tokenUri = 'https://api.box.com/oauth2/token';

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

    async getUserDetails() {
        const options = {
            url: this.baseUrl + this.URLs.me,
        };
        return this._get(options);
    }

    async getFolderItems(folderId = '0', params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.folderItems(folderId),
            query: params,
        };
        return this._get(options);
    }

    async getFileById(fileId) {
        const options = {
            url: this.baseUrl + this.URLs.fileById(fileId),
        };
        return this._get(options);
    }

    async createFolder(name, parentId = '0') {
        const options = {
            url: this.baseUrl + this.URLs.folders,
            body: {
                name,
                parent: { id: parentId }
            },
        };
        return this._post(options);
    }

    async search(query, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.search,
            query: { query, ...params },
        };
        return this._get(options);
    }
}

module.exports = { Api };