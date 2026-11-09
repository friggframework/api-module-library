/**
 * Binding C item 4a synthetic tests.
 *
 * Loads the selected artifact's real auth implementation
 * (Definition.requiredAuthMethods.getToken, testAuthRequest, and Api)
 * and runs it against nock-intercepted HTTP to the module's actual
 * HubSpot endpoints. Fixtures are hand-built from official HubSpot docs
 * (see tests/fixtures/provenance.json). These tests are not a live or
 * authorized run.
 *
 * Network is fail-closed (nock.disableNetConnect). Token-like env vars
 * fail the suite. Negative cases prove the path rejects bad grants,
 * 401s, inactive tokens, and tampered fixtures.
 */
const path = require('path');
const fs = require('fs');
const nock = require('nock');
const { Api } = require('../api');
const { Definition } = require('../definition');
const {
    DENIED_PROVIDER_HOSTS,
    TOKEN_ENDPOINT,
    forbiddenEnvHits,
    matchesTokenExchange,
    matchesTokenRefresh,
    matchesBearerAuthorization,
    matchesApiAuthHeader,
    tokenBody,
    createPinnedHostSpy,
    evaluateDenyAndSpy,
} = require('../../../../scripts/ci/hubspot-4a-policy.cjs');

const HUBAPI = 'https://api.hubapi.com';
const APP_HOST = 'https://app.hubspot.com';
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function assertNoLiveTokenEnv() {
    const hits = forbiddenEnvHits(process.env);
    if (hits.length) {
        throw new Error(
            `4a fail-closed: token-like env var present: ${hits.join(', ')}. Unset them; this job must not use a Sean-held or live provider token.`
        );
    }
}

function loadFixture(name) {
    return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'));
}

const tokenResponse = loadFixture('oauth-token.json');
const meResponse = loadFixture('account-me.json');
const introspectResponse = loadFixture('token-introspect.json');
const contactsListResponse = loadFixture('contacts-list.json');

const apiParams = {
    client_id: 'synthetic-client-id',
    client_secret: 'synthetic-client-secret',
    redirect_uri: 'https://example.com/redirect/hubspot',
    scope: 'oauth crm.objects.contacts.read crm.objects.contacts.write',
};

function formBody(body) {
    return Object.fromEntries(new URLSearchParams(body));
}

function mockTokenExchange(replyStatus, replyBody, grantType = 'authorization_code') {
    let sentBody;
    const scope = nock(HUBAPI, {
        reqheaders: { 'content-type': FORM_CONTENT_TYPE },
    })
        .post('/oauth/2026-03/token', (body) => {
            sentBody = formBody(body);
            const req = { method: 'POST', url: TOKEN_ENDPOINT, body: sentBody };
            // Never always-200: only this request shape may receive the fixture.
            if (grantType === 'refresh_token') return matchesTokenRefresh(req);
            return matchesTokenExchange(req);
        })
        .reply(replyStatus, replyBody);
    return { scope, getSentBody: () => sentBody };
}

function mockUserDetails({ me = meResponse, introspect = introspectResponse, meStatus = 200, introspectStatus = 200 } = {}) {
    const meScope = nock(HUBAPI, {
        reqheaders: { authorization: 'Bearer synthetic-access-token' },
    })
        .get('/integrations/v1/me')
        .reply(meStatus, me);
    const introspectScope = nock(HUBAPI, {
        reqheaders: { 'content-type': FORM_CONTENT_TYPE },
    })
        .post('/oauth/2026-03/token/introspect')
        .reply(introspectStatus, introspect);
    return { meScope, introspectScope };
}

