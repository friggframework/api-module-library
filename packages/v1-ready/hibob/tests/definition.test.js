const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('HiBob Definition', () => {
    it('is a basic-auth module named hibob wired to the Api class', () => {
        expect(Definition.moduleName).toBe('hibob');
        expect(Definition.getName()).toBe('hibob');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('HiBob');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes a basic authorization form for service user credentials', async () => {
        const api = new Api({});
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('basic');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining([
                'service_user_id',
                'service_user_token',
            ])
        );
        expect(
            reqs.data.uiSchema.service_user_token['ui:widget']
        ).toBe('password');
    });

    it('persists service user credentials and company_id', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'service_user_id',
                'service_user_token',
                'company_id',
                'baseUrl',
            ],
            entity: ['company_id'],
        });
    });

    it('setAuthParams wires service user onto BasicAuthRequester', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            service_user_id: 'su',
            service_user_token: 'tok',
            company_id: '42',
        });
        expect(api.username).toBe('su');
        expect(api.password).toBe('tok');
        expect(api.company_id).toBe('42');
    });

    it('getEntityDetails uses configured company_id', async () => {
        const api = new Api({
            service_user_id: 'su',
            service_user_token: 'tok',
            company_id: '637323',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('637323');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('HiBob 637323');
    });

    it('getEntityDetails derives companyId from searchPeople', async () => {
        const api = new Api({
            service_user_id: 'su',
            service_user_token: 'tok',
        });
        api.searchPeople = async () => ({
            employees: [{ id: '1', companyId: 111 }],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('111');
    });

    it('getEntityDetails falls back to service-user fingerprint', async () => {
        const api = new Api({
            service_user_id: 'key-abc',
            service_user_token: 'tok',
        });
        api.searchPeople = async () => ({ employees: [] });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-3'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-abc'));
    });

    it('fingerprint fallback is stable for the same key and unique across keys', async () => {
        const makeApi = (key) => {
            const api = new Api({
                service_user_id: key,
                service_user_token: 'tok',
            });
            api.searchPeople = async () => ({ employees: [] });
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

        expect(await idFor('cust-A')).toBe(await idFor('cust-A'));
        expect(await idFor('cust-A')).not.toBe(await idFor('cust-B'));
    });

    it('throws when nothing can be derived', async () => {
        const api = new Api({});
        api.service_user_id = null;
        api.username = null;
        api.searchPeople = async () => ({ employees: [] });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest performs listProfiles', async () => {
        const api = new Api({
            service_user_id: 'su',
            service_user_token: 'tok',
        });
        let called = false;
        api.testAuth = async () => {
            called = true;
            return {};
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('retains no hardcoded shared constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]hibob-account['"]/);
    });
});
