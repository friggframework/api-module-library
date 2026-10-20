const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('Clyde Definition', () => {
    it('is a basic-auth module named clyde wired to the Api class', () => {
        expect(Definition.moduleName).toBe('clyde');
        expect(Definition.getName()).toBe('clyde');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Clyde');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes a basic authorization form for clientKey + secret', async () => {
        const api = new Api({});
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('basic');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['clientKey', 'secret'])
        );
        expect(reqs.data.uiSchema.secret['ui:widget']).toBe('password');
    });

    it('persists clientKey and secret on the credential', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['clientKey', 'secret'],
            entity: [],
        });
    });

    it('setAuthParams wires clientKey/secret onto the Api', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            data: { clientKey: 'form-ck', secret: 'form-sk' },
        });
        expect(api.clientKey).toBe('form-ck');
        expect(api.secret).toBe('form-sk');
        expect(api.username).toBe('form-ck');
        expect(api.password).toBe('form-sk');
    });

    it('getEntityDetails fingerprints the clientKey', async () => {
        const api = new Api({ clientKey: 'key-abc', secret: 's' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-abc'));
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Clyde');
    });

    it('fingerprint is STABLE for the same key and UNIQUE across keys', async () => {
        const idFor = async (key) =>
            (
                await Definition.requiredAuthMethods.getEntityDetails(
                    new Api({ clientKey: key, secret: 's' }),
                    {},
                    {},
                    'u'
                )
            ).identifiers.externalId;
        expect(await idFor('cust-A')).toBe(await idFor('cust-A'));
        expect(await idFor('cust-A')).not.toBe(await idFor('cust-B'));
    });

    it('getCredentialDetails matches the entity fingerprint', async () => {
        const api = new Api({ clientKey: 'cred-key', secret: 's' });
        const entity = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'u'
        );
        const cred = await Definition.requiredAuthMethods.getCredentialDetails(
            api,
            'u'
        );
        expect(cred.identifiers.externalId).toBe(entity.identifiers.externalId);
        expect(cred.identifiers.externalId).toBe(sha256('cred-key'));
    });

    it('throws when nothing can be fingerprinted', async () => {
        const api = new Api({});
        api.clientKey = null;
        api.username = null;
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded shared-constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]clyde-account['"]/);
    });

    it('testAuthRequest performs an authenticated getProducts call', async () => {
        const api = new Api({ clientKey: 'k', secret: 's' });
        let called = false;
        api.getProducts = async () => {
            called = true;
            return { data: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
