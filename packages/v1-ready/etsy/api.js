const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Etsy Open API v3 client.
 *
 * Auth (official):
 *   - Every request: `x-api-key: <keystring>:<shared_secret>`
 *   - Scoped endpoints: `Authorization: Bearer <access_token>`
 *   - OAuth 2.0 Authorization Code + PKCE (S256)
 *     Authorize: https://www.etsy.com/oauth/connect
 *     Token:     https://api.etsy.com/v3/public/oauth/token
 *
 * Base URL: https://api.etsy.com/v3/application
 *
 * Docs:
 *   https://developers.etsy.com/documentation/essentials/authentication
 *   https://developers.etsy.com/documentation/reference/
 *   Official OAS: https://www.etsy.com/openapi/generated/oas/3.0.0.json
 *
 * Curated contract: ./etsy.openapi.yaml (operationIds == Api method names).
 *
 * Ported from a cleared pre-v2 Etsy module (Api surface only);
 * Manager / Mongoose models / client coupling removed.
 */
const DEFAULT_BASE_URL = 'https://api.etsy.com/v3/application';
const DEFAULT_AUTHORIZE_URL = 'https://www.etsy.com/oauth/connect';
const DEFAULT_TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
const DEFAULT_SCOPE =
    'shops_r listings_r listings_w transactions_r transactions_w';

