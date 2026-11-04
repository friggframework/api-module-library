const { Api } = require('../api');
const {
    verifyPaychexApiKeyDelivery,
} = require('../extensions/webhooks/signature-verifier');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csec',
        access_token: 'atok',
        company_id: 'co-1',
        ...overrides,
    });
    api._captured = [];
    const record = (method) => async (options) => {
        api._captured.push({ method, ...options });
        return { ok: true };
    };
    api._get = record('GET');
    api._post = record('POST');
    api._patch = record('PATCH');
    api._delete = record('DELETE');
    return api;
}

describe('Paychex Api', () => {
    describe('construction & auth', () => {
        it('defaults to the production base URL and token URI', () => {
            const api = new Api({ access_token: 't' });
            expect(api.baseUrl).toBe('https://api.paychex.com');
            expect(api.tokenUri).toBe(
                'https://api.paychex.com/auth/oauth/v2/token'
            );
            expect(api.grant_type).toBe('client_credentials');
        });

        it('accepts baseUrl override', () => {
            const api = new Api({
                baseUrl: 'https://api.example-paychex.test',
                access_token: 't',
            });
            expect(api.baseUrl).toBe('https://api.example-paychex.test');
            expect(api.tokenUri).toBe(
                'https://api.example-paychex.test/auth/oauth/v2/token'
            );
        });

        it('exchanges client credentials with form-urlencoded body', async () => {
            const api = makeApi({ access_token: null });
            api._post = async (options) => {
                api._captured.push({ method: 'POST', ...options });
                return {
                    access_token: 'new-a',
                    expires_in: 600,
                    token_type: 'Bearer',
                    scope: 'oob',
                };
            };
            api.setTokens = async (tokens) => {
                api.access_token = tokens.access_token;
            };
            await api.getTokenFromClientCredentials();
            const call = api._captured[0];
            expect(call.method).toBe('POST');
            expect(call.url).toBe(
                'https://api.paychex.com/auth/oauth/v2/token'
            );
            expect(call.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(String(call.body)).toContain('grant_type=client_credentials');
            expect(String(call.body)).toContain('client_id=cid');
            expect(String(call.body)).toContain('client_secret=csec');
            expect(api.access_token).toBe('new-a');
        });

        it('returns oauth2 authorization requirements with client credentials fields', () => {
            const api = new Api({});
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.data.jsonSchema.required).toEqual(
                expect.arrayContaining(['client_id', 'client_secret'])
            );
        });
    });

    describe('companies', () => {
        it('listCompanies hits GET /companies', async () => {
            const api = makeApi();
            await api.listCompanies({ displayid: '09620579' });
            expect(api._captured[0]).toMatchObject({
                method: 'GET',
                url: 'https://api.paychex.com/companies',
                query: { displayid: '09620579' },
            });
        });

        it('getCompany hits GET /companies/{id}', async () => {
            const api = makeApi();
            await api.getCompany('co-99');
            expect(api._captured[0].url).toBe(
                'https://api.paychex.com/companies/co-99'
            );
        });

        it('getCompany falls back to persisted company_id', async () => {
            const api = makeApi({ company_id: 'persisted-co' });
            await api.getCompany();
            expect(api._captured[0].url).toBe(
                'https://api.paychex.com/companies/persisted-co'
            );
        });
    });

    describe('workers', () => {
        it('listCompanyWorkers hits GET /companies/{id}/workers', async () => {
            const api = makeApi();
            await api.listCompanyWorkers('co-1', { limit: 25, offset: 0 });
            expect(api._captured[0]).toMatchObject({
                method: 'GET',
                url: 'https://api.paychex.com/companies/co-1/workers',
                query: { limit: 25, offset: 0 },
            });
        });

        it('createCompanyWorkers posts with Paychex workers content type', async () => {
            const api = makeApi();
            await api.createCompanyWorkers('co-1', {
                workerType: 'EMPLOYEE',
                name: { givenName: 'Ada', familyName: 'Lovelace' },
            });
            const call = api._captured[0];
            expect(call.method).toBe('POST');
            expect(call.url).toBe(
                'https://api.paychex.com/companies/co-1/workers'
            );
            expect(call.headers['Content-Type']).toBe(
                'application/vnd.paychex.workers.v1+json'
            );
        });

        it('getWorker hits GET /workers/{workerId}', async () => {
            const api = makeApi();
            await api.getWorker('w-1');
            expect(api._captured[0].url).toBe(
                'https://api.paychex.com/workers/w-1'
            );
        });

        it('updateWorker patches with Paychex worker content type', async () => {
            const api = makeApi();
            await api.updateWorker('w-1', {
                employmentType: 'PART_TIME',
            });
            const call = api._captured[0];
            expect(call.method).toBe('PATCH');
            expect(call.url).toBe('https://api.paychex.com/workers/w-1');
            expect(call.headers['Content-Type']).toBe(
                'application/vnd.paychex.worker.v1+json'
            );
        });
    });

    describe('pay periods', () => {
        it('listCompanyPayPeriods hits GET /companies/{id}/payperiods', async () => {
            const api = makeApi();
            await api.listCompanyPayPeriods('co-1', { status: ['COMPLETED'] });
            expect(api._captured[0].url).toBe(
                'https://api.paychex.com/companies/co-1/payperiods'
            );
        });

        it('getCompanyPayPeriod hits GET /companies/{id}/payperiods/{payperiodId}', async () => {
            const api = makeApi();
            await api.getCompanyPayPeriod('co-1', 'pp-9');
            expect(api._captured[0].url).toBe(
                'https://api.paychex.com/companies/co-1/payperiods/pp-9'
            );
        });
    });

    describe('webhooks', () => {
        it('listWebhookDomains hits GET /management/domains', async () => {
            const api = makeApi();
            await api.listWebhookDomains();
            expect(api._captured[0].url).toBe(
                'https://api.paychex.com/management/domains'
            );
        });

        it('listWebhooks hits GET /management/hooks', async () => {
            const api = makeApi();
            await api.listWebhooks();
            expect(api._captured[0].url).toBe(
                'https://api.paychex.com/management/hooks'
            );
        });

        it('createWebhook posts to /management/hooks', async () => {
            const api = makeApi();
            await api.createWebhook({
                uri: 'https://example.com/hooks/paychex',
                authentication: { authType: 'NO_AUTH' },
                domains: ['WRKR_DEM'],
            });
            expect(api._captured[0]).toMatchObject({
                method: 'POST',
                url: 'https://api.paychex.com/management/hooks',
            });
        });

        it('getWebhook and deleteWebhook hit /management/hooks/{hookId}', async () => {
            const api = makeApi();
            await api.getWebhook('hook-1');
            await api.deleteWebhook('hook-1');
            expect(api._captured[0].method).toBe('GET');
            expect(api._captured[0].url).toBe(
                'https://api.paychex.com/management/hooks/hook-1'
            );
            expect(api._captured[1].method).toBe('DELETE');
        });

        it('verifyWebhookDelivery accepts a matching API key header', () => {
            expect(
                verifyPaychexApiKeyDelivery({
                    headers: { 'x-api-key': 'secret' },
                    expectedApiKey: 'secret',
                })
            ).toEqual({ valid: true });
            expect(
                verifyPaychexApiKeyDelivery({
                    headers: { 'x-api-key': 'wrong' },
                    expectedApiKey: 'secret',
                }).valid
            ).toBe(false);
        });
    });
});
