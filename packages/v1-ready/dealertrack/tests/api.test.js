const {
    Api,
    BASE_URL,
    AUTHORIZE_URL,
    TOKEN_URI,
    DEFAULT_SCOPE,
} = require('../api');

// Fully offline: stub _get/_post/_put and assert on constructed request options.
function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        client_id: 'cid',
        client_secret: 'sec',
        redirect_uri: 'https://app.example/redirect/dealertrack',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'created' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 'updated' };
    };
    return api;
}

describe('Dealertrack Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL, token URI, and default scope', () => {
            const api = new Api({ access_token: 'abc' });
            expect(api.baseUrl).toBe(BASE_URL);
            expect(api.tokenUri).toBe(TOKEN_URI);
            expect(api.scope).toBe(DEFAULT_SCOPE);
            expect(api.access_token).toBe('abc');
        });

        it('prefers DEALERTRACK_REDIRECT_URI over REDIRECT_URI fallback', () => {
            const prevDedicated = process.env.DEALERTRACK_REDIRECT_URI;
            const prevRedirect = process.env.REDIRECT_URI;
            process.env.DEALERTRACK_REDIRECT_URI =
                'https://dedicated.example/cb';
            process.env.REDIRECT_URI = 'https://fallback.example';
            try {
                const api = new Api({});
                expect(api.redirect_uri).toBe('https://dedicated.example/cb');
            } finally {
                if (prevDedicated === undefined) {
                    delete process.env.DEALERTRACK_REDIRECT_URI;
                } else {
                    process.env.DEALERTRACK_REDIRECT_URI = prevDedicated;
                }
                if (prevRedirect === undefined) {
                    delete process.env.REDIRECT_URI;
                } else {
                    process.env.REDIRECT_URI = prevRedirect;
                }
            }
        });

        it('builds the OAuth authorize URL with client_id, redirect_uri, scope, response_type', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/cb',
                scope: 'service customers',
                state: 'xyz',
            });
            const url = api.getAuthorizationUri();
            expect(url.startsWith(`${AUTHORIZE_URL}?`)).toBe(true);
            expect(url).toContain('client_id=cid');
            expect(url).toContain(
                'redirect_uri=' + encodeURIComponent('https://app.example/cb')
            );
            expect(url).toContain('response_type=code');
            expect(url).toContain('scope=service');
            expect(url).toContain('state=xyz');
        });

        it('getAuthorizationRequirements returns oauth2 with authorize url', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/cb',
            });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain(AUTHORIZE_URL);
        });

        it('getTokenFromCode posts form-encoded grant to the token URI', async () => {
            const api = makeApi();
            api.setTokens = async () => {};
            await api.getTokenFromCode('auth-code');
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(TOKEN_URI);
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            const body = captured.body.toString();
            expect(body).toContain('grant_type=authorization_code');
            expect(body).toContain('code=auth-code');
            expect(body).toContain('client_id=cid');
            expect(body).toContain('client_secret=sec');
        });

        it('refreshAccessToken posts refresh_token grant', async () => {
            const api = makeApi({ refresh_token: 'r1' });
            api.setTokens = async () => {};
            await api.refreshAccessToken({ refresh_token: 'r1' });
            const body = api._captured[0].body.toString();
            expect(body).toContain('grant_type=refresh_token');
            expect(body).toContain('refresh_token=r1');
        });
    });

    describe('dealer & locations', () => {
        it('getDealer hits GET /dealer', async () => {
            const api = makeApi();
            await api.getDealer();
            expect(api._captured[0].url).toBe(`${BASE_URL}/dealer`);
        });

        it('listLocations hits GET /locations', async () => {
            const api = makeApi();
            await api.listLocations();
            expect(api._captured[0].url).toBe(`${BASE_URL}/locations`);
        });

        it('getLocation hits GET /locations/{id}', async () => {
            const api = makeApi();
            await api.getLocation('loc-1');
            expect(api._captured[0].url).toBe(`${BASE_URL}/locations/loc-1`);
        });
    });

    describe('customers', () => {
        it('listCustomers defaults limit/offset query params', async () => {
            const api = makeApi();
            await api.listCustomers();
            const { url } = api._captured[0];
            expect(url).toContain(`${BASE_URL}/customers?`);
            expect(url).toContain('limit=50');
            expect(url).toContain('offset=0');
        });

        it('getCustomer hits GET /customers/{id}', async () => {
            const api = makeApi();
            await api.getCustomer('c1');
            expect(api._captured[0].url).toBe(`${BASE_URL}/customers/c1`);
        });

        it('searchCustomers hits GET /customers/search', async () => {
            const api = makeApi();
            await api.searchCustomers({ q: 'smith' });
            expect(api._captured[0].url).toContain(
                `${BASE_URL}/customers/search?`
            );
            expect(api._captured[0].url).toContain('q=smith');
        });

        it('createCustomer POSTs JSON to /customers', async () => {
            const api = makeApi();
            const body = { firstName: 'Ada', lastName: 'Lovelace' };
            await api.createCustomer(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(`${BASE_URL}/customers`);
            expect(api._captured[0].body).toEqual(body);
            expect(api._captured[0].headers['Content-Type']).toBe(
                'application/json'
            );
        });

        it('updateCustomer PUTs JSON to /customers/{id}', async () => {
            const api = makeApi();
            await api.updateCustomer('c1', { phone: '555' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(`${BASE_URL}/customers/c1`);
        });
    });

    describe('vehicles', () => {
        it('listVehicles hits GET /vehicles', async () => {
            const api = makeApi();
            await api.listVehicles({ limit: 10 });
            expect(api._captured[0].url).toContain(`${BASE_URL}/vehicles?`);
            expect(api._captured[0].url).toContain('limit=10');
        });

        it('getVehicle hits GET /vehicles/{id}', async () => {
            const api = makeApi();
            await api.getVehicle('v1');
            expect(api._captured[0].url).toBe(`${BASE_URL}/vehicles/v1`);
        });

        it('listCustomerVehicles hits nested path', async () => {
            const api = makeApi();
            await api.listCustomerVehicles('c1');
            expect(api._captured[0].url).toBe(
                `${BASE_URL}/customers/c1/vehicles`
            );
        });

        it('decodeVin hits GET /vehicles/decode/{vin}', async () => {
            const api = makeApi();
            await api.decodeVin('1HGCM82633A004352');
            expect(api._captured[0].url).toBe(
                `${BASE_URL}/vehicles/decode/1HGCM82633A004352`
            );
        });
    });

    describe('repair orders', () => {
        it('listRepairOrders hits GET /repair-orders', async () => {
            const api = makeApi();
            await api.listRepairOrders();
            expect(api._captured[0].url).toContain(
                `${BASE_URL}/repair-orders?`
            );
        });

        it('getRepairOrder hits GET /repair-orders/{id}', async () => {
            const api = makeApi();
            await api.getRepairOrder('ro1');
            expect(api._captured[0].url).toBe(`${BASE_URL}/repair-orders/ro1`);
        });

        it('createRepairOrder POSTs JSON', async () => {
            const api = makeApi();
            await api.createRepairOrder({ customerId: 'c1' });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(`${BASE_URL}/repair-orders`);
        });

        it('updateRepairOrder PUTs JSON', async () => {
            const api = makeApi();
            await api.updateRepairOrder('ro1', { status: 'open' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(`${BASE_URL}/repair-orders/ro1`);
        });
    });

    describe('invoices & payments', () => {
        it('listInvoices / getInvoice', async () => {
            const api = makeApi();
            await api.listInvoices();
            expect(api._captured[0].url).toContain(`${BASE_URL}/invoices?`);
            await api.getInvoice('inv1');
            expect(api._captured[1].url).toBe(`${BASE_URL}/invoices/inv1`);
        });

        it('listPayments / getPayment / createPayment', async () => {
            const api = makeApi();
            await api.listPayments();
            expect(api._captured[0].url).toContain(`${BASE_URL}/payments?`);
            await api.getPayment('p1');
            expect(api._captured[1].url).toBe(`${BASE_URL}/payments/p1`);
            await api.createPayment({ amount: 10 });
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[2].url).toBe(`${BASE_URL}/payments`);
        });
    });

    describe('appointments & service history', () => {
        it('listAppointments / getAppointment / createAppointment', async () => {
            const api = makeApi();
            await api.listAppointments();
            expect(api._captured[0].url).toContain(
                `${BASE_URL}/appointments?`
            );
            await api.getAppointment('a1');
            expect(api._captured[1].url).toBe(`${BASE_URL}/appointments/a1`);
            await api.createAppointment({ customerId: 'c1' });
            expect(api._captured[2].method).toBe('POST');
        });

        it('getVehicleServiceHistory / getCustomerServiceHistory', async () => {
            const api = makeApi();
            await api.getVehicleServiceHistory('v1');
            expect(api._captured[0].url).toBe(
                `${BASE_URL}/vehicles/v1/service-history`
            );
            await api.getCustomerServiceHistory('c1', { limit: 5 });
            expect(api._captured[1].url).toContain(
                `${BASE_URL}/customers/c1/service-history?`
            );
            expect(api._captured[1].url).toContain('limit=5');
        });
    });

    describe('parts, labor, staff', () => {
        it('listParts / getPart / searchParts', async () => {
            const api = makeApi();
            await api.listParts();
            expect(api._captured[0].url).toContain(`${BASE_URL}/parts?`);
            await api.getPart('pt1');
            expect(api._captured[1].url).toBe(`${BASE_URL}/parts/pt1`);
            await api.searchParts({ q: 'oil' });
            expect(api._captured[2].url).toContain(
                `${BASE_URL}/parts/search?`
            );
        });

        it('listLaborOperations / getLaborOperation', async () => {
            const api = makeApi();
            await api.listLaborOperations();
            expect(api._captured[0].url).toBe(
                `${BASE_URL}/labor-operations`
            );
            await api.getLaborOperation('op1');
            expect(api._captured[1].url).toBe(
                `${BASE_URL}/labor-operations/op1`
            );
        });

        it('listTechnicians / getTechnician', async () => {
            const api = makeApi();
            await api.listTechnicians();
            expect(api._captured[0].url).toBe(`${BASE_URL}/technicians`);
            await api.getTechnician('t1');
            expect(api._captured[1].url).toBe(`${BASE_URL}/technicians/t1`);
        });

        it('listServiceAdvisors / getServiceAdvisor', async () => {
            const api = makeApi();
            await api.listServiceAdvisors();
            expect(api._captured[0].url).toBe(`${BASE_URL}/service-advisors`);
            await api.getServiceAdvisor('sa1');
            expect(api._captured[1].url).toBe(
                `${BASE_URL}/service-advisors/sa1`
            );
        });
    });
});
