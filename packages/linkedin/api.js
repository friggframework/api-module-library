const { OAuth2Requester, get } = require('@friggframework/core');

// LinkedIn API v2
// https://docs.microsoft.com/en-us/linkedin/
// Core resources: people, organizations, shares, ugcPosts

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = 'https://api.linkedin.com/v2';
        
        this.URLs = {
            // People/Profile
            people: '/people/(id:{person-id})',
            me: '/me',
            
            // Organizations
            organizations: '/organizations',
            
            // Posts and Shares
            shares: '/shares',
            ugcPosts: '/ugcPosts',
            
            // Companies
            companies: '/companies',
        };

        this.authorizationUri = encodeURI(
            `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}&scope=${this.scope}`
        );
        this.tokenUri = 'https://www.linkedin.com/oauth/v2/accessToken';

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

    async getProfile(personId = '~') {
        const options = {
            url: this.baseUrl + `/people/(id:${personId})`,
        };
        return this._get(options);
    }

    async createShare(body) {
        const options = {
            url: this.baseUrl + this.URLs.shares,
            body: body,
        };
        return this._post(options);
    }

    async getCompanies(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.companies,
            query: params,
        };
        return this._get(options);
    }
}

module.exports = { Api };