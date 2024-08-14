const FormData = require('form-data');
const {OAuth2Requester, get} = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        // The majority of the properties for OAuth are default loaded by OAuth2Requester.
        // This includes the `client_id`, `client_secret`, `scopes`, and `redirect_uri`.
        this.baseUrl = 'https://www.zohoapis.com/crm/v6';
        this.authorizationUri = encodeURI(
            `https://accounts.zoho.com/oauth/v2/auth?scope=${this.scope}&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&access_type=offline`
        );
        this.tokenUri = 'https://accounts.zoho.com/oauth/v2/token';
        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.URLs = {
            // Users
            users: '/users',
            user: (userId) => `/users/${userId}`,

            // Roles
            roles: '/settings/roles',
            role: (roleId) => `/settings/roles/${roleId}`,

            // Profiles
            profiles: '/settings/profiles',
        };
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    async getTokenFromCode(code) {
        // I had to override OAuth2Requester.getTokenFromCode method so I could send a form-data,
        // as described in the docs: https://www.zoho.com/crm/developer/docs/api/v6/access-refresh.html
        const formData = new FormData();
        formData.append('grant_type', 'authorization_code');
        formData.append('client_id', this.client_id);
        formData.append('client_secret', this.client_secret);
        formData.append('redirect_uri', this.redirect_uri);
        formData.append('scope', this.scope);
        formData.append('code', code);
        const options = {
            body: formData,
            headers: formData.getHeaders(),
            url: this.tokenUri,
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    addJsonHeaders(options) {
        const jsonHeaders = {
            'content-type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        }
    }

    async _get(options, stringify) {
        this.addJsonHeaders(options);
        return super._get(options, stringify);
    }

    async _post(options, stringify) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    async _delete(options) {
        this.addJsonHeaders(options);
        const response = await super._delete(options);
        return await this.parsedBody(response);
    }

    // **************************   Users   **********************************
    // https://www.zoho.com/crm/developer/docs/api/v6/get-users.html

    async listUsers(queryParams = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.users,
            query: {...queryParams},
        });
    }

    async getUser(userId) {
        return this._get({
            url: this.baseUrl + this.URLs.user(userId),
        });
    }

    async createUser(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.users,
            body: body
        });
    }

    async updateUser(userId, body = {}) {
        return this._put({
            url: this.baseUrl + this.URLs.user(userId),
            body: body,
        });
    }

    async deleteUser(userId) {
        return this._delete({
            url: this.baseUrl + this.URLs.user(userId),
        });
    }

    // **************************   Roles   **********************************
    // https://www.zoho.com/crm/developer/docs/api/v6/get-roles.html
    
    async listRoles() {
        return this._get({
            url: this.baseUrl + this.URLs.roles
        });
    }

    async getRole(roleId) {
        return this._get({
            url: this.baseUrl + this.URLs.role(roleId)
        });
    }

    async createRole(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.roles,
            body: body
        });
    }

    async updateRole(roleId, body = {}) {
        return this._put({
            url: this.baseUrl + this.URLs.role(roleId),
            body: body,
        });
    }

    async deleteRole(roleId, queryParams = {}) {
        return this._delete({
            url: this.baseUrl + this.URLs.role(roleId),
            query: {...queryParams},
        });
    }

    // **************************   Profiles   **********************************
    // https://www.zoho.com/crm/developer/docs/api/v6/get-profiles.html

    async listProfiles() {
        return this._get({
            url: this.baseUrl + this.URLs.profiles
        });
    }
}

module.exports = {Api};
