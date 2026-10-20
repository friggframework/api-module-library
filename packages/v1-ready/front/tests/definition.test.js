const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Front Definition', () => {
    it('is an oauth2 module named front wired to the Api class', () => {
        expect(Definition.moduleName).toBe('front');
        expect(Definition.getName()).toBe('front');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Front');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements via the Api', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example/redirect/front',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('app.frontapp.com/oauth/authorize');
    });

    it('persists access_token and refresh_token', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: [],
        });
    });

    it('getToken exchanges the code via Basic-auth token endpoint', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code' },
        });
        expect(seen).toBe('auth-code');
    });

    it('getEntityDetails uses /me company id as externalId', async () => {
        const api = new Api({});
        api.getMe = async () => ({ id: 'cmp_k30', name: 'Dunder Mifflin' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('cmp_k30');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Dunder Mifflin');
    });

    it('getCredentialDetails uses /me company id', async () => {
        const api = new Api({});
        api.getMe = async () => ({ id: 'cmp_k30', name: 'Dunder Mifflin' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('cmp_k30');
    });

    it('throws when /me has no company id', async () => {
        const api = new Api({});
        api.getMe = async () => ({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/company id/i);
    });

    it('testAuthRequest calls getMe', async () => {
        const api = new Api({});
        let called = false;
        api.getMe = async () => {
            called = true;
            return { id: 'cmp_x' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('retains no Mongoose manager/models in the package', () => {
        const root = path.join(__dirname, '..');
        expect(fs.existsSync(path.join(root, 'manager.js'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'models'))).toBe(false);
    });
});
