const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Gusto Definition', () => {
    it('is an oauth2 module named gusto wired to the Api class', () => {
        expect(Definition.moduleName).toBe('gusto');
        expect(Definition.getName()).toBe('gusto');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Gusto');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists OAuth tokens, optional system token, and company_uuid', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'system_access_token',
            ],
            entity: ['company_uuid'],
        });
    });

    it('exposes OAuth env keys (snake_case)', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('redirect_uri');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('base_url');
    });

    it('getToken exchanges the callback code via getTokenFromCode', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'from-callback' },
        });
        expect(seen).toBe('from-callback');
    });

    it('getEntityDetails uses token_info company uuid and company name', async () => {
        const api = new Api({ access_token: 't' });
        api.getTokenInfo = async () => ({
            scope: 'companies:read employees:read',
            resource: {
                type: 'Company',
                uuid: 'co-uuid-99',
            },
            resource_owner: { type: 'CompanyAdmin', uuid: 'admin-1' },
        });
        api.getCompany = async (id) => {
            expect(id).toBe('co-uuid-99');
            return { uuid: id, name: 'Shoppe Studios LLC' };
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('co-uuid-99');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Shoppe Studios LLC');
        expect(api.company_uuid).toBe('co-uuid-99');
    });

    it('getEntityDetails falls back to uuid when getCompany fails', async () => {
        const api = new Api({ access_token: 't' });
        api.getTokenInfo = async () => ({
            resource: { type: 'Company', uuid: 'co-2' },
        });
        api.getCompany = async () => {
            throw new Error('scope missing');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('co-2');
        expect(details.details.name).toBe('co-2');
    });

    it('getCredentialDetails keys off the company uuid', async () => {
        const api = new Api({ access_token: 't' });
        api.getTokenInfo = async () => ({
            resource: { type: 'Company', uuid: 'co-3' },
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-3'
            );
        expect(details.identifiers.externalId).toBe('co-3');
        expect(details.identifiers.userId).toBe('user-3');
    });

    it('testAuthRequest calls getTokenInfo', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getTokenInfo = async () => {
            called = true;
            return { scope: 'public' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('matches the required shape from the api-module-definition schema', () => {
        // Structural checks mirroring packages/schemas/.../api-module-definition.schema.json
        expect(typeof Definition.getName).toBe('function');
        expect(typeof Definition.moduleName).toBe('string');
        expect(Definition.requiredAuthMethods).toEqual(
            expect.objectContaining({
                getToken: expect.any(Function),
                getEntityDetails: expect.any(Function),
                getCredentialDetails: expect.any(Function),
                testAuthRequest: expect.any(Function),
                apiPropertiesToPersist: expect.objectContaining({
                    credential: expect.any(Array),
                    entity: expect.any(Array),
                }),
            })
        );
        // OAuth modules use getToken (not setAuthParams).
        expect(Definition.requiredAuthMethods.getToken).toBeDefined();
        expect(Definition.requiredAuthMethods.setAuthParams).toBeUndefined();
    });

    it('ships a capability manifest that only references real Api methods', () => {
        const manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'gusto.capabilities.json'),
                'utf8'
            )
        );
        expect(manifest.module).toBe('gusto');
        expect(manifest.package).toBe('@friggframework/api-module-gusto');
        expect(manifest.version).toBe('1.0.0');
        expect(manifest.auth).toBe('oauth2');
        expect(manifest.objects.employee.fields.length).toBeGreaterThan(0);
        expect(manifest.objects.employee.fields.some((f) => f.tag)).toBe(true);

        const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
            (m) =>
                typeof Api.prototype[m] === 'function' && m !== 'constructor'
        );
        for (const [name, cap] of Object.entries(manifest.capabilities)) {
            expect(clientMethods).toContain(cap.method);
            expect(cap.method).toBeTruthy();
            expect(name).toBeTruthy();
        }
    });
});
