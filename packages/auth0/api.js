const { OAuth2Requester, get, FriggError } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://dev-example.auth0.com';
        
        this.URLs = {
            userInfo: '/userinfo',
            users: '/api/v2/users',
            applications: '/api/v2/clients'
        };
        
        this.authorizationUri = process.env.AUTH0_AUTH_URI || `${this.baseUrl}/authorize`;
        this.tokenUri = process.env.AUTH0_TOKEN_URI || `${this.baseUrl}/oauth/token`;
    }

    static Definition = {
        DISPLAY_NAME: 'Auth0',
        MODULE_NAME: 'auth0',
        CATEGORY: 'Authentication',
        USES_OAUTH: true
    };

    async getAuthUri() {
        const { client_id, redirect_uri, scopes } = this.config;
        const params = new URLSearchParams({
            client_id,
            redirect_uri,
            response_type: 'code',
            scope: (scopes || ['openid', 'profile', 'email']).join(' '),
            audience: process.env.AUTH0_AUDIENCE
        });
        return `${this.authorizationUri}?${params.toString()}`;
    }

    async getTokenFromCode(code) {
        const { client_id, client_secret, redirect_uri } = this.config;
        const response = await this.post(this.tokenUri, {
            grant_type: 'authorization_code',
            code,
            client_id,
            client_secret,
            redirect_uri
        });
        return response;
    }

    async refreshAccessToken(refreshToken) {
        const { client_id, client_secret } = this.config;
        const response = await this.post(this.tokenUri, {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id,
            client_secret
        });
        return response;
    }

    // API Methods
    async getCurrentUser() {
        return this.get(this.URLs.userInfo);
    }

    async getUser(userId) {
        return this.get(`${this.URLs.users}/${userId}`);
    }

    async listUsers(params = {}) {
        return this.get(this.URLs.users, params);
    }

    async getApplications() {
        return this.get(this.URLs.applications);
    }
}

module.exports = { Api };
