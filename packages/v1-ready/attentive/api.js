const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

const BASE_URL = 'https://api.attentivemobile.com/v1';
const AUTHORIZE_URL =
    'https://ui.attentivemobile.com/integrations/oauth-install';
const TOKEN_URI =
    'https://api.attentivemobile.com/v1/authorization-codes/tokens';

const SIGNATURE_HEADER = 'x-attentive-hmac-sha256';

/**
 * Attentive REST API client.
 *
 * Auth (both use `Authorization: Bearer`):
 *   1. OAuth 2.0 authorization-code (public / distributed apps)
 *   2. Private-app API key alternate via setApiToken / setAuthParams
 *
 * Base URL: https://api.attentivemobile.com/v1
 * Docs: https://docs.attentive.com/
 * Auth: https://docs.attentive.com/docs/authentication
 * OpenAPI fragments: https://docs.attentive.com/reference/ (per-endpoint)
 *
 * The curated machine-readable contract lives in ./attentive.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 *
 * Prior art: packages/needs-updating/attentive (v0 ModuleManager module).
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = get(params, 'baseUrl', null) || BASE_URL;
        this.tokenUri = TOKEN_URI;

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
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/attentive`
                : null);
        this.scope =
            this.scope ||
            get(params, 'scope', null) ||
            get(params, 'scopes', null) ||
            process.env.ATTENTIVE_SCOPES ||
            null;

        // Bearer: OAuth access_token OR private-app API key (same header).
        // https://docs.attentive.com/docs/authentication
        this.access_token =
            get(params, 'access_token', null) ||
            get(params, 'api_key', null) ||
            get(params, 'apiKey', null) ||
            process.env.ATTENTIVE_API_KEY ||
            null;
        this.id_token = get(params, 'id_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.webhookSecret =
            get(params, 'webhookSecret', null) ||
            get(params, 'webhook_secret', null) ||
            process.env.ATTENTIVE_WEBHOOK_SECRET ||
            null;

        this.authorizationUri = this._buildAuthorizationUri();

        this.URLs = {
            me: '/me',
            subscriptions: '/subscriptions',
            unsubscribe: '/subscriptions/unsubscribe',
            customAttributes: '/attributes/custom',
            customEvents: '/events/custom',
            catalogUploads: '/product-catalog/uploads',
            catalogUploadById: (id) => `/product-catalog/uploads/${id}`,
            webhooks: '/webhooks',
            webhookById: (id) => `/webhooks/${id}`,
        };
    }

    _buildAuthorizationUri() {
        const q = new URLSearchParams();
        if (this.client_id) q.set('client_id', this.client_id);
        if (this.redirect_uri) q.set('redirect_uri', this.redirect_uri);
        if (this.scope) q.set('scope', this.scope);
        if (this.state) q.set('state', this.state);
        return `${AUTHORIZE_URL}?${q.toString()}`;
    }

    getAuthUri() {
        this.authorizationUri = this._buildAuthorizationUri();
        return this.authorizationUri;
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthUri(),
            type: 'oauth2',
            data: {
                alternate: {
                    type: 'apiKey',
                    jsonSchema: {
                        title: 'Attentive API Key',
                        type: 'object',
                        required: ['api_key'],
                        properties: {
                            api_key: {
                                type: 'string',
                                title: 'API Key',
                                description:
                                    'Private-app API key from Attentive App Marketplace (Built by you). Sent as Authorization: Bearer.',
                            },
                        },
                    },
                    uiSchema: {
                        api_key: {
                            'ui:widget': 'password',
                            'ui:help':
                                'For single-tenant / private apps. Public distributed apps must use OAuth 2.0.',
                        },
                    },
                },
            },
        };
    }

    /**
     * Set a private-app API key (or OAuth access token) as the Bearer credential.
     * @param {string} token
     */
    setApiToken(token) {
        this.access_token = token || null;
    }

    /**
     * Exchange an authorization code for tokens.
     * Attentive expects application/x-www-form-urlencoded with client_id +
     * client_secret in the body (not HTTP Basic).
     * @see https://docs.attentive.com/reference/createtokenviaauthorizationcode
     */
    async getTokenFromCode(code) {
        // OAuth2Requester.getTokenFromCode posts grant_type/code/redirect_uri
        // plus client_id/client_secret as form fields — matches Attentive.
        return super.getTokenFromCode(code);
    }

    addJsonHeaders(options = {}) {
        options.headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
        };
        return options;
    }

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params || {})) {
            if (value === undefined || value === null) continue;
            usp.append(key, String(value));
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Test authentication / company identity.
     * GET /me
     * @see https://docs.attentive.com/reference/getme
     */
    async getMe() {
        return this._get({ url: this.baseUrl + this.URLs.me });
    }

    /** @deprecated Prefer getMe — alias kept for legacy call sites. */
    async getTokenIdentity() {
        return this.getMe();
    }

    // ---- Subscribers -------------------------------------------------------

    /**
     * Get subscription eligibility for a user (by phone or email).
     * GET /subscriptions
     * @see https://docs.attentive.com/reference/getsubscriptions
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
     * Opt-in a user to a subscription.
     * POST /subscriptions
     * @see https://docs.attentive.com/reference/addsubscriptions
     */
    async addSubscriptions(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.subscriptions,
                body,
            })
        );
    }

    /**
     * Unsubscribe a user from subscription type(s) / channel(s).
     * POST /subscriptions/unsubscribe
     * @see https://docs.attentive.com/reference/unsubscribesubscriptions
     */
    async unsubscribeSubscriptions(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.unsubscribe,
                body,
            })
        );
    }

    // ---- Custom Attributes -------------------------------------------------

    /**
     * Get custom attributes for a user (query by phone or email).
     * GET /attributes/custom
     * @see https://docs.attentive.com/reference/getcustomattributes
     */
    async getCustomAttributes(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.customAttributes +
                this._buildQuery(params),
        });
    }

    /**
     * Create or update custom attributes for a user.
     * POST /attributes/custom
     * @see https://docs.attentive.com/reference/postcustomattributes
     */
    async postCustomAttributes(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.customAttributes,
                body,
            })
        );
    }

    // ---- Custom Events -----------------------------------------------------

    /**
     * Send a custom event for a user.
     * POST /events/custom
     * @see https://docs.attentive.com/reference/postcustomevents
     */
    async postCustomEvents(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.customEvents,
                body,
            })
        );
    }

    // ---- Product Catalog ---------------------------------------------------

    /**
     * List recent product catalog uploads.
     * GET /product-catalog/uploads
     * @see https://docs.attentive.com/reference/getuploads
     */
    async getUploads(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.catalogUploads +
                this._buildQuery(params),
        });
    }

    /**
     * Start a product catalog upload (returns uploadId + pre-signed uploadUrl).
     * POST /product-catalog/uploads
     * @see https://docs.attentive.com/reference/postupload
     */
    async postUpload(body = {}) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.catalogUploads,
                body,
            })
        );
    }

    /**
     * Lookup a product catalog upload by id.
     * GET /product-catalog/uploads/{uploadId}
     * @see https://docs.attentive.com/reference/lookupupload
     */
    async lookupUpload(uploadId) {
        return this._get({
            url: this.baseUrl + this.URLs.catalogUploadById(uploadId),
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * List webhooks.
     * GET /webhooks
     * @see https://docs.attentive.com/reference/getwebhooks
     */
    async getWebhooks() {
        return this._get({ url: this.baseUrl + this.URLs.webhooks });
    }

    /**
     * Create a subscription webhook.
     * POST /webhooks
     * @see https://docs.attentive.com/reference/createwebhook
     */
    async createWebhook(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.webhooks,
                body,
            })
        );
    }

    /**
     * Update a webhook.
     * PUT /webhooks/{webhookId}
     * @see https://docs.attentive.com/reference/updatewebhook
     */
    async updateWebhook(webhookId, body) {
        return this._put(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.webhookById(webhookId),
                body,
            })
        );
    }

    /**
     * Delete (disable) a webhook.
     * DELETE /webhooks/{webhookId}
     * @see https://docs.attentive.com/reference/deletewebhook
     */
    async deleteWebhook(webhookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        });
    }

    // ---- Webhook signature helper ------------------------------------------

    /**
     * Verify an Attentive webhook HMAC-SHA256 signature.
     *
     * Header: `x-attentive-hmac-sha256` = hex digest of raw body with the
     * webhook signing key.
     * @see https://docs.attentive.com/docs/webhook-authentication
     *
     * @param {Object} args
     * @param {Object} [args.headers]
     * @param {Buffer|string} [args.rawBody] preferred (bytes Attentive signed)
     * @param {Object|string} [args.body] fallback if rawBody unavailable
     * @param {string} [args.secret]
     * @returns {{ valid: boolean, reason?: string }}
     */
    verifyWebhookSignature({ headers = {}, rawBody, body, secret } = {}) {
        const signingSecret = secret || this.webhookSecret;
        if (!signingSecret) {
            return { valid: false, reason: 'missing webhook secret' };
        }

        let provided;
        for (const [key, value] of Object.entries(headers || {})) {
            if (key.toLowerCase() === SIGNATURE_HEADER) {
                provided = Array.isArray(value) ? value[0] : value;
                break;
            }
        }
        if (!provided) {
            return { valid: false, reason: 'missing signature header' };
        }

        let payload;
        if (rawBody !== undefined && rawBody !== null) {
            payload = Buffer.isBuffer(rawBody)
                ? rawBody
                : Buffer.from(String(rawBody), 'utf8');
        } else if (typeof body === 'string') {
            payload = Buffer.from(body, 'utf8');
        } else if (body !== undefined && body !== null) {
            payload = Buffer.from(JSON.stringify(body), 'utf8');
        } else {
            return { valid: false, reason: 'missing body' };
        }

        const digest = crypto
            .createHmac('sha256', String(signingSecret))
            .update(payload)
            .digest('hex');

        const a = Buffer.from(String(provided), 'utf8');
        const b = Buffer.from(digest, 'utf8');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            return { valid: false, reason: 'signature mismatch' };
        }
        return { valid: true };
    }
}

module.exports = {
    Api,
    BASE_URL,
    AUTHORIZE_URL,
    TOKEN_URI,
    SIGNATURE_HEADER,
};
