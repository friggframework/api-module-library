const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://account.aws.amazon.com/api/v1';

        this.URLs = {
            // Account info
            accountInfo: '/account/info',
            
            // Billing
            billing: '/billing/account',
            billingPreferences: '/billing/preferences',
            
            // Organizations
            organizations: '/organizations',
            organizationById: (orgId) => `/organizations/${orgId}`,
            
            // Contact info
            contacts: '/contacts',
            contactById: (contactId) => `/contacts/${contactId}`,
            
            // Security
            security: '/security/settings',
        };

        this.authorizationUri = encodeURI(
            `https://auth.aws.amazon.com/oauth2/authorize?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}&scope=${this.scope}`
        );
        this.tokenUri = 'https://auth.aws.amazon.com/oauth2/token';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    async getTokenFromCode(code) {
        delete this.access_token;
        return super.getTokenFromCode(code);
    }

    async setTokens(params) {
        this.access_token = get(params, 'access_token');
        const newRefreshToken = get(params, 'refresh_token', null);

        if (newRefreshToken) {
            this.refresh_token = newRefreshToken;
        }

        const accessExpiresIn = get(params, 'expires_in', null);
        if (accessExpiresIn) {
            this.accessTokenExpire = new Date(Date.now() + accessExpiresIn * 1000);
        }

        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    addJsonHeaders(options) {
        const jsonHeaders = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        }
    }

    async _post(options, stringify) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // **************************   Account Management   **********************************

    async getAccountInfo() {
        const options = {
            url: this.baseUrl + this.URLs.accountInfo,
        };
        return this._get(options);
    }

    async updateAccountInfo(body) {
        const options = {
            url: this.baseUrl + this.URLs.accountInfo,
            body: body,
        };
        return this._put(options);
    }

    // **************************   Billing   **********************************

    async getBillingInfo() {
        const options = {
            url: this.baseUrl + this.URLs.billing,
        };
        return this._get(options);
    }

    async getBillingPreferences() {
        const options = {
            url: this.baseUrl + this.URLs.billingPreferences,
        };
        return this._get(options);
    }

    async updateBillingPreferences(body) {
        const options = {
            url: this.baseUrl + this.URLs.billingPreferences,
            body: body,
        };
        return this._put(options);
    }

    // **************************   Organizations   **********************************

    async listOrganizations() {
        const options = {
            url: this.baseUrl + this.URLs.organizations,
        };
        return this._get(options);
    }

    async getOrganizationById(id) {
        const options = {
            url: this.baseUrl + this.URLs.organizationById(id),
        };
        return this._get(options);
    }

    // **************************   Contacts   **********************************

    async getContacts() {
        const options = {
            url: this.baseUrl + this.URLs.contacts,
        };
        return this._get(options);
    }

    async updateContact(id, body) {
        const options = {
            url: this.baseUrl + this.URLs.contactById(id),
            body: body,
        };
        return this._put(options);
    }

    // **************************   Security   **********************************

    async getSecuritySettings() {
        const options = {
            url: this.baseUrl + this.URLs.security,
        };
        return this._get(options);
    }

    async updateSecuritySettings(body) {
        const options = {
            url: this.baseUrl + this.URLs.security,
            body: body,
        };
        return this._put(options);
    }
}

module.exports = { Api };