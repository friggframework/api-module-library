const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Square Connect API client (OAuth 2.0).
 *
 * Auth: Bearer access token from Square's authorization-code OAuth flow.
 * Token exchange uses JSON bodies (ObtainToken), not form-urlencoded.
 *
 * Base URL: https://connect.squareup.com (sandbox: https://connect.squareupsandbox.com)
 * API version header: Square-Version (default from Square's published OpenAPI).
 *
 * Official sources:
 *   https://developer.squareup.com/docs
 *   https://github.com/square/connect-api-specification (api.json)
 *   https://developer.squareup.com/docs/oauth-api/overview
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            process.env.SQUARE_BASE_URL ||
            'https://connect.squareup.com';

        // Square-Version from the published OpenAPI default (x-additional-headers).
        this.squareVersion =
            get(params, 'squareVersion', null) ||
            get(params, 'square_version', null) ||
            process.env.SQUARE_VERSION ||
            '2026-09-16';

        this.merchant_id = get(params, 'merchant_id', null);

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        const scope =
            this.scope ||
            process.env.SQUARE_SCOPE ||
            [
                'MERCHANT_PROFILE_READ',
                'CUSTOMERS_READ',
                'CUSTOMERS_WRITE',
                'PAYMENTS_READ',
                'PAYMENTS_WRITE',
                'INVOICES_READ',
                'INVOICES_WRITE',
            ].join(' ');

        const authParams = new URLSearchParams({
            client_id: this.client_id || '',
            response_type: 'code',
            scope,
            redirect_uri: this.redirect_uri || '',
        });
        if (this.state) authParams.set('state', this.state);

        this.authorizationUri = `${this.baseUrl}/oauth2/authorize?${authParams.toString()}`;
        this.tokenUri = `${this.baseUrl}/oauth2/token`;

        this.URLs = {
            merchants: '/v2/merchants',
            merchantById: (merchantId) => `/v2/merchants/${merchantId}`,
            locations: '/v2/locations',
            locationById: (locationId) => `/v2/locations/${locationId}`,
            customers: '/v2/customers',
            customerById: (customerId) => `/v2/customers/${customerId}`,
            payments: '/v2/payments',
            paymentById: (paymentId) => `/v2/payments/${paymentId}`,
            invoices: '/v2/invoices',
            invoiceById: (invoiceId) => `/v2/invoices/${invoiceId}`,
            webhookSubscriptions: '/v2/webhooks/subscriptions',
            webhookSubscriptionById: (subscriptionId) =>
                `/v2/webhooks/subscriptions/${subscriptionId}`,
        };
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    /**
     * Square returns `expires_at` / `refresh_token_expires_at` as ISO-8601
     * timestamps (not `expires_in` seconds). Map those onto the requester's
     * Date fields so refresh scheduling works.
     */
    async setTokens(params) {
        this.access_token = get(params, 'access_token');
        const newRefreshToken = get(params, 'refresh_token', null);
        if (newRefreshToken !== null) {
            this.refresh_token = newRefreshToken;
        }

        const expiresAt = get(params, 'expires_at', null);
        const accessExpiresIn = get(params, 'expires_in', null);
        if (expiresAt) {
            this.accessTokenExpire = new Date(expiresAt);
        } else if (accessExpiresIn !== null) {
            this.accessTokenExpire = new Date(
                Date.now() + Number(accessExpiresIn) * 1000
            );
        }

        const refreshExpiresAt = get(params, 'refresh_token_expires_at', null);
        const refreshExpiresIn = get(
            params,
            'x_refresh_token_expires_in',
            null
        );
        if (refreshExpiresAt) {
            this.refreshTokenExpire = new Date(refreshExpiresAt);
        } else if (refreshExpiresIn !== null) {
            this.refreshTokenExpire = new Date(
                Date.now() + Number(refreshExpiresIn) * 1000
            );
        } else if (this.refresh_token && !this.refreshTokenExpire) {
            // Square refresh tokens are long-lived; keep isAuthenticated() true
            // when the response omits an expiry.
            this.refreshTokenExpire = new Date(
                Date.now() + 1000 * 60 * 60 * 24 * 365
            );
        }

        const merchantId = get(params, 'merchant_id', null);
        if (merchantId) {
            this.merchant_id = merchantId;
        }

        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    /**
     * ObtainToken — POST /oauth2/token with a JSON body
     * (https://developer.squareup.com/reference/square/o-auth-api/obtain-token).
     */
    async getTokenFromCode(code) {
        delete this.access_token;
        const options = {
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: {
                client_id: this.client_id,
                client_secret: this.client_secret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: this.redirect_uri,
            },
        };
        const response = await this._post(options);
        await this.setTokens(response);
        return response;
    }

    /**
     * Refresh via ObtainToken with grant_type=refresh_token (JSON body).
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const refreshToken =
            typeof refreshTokenObject === 'string'
                ? refreshTokenObject
                : refreshTokenObject.refresh_token;
        const options = {
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: {
                client_id: this.client_id,
                client_secret: this.client_secret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            },
        };
        const response = await this._post(options);
        await this.setTokens(response);
        return response;
    }

    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders(headers);
        if (this.squareVersion) {
            next['Square-Version'] = this.squareVersion;
        }
        return next;
    }

    addJsonHeaders(options) {
        options.headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
        };
    }

    async _post(options, stringify) {
        // Token endpoint already sets Content-Type; API bodies are JSON.
        if (options.url && !String(options.url).includes('/oauth2/')) {
            this.addJsonHeaders(options);
        }
        return super._post(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // ---- Merchants ---------------------------------------------------------

    /** ListMerchants — GET /v2/merchants */
    async listMerchants(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.merchants,
            params,
        });
    }

    /**
     * RetrieveMerchant — GET /v2/merchants/{merchant_id}
     * Pass `"me"` for the merchant accessible to the current token.
     */
    async retrieveMerchant(merchantId = 'me') {
        return this._get({
            url: this.baseUrl + this.URLs.merchantById(merchantId),
        });
    }

    // ---- Locations ---------------------------------------------------------

    /** ListLocations — GET /v2/locations */
    async listLocations(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.locations,
            params,
        });
    }

    /** RetrieveLocation — GET /v2/locations/{location_id} */
    async retrieveLocation(locationId) {
        return this._get({
            url: this.baseUrl + this.URLs.locationById(locationId),
        });
    }

    /** CreateLocation — POST /v2/locations */
    async createLocation(data) {
        return this._post({
            url: this.baseUrl + this.URLs.locations,
            body: data,
        });
    }

    /** UpdateLocation — PUT /v2/locations/{location_id} */
    async updateLocation(locationId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.locationById(locationId),
            body: data,
        });
    }

    // ---- Customers ---------------------------------------------------------

    /** ListCustomers — GET /v2/customers */
    async listCustomers(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.customers,
            params,
        });
    }

    /** RetrieveCustomer — GET /v2/customers/{customer_id} */
    async retrieveCustomer(customerId) {
        return this._get({
            url: this.baseUrl + this.URLs.customerById(customerId),
        });
    }

    /** CreateCustomer — POST /v2/customers */
    async createCustomer(data) {
        return this._post({
            url: this.baseUrl + this.URLs.customers,
            body: data,
        });
    }

    /** UpdateCustomer — PUT /v2/customers/{customer_id} */
    async updateCustomer(customerId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.customerById(customerId),
            body: data,
        });
    }

    // ---- Payments ----------------------------------------------------------

    /** ListPayments — GET /v2/payments */
    async listPayments(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.payments,
            params,
        });
    }

    /** GetPayment — GET /v2/payments/{payment_id} */
    async getPayment(paymentId) {
        return this._get({
            url: this.baseUrl + this.URLs.paymentById(paymentId),
        });
    }

    /** CreatePayment — POST /v2/payments */
    async createPayment(data) {
        return this._post({
            url: this.baseUrl + this.URLs.payments,
            body: data,
        });
    }

    /** UpdatePayment — PUT /v2/payments/{payment_id} */
    async updatePayment(paymentId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.paymentById(paymentId),
            body: data,
        });
    }

    // ---- Invoices ----------------------------------------------------------

    /** ListInvoices — GET /v2/invoices (location_id required by Square) */
    async listInvoices(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.invoices,
            params,
        });
    }

    /** GetInvoice — GET /v2/invoices/{invoice_id} */
    async getInvoice(invoiceId) {
        return this._get({
            url: this.baseUrl + this.URLs.invoiceById(invoiceId),
        });
    }

    /** CreateInvoice — POST /v2/invoices */
    async createInvoice(data) {
        return this._post({
            url: this.baseUrl + this.URLs.invoices,
            body: data,
        });
    }

    /** UpdateInvoice — PUT /v2/invoices/{invoice_id} */
    async updateInvoice(invoiceId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.invoiceById(invoiceId),
            body: data,
        });
    }

    // ---- Webhook subscriptions ---------------------------------------------

    /** ListWebhookSubscriptions — GET /v2/webhooks/subscriptions */
    async listWebhookSubscriptions(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookSubscriptions,
            params,
        });
    }

    /** RetrieveWebhookSubscription — GET /v2/webhooks/subscriptions/{id} */
    async retrieveWebhookSubscription(subscriptionId) {
        return this._get({
            url:
                this.baseUrl + this.URLs.webhookSubscriptionById(subscriptionId),
        });
    }

    /** CreateWebhookSubscription — POST /v2/webhooks/subscriptions */
    async createWebhookSubscription(data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookSubscriptions,
            body: data,
        });
    }

    /** UpdateWebhookSubscription — PUT /v2/webhooks/subscriptions/{id} */
    async updateWebhookSubscription(subscriptionId, data) {
        return this._put({
            url:
                this.baseUrl + this.URLs.webhookSubscriptionById(subscriptionId),
            body: data,
        });
    }

    /** DeleteWebhookSubscription — DELETE /v2/webhooks/subscriptions/{id} */
    async deleteWebhookSubscription(subscriptionId) {
        return this._delete({
            url:
                this.baseUrl + this.URLs.webhookSubscriptionById(subscriptionId),
        });
    }
}

module.exports = { Api };
