const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Attentive Definition', () => {
    it('is an oauth2 module named attentive wired to the Api class', () => {
        expect(Definition.moduleName).toBe('attentive');
        expect(Definition.getName()).toBe('attentive');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Attentive');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements via the Api', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://cb.example/attentive',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('client_id=cid');
    });

    it('persists access_token and id_token only', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'id_token'],
            entity: [],
        });
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'tok', id_token: 'idt' };
        };
        const result = await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code' },
        });
        expect(seen).toBe('auth-code');
        expect(result.access_token).toBe('tok');
    });

    it('getToken throws when the code is missing', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getToken(api, { data: {} })
        ).rejects.toThrow(/authorization code/i);
    });

    it('getEntityDetails derives externalId from /me companyId', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({
            companyId: 'MDc6Q29tcGFueTI',
            companyName: 'Hudson & Ivy',
            attentiveDomainName: 'hudsonivy.attn.tv',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('MDc6Q29tcGFueTI');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Hudson & Ivy');
        expect(details.details.attentiveDomainName).toBe('hudsonivy.attn.tv');
    });

    it('getEntityDetails throws when /me has no companyId', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({ companyName: 'Nope' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/companyId/i);
    });

    it('getCredentialDetails mirrors companyId', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({ companyId: 'co_9' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('co_9');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getMe', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getMe = async () => {
            called = true;
            return { companyId: 'co' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env uses snake_case keys required by the schema', () => {
        expect(Object.keys(Definition.env).sort()).toEqual(
            [
                'base_url',
                'client_id',
                'client_secret',
                'redirect_uri',
                'scope',
            ].sort()
        );
    });

    it('retains no mongoose manager/models in the package', () => {
        const root = path.join(__dirname, '..');
        expect(fs.existsSync(path.join(root, 'manager.js'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'models'))).toBe(false);
    });
});
