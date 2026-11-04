const { get, OAuth2Requester } = require('@friggframework/core');

/**
 * Blackbaud Raiser's Edge NXT (SKY API) client.
 *
 * Auth: OAuth 2.0 authorization code.
 *   Authorize: https://oauth2.sky.blackbaud.com/authorization
 *   Token:     https://oauth2.sky.blackbaud.com/token
 *   API:       https://api.sky.blackbaud.com
 *   Headers:   Authorization: Bearer <token>
 *              Bb-Api-Subscription-Key: <subscription key>
 *
 * Docs: https://developer.blackbaud.com/skyapi
 * Auth: https://developer.blackbaud.com/skyapi/docs/authorization
 * RE NXT: https://developer.blackbaud.com/skyapi/products/renxt
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://api.sky.blackbaud.com';
        this.authorizationUri =
            'https://oauth2.sky.blackbaud.com/authorization';
        this.tokenUri = 'https://oauth2.sky.blackbaud.com/token';

        this.subscription_key = get(params, 'subscription_key', null);
        // Blackbaud environment id from the OAuth token response; stable per
        // environment and the source of the entity externalId (md5).
        this.environment_id = get(params, 'environment_id', null);

        // Rate limiting is handled by the framework: batch/queue processing
        // paces calls per worker, and 429/5xx retries (default backOff
        // schedule) absorb the SKY API's 10 req/s limit — no client-side
        // throttle or retry logic in this module.

        this.URLs = {
            // Constituent
            // https://developer.blackbaud.com/skyapi/products/renxt/constituent
            listConstituents: '/constituent/v1/constituents',
            getConstituent: '/constituent/v1/constituents/{constituent_id}',
            duplicateSearchConstituents:
                '/constituent/v1/constituents/duplicatesearch',
            createConstituent: '/constituent/v1/constituents',
            updateConstituent: '/constituent/v1/constituents/{constituent_id}',
            listConstituentEmailAddresses:
                '/constituent/v1/constituents/{constituent_id}/emailaddresses',
            createEmailAddress: '/constituent/v1/emailaddresses',
            updateEmailAddress:
                '/constituent/v1/emailaddresses/{email_address_id}',
            listConstituentPhones:
                '/constituent/v1/constituents/{constituent_id}/phones',
            createPhone: '/constituent/v1/phones',
            updatePhone: '/constituent/v1/phones/{phone_id}',
            listConstituentAddresses:
                '/constituent/v1/constituents/{constituent_id}/addresses',
            createAddress: '/constituent/v1/addresses',
            updateAddress: '/constituent/v1/addresses/{address_id}',
            listTitles: '/constituent/v1/titles',
            listEmailAddressTypes: '/constituent/v1/emailaddresstypes',
            listPhoneTypes: '/constituent/v1/phonetypes',
            listAddressTypes: '/constituent/v1/addresstypes',

            // Gift
            // https://developer.blackbaud.com/skyapi/products/renxt/gift
            listGifts: '/gift/v1/gifts',
            getGift: '/gift/v1/gifts/{gift_id}',
            createGift: '/gift/v1/gifts',
            updateGift: '/gift/v1/gifts/{gift_id}',

            // Event
            // https://developer.blackbaud.com/skyapi/apis/event
            listEvents: '/event/v1/eventlist',
            getEvent: '/event/v1/events/{event_id}',
            createEvent: '/event/v1/events',
            updateEvent: '/event/v1/events/{event_id}',
            createParticipant: '/event/v1/events/{event_id}/participants',
            listParticipants: '/event/v1/events/{event_id}/participants',
            updateParticipant: '/event/v1/participants/{participant_id}',

            // Fundraising
            // https://developer.blackbaud.com/skyapi/products/renxt
            listFunds: '/fundraising/v1/funds',
            listAppeals: '/fundraising/v1/appeals',

            // Webhooks
            // https://developer.blackbaud.com/skyapi/docs/webhooks
            createSubscription: '/webhook/v1/subscriptions',
            getSubscription: '/webhook/v1/subscriptions/{subscription_id}',
            deleteSubscription: '/webhook/v1/subscriptions/{subscription_id}',
        };
    }

    _headers(includeContentType = false, extra = {}) {
        const headers = {
            Accept: 'application/json',
            'Bb-Api-Subscription-Key': this.subscription_key,
            ...extra,
        };
        if (includeContentType) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    }

    _url(template, params = {}) {
        let url = `${this.baseUrl}${template}`;
        for (const [key, value] of Object.entries(params)) {
            url = url.replace(`{${key}}`, encodeURIComponent(value));
        }
        return url;
    }

    getAuthorizationUri() {
        const url = new URL(this.authorizationUri);
        url.searchParams.set('client_id', this.client_id);
        url.searchParams.set('response_type', 'code');
        if (this.redirect_uri) {
            url.searchParams.set('redirect_uri', this.redirect_uri);
        }
        if (this.scope) {
            url.searchParams.set('scope', this.scope);
        }
        if (this.state) {
            url.searchParams.set('state', this.state);
        }
        return url.toString();
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
        };
    }

    // Token exchange per the documented Blackbaud auth-code request shape.
    // The framework default appends `scope`, which is not part of Blackbaud's
    // documented token request — send the documented params only.
    // https://developer.blackbaud.com/skyapi/docs/authorization/auth-code-flow/confidential-application/tutorial
    async getTokenFromCode(code) {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('redirect_uri', this.redirect_uri);
        params.append('code', code);
        const options = {
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            url: this.tokenUri,
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    // Persist the rotated pair + environment_id on every token exchange.
    // Blackbaud returns refresh_token_expires_in; the framework only reads
    // x_refresh_token_expires_in — map it so the expiry survives reload.
    async setTokens(params) {
        this.access_token = get(params, 'access_token');
        const newRefreshToken = get(params, 'refresh_token', null);
        if (newRefreshToken !== null) {
            this.refresh_token = newRefreshToken;
        }
        const accessExpiresIn = get(params, 'expires_in', null);
        if (accessExpiresIn !== null) {
            this.accessTokenExpire = new Date(
                Date.now() + accessExpiresIn * 1000
            );
        }
        const refreshExpiresIn = get(params, 'refresh_token_expires_in', null);
        if (refreshExpiresIn !== null) {
            this.refreshTokenExpire = new Date(
                Date.now() + refreshExpiresIn * 1000
            );
        }
        const environmentId = get(params, 'environment_id', null);
        if (environmentId !== null) {
            this.environment_id = environmentId;
        }
        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    // Blackbaud refresh tokens are SINGLE-USE and rotate on every grant, so a
    // token may be exchanged exactly once. Two guards, for two different races:
    //
    //   - Same tick (this instance): concurrent callers share one in-flight
    //     exchange. Without it both re-read the identical token before either
    //     has persisted a rotation, both exchange it, and the loser's 401 marks
    //     the whole integration ERROR. Every caller is covered, so callers do
    //     not have to serialize their own requests.
    //   - Sibling worker (another process): re-read the persisted credential
    //     before exchanging, and on invalid_grant re-read once more in case it
    //     rotated the token meanwhile, before surfacing the failure.
    //
    // Credentials also go in the body and only the documented params are sent —
    // the framework default appends redirect_uri, which is undocumented on
    // Blackbaud's refresh endpoint and a known invalid_grant cause.
    async refreshAccessToken(refreshTokenObject) {
        // Cleared in a finally so a failed exchange cannot wedge later refreshes
        // on a permanently rejected promise.
        if (!this._refreshInFlight) {
            this._refreshInFlight = this._exchangeRefreshToken(
                refreshTokenObject
            ).finally(() => {
                this._refreshInFlight = null;
            });
        }
        return this._refreshInFlight;
    }

    async _exchangeRefreshToken(refreshTokenObject) {
        const persistedToken = await this._readPersistedRefreshToken();
        const refreshToken = persistedToken || refreshTokenObject.refresh_token;

        const exchange = (token) => {
            const params = new URLSearchParams();
            params.append('grant_type', 'refresh_token');
            params.append('refresh_token', token);
            // Credentials go in the body, not a Basic header: the framework's
            // OAuth2Requester.addAuthHeaders deletes any Authorization header
            // and substitutes `Bearer <access_token>` on every request, so a
            // Basic header never reaches the token endpoint and Blackbaud
            // answers invalid_client. Still no redirect_uri or scope — neither
            // is documented on Blackbaud's refresh endpoint.
            params.append('client_id', this.client_id);
            params.append('client_secret', this.client_secret);
            const options = {
                body: params,
                url: this.tokenUri,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            };
            return this._post(options, false);
        };

        let response;
        try {
            response = await exchange(refreshToken);
        } catch (error) {
            const freshToken = await this._readPersistedRefreshToken();
            if (freshToken && freshToken !== refreshToken) {
                response = await exchange(freshToken);
            } else {
                throw error;
            }
        }
        await this.setTokens(response);
        return response;
    }

    async _readPersistedRefreshToken() {
        const module = this.delegate;
        if (!module?.credentialRepository || !module?.credential?.id) {
            return null;
        }
        try {
            const credential =
                await module.credentialRepository.findCredentialById(
                    module.credential.id
                );
            return credential?.refresh_token || null;
        } catch {
            return null;
        }
    }

    async testAuthRequest() {
        return this.listConstituents({ limit: 1 });
    }

    // --- Constituents ---

    async listConstituents(params = {}) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.listConstituents}`,
            headers: this._headers(),
            query: params,
        });
    }

    async getConstituent(constituentId) {
        return this._get({
            url: this._url(this.URLs.getConstituent, {
                constituent_id: constituentId,
            }),
            headers: this._headers(),
        });
    }

    async duplicateSearchConstituents(params = {}) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.duplicateSearchConstituents}`,
            headers: this._headers(),
            query: params,
        });
    }

    async createConstituent(data) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.createConstituent}`,
            headers: this._headers(true),
            body: data,
        });
    }

    async updateConstituent(constituentId, data) {
        return this._patch({
            url: this._url(this.URLs.updateConstituent, {
                constituent_id: constituentId,
            }),
            headers: this._headers(true),
            body: data,
        });
    }

    async listConstituentEmailAddresses(constituentId, params = {}) {
        return this._get({
            url: this._url(this.URLs.listConstituentEmailAddresses, {
                constituent_id: constituentId,
            }),
            headers: this._headers(),
            query: params,
        });
    }

    async createEmailAddress(data) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.createEmailAddress}`,
            headers: this._headers(true),
            body: data,
        });
    }

    async updateEmailAddress(emailAddressId, data) {
        return this._patch({
            url: this._url(this.URLs.updateEmailAddress, {
                email_address_id: emailAddressId,
            }),
            headers: this._headers(true),
            body: data,
        });
    }

    async listConstituentPhones(constituentId, params = {}) {
        return this._get({
            url: this._url(this.URLs.listConstituentPhones, {
                constituent_id: constituentId,
            }),
            headers: this._headers(),
            query: params,
        });
    }

    async createPhone(data) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.createPhone}`,
            headers: this._headers(true),
            body: data,
        });
    }

    async updatePhone(phoneId, data) {
        return this._patch({
            url: this._url(this.URLs.updatePhone, { phone_id: phoneId }),
            headers: this._headers(true),
            body: data,
        });
    }

    async listConstituentAddresses(constituentId, params = {}) {
        return this._get({
            url: this._url(this.URLs.listConstituentAddresses, {
                constituent_id: constituentId,
            }),
            headers: this._headers(),
            query: params,
        });
    }

    async createAddress(data) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.createAddress}`,
            headers: this._headers(true),
            body: data,
        });
    }

    async updateAddress(addressId, data) {
        return this._patch({
            url: this._url(this.URLs.updateAddress, { address_id: addressId }),
            headers: this._headers(true),
            body: data,
        });
    }

    async listTitles(params = {}) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.listTitles}`,
            headers: this._headers(),
            query: params,
        });
    }

    async listEmailAddressTypes() {
        return this._get({
            url: `${this.baseUrl}${this.URLs.listEmailAddressTypes}`,
            headers: this._headers(),
        });
    }

    async listPhoneTypes() {
        return this._get({
            url: `${this.baseUrl}${this.URLs.listPhoneTypes}`,
            headers: this._headers(),
        });
    }

    async listAddressTypes() {
        return this._get({
            url: `${this.baseUrl}${this.URLs.listAddressTypes}`,
            headers: this._headers(),
        });
    }

    // --- Gifts ---

    async listGifts(params = {}) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.listGifts}`,
            headers: this._headers(),
            query: params,
        });
    }

    async getGift(giftId) {
        return this._get({
            url: this._url(this.URLs.getGift, { gift_id: giftId }),
            headers: this._headers(),
        });
    }

    async createGift(data) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.createGift}`,
            headers: this._headers(true),
            body: data,
        });
    }

    // GiftEdit PATCH requires If-Match (ETag or '*') per the archived swagger.
    async updateGift(giftId, data) {
        return this._patch({
            url: this._url(this.URLs.updateGift, { gift_id: giftId }),
            headers: this._headers(true, { 'If-Match': '*' }),
            body: data,
        });
    }

    // --- Events ---

    async listEvents(params = {}) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.listEvents}`,
            headers: this._headers(),
            query: params,
        });
    }

    async getEvent(eventId) {
        return this._get({
            url: this._url(this.URLs.getEvent, { event_id: eventId }),
            headers: this._headers(),
        });
    }

    async createEvent(data) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.createEvent}`,
            headers: this._headers(true),
            body: data,
        });
    }

    async updateEvent(eventId, data) {
        return this._patch({
            url: this._url(this.URLs.updateEvent, { event_id: eventId }),
            headers: this._headers(true),
            body: data,
        });
    }

    async createParticipant(eventId, data) {
        return this._post({
            url: this._url(this.URLs.createParticipant, { event_id: eventId }),
            headers: this._headers(true),
            body: data,
        });
    }

    async listParticipants(eventId, params = {}) {
        return this._get({
            url: this._url(this.URLs.listParticipants, { event_id: eventId }),
            headers: this._headers(),
            query: params,
        });
    }

    async updateParticipant(participantId, data) {
        return this._patch({
            url: this._url(this.URLs.updateParticipant, {
                participant_id: participantId,
            }),
            headers: this._headers(true),
            body: data,
        });
    }

    // --- Fundraising ---

    async listFunds(params = {}) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.listFunds}`,
            headers: this._headers(),
            query: params,
        });
    }

    async listAppeals(params = {}) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.listAppeals}`,
            headers: this._headers(),
            query: params,
        });
    }

    // --- Webhook subscriptions ---
    // https://developer.blackbaud.com/skyapi/docs/webhooks/tutorial
    // Create + Get are documented on the tutorial. Delete is referenced by
    // SubscriptionDeletedEvent ("application explicitly deletes the
    // subscription"): https://developer.blackbaud.com/skyapi/docs/webhooks/event-types/special

    async createSubscription(data) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.createSubscription}`,
            headers: this._headers(true),
            body: data,
        });
    }

    async getSubscription(subscriptionId) {
        return this._get({
            url: this._url(this.URLs.getSubscription, {
                subscription_id: subscriptionId,
            }),
            headers: this._headers(),
        });
    }

    async deleteSubscription(subscriptionId) {
        return this._delete({
            url: this._url(this.URLs.deleteSubscription, {
                subscription_id: subscriptionId,
            }),
            headers: this._headers(),
        });
    }
}

module.exports = { Api };
