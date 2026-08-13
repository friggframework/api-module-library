const { OAuth2Requester, get } = require('@friggframework/core');

// Which paths below are confirmed, and which are not.
//
// CONFIRMED against Podium's own published sample apps
// (github.com/podium/podium-api-sample-messages and -sample-contacts):
//   - API base is https://api.podium.com/v4
//   - POST   /messages          with { channel: { identifier, type }, body, locationUid }
//   - GET    /contacts
//   - POST   /contacts
//   - Token endpoint is https://accounts.podium.com/oauth/token, and it takes a
//     JSON body (not form-encoded, which is what most OAuth2 servers want and
//     what the base OAuth2Requester sends).
//
// INFERRED from the endpoint slugs Podium's changelog links to
// (contactget / contactupdate / contactdelete / messagesend / review_invitecreate).
// The reference pages themselves are behind a developer.podium.com login, so the
// exact paths could not be read. `review_invites` follows the same
// singular-slug-to-plural-path rule as `contact` -> `/contacts`.
//
// Every path is overridable via constructor params so a single confirmed value
// can be corrected without a release. Verify the INFERRED ones against the
// reference as soon as the developer account is approved.
const DEFAULT_PATHS = {
    // Confirmed
    messages: '/messages',
    contacts: '/contacts',
    // Inferred
    contactByUid: (uid) => `/contacts/${uid}`,
    reviewInvites: '/review_invites',
    reviews: '/reviews',
    locations: '/locations',
    webhooks: '/webhooks',
};

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);

        this.baseUrl = get(params, 'baseUrl', 'https://api.podium.com/v4');
        // Podium's docs give api.podium.com/oauth/token; Podium's working sample
        // code uses accounts.podium.com/oauth/token. The sample wins by default
        // because it is executable evidence, but both are overridable.
        this.authorizationUri = get(
            params,
            'authorizationUri',
            'https://api.podium.com/oauth/authorize'
        );
        this.tokenUri = get(params, 'tokenUri', 'https://accounts.podium.com/oauth/token');

        this.paths = { ...DEFAULT_PATHS, ...get(params, 'paths', {}) };
        this.location_uid = get(params, 'location_uid', null);
        this.organization_uid = get(params, 'organization_uid', null);
    }

    url(path) {
        return `${this.baseUrl}${path}`;
    }

    getAuthorizationUri() {
        const query = new URLSearchParams({
            client_id: this.client_id,
            redirect_uri: this.redirect_uri,
            response_type: 'code',
        });
        // Podium requires space-separated scopes.
        if (this.scope) query.append('scope', this.scope);
        if (this.state) query.append('state', this.state);
        return `${this.authorizationUri}?${query.toString()}`;
    }

    // --- Auth -------------------------------------------------------------
    //
    // Both token calls below post JSON. The base OAuth2Requester posts
    // application/x-www-form-urlencoded, which Podium's own sample code does not
    // do — it sends Content-Type: application/json with a JSON body.

    async getTokenFromCode(code) {
        const response = await this._post(
            {
                url: this.tokenUri,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    grant_type: 'authorization_code',
                    client_id: this.client_id,
                    client_secret: this.client_secret,
                    redirect_uri: this.redirect_uri,
                    code,
                },
            },
            true
        );
        await this.setTokens(response);
        return response;
    }

    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const response = await this._post(
            {
                url: this.tokenUri,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    grant_type: 'refresh_token',
                    client_id: this.client_id,
                    client_secret: this.client_secret,
                    refresh_token: get(refreshTokenObject, 'refresh_token', this.refresh_token),
                },
            },
            true
        );
        await this.setTokens(response);
        return response;
    }

    // --- Locations --------------------------------------------------------

    async listLocations(query) {
        return this._get({ url: this.url(this.paths.locations), query });
    }

    // Cheapest call that proves the token works and tells us which locations
    // this authorization covers. A Podium organization can hold many locations
    // and every message send is scoped to one.
    async getOrganizationDetails() {
        const response = await this.listLocations();
        const locations = response?.data || response?.locations || [];
        const first = locations[0] || {};
        return {
            organizationUid: first.organizationUid || this.organization_uid || null,
            name: first.organizationName || first.name || 'Podium Organization',
            locations: locations.map((l) => ({
                uid: l.uid,
                name: l.name,
            })),
        };
    }

    // --- Contacts ---------------------------------------------------------

    async listContacts(query) {
        return this._get({ url: this.url(this.paths.contacts), query });
    }

    // Podium looks contacts up by channel identifier rather than by an internal
    // id, which is what makes it possible to reconcile against ServiceTitan
    // customers without storing a mapping first.
    async findContact({ phoneNumber, email, locationUid }) {
        const query = {};
        if (phoneNumber) query.phoneNumber = phoneNumber;
        if (email) query.email = email;
        if (locationUid) query.locationUid = locationUid;
        return this._get({ url: this.url(this.paths.contacts), query });
    }

    async createContact(body) {
        return this._post({ url: this.url(this.paths.contacts), body });
    }

    async updateContact(uid, body) {
        return this._put({ url: this.url(this.paths.contactByUid(uid)), body });
    }

    async deleteContact(uid) {
        return this._delete({ url: this.url(this.paths.contactByUid(uid)) });
    }

    // --- Messages ---------------------------------------------------------

    // `channelType` is 'phone' for SMS or 'email'. locationUid is required —
    // Podium rejects a send that is not scoped to a location.
    async sendMessage({ identifier, channelType = 'phone', body, locationUid }) {
        if (!identifier) throw new Error('A channel identifier (phone or email) is required');
        if (!body) throw new Error('A message body is required');
        const uid = locationUid || this.location_uid;
        if (!uid) throw new Error('A locationUid is required to send a Podium message');

        return this._post({
            url: this.url(this.paths.messages),
            body: {
                channel: { identifier, type: channelType },
                body,
                locationUid: uid,
            },
        });
    }

    // --- Reviews ----------------------------------------------------------

    // Returns an invitation link. Podium's flow is two-step by design: mint the
    // link here, then deliver it with sendMessage() — which is what lets the
    // review request reuse the same conversation thread as everything else.
    async createReviewInvite({ contactUid, locationUid, identifier, channelType = 'phone' }) {
        const uid = locationUid || this.location_uid;
        if (!uid) throw new Error('A locationUid is required to create a review invitation');

        const body = { locationUid: uid };
        if (contactUid) body.contactUid = contactUid;
        if (identifier) body.channel = { identifier, type: channelType };

        return this._post({ url: this.url(this.paths.reviewInvites), body });
    }

    async listReviews(query) {
        return this._get({ url: this.url(this.paths.reviews), query });
    }

    // --- Webhooks ---------------------------------------------------------
    //
    // Podium's docs say a partner's webhook URL is configured by Podium rather
    // than self-serve, so these may 404 for a given app. They are here so the
    // integration can attempt self-registration and fall back to manual setup.

    async listWebhooks(query) {
        return this._get({ url: this.url(this.paths.webhooks), query });
    }

    async createWebhook(body) {
        return this._post({ url: this.url(this.paths.webhooks), body });
    }

    async deleteWebhook(uid) {
        return this._delete({ url: this.url(`${this.paths.webhooks}/${uid}`) });
    }
}

module.exports = { Api, DEFAULT_PATHS };
