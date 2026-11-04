const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({ api_key: 'test-token', ...overrides });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options, stringify) => {
        api._captured.push({
            method: 'POST',
            stringify,
            ...options,
        });
        return { response: { accounts: { hits: [] }, service_id: '2324' } };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { status: 'Success' };
    };
    api._request = async (url, options) => {
        api._captured.push({ method: options.method, url, ...options });
        return { status: 'Success' };
    };
    return api;
}

describe('Totango Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and app-token header name', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.baseUrl).toBe('https://api.totango.com');
            expect(api.api_key_name).toBe('app-token');
            expect(api.api_key).toBe('abc');
        });

        it('accepts app_token and access_token aliases', () => {
            expect(new Api({ app_token: 'from-app' }).api_key).toBe('from-app');
            expect(new Api({ access_token: 'from-token' }).api_key).toBe(
                'from-token'
            );
        });

        it('honors base_url override (EU)', () => {
            const api = new Api({
                api_key: 'k',
                base_url: 'https://api-eu1.totango.com',
            });
            expect(api.baseUrl).toBe('https://api-eu1.totango.com');
        });

        it('adds the app-token auth header', async () => {
            const api = new Api({ api_key: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers['app-token']).toBe('secret');
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ api_key: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('searchAccounts', () => {
        it('POSTs form body to /api/v1/search/accounts without JSON stringify', async () => {
            const api = makeApi();
            const query = {
                terms: [
                    { type: 'string', term: 'status_group', in_list: ['paying'] },
                ],
                fields: [{ type: 'string', term: 'health' }],
                count: 10,
                offset: 0,
            };
            await api.searchAccounts(query);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.totango.com/api/v1/search/accounts'
            );
            expect(captured.stringify).toBe(false);
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(captured.body.get('query')).toBe(JSON.stringify(query));
        });
    });

    describe('searchAccountsWithHealth', () => {
        it('injects health and health_trend fields', async () => {
            const api = makeApi();
            await api.searchAccountsWithHealth({
                terms: [
                    { type: 'string', term: 'status_group', in_list: ['paying'] },
                ],
            });
            const query = JSON.parse(api._captured[0].body.get('query'));
            expect(query.fields.some((f) => f.term === 'health')).toBe(true);
            expect(query.fields.some((f) => f.type === 'health_trend')).toBe(
                true
            );
        });
    });

    describe('searchUsers', () => {
        it('POSTs to /api/v1/search/users', async () => {
            const api = makeApi();
            await api.searchUsers({
                terms: [],
                fields: [],
                count: 1,
                offset: 0,
            });
            expect(api._captured[0].url).toBe(
                'https://api.totango.com/api/v1/search/users'
            );
        });
    });

    describe('events', () => {
        it('listEvents hits GET /api/v2/events with account_id', async () => {
            const api = makeApi();
            await api.listEvents({ account_id: '19934' });
            expect(api._captured[0].url).toBe(
                'https://api.totango.com/api/v2/events?account_id=19934'
            );
        });

        it('searchEvents POSTs query with empty fields and optional account_id', async () => {
            const api = makeApi();
            await api.searchEvents(
                {
                    terms: [
                        {
                            type: 'event_property',
                            name: 'event_type',
                            eq: 'task',
                        },
                    ],
                    count: 5,
                },
                { account_id: 'A1' }
            );
            const captured = api._captured[0];
            expect(captured.url).toBe(
                'https://api.totango.com/api/v2/events/search'
            );
            expect(captured.body.get('account_id')).toBe('A1');
            const query = JSON.parse(captured.body.get('query'));
            expect(query.fields).toEqual([]);
            expect(query.count).toBe(5);
        });

        it('searchTasks adds event_type=task term', async () => {
            const api = makeApi();
            await api.searchTasks({});
            const query = JSON.parse(api._captured[0].body.get('query'));
            expect(
                query.terms.some(
                    (t) => t.name === 'event_type' && t.eq === 'task'
                )
            ).toBe(true);
        });
    });

    describe('plan summary & definitions', () => {
        it('getAccountPlanSummary hits the plan_summary path', async () => {
            const api = makeApi();
            await api.getAccountPlanSummary('19934');
            expect(api._captured[0].url).toBe(
                'https://api.totango.com/api/v3/accounts/19934/plan_summary'
            );
        });

        it('listActivityTypes / listTouchpointTypes / listTouchpointTags', async () => {
            const api = makeApi();
            await api.listActivityTypes();
            await api.listTouchpointTypes();
            await api.listTouchpointTags();
            expect(api._captured.map((c) => c.url)).toEqual([
                'https://api.totango.com/api/v3/activity-types',
                'https://api.totango.com/api/v3/touchpoint-types',
                'https://api.totango.com/api/v3/touchpoint-tags',
            ]);
        });
    });

    describe('tasks', () => {
        it('createTask POSTs JSON to /api/v3/tasks', async () => {
            const api = makeApi();
            const body = {
                title: 'Follow up',
                account_id: '19934',
                activity_type_id: 'support',
            };
            await api.createTask(body);
            const captured = api._captured[0];
            expect(captured.url).toBe('https://api.totango.com/api/v3/tasks');
            expect(captured.body).toEqual(body);
        });

        it('updateTask PUTs to /api/v3/tasks/{id}', async () => {
            const api = makeApi();
            await api.updateTask('t1', { priority: 1, account_id: '19934' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(
                'https://api.totango.com/api/v3/tasks/t1'
            );
        });

        it('deleteTask DELETEs with JSON body', async () => {
            const api = makeApi();
            await api.deleteTask('t1', { account_id: '19934' });
            const captured = api._captured[0];
            expect(captured.method).toBe('DELETE');
            expect(captured.url).toBe(
                'https://api.totango.com/api/v3/tasks/t1'
            );
            expect(JSON.parse(captured.body)).toEqual({ account_id: '19934' });
        });
    });

    describe('whoami, team, CDH batch status', () => {
        it('getWhoAmI hits /api/v1/users/whoami', async () => {
            const api = makeApi();
            await api.getWhoAmI();
            expect(api._captured[0].url).toBe(
                'https://api.totango.com/api/v1/users/whoami'
            );
        });

        it('getTeam hits /api/v2/teams/{id}', async () => {
            const api = makeApi();
            await api.getTeam('team-1');
            expect(api._captured[0].url).toBe(
                'https://api.totango.com/api/v2/teams/team-1'
            );
        });

        it('getBatchStatus uses CDH host and Authorization app-token', async () => {
            const api = new Api({ api_key: 'tok' });
            let seenUrl;
            let seenHeaders;
            api._get = async (options) => {
                seenUrl = options.url;
                seenHeaders = await api.addAuthHeaders({});
                return { batchId: 'b1' };
            };
            const result = await api.getBatchStatus('batch-9');
            expect(result.batchId).toBe('b1');
            expect(seenUrl).toBe(
                'https://int-hub.totango.com/api/v1/status/batch-9'
            );
            expect(seenHeaders.Authorization).toBe('app-token tok');
            // After the call, normal app-token header auth is restored.
            const restored = await api.addAuthHeaders({});
            expect(restored['app-token']).toBe('tok');
            expect(restored.Authorization).toBeUndefined();
        });
    });
});
