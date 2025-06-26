const { OAuth2Requester, get } = require('@friggframework/core');

// Reddit API
// https://www.reddit.com/dev/api/
// Core resources: subreddits, posts, comments, users

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = 'https://oauth.reddit.com/api/v1';
        
        this.URLs = {
            me: '/me',
            subreddits: '/subreddits',
            submit: '/submit',
            comment: '/comment',
            userPosts: '/user/{username}/submitted',
        };

        this.authorizationUri = encodeURI(
            `https://www.reddit.com/api/v1/authorize?client_id=${this.client_id}&response_type=code&state=${this.state}&redirect_uri=${this.redirect_uri}&duration=permanent&scope=${this.scope}`
        );
        this.tokenUri = 'https://www.reddit.com/api/v1/access_token';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    async getTokenFromCode(code) {
        const auth = Buffer.from(`${this.client_id}:${this.client_secret}`).toString('base64');
        const options = {
            url: this.tokenUri,
            headers: {
                'Authorization': `Basic ${auth}`,
                'User-Agent': 'FriggFramework/1.0',
            },
            form: {
                grant_type: 'authorization_code',
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
            'User-Agent': 'FriggFramework/1.0',
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

    async getSubreddits(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.subreddits,
            query: params,
        };
        return this._get(options);
    }

    async submitPost(body) {
        const options = {
            url: this.baseUrl + this.URLs.submit,
            body: body,
        };
        return this._post(options);
    }
}

module.exports = { Api };