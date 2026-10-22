const nock = require('nock');
const { Api } = require('../api');
const { Definition } = require('../definition');

const HUBAPI = 'https://api.hubapi.com';
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';

const apiParams = {
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    redirect_uri: 'https://example.com/redirect/hubspot',
    scope: 'oauth crm.objects.contacts.read',
};

const tokenResponse = {
    token_type: 'bearer',
    refresh_token: 'na1-refresh-token',
    access_token: 'new-access-token',
    hub_id: 111111111,
    scopes: ['oauth', 'crm.objects.contacts.read'],
    expires_in: 1800,
};

const meResponse = {
    portalId: 111111111,
    timeZone: 'US/Eastern',
    accountType: 'DEVELOPER_TEST',
    currency: 'USD',
    utcOffset: '-05:00',
    utcOffsetMilliseconds: -18000000,
};

const introspectResponse = {
    active: true,
    token: 'current-access-token',
    hub_id: 111111111,
    user_id: 33333333,
    client_id: 'test-client-id',
    app_id: 22222222,
    user: 'projectteam@lefthook.co',
    hub_domain: 'Testing Object Things-dev-44613847.com',
    scopes: ['oauth', 'crm.objects.contacts.read'],
    expires_in: 1704,
    is_private_distribution: false,
    token_use: 'access_token',
    token_type: 'Bearer',
};

function mockMe() {
    return nock(HUBAPI, {
        reqheaders: { authorization: 'Bearer current-access-token' },
    })
        .get('/integrations/v1/me')
        .reply(200, meResponse);
}

function formBody(body) {
    return Object.fromEntries(new URLSearchParams(body));
}

