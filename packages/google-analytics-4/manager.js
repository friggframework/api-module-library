const { OAuth2Manager } = require('@friggframework/module-plugin');

class GoogleOAuth2Manager extends OAuth2Manager {
    constructor(params) {
        super(params);
        this.authorizationUri = 'https://accounts.google.com/o/oauth2/v2/auth';
        this.tokenUri = 'https://oauth2.googleapis.com/token';
        this.scopes = [
            'https://www.googleapis.com/auth/analytics',
            'https://www.googleapis.com/auth/analytics.readonly'
        ];
        this.scopeString = this.scopes.join(' ');
    }

    /**
     * Get authorization URL with required scopes
     * @param {Object} params - Additional parameters
     * @returns {string} Authorization URL
     */
    getAuthorizationUrl(params = {}) {
        const authParams = {
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: this.scopeString,
            access_type: 'offline',
            prompt: 'consent',
            ...params
        };

        const queryString = new URLSearchParams(authParams).toString();
        return `${this.authorizationUri}?${queryString}`;
    }

    /**
     * Exchange authorization code for tokens
     * @param {string} code - Authorization code
     * @returns {Promise<Object>} Token response
     */
    async exchangeCodeForToken(code) {
        const params = {
            code,
            client_id: this.clientId,
            client_secret: this.clientSecret,
            redirect_uri: this.redirectUri,
            grant_type: 'authorization_code'
        };

        const response = await this._post(this.tokenUri, params);
        return response;
    }

    /**
     * Refresh access token
     * @param {string} refreshToken - Refresh token
     * @returns {Promise<Object>} New token response
     */
    async refreshAccessToken(refreshToken) {
        const params = {
            refresh_token: refreshToken,
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'refresh_token'
        };

        const response = await this._post(this.tokenUri, params);
        return response;
    }

    /**
     * Get user info from Google
     * @param {string} accessToken - Access token
     * @returns {Promise<Object>} User information
     */
    async getUserInfo(accessToken) {
        const url = 'https://www.googleapis.com/oauth2/v2/userinfo';
        const headers = {
            'Authorization': `Bearer ${accessToken}`
        };
        
        const response = await this._get(url, { headers });
        return response;
    }

    /**
     * Revoke access token
     * @param {string} token - Access or refresh token
     * @returns {Promise<Object>} Revocation response
     */
    async revokeToken(token) {
        const url = 'https://oauth2.googleapis.com/revoke';
        const params = { token };
        
        return this._post(url, params);
    }

    /**
     * Set authorization header for API requests
     * @param {Object} options - Request options
     * @returns {Object} Options with authorization header
     */
    setAuthorizationHeader(options) {
        if (!options.headers) {
            options.headers = {};
        }
        options.headers.Authorization = `Bearer ${this.accessToken}`;
        return options;
    }
}

module.exports = GoogleOAuth2Manager;