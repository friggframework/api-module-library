const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example/redirect/raisersedge',
        subscription_key: 'sub-key',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { count: 0, value: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'created_1' };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { id: 'updated_1' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe("Raiser's Edge NXT Api", () => {
    describe('construction & auth', () => {
        it('sets SKY API base URL and OAuth endpoints', () => {
            const api = new Api({
                access_token: 't',
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/raisersedge',
            });
            expect(api.baseUrl).toBe('https://api.sky.blackbaud.com');
            expect(api.authorizationUri).toBe(
                'https://oauth2.sky.blackbaud.com/authorization'
            );
            expect(api.tokenUri).toBe('https://oauth2.sky.blackbaud.com/token');
        });

        it('builds an authorization URI with documented query params', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/cb',
                scope: 'rnxt.r rnxt.w',
                state: 'xyz',
            });
            const uri = api.getAuthorizationUri();
            expect(uri).toContain('client_id=cid');
            expect(uri).toContain('response_type=code');
            expect(uri).toContain(
                'redirect_uri=https%3A%2F%2Fapp.example%2Fcb'
            );
            expect(uri).toContain('scope=rnxt.r+rnxt.w');
            expect(uri).toContain('state=xyz');
        });

        it('getAuthorizationRequirements returns oauth2 + url', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/cb',
            });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('oauth2.sky.blackbaud.com');
        });

        it('sends Bb-Api-Subscription-Key on API headers', () => {
            const api = makeApi();
            const headers = api._headers(true);
            expect(headers['Bb-Api-Subscription-Key']).toBe('sub-key');
            expect(headers['Content-Type']).toBe('application/json');
            expect(headers.Accept).toBe('application/json');
        });

        it('getTokenFromCode posts documented params without scope', async () => {
            const api = makeApi();
            api.setTokens = async () => {};
            await api.getTokenFromCode('auth-code');
            const call = api._captured[0];
            expect(call.method).toBe('POST');
            expect(call.url).toBe('https://oauth2.sky.blackbaud.com/token');
            const body = call.body.toString();
            expect(body).toContain('grant_type=authorization_code');
            expect(body).toContain('code=auth-code');
            expect(body).toContain('client_id=cid');
            expect(body).not.toContain('scope=');
        });

        it('setTokens maps refresh_token_expires_in and environment_id', async () => {
            const api = new Api({});
            api.notify = async () => {};
            await api.setTokens({
                access_token: 'a',
                refresh_token: 'r',
                expires_in: 3600,
                refresh_token_expires_in: 86400,
                environment_id: 'env-123',
            });
            expect(api.access_token).toBe('a');
            expect(api.refresh_token).toBe('r');
            expect(api.environment_id).toBe('env-123');
            expect(api.accessTokenExpire).toBeInstanceOf(Date);
            expect(api.refreshTokenExpire).toBeInstanceOf(Date);
        });

        it('refreshAccessToken posts body credentials without redirect_uri/scope', async () => {
            const api = makeApi();
            api.setTokens = async () => {};
            api._readPersistedRefreshToken = async () => null;
            await api.refreshAccessToken({ refresh_token: 'old-rt' });
            const call = api._captured[0];
            const body = call.body.toString();
            expect(body).toContain('grant_type=refresh_token');
            expect(body).toContain('refresh_token=old-rt');
            expect(body).toContain('client_id=cid');
            expect(body).toContain('client_secret=csecret');
            expect(body).not.toContain('redirect_uri');
            expect(body).not.toContain('scope=');
        });
    });

    describe('constituents', () => {
        it('list / get / create / update / duplicate search', async () => {
            const api = makeApi();
            await api.listConstituents({ limit: 1 });
            expect(api._captured[0].url).toBe(
                'https://api.sky.blackbaud.com/constituent/v1/constituents'
            );
            expect(api._captured[0].query).toEqual({ limit: 1 });

            await api.getConstituent('280');
            expect(api._captured[1].url).toBe(
                'https://api.sky.blackbaud.com/constituent/v1/constituents/280'
            );

            await api.createConstituent({ first: 'Ada', last: 'Lovelace' });
            expect(api._captured[2]).toMatchObject({
                method: 'POST',
                body: { first: 'Ada', last: 'Lovelace' },
            });

            await api.updateConstituent('280', { title: 'Ms.' });
            expect(api._captured[3].method).toBe('PATCH');
            expect(api._captured[3].url).toContain('/constituents/280');

            await api.duplicateSearchConstituents({
                email_address: 'a@example.com',
            });
            expect(api._captured[4].url).toContain('/duplicatesearch');
        });

        it('email / phone / address helpers and type lists', async () => {
            const api = makeApi();
            await api.listConstituentEmailAddresses('1');
            expect(api._captured[0].url).toContain('/1/emailaddresses');
            await api.createEmailAddress({
                constituent_id: '1',
                address: 'a@example.com',
            });
            expect(api._captured[1].url).toContain('/emailaddresses');
            await api.updateEmailAddress('e1', { address: 'b@example.com' });
            expect(api._captured[2].url).toContain('/emailaddresses/e1');

            await api.listConstituentPhones('1');
            await api.createPhone({ constituent_id: '1', number: '555' });
            await api.updatePhone('p1', { number: '556' });

            await api.listConstituentAddresses('1');
            await api.createAddress({ constituent_id: '1', city: 'Austin' });
            await api.updateAddress('a1', { city: 'Dallas' });

            await api.listTitles();
            await api.listEmailAddressTypes();
            await api.listPhoneTypes();
            await api.listAddressTypes();

            expect(api._captured.some((c) => c.url.includes('/titles'))).toBe(
                true
            );
            expect(
                api._captured.some((c) => c.url.includes('/emailaddresstypes'))
            ).toBe(true);
        });
    });

    describe('gifts', () => {
        it('list / get / create / update with If-Match', async () => {
            const api = makeApi();
            await api.listGifts({ limit: 5 });
            expect(api._captured[0].url).toContain('/gift/v1/gifts');
            await api.getGift('g1');
            expect(api._captured[1].url).toContain('/gifts/g1');
            await api.createGift({ type: 'Donation' });
            expect(api._captured[2].method).toBe('POST');
            await api.updateGift('g1', { type: 'Pledge' });
            expect(api._captured[3].headers['If-Match']).toBe('*');
        });
    });

    describe('events', () => {
        it('list / get / create / update and participants', async () => {
            const api = makeApi();
            await api.listEvents();
            expect(api._captured[0].url).toContain('/event/v1/eventlist');
            await api.getEvent('e1');
            expect(api._captured[1].url).toContain('/events/e1');
            await api.createEvent({ name: 'Gala' });
            await api.updateEvent('e1', { name: 'Gala 2' });
            await api.listParticipants('e1');
            await api.createParticipant('e1', { constituent_id: '1' });
            await api.updateParticipant('p1', { rsvp_status: 'Attending' });
            expect(api._captured.length).toBe(7);
        });
    });

    describe('fundraising', () => {
        it('lists funds and appeals', async () => {
            const api = makeApi();
            await api.listFunds();
            expect(api._captured[0].url).toContain('/fundraising/v1/funds');
            await api.listAppeals();
            expect(api._captured[1].url).toContain('/fundraising/v1/appeals');
        });
    });

    describe('webhook subscriptions', () => {
        it('create / get / delete subscriptions', async () => {
            const api = makeApi();
            await api.createSubscription({
                webhook_url: 'https://hooks.example/bb?webhookKey=secret',
                event_type: 'com.blackbaud.gift.add.v1',
            });
            expect(api._captured[0].url).toBe(
                'https://api.sky.blackbaud.com/webhook/v1/subscriptions'
            );
            await api.getSubscription('sub-1');
            expect(api._captured[1].url).toContain('/subscriptions/sub-1');
            await api.deleteSubscription('sub-1');
            expect(api._captured[2].method).toBe('DELETE');
        });
    });

    describe('testAuthRequest', () => {
        it('lists constituents with limit 1', async () => {
            const api = makeApi();
            await api.testAuthRequest();
            expect(api._captured[0].query).toEqual({ limit: 1 });
        });
    });
});
