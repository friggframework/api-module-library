const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

const PRODUCTION_BASE_URL = 'https://quickbooks.api.intuit.com';
const SANDBOX_BASE_URL = 'https://sandbox-quickbooks.api.intuit.com';
const DEFAULT_MINOR_VERSION = 75;
const DEFAULT_SCOPE = 'com.intuit.quickbooks.accounting';
const AUTH_BASE = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URI = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const SIGNATURE_HEADER = 'intuit-signature';

// ---- webhook signature helpers (used by verifyWebhookSignature) ------------
function whHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    const want = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === want) {
            const v = headers[key];
            return Array.isArray(v) ? v[0] : v;
        }
    }
    return undefined;
}

/** The bytes the vendor signed: rawBody when given, else the body (JSON-stringified if parsed). */
function whPayload(rawBody, body) {
    if (rawBody !== undefined && rawBody !== null) {
        return Buffer.isBuffer(rawBody)
            ? rawBody
            : Buffer.from(String(rawBody), 'utf8');
    }
    if (body === undefined || body === null) return Buffer.alloc(0);
    if (Buffer.isBuffer(body)) return body;
    if (typeof body === 'string') return Buffer.from(body, 'utf8');
    return Buffer.from(JSON.stringify(body), 'utf8');
}

/** Constant-time string comparison; false (not a throw) when the lengths differ. */
function whSafeEqual(a, b) {
    const x = Buffer.from(String(a), 'utf8');
    const y = Buffer.from(String(b), 'utf8');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * QuickBooks Online Accounting API client.
 *
 * Auth: OAuth 2.0 authorization-code. Token endpoint uses HTTP Basic
 * (client_id:client_secret). Access tokens last ~1h; refresh tokens rotate —
 * persist the new refresh_token on every refresh.
 *
 * Every Accounting path includes the company `realmId` from the OAuth callback.
 * Requests pin `minorversion` (default 75).
 *
 * Base URL (production): https://quickbooks.api.intuit.com
 * Sandbox: https://sandbox-quickbooks.api.intuit.com
 *
 * Docs: https://developer.intuit.com/app/developer/qbo/docs/develop
 * OAuth: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0
 * Rate limits (prod): 500 req/min and 10 concurrent per realmId.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.realmId = get(params, 'realmId', null);
        this.minorversion = Number(
            get(params, 'minorversion', null) ||
                process.env.QUICKBOOKS_MINOR_VERSION ||
                DEFAULT_MINOR_VERSION
        );

        const envName = (
            get(params, 'environment', null) ||
            process.env.QUICKBOOKS_ENVIRONMENT ||
            'production'
        )
            .toString()
            .toLowerCase();
        this.environment = envName === 'sandbox' ? 'sandbox' : 'production';

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            process.env.QUICKBOOKS_BASE_URL ||
            (this.environment === 'sandbox'
                ? SANDBOX_BASE_URL
                : PRODUCTION_BASE_URL);

        this.scope =
            this.scope ||
            process.env.QUICKBOOKS_SCOPE ||
            DEFAULT_SCOPE;

        this.tokenUri = TOKEN_URI;
        this.authorizationUri = this._buildAuthorizationUri();

        this.webhookVerifierToken =
            get(params, 'webhookVerifierToken', null) ||
            process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN ||
            null;

        this.URLs = {
            companyInfo: (realmId) =>
                `/v3/company/${realmId}/companyinfo/${realmId}`,
            query: (realmId) => `/v3/company/${realmId}/query`,
            customer: (realmId) => `/v3/company/${realmId}/customer`,
            customerById: (realmId, id) =>
                `/v3/company/${realmId}/customer/${id}`,
            invoice: (realmId) => `/v3/company/${realmId}/invoice`,
            invoiceById: (realmId, id) =>
                `/v3/company/${realmId}/invoice/${id}`,
            invoiceSend: (realmId, id) =>
                `/v3/company/${realmId}/invoice/${id}/send`,
            paymentById: (realmId, id) =>
                `/v3/company/${realmId}/payment/${id}`,
            salesReceipt: (realmId) => `/v3/company/${realmId}/salesreceipt`,
            refundReceipt: (realmId) => `/v3/company/${realmId}/refundreceipt`,
            deposit: (realmId) => `/v3/company/${realmId}/deposit`,
        };
    }

    _buildAuthorizationUri() {
        const params = new URLSearchParams({
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            response_type: 'code',
            scope: this.scope || DEFAULT_SCOPE,
            state: this.state || '',
        });
        return `${AUTH_BASE}?${params.toString()}`;
    }

    getAuthorizationUri() {
        this.authorizationUri = this._buildAuthorizationUri();
        return this.authorizationUri;
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
        };
    }

    /**
     * Intuit's token endpoint requires HTTP Basic auth with client_id:client_secret.
     * @see https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0
     */
    async getTokenFromCode(code) {
        return this.getTokenFromCodeBasicAuthHeader(code);
    }

    /**
     * Refresh also uses Basic auth; persist the rotated refresh_token from the response.
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append(
            'refresh_token',
            get(refreshTokenObject, 'refresh_token', this.refresh_token)
        );

        const options = {
            body: params,
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
                Authorization: `Basic ${Buffer.from(
                    `${this.client_id}:${this.client_secret}`
                ).toString('base64')}`,
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    requireRealmId() {
        if (!this.realmId) {
            throw new Error(
                'QuickBooks Online requests require realmId (company id from the OAuth callback).'
            );
        }
        return this.realmId;
    }

    _withMinorVersion(query = {}) {
        return { ...query, minorversion: this.minorversion };
    }

    companyUrl(path) {
        return this.baseUrl + path;
    }

    addJsonHeaders(options = {}) {
        options.headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...options.headers,
        };
        return options;
    }

    async _get(options) {
        options.headers = {
            Accept: 'application/json',
            ...options.headers,
        };
        return super._get(options);
    }

    async _post(options, stringify) {
        // Token posts use form-urlencoded; entity posts use JSON.
        if (
            options.headers &&
            options.headers['Content-Type'] ===
                'application/x-www-form-urlencoded'
        ) {
            return super._post(options, stringify);
        }
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    // ---- Identity / company ------------------------------------------------

    /**
     * GET /v3/company/{realmId}/companyinfo/{realmId}
     */
    async getCompanyInfo() {
        const realmId = this.requireRealmId();
        return this._get({
            url: this.companyUrl(this.URLs.companyInfo(realmId)),
            query: this._withMinorVersion(),
        });
    }

    // ---- Query helper ------------------------------------------------------

    /**
     * GET /v3/company/{realmId}/query?query=...
     * @param {string} sql - QuickBooks SQL-like query string
     */
    async query(sql) {
        const realmId = this.requireRealmId();
        return this._get({
            url: this.companyUrl(this.URLs.query(realmId)),
            query: this._withMinorVersion({ query: sql }),
        });
    }

    // ---- Customers ---------------------------------------------------------

    /**
     * GET /v3/company/{realmId}/customer/{id}
     */
    async getCustomer(id) {
        if (!id) throw new Error('getCustomer requires id');
        const realmId = this.requireRealmId();
        return this._get({
            url: this.companyUrl(this.URLs.customerById(realmId, id)),
            query: this._withMinorVersion(),
        });
    }

    /**
     * Query customers with a WHERE clause fragment (without the WHERE keyword),
     * e.g. `PrimaryEmailAddr = 'a@b.com'`.
     * GET /v3/company/{realmId}/query
     */
    async queryCustomers({ where } = {}) {
        if (!where) throw new Error('queryCustomers requires where');
        return this.query(`SELECT * FROM Customer WHERE ${where}`);
    }

    /**
     * List customers via query, optionally filtered by MetaData.LastUpdatedTime.
     * Returns the raw QueryResponse envelope (Customer array under QueryResponse.Customer).
     */
    async listCustomers({
        changedSince,
        startPosition = 1,
        maxResults = 100,
    } = {}) {
        let sql = 'SELECT * FROM Customer';
        if (changedSince) {
            const escaped = String(changedSince).replace(/'/g, "\\'");
            sql += ` WHERE MetaData.LastUpdatedTime > '${escaped}'`;
        }
        sql += ` STARTPOSITION ${Number(startPosition) || 1}`;
        sql += ` MAXRESULTS ${Number(maxResults) || 100}`;
        return this.query(sql);
    }

    /**
     * POST /v3/company/{realmId}/customer
     * @param {object} customer - Customer entity body
     */
    async createCustomer(customer) {
        if (!customer || typeof customer !== 'object') {
            throw new Error('createCustomer requires a customer object');
        }
        const realmId = this.requireRealmId();
        return this._post({
            url: this.companyUrl(this.URLs.customer(realmId)),
            query: this._withMinorVersion(),
            body: customer,
        });
    }

    /**
     * Sparse update. Body must include Id and SyncToken.
     * POST /v3/company/{realmId}/customer?sparse=true
     * @param {object} customer
     */
    async updateCustomer(customer) {
        if (!customer || typeof customer !== 'object') {
            throw new Error('updateCustomer requires a customer object');
        }
        if (!customer.Id || customer.SyncToken === undefined) {
            throw new Error(
                'updateCustomer requires customer.Id and customer.SyncToken'
            );
        }
        const realmId = this.requireRealmId();
        return this._post({
            url: this.companyUrl(this.URLs.customer(realmId)),
            query: this._withMinorVersion({ sparse: true }),
            body: customer,
        });
    }

    // ---- Invoices ----------------------------------------------------------

    /**
     * POST /v3/company/{realmId}/invoice
     */
    async createInvoice(invoice) {
        if (!invoice || typeof invoice !== 'object') {
            throw new Error('createInvoice requires an invoice object');
        }
        const realmId = this.requireRealmId();
        return this._post({
            url: this.companyUrl(this.URLs.invoice(realmId)),
            query: this._withMinorVersion(),
            body: invoice,
        });
    }

    /**
     * GET /v3/company/{realmId}/invoice/{id}
     */
    async getInvoice(id) {
        if (!id) throw new Error('getInvoice requires id');
        const realmId = this.requireRealmId();
        return this._get({
            url: this.companyUrl(this.URLs.invoiceById(realmId, id)),
            query: this._withMinorVersion(),
        });
    }

    /**
     * Email an invoice.
     * POST /v3/company/{realmId}/invoice/{id}/send?sendTo=
     */
    async sendInvoice(id, sendTo) {
        if (!id) throw new Error('sendInvoice requires id');
        const realmId = this.requireRealmId();
        const query = this._withMinorVersion();
        if (sendTo) query.sendTo = sendTo;
        return this._post({
            url: this.companyUrl(this.URLs.invoiceSend(realmId, id)),
            query,
            body: {},
        });
    }

    // ---- Payments / receipts / deposits ------------------------------------

    /**
     * GET /v3/company/{realmId}/payment/{id}
     */
    async getPayment(id) {
        if (!id) throw new Error('getPayment requires id');
        const realmId = this.requireRealmId();
        return this._get({
            url: this.companyUrl(this.URLs.paymentById(realmId, id)),
            query: this._withMinorVersion(),
        });
    }

    /**
     * POST /v3/company/{realmId}/salesreceipt
     */
    async createSalesReceipt(salesReceipt) {
        if (!salesReceipt || typeof salesReceipt !== 'object') {
            throw new Error(
                'createSalesReceipt requires a salesReceipt object'
            );
        }
        const realmId = this.requireRealmId();
        return this._post({
            url: this.companyUrl(this.URLs.salesReceipt(realmId)),
            query: this._withMinorVersion(),
            body: salesReceipt,
        });
    }

    /**
     * POST /v3/company/{realmId}/refundreceipt
     */
    async createRefundReceipt(refundReceipt) {
        if (!refundReceipt || typeof refundReceipt !== 'object') {
            throw new Error(
                'createRefundReceipt requires a refundReceipt object'
            );
        }
        const realmId = this.requireRealmId();
        return this._post({
            url: this.companyUrl(this.URLs.refundReceipt(realmId)),
            query: this._withMinorVersion(),
            body: refundReceipt,
        });
    }

    /**
     * POST /v3/company/{realmId}/deposit
     */
    async createDeposit(deposit) {
        if (!deposit || typeof deposit !== 'object') {
            throw new Error('createDeposit requires a deposit object');
        }
        const realmId = this.requireRealmId();
        return this._post({
            url: this.companyUrl(this.URLs.deposit(realmId)),
            query: this._withMinorVersion(),
            body: deposit,
        });
    }

    // ---- Items / Accounts (option lists) -----------------------------------

    /**
     * List items via query. Optional Type filter (e.g. 'Service', 'Inventory').
     */
    async listItems({ type } = {}) {
        let sql = 'SELECT * FROM Item';
        if (type) {
            const escaped = String(type).replace(/'/g, "\\'");
            sql += ` WHERE Type = '${escaped}'`;
        }
        sql += ' MAXRESULTS 1000';
        return this.query(sql);
    }

    /**
     * List accounts via query. Optional AccountType filter.
     */
    async listAccounts({ accountType } = {}) {
        let sql = 'SELECT * FROM Account';
        if (accountType) {
            const escaped = String(accountType).replace(/'/g, "\\'");
            sql += ` WHERE AccountType = '${escaped}'`;
        }
        sql += ' MAXRESULTS 1000';
        return this.query(sql);
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * Verify an Intuit webhook delivery.
     * Docs: https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks
     *
     * Algorithm: base64(HMAC-SHA256(verifier_token, raw_body)) compared to the
     * `intuit-signature` header. Works for legacy `eventNotifications` payloads
     * and CloudEvents batches — both are signed the same way over the raw body.
     * Never throws; returns true only for a genuine delivery.
     */
    async verifyWebhookSignature({ headers, body, rawBody } = {}) {
        try {
            const secret =
                this.webhookVerifierToken ||
                process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;
            if (!secret) return false;
            const signature = whHeader(headers, SIGNATURE_HEADER);
            if (!signature) return false;
            const payload = whPayload(rawBody, body);
            const expected = crypto
                .createHmac('sha256', String(secret))
                .update(payload)
                .digest('base64');
            return whSafeEqual(expected, signature);
        } catch (_e) {
            return false;
        }
    }
}

module.exports = {
    Api,
    PRODUCTION_BASE_URL,
    SANDBOX_BASE_URL,
    DEFAULT_MINOR_VERSION,
    SIGNATURE_HEADER,
};
