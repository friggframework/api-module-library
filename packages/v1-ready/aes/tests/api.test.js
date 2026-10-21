const { Api } = require('../api');

// Fully offline: stub _post and assert on the request options Api methods build.
function makeApi(overrides = {}) {
    const api = new Api({ api_key: 'test-key', ...overrides });
    api._captured = [];
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { ok: true };
    };
    return api;
}

describe('AES Api', () => {
    describe('construction & auth', () => {
        it('sets the production base URL and AES_API_KEY header name', () => {
            const prev = process.env.AES_BASE_URL;
            delete process.env.AES_BASE_URL;
            try {
                const api = new Api({ api_key: 'abc' });
                expect(api.baseUrl).toBe('https://auctionconductor.com');
                expect(api.api_key_name).toBe('AES_API_KEY');
                expect(api.api_key).toBe('abc');
            } finally {
                if (prev !== undefined) process.env.AES_BASE_URL = prev;
            }
        });

        it('accepts access_token as an alias for api_key', () => {
            const api = new Api({ access_token: 'from-token' });
            expect(api.api_key).toBe('from-token');
        });

        it('honors baseUrl param and AES_BASE_URL env', () => {
            const api = new Api({
                api_key: 'k',
                baseUrl: 'https://actestserver.com',
            });
            expect(api.baseUrl).toBe('https://actestserver.com');

            const prev = process.env.AES_BASE_URL;
            process.env.AES_BASE_URL = 'https://example-staging.test';
            try {
                const fromEnv = new Api({ api_key: 'k' });
                expect(fromEnv.baseUrl).toBe('https://example-staging.test');
            } finally {
                if (prev === undefined) delete process.env.AES_BASE_URL;
                else process.env.AES_BASE_URL = prev;
            }
        });

        it('adds the AES_API_KEY auth header', async () => {
            const api = new Api({ api_key: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers['AES_API_KEY']).toBe('secret');
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ api_key: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('parseAESDate', () => {
        it('parses Microsoft JSON dates', () => {
            const d = Api.parseAESDate('/Date(1609459200000)/');
            expect(d).toBeInstanceOf(Date);
            expect(d.getTime()).toBe(1609459200000);
        });

        it('returns null for missing or non-matching values', () => {
            expect(Api.parseAESDate(null)).toBeNull();
            expect(Api.parseAESDate('2020-01-01')).toBeNull();
        });
    });

    describe('events', () => {
        it('getEvent POSTs event_id', async () => {
            const api = makeApi();
            await api.getEvent(42);
            expect(api._captured[0].url).toBe(
                'https://auctionconductor.com/API/getEvent'
            );
            expect(api._captured[0].body).toEqual({ event_id: 42 });
            expect(api._captured[0].headers['Content-Type']).toBe(
                'application/json'
            );
        });

        it('getOrganizationEvents POSTs an empty body', async () => {
            const api = makeApi();
            await api.getOrganizationEvents();
            expect(api._captured[0].url).toBe(
                'https://auctionconductor.com/API/getOrganizationEvents'
            );
            expect(api._captured[0].body).toEqual({});
        });
    });

    describe('contributors', () => {
        it('getContributor / getContributors / deleteContributor', async () => {
            const api = makeApi();
            await api.getContributor(7);
            await api.getContributors(9);
            await api.deleteContributor(7);
            expect(api._captured[0].body).toEqual({ contributor_id: 7 });
            expect(api._captured[1].url).toContain('/API/getContributors');
            expect(api._captured[1].body).toEqual({ event_id: 9 });
            expect(api._captured[2].url).toContain('/API/deleteContributor');
        });

        it('createContributor and updateContributor forward the body', async () => {
            const api = makeApi();
            const body = {
                first_name: 'Ada',
                last_name: 'Lovelace',
                email: 'ada@example.com',
            };
            await api.createContributor(body);
            await api.updateContributor({ contributor_id: 1, ...body });
            expect(api._captured[0].url).toContain('/API/createContributor');
            expect(api._captured[0].body).toEqual(body);
            expect(api._captured[1].body.contributor_id).toBe(1);
        });
    });

    describe('event contributors', () => {
        it('CRUD and associate paths', async () => {
            const api = makeApi();
            await api.getEventContributor(3);
            await api.createEventContributor({ event_id: 1, contributor_id: 2 });
            await api.updateEventContributor({
                event_contributor_id: 3,
                bidder_number: '100',
            });
            await api.deleteEventContributor(3);
            await api.associateEventContributors({
                primary_event_contributor_id: 3,
            });
            expect(api._captured.map((c) => c.url.split('/API/')[1])).toEqual([
                'getEventContributor',
                'createEventContributor',
                'updateEventContributor',
                'deleteEventContributor',
                'associateEventContributors',
            ]);
        });
    });

    describe('activity, packages, post-event', () => {
        it('getActivity / getSales / getPayments', async () => {
            const api = makeApi();
            await api.getActivity(11);
            await api.getSales(22);
            await api.getPayments(22, ['CreditCard', 'Cash']);
            expect(api._captured[0].body).toEqual({
                event_contributor_id: 11,
            });
            expect(api._captured[1].body).toEqual({ event_id: 22 });
            expect(api._captured[2].body).toEqual({
                event_id: 22,
                payment_type: ['CreditCard', 'Cash'],
            });
        });

        it('getPayments wraps a scalar payment type as an array', async () => {
            const api = makeApi();
            await api.getPayments(1, 'Check');
            expect(api._captured[0].body.payment_type).toEqual(['Check']);
        });

        it('getPackages / getPackageCategories / lockEvent', async () => {
            const api = makeApi();
            await api.getPackages(5);
            await api.getPackageCategories(5);
            await api.lockEvent(5);
            await api.lockEvent(5, false);
            expect(api._captured[0].url).toContain('/API/getPackages');
            expect(api._captured[1].url).toContain('/API/getPackageCategories');
            expect(api._captured[2].body).toEqual({ event_id: 5, lock: true });
            expect(api._captured[3].body).toEqual({ event_id: 5, lock: false });
        });
    });
});
