const {OAuth2Requester} = require('@friggframework/core');

class FastSpringInteractiveQuotesApi extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.fastspring.com';
        
        // OAuth2 configuration
        this.authorizationUri = `${this.baseUrl}/oauth/authorize`;
        this.tokenUri = `${this.baseUrl}/oauth/token`;
        this.revokeUri = `${this.baseUrl}/oauth/revoke`;
        
        this.URLs = {
            userInfo: '/user',
            // Add more endpoints as needed
        };
    }

    async getAuthorizationRequirements() {
        return {
            url: this.authorizationUri,
            type: 'oauth2',
            clientId: this.client_id,
            scope: this.scope || 'read',
            redirectUri: this.redirect_uri
        };
    }

    async getTokenFromCode(code) {
        const options = {
            url: this.tokenUri,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            form: {
                grant_type: 'authorization_code',
                client_id: this.client_id,
                client_secret: this.client_secret,
                code: code,
                redirect_uri: this.redirect_uri
            }
        };

        const response = await this._request(options);
        await this.setTokens(response);
        return response;
    }

    async getCurrentUser() {
        const options = {
            url: this.baseUrl + this.URLs.userInfo,
            method: 'GET',
            headers: this._buildHeaders()
        };

        return this._request(options);
    }

    async refreshToken() {
        if (!this.refresh_token) {
            throw new Error('No refresh token available');
        }

        const options = {
            url: this.tokenUri,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            form: {
                grant_type: 'refresh_token',
                client_id: this.client_id,
                client_secret: this.client_secret,
                refresh_token: this.refresh_token
            }
        };

        const response = await this._request(options);
        await this.setTokens(response);
        return response;
    }

    _buildHeaders() {
        return {
            'Authorization': `Bearer ${this.access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }
}

module.exports = {Api: FastSpringInteractiveQuotesApi};
