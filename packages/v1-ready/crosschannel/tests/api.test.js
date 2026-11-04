const {
    Api,
    PRODUCTION_BASE_URL,
    PRODUCTION_TOKEN_URI,
} = require('../api');

// Fully offline: stub low-level HTTP and assert on constructed requests.
function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        access_token: 'tok',
        accessTokenExpire: new Date(Date.now() + 60 * 60 * 1000),
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: [], meta: { statusCode: 200, message: 'OK', errors: [] } };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return {
            access_token: 'new-tok',
            expires_in: 3600,
            token_type: 'Bearer',
        };
    };
    return api;
}

describe('CrossChannel Api', () => {
    describe('construction & auth', () => {
        it('defaults to production Cross Channel hosts and client_credentials', () => {
            const api = new Api({});
            expect(api.baseUrl).toBe(PRODUCTION_BASE_URL);
            expect(api.tokenUri).toBe(PRODUCTION_TOKEN_URI);
            expect(api.grant_type).toBe('client_credentials');
            expect(api.authorizationUri).toBeNull();
        });

        it('honors base_url and token_uri overrides', () => {
            const api = new Api({
                base_url: 'https://example.test/crosschannel/v1',
                token_uri: 'https://example.test/OAuth2/Token',
            });
            expect(api.baseUrl).toBe('https://example.test/crosschannel/v1');
            expect(api.tokenUri).toBe('https://example.test/OAuth2/Token');
        });

        it('getAuthorizationRequirements exposes oauth2 form fields', () => {
            const api = new Api({});
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toBeNull();
            expect(reqs.data.jsonSchema.required).toEqual(
                expect.arrayContaining(['client_id', 'client_secret'])
            );
        });

        it('getTokenFromClientCredentials POSTs form-urlencoded without scope', async () => {
            const api = makeApi({
                client_id: 'my-id',
                client_secret: 'my-secret',
            });
            api.setTokens = async () => {};
            await api.getTokenFromClientCredentials();
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(PRODUCTION_TOKEN_URI);
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(captured.body).toBeInstanceOf(URLSearchParams);
            expect(captured.body.get('grant_type')).toBe('client_credentials');
            expect(captured.body.get('client_id')).toBe('my-id');
            expect(captured.body.get('client_secret')).toBe('my-secret');
            expect(captured.body.get('scope')).toBeNull();
        });

        it('isAuthenticated is true with token or with client credentials', () => {
            expect(new Api({ access_token: 't' }).isAuthenticated()).toBe(true);
            expect(
                new Api({
                    client_id: 'a',
                    client_secret: 'b',
                }).isAuthenticated()
            ).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });

        it('ensureAccessToken mints a token when expired', async () => {
            const api = makeApi({
                access_token: 'old',
                accessTokenExpire: new Date(Date.now() - 1000),
            });
            let minted = false;
            api.getTokenFromClientCredentials = async () => {
                minted = true;
                api.access_token = 'fresh';
                api.accessTokenExpire = new Date(Date.now() + 3600000);
            };
            const token = await api.ensureAccessToken();
            expect(minted).toBe(true);
            expect(token).toBe('fresh');
        });

        it('ensureAccessToken reuses a non-expired token', async () => {
            const api = makeApi({
                access_token: 'still-good',
                accessTokenExpire: new Date(Date.now() + 60 * 60 * 1000),
            });
            let minted = false;
            api.getTokenFromClientCredentials = async () => {
                minted = true;
            };
            const token = await api.ensureAccessToken();
            expect(minted).toBe(false);
            expect(token).toBe('still-good');
        });
    });

    describe('getEventConfigurations', () => {
        it('hits GET /eventConfigurations', async () => {
            const api = makeApi();
            await api.getEventConfigurations();
            expect(api._captured[0].method).toBe('GET');
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/eventConfigurations`
            );
        });
    });

    describe('getSchemaByEventUid', () => {
        it('hits GET /eventConfigurations/{eventUID}', async () => {
            const api = makeApi();
            const uid = '11111111-2222-3333-4444-555555555555';
            await api.getSchemaByEventUid(uid);
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/eventConfigurations/${uid}`
            );
        });

        it('rejects a missing eventUID', async () => {
            const api = makeApi();
            await expect(api.getSchemaByEventUid('')).rejects.toThrow(
                /eventUID/i
            );
        });
    });

    describe('postEvents', () => {
        it('POSTs JSON to /eventConfigurations/{eventUID}/events', async () => {
            const api = makeApi();
            const uid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
            const body = {
                events: [
                    {
                        identifiers: [
                            {
                                identifierType: 'EmailAddress',
                                identifierValue: 'alice@example.com',
                            },
                        ],
                        dataFields: { firstName: 'Alice' },
                    },
                ],
            };
            await api.postEvents(uid, body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                `${PRODUCTION_BASE_URL}/eventConfigurations/${uid}/events`
            );
            expect(captured.headers['Content-Type']).toBe('application/json');
            expect(captured.body).toEqual(body);
        });

        it('rejects a missing eventUID', async () => {
            const api = makeApi();
            await expect(api.postEvents(null, { events: [] })).rejects.toThrow(
                /eventUID/i
            );
        });
    });
});
