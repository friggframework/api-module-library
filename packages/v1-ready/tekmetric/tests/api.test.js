const {
    Api,
    DEFAULT_BASE_URL,
    PRODUCTION_BASE_URL,
    SANDBOX_BASE_URL,
} = require('../api');

// Fully offline: stub low-level HTTP methods and assert on constructed options.
function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        access_token: 'test-token',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { content: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 1 };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { id: 1 };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Tekmetric Api', () => {
    const savedEnv = {};

    beforeEach(() => {
        for (const key of [
            'TEKMETRIC_BASE_URL',
            'TEKMETRIC_ENVIRONMENT',
        ]) {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        }
    });

    afterEach(() => {
        for (const [key, value] of Object.entries(savedEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    describe('construction & auth', () => {
        it('defaults to the production base URL and client_credentials grant', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
            });
            expect(api.baseUrl).toBe(DEFAULT_BASE_URL);
            expect(api.baseUrl).toBe(PRODUCTION_BASE_URL);
            expect(api.baseUrl).toBe('https://shop.tekmetric.com/api/v1');
            expect(api.tokenUri).toBe(
                'https://shop.tekmetric.com/api/v1/oauth/token'
            );
            expect(api.grant_type).toBe('client_credentials');
            expect(api.authorizationUri).toBeNull();
        });

        it('opts into sandbox via environment / TEKMETRIC_ENVIRONMENT', () => {
            expect(
                new Api({ environment: 'sandbox' }).baseUrl
            ).toBe(SANDBOX_BASE_URL);

            process.env.TEKMETRIC_ENVIRONMENT = 'sandbox';
            expect(new Api({}).baseUrl).toBe(SANDBOX_BASE_URL);
        });

        it('lets an explicit baseUrl win over environment', () => {
            process.env.TEKMETRIC_ENVIRONMENT = 'sandbox';
            const api = new Api({
                baseUrl: 'https://shop.tekmetric.com/api/v1',
            });
            expect(api.baseUrl).toBe(PRODUCTION_BASE_URL);
        });

        it('accepts a pre-issued access_token / api_key alias', () => {
            expect(new Api({ access_token: 'tok' }).access_token).toBe('tok');
            expect(new Api({ api_key: 'key-1' }).access_token).toBe('key-1');
            expect(
                new Api({ api_key: 'Bearer already' }).access_token
            ).toBe('already');
        });

        it('adds Bearer auth headers', async () => {
            const api = new Api({ access_token: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });

        it('isAuthenticated with a token or client credentials', () => {
            expect(new Api({ access_token: 'x' }).isAuthenticated()).toBe(true);
            expect(
                new Api({
                    client_id: 'c',
                    client_secret: 's',
                }).isAuthenticated()
            ).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });

        it('getAccessToken POSTs Basic + form client_credentials', async () => {
            const api = makeApi({ access_token: 'stale' });
            api.setTokens = async (tokens) => {
                api.access_token = tokens.access_token;
                if (tokens.scope) {
                    api.shopIds = String(tokens.scope).trim().split(/\s+/);
                }
            };
            api._post = async (options, stringify) => {
                api._captured.push({ options, stringify });
                return {
                    access_token: 'fresh',
                    token_type: 'Bearer',
                    expires_in: 3600,
                    scope: '101 202',
                };
            };
            const res = await api.getAccessToken();
            expect(res.access_token).toBe('fresh');
            expect(api.access_token).toBe('fresh');
            expect(api.shopIds).toEqual(['101', '202']);

            const { options, stringify } = api._captured[0];
            expect(stringify).toBe(false);
            expect(options.url).toBe(
                'https://shop.tekmetric.com/api/v1/oauth/token'
            );
            expect(options.headers['Content-Type']).toContain(
                'application/x-www-form-urlencoded'
            );
            expect(options.headers.Authorization).toBe(
                `Basic ${Buffer.from('cid:csecret').toString('base64')}`
            );
            expect(String(options.body)).toContain('grant_type=client_credentials');
        });

        it('getTokenFromClientCredentials requires client_id and client_secret', async () => {
            const api = new Api({});
            await expect(api.getTokenFromClientCredentials()).rejects.toThrow(
                /client_id and client_secret/
            );
        });
    });

    describe('shops', () => {
        it('listShops hits GET /shops', async () => {
            const api = makeApi();
            await api.listShops();
            expect(api._captured[0].url).toBe(
                'https://shop.tekmetric.com/api/v1/shops'
            );
        });

        it('getShop hits GET /shops/{id}', async () => {
            const api = makeApi();
            await api.getShop(42);
            expect(api._captured[0].url).toBe(
                'https://shop.tekmetric.com/api/v1/shops/42'
            );
        });
    });

    describe('customers', () => {
        it('listCustomers hits GET /customers with shop/page/size', async () => {
            const api = makeApi();
            await api.listCustomers({ shopId: 9, search: 'ann' });
            const { url } = api._captured[0];
            expect(url).toContain(
                'https://shop.tekmetric.com/api/v1/customers?'
            );
            expect(url).toContain('shop=9');
            expect(url).toContain('page=0');
            expect(url).toContain('size=25');
            expect(url).toContain('search=ann');
            expect(url).not.toContain('shopId=');
        });

        it('getCustomer / createCustomer / updateCustomer hit the right paths', async () => {
            const api = makeApi();
            await api.getCustomer(7);
            await api.createCustomer({ firstName: 'A' });
            await api.updateCustomer(7, { lastName: 'B' });
            expect(api._captured[0].url).toBe(
                'https://shop.tekmetric.com/api/v1/customers/7'
            );
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].url).toBe(
                'https://shop.tekmetric.com/api/v1/customers'
            );
            expect(api._captured[1].body).toEqual({ firstName: 'A' });
            expect(api._captured[2].method).toBe('PATCH');
            expect(api._captured[2].url).toBe(
                'https://shop.tekmetric.com/api/v1/customers/7'
            );
        });
    });

    describe('vehicles', () => {
        it('list/get/create/update vehicles', async () => {
            const api = makeApi();
            await api.listVehicles({ shop: 1, customerId: 2 });
            await api.getVehicle(3);
            await api.createVehicle({ year: 2020 });
            await api.updateVehicle(3, { color: 'red' });
            expect(api._captured[0].url).toContain('/vehicles?');
            expect(api._captured[0].url).toContain('customerId=2');
            expect(api._captured[1].url).toContain('/vehicles/3');
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PATCH');
        });
    });

    describe('repair orders', () => {
        it('maps status/startDate aliases and hits paths', async () => {
            const api = makeApi();
            await api.listRepairOrders({
                shopId: 1,
                status: 2,
                startDate: '2026-01-01',
                endDate: '2026-01-31',
            });
            const { url } = api._captured[0];
            expect(url).toContain('/repair-orders?');
            expect(url).toContain('shop=1');
            expect(url).toContain('repairOrderStatusId=2');
            expect(url).toContain('updatedDateStart=2026-01-01');
            expect(url).toContain('updatedDateEnd=2026-01-31');

            await api.getRepairOrder(99);
            await api.updateRepairOrder(99, { color: 'blue' });
            expect(api._captured[1].url).toContain('/repair-orders/99');
            expect(api._captured[2].method).toBe('PATCH');
        });
    });

    describe('jobs', () => {
        it('list/get/update jobs', async () => {
            const api = makeApi();
            await api.listJobs({ shop: 1 });
            await api.getJob(5);
            await api.updateJob(5, { authorized: true });
            expect(api._captured[0].url).toContain('/jobs?');
            expect(api._captured[1].url).toContain('/jobs/5');
            expect(api._captured[2].method).toBe('PATCH');
        });
    });

    describe('appointments', () => {
        it('list/get/create/update/delete appointments', async () => {
            const api = makeApi();
            await api.listAppointments({ shop: 1 });
            await api.getAppointment(8);
            await api.createAppointment({ shopId: 1 });
            await api.updateAppointment(8, { notes: 'x' });
            await api.deleteAppointment(8);
            expect(api._captured[0].url).toContain('/appointments?');
            expect(api._captured[1].url).toContain('/appointments/8');
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PATCH');
            expect(api._captured[4].method).toBe('DELETE');
        });
    });

    describe('employees', () => {
        it('list/get employees', async () => {
            const api = makeApi();
            await api.listEmployees({ shop: 1, search: 'sam' });
            await api.getEmployee(4);
            expect(api._captured[0].url).toContain('/employees?');
            expect(api._captured[0].url).toContain('search=sam');
            expect(api._captured[1].url).toContain('/employees/4');
        });
    });
});
