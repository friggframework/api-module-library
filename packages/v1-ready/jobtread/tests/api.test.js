const { Api } = require('../api');

// Fully offline: stub _post and assert on the Pave body the API methods build.
function makeApi(overrides = {}) {
    const api = new Api({ grant_key: 'grant_test', ...overrides });
    api._captured = [];
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { ok: true };
    };
    return api;
}

describe('JobTread Api', () => {
    describe('construction & auth', () => {
        it('sets the Pave base URL and stores the grant key', () => {
            const api = new Api({ grant_key: 'grant_abc' });
            expect(api.baseUrl).toBe('https://api.jobtread.com/pave');
            expect(api.grant_key).toBe('grant_abc');
            expect(api.api_key).toBe('grant_abc');
        });

        it('accepts api_key / access_token aliases for grant_key', () => {
            expect(new Api({ api_key: 'from-api' }).grant_key).toBe('from-api');
            expect(new Api({ access_token: 'from-token' }).grant_key).toBe(
                'from-token'
            );
        });

        it('does not inject an auth header (grant key is body-only)', async () => {
            const api = new Api({ grant_key: 'secret' });
            const headers = await api.addAuthHeaders({ Accept: 'application/json' });
            expect(headers.Accept).toBe('application/json');
            expect(headers['X-Api-Key']).toBeUndefined();
            expect(headers.Authorization).toBeUndefined();
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ grant_key: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('pave transport', () => {
        it('POSTs to the base URL with Content-Type application/json', async () => {
            const api = makeApi();
            await api.pave({ version: {} });
            const captured = api._captured[0];
            expect(captured.url).toBe('https://api.jobtread.com/pave');
            expect(captured.headers['Content-Type']).toBe('application/json');
            expect(captured.body.query.version).toEqual({});
        });

        it('injects query.$.grantKey from the configured grant key', async () => {
            const api = makeApi({ grant_key: 'grant_xyz' });
            await api.pave({ currentGrant: { id: {} } });
            expect(api._captured[0].body.query.$).toEqual({
                grantKey: 'grant_xyz',
            });
        });

        it('merges dollarExtras into query.$ alongside grantKey', async () => {
            const api = makeApi({ grant_key: 'g' });
            await api.pave({ currentGrant: { id: {} } }, { notify: false });
            expect(api._captured[0].body.query.$).toEqual({
                grantKey: 'g',
                notify: false,
            });
        });
    });

    describe('getCurrentGrant', () => {
        it('requests currentGrant identity fields', async () => {
            const api = makeApi();
            await api.getCurrentGrant();
            const q = api._captured[0].body.query;
            expect(q.currentGrant.id).toEqual({});
            expect(q.currentGrant.organization.id).toEqual({});
            expect(q.currentGrant.user.emailAddress).toEqual({});
            expect(q.$.grantKey).toBe('grant_test');
        });
    });

    describe('accounts', () => {
        it('listAccounts requires organizationId and hits organization.accounts', async () => {
            const api = makeApi();
            await expect(api.listAccounts({})).rejects.toThrow(/organizationId/);
            await api.listAccounts({ organizationId: 'org1', size: 10 });
            const q = api._captured[0].body.query;
            expect(q.organization.$).toEqual({ id: 'org1' });
            expect(q.organization.accounts.$.size).toBe(10);
            expect(q.organization.accounts.nodes.id).toEqual({});
        });

        it('getAccount selects account by id', async () => {
            const api = makeApi();
            await api.getAccount('acc1');
            expect(api._captured[0].body.query.account.$).toEqual({ id: 'acc1' });
        });

        it('createAccount writes createAccount + selects createdAccount', async () => {
            const api = makeApi();
            const input = {
                name: 'Acme',
                type: 'customer',
                organizationId: 'org1',
            };
            await api.createAccount(input);
            const q = api._captured[0].body.query;
            expect(q.createAccount.$).toEqual(input);
            expect(q.createdAccount.id).toEqual({});
        });

        it('updateAccount writes updateAccount', async () => {
            const api = makeApi();
            await api.updateAccount({ id: 'acc1', name: 'Renamed' });
            expect(api._captured[0].body.query.updateAccount.$).toEqual({
                id: 'acc1',
                name: 'Renamed',
            });
        });
    });

    describe('locations', () => {
        it('createLocation writes createLocation + createdLocation', async () => {
            const api = makeApi();
            await api.createLocation({
                accountId: 'acc1',
                address: '1 Main St',
            });
            const q = api._captured[0].body.query;
            expect(q.createLocation.$.accountId).toBe('acc1');
            expect(q.createdLocation.id).toEqual({});
        });

        it('getLocation / updateLocation hit location paths', async () => {
            const api = makeApi();
            await api.getLocation('loc1');
            expect(api._captured[0].body.query.location.$).toEqual({
                id: 'loc1',
            });
            await api.updateLocation({ id: 'loc1', name: 'Site' });
            expect(api._captured[1].body.query.updateLocation.$).toEqual({
                id: 'loc1',
                name: 'Site',
            });
        });
    });

    describe('jobs', () => {
        it('listJobs / getJob / createJob / updateJob', async () => {
            const api = makeApi();
            await api.listJobs({ organizationId: 'org1', page: 'p2' });
            expect(api._captured[0].body.query.organization.jobs.$.page).toBe(
                'p2'
            );

            await api.getJob('job1');
            expect(api._captured[1].body.query.job.$).toEqual({ id: 'job1' });

            await api.createJob({ locationId: 'loc1', name: 'Roof' });
            expect(api._captured[2].body.query.createJob.$).toEqual({
                locationId: 'loc1',
                name: 'Roof',
            });
            expect(api._captured[2].body.query.createdJob.id).toEqual({});

            await api.updateJob({ id: 'job1', name: 'Roof 2' });
            expect(api._captured[3].body.query.updateJob.$.id).toBe('job1');
        });
    });

    describe('documents', () => {
        it('listDocuments / getDocument / createDocument / updateDocument', async () => {
            const api = makeApi();
            await api.listDocuments({ organizationId: 'org1' });
            expect(
                api._captured[0].body.query.organization.documents.nodes.type
            ).toEqual({});

            await api.getDocument('doc1');
            expect(api._captured[1].body.query.document.$).toEqual({
                id: 'doc1',
            });

            await api.createDocument({
                type: 'customerInvoice',
                jobId: 'job1',
                name: 'Inv 1',
            });
            expect(api._captured[2].body.query.createDocument.$.type).toBe(
                'customerInvoice'
            );
            expect(api._captured[2].body.query.createdDocument.id).toEqual({});

            await api.updateDocument({ id: 'doc1', name: 'Inv 1b' });
            expect(api._captured[3].body.query.updateDocument.$.id).toBe('doc1');
        });
    });

    describe('webhooks', () => {
        it('listWebhooks / getWebhook / createWebhook / deleteWebhook', async () => {
            const api = makeApi();
            await api.listWebhooks({ organizationId: 'org1' });
            expect(
                api._captured[0].body.query.organization.webhooks.nodes.url
            ).toEqual({});

            await api.getWebhook('wh1');
            expect(api._captured[1].body.query.webhook.$).toEqual({ id: 'wh1' });

            const input = {
                organizationId: 'org1',
                url: 'https://hook.example.com/jt',
                eventTypes: ['jobCreated', 'documentSent'],
            };
            await api.createWebhook(input);
            expect(api._captured[2].body.query.createWebhook.$).toEqual(input);
            expect(api._captured[2].body.query.createdWebhook.id).toEqual({});

            await api.deleteWebhook('wh1');
            expect(api._captured[3].body.query.deleteWebhook.$).toEqual({
                id: 'wh1',
            });
        });
    });
});
