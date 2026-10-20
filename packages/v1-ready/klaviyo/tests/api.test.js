const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({ api_key: 'pk_test', ...overrides });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { data: { id: 'created' } };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { data: { id: 'updated' } };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Klaviyo Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and revision', () => {
            const api = new Api({ api_key: 'pk_abc' });
            expect(api.baseUrl).toBe('https://a.klaviyo.com');
            expect(api.revision).toBe('2026-10-15');
            expect(api.api_key).toBe('pk_abc');
            expect(api.api_key_name).toBe('Authorization');
        });

        it('accepts access_token as an alias for api_key', () => {
            const api = new Api({ access_token: 'pk_from_token' });
            expect(api.api_key).toBe('pk_from_token');
        });

        it('emits Authorization: Klaviyo-API-Key <key>', async () => {
            const api = new Api({ api_key: 'pk_secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Klaviyo-API-Key pk_secret');
        });

        it('allows overriding the revision', () => {
            const api = new Api({ api_key: 'pk_x', revision: '2025-01-15' });
            expect(api.revision).toBe('2025-01-15');
        });
    });

    describe('accounts', () => {
        it('listAccounts hits GET /api/accounts/ with revision', async () => {
            const api = makeApi();
            await api.listAccounts();
            const captured = api._captured[0];
            expect(captured.url).toBe('https://a.klaviyo.com/api/accounts/');
            expect(captured.headers.revision).toBe('2026-10-15');
            expect(captured.headers.Accept).toBe('application/json');
        });

        it('getAccount hits GET /api/accounts/{id}/', async () => {
            const api = makeApi();
            await api.getAccount('abc123');
            expect(api._captured[0].url).toBe(
                'https://a.klaviyo.com/api/accounts/abc123/'
            );
        });
    });

    describe('profiles', () => {
        it('listProfiles serializes filter and page cursor', async () => {
            const api = makeApi();
            await api.listProfiles({
                filter: "equals(email,'a@b.com')",
                'page[cursor]': 'cur1',
                'page[size]': 20,
            });
            const { url } = api._captured[0];
            expect(url).toContain('/api/profiles/');
            expect(url).toContain('filter=equals');
            expect(url).toContain('page%5Bcursor%5D=cur1');
            expect(url).toContain('page%5Bsize%5D=20');
        });

        it('createProfile POSTs JSON:API content type', async () => {
            const api = makeApi();
            const body = {
                data: {
                    type: 'profile',
                    attributes: { email: 'a@b.com' },
                },
            };
            await api.createProfile(body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe('https://a.klaviyo.com/api/profiles/');
            expect(captured.headers['Content-Type']).toBe(
                'application/vnd.api+json'
            );
            expect(captured.body).toEqual(body);
        });

        it('updateProfile PATCHes /api/profiles/{id}/', async () => {
            const api = makeApi();
            await api.updateProfile('p1', {
                data: { type: 'profile', id: 'p1', attributes: { first_name: 'A' } },
            });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://a.klaviyo.com/api/profiles/p1/'
            );
        });

        it('getProfile hits GET /api/profiles/{id}/', async () => {
            const api = makeApi();
            await api.getProfile('p1');
            expect(api._captured[0].url).toBe(
                'https://a.klaviyo.com/api/profiles/p1/'
            );
        });
    });

    describe('lists', () => {
        it('listLists / createList / getList / updateList / deleteList', async () => {
            const api = makeApi();
            await api.listLists();
            await api.createList({
                data: { type: 'list', attributes: { name: 'VIP' } },
            });
            await api.getList('L1');
            await api.updateList('L1', {
                data: { type: 'list', id: 'L1', attributes: { name: 'VIP2' } },
            });
            await api.deleteList('L1');
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'POST',
                'GET',
                'PATCH',
                'DELETE',
            ]);
            expect(api._captured[0].url).toBe(
                'https://a.klaviyo.com/api/lists/'
            );
            expect(api._captured[4].url).toBe(
                'https://a.klaviyo.com/api/lists/L1/'
            );
        });

        it('addProfilesToList and removeProfilesFromList hit relationships', async () => {
            const api = makeApi();
            const rel = { data: [{ type: 'profile', id: 'p1' }] };
            await api.addProfilesToList('L1', rel);
            await api.removeProfilesFromList('L1', rel);
            expect(api._captured[0].url).toBe(
                'https://a.klaviyo.com/api/lists/L1/relationships/profiles/'
            );
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[1].method).toBe('DELETE');
            expect(api._captured[1].body).toEqual(rel);
        });
    });

    describe('events / segments / campaigns / metrics', () => {
        it('covers list/get(/create) paths', async () => {
            const api = makeApi();
            await api.listEvents();
            await api.getEvent('e1');
            await api.createEvent({
                data: { type: 'event', attributes: {} },
            });
            await api.listSegments();
            await api.getSegment('s1');
            await api.listCampaigns({
                filter: "equals(messages.channel,'email')",
            });
            await api.getCampaign('c1');
            await api.listMetrics();
            await api.getMetric('m1');
            expect(api._captured[0].url).toBe(
                'https://a.klaviyo.com/api/events/'
            );
            expect(api._captured[5].url).toContain('filter=');
            expect(api._captured[7].url).toBe(
                'https://a.klaviyo.com/api/metrics/'
            );
        });
    });

    describe('webhooks', () => {
        it('CRUD + topics', async () => {
            const api = makeApi();
            await api.listWebhooks();
            await api.createWebhook({
                data: {
                    type: 'webhook',
                    attributes: {
                        name: 'Hook',
                        endpoint_url: 'https://example.com/hook',
                        secret_key: 'sixteen-chars-min',
                    },
                    relationships: {
                        'webhook-topics': {
                            data: [
                                {
                                    type: 'webhook-topic',
                                    id: 'event:klaviyo.opened_email',
                                },
                            ],
                        },
                    },
                },
            });
            await api.getWebhook('w1');
            await api.updateWebhook('w1', {
                data: {
                    type: 'webhook',
                    id: 'w1',
                    attributes: { enabled: true },
                },
            });
            await api.deleteWebhook('w1');
            await api.listWebhookTopics();
            await api.getWebhookTopic('event:klaviyo.opened_email');
            expect(api._captured[0].url).toBe(
                'https://a.klaviyo.com/api/webhooks/'
            );
            expect(api._captured[5].url).toBe(
                'https://a.klaviyo.com/api/webhook-topics/'
            );
            expect(api._captured[6].url).toContain(
                '/api/webhook-topics/event%3Aklaviyo.opened_email/'
            );
        });
    });
});
