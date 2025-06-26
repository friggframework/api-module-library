const { OAuth2Requester, get } = require('@friggframework/core');

// Xero Accounting API
// https://developer.xero.com/documentation/
// Core resources: contacts, invoices, payments, accounts

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = 'https://api.xero.com/api.xro/2.0';
        
        this.URLs = {
            // Organisation
            organisation: '/Organisation',
            
            // Contacts
            contacts: '/Contacts',
            contactById: (contactId) => `/Contacts/${contactId}`,
            
            // Invoices
            invoices: '/Invoices',
            invoiceById: (invoiceId) => `/Invoices/${invoiceId}`,
            
            // Payments
            payments: '/Payments',
            
            // Accounts
            accounts: '/Accounts',
            
            // Items
            items: '/Items',
        };

        this.authorizationUri = encodeURI(
            `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&scope=${this.scope}&state=${this.state}`
        );
        this.tokenUri = 'https://identity.xero.com/connect/token';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        this.tenantId = get(params, 'tenantId', null);
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

    async getTenants() {
        const options = {
            url: 'https://api.xero.com/connections',
            headers: {
                'Authorization': `Bearer ${this.access_token}`,
                'Content-Type': 'application/json',
            },
        };
        return this._get(options);
    }

    addAuthHeaders(options) {
        const authHeaders = {
            'Authorization': `Bearer ${this.access_token}`,
            'Accept': 'application/json',
            'Xero-tenant-id': this.tenantId,
        };
        options.headers = {
            ...authHeaders,
            ...options.headers,
        };
    }

    async getOrganisation() {
        const options = {
            url: this.baseUrl + this.URLs.organisation,
        };
        return this._get(options);
    }

    async getContacts(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.contacts,
            query: params,
        };
        return this._get(options);
    }

    async createContact(body) {
        const options = {
            url: this.baseUrl + this.URLs.contacts,
            body: body,
        };
        return this._post(options);
    }

    async getInvoices(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.invoices,
            query: params,
        };
        return this._get(options);
    }

    async createInvoice(body) {
        const options = {
            url: this.baseUrl + this.URLs.invoices,
            body: body,
        };
        return this._post(options);
    }

    async getAccounts(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.accounts,
            query: params,
        };
        return this._get(options);
    }
}

module.exports = { Api };