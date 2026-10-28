const { AsyncLocalStorage } = require('node:async_hooks');
const { OAuth2Requester } = require('@friggframework/core');

const tokenRequestContext = new AsyncLocalStorage();

const API_VERSION = 'alpha';
const WEB_APP = 'https://my.freshbooks.com/#';
const INVOICE_STATUSES = {
    0: 'Disputed',
    1: 'Draft',
    2: 'Sent',
    3: 'Viewed',
    4: 'Paid',
    5: 'Auto Paid',
    6: 'Retry',
    7: 'Failed',
    8: 'Partial',
};

const jsonHeaders = () => ({
    'Content-Type': 'application/json',
    'Api-Version': API_VERSION,
});

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.freshbooks.com';
        this.authorizationUri = 'https://auth.freshbooks.com/oauth/authorize/';
        this.tokenUri = `${this.baseUrl}/auth/oauth/token`;
        this.freshbooksUserId = params?.freshbooksUserId ?? null;
        this.URLs = {
            userDetails: '/auth/api/v1/users/me',
            clients: (accountId) =>
                `/accounting/account/${accountId}/users/clients`,
            client: (accountId, clientId) =>
                `/accounting/account/${accountId}/users/clients/${clientId}`,
            invoices: (accountId) =>
                `/accounting/account/${accountId}/invoices/invoices`,
            invoice: (accountId, invoiceId) =>
                `/accounting/account/${accountId}/invoices/invoices/${invoiceId}`,
            payments: (accountId) =>
                `/accounting/account/${accountId}/payments/payments`,
            payment: (accountId, paymentId) =>
                `/accounting/account/${accountId}/payments/payments/${paymentId}`,
            callbacks: (accountId) =>
                `/events/account/${accountId}/events/callbacks`,
            callback: (accountId, callbackId) =>
                `/events/account/${accountId}/events/callbacks/${callbackId}`,
        };
        this.webUrls = {
            client: (clientId) => `${WEB_APP}/client/${clientId}`,
            invoice: (accountId, invoiceId) =>
                `${WEB_APP}/invoice/${accountId}-${invoiceId}`,
            invoices: (search) =>
                search
                    ? `${WEB_APP}/invoices?q=${encodeURIComponent(search)}`
                    : `${WEB_APP}/invoices`,
        };
    }

    invoiceStatusName(status) {
        return INVOICE_STATUSES[status] ?? '';
    }

    getAuthorizationUri() {
        const query = new URLSearchParams({
            client_id: this.client_id,
            response_type: 'code',
            redirect_uri: this.redirect_uri,
        });
        if (this.state) {
            query.set('state', this.state);
        }
        return `${this.authorizationUri}?${query}`;
    }

    async addAuthHeaders(headers) {
        const authHeaders = await super.addAuthHeaders(headers);
        authHeaders['Api-Version'] = API_VERSION;
        return authHeaders;
    }

    // FreshBooks refresh tokens and codes are single-use: a retry after a
    // lost 2xx re-sends a grant FreshBooks already consumed. Starting past
    // the last backoff slot sends the token request once.
    async _rawRequest(url, options, attempt = 0) {
        const tokenRequestAttempt =
            url === this.tokenUri ? this.backOff.length : attempt;
        return super._rawRequest(url, options, tokenRequestAttempt);
    }

    // A 401 on the token request itself must not start a refresh: that
    // would post a second single-use grant.
    _refreshAuthOnce() {
        if (tokenRequestContext.getStore() === this) {
            return Promise.resolve(false);
        }
        return super._refreshAuthOnce();
    }

    async getTokenFromCode(code) {
        return this._requestToken({ grant_type: 'authorization_code', code });
    }

    async refreshAccessToken({ refresh_token }) {
        this.access_token = undefined;
        return this._requestToken({
            grant_type: 'refresh_token',
            refresh_token,
        });
    }

    async _requestToken(grantFields) {
        const response = await tokenRequestContext.run(this, () =>
            this._post({
                url: this.tokenUri,
                headers: jsonHeaders(),
                body: {
                    client_id: this.client_id,
                    client_secret: this.client_secret,
                    redirect_uri: this.redirect_uri,
                    ...grantFields,
                },
            })
        );
        await this.setTokens(response);
        return response;
    }

    async getUserDetails() {
        const { response } = await this._get({
            url: `${this.baseUrl}${this.URLs.userDetails}`,
        });
        if (response?.id == null) {
            throw new Error(
                'FreshBooks users/me response is missing the user id'
            );
        }
        this.freshbooksUserId = String(response.id);
        return response;
    }

    async listClients(accountId, { page = 1, perPage = 100 } = {}) {
        const { response } = await this._get({
            url: `${this.baseUrl}${this.URLs.clients(accountId)}`,
            query: { page, per_page: perPage, sort: 'updated_desc' },
        });
        const { clients, pages } = response.result;
        return { clients, pages };
    }

    async getClient(accountId, clientId) {
        const { response } = await this._get({
            url: `${this.baseUrl}${this.URLs.client(accountId, clientId)}`,
        });
        return response.result.client;
    }

    async findClientsByEmail(accountId, email) {
        if (typeof email !== 'string' || !email.trim()) {
            throw new Error('findClientsByEmail requires a non-empty email');
        }
        const { response } = await this._get({
            url: `${this.baseUrl}${this.URLs.clients(accountId)}`,
            query: { 'search[email]': email.trim(), sort: 'updated_desc' },
        });
        return response.result.clients;
    }

    async createClient(accountId, client) {
        const { response } = await this._post({
            url: `${this.baseUrl}${this.URLs.clients(accountId)}`,
            headers: jsonHeaders(),
            body: { client },
        });
        return response.result.client;
    }

    async updateClient(accountId, clientId, client) {
        const { response } = await this._put({
            url: `${this.baseUrl}${this.URLs.client(accountId, clientId)}`,
            headers: jsonHeaders(),
            body: { client },
        });
        return response.result.client;
    }

    async getInvoice(accountId, invoiceId) {
        const { response } = await this._get({
            url: `${this.baseUrl}${this.URLs.invoice(accountId, invoiceId)}`,
        });
        return response.result.invoice;
    }

    async getPayment(accountId, paymentId) {
        const { response } = await this._get({
            url: `${this.baseUrl}${this.URLs.payment(accountId, paymentId)}`,
            query: { 'include[]': 'invoice' },
        });
        return response.result.payment;
    }

    async listClientInvoices(accountId, clientId, perPage) {
        const { response } = await this._get({
            url: `${this.baseUrl}${this.URLs.invoices(accountId)}`,
            query: {
                'search[customerid]': clientId,
                sort: 'invoice_date_desc',
                per_page: perPage,
            },
        });
        return {
            records: response.result.invoices,
            total: response.result.total,
        };
    }

    async listClientPayments(accountId, clientId, perPage) {
        const { response } = await this._get({
            url: `${this.baseUrl}${this.URLs.payments(accountId)}`,
            query: {
                'search[clientid]': clientId,
                'include[]': 'invoice',
                sort: 'updated_desc',
                per_page: perPage,
            },
        });
        return {
            records: response.result.payments,
            total: response.result.total,
        };
    }

    async listCallbacks(accountId, { page = 1, perPage = 100 } = {}) {
        const { response } = await this._get({
            url: `${this.baseUrl}${this.URLs.callbacks(accountId)}`,
            query: { page, per_page: perPage },
        });
        const { callbacks, pages } = response.result;
        return { callbacks, pages };
    }

    async getCallback(accountId, callbackId) {
        const { response } = await this._get({
            url: `${this.baseUrl}${this.URLs.callback(accountId, callbackId)}`,
        });
        return response.result.callback;
    }

    async createCallback(accountId, { event, uri }) {
        const { response } = await this._post({
            url: `${this.baseUrl}${this.URLs.callbacks(accountId)}`,
            headers: jsonHeaders(),
            body: { callback: { event, uri } },
        });
        return response.result.callback;
    }

    async verifyCallback(accountId, callbackId, verifier) {
        const { response } = await this._put({
            url: `${this.baseUrl}${this.URLs.callback(accountId, callbackId)}`,
            headers: jsonHeaders(),
            body: { callback: { callback_id: callbackId, verifier } },
        });
        return response.result.callback;
    }

    async resendCallbackVerification(accountId, callbackId) {
        const { response } = await this._put({
            url: `${this.baseUrl}${this.URLs.callback(accountId, callbackId)}`,
            headers: jsonHeaders(),
            body: { callback: { resend: true } },
        });
        return response.result.callback;
    }

    async deleteCallback(accountId, callbackId) {
        await this._delete({
            url: `${this.baseUrl}${this.URLs.callback(accountId, callbackId)}`,
        });
    }
}

module.exports = { Api };
