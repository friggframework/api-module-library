const { Api } = require('../api');

function makeApi() {
    const api = new Api({ api_key: 'test-key-123' });
    // Capture requests instead of hitting the network.
    api.sent = [];
    const record = (method) => async (options) => {
        api.sent.push({ method, ...options });
        return { ok: true };
    };
    api._get = record('GET');
    api._post = record('POST');
    api._patch = record('PATCH');
    api._delete = record('DELETE');
    return api;
}

describe('Reevo Api', () => {
    describe('auth', () => {
        it('uses the x-api-key header name', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.api_key_name).toBe('x-api-key');
            expect(api.api_key).toBe('abc');
        });

        it('injects the api key into request headers via addAuthHeaders', async () => {
            const api = new Api({ api_key: 'abc' });
            const headers = await api.addAuthHeaders({});
            expect(headers['x-api-key']).toBe('abc');
        });

        it('points at the Reevo public API base URL', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.baseUrl).toBe('https://api.reevo.ai/api/v1/public');
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ api_key: 'abc' }).isAuthenticated()).toBe(true);
            expect(new Api({ api_key: '' }).isAuthenticated()).toBe(false);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('endpoints', () => {
        it('upsertAccountContact posts to /account_contact with payload_type=json', async () => {
            const api = makeApi();
            await api.upsertAccountContact({ email: 'a@b.com' });
            const req = api.sent[0];
            expect(req.method).toBe('POST');
            expect(req.url).toBe(
                'https://api.reevo.ai/api/v1/public/account_contact'
            );
            expect(req.query).toEqual({ payload_type: 'json' });
            expect(req.body).toEqual({ email: 'a@b.com' });
        });

        it('createAccount posts to /accounts', async () => {
            const api = makeApi();
            await api.createAccount({ name: 'Acme' });
            expect(api.sent[0].url).toBe(
                'https://api.reevo.ai/api/v1/public/accounts'
            );
            expect(api.sent[0].method).toBe('POST');
        });

        it('updateAccount patches /accounts/{id}', async () => {
            const api = makeApi();
            await api.updateAccount('acc-1', { name: 'New' });
            expect(api.sent[0].method).toBe('PATCH');
            expect(api.sent[0].url).toBe(
                'https://api.reevo.ai/api/v1/public/accounts/acc-1'
            );
        });

        it('searchAccounts posts the body to /accounts/search', async () => {
            const api = makeApi();
            await api.searchAccounts({ domain_name: 'acme.com' });
            expect(api.sent[0].url).toBe(
                'https://api.reevo.ai/api/v1/public/accounts/search'
            );
            expect(api.sent[0].body).toEqual({ domain_name: 'acme.com' });
        });

        it('shiftOpportunityStage posts to the nested shift_stage path', async () => {
            const api = makeApi();
            await api.shiftOpportunityStage('opp-9', {
                target_stage_name: 'Won',
            });
            expect(api.sent[0].method).toBe('POST');
            expect(api.sent[0].url).toBe(
                'https://api.reevo.ai/api/v1/public/opportunities/opp-9/shift_stage'
            );
        });

        it('createManualActivity posts to /manual_activities', async () => {
            const api = makeApi();
            await api.createManualActivity({
                metadata: {
                    activity_time: '2026-08-19T00:00:00Z',
                    subject: 'Call',
                    description: 'Logged call',
                },
            });
            expect(api.sent[0].url).toBe(
                'https://api.reevo.ai/api/v1/public/manual_activities'
            );
        });

        it('testAuth performs a lightweight account search', async () => {
            const api = makeApi();
            await api.testAuth();
            expect(api.sent[0].method).toBe('POST');
            expect(api.sent[0].url).toBe(
                'https://api.reevo.ai/api/v1/public/accounts/search'
            );
        });
    });

    describe('retrieveAccountAndContact', () => {
        it('sends exactly one identifier as a query param', async () => {
            const api = makeApi();
            await api.retrieveAccountAndContact({ contact_email: 'a@b.com' });
            expect(api.sent[0].method).toBe('GET');
            expect(api.sent[0].url).toBe(
                'https://api.reevo.ai/api/v1/public/account_and_contact_retrieval'
            );
            expect(api.sent[0].query).toEqual({ contact_email: 'a@b.com' });
        });

        it('throws when no identifier is provided', async () => {
            const api = makeApi();
            await expect(api.retrieveAccountAndContact({})).rejects.toThrow(
                /exactly one/i
            );
        });

        it('throws when more than one identifier is provided', async () => {
            const api = makeApi();
            await expect(
                api.retrieveAccountAndContact({
                    contact_email: 'a@b.com',
                    account_domain: 'b.com',
                })
            ).rejects.toThrow(/exactly one/i);
        });
    });

    describe('getAuthorizationRequirements', () => {
        it('declares an apiKey requirement for api_key', () => {
            const api = new Api({ api_key: 'abc' });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('apiKey');
            expect(reqs.data.jsonSchema.required).toContain('api_key');
        });
    });
});
