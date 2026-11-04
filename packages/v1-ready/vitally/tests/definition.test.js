const { Definition } = require('../definition');
const { Api } = require('../api');

const { requiredAuthMethods } = Definition;

describe('Vitally Definition', () => {
    it('is named vitally and models the Vitally entity', () => {
        expect(Definition.getName()).toBe('vitally');
        expect(Definition.moduleName).toBe('vitally');
        expect(Definition.modelName).toBe('Vitally');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists api_key, subdomain, and optional base_url on the credential', () => {
        expect(requiredAuthMethods.apiPropertiesToPersist.credential).toEqual([
            'api_key',
            'subdomain',
            'base_url',
        ]);
    });

    it('wires ADR-057 mapping pointers', () => {
        expect(Definition.mappings.business).toBe('extensions.mapping');
        expect(Definition.mappings.AccountHealth).toBe('extensions.mapping');
    });

    describe('key fingerprinting', () => {
        it('derives a stable, non-reversible externalId from the api key', async () => {
            const api = { api_key: 'secret-key', subdomain: 'acme' };
            const entity = await requiredAuthMethods.getEntityDetails(
                api,
                {},
                {},
                'user-1'
            );
            const credential = await requiredAuthMethods.getCredentialDetails(
                api,
                'user-1'
            );

            expect(entity.identifiers.externalId).toBe(
                credential.identifiers.externalId
            );
            expect(entity.identifiers.externalId).not.toBe('secret-key');
            expect(entity.identifiers.externalId).toMatch(/^[a-f0-9]{64}$/);
            expect(entity.identifiers.userId).toBe('user-1');
        });

        it('falls back to the Basic-auth username when api_key is absent', async () => {
            const fromKey = await requiredAuthMethods.getEntityDetails(
                { api_key: 'ak', subdomain: 'acme' },
                {},
                {},
                'u'
            );
            const fromUsername = await requiredAuthMethods.getEntityDetails(
                { username: 'ak', subdomain: 'acme' },
                {},
                {},
                'u'
            );
            expect(fromKey.identifiers.externalId).toBe(
                fromUsername.identifiers.externalId
            );
        });

        it('produces different ids for different keys or subdomains', async () => {
            const a = await requiredAuthMethods.getEntityDetails(
                { api_key: 'key-a', subdomain: 'acme' },
                {},
                {},
                'u'
            );
            const b = await requiredAuthMethods.getEntityDetails(
                { api_key: 'key-b', subdomain: 'acme' },
                {},
                {},
                'u'
            );
            const c = await requiredAuthMethods.getEntityDetails(
                { api_key: 'key-a', subdomain: 'other' },
                {},
                {},
                'u'
            );
            expect(a.identifiers.externalId).not.toBe(b.identifiers.externalId);
            expect(a.identifiers.externalId).not.toBe(c.identifiers.externalId);
        });
    });

    describe('getAuthorizationRequirements', () => {
        it('delegates to the api form definition so the CLI renders it', async () => {
            let called = false;
            const api = {
                getAuthorizationRequirements: () => {
                    called = true;
                    return { type: 'basic', data: { jsonSchema: {} } };
                },
            };
            const reqs =
                await requiredAuthMethods.getAuthorizationRequirements(api);
            expect(called).toBe(true);
            expect(reqs.type).toBe('basic');
        });
    });

    describe('setAuthParams', () => {
        it('wires the form api key and subdomain onto the client', async () => {
            const api = new Api({});
            await requiredAuthMethods.setAuthParams(api, {
                api_key: 'ak-123',
                subdomain: 'acme',
            });
            expect(api.api_key).toBe('ak-123');
            expect(api.username).toBe('ak-123');
            expect(api.password).toBe('');
            expect(api.subdomain).toBe('acme');
            expect(api.baseUrl).toBe(
                'https://acme.rest.vitally.io/resources'
            );
        });

        it('honors a nested params.data payload and EU base_url override', async () => {
            const api = new Api({});
            await requiredAuthMethods.setAuthParams(api, {
                data: {
                    api_key: 'eu-key',
                    base_url: 'https://rest.vitally-eu.io/resources',
                },
            });
            expect(api.api_key).toBe('eu-key');
            expect(api.baseUrl).toBe('https://rest.vitally-eu.io/resources');
        });
    });

    describe('testAuthRequest', () => {
        it('delegates to api.testAuth', async () => {
            let called = false;
            const api = {
                testAuth: async () => {
                    called = true;
                    return { results: [] };
                },
            };
            await requiredAuthMethods.testAuthRequest(api);
            expect(called).toBe(true);
        });
    });

    it('exposes Definition.API as the Api class', () => {
        expect(Definition.API).toBe(Api);
    });
});
