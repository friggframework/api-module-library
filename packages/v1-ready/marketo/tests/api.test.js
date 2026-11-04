const { Api, DEFAULT_MUNCHKIN_ID } = require('../api');

// Fully offline: stub _get/_post/_delete and assert on constructed requests.
function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        access_token: 'tok',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { success: true, result: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { success: true, result: [] };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return { success: true, result: [] };
    };
    return api;
}

describe('Marketo Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to the placeholder munchkin REST host', () => {
            const api = new Api({});
            expect(api.munchkin_id).toBe(DEFAULT_MUNCHKIN_ID);
            expect(api.baseUrl).toBe(
                `https://${DEFAULT_MUNCHKIN_ID}.mktorest.com/rest`
            );
            expect(api.tokenUri).toBe(
                `https://${DEFAULT_MUNCHKIN_ID}.mktorest.com/identity/oauth/token`
            );
            expect(api.grant_type).toBe('client_credentials');
        });

        it('honors munchkin_id when building hosts', () => {
            const api = new Api({ munchkin_id: '123-ABC-456' });
            expect(api.baseUrl).toBe(
                'https://123-ABC-456.mktorest.com/rest'
            );
            expect(api.tokenUri).toBe(
                'https://123-ABC-456.mktorest.com/identity/oauth/token'
            );
        });

        it('honors a base_url override', () => {
            const api = new Api({
                base_url: 'https://example.test/rest',
                munchkin_id: 'ignored-for-base',
            });
            expect(api.baseUrl).toBe('https://example.test/rest');
        });

        it('setMunchkinId rebuilds REST and identity URLs', () => {
            const api = new Api({});
            api.setMunchkinId('999-ZZZ-999');
            expect(api.munchkin_id).toBe('999-ZZZ-999');
            expect(api.baseUrl).toBe(
                'https://999-ZZZ-999.mktorest.com/rest'
            );
            expect(api.tokenUri).toBe(
                'https://999-ZZZ-999.mktorest.com/identity/oauth/token'
            );
        });

        it('getAuthorizationRequirements exposes a form for munchkin + client credentials', () => {
            const api = new Api({});
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.data.jsonSchema.required).toEqual(
                expect.arrayContaining([
                    'munchkin_id',
                    'client_id',
                    'client_secret',
                ])
            );
            expect(reqs.data.uiSchema.client_secret['ui:widget']).toBe(
                'password'
            );
        });

        it('getTokenFromClientCredentials GETs the identity token URL with query params', async () => {
            const api = makeApi({
                munchkin_id: '123-ABC-456',
                client_id: 'my-id',
                client_secret: 'my-secret',
            });
            api.setTokens = async () => {};
            await api.getTokenFromClientCredentials();
            const captured = api._captured[0];
            expect(captured.method).toBe('GET');
            expect(captured.url).toBe(
                'https://123-ABC-456.mktorest.com/identity/oauth/token'
            );
            expect(captured.query).toEqual({
                grant_type: 'client_credentials',
                client_id: 'my-id',
                client_secret: 'my-secret',
            });
        });

        it('checkExpired detects Marketo 601/602/603 bodies', () => {
            const api = new Api({});
            expect(
                api.checkExpired({
                    success: false,
                    errors: [{ code: '602', message: 'expired' }],
                })
            ).toBe(true);
            expect(api.checkExpired({ success: true, result: [] })).toBe(
                false
            );
        });
    });

    describe('leads', () => {
        it('getLeadById hits GET /v1/lead/{id}.json', async () => {
            const api = makeApi();
            await api.getLeadById(42, { fields: 'email,firstName' });
            expect(api._captured[0].url).toBe(
                `https://${DEFAULT_MUNCHKIN_ID}.mktorest.com/rest/v1/lead/42.json`
            );
            expect(api._captured[0].query.fields).toBe('email,firstName');
        });

        it('getLeadsByFilterType joins array filterValues', async () => {
            const api = makeApi();
            await api.getLeadsByFilterType({
                filterType: 'email',
                filterValues: ['a@x.com', 'b@x.com'],
                fields: ['id', 'email'],
            });
            const { url, query } = api._captured[0];
            expect(url).toBe(
                `https://${DEFAULT_MUNCHKIN_ID}.mktorest.com/rest/v1/leads.json`
            );
            expect(query.filterType).toBe('email');
            expect(query.filterValues).toBe('a@x.com,b@x.com');
            expect(query.fields).toBe('id,email');
        });

        it('syncLeads POSTs the body to /v1/leads.json', async () => {
            const api = makeApi();
            const body = {
                action: 'createOnly',
                lookupField: 'email',
                input: [{ email: 'a@x.com', firstName: 'A' }],
            };
            await api.syncLeads(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                `https://${DEFAULT_MUNCHKIN_ID}.mktorest.com/rest/v1/leads.json`
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('deleteLeads POSTs to /v1/leads/delete.json', async () => {
            const api = makeApi();
            const body = { input: [{ id: 1 }, { id: 2 }] };
            await api.deleteLeads(body);
            expect(api._captured[0].url).toBe(
                `https://${DEFAULT_MUNCHKIN_ID}.mktorest.com/rest/v1/leads/delete.json`
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('describeLeads hits describe2', async () => {
            const api = makeApi();
            await api.describeLeads();
            expect(api._captured[0].url).toBe(
                `https://${DEFAULT_MUNCHKIN_ID}.mktorest.com/rest/v1/leads/describe2.json`
            );
        });
    });

    describe('lists & membership', () => {
        it('getLists hits GET /v1/lists.json', async () => {
            const api = makeApi();
            await api.getLists({ name: 'Seed' });
            expect(api._captured[0].url).toBe(
                `https://${DEFAULT_MUNCHKIN_ID}.mktorest.com/rest/v1/lists.json`
            );
            expect(api._captured[0].query.name).toBe('Seed');
        });

        it('getListById hits GET /v1/lists/{id}.json', async () => {
            const api = makeApi();
            await api.getListById(1021);
            expect(api._captured[0].url).toBe(
                `https://${DEFAULT_MUNCHKIN_ID}.mktorest.com/rest/v1/lists/1021.json`
            );
        });

        it('getLeadsByListId hits list members path', async () => {
            const api = makeApi();
            await api.getLeadsByListId(10, { batchSize: 50 });
            expect(api._captured[0].url).toBe(
                `https://${DEFAULT_MUNCHKIN_ID}.mktorest.com/rest/v1/lists/10/leads.json`
            );
            expect(api._captured[0].query.batchSize).toBe(50);
        });

        it('addToList POSTs with repeated id query params', async () => {
            const api = makeApi();
            await api.addToList(10, [1, 2]);
            const { method, url } = api._captured[0];
            expect(method).toBe('POST');
            expect(url).toContain(
                `/rest/v1/lists/10/leads.json?id=1&id=2`
            );
        });

        it('removeFromList DELETEs with repeated id query params', async () => {
            const api = makeApi();
            await api.removeFromList(10, [3]);
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toContain(
                `/rest/v1/lists/10/leads.json?id=3`
            );
        });

        it('isMemberOfList GETs ismember with repeated ids', async () => {
            const api = makeApi();
            await api.isMemberOfList(10, [7, 8]);
            expect(api._captured[0].url).toContain(
                `/rest/v1/lists/10/leads/ismember.json?id=7&id=8`
            );
        });
    });
});
