const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Attentive (attentivemobile.com) API client.
 *
 * Auth (public apps): OAuth 2.0 authorization-code grant.
 *   Authorize: https://ui.attentivemobile.com/integrations/oauth-install
 *   Token:     POST https://api.attentivemobile.com/v1/authorization-codes/tokens
 *   Docs say the access token does not expire; there is no refresh grant.
 *
 * Auth (private apps): Bearer API key — same Authorization header. Pass the
 * key as `access_token` (or use setAccessToken).
 *
 * Base URL: https://api.attentivemobile.com/v1
 * Official OpenAPI: https://docs.attentive.com/openapi/attentive-api-bundled.yaml
 * Docs: https://docs.attentive.com/
 *
 * Webhook signatures use HMAC-SHA256 hexdigest over the raw body compared to
 * `x-attentive-hmac-sha256`. Signing key comes from the Attentive app Webhooks
 * tab (not from the create-webhook API response).
 */
const PRODUCTION_BASE_URL = 'https://api.attentivemobile.com/v1';
const AUTHORIZE_URL =
    'https://ui.attentivemobile.com/integrations/oauth-install';
const TOKEN_URL =
    'https://api.attentivemobile.com/v1/authorization-codes/tokens';
const SIGNATURE_HEADER = 'x-attentive-hmac-sha256';

const DEFAULT_SCOPES = [
    'subscriptions:write',
    'subscriptions:read',
    'events:write',
    'ecommerce:write',
    'attributes:write',
    'product_catalogs:write',
    'product_catalogs:read',
    'webhooks:write',
].join(' ');

// ---- webhook signature helpers --------------------------------------------

function whHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    if (headers[name] !== undefined) return headers[name];
    const lower = name.toLowerCase();
    if (headers[lower] !== undefined) return headers[lower];
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lower) return headers[key];
    }
    return undefined;
}

function whPayload(rawBody, body) {
    if (typeof rawBody === 'string') return rawBody;
    if (Buffer.isBuffer(rawBody)) return rawBody.toString('utf8');
    if (body === undefined || body === null) return '';
    if (typeof body === 'string') return body;
    if (Buffer.isBuffer(body)) return body.toString('utf8');
    return JSON.stringify(body);
}

