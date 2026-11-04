const {
    Api,
    PRODUCTION_BASE_URL,
    PRODUCTION_TOKEN_URI,
    SANDBOX_BASE_URL,
    SANDBOX_TOKEN_URI,
    WEBLINK_SCOPE,
} = require('../api');

// Fully offline: stub low-level HTTP and assert on constructed requests.
function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        company_id: 'A12345',
        access_token: 'tok',
        accessTokenExpire: new Date(Date.now() + 60 * 60 * 1000),
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return [];
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { access_token: 'new-tok', expires_in: 3600, token_type: 'Bearer' };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return {};
    };
    return api;
}

describe('Paylocity Api', () => {
    describe('construction & auth', () => {
        it('defaults to production Weblink hosts and WebLinkAPI scope', () => {
            const api = new Api({});
            expect(api.baseUrl).toBe(PRODUCTION_BASE_URL);
            expect(api.tokenUri).toBe(PRODUCTION_TOKEN_URI);
            expect(api.scope).toBe(WEBLINK_SCOPE);
            expect(api.grant_type).toBe('client_credentials');
            expect(api.environment).toBe('production');
        });

        it('setEnvironment switches sandbox hosts', () => {
            const api = new Api({});
            api.setEnvironment('sandbox');
            expect(api.environment).toBe('sandbox');
            expect(api.baseUrl).toBe(SANDBOX_BASE_URL);
            expect(api.tokenUri).toBe(SANDBOX_TOKEN_URI);
        });

        it('honors base_url and token_uri overrides', () => {
            const api = new Api({
                base_url: 'https://example.test/api/v2',
                token_uri: 'https://example.test/token',
            });
            expect(api.baseUrl).toBe('https://example.test/api/v2');
            expect(api.tokenUri).toBe('https://example.test/token');
        });

        it('getAuthorizationRequirements exposes oauth2 form fields', () => {
            const api = new Api({});
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.data.jsonSchema.required).toEqual(
                expect.arrayContaining([
                    'client_id',
                    'client_secret',
                    'company_id',
                ])
            );
        });

        it('getTokenFromClientCredentials POSTs form-urlencoded with WebLinkAPI scope', async () => {
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
            expect(captured.body.get('scope')).toBe(WEBLINK_SCOPE);
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
    });

    describe('employees', () => {
        it('listEmployees hits GET /companies/{companyId}/employees', async () => {
            const api = makeApi();
            await api.listEmployees('A12345', { pagesize: 10, pagenumber: 1 });
            expect(api._captured[0].method).toBe('GET');
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/companies/A12345/employees`
            );
            expect(api._captured[0].query).toEqual({
                pagesize: 10,
                pagenumber: 1,
            });
        });

        it('listEmployees uses api.company_id when called with only query params', async () => {
            const api = makeApi({ company_id: 'B42' });
            await api.listEmployees({ pagesize: 5 });
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/companies/B42/employees`
            );
            expect(api._captured[0].query.pagesize).toBe(5);
        });

        it('listEmployees throws without a company id', async () => {
            const api = makeApi({ company_id: null });
            await expect(api.listEmployees({})).rejects.toThrow(/companyId/i);
        });

        it('getEmployee hits GET /companies/{companyId}/employees/{employeeId}', async () => {
            const api = makeApi();
            await api.getEmployee('A12345', 'E9');
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/companies/A12345/employees/E9`
            );
        });

        it('getEmployee(employeeId) uses api.company_id', async () => {
            const api = makeApi({ company_id: 'A12345' });
            await api.getEmployee('E9');
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/companies/A12345/employees/E9`
            );
        });

        it('createEmployee POSTs the employee body', async () => {
            const api = makeApi();
            const body = { firstName: 'Jane', lastName: 'Doe' };
            await api.createEmployee('A12345', body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/companies/A12345/employees`
            );
            expect(api._captured[0].body).toEqual(body);
            expect(api._captured[0].headers['Content-Type']).toBe(
                'application/json'
            );
        });

        it('updateEmployee PATCHes the employee body', async () => {
            const api = makeApi();
            const body = {
                status: { employeeStatus: 'T', effectiveDate: '10/20/2026' },
            };
            await api.updateEmployee('A12345', 'E9', body);
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/companies/A12345/employees/E9`
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateEmployee(employeeId, body) uses api.company_id', async () => {
            const api = makeApi({ company_id: 'A12345' });
            await api.updateEmployee('E9', { firstName: 'Jo' });
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/companies/A12345/employees/E9`
            );
        });
    });

    describe('company codes & openapi', () => {
        it('listCompanyCodes hits GET /companies/{companyId}/codes/{codeResource}', async () => {
            const api = makeApi();
            await api.listCompanyCodes('A12345', 'costcenter1');
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/companies/A12345/codes/costcenter1`
            );
        });

        it('listCompanyCodes(codeResource) uses api.company_id', async () => {
            const api = makeApi({ company_id: 'A12345' });
            await api.listCompanyCodes('positions');
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/companies/A12345/codes/positions`
            );
        });

        it('getCompanyOpenApi hits GET /companies/{companyId}/openapi', async () => {
            const api = makeApi();
            await api.getCompanyOpenApi('A12345');
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/companies/A12345/openapi`
            );
        });
    });
});
