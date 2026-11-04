const crypto = require('crypto');
const { Api } = require('../api');
const {
    verifyGhlSignature,
    GHL_WEBHOOK_MAX_SKEW_SECONDS,
} = require('../extensions/webhooks/signature-verifier');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        locationId: 'loc_1',
        client_id: 'appid-suffix',
        redirect_uri: 'https://app.example/redirect/gohighlevel',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { contacts: [], opportunities: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'created_1' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 'updated_1' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('GoHighLevel Api', () => {
    describe('construction & auth', () => {
        it('sets the LeadConnector base URL and Marketplace authorize URL', () => {
            const api = new Api({
                access_token: 't',
                client_id: 'abc123-xyz',
                redirect_uri: 'https://app.example/redirect/gohighlevel',
            });
            expect(api.baseUrl).toBe('https://services.leadconnectorhq.com');
            expect(api.tokenUri).toBe(
                'https://services.leadconnectorhq.com/oauth/token'
            );
            expect(api.authorizationUri).toContain(
                'marketplace.gohighlevel.com/v2/oauth/chooselocation'
            );
            expect(api.authorizationUri).toContain('response_type=code');
            expect(api.authorizationUri).toContain('client_id=abc123-xyz');
            expect(api.authorizationUri).toContain('version_id=abc123');
            expect(api.apiVersion).toBe('2021-07-28');
        });

        it('adds Version header on authenticated requests', async () => {
            const api = new Api({ access_token: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Version).toBe('2021-07-28');
            expect(headers.Authorization).toMatch(/Bearer/);
        });

        it('_headers includes Version and JSON content type', () => {
            const api = new Api({ access_token: 't' });
            expect(api._headers()).toMatchObject({
                Version: '2021-07-28',
                'Content-Type': 'application/json',
                Accept: 'application/json',
            });
        });
    });

    describe('token exchange', () => {
        it('getTokenFromCode posts user_type=Location and no scope', async () => {
            const api = makeApi();
            api._post = async (options) => {
                api._captured.push(options);
                return {
                    access_token: 'a',
                    refresh_token: 'r',
                    locationId: 'loc_new',
                    expires_in: 86400,
                };
            };
            api.setTokens = async () => {};
            const res = await api.getTokenFromCode('auth-code');
            const body = api._captured[0].body;
            expect(body.get('grant_type')).toBe('authorization_code');
            expect(body.get('user_type')).toBe('Location');
            expect(body.get('code')).toBe('auth-code');
            expect(body.get('scope')).toBeNull();
            expect(res.locationId).toBe('loc_new');
            expect(api.locationId).toBe('loc_new');
        });

        it('getTokenFromCode rejects responses without locationId', async () => {
            const api = makeApi();
            api._post = async () => ({
                access_token: 'a',
                refresh_token: 'r',
                userType: 'Company',
            });
            await expect(api.getTokenFromCode('c')).rejects.toThrow(
                /no locationId/
            );
        });

        it('refreshAccessToken posts user_type=Location', async () => {
            const api = makeApi();
            api._post = async (options) => {
                api._captured.push(options);
                return {
                    access_token: 'a2',
                    refresh_token: 'r2',
                    locationId: 'loc_1',
                };
            };
            api.setTokens = async () => {};
            await api.refreshAccessToken({ refresh_token: 'old-r' });
            const body = api._captured[0].body;
            expect(body.get('grant_type')).toBe('refresh_token');
            expect(body.get('user_type')).toBe('Location');
            expect(body.get('refresh_token')).toBe('old-r');
        });
    });

    describe('identity', () => {
        it('getLocation hits GET /locations/{id}', async () => {
            const api = makeApi();
            await api.getLocation('loc_1');
            expect(api._captured[0].url).toBe(
                'https://services.leadconnectorhq.com/locations/loc_1'
            );
            expect(api._captured[0].headers.Version).toBe('2021-07-28');
        });

        it('listUsers / getUser', async () => {
            const api = makeApi();
            await api.listUsers();
            expect(api._captured[0].url).toContain('/users/');
            expect(api._captured[0].query.locationId).toBe('loc_1');
            await api.getUser('user_1');
            expect(api._captured[1].url).toBe(
                'https://services.leadconnectorhq.com/users/user_1'
            );
        });
    });

    describe('contacts', () => {
        it('list / get / create / update', async () => {
            const api = makeApi();
            await api.listContacts({ limit: 5 });
            expect(api._captured[0].url).toContain('/contacts/');
            expect(api._captured[0].query).toMatchObject({
                locationId: 'loc_1',
                limit: 5,
            });
            await api.getContact('c1');
            expect(api._captured[1].url).toBe(
                'https://services.leadconnectorhq.com/contacts/c1'
            );
            await api.createContact({ email: 'a@example.com' });
            expect(api._captured[2]).toMatchObject({
                method: 'POST',
                body: { locationId: 'loc_1', email: 'a@example.com' },
            });
            await api.updateContact('c1', { firstName: 'Ada' });
            expect(api._captured[3]).toMatchObject({
                method: 'PUT',
                body: { firstName: 'Ada' },
            });
        });

        it('getDuplicateContact and notes', async () => {
            const api = makeApi();
            await api.getDuplicateContact({ email: 'a@example.com' });
            expect(api._captured[0].url).toContain('/contacts/search/duplicate');
            await api.listContactNotes('c1');
            expect(api._captured[1].url).toContain('/contacts/c1/notes');
            await api.createContactNote('c1', { body: 'hello' });
            expect(api._captured[2].method).toBe('POST');
            await api.updateContactNote('c1', 'n1', { body: 'updated' });
            expect(api._captured[3].url).toContain('/contacts/c1/notes/n1');
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('businesses', () => {
        it('list / get / create / update', async () => {
            const api = makeApi();
            await api.listBusinesses();
            expect(api._captured[0].url).toContain('/businesses');
            await api.getBusiness('b1');
            expect(api._captured[1].url).toContain('/businesses/b1');
            await api.createBusiness({ name: 'Acme' });
            expect(api._captured[2].body).toMatchObject({
                locationId: 'loc_1',
                name: 'Acme',
            });
            await api.updateBusiness('b1', { name: 'Acme 2' });
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('opportunities', () => {
        it('listOpportunities hits /opportunities/search', async () => {
            const api = makeApi();
            await api.listOpportunities({ status: 'open', limit: 10 });
            expect(api._captured[0].url).toContain('/opportunities/search');
            expect(api._captured[0].query).toMatchObject({
                locationId: 'loc_1',
                status: 'open',
                limit: 10,
            });
        });

        it('get / create / update / status / pipelines', async () => {
            const api = makeApi();
            await api.getOpportunity('o1');
            expect(api._captured[0].url).toContain('/opportunities/o1');
            await api.createOpportunity({ name: 'Deal' });
            expect(api._captured[1].method).toBe('POST');
            await api.updateOpportunity('o1', { name: 'Deal 2' });
            expect(api._captured[2].method).toBe('PUT');
            await api.updateOpportunityStatus('o1', { status: 'won' });
            expect(api._captured[3].url).toContain('/opportunities/o1/status');
            await api.listPipelines();
            expect(api._captured[4].url).toContain('/opportunities/pipelines');
        });
    });

    describe('webhook signature', () => {
        const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
        const pemPublic = publicKey.export({ type: 'spki', format: 'pem' });

        beforeEach(() => {
            process.env.GOHIGHLEVEL_WEBHOOK_PUBLIC_KEY_ED25519 = pemPublic;
        });

        afterEach(() => {
            delete process.env.GOHIGHLEVEL_WEBHOOK_PUBLIC_KEY_ED25519;
        });

        it('accepts a valid Ed25519 signature within skew', () => {
            const body = {
                locationId: 'loc_1',
                type: 'ContactCreate',
                timestamp: new Date().toISOString(),
            };
            const raw = JSON.stringify(body);
            const sig = crypto
                .sign(null, Buffer.from(raw), privateKey)
                .toString('base64');
            expect(
                verifyGhlSignature({ 'x-ghl-signature': sig }, body, raw)
            ).toBe(true);
        });

        it('rejects missing signature, stale timestamp, or bad sig', () => {
            const body = {
                locationId: 'loc_1',
                timestamp: new Date().toISOString(),
            };
            expect(verifyGhlSignature({}, body)).toBe(false);

            const stale = {
                ...body,
                timestamp: new Date(
                    Date.now() - (GHL_WEBHOOK_MAX_SKEW_SECONDS + 10) * 1000
                ).toISOString(),
            };
            expect(
                verifyGhlSignature({ 'x-ghl-signature': 'abc' }, stale)
            ).toBe(false);

            expect(
                verifyGhlSignature(
                    { 'x-ghl-signature': Buffer.from('nope').toString('base64') },
                    body,
                    JSON.stringify(body)
                )
            ).toBe(false);
        });
    });
});
