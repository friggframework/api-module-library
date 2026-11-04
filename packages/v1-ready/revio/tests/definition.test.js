const { Definition } = require('../definition');
const { Api } = require('../api');

const { requiredAuthMethods } = Definition;

describe('Rev.io Definition', () => {
    it('is named revio and models the Revio entity', () => {
        expect(Definition.getName()).toBe('revio');
        expect(Definition.moduleName).toBe('revio');
        expect(Definition.modelName).toBe('Revio');
        expect(Definition.API).toBe(Api);
    });

    it('moduleName matches the Frigg identifier pattern', () => {
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists username, password, and client_code on the credential', () => {
        expect(requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['username', 'password', 'client_code'],
            entity: ['client_code'],
        });
    });

    describe('getAuthorizationRequirements', () => {
        it('delegates to the api form definition', async () => {
            const api = new Api({});
            const reqs =
                await requiredAuthMethods.getAuthorizationRequirements(api);
            expect(reqs.type).toBe('basic');
            expect(reqs.data.jsonSchema.required).toContain('client_code');
        });
    });

    describe('setAuthParams', () => {
        it('wires form credentials onto the Api instance', async () => {
            const api = new Api({});
            await requiredAuthMethods.setAuthParams(api, {
                username: 'api.user',
                password: 'pw',
                client_code: 'Acme',
            });
            expect(api.username).toBe('api.user');
            expect(api.password).toBe('pw');
            expect(api.client_code).toBe('Acme');
        });

        it('also accepts nested params.data', async () => {
            const api = new Api({});
            await requiredAuthMethods.setAuthParams(api, {
                data: {
                    username: 'nested',
                    password: 'pw2',
                    client_code: 'Code',
                },
            });
            expect(api.username).toBe('nested');
            expect(api.client_code).toBe('Code');
        });
    });

    describe('identity', () => {
        it('uses client_code as the stable externalId', async () => {
            const api = new Api({
                username: 'u',
                password: 'p',
                client_code: 'TenantA',
            });
            api.listBillProfiles = async () => ({
                records: [{ bill_profile_id: 1, description: 'Default' }],
            });
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
            expect(entity.identifiers.externalId).toBe('TenantA');
            expect(credential.identifiers.externalId).toBe('TenantA');
            expect(entity.details.name).toBe('Default');
            expect(entity.identifiers.userId).toBe('user-1');
        });

        it('falls back to client_code as the display name when bill profiles fail', async () => {
            const api = new Api({
                username: 'u',
                password: 'p',
                client_code: 'TenantB',
            });
            api.listBillProfiles = async () => {
                throw new Error('boom');
            };
            const entity = await requiredAuthMethods.getEntityDetails(
                api,
                {},
                {},
                'u'
            );
            expect(entity.identifiers.externalId).toBe('TenantB');
            expect(entity.details.name).toBe('TenantB');
        });

        it('throws when client_code is missing rather than inventing a shared id', async () => {
            const api = new Api({ username: 'u', password: 'p' });
            await expect(
                requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
            ).rejects.toThrow(/client_code/i);
        });
    });

    describe('testAuthRequest', () => {
        it('calls api.testAuth', async () => {
            const api = new Api({
                username: 'u',
                password: 'p',
                client_code: 'c',
            });
            let called = false;
            api.testAuth = async () => {
                called = true;
                return { ok: true };
            };
            await requiredAuthMethods.testAuthRequest(api);
            expect(called).toBe(true);
        });
    });
});
