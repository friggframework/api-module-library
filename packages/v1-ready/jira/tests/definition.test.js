const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Jira Definition', () => {
    it('is an oauth2 module named jira wired to the Api class', () => {
        expect(Definition.moduleName).toBe('jira');
        expect(Definition.getName()).toBe('jira');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Jira');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements with authorize URL', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app/redirect/jira',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('auth.atlassian.com/authorize');
    });

    it('persists tokens, cloudId, and site on the credential', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'cloudId',
                'site',
                'siteUrl',
                'siteName',
                'accessTokenExpire',
                'refreshTokenExpire',
            ],
            entity: [],
        });
    });

    it('getToken exchanges code and resolves cloudId', async () => {
        const api = new Api({});
        let codeSeen = null;
        api.getTokenFromCode = async (code) => {
            codeSeen = code;
            api.access_token = 'tok';
            return { access_token: 'tok', refresh_token: 'ref' };
        };
        api.ensureCloudId = async (preferred) => {
            api.setCloudId(preferred || 'resolved-cloud', {
                name: 'Site',
                url: 'https://site.atlassian.net',
            });
            return api.cloudId;
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'abc', cloudId: 'preferred-1' },
        });
        expect(codeSeen).toBe('abc');
        expect(api.cloudId).toBe('preferred-1');
    });

    it('getToken throws when code is missing', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getToken(api, { data: {} })
        ).rejects.toThrow(/authorization code/i);
    });

    it('getEntityDetails uses cloudId as externalId', async () => {
        const api = new Api({ cloudId: 'cloud-xyz', siteName: 'Acme Jira' });
        api.ensureCloudId = async () => api.cloudId;
        api.getCurrentUser = async () => ({
            accountId: 'u1',
            displayName: 'Ada',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('cloud-xyz');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Jira');
        expect(details.details.cloudId).toBe('cloud-xyz');
    });

    it('getCredentialDetails matches entity cloudId', async () => {
        const api = new Api({ cloudId: 'cloud-xyz' });
        api.ensureCloudId = async () => api.cloudId;
        api.getCurrentUser = async () => ({ displayName: 'Ada' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('cloud-xyz');
    });

    it('testAuthRequest ensures cloudId then calls getCurrentUser', async () => {
        const api = new Api({ cloudId: 'c1' });
        let ensured = false;
        let called = false;
        api.ensureCloudId = async () => {
            ensured = true;
            return 'c1';
        };
        api.getCurrentUser = async () => {
            called = true;
            return { accountId: 'u' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(ensured).toBe(true);
        expect(called).toBe(true);
    });
});
