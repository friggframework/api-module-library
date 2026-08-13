const { Api } = require('../api');
const { createFakeFetch, TOKEN_RESPONSE } = require('./fake-fetch');

const CREDS = {
    tenant_id: '987654321',
    app_key: 'test-app-key',
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
};

function apiWith(responders, overrides = {}) {
    const fetch = createFakeFetch(responders);
    const api = new Api({ ...CREDS, ...overrides, fetch });
    return { api, fetch };
}

describe('ServiceTitan Api', () => {
    describe('environment configuration', () => {
        it('targets the production auth and api hosts by default', () => {
            const { api } = apiWith([TOKEN_RESPONSE]);
            expect(api.baseUrl).toEqual('https://api.servicetitan.io');
            expect(api.tokenUri).toEqual('https://auth.servicetitan.io/connect/token');
        });

        it('targets the integration hosts when asked', () => {
            const { api } = apiWith([TOKEN_RESPONSE], { environment: 'integration' });
            expect(api.baseUrl).toEqual('https://api-integration.servicetitan.io');
            expect(api.tokenUri).toEqual(
                'https://auth-integration.servicetitan.io/connect/token'
            );
        });

        it('throws on an unknown environment rather than silently hitting production', () => {
            expect(() => apiWith([TOKEN_RESPONSE], { environment: 'staging' })).toThrow(
                /Unknown ServiceTitan environment "staging"/
            );
        });
    });

    describe('tenant-scoped paths', () => {
        // The single most likely thing to get wrong. Every ServiceTitan v2 path
        // is /{module}/v2/tenant/{tenantId}/{resource} — note the literal
        // "tenant" segment, which several third-party guides omit.
        it.each([
            ['customers', (api) => api.URLs.customers, 'crm'],
            ['jobs', (api) => api.URLs.jobs, 'jpm'],
            ['appointments', (api) => api.URLs.appointments, 'jpm'],
            ['invoices', (api) => api.URLs.invoices, 'accounting'],
            ['payments', (api) => api.URLs.payments, 'accounting'],
            ['appointmentAssignments', (api) => api.URLs.appointmentAssignments, 'dispatch'],
            ['technicians', (api) => api.URLs.technicians, 'settings'],
        ])('%s sits under the %s module with the literal tenant segment', (name, getUrl, moduleName) => {
            const { api } = apiWith([TOKEN_RESPONSE]);
            const url = getUrl(api);
            expect(url).toContain(`/${moduleName}/v2/tenant/${CREDS.tenant_id}/`);
            expect(url.startsWith('https://api.servicetitan.io/')).toBe(true);
        });

        it('builds nested resource paths from the tenant root', () => {
            const { api } = apiWith([TOKEN_RESPONSE]);
            expect(api.URLs.customerNotes(42)).toEqual(
                `https://api.servicetitan.io/crm/v2/tenant/${CREDS.tenant_id}/customers/42/notes`
            );
            expect(api.URLs.jobById(7)).toEqual(
                `https://api.servicetitan.io/jpm/v2/tenant/${CREDS.tenant_id}/jobs/7`
            );
        });

        it('rebuilds urls when setAuthParams changes the tenant', () => {
            const { api } = apiWith([TOKEN_RESPONSE]);
            api.tenant_id = '111';
            api.setup();
            expect(api.URLs.customers).toContain('/tenant/111/customers');
        });
    });

    describe('token acquisition', () => {
        it('posts form-encoded client credentials, not JSON', async () => {
            const { api, fetch } = apiWith([TOKEN_RESPONSE]);
            await api.getTokenFromClientCredentials();

            const call = fetch.lastCall();
            expect(call.url).toEqual('https://auth.servicetitan.io/connect/token');
            expect(call.method).toEqual('POST');
            expect(call.headers['Content-Type']).toEqual(
                'application/x-www-form-urlencoded'
            );
            // A URLSearchParams body, NOT a JSON string. The base
            // OAuth2Requester sends JSON here, which ServiceTitan rejects.
            expect(call.body).toBeInstanceOf(URLSearchParams);
            expect(call.body.get('grant_type')).toEqual('client_credentials');
            expect(call.body.get('client_id')).toEqual(CREDS.client_id);
            expect(call.body.get('client_secret')).toEqual(CREDS.client_secret);
        });

        it('does not send a Bearer token or app key to the token endpoint', async () => {
            const { api, fetch } = apiWith([TOKEN_RESPONSE]);
            api.access_token = 'stale-token';
            await api.getTokenFromClientCredentials();

            const call = fetch.lastCall();
            expect(call.headers.Authorization).toBeUndefined();
            expect(call.headers['ST-App-Key']).toBeUndefined();
        });

        it('records an expiry from expires_in', async () => {
            const { api } = apiWith([TOKEN_RESPONSE]);
            const before = Date.now();
            await api.getTokenFromClientCredentials();

            expect(api.access_token).toEqual('test-access-token');
            const expiry = new Date(api.accessTokenExpire).getTime();
            expect(expiry).toBeGreaterThanOrEqual(before + 900 * 1000 - 50);
        });

        it('clears the recursion guard even when the token request fails', async () => {
            const { api } = apiWith([{ status: 400, body: { error: 'invalid_client' } }]);
            await expect(api.getTokenFromClientCredentials()).rejects.toBeDefined();
            expect(api.isRequestingToken).toBe(false);
        });

        it('declares the client_credentials grant so inherited refreshAuth routes correctly', () => {
            // refreshAuth() is NOT overridden here — it is inherited, and it
            // branches on this.grant_type to decide between the refresh-token
            // path (impossible in this flow) and client credentials. If the
            // grant is not declared, the inherited method takes the wrong branch.
            const { api } = apiWith([TOKEN_RESPONSE]);
            expect(api.grant_type).toEqual('client_credentials');
        });

        it('inherited refreshAuth mints a new token through the form-encoded path', async () => {
            const { api, fetch } = apiWith([TOKEN_RESPONSE]);
            api.access_token = 'expired-token';
            api.accessTokenExpire = new Date(Date.now() - 1000);

            await api.refreshAuth();

            const call = fetch.lastCall();
            expect(call.url).toEqual('https://auth.servicetitan.io/connect/token');
            expect(call.headers['Content-Type']).toEqual(
                'application/x-www-form-urlencoded'
            );
            // Asserting the grant in the body matters: the inherited
            // refreshAccessToken() path also posts form-encoded to this same
            // URL, so URL and Content-Type alone would pass even if refreshAuth
            // took the refresh-token branch and sent refresh_token=undefined.
            expect(call.body.get('grant_type')).toEqual('client_credentials');
            expect(call.body.has('refresh_token')).toBe(false);
            expect(api.access_token).toEqual('test-access-token');
            expect(api.isAuthenticated()).toBe(true);
        });
    });

    describe('authenticated requests', () => {
        it('sends both the Bearer token and the ST-App-Key header', async () => {
            const { api, fetch } = apiWith([
                TOKEN_RESPONSE,
                { body: { data: [], hasMore: false } },
            ]);
            await api.listCustomers();

            const call = fetch.lastCall();
            expect(call.headers.Authorization).toEqual('Bearer test-access-token');
            // Requests without this header fail with 401 even with a valid token.
            expect(call.headers['ST-App-Key']).toEqual(CREDS.app_key);
        });

        it('acquires a token on the first call, then reuses it', async () => {
            const { api, fetch } = apiWith([
                TOKEN_RESPONSE,
                { body: { data: [], hasMore: false } },
            ]);
            await api.listCustomers();
            await api.listCustomers();

            const tokenCalls = fetch.calls.filter((c) =>
                c.url.includes('/connect/token')
            );
            expect(tokenCalls).toHaveLength(1);
            expect(fetch.calls).toHaveLength(3);
        });

        it('re-mints an expired token without waiting for a 401', async () => {
            const { api, fetch } = apiWith([
                TOKEN_RESPONSE,
                { body: { data: [], hasMore: false } },
            ]);
            api.access_token = 'expired-token';
            api.accessTokenExpire = new Date(Date.now() - 1000);

            await api.listCustomers();

            expect(fetch.calls[0].url).toContain('/connect/token');
            expect(fetch.lastCall().headers.Authorization).toEqual(
                'Bearer test-access-token'
            );
        });

        it('treats a token inside the expiry buffer as expired', () => {
            const { api } = apiWith([TOKEN_RESPONSE]);
            api.access_token = 'nearly-expired';
            api.accessTokenExpire = new Date(Date.now() + 30 * 1000);
            expect(api.isAuthenticated()).toBe(false);

            api.accessTokenExpire = new Date(Date.now() + 10 * 60 * 1000);
            expect(api.isAuthenticated()).toBe(true);
        });

        it('is not authenticated with an unparseable or absent expiry', () => {
            const { api } = apiWith([TOKEN_RESPONSE]);
            api.access_token = 'token';
            api.accessTokenExpire = 'not-a-date';
            expect(api.isAuthenticated()).toBe(false);

            api.accessTokenExpire = null;
            expect(api.isAuthenticated()).toBe(false);
        });

        it('is not authenticated without a token even if the expiry is in future', () => {
            const { api } = apiWith([TOKEN_RESPONSE]);
            api.access_token = null;
            api.accessTokenExpire = new Date(Date.now() + 10 * 60 * 1000);
            expect(api.isAuthenticated()).toBe(false);
        });
    });

    describe('pagination', () => {
        it('walks every page while hasMore is true', async () => {
            const pages = [
                { body: { data: [{ id: 1 }, { id: 2 }], hasMore: true, page: 1 } },
                { body: { data: [{ id: 3 }], hasMore: false, page: 2 } },
            ];
            const { api, fetch } = apiWith([TOKEN_RESPONSE, ...pages]);

            const all = await api.getAllCustomers();

            expect(all).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
            const dataCalls = fetch.calls.filter((c) => c.url.includes('/customers'));
            expect(dataCalls).toHaveLength(2);
            expect(dataCalls[0].query.page).toEqual(1);
            expect(dataCalls[1].query.page).toEqual(2);
        });

        it('stops after one page when hasMore is false', async () => {
            const { api, fetch } = apiWith([
                TOKEN_RESPONSE,
                { body: { data: [{ id: 1 }], hasMore: false } },
            ]);
            const all = await api.getAllCustomers();
            expect(all).toEqual([{ id: 1 }]);
            expect(fetch.calls.filter((c) => c.url.includes('/customers'))).toHaveLength(1);
        });

        it('preserves caller query params across pages', async () => {
            const { api, fetch } = apiWith([
                TOKEN_RESPONSE,
                { body: { data: [], hasMore: false } },
            ]);
            await api.getAllJobs({ modifiedOnOrAfter: '2026-08-01T00:00:00Z' });

            const call = fetch.calls.find((c) => c.url.includes('/jobs'));
            expect(call.query.modifiedOnOrAfter).toEqual('2026-08-01T00:00:00Z');
            expect(call.query.pageSize).toEqual(200);
        });

        it('tolerates a page with no data array', async () => {
            const { api } = apiWith([TOKEN_RESPONSE, { body: { hasMore: false } }]);
            await expect(api.getAllCustomers()).resolves.toEqual([]);
        });
    });

    describe('write operations', () => {
        it('PATCHes customer updates to the customer path', async () => {
            const { api, fetch } = apiWith([TOKEN_RESPONSE, { body: { id: 5 } }]);
            await api.updateCustomer(5, { name: 'Acme' });

            const call = fetch.lastCall();
            expect(call.method).toEqual('PATCH');
            expect(call.url).toContain(`/crm/v2/tenant/${CREDS.tenant_id}/customers/5`);
            expect(JSON.parse(call.body)).toEqual({ name: 'Acme' });
        });

        it('POSTs a customer note to the notes subresource', async () => {
            const { api, fetch } = apiWith([TOKEN_RESPONSE, { body: {} }]);
            await api.createCustomerNote(5, { text: 'Podium conversation' });

            const call = fetch.lastCall();
            expect(call.method).toEqual('POST');
            expect(call.url).toEqual(
                `https://api.servicetitan.io/crm/v2/tenant/${CREDS.tenant_id}/customers/5/notes`
            );
            expect(JSON.parse(call.body)).toEqual({ text: 'Podium conversation' });
        });
    });

    describe('getTenantDetails', () => {
        it('proves the credential set by reading business units', async () => {
            const { api, fetch } = apiWith([
                TOKEN_RESPONSE,
                { body: { data: [{ name: 'Acme HVAC' }], totalCount: 3, hasMore: false } },
            ]);
            const details = await api.getTenantDetails();

            expect(details).toEqual({
                tenantId: CREDS.tenant_id,
                environment: 'production',
                name: 'Acme HVAC',
                businessUnitCount: 3,
            });
            expect(fetch.lastCall().url).toContain('/settings/v2/tenant/');
        });

        it('falls back to a tenant label when no business unit is named', async () => {
            const { api } = apiWith([
                TOKEN_RESPONSE,
                { body: { data: [], totalCount: 0, hasMore: false } },
            ]);
            const details = await api.getTenantDetails();
            expect(details.name).toEqual(`Tenant ${CREDS.tenant_id}`);
        });
    });
});
