const crypto = require('crypto');
const { Api } = require('../api');
const {
    verifyGustoSignature,
} = require('../extensions/webhooks/signature-verifier');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csec',
        redirect_uri: 'https://example.com/callback/gusto',
        access_token: 'atok',
        refresh_token: 'rtok',
        company_uuid: 'company-uuid-1',
        ...overrides,
    });
    api._captured = [];
    const record = (method) => async (options) => {
        api._captured.push({ method, ...options });
        return { ok: true };
    };
    api._get = record('GET');
    api._post = record('POST');
    api._put = record('PUT');
    api._delete = record('DELETE');
    return api;
}

describe('Gusto Api', () => {
    describe('construction & auth', () => {
        it('defaults to the production base URL and API version', () => {
            const api = new Api({ access_token: 't' });
            expect(api.baseUrl).toBe('https://api.gusto.com');
            expect(api.apiVersion).toBe('2026-06-15');
        });

        it('accepts baseUrl override for the demo environment', () => {
            const api = new Api({
                baseUrl: 'https://api.gusto-demo.com',
                access_token: 't',
            });
            expect(api.baseUrl).toBe('https://api.gusto-demo.com');
            expect(api.tokenUri).toBe('https://api.gusto-demo.com/oauth/token');
        });

        it('builds an authorize URI without a scope query param', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/cb',
                state: 'st',
            });
            const uri = decodeURIComponent(api.getAuthUri());
            expect(uri).toContain('https://api.gusto.com/oauth/authorize');
            expect(uri).toContain('client_id=cid');
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('state=st');
            expect(uri).not.toContain('scope=');
        });

        it('adds Bearer + X-Gusto-API-Version via addAuthHeaders', async () => {
            const api = new Api({
                access_token: 'secret',
                apiVersion: '2026-06-15',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
            expect(headers['X-Gusto-API-Version']).toBe('2026-06-15');
        });

        it('exchanges the auth code with a JSON token body', async () => {
            const api = makeApi({ access_token: null });
            api._post = async (options) => {
                api._captured.push({ method: 'POST', ...options });
                return {
                    access_token: 'new-a',
                    refresh_token: 'new-r',
                    expires_in: 7200,
                    token_type: 'bearer',
                };
            };
            api.setTokens = async (tokens) => {
                api.access_token = tokens.access_token;
                api.refresh_token = tokens.refresh_token;
            };
            await api.getTokenFromCode('auth-code');
            const call = api._captured[0];
            expect(call.method).toBe('POST');
            expect(call.url).toBe('https://api.gusto.com/oauth/token');
            expect(call.headers['Content-Type']).toBe('application/json');
            expect(call.body).toEqual({
                client_id: 'cid',
                client_secret: 'csec',
                redirect_uri: 'https://example.com/callback/gusto',
                code: 'auth-code',
                grant_type: 'authorization_code',
            });
            expect(api.access_token).toBe('new-a');
        });

        it('refreshes with a JSON body and grant_type refresh_token', async () => {
            const api = makeApi();
            api._post = async (options) => {
                api._captured.push({ method: 'POST', ...options });
                return {
                    access_token: 'rotated-a',
                    refresh_token: 'rotated-r',
                    expires_in: 7200,
                    token_type: 'bearer',
                };
            };
            api.setTokens = async (tokens) => {
                api.access_token = tokens.access_token;
                api.refresh_token = tokens.refresh_token;
            };
            await api.refreshAccessToken({ refresh_token: 'old-rt' });
            const call = api._captured[0];
            expect(call.method).toBe('POST');
            expect(call.url).toBe('https://api.gusto.com/oauth/token');
            expect(call.body.grant_type).toBe('refresh_token');
            expect(call.body.refresh_token).toBe('old-rt');
            expect(api.refresh_token).toBe('rotated-r');
        });
    });

    describe('identity & companies', () => {
        it('getTokenInfo hits GET /v1/token_info', async () => {
            const api = makeApi();
            await api.getTokenInfo();
            expect(api._captured[0]).toMatchObject({
                method: 'GET',
                url: 'https://api.gusto.com/v1/token_info',
            });
        });

        it('getCompany hits GET /v1/companies/{id}', async () => {
            const api = makeApi();
            await api.getCompany('co-1');
            expect(api._captured[0].url).toBe(
                'https://api.gusto.com/v1/companies/co-1'
            );
        });

        it('getCompany falls back to persisted company_uuid', async () => {
            const api = makeApi({ company_uuid: 'persisted-co' });
            await api.getCompany();
            expect(api._captured[0].url).toBe(
                'https://api.gusto.com/v1/companies/persisted-co'
            );
        });

        it('updateCompany PUTs JSON to /v1/companies/{id}', async () => {
            const api = makeApi();
            await api.updateCompany('co-1', { name: 'Acme', version: 'v1' });
            expect(api._captured[0]).toMatchObject({
                method: 'PUT',
                url: 'https://api.gusto.com/v1/companies/co-1',
                body: { name: 'Acme', version: 'v1' },
            });
            expect(api._captured[0].headers['Content-Type']).toBe(
                'application/json'
            );
        });
    });

    describe('employees', () => {
        it('listEmployees GETs /v1/companies/{id}/employees with query', async () => {
            const api = makeApi();
            await api.listEmployees('co-1', { page: 2, per: 50 });
            expect(api._captured[0]).toMatchObject({
                method: 'GET',
                url: 'https://api.gusto.com/v1/companies/co-1/employees',
                query: { page: 2, per: 50 },
            });
        });

        it('getEmployee GETs /v1/employees/{id}', async () => {
            const api = makeApi();
            await api.getEmployee('emp-1');
            expect(api._captured[0].url).toBe(
                'https://api.gusto.com/v1/employees/emp-1'
            );
        });

        it('createEmployee POSTs to /v1/companies/{id}/employees', async () => {
            const api = makeApi();
            await api.createEmployee('co-1', {
                first_name: 'Ada',
                last_name: 'Lovelace',
            });
            expect(api._captured[0]).toMatchObject({
                method: 'POST',
                url: 'https://api.gusto.com/v1/companies/co-1/employees',
                body: { first_name: 'Ada', last_name: 'Lovelace' },
            });
        });

        it('updateEmployee PUTs /v1/employees/{id}', async () => {
            const api = makeApi();
            await api.updateEmployee('emp-1', {
                version: 'abc',
                email: 'a@b.co',
            });
            expect(api._captured[0]).toMatchObject({
                method: 'PUT',
                url: 'https://api.gusto.com/v1/employees/emp-1',
                body: { version: 'abc', email: 'a@b.co' },
            });
        });
    });

    describe('payrolls', () => {
        it('listPayrolls GETs /v1/companies/{id}/payrolls', async () => {
            const api = makeApi();
            await api.listPayrolls('co-1', {
                processing_statuses: 'processed,unprocessed',
            });
            expect(api._captured[0]).toMatchObject({
                method: 'GET',
                url: 'https://api.gusto.com/v1/companies/co-1/payrolls',
            });
        });

        it('getPayroll GETs /v1/companies/{id}/payrolls/{payrollId}', async () => {
            const api = makeApi();
            await api.getPayroll('co-1', 'pay-9');
            expect(api._captured[0].url).toBe(
                'https://api.gusto.com/v1/companies/co-1/payrolls/pay-9'
            );
        });
    });

    describe('webhook subscriptions', () => {
        it('listWebhookSubscriptions uses system auth when set', async () => {
            const api = makeApi({ system_access_token: 'sys-tok' });
            const headers = await api.addSystemAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer sys-tok');
            await api.listWebhookSubscriptions();
            expect(api._captured[0].url).toBe(
                'https://api.gusto.com/v1/webhook_subscriptions'
            );
        });

        it('createWebhookSubscription POSTs url + subscription_types', async () => {
            const api = makeApi({ system_access_token: 'sys' });
            await api.createWebhookSubscription({
                url: 'https://hook.example/gusto',
                subscription_types: ['Company', 'Employee'],
            });
            expect(api._captured[0]).toMatchObject({
                method: 'POST',
                url: 'https://api.gusto.com/v1/webhook_subscriptions',
                body: {
                    url: 'https://hook.example/gusto',
                    subscription_types: ['Company', 'Employee'],
                },
            });
        });

        it('verifyWebhookSubscription PUTs verification_token', async () => {
            const api = makeApi({ system_access_token: 'sys' });
            await api.verifyWebhookSubscription('wh-1', {
                verification_token: 'tok',
            });
            expect(api._captured[0]).toMatchObject({
                method: 'PUT',
                url: 'https://api.gusto.com/v1/webhook_subscriptions/wh-1/verify',
                body: { verification_token: 'tok' },
            });
        });

        it('deleteWebhookSubscription DELETEs by uuid', async () => {
            const api = makeApi({ system_access_token: 'sys' });
            await api.deleteWebhookSubscription('wh-1');
            expect(api._captured[0]).toMatchObject({
                method: 'DELETE',
                url: 'https://api.gusto.com/v1/webhook_subscriptions/wh-1',
            });
        });
    });

    describe('verifyWebhookSignature', () => {
        it('accepts a matching HMAC-SHA256 of the raw body', () => {
            const token = 'verification-secret';
            const rawBody = '{"event_type":"employee.created"}';
            const signature = crypto
                .createHmac('sha256', token)
                .update(rawBody, 'utf8')
                .digest('hex');
            const result = verifyGustoSignature({
                rawBody,
                signature,
                verificationToken: token,
            });
            expect(result.valid).toBe(true);
        });

        it('rejects a bad signature', () => {
            const result = verifyGustoSignature({
                rawBody: '{}',
                signature: 'deadbeef',
                verificationToken: 'tok',
            });
            expect(result.valid).toBe(false);
        });
    });
});