// URL-unreserved delimiter so caller state and encrypted verifier can share
// the OAuth `state` parameter (same pattern as the Salesforce module).
const STATE_VERIFIER_DELIMITER = '~';

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = get(params, 'base_url', null) || DEFAULT_BASE_URL;
        this.tokenUri =
            get(params, 'tokenUri', null) ||
            get(params, 'token_uri', null) ||
            DEFAULT_TOKEN_URL;
        this.authorizationUriBase =
            get(params, 'authorizationUri', null) || DEFAULT_AUTHORIZE_URL;

        this.client_id =
            get(params, 'client_id', null) ||
            get(params, 'keystring', null) ||
            process.env.ETSY_KEYSTRING ||
            this.client_id;
        this.client_secret =
            get(params, 'client_secret', null) ||
            get(params, 'shared_secret', null) ||
            process.env.ETSY_SHARED_SECRET ||
            this.client_secret;
        this.redirect_uri =
            get(params, 'redirect_uri', null) ||
            process.env.ETSY_REDIRECT_URI ||
            this.redirect_uri;
        this.scope =
            get(params, 'scope', null) ||
            process.env.ETSY_SCOPE ||
            DEFAULT_SCOPE;

        this.access_token = get(params, 'access_token', null) || this.access_token;
        this.refresh_token =
            get(params, 'refresh_token', null) || this.refresh_token;

        this.shop_id =
            get(params, 'shop_id', null) || get(params, 'shopId', null) || null;
        this.etsy_user_id =
            get(params, 'etsy_user_id', null) ||
            get(params, 'user_id', null) ||
            null;

        // Placeholder; real URL is built per-request with a fresh PKCE pair.
        this.authorizationUri = this.authorizationUriBase;

        this.URLs = {
            ping: '/openapi-ping',
            me: '/users/me',
            userById: (userId) => `/users/${userId}`,
            shopsByOwner: (userId) => `/users/${userId}/shops`,
            shops: '/shops',
            shopById: (shopId) => `/shops/${shopId}`,
            listingsByShop: (shopId) => `/shops/${shopId}/listings`,
            activeListingsByShop: (shopId) =>
                `/shops/${shopId}/listings/active`,
            listingById: (listingId) => `/listings/${listingId}`,
            shopListingById: (shopId, listingId) =>
                `/shops/${shopId}/listings/${listingId}`,
            receiptsByShop: (shopId) => `/shops/${shopId}/receipts`,
            receiptById: (shopId, receiptId) =>
                `/shops/${shopId}/receipts/${receiptId}`,
            receiptTracking: (shopId, receiptId) =>
                `/shops/${shopId}/receipts/${receiptId}/tracking`,
            receiptPayments: (shopId, receiptId) =>
                `/shops/${shopId}/receipts/${receiptId}/payments`,
            receiptTransactions: (shopId, receiptId) =>
                `/shops/${shopId}/receipts/${receiptId}/transactions`,
            transactionsByShop: (shopId) => `/shops/${shopId}/transactions`,
            transactionById: (shopId, transactionId) =>
                `/shops/${shopId}/transactions/${transactionId}`,
            paymentsByShop: (shopId) => `/shops/${shopId}/payments`,
        };
    }

    setShopId(shopId) {
        this.shop_id = shopId;
    }

    // ---- Auth headers ------------------------------------------------------

    /**
     * Official auth: x-api-key is always `keystring:shared_secret`; Bearer when
     * an OAuth access token is present.
     * @see https://developers.etsy.com/documentation/essentials/authentication
     */
    async addAuthHeaders(headers = {}) {
        const next = { ...(headers || {}) };
        if (this.client_id) {
            next['x-api-key'] = this.client_secret
                ? `${this.client_id}:${this.client_secret}`
                : String(this.client_id);
        }
        if (this.access_token) {
            next.Authorization = `Bearer ${this.access_token}`;
        }
        return next;
    }

    isAuthenticated() {
        return Boolean(
            this.access_token && String(this.access_token).length > 0
        );
    }

    // ---- PKCE / OAuth ------------------------------------------------------

    /**
     * Generate a PKCE code_verifier (43–128 chars, unreserved) and S256
     * code_challenge per RFC 7636 / Etsy docs.
     */
    static createPkcePair() {
        const verifier = crypto.randomBytes(32).toString('base64url');
        const challenge = crypto
            .createHash('sha256')
            .update(verifier)
            .digest('base64url');
        return { verifier, challenge };
    }

    _encryptVerifier(verifier) {
        if (!this.client_secret) {
            throw new Error(
                'Etsy PKCE: client_secret (ETSY_SHARED_SECRET) is required to seal the code_verifier into state'
            );
        }
        const key = crypto
            .createHash('sha256')
            .update(String(this.client_secret))
            .digest();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([
            cipher.update(verifier, 'utf8'),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${tag.toString('base64url')}`;
    }

    _decryptVerifier(encryptedState) {
        const [ivB64, encB64, tagB64] = String(encryptedState).split('.');
        if (!ivB64 || !encB64 || !tagB64) {
            throw new Error('Etsy PKCE: malformed encrypted verifier in state');
        }
        const key = crypto
            .createHash('sha256')
            .update(String(this.client_secret))
            .digest();
        const iv = Buffer.from(ivB64, 'base64url');
        const encryptedBuf = Buffer.from(encB64, 'base64url');
        const tag = Buffer.from(tagB64, 'base64url');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([
            decipher.update(encryptedBuf),
            decipher.final(),
        ]).toString('utf8');
    }

    /**
     * Embed (or restore) the PKCE verifier in the OAuth `state` parameter so
     * the host does not need a separate State store.
     */
    buildStateWithVerifier(callerState, verifier) {
        const encoded = this._encryptVerifier(verifier);
        if (
            callerState === undefined ||
            callerState === null ||
            callerState === ''
        ) {
            return encoded;
        }
        return `${callerState}${STATE_VERIFIER_DELIMITER}${encoded}`;
    }

    restoreVerifierFromState(state) {
        if (state === undefined || state === null || state === '') {
            throw new Error('Etsy PKCE: missing state (code_verifier sealed in state)');
        }
        const raw = String(state);
        const at = raw.lastIndexOf(STATE_VERIFIER_DELIMITER);
        const encrypted = at === -1 ? raw : raw.slice(at + 1);
        return this._decryptVerifier(encrypted);
    }

    /**
     * Build the authorize URL with a fresh PKCE challenge. When `state` is
     * omitted, a sealed verifier-only state is used so getToken can recover it.
     */
    getAuthorizationUri(params = {}) {
        const { verifier, challenge } = Api.createPkcePair();
        this._pendingCodeVerifier = verifier;

        const callerState =
            params.state !== undefined
                ? params.state
                : this.state !== undefined
                  ? this.state
                  : null;
        const state = this.buildStateWithVerifier(callerState, verifier);

        const usp = new URLSearchParams();
        usp.set('response_type', 'code');
        usp.set('client_id', this.client_id || '');
        usp.set('redirect_uri', this.redirect_uri || '');
        usp.set('scope', this.scope || '');
        usp.set('state', state);
        usp.set('code_challenge', challenge);
        usp.set('code_challenge_method', 'S256');

        const url = `${this.authorizationUriBase}?${usp.toString()}`;
        this.authorizationUri = url;
        return url;
    }

    /** Alias used by older Frigg OAuth modules / source port. */
    getAuthUri(state, codeChallenge) {
        if (codeChallenge) {
            const usp = new URLSearchParams();
            usp.set('response_type', 'code');
            usp.set('client_id', this.client_id || '');
            usp.set('redirect_uri', this.redirect_uri || '');
            usp.set('scope', this.scope || '');
            if (state !== undefined && state !== null) {
                usp.set(
                    'state',
                    typeof state === 'string' ? state : JSON.stringify(state)
                );
            }
            usp.set('code_challenge', codeChallenge);
            usp.set('code_challenge_method', 'S256');
            return `${this.authorizationUriBase}?${usp.toString()}`;
        }
        return this.getAuthorizationUri({ state });
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
        };
    }

    /**
     * Exchange authorization code + PKCE verifier for tokens.
     * Body: grant_type, client_id, redirect_uri, code, code_verifier
     * (client_secret is NOT part of the official token request).
     */
    async getTokenFromCodeWithPKCE(code, codeVerifier) {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', this.client_id);
        if (this.redirect_uri) {
            params.append('redirect_uri', this.redirect_uri);
        }
        params.append('code', code);
        params.append('code_verifier', codeVerifier);

        const response = await this._post(
            {
                url: this.tokenUri,
                body: params,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            },
            false
        );
        await this.setTokens(response);
        this._captureUserIdFromToken(response);
        return response;
    }

    async getTokenFromCode(code, codeVerifier) {
        const verifier =
            codeVerifier ||
            this._pendingCodeVerifier ||
            this.code_verifier ||
            null;
        if (!verifier) {
            throw new Error(
                'Etsy OAuth: code_verifier required (pass explicitly or restore from state via Definition.getToken)'
            );
        }
        return this.getTokenFromCodeWithPKCE(code, verifier);
    }

    /**
     * Refresh grant — official body: grant_type, client_id, refresh_token.
     */
    async refreshAccessToken(refreshTokenObject) {
        const refreshToken =
            (refreshTokenObject && refreshTokenObject.refresh_token) ||
            this.refresh_token;
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('client_id', this.client_id);
        params.append('refresh_token', refreshToken);

        const response = await this._post(
            {
                url: this.tokenUri,
                body: params,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            },
            false
        );
        await this.setTokens(response);
        this._captureUserIdFromToken(response);
        return response;
    }

    _captureUserIdFromToken(tokenResponse) {
        const access =
            (tokenResponse && tokenResponse.access_token) || this.access_token;
        if (!access || typeof access !== 'string') return;
        const prefix = access.split('.')[0];
        if (prefix && /^\d+$/.test(prefix)) {
            this.etsy_user_id = prefix;
        }
    }

    // ---- HTTP helpers ------------------------------------------------------

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params || {})) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const v of value) {
                    if (v === undefined || v === null) continue;
                    usp.append(key, String(v));
                }
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    _url(path, query) {
        return this.baseUrl + path + this._buildQuery(query);
    }

    _formBody(data = {}) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(data || {})) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const v of value) {
                    if (v === undefined || v === null) continue;
                    params.append(key, String(v));
                }
            } else {
                params.append(key, String(value));
            }
        }
        return params;
    }

    // ---- Identity / health -------------------------------------------------

    /** GET /openapi-ping — official operationId: ping */
    async ping(params = {}) {
        return this._get({ url: this._url(this.URLs.ping, params) });
    }

    /** GET /users/me — official operationId: getMe (scope shops_r) */
    async getMe(params = {}) {
        return this._get({ url: this._url(this.URLs.me, params) });
    }

    /** GET /users/{user_id} — official operationId: getUser (scope email_r) */
    async getUser(userId, params = {}) {
        return this._get({
            url: this._url(this.URLs.userById(userId), params),
        });
    }

    /**
     * GET /users/{user_id}/shops — official operationId: getShopByOwnerUserId
     */
    async getShopByOwnerUserId(userId, params = {}) {
        return this._get({
            url: this._url(this.URLs.shopsByOwner(userId), params),
        });
    }

    // ---- Shops -------------------------------------------------------------

    /** GET /shops — official operationId: findShops */
    async findShops(params = {}) {
        return this._get({ url: this._url(this.URLs.shops, params) });
    }

    /** GET /shops/{shop_id} — official operationId: getShop */
    async getShop(shopId = this.shop_id, params = {}) {
        return this._get({
            url: this._url(this.URLs.shopById(shopId), params),
        });
    }

    /** PUT /shops/{shop_id} — official operationId: updateShop (shops_r + shops_w) */
    async updateShop(shopId, body = {}) {
        return this._put({
            url: this.baseUrl + this.URLs.shopById(shopId),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: this._formBody(body),
        });
    }

    // ---- Listings ----------------------------------------------------------

    /**
     * GET /shops/{shop_id}/listings — official operationId: getListingsByShop
     * (listings_r)
     */
    async getListingsByShop(shopId = this.shop_id, params = {}) {
        return this._get({
            url: this._url(this.URLs.listingsByShop(shopId), params),
        });
    }

    /**
     * GET /shops/{shop_id}/listings/active —
     * official operationId: findAllActiveListingsByShop
     */
    async findAllActiveListingsByShop(shopId = this.shop_id, params = {}) {
        return this._get({
            url: this._url(this.URLs.activeListingsByShop(shopId), params),
        });
    }

    /** GET /listings/{listing_id} — official operationId: getListing */
    async getListing(listingId, params = {}) {
        return this._get({
            url: this._url(this.URLs.listingById(listingId), params),
        });
    }

    /**
     * POST /shops/{shop_id}/listings — official operationId: createDraftListing
     * (listings_w). Body is application/x-www-form-urlencoded.
     */
    async createDraftListing(shopId, body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.listingsByShop(shopId),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: this._formBody(body),
        });
    }

    /**
     * PATCH /shops/{shop_id}/listings/{listing_id} —
     * official operationId: updateListing (listings_w)
     */
    async updateListing(shopId, listingId, body = {}) {
        return this._patch({
            url: this.baseUrl + this.URLs.shopListingById(shopId, listingId),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: this._formBody(body),
        });
    }

    /** DELETE /listings/{listing_id} — official operationId: deleteListing */
    async deleteListing(listingId, params = {}) {
        return this._delete({
            url: this._url(this.URLs.listingById(listingId), params),
        });
    }

    // ---- Receipts / transactions / payments --------------------------------

    /**
     * GET /shops/{shop_id}/receipts — official operationId: getShopReceipts
     * (transactions_r)
     */
    async getShopReceipts(shopId = this.shop_id, params = {}) {
        return this._get({
            url: this._url(this.URLs.receiptsByShop(shopId), params),
        });
    }

    /**
     * GET /shops/{shop_id}/receipts/{receipt_id} —
     * official operationId: getShopReceipt
     */
    async getShopReceipt(shopId, receiptId, params = {}) {
        return this._get({
            url: this._url(this.URLs.receiptById(shopId, receiptId), params),
        });
    }

    /**
     * PUT /shops/{shop_id}/receipts/{receipt_id} —
     * official operationId: updateShopReceipt (transactions_w)
     */
    async updateShopReceipt(shopId, receiptId, body = {}, params = {}) {
        return this._put({
            url: this._url(this.URLs.receiptById(shopId, receiptId), params),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: this._formBody(body),
        });
    }

    /**
     * POST /shops/{shop_id}/receipts/{receipt_id}/tracking —
     * official operationId: createReceiptShipment (transactions_w)
     */
    async createReceiptShipment(shopId, receiptId, body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.receiptTracking(shopId, receiptId),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: this._formBody(body),
        });
    }

    /**
     * GET /shops/{shop_id}/transactions —
     * official operationId: getShopReceiptTransactionsByShop
     */
    async getShopReceiptTransactionsByShop(shopId = this.shop_id, params = {}) {
        return this._get({
            url: this._url(this.URLs.transactionsByShop(shopId), params),
        });
    }

    /**
     * GET /shops/{shop_id}/transactions/{transaction_id} —
     * official operationId: getShopReceiptTransaction
     */
    async getShopReceiptTransaction(shopId, transactionId, params = {}) {
        return this._get({
            url: this._url(
                this.URLs.transactionById(shopId, transactionId),
                params
            ),
        });
    }

    /**
     * GET /shops/{shop_id}/receipts/{receipt_id}/transactions —
     * official operationId: getShopReceiptTransactionsByReceipt
     */
    async getShopReceiptTransactionsByReceipt(
        shopId,
        receiptId,
        params = {}
    ) {
        return this._get({
            url: this._url(
                this.URLs.receiptTransactions(shopId, receiptId),
                params
            ),
        });
    }

    /**
     * GET /shops/{shop_id}/receipts/{receipt_id}/payments —
     * official operationId: getShopPaymentByReceiptId
     */
    async getShopPaymentByReceiptId(shopId, receiptId, params = {}) {
        return this._get({
            url: this._url(this.URLs.receiptPayments(shopId, receiptId), params),
        });
    }

    /**
     * GET /shops/{shop_id}/payments — official operationId: getPayments
     * Requires `payment_ids` query (array) per OAS.
     */
    async getPayments(shopId = this.shop_id, params = {}) {
        return this._get({
            url: this._url(this.URLs.paymentsByShop(shopId), params),
        });
    }
}

module.exports = { Api, STATE_VERIFIER_DELIMITER };
