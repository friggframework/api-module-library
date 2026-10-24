const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

const PRODUCTION_BASE_URL = 'https://platform.ringcentral.com';
const SANDBOX_BASE_URL = 'https://platform.devtest.ringcentral.com';
const AUTHORIZE_PATH = '/restapi/oauth/authorize';
const TOKEN_PATH = '/restapi/oauth/token';
const VERIFICATION_TOKEN_HEADER = 'Verification-Token';
const VALIDATION_TOKEN_HEADER = 'Validation-Token';

// ---- webhook verification helpers ----------------------------------------
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

function whSafeEqual(a, b) {
    const x = Buffer.from(String(a), 'utf8');
    const y = Buffer.from(String(b), 'utf8');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * RingCentral RingEX REST API client.
 *
 * Auth: OAuth 2.0 authorization-code. Token endpoint requires HTTP Basic
 * (client_id:client_secret). Access tokens expire (~1h); refresh tokens are
 * long-lived — persist both. The OAuth `scope` query parameter is ignored by
 * RingCentral; app permissions are configured in the Developer Console.
 *
 * Base URL (production): https://platform.ringcentral.com
 * Sandbox: https://platform.devtest.ringcentral.com
 * Paths: /restapi/v1.0/...
 *
 * Docs: https://developers.ringcentral.com/api-reference
 * OAuth: https://developers.ringcentral.com/guide/authentication/auth-code-flow
 * OpenAPI source: https://github.com/ringcentral/ringcentral-api-specifications
 *
 * The curated OpenAPI in ./ringcentral.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Prefer official operationIds from the vendor
 * OpenAPI where we implement that exact endpoint.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        const envName = (
            get(params, 'environment', null) ||
            process.env.RINGCENTRAL_ENVIRONMENT ||
            'production'
        )
            .toString()
            .toLowerCase();
        this.environment = envName === 'sandbox' ? 'sandbox' : 'production';

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            process.env.RINGCENTRAL_BASE_URL ||
            (this.environment === 'sandbox'
                ? SANDBOX_BASE_URL
                : PRODUCTION_BASE_URL);

        // Strip trailing slash so path joins stay clean.
        this.baseUrl = String(this.baseUrl).replace(/\/$/, '');

        this.tokenUri = `${this.baseUrl}${TOKEN_PATH}`;
        this.authorizationUri = this._buildAuthorizationUri();

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.webhookVerificationToken =
            get(params, 'webhookVerificationToken', null) ||
            process.env.RINGCENTRAL_WEBHOOK_VERIFICATION_TOKEN ||
            null;

        this.URLs = {
            account: (accountId = '~') => `/restapi/v1.0/account/${accountId}`,
            extensions: (accountId = '~') =>
                `/restapi/v1.0/account/${accountId}/extension`,
            extension: (accountId = '~', extensionId = '~') =>
                `/restapi/v1.0/account/${accountId}/extension/${extensionId}`,
            phoneNumbers: (accountId = '~') =>
                `/restapi/v1.0/account/${accountId}/phone-number`,
            messages: (accountId = '~', extensionId = '~') =>
                `/restapi/v1.0/account/${accountId}/extension/${extensionId}/message-store`,
            message: (accountId = '~', extensionId = '~', messageId) =>
                `/restapi/v1.0/account/${accountId}/extension/${extensionId}/message-store/${messageId}`,
            sms: (accountId = '~', extensionId = '~') =>
                `/restapi/v1.0/account/${accountId}/extension/${extensionId}/sms`,
            callLog: (accountId = '~', extensionId = '~') =>
                `/restapi/v1.0/account/${accountId}/extension/${extensionId}/call-log`,
            callRecord: (accountId = '~', extensionId = '~', callRecordId) =>
                `/restapi/v1.0/account/${accountId}/extension/${extensionId}/call-log/${callRecordId}`,
            contacts: (accountId = '~', extensionId = '~') =>
                `/restapi/v1.0/account/${accountId}/extension/${extensionId}/address-book/contact`,
            contact: (accountId = '~', extensionId = '~', contactId) =>
                `/restapi/v1.0/account/${accountId}/extension/${extensionId}/address-book/contact/${contactId}`,
            subscriptions: '/restapi/v1.0/subscription',
            subscription: (subscriptionId) =>
                `/restapi/v1.0/subscription/${subscriptionId}`,
            renewSubscription: (subscriptionId) =>
                `/restapi/v1.0/subscription/${subscriptionId}/renew`,
        };
    }

    _buildAuthorizationUri() {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
        });
        if (this.state) params.set('state', this.state);
        // RingCentral ignores `scope` (permissions live on the app), but Frigg
        // still may pass RINGCENTRAL_SCOPE for documentation / future use.
        if (this.scope) params.set('scope', this.scope);
        return `${this.baseUrl}${AUTHORIZE_PATH}?${params.toString()}`;
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
     * Token exchange requires HTTP Basic with client_id:client_secret.
     * @see https://developers.ringcentral.com/guide/authentication/auth-code-flow
     */
    async getTokenFromCode(code) {
        return this.getTokenFromCodeBasicAuthHeader(code);
    }

    /**
     * Refresh also uses Basic auth.
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

    apiUrl(path) {
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

    async _put(options) {
        this.addJsonHeaders(options);
        return super._put(options);
    }

    async _delete(options) {
        options.headers = {
            Accept: 'application/json',
            ...options.headers,
        };
        return super._delete(options);
    }

    // ---- Account / identity ------------------------------------------------

    /**
     * GET /restapi/v1.0/account/{accountId}
     * Official operationId: readAccountInfo
     * Use accountId `~` for the authorized account.
     */
    async readAccountInfo(accountId = '~') {
        return this._get({
            url: this.apiUrl(this.URLs.account(accountId)),
        });
    }

    /**
     * GET /restapi/v1.0/account/{accountId}/extension/{extensionId}
     * Official operationId: readExtension
     * Use `~` / `~` for the authorized extension (identity / testAuth).
     */
    async readExtension(accountId = '~', extensionId = '~') {
        return this._get({
            url: this.apiUrl(this.URLs.extension(accountId, extensionId)),
        });
    }

    /**
     * PUT /restapi/v1.0/account/{accountId}/extension/{extensionId}
     * Official operationId: updateExtension
     */
    async updateExtension(accountId = '~', extensionId = '~', body = {}) {
        return this._put({
            url: this.apiUrl(this.URLs.extension(accountId, extensionId)),
            body,
        });
    }

    /**
     * GET /restapi/v1.0/account/{accountId}/extension
     * Official operationId: listExtensions
     */
    async listExtensions(accountId = '~', query = {}) {
        return this._get({
            url: this.apiUrl(this.URLs.extensions(accountId)),
            query,
        });
    }

    /**
     * GET /restapi/v1.0/account/{accountId}/phone-number
     * Official operationId: listAccountPhoneNumbers
     */
    async listAccountPhoneNumbers(accountId = '~', query = {}) {
        return this._get({
            url: this.apiUrl(this.URLs.phoneNumbers(accountId)),
            query,
        });
    }

    // ---- Message store / SMS -----------------------------------------------

    /**
     * GET /restapi/v1.0/account/{accountId}/extension/{extensionId}/message-store
     * Official operationId: listMessages
     */
    async listMessages(accountId = '~', extensionId = '~', query = {}) {
        return this._get({
            url: this.apiUrl(this.URLs.messages(accountId, extensionId)),
            query,
        });
    }

    /**
     * GET /restapi/v1.0/account/{accountId}/extension/{extensionId}/message-store/{messageId}
     * Official operationId: readMessage
     */
    async readMessage(accountId = '~', extensionId = '~', messageId) {
        if (messageId === undefined || messageId === null || messageId === '') {
            throw new Error('readMessage requires messageId');
        }
        return this._get({
            url: this.apiUrl(
                this.URLs.message(accountId, extensionId, messageId)
            ),
        });
    }

    /**
     * PUT /restapi/v1.0/account/{accountId}/extension/{extensionId}/message-store/{messageId}
     * Official operationId: updateMessage
     */
    async updateMessage(accountId = '~', extensionId = '~', messageId, body) {
        if (messageId === undefined || messageId === null || messageId === '') {
            throw new Error('updateMessage requires messageId');
        }
        return this._put({
            url: this.apiUrl(
                this.URLs.message(accountId, extensionId, messageId)
            ),
            body: body || {},
        });
    }

    /**
     * POST /restapi/v1.0/account/{accountId}/extension/{extensionId}/sms
     * Official operationId: createSMSMessage
     * Body: { from: { phoneNumber }, to: [{ phoneNumber }], text }
     */
    async createSMSMessage(accountId = '~', extensionId = '~', body) {
        if (!body || typeof body !== 'object') {
            throw new Error('createSMSMessage requires a request body');
        }
        return this._post({
            url: this.apiUrl(this.URLs.sms(accountId, extensionId)),
            body,
        });
    }

    // ---- Call log ----------------------------------------------------------

    /**
     * GET /restapi/v1.0/account/{accountId}/extension/{extensionId}/call-log
     * Official operationId: readUserCallLog
     */
    async readUserCallLog(accountId = '~', extensionId = '~', query = {}) {
        return this._get({
            url: this.apiUrl(this.URLs.callLog(accountId, extensionId)),
            query,
        });
    }

    /**
     * GET /restapi/v1.0/account/{accountId}/extension/{extensionId}/call-log/{callRecordId}
     * Official operationId: readUserCallRecord
     */
    async readUserCallRecord(
        accountId = '~',
        extensionId = '~',
        callRecordId,
        query = {}
    ) {
        if (
            callRecordId === undefined ||
            callRecordId === null ||
            callRecordId === ''
        ) {
            throw new Error('readUserCallRecord requires callRecordId');
        }
        return this._get({
            url: this.apiUrl(
                this.URLs.callRecord(accountId, extensionId, callRecordId)
            ),
            query,
        });
    }

    // ---- Address book contacts ---------------------------------------------

    /**
     * GET .../address-book/contact
     * Official operationId: listContacts
     */
    async listContacts(accountId = '~', extensionId = '~', query = {}) {
        return this._get({
            url: this.apiUrl(this.URLs.contacts(accountId, extensionId)),
            query,
        });
    }

    /**
     * GET .../address-book/contact/{contactId}
     * Official operationId: readContact
     */
    async readContact(accountId = '~', extensionId = '~', contactId) {
        if (contactId === undefined || contactId === null || contactId === '') {
            throw new Error('readContact requires contactId');
        }
        return this._get({
            url: this.apiUrl(
                this.URLs.contact(accountId, extensionId, contactId)
            ),
        });
    }

    /**
     * POST .../address-book/contact
     * Official operationId: createContact
     */
    async createContact(accountId = '~', extensionId = '~', body) {
        if (!body || typeof body !== 'object') {
            throw new Error('createContact requires a contact body');
        }
        return this._post({
            url: this.apiUrl(this.URLs.contacts(accountId, extensionId)),
            body,
        });
    }

    /**
     * PUT .../address-book/contact/{contactId}
     * Official operationId: updateContact
     */
    async updateContact(accountId = '~', extensionId = '~', contactId, body) {
        if (contactId === undefined || contactId === null || contactId === '') {
            throw new Error('updateContact requires contactId');
        }
        return this._put({
            url: this.apiUrl(
                this.URLs.contact(accountId, extensionId, contactId)
            ),
            body: body || {},
        });
    }

    // ---- Subscriptions (webhooks) ------------------------------------------

    /**
     * GET /restapi/v1.0/subscription
     * Official operationId: listSubscriptions
     */
    async listSubscriptions(query = {}) {
        return this._get({
            url: this.apiUrl(this.URLs.subscriptions),
            query,
        });
    }

    /**
     * POST /restapi/v1.0/subscription
     * Official operationId: createSubscription
     * Body: { eventFilters, deliveryMode: { transportType: 'WebHook', address, verificationToken? }, expiresIn? }
     */
    async createSubscription(body) {
        if (!body || typeof body !== 'object') {
            throw new Error('createSubscription requires a request body');
        }
        return this._post({
            url: this.apiUrl(this.URLs.subscriptions),
            body,
        });
    }

    /**
     * GET /restapi/v1.0/subscription/{subscriptionId}
     * Official operationId: readSubscription
     */
    async readSubscription(subscriptionId) {
        if (!subscriptionId) {
            throw new Error('readSubscription requires subscriptionId');
        }
        return this._get({
            url: this.apiUrl(this.URLs.subscription(subscriptionId)),
        });
    }

    /**
     * PUT /restapi/v1.0/subscription/{subscriptionId}
     * Official operationId: updateSubscription
     */
    async updateSubscription(subscriptionId, body = {}) {
        if (!subscriptionId) {
            throw new Error('updateSubscription requires subscriptionId');
        }
        return this._put({
            url: this.apiUrl(this.URLs.subscription(subscriptionId)),
            body,
        });
    }

    /**
     * DELETE /restapi/v1.0/subscription/{subscriptionId}
     * Official operationId: deleteSubscription
     */
    async deleteSubscription(subscriptionId) {
        if (!subscriptionId) {
            throw new Error('deleteSubscription requires subscriptionId');
        }
        return this._delete({
            url: this.apiUrl(this.URLs.subscription(subscriptionId)),
        });
    }

    /**
     * POST /restapi/v1.0/subscription/{subscriptionId}/renew
     * Official operationId: renewSubscription
     */
    async renewSubscription(subscriptionId) {
        if (!subscriptionId) {
            throw new Error('renewSubscription requires subscriptionId');
        }
        return this._post({
            url: this.apiUrl(this.URLs.renewSubscription(subscriptionId)),
            body: {},
        });
    }

    // ---- Webhook authenticity ----------------------------------------------

    /**
     * Verify an inbound RingCentral webhook delivery.
     *
     * RingCentral does not HMAC-sign webhook bodies. Authenticity is optional
     * and based on `deliveryMode.verificationToken` set at subscription create
     * time: RingCentral echoes it on every delivery as the `Verification-Token`
     * header. Compare that header to the token you stored.
     *
     * @see https://developers.ringcentral.com/guide/notifications/webhooks/receiving
     * Never throws; returns true only when the header matches the configured token.
     */
    async verifyWebhookSignature({ headers } = {}) {
        try {
            const expected =
                this.webhookVerificationToken ||
                process.env.RINGCENTRAL_WEBHOOK_VERIFICATION_TOKEN;
            if (!expected) return false;
            const provided = whHeader(headers, VERIFICATION_TOKEN_HEADER);
            if (!provided) return false;
            return whSafeEqual(expected, provided);
        } catch (_e) {
            return false;
        }
    }
}

module.exports = {
    Api,
    PRODUCTION_BASE_URL,
    SANDBOX_BASE_URL,
    VERIFICATION_TOKEN_HEADER,
    VALIDATION_TOKEN_HEADER,
};
