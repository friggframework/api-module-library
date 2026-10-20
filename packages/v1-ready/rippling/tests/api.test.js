const { Api, DEFAULT_API_VERSION } = require('../api');

// Fully offline: stub low-level HTTP and assert on constructed requests.
function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://example.com/redirect/rippling',
        scope: 'companies.read',
        app_name: 'TestApp',
        access_token: 'tok',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { results: [], next_link: null };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'created' };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { id: 'updated' };
    };
    return api;
}

describe('Rippling Api', () => {
    describe('construction & auth', () => {
        it('sets REST base URL, platform host, token URI, and API version', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                app_name: 'PortalTest',
            });
            expect(api.baseUrl).toBe('https://rest.ripplingapis.com');
            expect(api.platformBaseUrl).toBe('https://api.rippling.com');
            expect(api.tokenUri).toBe(
                'https://api.rippling.com/api/o/token/'
            );
            expect(api.apiVersion).toBe(DEFAULT_API_VERSION);
            expect(api.authorizationUri).toBe(
                'https://app.rippling.com/apps/PLATFORM/PortalTest/authorize'
            );
        });

        it('setAppName rebuilds the authorize URL', () => {
            const api = new Api({ app_name: 'A' });
            api.setAppName('B');
            expect(api.authorizationUri).toBe(
                'https://app.rippling.com/apps/PLATFORM/B/authorize'
            );
        });

        it('adds Bearer + Rippling-Api-Version headers', async () => {
            const api = new Api({
                access_token: 'secret',
                api_version: '2024-08-01',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
            expect(headers['Rippling-Api-Version']).toBe('2024-08-01');
            expect(headers.Accept).toBe('application/json');
        });

        it('getAuthorizationRequirements exposes oauth2 form fields', () => {
            const api = new Api({ app_name: 'X' });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('/apps/PLATFORM/X/authorize');
            expect(reqs.data.jsonSchema.required).toEqual(
                expect.arrayContaining([
                    'client_id',
                    'client_secret',
                    'app_name',
                ])
            );
        });

        it('getTokenFromCode delegates to Basic-auth token exchange', async () => {
            const api = makeApi();
            api.getTokenFromCodeBasicAuthHeader = jest
                .fn()
                .mockResolvedValue({ access_token: 'a' });
            await api.getTokenFromCode('auth-code');
            expect(api.getTokenFromCodeBasicAuthHeader).toHaveBeenCalledWith(
                'auth-code'
            );
        });

        it('refreshAccessToken POSTs form body with Basic auth', async () => {
            const api = makeApi({
                client_id: 'id1',
                client_secret: 'sec1',
                refresh_token: 'r1',
            });
            api.setTokens = jest.fn().mockResolvedValue(undefined);
            await api.refreshAccessToken({ refresh_token: 'r1' });
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.rippling.com/api/o/token/'
            );
            expect(captured.headers.Authorization).toBe(
                `Basic ${Buffer.from('id1:sec1').toString('base64')}`
            );
            expect(captured.body.get('grant_type')).toBe('refresh_token');
            expect(captured.body.get('refresh_token')).toBe('r1');
        });
    });

    describe('companies', () => {
        it('listCompanies hits GET /companies/', async () => {
            const api = makeApi();
            await api.listCompanies({ limit: 1 });
            expect(api._captured[0].url).toBe(
                'https://rest.ripplingapis.com/companies/?limit=1'
            );
        });
    });

    describe('workers', () => {
        it('listWorkers hits GET /workers/', async () => {
            const api = makeApi();
            await api.listWorkers({ expand: 'user', limit: 25 });
            const { url } = api._captured[0];
            expect(url).toContain(
                'https://rest.ripplingapis.com/workers/'
            );
            expect(url).toContain('expand=user');
            expect(url).toContain('limit=25');
        });

        it('getWorker hits GET /workers/{id}/', async () => {
            const api = makeApi();
            await api.getWorker('w123');
            expect(api._captured[0].url).toBe(
                'https://rest.ripplingapis.com/workers/w123/'
            );
        });
    });

    describe('users', () => {
        it('listUsers hits GET /users/', async () => {
            const api = makeApi();
            await api.listUsers();
            expect(api._captured[0].url).toBe(
                'https://rest.ripplingapis.com/users/'
            );
        });

        it('getUser hits GET /users/{id}/', async () => {
            const api = makeApi();
            await api.getUser('u9');
            expect(api._captured[0].url).toBe(
                'https://rest.ripplingapis.com/users/u9/'
            );
        });
    });

    describe('departments', () => {
        it('listDepartments / getDepartment use documented paths', async () => {
            const api = makeApi();
            await api.listDepartments();
            await api.getDepartment('d1');
            expect(api._captured[0].url).toBe(
                'https://rest.ripplingapis.com/departments/'
            );
            expect(api._captured[1].url).toBe(
                'https://rest.ripplingapis.com/departments/d1/'
            );
        });

        it('createDepartment POSTs JSON body', async () => {
            const api = makeApi();
            const body = { name: 'Engineering' };
            await api.createDepartment(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://rest.ripplingapis.com/departments/'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateDepartment PATCHes /departments/{id}/', async () => {
            const api = makeApi();
            await api.updateDepartment('d1', { name: 'Eng' });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://rest.ripplingapis.com/departments/d1/'
            );
        });
    });

    describe('work locations', () => {
        it('list/get/create/update hit documented paths', async () => {
            const api = makeApi();
            await api.listWorkLocations();
            await api.getWorkLocation('wl1');
            await api.createWorkLocation({
                name: 'HQ',
                address: { country: 'US' },
            });
            await api.updateWorkLocation('wl1', { name: 'HQ2' });
            expect(api._captured[0].url).toBe(
                'https://rest.ripplingapis.com/work-locations/'
            );
            expect(api._captured[1].url).toBe(
                'https://rest.ripplingapis.com/work-locations/wl1/'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PATCH');
        });
    });

    describe('draft hires', () => {
        it('createDraftHires POSTs /draft-hires/', async () => {
            const api = makeApi();
            const body = { draft_hires: [] };
            await api.createDraftHires(body);
            expect(api._captured[0].url).toBe(
                'https://rest.ripplingapis.com/draft-hires/'
            );
            expect(api._captured[0].body).toEqual(body);
        });
    });

    describe('markAppInstalled', () => {
        it('POSTs the platform host path (not rest.ripplingapis.com)', async () => {
            const api = makeApi();
            await api.markAppInstalled();
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://api.rippling.com/platform/api/mark_app_installed'
            );
        });
    });
});
