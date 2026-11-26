const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Dentrix Ascend Definition', () => {
    it('is an oauth2 client_credentials module named dentrixascend', () => {
        expect(Definition.moduleName).toBe('dentrixascend');
        expect(Definition.getName()).toBe('dentrixascend');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('DentrixAscend');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes client_credentials authorization requirements', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('oauth2');
        expect(reqs.grantType).toBe('client_credentials');
        expect(reqs.data.jsonSchema.required).toContain('organization_id');
    });

    it('persists access token + client credentials and organizationId entity', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'expires_in',
                'token_type',
                'accessTokenExpire',
                'client_id',
                'client_secret',
            ],
            entity: ['organizationId'],
        });
    });

    it('getToken mints a client_credentials token and sets organization id', async () => {
        const api = new Api({
            client_id: 'old',
            client_secret: 'old-s',
        });
        api.getTokenFromClientCredentials = async () => {
            api.access_token = 'minted';
            return { access_token: 'minted', expires_in: '3599' };
        };
        const res = await Definition.requiredAuthMethods.getToken(api, {
            client_id: 'new-id',
            client_secret: 'new-secret',
            organization_id: 'org-42',
        });
        expect(res.access_token).toBe('minted');
        expect(api.client_id).toBe('new-id');
        expect(api.organizationId).toBe('org-42');
    });

    it('setAuthParams wires client credentials and organization id', async () => {
        const api = new Api({});
        api.setTokens = async ({ access_token }) => {
            api.access_token = access_token;
        };
        await Definition.requiredAuthMethods.setAuthParams(api, {
            client_id: 'cid',
            client_secret: 'csec',
            organization_id: 'org-7',
            access_token: 'tok',
        });
        expect(api.client_id).toBe('cid');
        expect(api.client_secret).toBe('csec');
        expect(api.organizationId).toBe('org-7');
        expect(api.access_token).toBe('tok');
    });

    it('getEntityDetails uses configured organization id', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            organization_id: 'org-55',
            access_token: 't',
        });
        api.getOrganization = async (id) => ({
            statusCode: 200,
            data: { id, name: 'Sunrise Dental' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('org-55');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Sunrise Dental');
        expect(details.details.organizationId).toBe('org-55');
    });

    it('getEntityDetails falls back to LinkedOrgs first id', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            access_token: 't',
        });
        api.listLinkedOrganizations = async () => ({
            organizations: ['org-from-mapper', 'org-other'],
        });
        api.getOrganization = async () => ({
            data: { name: 'Mapped Org' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('org-from-mapper');
        expect(api.organizationId).toBe('org-from-mapper');
    });

    it('getEntityDetails throws when no organization can be derived', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            access_token: 't',
        });
        api.listLinkedOrganizations = async () => ({ organizations: [] });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable organization identity/i);
    });

    it('getCredentialDetails agrees with entity externalId', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            organization_id: 'org-99',
            access_token: 't',
        });
        api.getOrganization = async () => ({ data: { name: 'X' } });
        const cred =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(cred.identifiers.externalId).toBe('org-99');
    });

    it('testAuthRequest delegates to the Api smoke call', async () => {
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            organization_id: 'org-1',
            access_token: 't',
        });
        let called = false;
        api.testAuthRequest = async () => {
            called = true;
            return { ok: true };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env keys use DENTRIX_ASCEND_* prefixes (no client-specific prefixes)', () => {
        expect(Object.keys(Definition.env).sort()).toEqual(
            [
                'DENTRIX_ASCEND_API_HOST',
                'DENTRIX_ASCEND_ORGANIZATION_ID',
                'base_url',
                'client_id',
                'client_secret',
                'scope',
            ].sort()
        );
    });
});
