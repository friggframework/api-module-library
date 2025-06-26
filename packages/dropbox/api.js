const { OAuth2Requester, get } = require('@friggframework/core');

// Dropbox API v2
// https://www.dropbox.com/developers/documentation
// Core resources: files, sharing, users, team

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = 'https://api.dropboxapi.com/2';
        this.contentBaseUrl = 'https://content.dropboxapi.com/2';
        
        this.URLs = {
            // Users
            getCurrentAccount: '/users/get_current_account',
            
            // Files
            listFolder: '/files/list_folder',
            getMetadata: '/files/get_metadata',
            upload: '/files/upload',
            download: '/files/download',
            
            // Sharing
            createSharedLink: '/sharing/create_shared_link_with_settings',
            listSharedLinks: '/sharing/list_shared_links',
        };

        this.authorizationUri = encodeURI(
            `https://www.dropbox.com/oauth2/authorize?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&state=${this.state}`
        );
        this.tokenUri = 'https://api.dropboxapi.com/oauth2/token';

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
            'Content-Type': 'application/json',
        };
        options.headers = {
            ...authHeaders,
            ...options.headers,
        };
    }

    async getUserDetails() {
        const options = {
            url: this.baseUrl + this.URLs.getCurrentAccount,
        };
        return this._post(options);
    }

    async listFolder(path = '', params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.listFolder,
            body: { path, ...params },
        };
        return this._post(options);
    }

    async uploadFile(path, fileContent) {
        const options = {
            url: this.contentBaseUrl + this.URLs.upload,
            headers: {
                'Authorization': `Bearer ${this.access_token}`,
                'Dropbox-API-Arg': JSON.stringify({ path, mode: 'add', autorename: true }),
                'Content-Type': 'application/octet-stream',
            },
            body: fileContent,
        };
        return this._post(options, false);
    }

    async createSharedLink(path, settings = {}) {
        const options = {
            url: this.baseUrl + this.URLs.createSharedLink,
            body: { path, settings },
        };
        return this._post(options);
    }
}

module.exports = { Api };