describe('HubSpot OAuth 2026-03 endpoints', () => {
    beforeAll(() => nock.disableNetConnect());
    afterEach(() => nock.cleanAll());
    afterAll(() => nock.enableNetConnect());

    it('uses the 2026-03 token endpoint', () => {
        const api = new Api(apiParams);
        expect(api.tokenUri).toBe(`${HUBAPI}/oauth/2026-03/token`);
    });

    describe('getTokenFromCode()', () => {
        it('exchanges the code with a form-encoded POST to /oauth/2026-03/token', async () => {
            let sentBody;
            const scope = nock(HUBAPI, {
                reqheaders: { 'content-type': FORM_CONTENT_TYPE },
            })
                .post('/oauth/2026-03/token', (body) => {
                    sentBody = formBody(body);
                    return true;
                })
                .reply(200, tokenResponse);

            const api = new Api(apiParams);
            const response = await api.getTokenFromCode('na1-auth-code');

            expect(scope.isDone()).toBe(true);
            expect(sentBody).toMatchObject({
                grant_type: 'authorization_code',
                code: 'na1-auth-code',
                client_id: 'test-client-id',
                client_secret: 'test-client-secret',
                redirect_uri: 'https://example.com/redirect/hubspot',
            });
            expect(response).toEqual(tokenResponse);
            expect(api.access_token).toBe('new-access-token');
            expect(api.refresh_token).toBe('na1-refresh-token');
        });
    });

    describe('refreshAccessToken()', () => {
        it('refreshes with a form-encoded POST to /oauth/2026-03/token', async () => {
            let sentBody;
            const scope = nock(HUBAPI, {
                reqheaders: { 'content-type': FORM_CONTENT_TYPE },
            })
                .post('/oauth/2026-03/token', (body) => {
                    sentBody = formBody(body);
                    return true;
                })
                .reply(200, {
                    ...tokenResponse,
                    refresh_token: 'rotated-refresh-token',
                });

            const api = new Api({
                ...apiParams,
                refresh_token: 'old-refresh-token',
            });
            await api.refreshAccessToken({
                refresh_token: 'old-refresh-token',
            });

            expect(scope.isDone()).toBe(true);
            expect(sentBody).toMatchObject({
                grant_type: 'refresh_token',
                refresh_token: 'old-refresh-token',
                client_id: 'test-client-id',
                client_secret: 'test-client-secret',
            });
            expect(api.access_token).toBe('new-access-token');
            expect(api.refresh_token).toBe('rotated-refresh-token');
        });

        it('keeps the current refresh token when the response omits one', async () => {
            const { refresh_token, ...withoutRefreshToken } = tokenResponse;
            nock(HUBAPI)
                .post('/oauth/2026-03/token')
                .reply(200, withoutRefreshToken);

            const api = new Api({
                ...apiParams,
                refresh_token: 'old-refresh-token',
            });
            await api.refreshAccessToken({
                refresh_token: 'old-refresh-token',
            });

            expect(api.access_token).toBe('new-access-token');
            expect(api.refresh_token).toBe('old-refresh-token');
        });

        it('rejects with the status when HubSpot refuses the grant', async () => {
            nock(HUBAPI).post('/oauth/2026-03/token').reply(400, {
                error: 'invalid_grant',
                error_description:
                    'refresh token is invalid, expired or revoked',
                status: 'BAD_REFRESH_TOKEN',
                message: 'refresh token is invalid, expired or revoked',
            });

            const api = new Api({
                ...apiParams,
                refresh_token: 'dead-refresh-token',
            });

            await expect(
                api.refreshAccessToken({ refresh_token: 'dead-refresh-token' })
            ).rejects.toMatchObject({ statusCode: 400 });
        });
    });

    describe('getUserDetails()', () => {
        it('introspects the token with a form-encoded POST, never putting it in the URL', async () => {
            let sentBody;
            const me = mockMe();
            const introspect = nock(HUBAPI, {
                reqheaders: { 'content-type': FORM_CONTENT_TYPE },
            })
                .post('/oauth/2026-03/token/introspect', (body) => {
                    sentBody = formBody(body);
                    return true;
                })
                .reply(200, introspectResponse);

            const api = new Api({
                ...apiParams,
                access_token: 'current-access-token',
            });
            await api.getUserDetails();

            expect(me.isDone()).toBe(true);
            expect(introspect.isDone()).toBe(true);
            expect(sentBody).toEqual({
                client_id: 'test-client-id',
                client_secret: 'test-client-secret',
                token: 'current-access-token',
                token_type_hint: 'access_token',
            });
        });

        it('returns the account details merged with the token metadata', async () => {
            mockMe();
            nock(HUBAPI)
                .post('/oauth/2026-03/token/introspect')
                .reply(200, introspectResponse);

            const api = new Api({
                ...apiParams,
                access_token: 'current-access-token',
            });
            const details = await api.getUserDetails();

            expect(details).toMatchObject({
                portalId: 111111111,
                timeZone: 'US/Eastern',
                hub_id: 111111111,
                hub_domain: 'Testing Object Things-dev-44613847.com',
                user: 'projectteam@lefthook.co',
                user_id: 33333333,
                app_id: 22222222,
                token: 'current-access-token',
                scopes: ['oauth', 'crm.objects.contacts.read'],
                expires_in: 1704,
            });
        });

        it('rejects when HubSpot reports the token as inactive', async () => {
            mockMe();
            nock(HUBAPI)
                .post('/oauth/2026-03/token/introspect')
                .reply(200, { active: false });

            const api = new Api({
                ...apiParams,
                access_token: 'current-access-token',
            });

            await expect(api.getUserDetails()).rejects.toThrow(/inactive/);
        });

        it('rejects with the status when introspection fails', async () => {
            mockMe();
            nock(HUBAPI).post('/oauth/2026-03/token/introspect').reply(400, {
                error: 'invalid_client',
                error_description: 'client credentials are invalid',
            });

            const api = new Api({
                ...apiParams,
                access_token: 'current-access-token',
            });

            await expect(api.getUserDetails()).rejects.toMatchObject({
                statusCode: 400,
            });
        });
    });

    describe('Definition', () => {
        beforeEach(() => {
            mockMe();
            nock(HUBAPI)
                .post('/oauth/2026-03/token/introspect')
                .reply(200, introspectResponse);
        });

        it('getEntityDetails() keeps the portal id and hub domain identifiers', async () => {
            const api = new Api({
                ...apiParams,
                access_token: 'current-access-token',
            });

            const result =
                await Definition.requiredAuthMethods.getEntityDetails(
                    api,
                    null,
                    null,
                    42
                );

            expect(result).toEqual({
                identifiers: { externalId: '111111111', user: 42 },
                details: { name: 'Testing Object Things-dev-44613847.com' },
            });
        });

        it('getCredentialDetails() keeps the portal id identifier', async () => {
            const api = new Api({
                ...apiParams,
                access_token: 'current-access-token',
            });

            const result =
                await Definition.requiredAuthMethods.getCredentialDetails(
                    api,
                    42
                );

            expect(result).toEqual({
                identifiers: { externalId: '111111111', userId: 42 },
                details: {},
            });
        });
    });
});
