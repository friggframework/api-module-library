const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('FreshBooks Definition', () => {
    it('is an oauth2 module named freshbooks wired to the Api class', () => {
        expect(Definition.moduleName).toBe('freshbooks');
        expect(Definition.getName()).toBe('freshbooks');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('FreshBooks');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements with an authorize URL', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://example.com/cb',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain(
            'https://auth.freshbooks.com/oauth/authorize/'
        );
    });

    it('persists tokens on credential and account/business on entity', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: ['accountId', 'businessId'],
        });
    });

    it('getToken exchanges the callback code', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code' },
        });
        expect(seen).toBe('auth-code');
    });

    it('getEntityDetails binds accountId from memberships', async () => {
        const api = new Api({ access_token: 't' });
        api.getUserInfo = async () => ({
            response: {
                id: 712052,
                email: 'b@example.com',
                business_memberships: [
                    {
                        role: 'owner',
                        business: {
                            id: 77128,
                            name: 'BillSpring',
                            account_id: 'zDmNq',
                        },
                    },
                ],
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('zDmNq');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('BillSpring');
        expect(api.accountId).toBe('zDmNq');
        expect(api.businessId).toBe(77128);
    });

    it('getEntityDetails honours an explicit account_id from the callback', async () => {
        const api = new Api({ access_token: 't' });
        api.getUserInfo = async () => ({
            response: {
                business_memberships: [
                    {
                        role: 'owner',
                        business: {
                            id: 1,
                            name: 'A',
                            account_id: 'AAA',
                        },
                    },
                    {
                        role: 'manager',
                        business: {
                            id: 2,
                            name: 'B',
                            account_id: 'BBB',
                        },
                    },
                ],
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            { data: { account_id: 'BBB' } },
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('BBB');
        expect(details.details.name).toBe('B');
    });

    it('getCredentialDetails uses the identity id', async () => {
        const api = new Api({ access_token: 't' });
        api.getUserInfo = async () => ({
            response: { id: 712052, email: 'b@example.com' },
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('712052');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getUserInfo', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getUserInfo = async () => {
            called = true;
            return { response: { id: 1 } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('exports only Api and Definition from index', () => {
        const mod = require('../index');
        expect(Object.keys(mod).sort()).toEqual(['Api', 'Definition']);
    });

    it('has a capability manifest that only references real Api methods', () => {
        const manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'freshbooks.capabilities.json'),
                'utf8'
            )
        );
        expect(manifest.schema).toBe('capability-manifest/v0.1');
        expect(manifest.module).toBe('freshbooks');
        expect(manifest.package).toBe(
            '@friggframework/api-module-freshbooks'
        );
        expect(manifest.version).toBe(
            require('../package.json').version
        );

        const clientMethods = new Set(
            Object.getOwnPropertyNames(Api.prototype).filter(
                (m) =>
                    typeof Api.prototype[m] === 'function' &&
                    m !== 'constructor'
            )
        );

        for (const [name, cap] of Object.entries(manifest.capabilities)) {
            const ref = cap.implementedBy && cap.implementedBy.ref;
            expect(ref).toMatch(/^Api\./);
            const method = ref.slice(4);
            expect(clientMethods.has(method)).toBe(true);
            void name;
        }

        for (const obj of Object.values(manifest.objects)) {
            for (const method of obj.methods) {
                expect(clientMethods.has(method)).toBe(true);
            }
        }
    });
});
