const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        access_token: 'tok',
        tenant_alias: 'gms',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { total: 0, data: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'evt_1' };
    };
    // Skip token refresh during offline tests when access_token is present.
    api.ensureAccessToken = async () => api.access_token;
    return api;
}

describe('Workday Api', () => {
    describe('construction & auth', () => {
        it('defaults to Extend API Gateway common/v1 baseUrl', () => {
            const api = new Api({});
            expect(api.baseUrl).toBe('https://api.workday.com/common/v1');
            expect(api.staffingBaseUrl).toBe(
                'https://api.workday.com/staffing/v1'
            );
            expect(api.absenceBaseUrl).toBe(
                'https://api.workday.com/absenceManagement/v5'
            );
            expect(api.tokenUri).toBe('https://auth.api.workday.com/v1/token');
            expect(api.auth_mode).toBe('extend');
        });

        it('builds tenanted Integrations endpoints from hostname + tenant', () => {
            const api = new Api({
                auth_mode: 'integrations',
                tenant_hostname: 'wd2-impl-services1.workday.com',
                tenant_alias: 'gms',
            });
            expect(api.tokenUri).toBe(
                'https://wd2-impl-services1.workday.com/ccx/oauth2/gms/token'
            );
            expect(api.baseUrl).toBe(
                'https://wd2-impl-services1.workday.com/api/common/v1/gms'
            );
            expect(api.staffingBaseUrl).toBe(
                'https://wd2-impl-services1.workday.com/api/staffing/v1/gms'
            );
            expect(api.absenceBaseUrl).toBe(
                'https://wd2-impl-services1.workday.com/api/absenceManagement/v5/gms'
            );
        });

        it('uses ID Authorization scheme for Extend token requests', () => {
            const api = new Api({
                client_id: 'abc',
                client_secret: 'xyz',
                auth_mode: 'extend',
            });
            const expected = `ID ${Buffer.from('abc:xyz').toString('base64')}`;
            expect(api._clientCredentialsHeader()).toBe(expected);
        });

        it('uses Basic Authorization scheme for Integrations token requests', () => {
            const api = new Api({
                client_id: 'abc',
                client_secret: 'xyz',
                auth_mode: 'integrations',
            });
            const expected = `Basic ${Buffer.from('abc:xyz').toString('base64')}`;
            expect(api._clientCredentialsHeader()).toBe(expected);
        });

        it('reports authenticated with refresh_token or extend client credentials', () => {
            expect(
                new Api({ refresh_token: 'r' }).isAuthenticated()
            ).toBe(true);
            expect(
                new Api({
                    client_id: 'c',
                    client_secret: 's',
                    tenant_alias: 't',
                    auth_mode: 'extend',
                }).isAuthenticated()
            ).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });

        it('exposes an apiKey-shaped authorization form', () => {
            const reqs = new Api({}).getAuthorizationRequirements();
            expect(reqs.type).toBeDefined();
            expect(reqs.data.jsonSchema.required).toEqual(
                expect.arrayContaining([
                    'client_id',
                    'client_secret',
                    'tenant_alias',
                    'auth_mode',
                ])
            );
        });
    });

    describe('token exchange', () => {
        it('getTokenFromRefreshToken posts form body with grant_type=refresh_token', async () => {
            const api = makeApi({ refresh_token: 'rtok' });
            api.ensureAccessToken = Api.prototype.ensureAccessToken.bind(api);
            api.access_token = null;
            api.setTokens = async (response) => {
                api.access_token = response.access_token;
            };
            api._post = async (options) => {
                api._captured.push(options);
                return {
                    access_token: 'new',
                    refresh_token: 'newrt',
                    token_type: 'Bearer',
                };
            };
            await api.getTokenFromRefreshToken();
            const req = api._captured[0];
            expect(req.url).toBe('https://auth.api.workday.com/v1/token');
            expect(req.headers.Authorization).toMatch(/^ID /);
            expect(req.body.get('grant_type')).toBe('refresh_token');
            expect(req.body.get('refresh_token')).toBe('rtok');
        });

        it('getTokenFromClientCredentials includes tenant_alias', async () => {
            const api = makeApi({ refresh_token: null, tenant_alias: 'gms' });
            api.setTokens = async (response) => {
                api.access_token = response.access_token;
            };
            api._post = async (options) => {
                api._captured.push(options);
                return { access_token: 'cc', token_type: 'Bearer' };
            };
            await api.getTokenFromClientCredentials();
            const req = api._captured[0];
            expect(req.body.get('grant_type')).toBe('client_credentials');
            expect(req.body.get('tenant_alias')).toBe('gms');
        });
    });

    describe('workers', () => {
        it('listWorkers hits GET /workers', async () => {
            const api = makeApi();
            await api.listWorkers({ limit: 5, offset: 10, search: 'log' });
            expect(api._captured[0].url).toBe(
                'https://api.workday.com/common/v1/workers?limit=5&offset=10&search=log'
            );
        });

        it('getWorker hits GET /workers/{id}', async () => {
            const api = makeApi();
            await api.getWorker('me', { view: 'workerProfile' });
            expect(api._captured[0].url).toBe(
                'https://api.workday.com/common/v1/workers/me?view=workerProfile'
            );
        });

        it('getCurrentWorker is an alias for getWorker(me)', async () => {
            const api = makeApi();
            await api.getCurrentWorker();
            expect(api._captured[0].url).toBe(
                'https://api.workday.com/common/v1/workers/me'
            );
        });
    });

    describe('organizations', () => {
        it('listSupervisoryOrganizations hits the collection path', async () => {
            const api = makeApi();
            await api.listSupervisoryOrganizations({ limit: 20 });
            expect(api._captured[0].url).toBe(
                'https://api.workday.com/common/v1/supervisoryOrganizations?limit=20'
            );
        });

        it('listSupervisoryOrganizationWorkers nests under the org id', async () => {
            const api = makeApi();
            await api.listSupervisoryOrganizationWorkers('org1');
            expect(api._captured[0].url).toBe(
                'https://api.workday.com/common/v1/supervisoryOrganizations/org1/workers'
            );
        });
    });

    describe('staffing job changes', () => {
        it('createJobChange posts to staffing base', async () => {
            const api = makeApi();
            const body = {
                date: '2020-07-30',
                reason: { id: 'reason1' },
            };
            await api.createJobChange('worker1', body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.workday.com/staffing/v1/workers/worker1/jobChanges'
            );
            expect(captured.body).toEqual(body);
        });

        it('submitJobChange posts to jobChanges/{id}/submit', async () => {
            const api = makeApi();
            await api.submitJobChange('jc1', {});
            expect(api._captured[0].url).toBe(
                'https://api.workday.com/staffing/v1/jobChanges/jc1/submit'
            );
        });
    });

    describe('absence', () => {
        it('listEligibleAbsenceTypes uses absence base', async () => {
            const api = makeApi();
            await api.listEligibleAbsenceTypes('w1');
            expect(api._captured[0].url).toBe(
                'https://api.workday.com/absenceManagement/v5/workers/w1/eligibleAbsenceTypes'
            );
        });

        it('requestTimeOff posts to requestTimeOff', async () => {
            const api = makeApi();
            await api.requestTimeOff('w1', { days: [] });
            expect(api._captured[0].url).toBe(
                'https://api.workday.com/absenceManagement/v5/workers/w1/requestTimeOff'
            );
        });

        it('listBalances hits /balances', async () => {
            const api = makeApi();
            await api.listBalances();
            expect(api._captured[0].url).toBe(
                'https://api.workday.com/absenceManagement/v5/balances'
            );
        });
    });
});
