const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('NetX Definition', () => {
    it('is an oauth2 module named netx wired to the Api class', () => {
        expect(Definition.moduleName).toBe('netx');
        expect(Definition.getName()).toBe('netx');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('NetX');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes OAuth authorization requirements that collect baseUrl', async () => {
        const api = new Api({
            client_id: 'cid',
            baseUrl: 'https://example.netx.net',
        });
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('oauth2');
        expect(reqs.data.jsonSchema.required).toContain('baseUrl');
        expect(reqs.url).toContain('https://example.netx.net/app?');
    });

    it('persists tokens and baseUrl on the credential', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'baseUrl',
                'accessTokenExpire',
            ],
            entity: [],
        });
    });

    it('getToken sets baseUrl from form params then exchanges the code', async () => {
        const api = new Api({ client_id: 'cid' });
        let exchanged;
        api.getTokenFromCode = async (code) => {
            exchanged = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code', baseUrl: 'https://tenant.netx.net' },
        });
        expect(api.baseUrl).toBe('https://tenant.netx.net');
        expect(exchanged).toBe('auth-code');
    });

    it('getEntityDetails derives externalId from getSelf.userId', async () => {
        const api = new Api({
            access_token: 't',
            baseUrl: 'https://example.netx.net',
        });
        api.getSelf = async () => ({
            result: {
                userId: 42,
                firstName: 'Fred',
                lastName: 'Fandango',
                email: 'ff@example.com',
                username: 'ffandango',
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('42');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Fred Fandango');
        expect(details.details.email).toBe('ff@example.com');
    });

    it('getCredentialDetails uses the same userId', async () => {
        const api = new Api({
            access_token: 't',
            baseUrl: 'https://example.netx.net',
        });
        api.getSelf = async () => ({
            result: { userId: 7, username: 'x' },
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('7');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('throws when getSelf has no userId', async () => {
        const api = new Api({
            access_token: 't',
            baseUrl: 'https://example.netx.net',
        });
        api.getSelf = async () => ({ result: {} });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/userId/);
    });

    it('testAuthRequest calls getSelf', async () => {
        const api = new Api({
            access_token: 't',
            baseUrl: 'https://example.netx.net',
        });
        let called = false;
        api.getSelf = async () => {
            called = true;
            return { result: { userId: 1 } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('moduleName matches the definition schema pattern', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).toMatch(/moduleName:\s*config\.name/);
        expect(Definition.moduleName).toBe('netx');
    });
});
