const { Definition } = require('../definition');
const { Api } = require('../api');
const checkModuleDefinition = (() => {
    try {
        return require('/tmp/frigg-refs/frigg-validate/packages/devtools/frigg-cli/validate-command/checks/integrations.js')
            .checkModuleDefinition;
    } catch {
        return null;
    }
})();

describe('Shopify Definition', () => {
    it('is an oauth2 module named shopify wired to the Api class', () => {
        expect(Definition.moduleName).toBe('shopify');
        expect(Definition.getName()).toBe('shopify');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Shopify');
        expect(/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(Definition.moduleName)).toBe(
            true
        );
    });

    it('exposes an oauth2 authorization form that collects shop', async () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example.com/redirect/shopify',
            scope: 'read_customers',
        });
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('oauth2');
        expect(reqs.data.jsonSchema.required).toContain('shop');
        expect(reqs.data.jsonSchema.properties.shop.type).toBe('string');
    });

    it('persists access_token, refresh_token, and shop', () => {
        expect(
            Definition.requiredAuthMethods.apiPropertiesToPersist.credential
        ).toEqual(
            expect.arrayContaining([
                'access_token',
                'refresh_token',
                'shop',
            ])
        );
        expect(
            Definition.requiredAuthMethods.apiPropertiesToPersist.entity
        ).toEqual([]);
    });

    it('getToken sets the shop then exchanges the code', async () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'sec',
            redirect_uri: 'https://app.example.com/redirect/shopify',
        });
        let exchanged;
        api.getTokenFromCode = async (code) => {
            exchanged = code;
            return { access_token: 't' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'abc', shop: 'acme.myshopify.com' },
        });
        expect(api.shop).toBe('acme.myshopify.com');
        expect(exchanged).toBe('abc');
    });

    it('getEntityDetails uses myshopifyDomain as externalId', async () => {
        const api = new Api({
            access_token: 't',
            shop: 'acme.myshopify.com',
        });
        api.getShop = async () => ({
            id: 'gid://shopify/Shop/1',
            name: 'Acme',
            myshopifyDomain: 'acme.myshopify.com',
            email: 'owner@acme.example',
            currencyCode: 'USD',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('acme.myshopify.com');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme');
    });

    it('getCredentialDetails agrees with entity externalId', async () => {
        const api = new Api({ access_token: 't', shop: 'acme.myshopify.com' });
        api.getShop = async () => ({
            id: 'gid://shopify/Shop/1',
            myshopifyDomain: 'acme.myshopify.com',
            name: 'Acme',
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('acme.myshopify.com');
    });

    it('testAuthRequest calls getShop', async () => {
        const api = new Api({ access_token: 't', shop: 'acme.myshopify.com' });
        let called = false;
        api.getShop = async () => {
            called = true;
            return { id: '1' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('passes Module.validateDefinition structural checks when available', () => {
        if (!checkModuleDefinition) return;
        const issues = checkModuleDefinition(Definition, '/shopify');
        const errors = issues.filter((i) => i.severity === 'error');
        expect(errors).toEqual([]);
    });
});
