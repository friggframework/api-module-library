const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');
const exported = require('../index');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('Stack Definition', () => {
    it('is an api-key module named stack wired to the Api class', () => {
        expect(Definition.moduleName).toBe('stack');
        expect(Definition.getName()).toBe('stack');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Stack');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exports Api and Definition from index plus UNVALIDATED business mappings', () => {
        expect(exported.Api).toBe(Api);
        expect(exported.Definition).toBe(Definition);
        expect(exported.extensions.mapping.schemas.business.schema).toBe(
            'business@1'
        );
        expect(
            exported.extensions.mapping.schemas.business.validation
        ).toBe('UNVALIDATED');
        expect(
            exported.extensions.mapping.schemas.business.objects.company
        ).toBeDefined();
        expect(
            exported.extensions.mapping.schemas.business.objects.member
        ).toBeDefined();
    });

    it('exposes an apiKey authorization form for bearer_token and base_url', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['bearer_token', 'base_url'])
        );
        expect(reqs.data.jsonSchema.properties.bearer_token.type).toBe(
            'string'
        );
        expect(reqs.data.uiSchema.bearer_token['ui:widget']).toBe('password');
    });

    it('persists bearer_token/baseUrl credentials and company entity fields', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['bearer_token', 'baseUrl'],
            entity: ['companyId', 'integrationType'],
        });
    });

    it('setAuthParams sets bearer token, base URL, companyId, and type', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            bearer_token: 'form-secret',
            base_url: 'https://partner.example.com',
            companyId: '7',
            integrationType: 'partner',
        });
        expect(api.bearer_token).toBe('form-secret');
        expect(api.api_key).toBe('form-secret');
        expect(api.baseUrl).toBe('https://partner.example.com');
        expect(api.companyId).toBe('7');
        expect(api.integrationType).toBe('partner');
    });

    it('getEntityDetails prefers companyId on the Api instance', async () => {
        const api = new Api({ bearer_token: 'k', companyId: 55 });
        api.getCompany = async () => {
            throw new Error('should not call');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('55');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.companyId).toBe(55);
    });

    it('getEntityDetails falls back to getCompany id fields', async () => {
        const api = new Api({ bearer_token: 'k' });
        api.getCompany = async () => ({
            data: { companyId: 88, name: 'Northwind' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('88');
        expect(details.details.name).toBe('Northwind');
    });

    it('getEntityDetails falls back to the bearer-token fingerprint', async () => {
        const api = new Api({ bearer_token: 'key-abc' });
        api.getCompany = async () => ({});
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-3'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-abc'));
        expect(details.identifiers.externalId).not.toBe('stack-account');
    });

    it('fingerprint fallback is STABLE for the same key and UNIQUE across keys', async () => {
        const makeApi = (key) => {
            const api = new Api({ bearer_token: key });
            api.getCompany = async () => ({});
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
        api.bearer_token = null;
        api.api_key = null;
        api.getCompany = async () => ({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]stack-account['"]/);
    });

    it('testAuthRequest performs getCompany (or authorize fallback)', async () => {
        const api = new Api({ bearer_token: 'k', companyId: 1 });
        let called = false;
        api.getCompany = async () => {
            called = true;
            return { companyId: 1 };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
