const { Api, DEFAULT_BASE_URL } = require('../api');

// Fully offline: stub low-level HTTP methods and assert on request options.
function makeApi(overrides = {}) {
    const api = new Api({
        bearer_token: 'test-secret',
        companyId: 42,
        integrationType: 'partner',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { companyId: 42, name: 'Acme' };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { ok: true };
    };
    return api;
}

describe('Stack Api', () => {
    describe('construction & auth', () => {
        it('sets the default base URL and Authorization header name', () => {
            const api = new Api({ bearer_token: 'abc' });
            expect(api.baseUrl).toBe(DEFAULT_BASE_URL);
            expect(api.api_key_name).toBe('Authorization');
            expect(api.bearer_token).toBe('abc');
            expect(api.api_key).toBe('abc');
        });

        it('accepts api_key / access_token / secret aliases and strips Bearer', () => {
            expect(new Api({ api_key: 'from-key' }).bearer_token).toBe(
                'from-key'
            );
            expect(new Api({ access_token: 'from-token' }).bearer_token).toBe(
                'from-token'
            );
            expect(new Api({ secret: 'from-secret' }).bearer_token).toBe(
                'from-secret'
            );
            expect(
                new Api({ bearer_token: 'Bearer already' }).bearer_token
            ).toBe('already');
        });

        it('honors base_url override', () => {
            const api = new Api({
                bearer_token: 'k',
                base_url: 'https://partner.example.com',
            });
            expect(api.baseUrl).toBe('https://partner.example.com');
        });

        it('adds Authorization Bearer auth header without persisting the prefix', async () => {
            const api = new Api({ bearer_token: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
            expect(api.bearer_token).toBe('secret');
            expect(api.api_key).toBe('secret');
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ bearer_token: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('authorize', () => {
        it('POSTs JSON to /integration/authorize', async () => {
            const api = makeApi();
            await api.authorize();
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                `${DEFAULT_BASE_URL}/integration/authorize`
            );
            expect(captured.body).toEqual({
                companyId: 42,
                token: 'test-secret',
                type: 'partner',
            });
            expect(captured.headers['Content-Type']).toBe('application/json');
        });

        it('allows overriding body fields', async () => {
            const api = makeApi();
            await api.authorize({
                companyId: 99,
                token: 'other',
                type: 'browser_extension',
            });
            expect(api._captured[0].body).toEqual({
                companyId: 99,
                token: 'other',
                type: 'browser_extension',
            });
        });
    });

    describe('browserExtensionAuth', () => {
        it('POSTs to /integration/authorize with type and extra params', async () => {
            const api = makeApi({ integrationType: 'browser_extension' });
            await api.browserExtensionAuth({ email: 'a@example.com' });
            const captured = api._captured[0];
            expect(captured.url).toBe(
                `${DEFAULT_BASE_URL}/integration/authorize`
            );
            expect(captured.body).toEqual({
                type: 'browser_extension',
                email: 'a@example.com',
            });
        });
    });

    describe('getSalesCycle', () => {
        it('hits GET /integration/salesCycle with company query', async () => {
            const api = makeApi();
            await api.getSalesCycle();
            expect(api._captured[0].url).toBe(
                `${DEFAULT_BASE_URL}/integration/salesCycle?companyId=42&type=partner`
            );
        });
    });

    describe('getCompany', () => {
        it('hits GET /integration/company with company query', async () => {
            const api = makeApi();
            await api.getCompany();
            expect(api._captured[0].url).toBe(
                `${DEFAULT_BASE_URL}/integration/company?companyId=42&type=partner`
            );
        });

        it('omits null company/type params', async () => {
            const api = makeApi({ companyId: null, integrationType: null });
            await api.getCompany();
            expect(api._captured[0].url).toBe(
                `${DEFAULT_BASE_URL}/integration/company`
            );
        });
    });

    describe('getTeamMembers', () => {
        it('hits GET /integration/company/members', async () => {
            const api = makeApi();
            await api.getTeamMembers();
            expect(api._captured[0].url).toBe(
                `${DEFAULT_BASE_URL}/integration/company/members?companyId=42&type=partner`
            );
        });
    });
});
