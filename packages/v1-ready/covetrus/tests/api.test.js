const { Api } = require('../api');

// Fully offline: stub _get/_post/_put and assert request options.
function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        client_id: 'cid',
        client_secret: 'sec',
        redirect_uri: 'https://app.example/redirect/covetrus',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'created_1' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 'updated_1' };
    };
    return api;
}

describe('Covetrus Api', () => {
    describe('construction & auth', () => {
        it('sets the Covetrus API v1 base URL and OAuth endpoints', () => {
            const api = new Api({
                access_token: 't',
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/covetrus',
            });
            expect(api.baseUrl).toBe('https://api.covetrus.com/v1');
            expect(api.tokenUri).toBe('https://auth.covetrus.com/oauth/token');
            expect(api.authorizationUri).toBe(
                'https://auth.covetrus.com/oauth/authorize'
            );
            expect(api.scope).toBe('clients invoices payments');
        });

        it('builds an authorization URI with code flow params', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/covetrus',
                scope: 'clients invoices payments',
            });
            const url = api.getAuthorizationUri();
            expect(url).toContain('https://auth.covetrus.com/oauth/authorize?');
            expect(url).toContain('client_id=cid');
            expect(url).toContain('response_type=code');
            expect(url).toContain(
                'redirect_uri=https%3A%2F%2Fapp.example%2Fredirect%2Fcovetrus'
            );
            expect(url).toContain('scope=clients');
        });

        it('getAuthorizationRequirements returns oauth2', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/r',
            });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('auth.covetrus.com/oauth/authorize');
        });

        it('exchanges code via form POST to the token URI', async () => {
            const api = makeApi();
            api._post = async (options) => {
                api._captured.push({ method: 'POST', ...options });
                return {
                    access_token: 'at',
                    refresh_token: 'rt',
                    expires_in: 3600,
                };
            };
            await api.getTokenFromCode('auth-code');
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe('https://auth.covetrus.com/oauth/token');
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(String(captured.body)).toContain('grant_type=authorization_code');
            expect(String(captured.body)).toContain('code=auth-code');
        });

        it('refreshes via refresh_token grant', async () => {
            const api = makeApi();
            api._post = async (options) => {
                api._captured.push({ method: 'POST', ...options });
                return {
                    access_token: 'at2',
                    refresh_token: 'rt2',
                    expires_in: 3600,
                };
            };
            await api.refreshAccessToken({ refresh_token: 'rt' });
            const captured = api._captured[0];
            expect(captured.url).toBe('https://auth.covetrus.com/oauth/token');
            expect(String(captured.body)).toContain('grant_type=refresh_token');
            expect(String(captured.body)).toContain('refresh_token=rt');
        });
    });

    describe('practice & locations', () => {
        it('getPractice hits GET /practice', async () => {
            const api = makeApi();
            await api.getPractice();
            expect(api._captured[0].url).toBe(
                'https://api.covetrus.com/v1/practice'
            );
        });

        it('listLocations / getLocation', async () => {
            const api = makeApi();
            await api.listLocations({ limit: 10 });
            expect(api._captured[0].url).toContain(
                'https://api.covetrus.com/v1/locations?'
            );
            expect(api._captured[0].url).toContain('limit=10');
            await api.getLocation('loc_1');
            expect(api._captured[1].url).toBe(
                'https://api.covetrus.com/v1/locations/loc_1'
            );
        });
    });

    describe('clients', () => {
        it('listClients defaults limit/offset', async () => {
            const api = makeApi();
            await api.listClients();
            expect(api._captured[0].url).toContain('/clients?');
            expect(api._captured[0].url).toContain('limit=50');
            expect(api._captured[0].url).toContain('offset=0');
        });

        it('get / search / create / update client', async () => {
            const api = makeApi();
            await api.getClient('c1');
            expect(api._captured[0].url).toBe(
                'https://api.covetrus.com/v1/clients/c1'
            );
            await api.searchClients({ q: 'smith' });
            expect(api._captured[1].url).toContain('/clients/search?');
            expect(api._captured[1].url).toContain('q=smith');
            await api.createClient({ name: 'Pat Owner' });
            expect(api._captured[2]).toMatchObject({
                method: 'POST',
                url: 'https://api.covetrus.com/v1/clients',
                body: { name: 'Pat Owner' },
            });
            await api.updateClient('c1', { name: 'Updated' });
            expect(api._captured[3]).toMatchObject({
                method: 'PUT',
                url: 'https://api.covetrus.com/v1/clients/c1',
                body: { name: 'Updated' },
            });
        });

        it('client nested routes', async () => {
            const api = makeApi();
            await api.listClientPatients('c1', { limit: 5 });
            expect(api._captured[0].url).toContain('/clients/c1/patients?');
            await api.listClientInvoices('c1');
            expect(api._captured[1].url).toContain('/clients/c1/invoices');
            await api.getClientBalance('c1');
            expect(api._captured[2].url).toBe(
                'https://api.covetrus.com/v1/clients/c1/balance'
            );
            await api.getClientLedger('c1', { offset: 2 });
            expect(api._captured[3].url).toContain('/clients/c1/ledger?');
            expect(api._captured[3].url).toContain('offset=2');
        });
    });

    describe('patients appointments invoices payments', () => {
        it('list/get patients and appointments', async () => {
            const api = makeApi();
            await api.listPatients({ limit: 1 });
            expect(api._captured[0].url).toContain('/patients?');
            await api.getPatient('p1');
            expect(api._captured[1].url).toBe(
                'https://api.covetrus.com/v1/patients/p1'
            );
            await api.listAppointments();
            expect(api._captured[2].url).toContain('/appointments?');
            await api.getAppointment('a1');
            expect(api._captured[3].url).toBe(
                'https://api.covetrus.com/v1/appointments/a1'
            );
        });

        it('invoices and payments', async () => {
            const api = makeApi();
            await api.listInvoices();
            expect(api._captured[0].url).toContain('/invoices?');
            await api.getInvoice('inv_1');
            expect(api._captured[1].url).toBe(
                'https://api.covetrus.com/v1/invoices/inv_1'
            );
            await api.listPayments();
            expect(api._captured[2].url).toContain('/payments?');
            await api.getPayment('pay_1');
            expect(api._captured[3].url).toBe(
                'https://api.covetrus.com/v1/payments/pay_1'
            );
            await api.createPayment({ amount: 10 });
            expect(api._captured[4]).toMatchObject({
                method: 'POST',
                url: 'https://api.covetrus.com/v1/payments',
                body: { amount: 10 },
            });
        });
    });

    describe('reminders records staff catalog', () => {
        it('hits the remaining resource paths', async () => {
            const api = makeApi();
            await api.listReminders();
            expect(api._captured[0].url).toContain('/reminders?');
            await api.getPatientReminders('p1');
            expect(api._captured[1].url).toBe(
                'https://api.covetrus.com/v1/patients/p1/reminders'
            );
            await api.listMedicalRecords('p1');
            expect(api._captured[2].url).toContain('/patients/p1/records');
            await api.getMedicalRecord('r1');
            expect(api._captured[3].url).toBe(
                'https://api.covetrus.com/v1/records/r1'
            );
            await api.listStaff();
            expect(api._captured[4].url).toContain('/staff');
            await api.getStaff('s1');
            expect(api._captured[5].url).toBe(
                'https://api.covetrus.com/v1/staff/s1'
            );
            await api.listServices();
            expect(api._captured[6].url).toContain('/services');
            await api.listProducts();
            expect(api._captured[7].url).toContain('/products');
        });
    });
});
