const { OAuth2Requester } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'Product Management';
        
        this.URLs = {
            me: '/me',
            users: '/users',
            // Add more endpoints here
        };
        
        this.authorizationUri = process.env.GOOGLE_SHEETS_AUTH_URI;
        this.tokenUri = process.env.GOOGLE_SHEETS_TOKEN_URI;
    }

    static Definition = {
        DISPLAY_NAME: 'Google Sheets',
        MODULE_NAME: 'google-sheets',
        CATEGORY: 'https://sheets.googleapis.com',
        USES_OAUTH: true
    };

    async getAuthUri() {
        const { client_id, redirect_uri, scopes } = this.config;
        const params = new URLSearchParams({
            client_id,
            redirect_uri,
            response_type: 'code',
            scope: scopes.join(' '),
            access_type: 'offline',
            prompt: 'consent'
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
        return this.get(this.URLs.me);
    }

    async listUsers(params = {}) {
        return this.get(this.URLs.users, params);
    }

    // Add more API methods here based on the API documentation
}

module.exports = { Api };