function whSafeEqual(expected, provided) {
    if (typeof expected !== 'string' || typeof provided !== 'string') {
        return false;
    }
    try {
        const a = Buffer.from(expected, 'utf8');
        const b = Buffer.from(provided, 'utf8');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch (_e) {
        return false;
    }
}

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            process.env.ATTENTIVE_BASE_URL ||
            PRODUCTION_BASE_URL;

        this.client_id =
            this.client_id ||
            get(params, 'client_id', null) ||
            process.env.ATTENTIVE_CLIENT_ID;
        this.client_secret =
            this.client_secret ||
            get(params, 'client_secret', null) ||
            process.env.ATTENTIVE_CLIENT_SECRET;
        this.redirect_uri =
            this.redirect_uri ||
            get(params, 'redirect_uri', null) ||
            process.env.ATTENTIVE_REDIRECT_URI;
        this.scope =
            this.scope ||
            get(params, 'scope', null) ||
            process.env.ATTENTIVE_SCOPE ||
            DEFAULT_SCOPES;

        this.webhookSigningKey =
            get(params, 'webhookSigningKey', null) ||
            process.env.ATTENTIVE_WEBHOOK_SIGNING_KEY ||
            null;

        // Attentive access tokens do not expire / have no refresh grant.
        this.isRefreshable = false;

        this.tokenUri = TOKEN_URL;
        this.authorizationUri = this._buildAuthorizationUri();

        this.access_token = get(params, 'access_token', null);
        this.id_token = get(params, 'id_token', null);

        this.URLs = {
            me: '/me',
            subscriptions: '/subscriptions',
            unsubscribe: '/subscriptions/unsubscribe',
            customAttributes: '/attributes/custom',
            customEvents: '/events/custom',
            productView: '/events/ecommerce/product-view',
            addToCart: '/events/ecommerce/add-to-cart',
            purchase: '/events/ecommerce/purchase',
            productCatalogUploads: '/product-catalog/uploads',
            productCatalogUploadById: (uploadId) =>
                `/product-catalog/uploads/${uploadId}`,
            webhooks: '/webhooks',
            webhookById: (webhookId) => `/webhooks/${webhookId}`,
        };
    }

    _buildAuthorizationUri() {
        const params = new URLSearchParams();
        if (this.client_id) params.set('client_id', this.client_id);
        if (this.redirect_uri) params.set('redirect_uri', this.redirect_uri);
        if (this.scope) params.set('scope', this.scope);
        if (this.state) params.set('state', this.state);
        const qs = params.toString();
        return qs ? `${AUTHORIZE_URL}?${qs}` : AUTHORIZE_URL;
    }

    _jsonHeaders() {
        return {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
    }

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null || value === '') continue;
            usp.append(key, String(value));
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    getAuthorizationRequirements() {
        return {
            url: this._buildAuthorizationUri(),
            type: 'oauth2',
        };
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Test authentication / resolve installer company.
     * GET /me
     * Response: { applicationName, attentiveDomainName, companyName,
     *   contactEmail, companyId }
     */
    async getMe() {
        return this._get({ url: this.baseUrl + this.URLs.me });
    }

    // ---- Subscriptions -----------------------------------------------------

    /**
     * Opt a user into a subscription.
     * POST /subscriptions
     * Scope: subscriptions:write
     */
    async addSubscriptions(body) {
        return this._post({
            url: this.baseUrl + this.URLs.subscriptions,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * List subscription types/channels a user is subscribed to.
     * GET /subscriptions?phone=&email=
     * Scope: subscriptions:read
     * At least one of phone or email is required.
     */
    async getSubscriptions(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.subscriptions +
                this._buildQuery(params),
        });
    }

    /**
     * Unsubscribe a user.
     * POST /subscriptions/unsubscribe
     * Scope: subscriptions:write
     */
    async unsubscribeSubscriptions(body) {
        return this._post({
            url: this.baseUrl + this.URLs.unsubscribe,
            headers: this._jsonHeaders(),
            body,
        });
    }

    // ---- Custom attributes -------------------------------------------------

    /**
     * Create or update custom attributes for a user.
     * POST /attributes/custom
     * Scope: attributes:write
     */
    async postCustomAttributes(body) {
        return this._post({
            url: this.baseUrl + this.URLs.customAttributes,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Get custom attributes for a user (by phone and/or email).
     * GET /attributes/custom
     * Scope: attributes:write (per official OpenAPI security)
     */
    async getCustomAttributes(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.customAttributes +
                this._buildQuery(params),
        });
    }

    // ---- Events ------------------------------------------------------------

    /**
     * Record a custom event.
     * POST /events/custom
     * Scope: events:write
     */
    async postCustomEvents(body) {
        return this._post({
            url: this.baseUrl + this.URLs.customEvents,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Record a product-view ecommerce event.
     * POST /events/ecommerce/product-view
     * Scope: ecommerce:write
     */
    async postProductViewEvents(body) {
        return this._post({
            url: this.baseUrl + this.URLs.productView,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Record an add-to-cart ecommerce event.
     * POST /events/ecommerce/add-to-cart
     * Scope: ecommerce:write
     */
    async postAddToCartEvents(body) {
        return this._post({
            url: this.baseUrl + this.URLs.addToCart,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Record a purchase ecommerce event.
     * POST /events/ecommerce/purchase
     * Scope: ecommerce:write
     */
    async postPurchaseEvents(body) {
        return this._post({
            url: this.baseUrl + this.URLs.purchase,
            headers: this._jsonHeaders(),
            body,
        });
    }

    // ---- Product catalog ---------------------------------------------------

    /**
     * Start a product-catalog upload; returns a pre-signed S3 URL.
     * POST /product-catalog/uploads
     * Scope: product_catalogs:write
     * Body may include `{ validateOnly: true }`.
     */
    async postUpload(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.productCatalogUploads,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * List recent catalog uploads (newest first).
     * GET /product-catalog/uploads
     * Scope: product_catalogs:read
     */
    async getUploads() {
        return this._get({
            url: this.baseUrl + this.URLs.productCatalogUploads,
        });
    }

    /**
     * Look up a catalog upload by id.
     * GET /product-catalog/uploads/{uploadId}
     * Scope: product_catalogs:read
     */
    async lookupUpload(uploadId) {
        return this._get({
            url:
                this.baseUrl + this.URLs.productCatalogUploadById(uploadId),
        });
    }

    // ---- Webhooks (subscription management) --------------------------------

    /**
     * List webhooks.
     * GET /webhooks
     * Scope: webhooks:write
     */
    async getWebhooks() {
        return this._get({ url: this.baseUrl + this.URLs.webhooks });
    }

    /**
     * Create a subscription webhook.
     * POST /webhooks
     * Scope: webhooks:write
     * Body: { url, events: string[] }
     * Event types (case-sensitive): sms.subscribed, sms.sent,
     * sms.message_link_click, email.subscribed, email.unsubscribed,
     * email.message_link_click, email.opened, custom_attribute.set
     * (platform UI also documents sms.unsubscribed, sms.inbound_message,
     * email.sent — confirm against current docs before relying on them).
     */
    async createWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Update a webhook (url, events, and/or disabled).
     * PUT /webhooks/{webhookId}
     * Scope: webhooks:write
     */
    async updateWebhook(webhookId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Delete a webhook.
     * DELETE /webhooks/{webhookId}
     * Scope: webhooks:write
     */
    async deleteWebhook(webhookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        });
    }

    /**
     * Verify an Attentive webhook delivery.
     * Docs: https://docs.attentive.com/docs/webhook-authentication
     *
     * Algorithm: hex(HMAC-SHA256(signing_key, raw_body)) compared to the
     * `x-attentive-hmac-sha256` header. Never throws; returns true only for a
     * genuine delivery.
     */
    async verifyWebhookSignature({ headers, body, rawBody } = {}) {
        try {
            const secret =
                this.webhookSigningKey ||
                process.env.ATTENTIVE_WEBHOOK_SIGNING_KEY;
            if (!secret) return false;
            const signature = whHeader(headers, SIGNATURE_HEADER);
            if (!signature) return false;
            const payload = whPayload(rawBody, body);
            const expected = crypto
                .createHmac('sha256', String(secret))
                .update(payload, 'utf8')
                .digest('hex');
            return whSafeEqual(expected, signature);
        } catch (_e) {
            return false;
        }
    }
}

module.exports = {
    Api,
    PRODUCTION_BASE_URL,
    AUTHORIZE_URL,
    TOKEN_URL,
    SIGNATURE_HEADER,
    DEFAULT_SCOPES,
};
