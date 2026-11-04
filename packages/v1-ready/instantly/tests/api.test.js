const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({ api_key: 'test-key', ...overrides });
    api.sent = [];
    const record = (method) => async (options) => {
        api.sent.push({ method, ...options });
        return { items: [], next_starting_after: null };
    };
    api._get = record('GET');
    api._post = record('POST');
    api._patch = record('PATCH');
    api._delete = record('DELETE');
    return api;
}

describe('Instantly Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and Authorization header name', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.baseUrl).toBe('https://api.instantly.ai/api/v2');
            expect(api.api_key_name).toBe('Authorization');
            expect(api.api_key).toBe('abc');
        });

        it('strips a Bearer prefix from constructor input', () => {
            const api = new Api({ api_key: 'Bearer already-prefixed' });
            expect(api.api_key).toBe('already-prefixed');
        });

        it('accepts access_token as an alias for api_key', () => {
            const api = new Api({ access_token: 'from-token' });
            expect(api.api_key).toBe('from-token');
        });

        it('adds Authorization: Bearer <key>', async () => {
            const api = new Api({ api_key: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ api_key: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('workspace', () => {
        it('getWorkspace GETs /workspaces/current', async () => {
            const api = makeApi();
            await api.getWorkspace();
            expect(api.sent[0]).toMatchObject({
                method: 'GET',
                url: 'https://api.instantly.ai/api/v2/workspaces/current',
            });
        });
    });

    describe('campaigns', () => {
        it('listCampaigns GETs /campaigns with query', async () => {
            const api = makeApi();
            await api.listCampaigns({ limit: 5, status: 1 });
            expect(api.sent[0].url).toBe(
                'https://api.instantly.ai/api/v2/campaigns'
            );
            expect(api.sent[0].query).toEqual({ limit: 5, status: 1 });
        });

        it('getCampaign GETs /campaigns/{id}', async () => {
            const api = makeApi();
            await api.getCampaign('camp-1');
            expect(api.sent[0].url).toBe(
                'https://api.instantly.ai/api/v2/campaigns/camp-1'
            );
        });

        it('createCampaign POSTs /campaigns', async () => {
            const api = makeApi();
            const body = {
                name: 'Summer',
                campaign_schedule: { schedules: [] },
            };
            await api.createCampaign(body);
            expect(api.sent[0].method).toBe('POST');
            expect(api.sent[0].body).toEqual(body);
        });

        it('patchCampaign PATCHes /campaigns/{id}', async () => {
            const api = makeApi();
            await api.patchCampaign('camp-1', { name: 'Renamed' });
            expect(api.sent[0].method).toBe('PATCH');
            expect(api.sent[0].url).toContain('/campaigns/camp-1');
            expect(api.sent[0].body).toEqual({ name: 'Renamed' });
        });

        it('getCampaignAnalytics GETs /campaigns/analytics', async () => {
            const api = makeApi();
            await api.getCampaignAnalytics({ id: 'camp-1' });
            expect(api.sent[0].url).toBe(
                'https://api.instantly.ai/api/v2/campaigns/analytics'
            );
            expect(api.sent[0].query).toEqual({ id: 'camp-1' });
        });

        it('getDailyCampaignAnalytics GETs /campaigns/analytics/daily', async () => {
            const api = makeApi();
            await api.getDailyCampaignAnalytics({
                campaign_id: 'camp-1',
                start_date: '2026-01-01',
            });
            expect(api.sent[0].url).toBe(
                'https://api.instantly.ai/api/v2/campaigns/analytics/daily'
            );
        });
    });

    describe('accounts', () => {
        it('listAccounts GETs /accounts', async () => {
            const api = makeApi();
            await api.listAccounts({ limit: 10 });
            expect(api.sent[0].url).toBe(
                'https://api.instantly.ai/api/v2/accounts'
            );
        });

        it('getAccount GETs /accounts/{email} with encoding', async () => {
            const api = makeApi();
            await api.getAccount('a+b@example.com');
            expect(api.sent[0].url).toBe(
                'https://api.instantly.ai/api/v2/accounts/a%2Bb%40example.com'
            );
        });

        it('createAccount POSTs /accounts', async () => {
            const api = makeApi();
            await api.createAccount({ email: 'a@example.com' });
            expect(api.sent[0].method).toBe('POST');
        });

        it('patchAccount PATCHes /accounts/{email}', async () => {
            const api = makeApi();
            await api.patchAccount('a@example.com', { first_name: 'Ada' });
            expect(api.sent[0].method).toBe('PATCH');
            expect(api.sent[0].url).toContain('/accounts/a%40example.com');
        });
    });

    describe('leads', () => {
        it('listLeads POSTs /leads/list', async () => {
            const api = makeApi();
            const body = { campaign: 'camp-1', limit: 20 };
            await api.listLeads(body);
            expect(api.sent[0]).toMatchObject({
                method: 'POST',
                url: 'https://api.instantly.ai/api/v2/leads/list',
                body,
            });
        });

        it('getLead GETs /leads/{id}', async () => {
            const api = makeApi();
            await api.getLead('lead-1');
            expect(api.sent[0].url).toBe(
                'https://api.instantly.ai/api/v2/leads/lead-1'
            );
        });

        it('createLead POSTs /leads', async () => {
            const api = makeApi();
            await api.createLead({ email: 'l@example.com' });
            expect(api.sent[0].method).toBe('POST');
            expect(api.sent[0].url).toBe(
                'https://api.instantly.ai/api/v2/leads'
            );
        });

        it('patchLead PATCHes /leads/{id}', async () => {
            const api = makeApi();
            await api.patchLead('lead-1', { first_name: 'Lee' });
            expect(api.sent[0].method).toBe('PATCH');
        });
    });

    describe('lead lists', () => {
        it('listLeadLists GETs /lead-lists', async () => {
            const api = makeApi();
            await api.listLeadLists({ limit: 5 });
            expect(api.sent[0].url).toBe(
                'https://api.instantly.ai/api/v2/lead-lists'
            );
        });

        it('getLeadList / createLeadList / patchLeadList hit expected paths', async () => {
            const api = makeApi();
            await api.getLeadList('ll-1');
            await api.createLeadList({ name: 'Prospects' });
            await api.patchLeadList('ll-1', { name: 'Hot' });
            expect(api.sent[0].url).toContain('/lead-lists/ll-1');
            expect(api.sent[1].method).toBe('POST');
            expect(api.sent[2].method).toBe('PATCH');
        });
    });

    describe('webhooks', () => {
        it('listWebhooks GETs /webhooks', async () => {
            const api = makeApi();
            await api.listWebhooks({ event_type: 'email_sent' });
            expect(api.sent[0].url).toBe(
                'https://api.instantly.ai/api/v2/webhooks'
            );
            expect(api.sent[0].query).toEqual({ event_type: 'email_sent' });
        });

        it('createWebhook POSTs target_hook_url', async () => {
            const api = makeApi();
            const body = {
                target_hook_url: 'https://hook.example.com/instantly',
                event_type: 'reply_received',
            };
            await api.createWebhook(body);
            expect(api.sent[0]).toMatchObject({
                method: 'POST',
                url: 'https://api.instantly.ai/api/v2/webhooks',
                body,
            });
        });

        it('getWebhook / patchWebhook / deleteWebhook', async () => {
            const api = makeApi();
            await api.getWebhook('wh-1');
            await api.patchWebhook('wh-1', { name: 'Replies' });
            await api.deleteWebhook('wh-1');
            expect(api.sent.map((s) => s.method)).toEqual([
                'GET',
                'PATCH',
                'DELETE',
            ]);
            expect(api.sent[2].url).toBe(
                'https://api.instantly.ai/api/v2/webhooks/wh-1'
            );
        });
    });

    describe('testAuth', () => {
        it('calls getWorkspace', async () => {
            const api = makeApi();
            await api.testAuth();
            expect(api.sent[0].url).toContain('/workspaces/current');
        });
    });
});
