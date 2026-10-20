const { Api } = require('../api');

// Fully offline: stub the low-level HTTP methods and assert on the request
// options the API methods construct. No network is touched.
function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'tok',
        refresh_token: 'ref',
        client_id: 'cid',
        client_secret: 'sec',
        redirect_uri: 'https://example.com/redirect/rollworks',
        scope: 'all',
        advertisable_eid: 'ADV123',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { results: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { eid: 'TAL1' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return { status: 204 };
    };
    return api;
}

describe('RollWorks Api', () => {
    describe('construction & auth', () => {
        it('sets the NextRoll base URL and OAuth endpoints', () => {
            const api = makeApi();
            expect(api.baseUrl).toBe('https://services.adroll.com');
            expect(api.tokenUri).toBe('https://services.adroll.com/auth/token');
            expect(api.authorizationUri).toContain(
                'https://services.adroll.com/auth/authorize'
            );
            expect(api.authorizationUri).toContain('client_id=cid');
            expect(api.authorizationUri).toContain('scope=all');
        });

        it('exposes getAuthUri for the OAuth authorize URL', () => {
            const api = makeApi();
            expect(api.getAuthUri()).toBe(api.authorizationUri);
        });

        it('stores advertisable_eid from constructor params', () => {
            const api = makeApi({ advertisable_eid: 'ADV9' });
            expect(api.advertisable_eid).toBe('ADV9');
        });
    });

    describe('getOrganization', () => {
        it('hits GET /api/v1/organization/get', async () => {
            const api = makeApi();
            await api.getOrganization();
            expect(api._captured[0].url).toBe(
                'https://services.adroll.com/api/v1/organization/get'
            );
        });

        it('forwards an optional organization query', async () => {
            const api = makeApi();
            await api.getOrganization({ organization: 'ORG1' });
            expect(api._captured[0].query).toEqual({ organization: 'ORG1' });
        });
    });

    describe('listAdvertisables', () => {
        it('hits GET /api/v1/organization/get_advertisables', async () => {
            const api = makeApi();
            await api.listAdvertisables();
            expect(api._captured[0].url).toBe(
                'https://services.adroll.com/api/v1/organization/get_advertisables'
            );
        });
    });

    describe('listTargetAccounts', () => {
        it('requires advertisable_eid', async () => {
            const api = makeApi({ advertisable_eid: null });
            await expect(api.listTargetAccounts()).rejects.toThrow(
                /advertisable_eid/
            );
        });

        it('hits the audience target_accounts path with advertisable_eid', async () => {
            const api = makeApi();
            await api.listTargetAccounts();
            expect(api._captured[0].url).toBe(
                'https://services.adroll.com/audience/v1/target_accounts?advertisable_eid=ADV123'
            );
        });

        it('accepts an advertisable_eid override and optional filters', async () => {
            const api = makeApi();
            await api.listTargetAccounts({
                advertisable_eid: 'ADV999',
                include_deleted: true,
            });
            const { url } = api._captured[0];
            expect(url).toContain('advertisable_eid=ADV999');
            expect(url).toContain('include_deleted=true');
        });
    });

    describe('getTargetAccount', () => {
        it('hits GET /audience/v1/target_accounts/{talEid}', async () => {
            const api = makeApi();
            await api.getTargetAccount('TAL42');
            expect(api._captured[0].url).toBe(
                'https://services.adroll.com/audience/v1/target_accounts/TAL42?advertisable_eid=ADV123'
            );
        });

        it('requires talEid', async () => {
            const api = makeApi();
            await expect(api.getTargetAccount()).rejects.toThrow(/talEid/);
        });
    });

    describe('createTargetAccount', () => {
        it('POSTs name/domains with advertisable_eid in query and body', async () => {
            const api = makeApi();
            await api.createTargetAccount({
                name: 'Top accounts',
                domains: ['acme.com'],
            });
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://services.adroll.com/audience/v1/target_accounts?advertisable_eid=ADV123'
            );
            expect(captured.body).toEqual({
                name: 'Top accounts',
                domains: ['acme.com'],
                advertisable_eid: 'ADV123',
            });
        });
    });

    describe('updateTargetAccount', () => {
        it('POSTs to /audience/v1/target_accounts/{talEid}', async () => {
            const api = makeApi();
            await api.updateTargetAccount('TAL7', { name: 'Renamed' });
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://services.adroll.com/audience/v1/target_accounts/TAL7?advertisable_eid=ADV123'
            );
            expect(captured.body).toEqual({ name: 'Renamed' });
        });
    });

    describe('deleteTargetAccount', () => {
        it('DELETEs /audience/v1/target_accounts/{talEid}', async () => {
            const api = makeApi();
            await api.deleteTargetAccount('TAL7', { force: true });
            const captured = api._captured[0];
            expect(captured.method).toBe('DELETE');
            expect(captured.url).toBe(
                'https://services.adroll.com/audience/v1/target_accounts/TAL7?advertisable_eid=ADV123&force=true'
            );
        });
    });

    describe('target account items', () => {
        it('listTargetAccountItems defaults the tier to all', async () => {
            const api = makeApi();
            await api.listTargetAccountItems('TAL1');
            expect(api._captured[0].url).toBe(
                'https://services.adroll.com/audience/v1/target_accounts/TAL1/tiers/all/items?advertisable_eid=ADV123'
            );
        });

        it('addTargetAccountItems maps domains[] to items[{domain}]', async () => {
            const api = makeApi();
            await api.addTargetAccountItems('TAL1', {
                domains: ['a.com', 'b.com'],
            });
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toContain('/tiers/all/items?advertisable_eid=ADV123');
            expect(captured.body).toEqual({
                items: [{ domain: 'a.com' }, { domain: 'b.com' }],
            });
        });

        it('removeTargetAccountItems DELETEs with a domains body', async () => {
            const api = makeApi();
            await api.removeTargetAccountItems('TAL1', {
                domains: ['a.com'],
            });
            const captured = api._captured[0];
            expect(captured.method).toBe('DELETE');
            expect(captured.body).toEqual({ domains: ['a.com'] });
        });
    });
});
