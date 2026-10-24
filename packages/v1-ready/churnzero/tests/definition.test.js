const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('ChurnZero Definition', () => {
    it('is a basic-auth module named churnzero wired to the Api class', () => {
        expect(Definition.moduleName).toBe('churnzero');
        expect(Definition.getName()).toBe('churnzero');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('ChurnZero');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes a basic authorization form for username, api_key, base_url', async () => {
        const api = new Api({});
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('basic');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['username', 'api_key', 'base_url'])
        );
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('persists username, api_key, and base_url', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['username', 'api_key', 'base_url'],
            entity: [],
        });
    });

    it('setAuthParams wires Basic credentials and base_url', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            username: 'alice',
            api_key: 'secret',
            base_url: 'https://acme.us1app.churnzero.net/public/v1/',
        });
        expect(api.username).toBe('alice');
        expect(api.password).toBe('secret');
        expect(api.api_key).toBe('secret');
        expect(api.baseUrl).toBe(
            'https://acme.us1app.churnzero.net/public/v1'
        );
        expect(api.base_url).toBe(api.baseUrl);
    });

    it('getEntityDetails prefers UserAccount email', async () => {
        const api = new Api({ username: 'u', api_key: 'k' });
        api.listUserAccounts = async () => ({
            value: [{ Id: 1, Email: 'csm@acme.com', Name: 'CSM' }],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('csm@acme.com');
        expect(details.details.name).toBe('CSM');
    });

    it('getEntityDetails falls back to credential fingerprint', async () => {
        const api = new Api({
            username: 'u',
            api_key: 'k',
            base_url: 'https://acme.example/public/v1',
        });
        api.listUserAccounts = async () => ({ value: [] });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe(
            sha256(['u', api.baseUrl, 'k'].join('|'))
        );
    });

    it('fingerprint is stable for the same credentials and unique across tenants', async () => {
        const idFor = async (username, key, base) => {
            const api = new Api({
                username,
                api_key: key,
                base_url: base,
            });
            api.listUserAccounts = async () => ({ value: [] });
            return (
                await Definition.requiredAuthMethods.getEntityDetails(
                    api,
                    {},
                    {},
                    'u'
                )
            ).identifiers.externalId;
        };
        expect(
            await idFor('a', 'k', 'https://t1.example/public/v1')
        ).toBe(await idFor('a', 'k', 'https://t1.example/public/v1'));
        expect(
            await idFor('a', 'k', 'https://t1.example/public/v1')
        ).not.toBe(await idFor('a', 'k', 'https://t2.example/public/v1'));
    });

    it('throws when nothing can be derived', async () => {
        const api = new Api({});
        api.username = null;
        api.api_key = null;
        api.password = null;
        api.listUserAccounts = async () => ({ value: [] });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest calls api.testAuth', async () => {
        const api = new Api({ username: 'u', api_key: 'k' });
        let called = false;
        api.testAuth = async () => {
            called = true;
            return { value: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('retains no hardcoded shared-constant externalId in source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]churnzero-account['"]/);
    });
});
