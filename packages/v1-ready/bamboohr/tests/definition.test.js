const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('BambooHR Definition', () => {
    it('is an api-key module named bamboohr wired to the Api class', () => {
        expect(Definition.moduleName).toBe('bamboohr');
        expect(Definition.getName()).toBe('bamboohr');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('BambooHR');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes a basic authorization form for api_key + companyDomain', async () => {
        const api = new Api({});
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('basic');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['api_key', 'companyDomain'])
        );
        expect(reqs.data.jsonSchema.properties.api_key.type).toBe('string');
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('persists api_key, api_password, and companyDomain', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_key', 'api_password', 'companyDomain'],
            entity: ['companyDomain'],
        });
    });

    it('setAuthParams wires api key, password, and company domain', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'form-key',
            companyDomain: 'acme',
            api_password: 'x',
        });
        expect(api.api_key).toBe('form-key');
        expect(api.username).toBe('form-key');
        expect(api.companyDomain).toBe('acme');
        expect(api.baseUrl).toBe('https://acme.bamboohr.com/api/v1');
        expect(api.password).toBe('x');
    });

    it('getEntityDetails derives externalId from company domain', async () => {
        const api = new Api({
            api_key: 'k',
            companyDomain: 'acme',
        });
        api.getCompanyInformation = async () => ({
            domain: 'acme',
            displayName: 'Acme Corp',
            legalName: 'Acme Corporation',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('acme');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Corp');
        expect(details.details.companyDomain).toBe('acme');
    });

    it('getEntityDetails falls back to companyDomain when the API throws', async () => {
        const api = new Api({
            api_key: 'k',
            companyDomain: 'fallback-co',
        });
        api.getCompanyInformation = async () => {
            throw new Error('boom');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('fallback-co');
    });

    it('getEntityDetails fingerprints when no domain can be derived', async () => {
        const api = new Api({ api_key: 'key-abc' });
        api.companyDomain = null;
        api.getCompanyInformation = async () => ({});
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-3'
        );
        expect(details.identifiers.externalId).toBe(sha256(':key-abc'));
    });

    it('throws rather than returning a shared constant when nothing can be derived', async () => {
        const api = new Api({});
        api.api_key = null;
        api.username = null;
        api.companyDomain = null;
        api.getCompanyInformation = async () => ({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('fingerprint fallback is STABLE for the same key and UNIQUE across keys', async () => {
        const makeApi = (key) => {
            const api = new Api({ api_key: key });
            api.companyDomain = null;
            api.getCompanyInformation = async () => ({});
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

    it('getCredentialDetails agrees with entity externalId', async () => {
        const api = new Api({
            api_key: 'k',
            companyDomain: 'acme',
        });
        api.getCompanyInformation = async () => ({
            domain: 'acme',
            displayName: 'Acme',
        });
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
        expect(cred.identifiers.externalId).toBe(
            entity.identifiers.externalId
        );
    });

    it('retains NO hardcoded constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]bamboohr-account['"]/);
    });

    it('testAuthRequest performs getCompanyInformation', async () => {
        const api = new Api({
            api_key: 'k',
            companyDomain: 'acme',
        });
        let called = false;
        api.getCompanyInformation = async () => {
            called = true;
            return { domain: 'acme' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
