const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('UKG Pro Definition', () => {
    it('is a basic-auth module named ukg-pro wired to the Api class', () => {
        expect(Definition.moduleName).toBe('ukg-pro');
        expect(Definition.getName()).toBe('ukg-pro');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('UkgPro');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes a basic authorization form', async () => {
        const api = new Api({});
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('basic');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining([
                'username',
                'password',
                'customer_api_key',
                'base_url',
            ])
        );
        expect(reqs.data.uiSchema.customer_api_key['ui:widget']).toBe(
            'password'
        );
    });

    it('persists basic credentials and base_url', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'username',
                'password',
                'customer_api_key',
                'base_url',
            ],
            entity: ['base_url'],
        });
    });

    it('setAuthParams wires username, password, customer key, and base URL', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            username: 'svc',
            password: 'pw',
            customer_api_key: 'KEY99',
            base_url: 'https://service2.ultipro.com/',
        });
        expect(api.username).toBe('svc');
        expect(api.password).toBe('pw');
        expect(api.customer_api_key).toBe('KEY99');
        expect(api.baseUrl).toBe('https://service2.ultipro.com');
        expect(api.base_url).toBe('https://service2.ultipro.com');
    });

    it('setAuthParams reads nested params.data and aliases', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            data: {
                user_name: 'nested',
                password: 'secret',
                customerApiKey: 'NEST1',
                hostname: 'https://host.example.com',
            },
        });
        expect(api.username).toBe('nested');
        expect(api.customer_api_key).toBe('NEST1');
        expect(api.baseUrl).toBe('https://host.example.com');
    });

    it('getEntityDetails uses customer_api_key as externalId', async () => {
        const api = new Api({
            username: 'u',
            password: 'p',
            customer_api_key: 'TEN99',
        });
        api.listCompanyDetails = async () => [
            {
                isMasterCompany: 'true',
                companyID: 'C0014',
                companyName: 'Acme Corp',
            },
        ];
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('TEN99');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Corp');
    });

    it('getEntityDetails falls back to a key-based name when company list fails', async () => {
        const api = new Api({
            username: 'u',
            password: 'p',
            customer_api_key: 'FALL1',
        });
        api.listCompanyDetails = async () => {
            throw new Error('boom');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('FALL1');
        expect(details.details.name).toBe('UKG Pro FALL1');
    });

    it('throws when customer_api_key is missing', async () => {
        const api = new Api({ username: 'u', password: 'p' });
        api.customer_api_key = null;
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/customer_api_key/i);
    });

    it('getCredentialDetails agrees with entity externalId', async () => {
        const api = new Api({
            username: 'u',
            password: 'p',
            customer_api_key: 'SAME1',
        });
        api.listCompanyDetails = async () => [];
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

    it('testAuthRequest performs an authenticated company-details call', async () => {
        const api = new Api({
            username: 'u',
            password: 'p',
            customer_api_key: 'K',
        });
        let called = false;
        api.testAuth = async () => {
            called = true;
            return [];
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('capability methods all exist on Api', () => {
        const manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'ukg-pro.capabilities.json'),
                'utf8'
            )
        );
        const methods = Object.values(manifest.capabilities).map((c) => c.method);
        for (const method of methods) {
            expect(typeof Api.prototype[method]).toBe('function');
        }
    });
});
