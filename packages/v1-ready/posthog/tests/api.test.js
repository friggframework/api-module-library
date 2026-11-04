const {
    Api,
    normalizePostHogHost,
    DEFAULT_POSTHOG_HOST,
} = require('../api');

// Fully offline: stub _get/_post/_patch/_delete and assert on request options.
function makeApi(overrides = {}) {
    const api = new Api({
        api_key: 'test-key',
        project_id: '42',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { results: [] };
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

describe('PostHog Api', () => {
    describe('normalizePostHogHost', () => {
        it('defaults blank to US cloud', () => {
            expect(normalizePostHogHost('')).toBe(DEFAULT_POSTHOG_HOST);
            expect(normalizePostHogHost(null)).toBe(DEFAULT_POSTHOG_HOST);
            expect(normalizePostHogHost(undefined)).toBe(DEFAULT_POSTHOG_HOST);
        });

        it('accepts US and EU cloud origins', () => {
            expect(normalizePostHogHost('https://us.posthog.com')).toBe(
                'https://us.posthog.com'
            );
            expect(normalizePostHogHost('https://eu.posthog.com/')).toBe(
                'https://eu.posthog.com'
            );
            expect(normalizePostHogHost('https://app.posthog.com')).toBe(
                'https://app.posthog.com'
            );
        });

        it('rejects http, non-posthog hosts, userinfo, and ports', () => {
            expect(() =>
                normalizePostHogHost('http://us.posthog.com')
            ).toThrow(/https posthog\.com/i);
            expect(() =>
                normalizePostHogHost('https://evil.example.com')
            ).toThrow(/https posthog\.com/i);
            expect(() =>
                normalizePostHogHost('https://user:pass@us.posthog.com')
            ).toThrow(/https posthog\.com/i);
            expect(() =>
                normalizePostHogHost('https://us.posthog.com:8443')
            ).toThrow(/https posthog\.com/i);
            expect(() => normalizePostHogHost('not-a-url')).toThrow(/URL/i);
        });
    });

    describe('construction & auth', () => {
        it('sets default baseUrl and Authorization header name', () => {
            const api = new Api({ api_key: 'abc', project_id: '1' });
            expect(api.baseUrl).toBe('https://us.posthog.com');
            expect(api.host).toBe('https://us.posthog.com');
            expect(api.api_key_name).toBe('Authorization');
            expect(api.api_key).toBe('abc');
            expect(api.project_id).toBe('1');
        });

        it('strips a caller-supplied Bearer prefix from the stored key', () => {
            const api = new Api({
                api_key: 'Bearer already-prefixed',
                project_id: '1',
            });
            expect(api.api_key).toBe('already-prefixed');
        });

        it('accepts access_token as an alias for api_key', () => {
            const api = new Api({ access_token: 'from-token', project_id: '1' });
            expect(api.api_key).toBe('from-token');
        });

        it('honors an explicit host', () => {
            const api = new Api({
                api_key: 'k',
                project_id: '1',
                host: 'https://eu.posthog.com',
            });
            expect(api.baseUrl).toBe('https://eu.posthog.com');
            expect(api.host).toBe('https://eu.posthog.com');
        });

        it('adds Authorization Bearer and Content-Type headers', async () => {
            const api = new Api({ api_key: 'secret', project_id: '1' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
            expect(headers['Content-Type']).toBe('application/json');
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(
                new Api({ api_key: 'x', project_id: '1' }).isAuthenticated()
            ).toBe(true);
            expect(new Api({ project_id: '1' }).isAuthenticated()).toBe(false);
        });
    });

    describe('getCurrentUser', () => {
        it('hits GET /api/users/@me/', async () => {
            const api = makeApi();
            await api.getCurrentUser();
            expect(api._captured[0].url).toBe(
                'https://us.posthog.com/api/users/@me/'
            );
        });
    });

    describe('insights', () => {
        it('listInsights hits the project insights path', async () => {
            const api = makeApi();
            await api.listInsights({ limit: 5, saved: true });
            const { url, query } = api._captured[0];
            expect(url).toBe(
                'https://us.posthog.com/api/projects/42/insights/'
            );
            expect(query).toEqual({ limit: 5, saved: true });
        });

        it('getInsight hits the insight by id path', async () => {
            const api = makeApi();
            await api.getInsight(99);
            expect(api._captured[0].url).toBe(
                'https://us.posthog.com/api/projects/42/insights/99/'
            );
        });

        it('createInsight POSTs the body', async () => {
            const api = makeApi();
            const body = { name: 'Weekly signups' };
            await api.createInsight(body);
            expect(api._captured[0]).toMatchObject({
                method: 'POST',
                url: 'https://us.posthog.com/api/projects/42/insights/',
                body,
            });
        });

        it('updateInsight PATCHes the body', async () => {
            const api = makeApi();
            await api.updateInsight(7, { name: 'Renamed' });
            expect(api._captured[0]).toMatchObject({
                method: 'PATCH',
                url: 'https://us.posthog.com/api/projects/42/insights/7/',
                body: { name: 'Renamed' },
            });
        });

        it('allows per-call projectId override', async () => {
            const api = makeApi();
            await api.listInsights({ projectId: '99' });
            expect(api._captured[0].url).toContain('/projects/99/');
        });
    });

    describe('createQuery', () => {
        it('POSTs a HogQLQuery wrapper when given a string', async () => {
            const api = makeApi();
            await api.createQuery('SELECT count() FROM events');
            expect(api._captured[0]).toMatchObject({
                method: 'POST',
                url: 'https://us.posthog.com/api/projects/42/query/',
                body: {
                    query: {
                        kind: 'HogQLQuery',
                        query: 'SELECT count() FROM events',
                    },
                },
            });
        });

        it('POSTs an object body as-is', async () => {
            const api = makeApi();
            const body = {
                query: { kind: 'HogQLQuery', query: 'SELECT 1' },
                name: 'smoke',
            };
            await api.createQuery(body);
            expect(api._captured[0].body).toEqual(body);
        });
    });

    describe('events', () => {
        it('listEvents forwards filters', async () => {
            const api = makeApi();
            await api.listEvents({
                limit: 10,
                event: '$pageview',
                after: '2026-01-01T00:00:00Z',
            });
            expect(api._captured[0].url).toBe(
                'https://us.posthog.com/api/projects/42/events/'
            );
            expect(api._captured[0].query).toEqual({
                limit: 10,
                event: '$pageview',
                after: '2026-01-01T00:00:00Z',
            });
        });

        it('getEvent hits the event by id path', async () => {
            const api = makeApi();
            await api.getEvent('evt_1');
            expect(api._captured[0].url).toBe(
                'https://us.posthog.com/api/projects/42/events/evt_1/'
            );
        });
    });

    describe('persons', () => {
        it('listPersons hits the persons path', async () => {
            const api = makeApi();
            await api.listPersons({ email: 'a@example.com' });
            expect(api._captured[0].url).toBe(
                'https://us.posthog.com/api/projects/42/persons/'
            );
            expect(api._captured[0].query).toEqual({ email: 'a@example.com' });
        });

        it('getPerson and updatePerson hit the person by id path', async () => {
            const api = makeApi();
            await api.getPerson('p1');
            await api.updatePerson('p1', { name: 'Ada' });
            expect(api._captured[0].url).toBe(
                'https://us.posthog.com/api/projects/42/persons/p1/'
            );
            expect(api._captured[1]).toMatchObject({
                method: 'PATCH',
                url: 'https://us.posthog.com/api/projects/42/persons/p1/',
                body: { name: 'Ada' },
            });
        });
    });

    describe('hog functions', () => {
        it('list/create/get/update/delete hog functions', async () => {
            const api = makeApi();
            await api.listHogFunctions({ type: 'destination' });
            await api.createHogFunction({
                type: 'destination',
                name: 'Webhook',
            });
            await api.getHogFunction('hf-1');
            await api.updateHogFunction('hf-1', { enabled: false });
            await api.deleteHogFunction('hf-1');

            expect(api._captured[0].url).toBe(
                'https://us.posthog.com/api/projects/42/hog_functions/'
            );
            expect(api._captured[0].query).toEqual({ type: 'destination' });
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[2].url).toBe(
                'https://us.posthog.com/api/projects/42/hog_functions/hf-1/'
            );
            expect(api._captured[3].method).toBe('PATCH');
            expect(api._captured[4].method).toBe('DELETE');
        });
    });

    describe('project_id required', () => {
        it('throws when neither constructor nor options supply project_id', async () => {
            const api = new Api({ api_key: 'k' });
            api._get = async () => ({});
            await expect(api.listInsights()).rejects.toThrow(/project_id/i);
        });
    });
});
