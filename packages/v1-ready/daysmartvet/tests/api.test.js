const {
    Api,
    PRODUCTION_BASE_URL,
    SANDBOX_BASE_URL,
    API_SERVICE_SCOPE,
} = require('../api');

// Fully offline: stub low-level HTTP and assert on constructed requests.
function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        api_key: 'clinic-key-1',
        access_token: 'tok',
        accessTokenExpire: new Date(Date.now() + 60 * 60 * 1000),
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { response: { resources: [] } };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { access_token: 'new-tok', expires_in: 3600, token_type: 'Bearer' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { response: { message: { code: 200 } } };
    };
    return api;
}

describe('DaySmart Vet Api', () => {
    describe('construction & auth', () => {
        it('defaults to production hosts and APIService scope', () => {
            const api = new Api({});
            expect(api.baseUrl).toBe(PRODUCTION_BASE_URL);
            expect(api.tokenUri).toBe(`${PRODUCTION_BASE_URL}/oauth/access_token`);
            expect(api.scope).toBe(API_SERVICE_SCOPE);
            expect(api.grant_type).toBe('client_credentials');
            expect(api.environment).toBe('production');
        });

        it('setEnvironment switches sandbox hosts', () => {
            const api = new Api({});
            api.setEnvironment('sandbox');
            expect(api.environment).toBe('sandbox');
            expect(api.baseUrl).toBe(SANDBOX_BASE_URL);
            expect(api.tokenUri).toBe(`${SANDBOX_BASE_URL}/oauth/access_token`);
        });

        it('honors base_url and token_uri overrides', () => {
            const api = new Api({
                base_url: 'https://example.test/api',
                token_uri: 'https://example.test/oauth/access_token',
            });
            expect(api.baseUrl).toBe('https://example.test/api');
            expect(api.tokenUri).toBe('https://example.test/oauth/access_token');
        });

        it('getAuthorizationRequirements exposes oauth2 form fields', () => {
            const api = new Api({});
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.data.jsonSchema.required).toEqual(
                expect.arrayContaining([
                    'client_id',
                    'client_secret',
                    'api_key',
                ])
            );
        });

        it('addAuthHeaders sets x-api-key to client_secret', async () => {
            const api = new Api({
                client_secret: 'sec',
                access_token: 'tok',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers['x-api-key']).toBe('sec');
            expect(headers.Authorization).toMatch(/Bearer\s+tok/i);
        });

        it('getTokenFromClientCredentials POSTs form-urlencoded with APIService scope', async () => {
            const api = makeApi({
                client_id: 'my-id',
                client_secret: 'my-secret',
            });
            api.setTokens = async () => {};
            await api.getTokenFromClientCredentials();
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                `${PRODUCTION_BASE_URL}/oauth/access_token`
            );
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(captured.headers['x-api-key']).toBe('my-secret');
            expect(captured.body).toBeInstanceOf(URLSearchParams);
            expect(captured.body.get('grant_type')).toBe('client_credentials');
            expect(captured.body.get('client_id')).toBe('my-id');
            expect(captured.body.get('client_secret')).toBe('my-secret');
            expect(captured.body.get('scope')).toBe(API_SERVICE_SCOPE);
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

        it('throws when building a clinic path without api_key', () => {
            const api = new Api({
                client_id: 'a',
                client_secret: 'b',
                access_token: 't',
                accessTokenExpire: new Date(Date.now() + 3600000),
            });
            expect(() => api.URLs.clinic()).toThrow(/api_key/i);
        });
    });

    describe('clinic', () => {
        it('getClinic hits GET /api/1.0.0/{apiKey}/clinic', async () => {
            const api = makeApi();
            await api.getClinic();
            expect(api._captured[0].method).toBe('GET');
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/api/1.0.0/clinic-key-1/clinic`
            );
        });
    });

    describe('clients', () => {
        it('listClients hits GET /clients with pagination query', async () => {
            const api = makeApi();
            await api.listClients({ page: 2, perPage: 50, showAll: 1 });
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/api/1.0.0/clinic-key-1/clients`
            );
            expect(api._captured[0].query).toEqual({
                page: 2,
                perPage: 50,
                showAll: 1,
            });
        });

        it('getClient hits GET /clients/{id}', async () => {
            const api = makeApi();
            await api.getClient('c-1');
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/api/1.0.0/clinic-key-1/clients/c-1`
            );
        });

        it('createClient POSTs the body', async () => {
            const api = makeApi();
            const body = { firstName: 'Ada', lastName: 'Lovelace' };
            await api.createClient(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/api/1.0.0/clinic-key-1/clients`
            );
            expect(api._captured[0].body).toEqual(body);
            expect(api._captured[0].headers['Content-Type']).toBe(
                'application/json'
            );
        });

        it('updateClient PUTs the body', async () => {
            const api = makeApi();
            const body = { firstName: 'Ada', lastName: 'Byron' };
            await api.updateClient('c-1', body);
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/api/1.0.0/clinic-key-1/clients/c-1`
            );
            expect(api._captured[0].body).toEqual(body);
        });
    });

    describe('patients', () => {
        it('listPatients / getPatient / createPatient / updatePatient hit documented paths', async () => {
            const api = makeApi();
            await api.listPatients({ page: 1 });
            await api.getPatient('p-1');
            await api.createPatient({ name: 'Fido', 'species.id': 2 });
            await api.updatePatient('p-1', { name: 'Fido', status: 'Active' });

            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/api/1.0.0/clinic-key-1/patients`
            );
            expect(api._captured[1].url).toBe(
                `${PRODUCTION_BASE_URL}/api/1.0.0/clinic-key-1/patients/p-1`
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('appointments', () => {
        it('listAppointments forwards category', async () => {
            const api = makeApi();
            await api.listAppointments({ category: 2, page: 1 });
            expect(api._captured[0].query).toEqual({ category: 2, page: 1 });
        });

        it('get/create/update appointment hit documented paths', async () => {
            const api = makeApi();
            await api.getAppointment('a-1');
            await api.createAppointment({
                reason: 'Checkup',
                start: '2026-01-01T10:00:00Z',
                end: '2026-01-01T10:30:00Z',
                location: 'In clinic',
            });
            await api.updateAppointment('a-1', {
                reason: 'Follow-up',
                start: '2026-01-02T10:00:00Z',
                end: '2026-01-02T10:30:00Z',
                location: 'In clinic',
            });
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/api/1.0.0/clinic-key-1/appointments/a-1`
            );
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[2].method).toBe('PUT');
        });
    });

    describe('invoices & payments', () => {
        it('listInvoices and getInvoice hit documented paths', async () => {
            const api = makeApi();
            await api.listInvoices({ page: 1 });
            await api.getInvoice('inv-1', { showAllInvoiceItem: 1 });
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/api/1.0.0/clinic-key-1/invoices`
            );
            expect(api._captured[1].url).toBe(
                `${PRODUCTION_BASE_URL}/api/1.0.0/clinic-key-1/invoices/inv-1`
            );
            expect(api._captured[1].query).toEqual({ showAllInvoiceItem: 1 });
        });

        it('listPayments and listPaymentTypes hit documented paths', async () => {
            const api = makeApi();
            await api.listPayments({ orderBy: 'date,desc' });
            await api.listPaymentTypes({ page: 1 });
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/api/1.0.0/clinic-key-1/payments`
            );
            expect(api._captured[0].query).toEqual({ orderBy: 'date,desc' });
            expect(api._captured[1].url).toBe(
                `${PRODUCTION_BASE_URL}/api/1.0.0/clinic-key-1/payment-types`
            );
        });
    });

    describe('reference data', () => {
        it('listSpecies and listBreeds hit documented paths', async () => {
            const api = makeApi();
            await api.listSpecies();
            await api.listBreeds({ perPage: 200 });
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/api/1.0.0/clinic-key-1/species`
            );
            expect(api._captured[1].url).toBe(
                `${PRODUCTION_BASE_URL}/api/1.0.0/clinic-key-1/breeds`
            );
            expect(api._captured[1].query).toEqual({ perPage: 200 });
        });
    });
});
