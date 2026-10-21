const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');
const pkg = require('../index');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('Planhat Definition', () => {
    it('is an api-key module named planhat wired to the Api class', () => {
        expect(Definition.moduleName).toBe('planhat');
        expect(Definition.getName()).toBe('planhat');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Planhat');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for api_token', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(
                new Api({})
            );
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toContain('api_token');
        expect(reqs.data.uiSchema.api_token['ui:widget']).toBe('password');
    });

    it('persists only the api_token credential', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_token'],
            entity: [],
        });
    });

    it('setAuthParams sets the api token from form params', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_token: 'form-token',
        });
        expect(api.api_token).toBe('form-token');
        expect(api.api_key).toBe('Bearer form-token');
    });

    it('getEntityDetails derives externalId from the first user email', async () => {
        const api = new Api({ api_token: 'k' });
        api.listUsers = async () => [
            { email: 'csm@lefthook.co', nickName: 'Left Hook CSM' },
        ];
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('csm@lefthook.co');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Left Hook CSM');
    });

    it('getEntityDetails falls back to the api-token fingerprint with no users', async () => {
        const api = new Api({ api_token: 'key-abc' });
        api.listUsers = async () => [];
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-abc'));
        expect(details.identifiers.externalId).not.toBe('planhat-account');
    });

    it('getEntityDetails uses the fingerprint if the API throws', async () => {
        const api = new Api({ api_token: 'key-boom' });
        api.listUsers = async () => {
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
            const api = new Api({ api_token: key });
            api.listUsers = async () => [];
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
        const credIdFor = async (key) =>
            (
                await Definition.requiredAuthMethods.getCredentialDetails(
                    makeApi(key),
                    'u'
                )
            ).identifiers.externalId;

        expect(await idFor('cust-A-key')).toBe(await idFor('cust-A-key'));
        expect(await idFor('cust-A-key')).not.toBe(await idFor('cust-B-key'));
        expect(await idFor('cust-A-key')).toBe(await credIdFor('cust-A-key'));
    });

    it('throws rather than returning a shared constant when nothing can be derived', async () => {
        const api = new Api({});
        api.api_token = null;
        api.listUsers = async () => [];
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]planhat-account['"]/);
    });

    it('testAuthRequest performs an authenticated listUsers call', async () => {
        const api = new Api({ api_token: 'k' });
        let called = false;
        api.listUsers = async () => {
            called = true;
            return [];
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('exports ADR-057 mappings via extensions.mapping (UNVALIDATED)', () => {
        expect(Definition.mappings).toEqual({
            business: 'extensions.mapping',
            accountHealth: 'extensions.mapping',
        });
        expect(pkg.extensions.mapping.schemas.business.validation).toBe(
            'UNVALIDATED'
        );
        expect(pkg.extensions.mapping.schemas.accountHealth.validation).toBe(
            'UNVALIDATED'
        );
        expect(
            pkg.extensions.mapping.schemas.accountHealth.objects.company[0].to
        ).toBe('AccountHealth');
        expect(
            pkg.extensions.mapping.schemas.accountHealth.objects.company[0]
                .sameAs
        ).toBe('https://friggframework.org/canonical/AccountHealth');
    });
});
