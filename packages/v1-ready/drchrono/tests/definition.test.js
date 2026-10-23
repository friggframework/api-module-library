const { Definition } = require('../definition');
const { Api } = require('../api');

describe('DrChrono Definition', () => {
    it('is an oauth2 module named drchrono wired to the Api class', () => {
        expect(Definition.moduleName).toBe('drchrono');
        expect(Definition.getName()).toBe('drchrono');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('DrChrono');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists access and refresh token credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
            ],
            entity: [],
        });
    });

    it('exposes the required auth methods', () => {
        const m = Definition.requiredAuthMethods;
        expect(typeof m.getToken).toBe('function');
        expect(typeof m.getEntityDetails).toBe('function');
        expect(typeof m.getCredentialDetails).toBe('function');
        expect(typeof m.testAuthRequest).toBe('function');
        expect(typeof m.getAuthorizationRequirements).toBe('function');
        expect(m.apiPropertiesToPersist).toBeDefined();
    });

    it('getAuthorizationRequirements returns oauth2', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('/o/authorize/');
    });

    it('getEntityDetails prefers practice_group as externalId', async () => {
        const api = new Api({});
        api.getCurrentUser = async () => ({
            id: 7,
            username: 'doc',
            email: 'doc@example.com',
            practice_group: 100,
        });
        api.listDoctors = async () => ({
            data: [{ practice_group_name: 'Example Practice' }],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('100');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Example Practice');
        expect(details.details.drchronoUserId).toBe('7');
    });

    it('getEntityDetails falls back to user id without practice_group', async () => {
        const api = new Api({});
        api.getCurrentUser = async () => ({
            id: 7,
            username: 'solo',
        });
        api.listDoctors = async () => ({ data: [] });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('7');
        expect(details.details.name).toBe('solo');
    });

    it('getEntityDetails throws when user id is missing', async () => {
        const api = new Api({});
        api.getCurrentUser = async () => ({ username: 'x' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/user id/i);
    });

    it('getCredentialDetails uses the same externalId', async () => {
        const api = new Api({});
        api.getCurrentUser = async () => ({
            id: 3,
            username: 'n',
            practice_group: 9,
        });
        api.listDoctors = async () => ({ data: [] });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('9');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getCurrentUser', async () => {
        const api = new Api({});
        let called = false;
        api.getCurrentUser = async () => {
            called = true;
            return { id: 1 };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('getToken exchanges the OAuth code', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'the-code' },
        });
        expect(seen).toBe('the-code');
    });

    it('declares UNVALIDATED business mapping for patient→Contact', () => {
        expect(Definition.mappings.business).toBe('extensions.mapping');
        const { extensions } = require('../index');
        expect(extensions.mapping.schemas.business.validation).toBe(
            'UNVALIDATED'
        );
        expect(
            extensions.mapping.schemas.business.objects.patient[0].to
        ).toBe('Contact');
    });
});
