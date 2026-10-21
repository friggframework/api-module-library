const { Api, NEON_API_VERSION, DEFAULT_BASE_URL, TRIAL_BASE_URL } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        orgId: 'test-org',
        apiKey: 'test-key',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: '1' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return {};
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return {};
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Neon Api', () => {
    describe('construction & auth', () => {
        it('defaults to production base URL and maps Org ID / API key to Basic auth', () => {
            const api = new Api({ orgId: 'acme', apiKey: 'secret' });
            expect(api.baseUrl).toBe(DEFAULT_BASE_URL);
            expect(api.username).toBe('acme');
            expect(api.password).toBe('secret');
            expect(api.orgId).toBe('acme');
            expect(api.apiKey).toBe('secret');
        });

        it('uses trial base URL when environment is trial', () => {
            const api = new Api({
                orgId: 'acme',
                apiKey: 'secret',
                environment: 'trial',
            });
            expect(api.baseUrl).toBe(TRIAL_BASE_URL);
        });

        it('accepts baseUrl override', () => {
            const api = new Api({
                orgId: 'acme',
                apiKey: 'secret',
                baseUrl: 'https://example.test/v2',
            });
            expect(api.baseUrl).toBe('https://example.test/v2');
        });

        it('adds Basic Authorization and NEON-API-VERSION headers', async () => {
            const api = new Api({ orgId: 'org1', apiKey: 'key1' });
            const headers = await api.addAuthHeaders({});
            const expected = Buffer.from('org1:key1').toString('base64');
            expect(headers.Authorization || headers.authorization).toBe(
                `Basic ${expected}`
            );
            expect(headers['NEON-API-VERSION']).toBe(NEON_API_VERSION);
            expect(headers['Content-Type']).toBe('application/json');
        });

        it('setCredentials updates org, key, and environment base URL', () => {
            const api = new Api({ orgId: 'a', apiKey: 'b' });
            api.setCredentials({
                orgId: 'b',
                apiKey: 'c',
                environment: 'trial',
            });
            expect(api.orgId).toBe('b');
            expect(api.apiKey).toBe('c');
            expect(api.baseUrl).toBe(TRIAL_BASE_URL);
        });
    });

    describe('accounts', () => {
        it('listAccounts hits GET /accounts with query', async () => {
            const api = makeApi();
            await api.listAccounts({ pageSize: 1 });
            expect(api._captured[0]).toMatchObject({
                method: 'GET',
                url: `${DEFAULT_BASE_URL}/accounts`,
                query: { pageSize: 1 },
            });
        });

        it('createAccount POSTs to /accounts', async () => {
            const api = makeApi();
            const body = { individualAccount: { primaryContact: {} } };
            await api.createAccount(body);
            expect(api._captured[0]).toMatchObject({
                method: 'POST',
                url: `${DEFAULT_BASE_URL}/accounts`,
                body,
            });
        });

        it('getAccount / updateAccount / patchAccount hit /accounts/{id}', async () => {
            const api = makeApi();
            await api.getAccount('42');
            await api.updateAccount('42', { name: 'x' });
            await api.patchAccount('42', { name: 'y' });
            expect(api._captured[0].url).toBe(`${DEFAULT_BASE_URL}/accounts/42`);
            expect(api._captured[1].method).toBe('PUT');
            expect(api._captured[2].method).toBe('PATCH');
        });

        it('searchAccounts POSTs to /accounts/search', async () => {
            const api = makeApi();
            const body = {
                searchFields: [
                    { field: 'Email', operator: 'EQUAL', value: 'a@b.com' },
                ],
                outputFields: ['Account ID'],
            };
            await api.searchAccounts(body);
            expect(api._captured[0]).toMatchObject({
                method: 'POST',
                url: `${DEFAULT_BASE_URL}/accounts/search`,
                body,
            });
        });

        it('serializes concurrent searchAccounts calls', async () => {
            const api = new Api({ orgId: 'o', apiKey: 'k' });
            const order = [];
            let releaseFirst;
            const firstGate = new Promise((resolve) => {
                releaseFirst = resolve;
            });
            api._post = async ({ url }) => {
                if (order.length === 0) {
                    order.push('start-1');
                    await firstGate;
                    order.push('end-1');
                } else {
                    order.push('start-2');
                    order.push('end-2');
                }
                return { url };
            };
            const p1 = api.searchAccounts({ searchFields: [] });
            const p2 = api.searchAccounts({ searchFields: [] });
            await Promise.resolve();
            expect(order).toEqual(['start-1']);
            releaseFirst();
            await Promise.all([p1, p2]);
            expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
        });
    });

    describe('donations & campaigns & properties', () => {
        it('createDonation / getDonation / listAccountDonations', async () => {
            const api = makeApi();
            await api.createDonation({ accountId: '1', amount: 10 });
            await api.getDonation('9');
            await api.listAccountDonations('1', { pageSize: 5 });
            expect(api._captured[0].url).toBe(`${DEFAULT_BASE_URL}/donations`);
            expect(api._captured[1].url).toBe(`${DEFAULT_BASE_URL}/donations/9`);
            expect(api._captured[2].url).toBe(
                `${DEFAULT_BASE_URL}/accounts/1/donations`
            );
        });

        it('listCampaigns / listFunds / getOrganizationProfile', async () => {
            const api = makeApi();
            await api.listCampaigns();
            await api.listFunds();
            await api.getOrganizationProfile();
            expect(api._captured.map((c) => c.url)).toEqual([
                `${DEFAULT_BASE_URL}/campaigns`,
                `${DEFAULT_BASE_URL}/properties/funds`,
                `${DEFAULT_BASE_URL}/properties/organizationProfile`,
            ]);
        });
    });

    describe('events', () => {
        it('listEvents / createEvent / getEvent', async () => {
            const api = makeApi();
            await api.listEvents({ pageSize: 10 });
            await api.createEvent({ name: 'Gala' });
            await api.getEvent('e1');
            expect(api._captured[0].url).toBe(`${DEFAULT_BASE_URL}/events`);
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[2].url).toBe(`${DEFAULT_BASE_URL}/events/e1`);
        });

        it('event registration methods', async () => {
            const api = makeApi();
            await api.createEventRegistration({ eventId: 'e1' });
            await api.getEventRegistration('r1');
            await api.listEventRegistrations('e1', { page: 1 });
            expect(api._captured[0].url).toBe(
                `${DEFAULT_BASE_URL}/eventRegistrations`
            );
            expect(api._captured[1].url).toBe(
                `${DEFAULT_BASE_URL}/eventRegistrations/r1`
            );
            expect(api._captured[2]).toMatchObject({
                url: `${DEFAULT_BASE_URL}/events/e1/eventRegistrations`,
                query: { page: 1 },
            });
        });
    });

    describe('webhooks', () => {
        it('CRUD paths', async () => {
            const api = makeApi();
            await api.listWebhooks();
            await api.createWebhook({
                name: 'n',
                url: 'https://hook.example',
                eventTrigger: 'createAccount',
            });
            await api.getWebhook('w1');
            await api.updateWebhook('w1', {
                name: 'n',
                url: 'https://hook.example',
                eventTrigger: 'updateAccount',
            });
            await api.patchWebhook('w1', { name: 'n2' });
            await api.deleteWebhook('w1');
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'POST',
                'GET',
                'PUT',
                'PATCH',
                'DELETE',
            ]);
            expect(api._captured[0].url).toBe(`${DEFAULT_BASE_URL}/webhooks`);
            expect(api._captured[2].url).toBe(`${DEFAULT_BASE_URL}/webhooks/w1`);
        });
    });
});
