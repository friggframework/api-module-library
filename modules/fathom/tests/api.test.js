const { Api } = require('../api');

// Fully offline: we stub the low-level HTTP methods (_get/_post) and assert on
// the request options the API methods construct. No network is touched.
function makeApi(overrides = {}) {
    const api = new Api({ api_key: 'test-key', ...overrides });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { items: [], next_cursor: null };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'wh_1' };
    };
    return api;
}

describe('Fathom Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and X-Api-Key header name', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.baseUrl).toBe('https://api.fathom.ai/external/v1');
            expect(api.api_key_name).toBe('X-Api-Key');
            expect(api.api_key).toBe('abc');
        });

        it('accepts access_token as an alias for api_key', () => {
            const api = new Api({ access_token: 'from-token' });
            expect(api.api_key).toBe('from-token');
        });

        it('adds the X-Api-Key auth header', async () => {
            const api = new Api({ api_key: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers['X-Api-Key']).toBe('secret');
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ api_key: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('listMeetings', () => {
        it('hits GET /meetings', async () => {
            const api = makeApi();
            await api.listMeetings();
            expect(api._captured[0].url).toBe(
                'https://api.fathom.ai/external/v1/meetings'
            );
        });

        it('serializes scalar filters as query params', async () => {
            const api = makeApi();
            await api.listMeetings({
                cursor: 'c1',
                include_summary: true,
                created_after: '2026-01-01T00:00:00Z',
            });
            const { url } = api._captured[0];
            expect(url).toContain('cursor=c1');
            expect(url).toContain('include_summary=true');
            expect(url).toContain(
                'created_after=2026-01-01T00%3A00%3A00Z'
            );
        });

        it('serializes array filters with the key[] convention', async () => {
            const api = makeApi();
            await api.listMeetings({
                recorded_by: ['a@x.com', 'b@x.com'],
                teams: ['Sales'],
            });
            const { url } = api._captured[0];
            expect(url).toContain('recorded_by%5B%5D=a%40x.com');
            expect(url).toContain('recorded_by%5B%5D=b%40x.com');
            expect(url).toContain('teams%5B%5D=Sales');
        });

        it('omits null/undefined params', async () => {
            const api = makeApi();
            await api.listMeetings({ cursor: undefined, meeting_type: null });
            expect(api._captured[0].url).toBe(
                'https://api.fathom.ai/external/v1/meetings'
            );
        });
    });

    describe('listAllMeetings', () => {
        it('follows next_cursor and flattens items', async () => {
            const api = new Api({ api_key: 'k' });
            const pages = [
                { items: [{ recording_id: 1 }], next_cursor: 'p2' },
                { items: [{ recording_id: 2 }], next_cursor: null },
            ];
            let call = 0;
            api._get = async () => pages[call++];
            const all = await api.listAllMeetings();
            expect(all.map((m) => m.recording_id)).toEqual([1, 2]);
        });
    });

    describe('recording content', () => {
        it('getTranscript hits the transcript path', async () => {
            const api = makeApi();
            await api.getTranscript(12345);
            expect(api._captured[0].url).toBe(
                'https://api.fathom.ai/external/v1/recordings/12345/transcript'
            );
        });

        it('getTranscript forwards destination_url', async () => {
            const api = makeApi();
            await api.getTranscript(1, {
                destination_url: 'https://hook.example.com/t',
            });
            expect(api._captured[0].url).toContain(
                'destination_url=https%3A%2F%2Fhook.example.com%2Ft'
            );
        });

        it('getSummary hits the summary path', async () => {
            const api = makeApi();
            await api.getSummary(999);
            expect(api._captured[0].url).toBe(
                'https://api.fathom.ai/external/v1/recordings/999/summary'
            );
        });
    });

    describe('listTeamMembers', () => {
        it('hits GET /team_members', async () => {
            const api = makeApi();
            await api.listTeamMembers();
            expect(api._captured[0].url).toBe(
                'https://api.fathom.ai/external/v1/team_members'
            );
        });
    });

    describe('createWebhook', () => {
        it('POSTs to /webhooks with the body', async () => {
            const api = makeApi();
            const body = {
                destination_url: 'https://hook.example.com',
                triggered_for: ['my_recordings'],
                include_summary: true,
            };
            await api.createWebhook(body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.fathom.ai/external/v1/webhooks'
            );
            expect(captured.body).toEqual(body);
        });
    });
});