describe('HubSpot auth/API synthetic receipt tests', () => {
    // Deny (nock.disableNetConnect) and spy (nock.emitter 'no match') are
    // distinct T-C4-12 mechanisms over the same pinned host list.
    const providerSpy = createPinnedHostSpy(DENIED_PROVIDER_HOSTS);
    beforeAll(() => {
        assertNoLiveTokenEnv();
        nock.disableNetConnect();
        providerSpy.install();
    });
    afterEach(() => nock.cleanAll());
    afterAll(() => {
        providerSpy.uninstall();
        nock.enableNetConnect();
    });

    describe('Definition.requiredAuthMethods.getToken() — real code path', () => {
        it('exchanges the redirect code via Api.getTokenFromCode POST /oauth/2026-03/token', async () => {
            const { scope, getSentBody } = mockTokenExchange(200, tokenResponse);

            const api = new Api(apiParams);
            const response = await Definition.requiredAuthMethods.getToken(
                api,
                { code: 'synthetic-auth-code' }
            );

            expect(scope.isDone()).toBe(true);
            expect(getSentBody()).toMatchObject({
                grant_type: 'authorization_code',
                code: 'synthetic-auth-code',
                client_id: 'synthetic-client-id',
                client_secret: 'synthetic-client-secret',
                redirect_uri: 'https://example.com/redirect/hubspot',
            });
            expect(response).toEqual(tokenResponse);
            expect(api.access_token).toBe('synthetic-access-token');
            expect(api.refresh_token).toBe('synthetic-refresh-token');
        });

        it('rejects when HubSpot returns 400 invalid_grant for a bad code', async () => {
            mockTokenExchange(400, {
                error: 'invalid_grant',
                error_description: 'authorization code is invalid, expired or revoked',
                status: 'BAD_AUTH_CODE',
                message: 'authorization code is invalid, expired or revoked',
            });

            const api = new Api(apiParams);
            await expect(
                Definition.requiredAuthMethods.getToken(api, {
                    code: 'synthetic-bad-code',
                })
            ).rejects.toMatchObject({ statusCode: 400 });
            expect(api.access_token).toBeNull();
        });
    });

    describe('Definition.requiredAuthMethods.testAuthRequest() — real code path', () => {
        it('calls Api.getUserDetails against GET /integrations/v1/me and POST /oauth/2026-03/token/introspect', async () => {
            const { meScope, introspectScope } = mockUserDetails();

            const api = new Api({
                ...apiParams,
                access_token: 'synthetic-access-token',
            });
            const details =
                await Definition.requiredAuthMethods.testAuthRequest(api);

            expect(meScope.isDone()).toBe(true);
            expect(introspectScope.isDone()).toBe(true);
            expect(details).toMatchObject({
                portalId: 2519445,
                timeZone: 'America/New_York',
                currency: 'USD',
                hub_id: 1234567,
                hub_domain: 'example.com',
                user: 'jdoe@hubspot.com',
                active: true,
            });
        });

        it('rejects when /integrations/v1/me returns 401', async () => {
            nock(HUBAPI)
                .get('/integrations/v1/me')
                .reply(401, {
                    status: 'UNAUTHORIZED',
                    message: 'Authentication credentials not found',
                });

            const api = new Api({
                ...apiParams,
                access_token: 'synthetic-access-token',
            });
            await expect(
                Definition.requiredAuthMethods.testAuthRequest(api)
            ).rejects.toMatchObject({ statusCode: 401 });
        });

        it('rejects when introspect reports the token inactive', async () => {
            mockUserDetails({
                introspect: { ...introspectResponse, active: false },
            });

            const api = new Api({
                ...apiParams,
                access_token: 'synthetic-access-token',
            });
            await expect(
                Definition.requiredAuthMethods.testAuthRequest(api)
            ).rejects.toThrow(/inactive/);
        });
    });

    describe('tampered fixture / mutation', () => {
        it('does not treat a token fixture missing access_token as a successful auth', async () => {
            const tampered = { ...tokenResponse };
            delete tampered.access_token;
            mockTokenExchange(200, tampered);

            const api = new Api(apiParams);
            // Real setTokens() requires access_token; a tampered fixture
            // missing that field must fail the auth path (T-C4-1 negative).
            await expect(
                Definition.requiredAuthMethods.getToken(api, {
                    code: 'synthetic-auth-code',
                })
            ).rejects.toThrow(/access_token|required/i);
        });
    });

    describe('Api.listContacts() (mocked HTTP against the real method)', () => {
        it('GETs /crm/v3/objects/contacts and returns the official list shape', async () => {
            const contacts = nock(HUBAPI, {
                reqheaders: { authorization: 'Bearer synthetic-access-token' },
            })
                .get('/crm/v3/objects/contacts')
                .query({
                    // requester.js stringifies array values with Array#toString
                    // (comma-separated) before encodeURIComponent.
                    limit: '10',
                    properties: 'email,firstname,lastname',
                })
                .reply(200, contactsListResponse);

            const api = new Api({
                ...apiParams,
                access_token: 'synthetic-access-token',
            });
            const response = await api.listContacts({
                limit: 10,
                properties: ['email', 'firstname', 'lastname'],
            });

            expect(contacts.isDone()).toBe(true);
            expect(response.results).toHaveLength(1);
            expect(response.results[0]).toMatchObject({
                id: '33451',
                properties: {
                    email: 'lorelai@thedragonfly.com',
                    firstname: 'Lorelai',
                    lastname: 'Gilmore',
                },
                archived: false,
            });
            expect(response.paging.next.after).toBe('33452');
        });
    });

    describe('Api.refreshAccessToken() — real refresh path', () => {
        it('refreshes via POST /oauth/2026-03/token with grant_type=refresh_token', async () => {
            let sentBody;
            const scope = nock(HUBAPI, {
                reqheaders: { 'content-type': FORM_CONTENT_TYPE },
            })
                .post('/oauth/2026-03/token', (body) => {
                    sentBody = formBody(body);
                    return matchesTokenRefresh({
                        method: 'POST',
                        url: TOKEN_ENDPOINT,
                        body: sentBody,
                    });
                })
                .reply(200, tokenResponse);

            const api = new Api({
                ...apiParams,
                access_token: 'synthetic-stale-access-token',
                refresh_token: 'synthetic-refresh-token',
            });
            const response = await api.refreshAccessToken({
                refresh_token: 'synthetic-refresh-token',
            });

            expect(scope.isDone()).toBe(true);
            expect(sentBody).toMatchObject({
                grant_type: 'refresh_token',
                refresh_token: 'synthetic-refresh-token',
                client_id: 'synthetic-client-id',
                client_secret: 'synthetic-client-secret',
            });
            expect(response).toEqual(tokenResponse);
            expect(api.access_token).toBe('synthetic-access-token');
        });

        it('rejects when HubSpot returns 400 for an expired refresh token', async () => {
            nock(HUBAPI)
                .post('/oauth/2026-03/token')
                .reply(400, {
                    error: 'invalid_grant',
                    error_description:
                        'refresh token is invalid, expired or revoked',
                    status: 'BAD_REFRESH_TOKEN',
                    message: 'refresh token is invalid, expired or revoked',
                });

            const api = new Api({
                ...apiParams,
                refresh_token: 'synthetic-expired-refresh-token',
            });
            await expect(
                api.refreshAccessToken({
                    refresh_token: 'synthetic-expired-refresh-token',
                })
            ).rejects.toMatchObject({ statusCode: 400 });
        });
    });

    describe('header / signing construction — real addAuthHeaders', () => {
        it('Api.addAuthHeaders sets Authorization Bearer from the access token', async () => {
            const api = new Api({
                ...apiParams,
                access_token: 'synthetic-access-token',
            });
            const headers = await api.addAuthHeaders({ Accept: 'application/json' });
            expect(headers.Authorization).toBe('Bearer synthetic-access-token');
        });

        it('sends the constructed Bearer header on a real Api listContacts request', async () => {
            const contacts = nock(HUBAPI, {
                reqheaders: { authorization: 'Bearer synthetic-access-token' },
            })
                .get('/crm/v3/objects/contacts')
                .query(true)
                .reply(200, contactsListResponse);

            const api = new Api({
                ...apiParams,
                access_token: 'synthetic-access-token',
            });
            await api.listContacts({
                limit: 10,
                properties: ['email', 'firstname', 'lastname'],
            });
            expect(contacts.isDone()).toBe(true);
        });
    });

    describe('T-C4-11: outbound request shape — wrong shape must not get 200', () => {
        it('rejects wrong method, URL, grant_type, missing client_id, and wrong Authorization form', () => {
            const goodExchange = {
                method: 'POST',
                url: TOKEN_ENDPOINT,
                body: {
                    grant_type: 'authorization_code',
                    client_id: 'synthetic-client-id',
                    client_secret: 'synthetic-client-secret',
                    redirect_uri: 'https://example.com/redirect/hubspot',
                    scope: 'oauth',
                    code: 'synthetic-auth-code',
                },
            };
            expect(matchesTokenExchange(goodExchange)).toBe(true);
            expect(matchesTokenExchange({ ...goodExchange, method: 'GET' })).toBe(false);
            expect(
                matchesTokenExchange({
                    ...goodExchange,
                    url: 'https://api.hubapi.com/oauth/v1/token',
                })
            ).toBe(false);
            expect(
                matchesTokenExchange({
                    ...goodExchange,
                    body: { ...goodExchange.body, grant_type: 'client_credentials' },
                })
            ).toBe(false);
            expect(
                matchesTokenExchange({
                    ...goodExchange,
                    body: { grant_type: 'authorization_code', code: 'synthetic-auth-code' },
                })
            ).toBe(false);
            expect(
                matchesTokenExchange({
                    ...goodExchange,
                    headers: { Authorization: 'Basic c3ludGhldGlj' },
                })
            ).toBe(false);
            expect(
                matchesTokenExchange({
                    ...goodExchange,
                    body: { ...goodExchange.body, client_secret: undefined },
                })
            ).toBe(false);

            expect(
                matchesBearerAuthorization('Bearer synthetic-access-token')
            ).toBe(true);
            expect(matchesBearerAuthorization('Basic synthetic-access-token')).toBe(
                false
            );
            expect(matchesBearerAuthorization('')).toBe(false);
            expect(
                matchesApiAuthHeader({
                    headers: { Authorization: 'Bearer synthetic-access-token' },
                })
            ).toBe(true);
            expect(
                matchesApiAuthHeader({
                    headers: { Authorization: 'Basic abc' },
                })
            ).toBe(false);
        });

        it('does not return the success fixture for a wrong-shape token POST', async () => {
            nock(HUBAPI)
                .post('/oauth/2026-03/token', (body) =>
                    matchesTokenExchange({
                        method: 'POST',
                        url: TOKEN_ENDPOINT,
                        body,
                    })
                )
                .reply(200, tokenResponse);

            const https = require('https');
            const payload = new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: 'synthetic-client-id',
            }).toString();

            await expect(
                new Promise((resolve, reject) => {
                    const req = https.request(
                        {
                            hostname: 'api.hubapi.com',
                            path: '/oauth/2026-03/token',
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'Content-Length': Buffer.byteLength(payload),
                            },
                        },
                        (res) => resolve(res.statusCode)
                    );
                    req.on('error', reject);
                    req.write(payload);
                    req.end();
                })
            ).rejects.toThrow(/Nock|Disallowed net connect|not allowed/i);
        });

        it('pins the denied HubSpot host list used by fail-closed net-deny', () => {
            expect(DENIED_PROVIDER_HOSTS).toEqual([
                'api.hubapi.com',
                'app.hubspot.com',
            ]);
        });
    });

    describe('T-C4-12: deny and spy are distinct; both cover the pinned hosts', () => {
        it('rejects a deny-only, spy-only, or always-200 harness as insufficient', () => {
            expect(evaluateDenyAndSpy({ denyInstalled: true, spyInstalled: true })).toEqual({
                ok: true,
                reason: null,
            });
            expect(evaluateDenyAndSpy({ denyInstalled: true, spyInstalled: false }).ok).toBe(false);
            expect(evaluateDenyAndSpy({ denyInstalled: true, spyInstalled: false }).reason).toBe('deny-only');
            expect(evaluateDenyAndSpy({ denyInstalled: false, spyInstalled: true }).reason).toBe('spy-only');
            expect(evaluateDenyAndSpy({
                denyInstalled: true,
                spyInstalled: true,
                treatsAlways200AsDeny: true,
            }).reason).toBe('always-200-is-not-a-deny');
        });

        it('deny blocks and spy records an unmocked request to api.hubapi.com', async () => {
            const before = providerSpy.records.length;
            const api = new Api({
                ...apiParams,
                access_token: 'synthetic-access-token',
            });
            // Core wraps the nock net-connect denial in FetchError.
            await expect(api.getUserDetails()).rejects.toThrow(
                /Nock: Disallowed net connect|Disallowed net connect|An error ocurred while fetching|external resource/
            );
            const hits = providerSpy.records.slice(before).filter((r) => r.host === 'api.hubapi.com');
            expect(hits.length).toBeGreaterThan(0);
            expect(hits[0].method).toMatch(/GET|POST/i);
            expect(hits[0].path).toBeTruthy();
        });

        it('deny blocks and spy records an unmocked request to app.hubspot.com', async () => {
            const before = providerSpy.records.length;
            await expect(
                new Promise((resolve, reject) => {
                    const https = require('https');
                    const req = https.get(`${APP_HOST}/oauth/authorize`, resolve);
                    req.on('error', reject);
                })
            ).rejects.toThrow(/Nock: Disallowed net connect|not allowed/i);
            const hits = providerSpy.records.slice(before).filter((r) => r.host === 'app.hubspot.com');
            expect(hits.length).toBeGreaterThan(0);
            expect(hits[0].method).toMatch(/GET/i);
            expect(hits[0].path).toMatch(/oauth\/authorize/);
        });
    });
});

describe('erratum-2: runtime api.js digest', () => {
    it('the api.js loaded at runtime hashes to the pinned sha256', () => {
        const crypto = require('crypto');
        const fs = require('fs');
        const loaded = require.resolve('../api');
        expect(require('../api').Api).toBeDefined();
        const digest = crypto.createHash('sha256').update(fs.readFileSync(loaded)).digest('hex');
        expect(digest).toBe('af0b0bdc937820697a9bf158a6cc4f8a9e4fa22c96c535ee5af994720e4c3c60');
    });
});
