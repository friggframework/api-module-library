const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');
const { credentialExternalId } = require('../credential-id');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('Mercury Definition', () => {
    it('is an api-key module named mercury wired to the Api class', () => {
        expect(Definition.moduleName).toBe('mercury');
        expect(Definition.getName()).toBe('mercury');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Mercury');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for the api_key field', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toContain('api_key');
        expect(reqs.data.jsonSchema.properties.api_key.type).toBe('string');
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('persists only the raw api token credential field', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_key_raw'],
            entity: [],
        });
    });

    it('setAuthParams sets the api token from form params', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'form-key',
        });
        expect(api.api_key_raw).toBe('form-key');
        expect(api.api_key).toBe('Bearer form-key');
    });

    it('getEntityDetails derives externalId from the first account id', async () => {
        const api = new Api({ api_key: 'k' });
        api.getAccounts = async () => ({
            accounts: [
                {
                    id: 'acc-primary',
                    name: 'Operating',
                    legalBusinessName: 'Acme Widgets LLC',
                    type: 'mercury',
                    kind: 'checking',
                },
            ],
            page: {},
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('acc-primary');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Widgets LLC');
    });

    it('getEntityDetails falls back to the api-key fingerprint with no accounts', async () => {
        const api = new Api({ api_key: 'key-abc' });
        api.getAccounts = async () => ({ accounts: [], page: {} });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-abc'));
        expect(details.identifiers.externalId).not.toBe('mercury-account');
    });

    it('getEntityDetails uses the fingerprint if the API throws', async () => {
        const api = new Api({ api_key: 'key-boom' });
        api.getAccounts = async () => {
            throw new Error('boom');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-3'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-boom'));
    });

    it('fingerprint fallback is STABLE for the same key and UNIQUE across keys', async () => {
        const makeApi = (key) => {
            const api = new Api({ api_key: key });
            api.getAccounts = async () => ({ accounts: [], page: {} });
            return api;
        };
        const idFor = async (key) =>
            (
                await Definition.requiredAuthMethods.getEntityDetails(
                    makeApi(key),
                    {},
                    {},
                    'u'
                )
            ).identifiers.externalId;

        expect(await idFor('cust-A-key')).toBe(await idFor('cust-A-key'));
        expect(await idFor('cust-A-key')).not.toBe(await idFor('cust-B-key'));
    });

    it('getCredentialDetails uses credentialExternalId(module, account, user)', async () => {
        const api = new Api({ api_key: 'k' });
        api.getAccounts = async () => ({
            accounts: [{ id: 'acc-9', name: 'Ops', legalBusinessName: 'Co' }],
            page: {},
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe(
            credentialExternalId('mercury', 'acc-9', 'user-c')
        );
        expect(details.identifiers.externalId).toBe(
            sha256('mercury:acc-9:user-c')
        );
    });

    it('throws rather than returning a shared constant when nothing can be derived', async () => {
        const api = new Api({});
        api.api_key_raw = null;
        api.getAccounts = async () => ({ accounts: [], page: {} });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]mercury-account['"]/);
    });

    it('testAuthRequest performs an authenticated list call', async () => {
        const api = new Api({ api_key: 'k' });
        let called = false;
        api.getAccounts = async () => {
            called = true;
            return { accounts: [], page: {} };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env reads MERCURY_API_KEY', () => {
        expect(Object.keys(Definition.env)).toContain('api_key');
    });
});
