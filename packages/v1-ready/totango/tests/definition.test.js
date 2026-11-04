const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');
const exported = require('../index');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('Totango Definition', () => {
    it('is an api-key module named totango wired to the Api class', () => {
        expect(Definition.moduleName).toBe('totango');
        expect(Definition.getName()).toBe('totango');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Totango');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exports Api and Definition from index plus mapping extensions', () => {
        expect(exported.Api).toBe(Api);
        expect(exported.Definition).toBe(Definition);
        expect(exported.extensions.mapping.schemas.business.schema).toBe(
            'business@1'
        );
        expect(
            exported.extensions.mapping.schemas.business.validation
        ).toBe('UNVALIDATED');
        expect(
            exported.extensions.mapping.schemas.accountHealth.model
                .AccountHealth.sameAs
        ).toBe('https://friggframework.org/canonical/AccountHealth');
    });

    it('exposes an apiKey authorization form for the app_token field', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toContain('app_token');
        expect(reqs.data.jsonSchema.properties.app_token.type).toBe('string');
        expect(reqs.data.uiSchema.app_token['ui:widget']).toBe('password');
    });

    it('persists api_key and baseUrl credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_key', 'baseUrl'],
            entity: [],
        });
    });

    it('setAuthParams sets the app token and optional base URL', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            app_token: 'form-token',
            base_url: 'https://api-eu1.totango.com',
        });
        expect(api.api_key).toBe('form-token');
        expect(api.baseUrl).toBe('https://api-eu1.totango.com');
    });

    it('getEntityDetails derives externalId from whoami', async () => {
        const api = new Api({ api_key: 'k' });
        api.getWhoAmI = async () => ({
            email: 'csm@example.com',
            display_name: 'CSM',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('csm@example.com');
        expect(details.details.name).toBe('CSM');
    });

    it('getEntityDetails falls back to Search service_id', async () => {
        const api = new Api({ api_key: 'k' });
        api.getWhoAmI = async () => {
            throw new Error('no whoami');
        };
        api.searchAccounts = async () => ({
            response: { service_id: '2324', accounts: { hits: [] } },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('2324');
    });

    it('getEntityDetails falls back to the app-token fingerprint', async () => {
        const api = new Api({ api_key: 'key-abc' });
        api.getWhoAmI = async () => ({});
        api.searchAccounts = async () => ({ response: {} });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-3'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-abc'));
    });

    it('fingerprint fallback is STABLE and UNIQUE across keys', async () => {
        const makeApi = (key) => {
            const api = new Api({ api_key: key });
            api.getWhoAmI = async () => ({});
            api.searchAccounts = async () => ({ response: {} });
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

    it('throws rather than returning a shared constant when nothing can be derived', async () => {
        const api = new Api({});
        api.api_key = null;
        api.getWhoAmI = async () => ({});
        api.searchAccounts = async () => ({ response: {} });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded totango-account constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]totango-account['"]/);
    });

    it('testAuthRequest prefers whoami then Search', async () => {
        const api = new Api({ api_key: 'k' });
        let who = false;
        api.getWhoAmI = async () => {
            who = true;
            return { email: 'a@b.c' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(who).toBe(true);

        const api2 = new Api({ api_key: 'k' });
        let searched = false;
        api2.getWhoAmI = async () => {
            throw new Error('denied');
        };
        api2.searchAccounts = async () => {
            searched = true;
            return { response: {} };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api2);
        expect(searched).toBe(true);
    });

    it('capability methods referenced in the manifest exist on Api', () => {
        const caps = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'totango.capabilities.json'),
                'utf8'
            )
        );
        const methods = Object.values(caps.capabilities).map((c) => c.method);
        for (const method of methods) {
            expect(typeof Api.prototype[method]).toBe('function');
        }
    });
});
