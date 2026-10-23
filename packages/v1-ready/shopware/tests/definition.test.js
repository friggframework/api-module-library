const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Shop-Ware Definition', () => {
    it('is an api-key module named shopware wired to the Api class', () => {
        expect(Definition.moduleName).toBe('shopware');
        expect(Definition.getName()).toBe('shopware');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('ShopWare');
        expect(Definition.moduleName).toMatch(
            /^[a-zA-Z][a-zA-Z0-9_-]*$/
        );
    });

    it('exposes an apiKey authorization form for partner id + secret', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['api_partner_id', 'api_secret'])
        );
        expect(reqs.data.uiSchema.api_secret['ui:widget']).toBe('password');
    });

    it('persists partner credentials and tenant_id on the entity', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_partner_id', 'api_secret'],
            entity: ['tenant_id'],
        });
    });

    it('setAuthParams wires partner id, secret, and tenant', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_partner_id: 'pid',
            api_secret: 'sec',
            tenant_id: '42',
        });
        expect(api.api_partner_id).toBe('pid');
        expect(api.api_secret).toBe('sec');
        expect(api.tenant_id).toBe('42');
    });

    it('getEntityDetails derives externalId from the first tenant', async () => {
        const api = new Api({
            api_partner_id: 'p',
            api_secret: 's',
        });
        api.listTenants = async () => ({
            results: [{ id: 69, name: 'Atomic Garage', cname: 'atomic69' }],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('69');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Atomic Garage');
        expect(details.details.tenantId).toBe(69);
        expect(api.tenant_id).toBe(69);
    });

    it('getEntityDetails falls back to configured tenant_id when list is empty', async () => {
        const api = new Api({
            api_partner_id: 'p',
            api_secret: 's',
            tenant_id: 7,
        });
        api.listTenants = async () => ({ results: [] });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('7');
    });

    it('throws when no tenant identity can be derived', async () => {
        const api = new Api({
            api_partner_id: 'p',
            api_secret: 's',
        });
        api.listTenants = async () => ({ results: [] });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('getCredentialDetails agrees with getEntityDetails', async () => {
        const api = new Api({
            api_partner_id: 'p',
            api_secret: 's',
        });
        api.listTenants = async () => ({
            results: [{ id: 11, name: 'Shop Eleven' }],
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

    it('testAuthRequest performs an authenticated tenants list', async () => {
        const api = new Api({
            api_partner_id: 'p',
            api_secret: 's',
        });
        let called = false;
        api.listTenants = async () => {
            called = true;
            return { results: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env maps SHOPWARE_* variables', () => {
        expect(Definition.env).toHaveProperty('api_partner_id');
        expect(Definition.env).toHaveProperty('api_secret');
        expect(Definition.env).toHaveProperty('tenant_id');
    });
});
