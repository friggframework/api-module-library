const { Api } = require('../api');

// Fully offline: stub low-level HTTP methods and assert on request options.
function makeApi(overrides = {}) {
    const api = new Api({ api_key: 'test-key', ...overrides });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { ok: true };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'created-1' };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { id: 'patched-1' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 'put-1' };
    };
    return api;
}

describe('Left Hook Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and Authorization header name', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.baseUrl).toBe('https://api.lefthook.com');
            expect(api.api_key_name).toBe('Authorization');
            expect(api.api_key).toBe('abc');
        });

        it('strips a pre-existing Bearer prefix from the stored key', () => {
            const api = new Api({ api_key: 'Bearer secret' });
            expect(api.api_key).toBe('secret');
        });

        it('accepts access_token / apiKey aliases', () => {
            expect(new Api({ access_token: 'from-token' }).api_key).toBe(
                'from-token'
            );
            expect(new Api({ apiKey: 'from-camel' }).api_key).toBe('from-camel');
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

    describe('verifyAuth', () => {
        it('hits GET /v1/auth/verify', async () => {
            const api = makeApi();
            await api.verifyAuth();
            expect(api._captured[0].url).toBe(
                'https://api.lefthook.com/v1/auth/verify'
            );
        });
    });

    describe('companies', () => {
        it('listCompanies hits GET /v1/companies', async () => {
            const api = makeApi();
            await api.listCompanies({ limit: 10 });
            expect(api._captured[0].url).toBe(
                'https://api.lefthook.com/v1/companies'
            );
            expect(api._captured[0].query).toEqual({ limit: 10 });
        });

        it('getCompany / createCompany / updateCompany hit the expected paths', async () => {
            const api = makeApi();
            await api.getCompany('c1');
            await api.createCompany({ name: 'Acme' });
            await api.updateCompany('c1', { name: 'Acme2' });
            expect(api._captured[0].url).toBe(
                'https://api.lefthook.com/v1/companies/c1'
            );
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].body).toEqual({ name: 'Acme' });
            expect(api._captured[2].method).toBe('PATCH');
            expect(api._captured[2].url).toBe(
                'https://api.lefthook.com/v1/companies/c1'
            );
        });
    });

    describe('invoices / deals / milestones sync helpers', () => {
        it('syncInvoiceFromXero PUTs the xero sync path', async () => {
            const api = makeApi();
            await api.syncInvoiceFromXero({ externalId: 'x1' });
            expect(api._captured[0]).toMatchObject({
                method: 'PUT',
                url: 'https://api.lefthook.com/v1/invoices/sync/xero',
                body: { externalId: 'x1' },
            });
        });

        it('syncDealFromHubSpot PUTs the hubspot sync path', async () => {
            const api = makeApi();
            await api.syncDealFromHubSpot({ externalId: 'd1' });
            expect(api._captured[0].url).toBe(
                'https://api.lefthook.com/v1/deals/sync/hubspot'
            );
        });

        it('syncMilestoneFromClickUp PUTs the clickup sync path', async () => {
            const api = makeApi();
            await api.syncMilestoneFromClickUp({ externalId: 'm1' });
            expect(api._captured[0].url).toBe(
                'https://api.lefthook.com/v1/milestones/sync/clickup'
            );
        });
    });

    describe('bank / metrics / snapshots / sync-status', () => {
        it('covers bank account and balance paths', async () => {
            const api = makeApi();
            await api.listBankAccounts();
            await api.getBankAccount('b1');
            await api.syncBankAccountFromMercury({ id: 'b1' });
            await api.createBalanceSnapshot({ amount: 1 });
            expect(api._captured.map((c) => c.url)).toEqual([
                'https://api.lefthook.com/v1/bank-accounts',
                'https://api.lefthook.com/v1/bank-accounts/b1',
                'https://api.lefthook.com/v1/bank-accounts/sync/mercury',
                'https://api.lefthook.com/v1/bank-balances',
            ]);
        });

        it('covers metrics and snapshot paths', async () => {
            const api = makeApi();
            await api.getAllMetrics();
            await api.getDeliveryMetrics();
            await api.getGTMMetrics();
            await api.getFinanceMetrics();
            await api.createDeliverySnapshot({});
            await api.createGTMSnapshot({});
            await api.createFinanceSnapshot({});
            expect(api._captured.map((c) => c.url)).toEqual([
                'https://api.lefthook.com/v1/metrics',
                'https://api.lefthook.com/v1/metrics/delivery',
                'https://api.lefthook.com/v1/metrics/gtm',
                'https://api.lefthook.com/v1/metrics/finance',
                'https://api.lefthook.com/v1/snapshots/delivery',
                'https://api.lefthook.com/v1/snapshots/gtm',
                'https://api.lefthook.com/v1/snapshots/finance',
            ]);
        });

        it('covers sync-status create/update', async () => {
            const api = makeApi();
            await api.createSyncStatus({ status: 'running' });
            await api.updateSyncStatus('s1', { status: 'done' });
            expect(api._captured[0].url).toBe(
                'https://api.lefthook.com/v1/sync-status'
            );
            expect(api._captured[1].url).toBe(
                'https://api.lefthook.com/v1/sync-status/s1'
            );
        });
    });

    describe('change requests', () => {
        it('listChangeRequests forwards filter query params', async () => {
            const api = makeApi();
            await api.listChangeRequests({
                status: 'draft',
                authorId: 'a1',
                category: 'glossary',
                contentId: 'c1',
            });
            expect(api._captured[0].url).toBe(
                'https://api.lefthook.com/v1/domain-model/change-requests'
            );
            expect(api._captured[0].query).toEqual({
                status: 'draft',
                authorId: 'a1',
                category: 'glossary',
                contentId: 'c1',
            });
        });

        it('workflow actions post to the expected subpaths', async () => {
            const api = makeApi();
            const actor = { id: 'u1', name: 'Ada' };
            await api.submitChangeRequest('cr1', actor);
            await api.approveChangeRequest('cr1', actor, 'lgtm');
            await api.rejectChangeRequest('cr1', actor, 'no');
            await api.withdrawChangeRequest('cr1', actor);
            await api.markChangeRequestMerged('cr1', 'abc123', 'https://example.com/pr/1');
            expect(api._captured.map((c) => c.url)).toEqual([
                'https://api.lefthook.com/v1/domain-model/change-requests/cr1/submit',
                'https://api.lefthook.com/v1/domain-model/change-requests/cr1/approve',
                'https://api.lefthook.com/v1/domain-model/change-requests/cr1/reject',
                'https://api.lefthook.com/v1/domain-model/change-requests/cr1/withdraw',
                'https://api.lefthook.com/v1/domain-model/change-requests/cr1/merged',
            ]);
            expect(api._captured[1].body).toEqual({
                reviewer: actor,
                comment: 'lgtm',
            });
        });

        it('updateChangeRequestExternalRef requires an explicit actor', async () => {
            const api = makeApi();
            const actor = { id: 'bot', name: 'Integration' };
            await api.updateChangeRequestExternalRef(
                'cr1',
                'https://example.com/pr/9',
                actor
            );
            expect(api._captured[0]).toMatchObject({
                method: 'PATCH',
                url: 'https://api.lefthook.com/v1/domain-model/change-requests/cr1',
                body: {
                    externalRef: 'https://example.com/pr/9',
                    actor,
                },
            });
        });

        it('registerChangeRequestWebhook posts url/secret/events', async () => {
            const api = makeApi();
            await api.registerChangeRequestWebhook(
                'https://hooks.example.com/lh',
                'whsec_test',
                ['change_request.submitted']
            );
            expect(api._captured[0]).toMatchObject({
                method: 'POST',
                url: 'https://api.lefthook.com/v1/domain-model/change-requests/webhook',
                body: {
                    url: 'https://hooks.example.com/lh',
                    secret: 'whsec_test',
                    events: ['change_request.submitted'],
                },
            });
        });
    });

    describe('domain model content', () => {
        it('list / category / item / history / version hit the expected paths', async () => {
            const api = makeApi();
            await api.listDomainModelContent();
            await api.getDomainModelCategory('glossary');
            await api.getDomainModelItem('glossary', 'term-1');
            await api.getDomainModelHistory('glossary', '/terms/a.md');
            await api.getDomainModelVersion('glossary', '/terms/a.md', 'sha1');
            expect(api._captured[0].url).toBe(
                'https://api.lefthook.com/v1/domain-model'
            );
            expect(api._captured[1].query).toEqual({ category: 'glossary' });
            expect(api._captured[2].query).toEqual({
                category: 'glossary',
                id: 'term-1',
            });
            expect(api._captured[3].url).toBe(
                'https://api.lefthook.com/v1/domain-model/history'
            );
            expect(api._captured[4].query).toEqual({
                category: 'glossary',
                path: '/terms/a.md',
                sha: 'sha1',
            });
        });
    });
});
