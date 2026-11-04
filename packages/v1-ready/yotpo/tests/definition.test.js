const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Yotpo Definition', () => {
    it('is an api-key module named yotpo wired to the Api class', () => {
        expect(Definition.moduleName).toBe('yotpo');
        expect(Definition.getName()).toBe('yotpo');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Yotpo');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes store_id + secret authorization requirements', async () => {
        const api = new Api({});
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['store_id', 'secret'])
        );
        expect(reqs.data.uiSchema.secret['ui:widget']).toBe('password');
    });

    it('persists store_id, secret, and access_token', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['store_id', 'secret', 'access_token'],
            entity: [],
        });
    });

    it('setAuthParams sets credentials and mints a token when needed', async () => {
        const api = new Api({});
        let minted = false;
        api.generateAccessToken = async () => {
            minted = true;
            api.setApiKey('minted-tok');
            return { access_token: 'minted-tok' };
        };
        await Definition.requiredAuthMethods.setAuthParams(api, {
            store_id: 'store-1',
            secret: 'sec-1',
        });
        expect(api.store_id).toBe('store-1');
        expect(api.secret).toBe('sec-1');
        expect(minted).toBe(true);
        expect(api.access_token).toBe('minted-tok');
    });

    it('setAuthParams reuses an existing access_token without minting', async () => {
        const api = new Api({});
        let minted = false;
        api.generateAccessToken = async () => {
            minted = true;
        };
        await Definition.requiredAuthMethods.setAuthParams(api, {
            store_id: 'store-1',
            secret: 'sec-1',
            access_token: 'existing',
        });
        expect(minted).toBe(false);
        expect(api.access_token).toBe('existing');
    });

    it('getEntityDetails uses store_id as externalId', async () => {
        const api = new Api({ store_id: 'store-xyz', access_token: 't' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('store-xyz');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toContain('store-xyz');
    });

    it('getCredentialDetails uses store_id as externalId', async () => {
        const api = new Api({ store_id: 'store-xyz' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('store-xyz');
    });

    it('throws when store_id is missing for identity', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/store_id/);
    });

    it('testAuthRequest performs an authenticated listProducts call', async () => {
        const api = new Api({ store_id: 's', access_token: 't' });
        let called = false;
        api.listProducts = async () => {
            called = true;
            return { products: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('matches the api-module-definition schema shape (structural)', () => {
        expect(typeof Definition.getName).toBe('function');
        expect(typeof Definition.moduleName).toBe('string');
        expect(Definition.requiredAuthMethods.setAuthParams).toBeDefined();
        expect(Definition.requiredAuthMethods.getEntityDetails).toBeDefined();
        expect(
            Definition.requiredAuthMethods.getCredentialDetails
        ).toBeDefined();
        expect(Definition.requiredAuthMethods.testAuthRequest).toBeDefined();
        expect(
            Definition.requiredAuthMethods.apiPropertiesToPersist.credential
        ).toEqual(expect.any(Array));
        expect(
            Definition.requiredAuthMethods.apiPropertiesToPersist.entity
        ).toEqual(expect.any(Array));
        expect(
            Definition.requiredAuthMethods.getAuthorizationRequirements
        ).toBeDefined();
    });

    it('retains no mongoose/manager.js-era exports in the package entry', () => {
        const pkg = require('../index');
        expect(pkg.Api).toBe(Api);
        expect(pkg.Definition).toBe(Definition);
        expect(pkg.ModuleManager).toBeUndefined();
        expect(pkg.Credential).toBeUndefined();
        expect(pkg.Entity).toBeUndefined();
        const managerPath = path.join(__dirname, '..', 'manager.js');
        expect(fs.existsSync(managerPath)).toBe(false);
    });
});
