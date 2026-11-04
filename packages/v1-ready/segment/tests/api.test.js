const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({ access_token: 'test-token', ...overrides });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: {} };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { data: {} };
    };
    return api;
}

describe('Segment Api', () => {
    describe('construction & auth', () => {
        it('sets the Public API base URL', () => {
            const api = new Api({ access_token: 'abc' });
            expect(api.baseUrl).toBe('https://api.segmentapis.com');
            expect(api.access_token).toBe('abc');
        });

        it('accepts public_api_token / api_key aliases', () => {
            expect(
                new Api({ public_api_token: 'from-public' }).access_token
            ).toBe('from-public');
            expect(new Api({ api_key: 'from-key' }).access_token).toBe(
                'from-key'
            );
        });

        it('strips a Bearer prefix from the stored token', () => {
            const api = new Api({ access_token: 'Bearer already' });
            expect(api.access_token).toBe('already');
        });

        it('adds Authorization Bearer for Public API calls', async () => {
            const api = new Api({ access_token: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });

        it('stores optional Profile API credentials', () => {
            const api = new Api({
                access_token: 'p',
                profile_api_token: 'prof',
                space_id: 'sp_1',
            });
            expect(api.profile_api_token).toBe('prof');
            expect(api.space_id).toBe('sp_1');
            expect(api.profileBaseUrl).toBe(
                'https://profiles.segment.com/v1'
            );
        });
    });

    describe('Public API reads', () => {
        it('getWorkspace hits GET /', async () => {
            const api = makeApi();
            await api.getWorkspace();
            expect(api._captured[0].url).toBe('https://api.segmentapis.com/');
        });

        it('listSources hits GET /sources', async () => {
            const api = makeApi();
            await api.listSources();
            expect(api._captured[0].url).toBe(
                'https://api.segmentapis.com/sources'
            );
        });

        it('listSources serializes pagination.count / pagination.cursor', async () => {
            const api = makeApi();
            await api.listSources({
                pagination: { count: 2, cursor: 'abc' },
            });
            const { url } = api._captured[0];
            expect(url).toContain('pagination.count=2');
            expect(url).toContain('pagination.cursor=abc');
        });

        it('getSource hits GET /sources/{sourceId}', async () => {
            const api = makeApi();
            await api.getSource('src_1');
            expect(api._captured[0].url).toBe(
                'https://api.segmentapis.com/sources/src_1'
            );
        });

        it('listConnectedDestinationsFromSource hits the connected-destinations path', async () => {
            const api = makeApi();
            await api.listConnectedDestinationsFromSource('src_1');
            expect(api._captured[0].url).toBe(
                'https://api.segmentapis.com/sources/src_1/connected-destinations'
            );
        });

        it('listDestinations / getDestination', async () => {
            const api = makeApi();
            await api.listDestinations();
            await api.getDestination('dst_1');
            expect(api._captured[0].url).toBe(
                'https://api.segmentapis.com/destinations'
            );
            expect(api._captured[1].url).toBe(
                'https://api.segmentapis.com/destinations/dst_1'
            );
        });

        it('listSubscriptionsFromDestination / getSubscriptionFromDestination', async () => {
            const api = makeApi();
            await api.listSubscriptionsFromDestination('dst_1');
            await api.getSubscriptionFromDestination('dst_1', 'sub_1');
            expect(api._captured[0].url).toBe(
                'https://api.segmentapis.com/destinations/dst_1/subscriptions'
            );
            expect(api._captured[1].url).toBe(
                'https://api.segmentapis.com/destinations/dst_1/subscriptions/sub_1'
            );
        });

        it('listWarehouses / getWarehouse', async () => {
            const api = makeApi();
            await api.listWarehouses();
            await api.getWarehouse('wh_1');
            expect(api._captured[0].url).toBe(
                'https://api.segmentapis.com/warehouses'
            );
            expect(api._captured[1].url).toBe(
                'https://api.segmentapis.com/warehouses/wh_1'
            );
        });

        it('listTrackingPlans / getTrackingPlan', async () => {
            const api = makeApi();
            await api.listTrackingPlans();
            await api.getTrackingPlan('tp_1');
            expect(api._captured[0].url).toBe(
                'https://api.segmentapis.com/tracking-plans'
            );
            expect(api._captured[1].url).toBe(
                'https://api.segmentapis.com/tracking-plans/tp_1'
            );
        });

        it('listFunctions / getFunction / listSpaces', async () => {
            const api = makeApi();
            await api.listFunctions();
            await api.getFunction('fn_1');
            await api.listSpaces();
            expect(api._captured[0].url).toBe(
                'https://api.segmentapis.com/functions'
            );
            expect(api._captured[1].url).toBe(
                'https://api.segmentapis.com/functions/fn_1'
            );
            expect(api._captured[2].url).toBe(
                'https://api.segmentapis.com/spaces'
            );
        });
    });

    describe('Profile API reads', () => {
        it('getProfileTraits uses Basic auth and the space path', async () => {
            const api = makeApi({
                profile_api_token: 'prof',
                space_id: 'space_9',
            });
            await api.getProfileTraits('user_id:u1', { limit: 50 });
            const call = api._captured[0];
            expect(call.url).toBe(
                'https://profiles.segment.com/v1/spaces/space_9/collections/users/profiles/user_id%3Au1/traits?limit=50'
            );
            expect(call.headers.Authorization).toBe(
                `Basic ${Buffer.from('prof:', 'utf8').toString('base64')}`
            );
        });

        it('getProfileEvents / getProfileExternalIds / getAccountProfileTraits', async () => {
            const api = makeApi({
                profile_api_token: 'prof',
                space_id: 'space_9',
            });
            await api.getProfileEvents('email:a@b.com');
            await api.getProfileExternalIds('user_id:1');
            await api.getAccountProfileTraits('group_id:99');
            expect(api._captured[0].url).toContain(
                '/collections/users/profiles/email%3Aa%40b.com/events'
            );
            expect(api._captured[1].url).toContain(
                '/collections/users/profiles/user_id%3A1/external_ids'
            );
            expect(api._captured[2].url).toContain(
                '/collections/accounts/profiles/group_id%3A99/traits'
            );
        });

        it('throws when Profile credentials are missing', async () => {
            const api = makeApi({
                profile_api_token: null,
                space_id: null,
            });
            api.profile_api_token = null;
            api.space_id = null;
            await expect(api.getProfileTraits('user_id:1')).rejects.toThrow(
                /profile_api_token/i
            );
            api.profile_api_token = 'x';
            await expect(api.getProfileTraits('user_id:1')).rejects.toThrow(
                /space_id/i
            );
        });
    });
});
