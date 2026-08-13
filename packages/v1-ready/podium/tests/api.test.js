const { Api } = require('../api');
const { createFakeFetch } = require('./fake-fetch');

const CREDS = {
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    redirect_uri: 'https://example.com/redirect/podium',
    access_token: 'test-access-token',
};

const LOCATION_UID = 'b405e23a-2d8e-5000-909c-d1759dd40000';

function apiWith(responders = [{ body: {} }], overrides = {}) {
    const fetch = createFakeFetch(responders);
    const api = new Api({ ...CREDS, ...overrides, fetch });
    return { api, fetch };
}

describe('Podium Api', () => {
    describe('hosts and paths', () => {
        it('defaults to the v4 base url', () => {
            const { api } = apiWith();
            expect(api.baseUrl).toEqual('https://api.podium.com/v4');
        });

        it('defaults the token endpoint to the host Podium\'s own sample uses', () => {
            // Podium's docs say api.podium.com/oauth/token; its working sample
            // code posts to accounts.podium.com/oauth/token. Executable evidence
            // wins, but the override exists for when this is settled.
            const { api } = apiWith();
            expect(api.tokenUri).toEqual('https://accounts.podium.com/oauth/token');
        });

        it('allows every host and path to be overridden without a code change', () => {
            const { api } = apiWith([{ body: {} }], {
                baseUrl: 'https://api.podium.com/v5',
                tokenUri: 'https://api.podium.com/oauth/token',
                paths: { reviewInvites: '/review_invitations' },
            });
            expect(api.url(api.paths.reviewInvites)).toEqual(
                'https://api.podium.com/v5/review_invitations'
            );
            // Overriding one path must not drop the others.
            expect(api.paths.messages).toEqual('/messages');
            expect(api.tokenUri).toEqual('https://api.podium.com/oauth/token');
        });
    });

    describe('authorization uri', () => {
        it('includes the client id, redirect uri and response type', () => {
            const { api } = apiWith([{ body: {} }], { scope: 'read_contacts write_messages' });
            const url = api.getAuthorizationUri();

            expect(url.startsWith('https://api.podium.com/oauth/authorize?')).toBe(true);
            const params = new URLSearchParams(url.split('?')[1]);
            expect(params.get('client_id')).toEqual(CREDS.client_id);
            expect(params.get('redirect_uri')).toEqual(CREDS.redirect_uri);
            expect(params.get('response_type')).toEqual('code');
            // Podium requires scopes separated by a single space.
            expect(params.get('scope')).toEqual('read_contacts write_messages');
        });

        it('omits scope and state when they are not set', () => {
            const { api } = apiWith();
            const params = new URLSearchParams(api.getAuthorizationUri().split('?')[1]);
            expect(params.has('scope')).toBe(false);
            expect(params.has('state')).toBe(false);
        });
    });

    describe('token exchange', () => {
        const tokenBody = {
            body: { access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600 },
        };

        it('posts a JSON body when exchanging the code, not form encoding', async () => {
            const { api, fetch } = apiWith([tokenBody]);
            await api.getTokenFromCode('the-code');

            const call = fetch.lastCall();
            expect(call.url).toEqual('https://accounts.podium.com/oauth/token');
            expect(call.method).toEqual('POST');
            expect(call.headers['Content-Type']).toEqual('application/json');
            // The base OAuth2Requester sends URLSearchParams here; Podium's
            // sample code sends JSON.
            expect(typeof call.body).toEqual('string');
            expect(JSON.parse(call.body)).toEqual({
                grant_type: 'authorization_code',
                client_id: CREDS.client_id,
                client_secret: CREDS.client_secret,
                redirect_uri: CREDS.redirect_uri,
                code: 'the-code',
            });
        });

        it('posts a JSON body when refreshing', async () => {
            const { api, fetch } = apiWith([tokenBody]);
            await api.refreshAccessToken({ refresh_token: 'old-refresh' });

            const call = fetch.lastCall();
            expect(call.headers['Content-Type']).toEqual('application/json');
            expect(JSON.parse(call.body)).toEqual({
                grant_type: 'refresh_token',
                client_id: CREDS.client_id,
                client_secret: CREDS.client_secret,
                refresh_token: 'old-refresh',
            });
        });

        it('falls back to the stored refresh token', async () => {
            const { api, fetch } = apiWith([tokenBody], { refresh_token: 'stored-refresh' });
            await api.refreshAccessToken({});
            expect(JSON.parse(fetch.lastCall().body).refresh_token).toEqual('stored-refresh');
        });
    });

    describe('sendMessage', () => {
        it('builds exactly the payload shape Podium documents', async () => {
            const { api, fetch } = apiWith([{ body: { uid: 'msg-1' } }]);
            await api.sendMessage({
                identifier: '8001119232',
                body: 'Just a reminder that your appointment is today!',
                locationUid: LOCATION_UID,
            });

            const call = fetch.lastCall();
            expect(call.url).toEqual('https://api.podium.com/v4/messages');
            expect(call.method).toEqual('POST');
            expect(JSON.parse(call.body)).toEqual({
                channel: { identifier: '8001119232', type: 'phone' },
                body: 'Just a reminder that your appointment is today!',
                locationUid: LOCATION_UID,
            });
        });

        it('sends the Bearer token', async () => {
            const { api, fetch } = apiWith([{ body: {} }]);
            await api.sendMessage({ identifier: 'x', body: 'y', locationUid: LOCATION_UID });
            expect(fetch.lastCall().headers.Authorization).toEqual(
                'Bearer test-access-token'
            );
        });

        it('supports the email channel', async () => {
            const { api, fetch } = apiWith([{ body: {} }]);
            await api.sendMessage({
                identifier: 'a@b.com',
                channelType: 'email',
                body: 'hi',
                locationUid: LOCATION_UID,
            });
            expect(JSON.parse(fetch.lastCall().body).channel).toEqual({
                identifier: 'a@b.com',
                type: 'email',
            });
        });

        it('falls back to the entity default location', async () => {
            const { api, fetch } = apiWith([{ body: {} }], { location_uid: LOCATION_UID });
            await api.sendMessage({ identifier: 'x', body: 'y' });
            expect(JSON.parse(fetch.lastCall().body).locationUid).toEqual(LOCATION_UID);
        });

        it('refuses to send without a location, identifier or body', async () => {
            const { api, fetch } = apiWith([{ body: {} }]);
            await expect(api.sendMessage({ identifier: 'x', body: 'y' })).rejects.toThrow(
                /locationUid is required/
            );
            await expect(
                api.sendMessage({ body: 'y', locationUid: LOCATION_UID })
            ).rejects.toThrow(/channel identifier/);
            await expect(
                api.sendMessage({ identifier: 'x', locationUid: LOCATION_UID })
            ).rejects.toThrow(/message body is required/);
            // None of those should have reached the network.
            expect(fetch.calls).toHaveLength(0);
        });
    });

    describe('review invitations', () => {
        it('posts to the review invites path scoped to a location', async () => {
            const { api, fetch } = apiWith([{ body: { url: 'https://pod.im/abc' } }]);
            await api.createReviewInvite({
                contactUid: 'contact-1',
                locationUid: LOCATION_UID,
            });

            const call = fetch.lastCall();
            expect(call.url).toEqual('https://api.podium.com/v4/review_invites');
            expect(JSON.parse(call.body)).toEqual({
                locationUid: LOCATION_UID,
                contactUid: 'contact-1',
            });
        });

        it('accepts a raw channel identifier when no contact uid is known', async () => {
            const { api, fetch } = apiWith([{ body: {} }]);
            await api.createReviewInvite({
                identifier: '8001119232',
                locationUid: LOCATION_UID,
            });
            expect(JSON.parse(fetch.lastCall().body)).toEqual({
                locationUid: LOCATION_UID,
                channel: { identifier: '8001119232', type: 'phone' },
            });
        });

        it('requires a location', async () => {
            const { api } = apiWith();
            await expect(api.createReviewInvite({ contactUid: 'c' })).rejects.toThrow(
                /locationUid is required/
            );
        });
    });

    describe('contacts', () => {
        it('creates a contact at the confirmed path', async () => {
            const { api, fetch } = apiWith([{ body: { uid: 'c1' } }]);
            await api.createContact({ name: 'Jane', phoneNumber: '8001119232' });

            const call = fetch.lastCall();
            expect(call.url).toEqual('https://api.podium.com/v4/contacts');
            expect(call.method).toEqual('POST');
        });

        it('looks a contact up by phone number and scopes it to a location', async () => {
            const { api, fetch } = apiWith([{ body: { data: [] } }]);
            await api.findContact({ phoneNumber: '8001119232', locationUid: LOCATION_UID });

            const call = fetch.lastCall();
            expect(call.query).toStrictEqual({
                phoneNumber: '8001119232',
                locationUid: LOCATION_UID,
            });
        });

        it('omits absent lookup keys rather than sending undefined', async () => {
            // Requester._request iterates the query with `for...in`, so a key
            // present-but-undefined is serialized as the literal string
            // "undefined" and Podium filters on it. toStrictEqual is required
            // here — toEqual treats an undefined-valued key as absent and would
            // pass against exactly the bug this guards.
            const { api, fetch } = apiWith([{ body: { data: [] } }]);
            await api.findContact({ email: 'a@b.com' });

            const { query } = fetch.lastCall();
            expect(query).toStrictEqual({ email: 'a@b.com' });
            expect(Object.keys(query)).toEqual(['email']);
        });

        it('PUTs updates to the contact uid path', async () => {
            const { api, fetch } = apiWith([{ body: {} }]);
            await api.updateContact('c1', { name: 'Jane Doe' });

            const call = fetch.lastCall();
            expect(call.method).toEqual('PUT');
            expect(call.url).toEqual('https://api.podium.com/v4/contacts/c1');
        });
    });

    describe('getOrganizationDetails', () => {
        it('summarizes the locations this authorization covers', async () => {
            const { api } = apiWith([
                {
                    body: {
                        data: [
                            {
                                uid: LOCATION_UID,
                                name: 'Acme HVAC — Provo',
                                organizationUid: 'org-1',
                                organizationName: 'Acme HVAC',
                            },
                            { uid: 'loc-2', name: 'Acme HVAC — Orem' },
                        ],
                    },
                },
            ]);

            const org = await api.getOrganizationDetails();
            expect(org.organizationUid).toEqual('org-1');
            expect(org.name).toEqual('Acme HVAC');
            expect(org.locations).toEqual([
                { uid: LOCATION_UID, name: 'Acme HVAC — Provo' },
                { uid: 'loc-2', name: 'Acme HVAC — Orem' },
            ]);
        });

        it('does not throw when the org has no locations yet', async () => {
            const { api } = apiWith([{ body: { data: [] } }]);
            const org = await api.getOrganizationDetails();
            expect(org.locations).toEqual([]);
            expect(org.name).toEqual('Podium Organization');
        });
    });
});
